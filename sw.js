// RunUp Service Worker
// Required for reliable notification delivery on mobile Chrome and other browsers.
// Lives at the same path as index.html (root of your Netlify site).

self.addEventListener('install', (e) => {
  // Activate immediately — no need to wait for old SW
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Take control of all open pages immediately
  e.waitUntil(self.clients.claim());
});

// When user taps a notification, focus the app or open it
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
