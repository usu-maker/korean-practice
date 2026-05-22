// api/chat.js - Vercel Serverless Function (Gemini 2.5 Flash Lite)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'サーバーへの接続方法が正しくありません' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません。Vercelの環境変数を確認してください' });

  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'メッセージの形式が正しくありません' });
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
          system_instruction: { parts: [{ text: system || '' }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
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
