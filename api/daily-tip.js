export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { goal, currentWeek, planName, recentPb } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are a professional strength and hypertrophy coach. Generate a single practical training tip for someone who is:
- On week ${currentWeek} of their "${planName||'hypertrophy'}" training plan
- Goal: ${goal||'build muscle'}
${recentPb ? `- Just hit a PB: ${recentPb}` : ''}

Write 2-3 sentences max. Make it specific to where they are in their programme. Be direct, motivating and actionable. No generic advice. Return just the tip text with no quotes or labels.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 150, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    if (!data.content?.[0]) return res.status(500).json({ error: 'No response' });
    return res.status(200).json({ tip: data.content[0].text.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
