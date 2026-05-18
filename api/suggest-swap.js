export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { exerciseName, muscle, exercises } = req.body;

  if (!exerciseName || !muscle || !exercises) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Filter to same muscle group only, excluding the current exercise
  const sameMusclExercises = exercises
    .filter(e => e.muscle === muscle && e.name !== exerciseName)
    .map(e => `${e.id}: ${e.name}`);

  const prompt = `You are a strength and conditioning coach. A user wants to swap out "${exerciseName}" (${muscle}) from their training plan.

From the following list of ${muscle} exercises available in their library, recommend the 4 BEST replacements. Consider movement patterns, equipment, and training stimulus.

Available exercises:
${sameMusclExercises.join('\n')}

Return ONLY a valid JSON array of exactly 4 exercise IDs with a short reason for each — no markdown, no explanation:
[
  { "id": "exact_id", "reason": "Very short reason why this is a good swap" },
  { "id": "exact_id", "reason": "Very short reason why this is a good swap" },
  { "id": "exact_id", "reason": "Very short reason why this is a good swap" },
  { "id": "exact_id", "reason": "Very short reason why this is a good swap" }
]`;

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
        max_tokens: 500,
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
    const suggestions = JSON.parse(cleaned);
    return res.status(200).json({ suggestions });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to get suggestions', details: err.message });
  }
}
