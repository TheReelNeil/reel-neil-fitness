export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { planName, dayName, week, totalVolume, prevVolume, newPbs, sessionNotes, exercises } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const volChange = prevVolume ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : null;
  const pbList = newPbs?.map(p => `${p.name}: ${p.weight}kg × ${p.reps} reps (est. ${p.orm}kg 1RM)`).join(', ');

  const prompt = `You are Neil's brutally honest but genuinely supportive PT. Generate a post-workout summary after his session.

SESSION DATA:
- Plan: ${planName}, Day: ${dayName}, Week ${week}
- Total volume: ${Math.round(totalVolume).toLocaleString()}kg${prevVolume ? ` (${volChange > 0 ? '+' : ''}${volChange}% vs last week's ${Math.round(prevVolume).toLocaleString()}kg)` : ' (first time doing this session)'}
${pbList ? `- New PBs hit: ${pbList}` : '- No new PBs this session'}
${sessionNotes ? `- Session notes: "${sessionNotes}"` : '- No session notes'}
${exercises ? `- Exercises logged: ${exercises}` : ''}

Write a punchy post-workout summary (3-5 sentences). Include:
- A comment on the volume (up/down/first session) — be specific with numbers
- If there were standout PBs, pick the most impressive ONE and big it up with the actual numbers
- If there were session notes, make a specific comment or give advice based on what they wrote
- End with something motivating but in your usual brutally honest mate style
- Be specific, use real numbers, keep it tight — no waffle

Return just the summary text, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 250, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    if (!data.content?.[0]) return res.status(500).json({ error: 'No response' });
    return res.status(200).json({ summary: data.content[0].text.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
