// Rest timer lock-screen alert.
// The app calls this when a rest starts. We reply straight away, then wait
// in the background until the rest ends and send a web push notification,
// which iOS shows even when the phone is locked or the app is closed.
import webpush from 'web-push';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 300 };

const SB_URL = 'https://nzhsffkflbknciojaexi.supabase.co';
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aHNmZmtmbGJrbmNpb2phZXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTk1MjAsImV4cCI6MjA5NDY3NTUyMH0.augC9mFf--otWeSwX5IfjIUqx_FofITjJ_nkZMU5dC8";
const MAX_WAIT_MS = 285000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// The app stores the current rest as user_data "rest_timer" {id, endAt}.
// If the rest was stopped or restarted, the stored id no longer matches.
async function stillCurrent(token, id) {
  if (!token) return true;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/user_data?key=eq.rest_timer&select=value`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return true;
    const rows = await r.json();
    const cur = Array.isArray(rows) ? rows[0]?.value : null;
    if (!cur) return true;
    return cur.id === id;
  } catch {
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { subscription, endAt, id, token } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys || typeof endAt !== 'number' || !id)
    return res.status(400).json({ error: 'Bad request' });
  const wait = endAt - Date.now();
  if (wait < -5000 || wait > MAX_WAIT_MS) return res.status(400).json({ error: 'Rest too long' });

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(500).json({ error: 'Push not configured' });
  webpush.setVapidDetails('https://reel-neil-fitness.vercel.app', pub, priv);

  waitUntil((async () => {
    await sleep(Math.max(0, endAt - Date.now()));
    if (!(await stillCurrent(token, id))) return;
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title: 'Rest over', body: 'Time for your next set 💪' }),
        { TTL: 60, urgency: 'high' }
      );
    } catch (e) {
      console.error('rest push failed', e?.statusCode, e?.body);
    }
  })());

  return res.status(200).json({ ok: true });
}
