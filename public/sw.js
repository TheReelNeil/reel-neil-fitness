// The Reel Neil Fitness service worker.
// Only used for rest timer lock-screen alerts. No caching, so it never
// changes how the app loads.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Rest over', {
    body: d.body || 'Time for your next set',
    tag: 'rest-timer',
    renotify: true,
    icon: '/icon-192.png?v=3',
    badge: '/icon-192.png?v=3',
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('/');
  }));
});
