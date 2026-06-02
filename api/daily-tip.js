export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { goal, currentWeek, planName, recentPb, currentWeight, targetWeight, totalWeeks,
          lastSteps, stepsTarget, thisWeekAvgSteps, thisWeekCals, calTarget, recentCardio } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
 
  const weeksLeft = totalWeeks && currentWeek ? totalWeeks - currentWeek : null;
 
  // Describe how recent the last steps log was, accurately
  let stepsTiming = '';
  if (lastSteps) {
    const D = lastSteps.daysAgo;
    if (D <= 0) stepsTiming = 'logged today';
    else if (D === 1) stepsTiming = 'logged yesterday';
    else if (D <= 6) stepsTiming = `logged ${D} days ago`;
    else stepsTiming = `last logged ${D} days ago (a while back — they haven't logged steps recently)`;
  }
 
  const trainingContext = [
    currentWeek && `Week ${currentWeek}${totalWeeks ? ` of ${totalWeeks}` : ''} of "${planName||'training'}" plan`,
    weeksLeft !== null && weeksLeft <= 3 && `Only ${weeksLeft} weeks left`,
    recentPb && `Recent PB: ${recentPb}`,
    currentWeight && targetWeight && `Weight: ${currentWeight}kg, target ${targetWeight}kg (${Math.abs(Math.round((currentWeight-targetWeight)*10)/10)}kg ${currentWeight>targetWeight?'to lose':'to gain'})`,
    currentWeight && !targetWeight && `Current weight: ${currentWeight}kg`,
  ].filter(Boolean).join('. ');
 
  const cardioContext = [
    lastSteps && stepsTarget && `Most recent steps log: ${lastSteps.steps.toLocaleString()} steps, ${stepsTiming} (daily target ${stepsTarget.toLocaleString()}) — that was ${lastSteps.steps >= stepsTarget ? 'on target' : `${(stepsTarget - lastSteps.steps).toLocaleString()} short`}`,
    lastSteps && !stepsTarget && `Most recent steps log: ${lastSteps.steps.toLocaleString()} steps, ${stepsTiming}`,
    !lastSteps && stepsTarget && `No steps have ever been logged (daily target ${stepsTarget.toLocaleString()})`,
    calTarget && thisWeekCals > 0 && `This week's cardio calories: ${thisWeekCals} of ${calTarget} target (${calTarget - thisWeekCals > 0 ? `${calTarget - thisWeekCals} still to go` : 'target hit!'})`,
    calTarget && thisWeekCals === 0 && `No cardio logged this week yet (weekly target ${calTarget} cals)`,
    recentCardio && `Most recent cardio session: ${recentCardio}`,
  ].filter(Boolean).join('. ');
 
  const prompt = `You are a brutally honest personal trainer with a sharp wit and genuine care for your client's results — you show it through funny, cutting banter rather than generic motivation.
 
Training context: ${trainingContext || 'Client is training'}
${cardioContext ? `Cardio & steps context: ${cardioContext}` : ''}
 
Write a short daily message (2-3 sentences max). Vary the focus each day — sometimes training, sometimes steps, sometimes cardio calories, sometimes weight.
 
CRITICAL ACCURACY RULES:
- Only reference the data you've been given. Do NOT invent or assume any numbers or timings.
- Be accurate about WHEN things happened. If their last steps log was "a while back", do NOT say "yesterday" — call out that they haven't logged steps in a while and give them stick for it.
- If no steps have ever been logged, mock them for never logging any rather than referencing a number.
- Use exact numbers from the data only.
 
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
