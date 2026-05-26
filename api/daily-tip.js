export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { goal, currentWeek, planName, recentPb, currentWeight, targetWeight, totalWeeks,
          lastSteps, stepsTarget, thisWeekAvgSteps, thisWeekCals, calTarget, recentCardio } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const weeksLeft = totalWeeks && currentWeek ? totalWeeks - currentWeek : null;

  const trainingContext = [
    currentWeek && `Week ${currentWeek}${totalWeeks ? ` of ${totalWeeks}` : ''} of "${planName||'training'}" plan`,
    weeksLeft !== null && weeksLeft <= 3 && `Only ${weeksLeft} weeks left`,
    recentPb && `Recent PB: ${recentPb}`,
    currentWeight && targetWeight && `Weight: ${currentWeight}kg, target ${targetWeight}kg (${Math.abs(Math.round((currentWeight-targetWeight)*10)/10)}kg ${currentWeight>targetWeight?'to lose':'to gain'})`,
    currentWeight && !targetWeight && `Current weight: ${currentWeight}kg`,
  ].filter(Boolean).join('. ');

  const cardioContext = [
    lastSteps && stepsTarget && `Last logged steps: ${lastSteps.steps.toLocaleString()} on ${lastSteps.date} (daily target: ${stepsTarget.toLocaleString()}) — ${lastSteps.steps >= stepsTarget ? 'hit the target' : `${(stepsTarget - lastSteps.steps).toLocaleString()} short of target`}`,
    lastSteps && !stepsTarget && `Last logged steps: ${lastSteps.steps.toLocaleString()} on ${lastSteps.date}`,
    thisWeekAvgSteps && stepsTarget && `This week's average steps: ${thisWeekAvgSteps.toLocaleString()} (target: ${stepsTarget.toLocaleString()})`,
    calTarget && thisWeekCals > 0 && `This week's cardio calories burned: ${thisWeekCals} of ${calTarget} target (${calTarget - thisWeekCals > 0 ? `${calTarget - thisWeekCals} still to go` : 'target hit!'})`,
    calTarget && thisWeekCals === 0 && `No cardio calories logged this week yet (weekly target: ${calTarget})`,
    recentCardio && `Most recent cardio: ${recentCardio}`,
  ].filter(Boolean).join('. ');

  const prompt = `You are a brutally honest personal trainer with a sharp wit and genuine care for your client's results — you show it through funny, cutting banter rather than generic motivation.

Training context: ${trainingContext || 'Client is training'}
${cardioContext ? `Cardio & steps context: ${cardioContext}` : ''}

Write a short daily message (2-3 sentences max). Vary the focus — sometimes comment on training progress, sometimes on steps history, sometimes on cardio calories remaining for the week, sometimes on weight. Use the actual numbers. Some ideas:
- If their last logged steps were below target: mock them for it with specific numbers
- If they smashed their steps: give genuine (if sarcastic) credit
- If they haven't hit their weekly cardio calorie target yet: point out exactly how much is left
- If they're behind on cardio: suggest it's because they're welded to the sofa
- If they hit a PB: make the exact numbers sound genuinely impressive
- Diet banter: kebabs, pies, McDonald's, curries, beer, takeaways
- No motorbike, car, vehicle or sports race metaphors whatsoever
- Address the user as "you" — never use a name
- Keep it to 2-3 punchy sentences, specific to their data

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
