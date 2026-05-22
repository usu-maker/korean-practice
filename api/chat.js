// api/chat.js - Vercel Serverless Function (Gemini)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY が設定されていません' });

  const { messages, system } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages が不正です' });
  }

  // Gemini形式に変換（先頭がuserでないとエラーになるため調整）
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    return res.status(500).json({ error: `Gemini接続失敗: ${e.message}` });
  }

  let data;
  try {
    data = await geminiRes.json();
  } catch (e) {
    return res.status(500).json({ error: `レスポンス解析失敗: ${e.message}` });
  }

  // エラーレスポンスの場合
  if (!geminiRes.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    return res.status(geminiRes.status).json({ error: `Gemini APIエラー: ${msg}` });
  }

  // テキスト抽出
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return res.status(500).json({ error: `テキスト取得失敗。レスポンス: ${JSON.stringify(data).slice(0, 300)}` });
  }

  return res.status(200).json({ text });
}
