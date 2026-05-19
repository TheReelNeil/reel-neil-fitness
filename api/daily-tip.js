export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { goal, currentWeek, planName, recentPb, currentWeight, targetWeight, totalWeeks } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const weeksLeft = totalWeeks && currentWeek ? totalWeeks - currentWeek : null;

  const context = [
    currentWeek && `They are on week ${currentWeek}${totalWeeks ? ` of ${totalWeeks}` : ''} of their "${planName||'training'}" plan`,
    weeksLeft !== null && weeksLeft <= 3 && `They only have ${weeksLeft} weeks left in this plan`,
    weeksLeft !== null && weeksLeft > 3 && `They have ${weeksLeft} weeks to go`,
    recentPb && `Their most recent personal best is: ${recentPb}`,
    currentWeight && targetWeight && `Their current weight is ${currentWeight}kg and their target is ${targetWeight}kg`,
    currentWeight && !targetWeight && `Their current weight is ${currentWeight}kg`,
  ].filter(Boolean).join('. ');

  const prompt = `You are Neil's personal fitness coach — part drill sergeant, part best mate, all banter. You know Neil personally and speak to him directly.

Context about Neil right now:
${context || 'Neil is training hard'}

Write a short, punchy daily tip or motivational message (2-3 sentences max). Make it:
- Funny and light-hearted with genuine banter — like a mate taking the mick
- VERY specific to his actual data (mention his real PB weights, his actual week number, his real weight if available)
- Reference real things like biscuits, kebabs, the sofa, Netflix, or whatever fits
- If he hit a PB, big him up with the exact numbers and make it sound genuinely impressive
- If he's close to his weight target, acknowledge it specifically
- If he's near the end of his plan, hype it up or wind him up about it
- Occasionally throw in a dig about rest days or diet
- Never be generic — always tie it back to his specific numbers

Return just the message text, nothing else. No quotes.`;

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
