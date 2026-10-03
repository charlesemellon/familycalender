const CACHE = 'family-calendar-pwa-v2';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(clients => {
    for (const client of clients) if ('focus' in client) return client.focus();
    if (self.clients.openWindow) return self.clients.openWindow('./');
  }));
});
// Backend push notifications can later call self.registration.showNotification(...)
// from a 'push' event. No server credentials are stored in this file.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {body: event.data?.text() || ''}; }
  const title = data.title || 'Family Calendar';
  const options = { body: data.body || 'You have a family calendar reminder.', icon:'./icons/icon-192.png', badge:'./icons/icon-192.png', data:{url:data.url || './'} };
  event.waitUntil(self.registration.showNotification(title, options));
});
