export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { planName, dayName, week, totalVolume, prevVolume, newPbs, sessionNotes, exercises } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const volChange = prevVolume ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : null;
  const pbList = newPbs?.map(P => `${P.name}: ${P.weight}kg × ${P.reps} reps (est. ${P.orm}kg 1RM)`).join(', ');

  const prompt = `You are a brutally honest but genuinely supportive personal trainer. Generate a post-workout summary for your client.

SESSION DATA:
- Plan: ${planName}, Day: ${dayName}, Week ${week}
- Total volume: ${Math.round(totalVolume).toLocaleString()}kg${prevVolume ? ` (${volChange > 0 ? '+' : ''}${volChange}% vs last week's ${Math.round(prevVolume).toLocaleString()}kg)` : ' (first time doing this session)'}
${pbList ? `- New PBs hit: ${pbList}` : '- No new PBs this session'}
${sessionNotes ? `- Session notes: "${sessionNotes}"` : '- No session notes'}
${exercises ? `- Exercises logged: ${exercises}` : ''}

Write a punchy post-workout summary (3-5 sentences). Vary the style each time — sometimes lead with volume, sometimes with a PB, sometimes with a real-world strength comparison. Include:

1. Volume comment — mention the number and whether it's up or down vs last week
2. If there were PBs, pick the most impressive ONE and either:
   - Big it up with the exact numbers and real-world context (e.g. "an estimated 1RM of 120kg puts you stronger than roughly 85% of recreational gym-goers", or "most people who train never bench more than their own bodyweight — you're well past that")
   - Use population percentages where you genuinely know them for common lifts (bench press, squat, deadlift, overhead press, row). Be specific but honest — don't invent percentages you're unsure of, use phrases like "a small percentage of gym-goers" or "well above average for recreational lifters" if unsure
   - For less common exercises, compare it to what a typical gym-goer could manage rather than a percentage
3. If there were session notes, make a specific comment on what was written
4. Close with something motivating in your usual brutally honest style
5. Address the user as "you" — never use their name
6. No vehicle, motorbike or race metaphors

Return just the summary text, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/JSON', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    if (!data.content?.[0]) return res.status(500).json({ error: 'No response' });
    return res.status(200).json({ summary: data.content[0].text.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
