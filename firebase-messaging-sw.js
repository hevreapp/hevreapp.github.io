// Shows חבר'ה notifications when the site is closed or in the background.
// The server sends data-only messages; we draw them here, and skip them when that group is open on screen.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyClogwoAT_icZWh9y6Ub2fJNOXjQVwGlVk',
  authDomain: 'hevre-f8f20.firebaseapp.com',
  projectId: 'hevre-f8f20',
  storageBucket: 'hevre-f8f20.firebasestorage.app',
  messagingSenderId: '128156693499',
  appId: '1:128156693499:web:8041828b23532f8c52d15e',
});

firebase.messaging().onBackgroundMessage(async payload => {
  if (payload.notification) return; // Firebase already shows these by itself
  const d = payload.data || {};
  const open = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (open.some(c => c.focused && d.link && c.url.endsWith(d.link.slice(d.link.indexOf('#'))))) return; // already looking at it
  await self.registration.showNotification(d.title || "חבר'ה", {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    dir: 'rtl',
    lang: 'he',
    data: { link: d.link || './' },
  });
});

// ---- quick start and offline: the site's own files stay on the phone ----
// Pages: network first (so updates show right away), the saved copy when there's no signal.
// Files with ?v= in the name and the Firebase/font files never change: from the phone first.
// Only files are kept here, never anyone's data.
const CACHE = 'hevre-files';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (req.mode === 'navigate' || (same && /\.(png|json|html)$/.test(url.pathname))) {
    e.respondWith(networkFirst(req, same && req.mode === 'navigate' ? new URL(url.pathname, url.origin).href : req));
  } else if ((same && url.searchParams.has('v')) || (url.host === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))
    || url.host === 'fonts.gstatic.com' || url.host === 'fonts.googleapis.com' || url.host === 'cdnjs.cloudflare.com') {
    e.respondWith(cacheFirst(req, same ? url : null));
  }
});
async function networkFirst(req, key) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    return (await cache.match(key)) || Response.error();
  }
}
async function cacheFirst(req, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    await cache.put(req, res.clone());
    // a new version of app.js etc.: drop the old one
    if (url) for (const k of await cache.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) cache.delete(k); }
  }
  return res;
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const link = data.link || data.FCM_MSG?.data?.link || data.FCM_MSG?.notification?.click_action || './';
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = all.find(c => c.url.startsWith(self.registration.scope));
    if (tab) { await tab.focus(); return tab.navigate(link); }
    return clients.openWindow(link);
  })());
});
