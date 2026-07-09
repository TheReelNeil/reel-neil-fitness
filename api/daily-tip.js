S
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { currentWeek, planName, recentPb, currentWeight, targetWeight, totalWeeks,
          stepsTarget, kcalTarget, focus, streak, yesterday, recovery, weekAvgs } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
 
  const weeksLeft = totalWeeks && currentWeek ? totalWeeks - currentWeek : null;
 
  const ctx = [];
  if (currentWeek) ctx.push(`Week ${currentWeek}${totalWeeks ? ` of ${totalWeeks}` : ''} of "${planName || 'training'}" plan${weeksLeft !== null && weeksLeft <= 3 ? ` — only ${weeksLeft} weeks left` : ''}`);
  if (recentPb) ctx.push(`Recent PB: ${recentPb}`);
  if (currentWeight && targetWeight) ctx.push(`Weight: ${currentWeight}kg, target ${targetWeight}kg (${Math.abs(Math.round((currentWeight - targetWeight) * 10) / 10)}kg ${currentWeight > targetWeight ? 'to lose' : 'to gain'})`);
  else if (currentWeight) ctx.push(`Current weight: ${currentWeight}kg`);
  if (typeof streak === 'number' && streak > 0) ctx.push(`Check-in streak: ${streak} consecutive days fully logged`);
  if (typeof streak === 'number' && streak === 0) ctx.push(`Check-in streak: broken — yesterday wasn't fully logged`);
 
  if (yesterday) {
    const Y = [];
    if (yesterday.steps != null) Y.push(`${yesterday.steps.toLocaleString()} steps${stepsTarget ? ` (target ${stepsTarget.toLocaleString()} — ${yesterday.steps >= stepsTarget ? 'hit' : `${(stepsTarget - yesterday.steps).toLocaleString()} short`})` : ''}`);
    if (yesterday.kcal != null) Y.push(`${yesterday.kcal.toLocaleString()} kcal eaten${kcalTarget ? ` (target ${kcalTarget.toLocaleString()} — ${yesterday.kcal <= kcalTarget ? 'on plan' : `${(yesterday.kcal - kcalTarget).toLocaleString()} over`})` : ''}`);
    if (yesterday.offPlan) Y.push('had an off-plan meal');
    if (yesterday.alcohol) Y.push('had alcohol');
    if (Y.length) ctx.push(`Yesterday: ${Y.join('; ')}`);
  }
 
  if (recovery) {
    const R = [];
    if (recovery.sleepLastNight != null) R.push(`slept ${recovery.sleepLastNight}h last night${recovery.sleepAvg30 != null ? ` (30-day avg ${recovery.sleepAvg30}h)` : ''}`);
    if (recovery.hrv != null) R.push(`HRV ${recovery.hrv}${recovery.hrvAvg30 != null ? ` (avg ${recovery.hrvAvg30})` : ''}`);
    if (recovery.rhr != null) R.push(`resting HR ${recovery.rhr}${recovery.rhrAvg30 != null ? ` (avg ${recovery.rhrAvg30})` : ''}`);
    if (R.length) ctx.push(`Recovery: ${R.join('; ')}`);
  }
 
  if (weekAvgs) {
    const W = [];
    if (weekAvgs.weightThis != null) W.push(`weight avg ${weekAvgs.weightThis}kg${weekAvgs.weightLast != null ? ` (last week ${weekAvgs.weightLast}kg)` : ''}`);
    if (weekAvgs.kcalThis != null) W.push(`calorie avg ${weekAvgs.kcalThis.toLocaleString()}${kcalTarget ? ` vs ${kcalTarget.toLocaleString()} target` : ''}`);
    if (weekAvgs.stepsThis != null) W.push(`step avg ${weekAvgs.stepsThis.toLocaleString()}${stepsTarget ? ` vs ${stepsTarget.toLocaleString()} target` : ''}`);
    if (weekAvgs.sleepThis != null) W.push(`sleep avg ${weekAvgs.sleepThis}h`);
    if (W.length) ctx.push(`This week so far: ${W.join('; ')}`);
  }
 
  const prompt = `You are a brutally honest personal trainer with a sharp wit and genuine care for your client's results — you show it through funny, cutting banter rather than generic motivation.
 
Client data (all real, tracked in their app and synced from their Apple Watch):
${ctx.map(C => `- ${C}`).join('\n')}
 
Today's suggested focus: ${focus || 'whatever stands out most in the data'}.
 
Write a short daily message (2-3 sentences max). Lead with the suggested focus IF the data has something worth saying about it; otherwise pick the single most interesting or most damning signal in the data. React to SPECIFIC numbers — praise what's genuinely good (streaks, targets hit, weight trending the right way, strong recovery), and give them stick for what isn't (short sleep, missed steps, calorie overshoots, off-plan meals, alcohol, broken streaks).
 
CRITICAL ACCURACY RULES:
- Only reference the data you've been given. Do NOT invent or assume any numbers, timings or events.
- Use exact numbers from the data only.
- If a metric isn't listed above, don't mention it.
 
Style:
- Address the user as "you" — never use a name
- Diet/sofa/laziness banter is fine: kebabs, pies, McDonald's, takeaways, Netflix
- No motorbike, car, vehicle or sports-race metaphors
- Keep it to 2-3 punchy sentences
 
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
