export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { currentPlan, feedback, exercises } = req.body;
  if (!currentPlan || !feedback || !exercises) return res.status(400).json({ error: 'Missing required fields' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const exerciseList = exercises.map(e => `${e.id}: ${e.name} (${e.muscle})`).join('\n');

  const prompt = `You are a professional hypertrophy coach. You have already created the following training plan and the user wants some changes made to it.

CURRENT PLAN:
${JSON.stringify(currentPlan, null, 2)}

USER FEEDBACK:
"${feedback}"

INSTRUCTIONS:
- Make ONLY the changes the user has requested — keep everything else the same
- Only use exercises from the list below — use the EXACT id values
- Maintain the same number of days and overall structure unless specifically asked to change it
- Keep sets between 2-5, rep ranges as strings like "8-12"
- If asked to increase volume for a muscle, add sets to existing exercises or add a new exercise for that muscle
- If asked to reduce volume, remove sets or exercises for that muscle

AVAILABLE EXERCISES:
${exerciseList}

Return ONLY a valid JSON object with the same structure — no markdown, no explanation:
{
  "name": "plan name",
  "weeks": 12,
  "days": [
    {
      "name": "day name",
      "exercises": [
        { "exerciseId": "exact_id", "setConfigs": [{ "sets": 4, "repsRange": "8-12", "note": "" }] }
      ]
    }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    if (!data.content?.[0]) return res.status(500).json({ error: 'No response from AI' });
    const text = data.content[0].text.trim();
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const plan = JSON.parse(cleaned);
    return res.status(200).json({ plan });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to refine plan', details: err.message });
  }
}
