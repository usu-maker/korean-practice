// api/chat.js - Vercel Serverless Function (Gemini 2.5 Flash Lite + Tavily Search)

/* ─── Tavily 検索 ─── */
async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
        include_raw_content: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.answer) return data.answer;
    if (data.results && data.results.length > 0) {
      return data.results
        .slice(0, 3)
        .map(r => r.content || r.snippet || '')
        .filter(Boolean)
        .join('\n');
    }
    return null;
  } catch {
    return null;
  }
}

/* ─── 検索結果を指定文字数に切り詰め ─── */
function truncate(text, maxLen = 500) {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

/* ─── タイムアウト付き Promise ─── */
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

/* ─── テーマ別 Tavily 検索クエリ（複数） ─── */
const THEME_QUERIES = {
  game: [
    'ブルーアーカイブ 最新情報 2026',
    '人気ゲーム ランキング 最新 2026',
    'ステラーブレイド 最新',
  ],
  anime: [
    '2026年 春アニメ 話題 ランキング',
    'アニメ 今週 最終回 感想',
    '人気アニメ キャラクター 最新',
  ],
  sports: [
    'MLB 試合結果 最新',
    '大谷翔平 最新ニュース',
    'プレミアリーグ 順位 最新',
  ],
  kpop: [
    'K-pop 新曲 2026 話題',
    'BTS BLACKPINK 最新情報 2026',
    '韓国アイドル ランキング 最新',
  ],
  cooking: [
    '韓国料理 人気 トレンド 2026',
    '韓国グルメ 最新 話題',
  ],
  travel: [
    '韓国旅行 おすすめスポット 2026',
    'ソウル 観光 最新情報',
  ],
};

/* ─── テーマ表示名 ─── */
const THEME_LABELS = {
  game:    'ゲーム',
  anime:   'アニメ',
  sports:  'スポーツ',
  kpop:    'K-pop',
  cooking: '料理',
  travel:  '旅行',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'サーバーへの接続方法が正しくありません' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません。Vercelの環境変数を確認してください' });

  const { messages, system, theme } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'メッセージの形式が正しくありません' });
  }

  /* ── システムプロンプト構築（Tavily 複数クエリ結果を追記） ── */
  let systemPrompt = system || '';

  /* ── 重要単語JSON出力の指示を必ず追記 ── */
  systemPrompt += `\n\n## 返答内の重要単語リスト（必須・省略禁止）\n[JA][/JA]ブロックの直後に、今回の韓国語返答文中に登場した重要な単語を以下のJSON形式で出力すること。必ず含めること（単語がなくても空配列で出力）。\n[WORDS]\n{"words":[{"word":"한국어","reading":"かんこくご","meaning":"韓国語"},{"word":"공부","reading":"べんきょう","meaning":"勉強"}]}\n[/WORDS]\nルール：\n- 最大5単語まで\n- 実際に韓国語返答文中に登場した単語のみ選ぶ\n- readingは必ずひらがなで記載（カタカナ・ローマ字不可）\n- 単語がない場合も {"words":[]} と出力すること`;


  if (theme && THEME_QUERIES[theme]) {
    const isFirstMessage = messages.length <= 1;
    if (isFirstMessage) {
      // 複数クエリを並列実行（各5秒タイムアウト）
      const queries = THEME_QUERIES[theme];
      const results = await Promise.all(
        queries.map(q => withTimeout(tavilySearch(q), 5000))
      );

      // nullを除外・500文字に切り詰め・改行区切りで結合
      const combined = results
        .filter(Boolean)
        .map((r, i) => `【検索${i + 1}】${truncate(r, 500)}`)
        .join('\n---\n');

      if (combined) {
        const label = THEME_LABELS[theme] || theme;
        systemPrompt += `

## テーマ「${label}」の最新情報
あなたはテーマ「${label}」が大好きなソナ先生です。
以下の最新情報を自然に会話に織り交ぜてください：

${combined}

## 会話ルール（テーマ追加分）
- 最新情報を知っている友人として自然に話す
- 具体的な作品名・キャラ名・選手名・曲名を積極的に使う
- アニメ：今期の話題作のキャラ・展開・感想に言及
- スポーツ：実際の試合結果・選手名・順位を使う
- K-pop：最新曲・アルバム・メンバー名を具体的に使う
- ゲーム：キャラ・イベント・アップデート情報を使う
- 料理：最新トレンドのメニュー・食材を使う
- 旅行：具体的なスポット・グルメ・イベント情報を使う
- オタク・ファン目線で熱量高く話す`;
      }
    }
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
        }),
      }
    );
  } catch (e) {
    return res.status(500).json({ error: 'AIサーバーに接続できませんでした。しばらく待ってから再試行してください' });
  }

  let data;
  try {
    data = await geminiRes.json();
  } catch (e) {
    return res.status(500).json({ error: 'AIからの応答を読み取れませんでした。再試行してください' });
  }

  // エラーコードを日本語メッセージに変換
  if (!geminiRes.ok) {
    const rawMsg = data?.error?.message || '';
    const status = geminiRes.status;
    let friendlyMsg;

    if (status === 429 || rawMsg.includes('quota') || rawMsg.includes('Quota')) {
      friendlyMsg = '利用制限に達しました。少し時間をおいてから再試行してください（無料枠の上限です）';
    } else if (rawMsg.includes('high demand') || rawMsg.includes('overloaded')) {
      friendlyMsg = 'AIサーバーが混雑しています。1〜2分後にもう一度試してください';
    } else if (status === 400) {
      friendlyMsg = '送信内容に問題があります。ページを再読み込みしてもう一度お試しください';
    } else if (status === 401 || status === 403) {
      friendlyMsg = 'APIキーが無効または期限切れです。Vercelの環境変数を確認してください';
    } else if (status === 404) {
      friendlyMsg = 'AIモデルが見つかりません。しばらく待ってから再試行してください';
    } else if (status >= 500) {
      friendlyMsg = 'AIサーバー側で問題が発生しています。しばらく待ってから再試行してください';
    } else {
      friendlyMsg = `AIとの通信でエラーが発生しました（コード: ${status}）。再試行してください`;
    }

    return res.status(status).json({ error: friendlyMsg });
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return res.status(500).json({ error: 'AIからの返答が空でした。もう一度話しかけてみてください' });
  }

  return res.status(200).json({ text });
}
