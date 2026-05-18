export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { description, exercises } = req.body;

  if (!description || !exercises) {
    return res.status(400).json({ error: 'Missing description or exercises' });
  }

  const exerciseList = exercises.map(E => `${E.id}: ${E.name} (${E.muscle})`).join('\n');

  const prompt = `You are a professional hypertrophy-focused strength coach. Create a detailed training plan based on this request:

"${description}"

STRICT RULES:
- Only use exercises from the list below — use the EXACT id values
- Sets should be between 2 and 5
- Rep ranges as strings like "6-10", "8-12", "10-15", "12-20"
- Choose exercises appropriate for the muscle groups and goals described
- If the user mentions a number of days, create exactly that many training days
- Plan name should be short and descriptive

AVAILABLE EXERCISES:
${exerciseList}

Return ONLY a valid JSON object — no markdown, no explanation, nothing else:
{
  "name": "Plan name",
  "weeks": 12,
  "days": [
    {
      "name": "Day name e.g. Upper A",
      "exercises": [
        {
          "exerciseId": "exact_id",
          "setConfigs": [{ "sets": 4, "repsRange": "8-12", "note": "" }]
        }
      ]
    }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/JSON',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from AI', details: data });
    }

    const text = data.content[0].text.trim();

    // Strip any accidental markdown code fences
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    const plan = JSON.parse(cleaned);
    return res.status(200).json({ plan });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate plan', details: err.message });
  }
}
