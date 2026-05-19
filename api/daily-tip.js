export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { goal, currentWeek, planName, recentPb, currentWeight, targetWeight, totalWeeks } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const weeksLeft = totalWeeks && currentWeek ? totalWeeks - currentWeek : null;

  const context = [
    currentWeek && `They are on week ${currentWeek}${totalWeeks ? ` of ${totalWeeks}` : ''} of their "${planName||'training'}" plan`,
    weeksLeft !== null && weeksLeft <= 3 && `Only ${weeksLeft} weeks left in this plan`,
    recentPb && `Most recent PB: ${recentPb}`,
    currentWeight && targetWeight && `Current weight: ${currentWeight}kg, target: ${targetWeight}kg (${Math.round((currentWeight-targetWeight)*10)/10}kg to go)`,
    currentWeight && !targetWeight && `Current weight: ${currentWeight}kg`,
  ].filter(Boolean).join('. ');

  const prompt = `You are Neil's brutally honest best mate who also happens to be a PT. You have zero filter, a sharp wit, and genuinely care about his results — but you show it through relentless, funny abuse rather than motivational posters.

Context about Neil:
${context || 'Neil is training'}

Write a short daily message (2-3 sentences max). Pull from this range of material freely — vary it every day:
- His actual weight and how far he is from his target (be brutal but specific with numbers)
- Jokes about being fat, overweight, carrying extra timber, needing two seats, etc
- Jabs about skipping sessions, making excuses, or loving the sofa more than the squat rack
- Food-related: kebabs, McDonald's, curries, pies, full English, beers, not just biscuits
- Gym culture banter: gym selfies, not going deep enough, leaving the weights out, talking too much between sets
- Huge hype when he hits a PB — make the exact numbers sound genuinely impressive
- End-of-plan urgency or mid-plan slump digs
- Occasional genuine encouragement buried in the abuse
- TV/Netflix/PlayStation digs when appropriate
- Compare him to a specific athlete or strongman sarcastically if it fits

Rules:
- ALWAYS reference his real numbers (weight, PB, week number) — never be generic
- Rotate the type of joke — don't always go for food, mix it up
- Keep it punchy — no waffle
- It should make him laugh AND feel slightly guilty
- Never be offensive about anything other than his fitness/diet/laziness

Return just the message, nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/JSON', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    if (!data.content?.[0]) return res.status(500).json({ error: 'No response' });
    return res.status(200).json({ tip: data.content[0].text.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
