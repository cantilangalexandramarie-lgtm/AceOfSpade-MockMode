export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, provider = 'groq' } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  async function callGroq(messages) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? null;
  }

  async function callGemini(messages) {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const contents = otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const payload = { contents };
    if (systemMessage) {
      payload.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  try {
    let result = null;

    if (provider === 'groq') {
      result = await callGroq(messages);
      if (!result) result = await callGemini(messages); // fallback
    } else {
      result = await callGemini(messages);
      if (!result) result = await callGroq(messages); // fallback
    }

    if (!result) {
      return res.status(500).json({ error: 'Both AI providers failed. Please try again.' });
    }

    return res.status(200).json({ content: result });

  } catch (error) {
    console.error('AI handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}