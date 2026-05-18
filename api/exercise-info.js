export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { exerciseName, muscle } = req.body;

  if (!exerciseName) {
    return res.status(400).json({ error: 'Missing exercise name' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are a professional strength and conditioning coach. Provide a concise exercise guide for "${exerciseName}" (primary muscle: ${muscle}).

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "setup": "How to set up and get into position (1-2 sentences)",
  "execution": ["Step 1", "Step 2", "Step 3", "Step 4"],
  "primaryMuscles": ["muscle1", "muscle2"],
  "secondaryMuscles": ["muscle1", "muscle2"],
  "formCues": ["Cue 1", "Cue 2", "Cue 3"],
  "commonMistakes": ["Mistake 1", "Mistake 2"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    const text = data.content[0].text.trim();
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const info = JSON.parse(cleaned);
    return res.status(200).json({ info });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to get exercise info', details: err.message });
  }
}
