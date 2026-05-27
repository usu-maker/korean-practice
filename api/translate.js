// api/translate.js - 韓国語単語翻訳 Serverless Function

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'word is required' });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `韓国語の単語「${word}」の読み方と意味を教えてください。必ず以下のJSONのみを返してください（余分な説明不要）：\n{"reading":"ひらがなで読み方","meaning":"日本語の意味（簡潔に）"}` }],
          }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.2 },
        }),
      }
    );
    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: '翻訳を取得できませんでした' });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: '翻訳を取得できませんでした' });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({
      reading: parsed.reading || '',
      meaning: parsed.meaning || '',
    });
  } catch {
    return res.status(500).json({ error: '翻訳の取得に失敗しました' });
  }
}
