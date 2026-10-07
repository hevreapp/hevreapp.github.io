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
