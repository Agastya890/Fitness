// RunUp Service Worker — background notifications
//
// Strategy: Periodic Background Sync (when supported) wakes the SW every
// minimum interval set by the browser (usually 12h+ on Chrome) — that's
// not 5 min but it's the closest the web platform allows.
//
// As a backup, when the SW activates we set a setInterval(). This works
// while the SW is alive (which Chrome keeps for a few minutes after the
// app loses focus). Once Chrome puts the device to sleep, only Periodic
// Sync will fire it back up.
//
// REALITY CHECK: True 5-min background reminders are NOT possible from
// a web app on locked-screen Android. The web platform doesn't allow it
// for battery reasons. For real 5-min reminders you'd need a native app.

const APP_NAME = 'RunUp';
let intervalHandle = null;

// ── Lifecycle ─────────────────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    // Try to register periodic sync — only works if user has installed app
    // and granted "background sync" permission (Chrome desktop / Android)
    try {
      if ('periodicSync' in self.registration) {
        const status = await self.registration.periodicSync.getTags();
        if (!status.includes('runup-periodic')) {
          await self.registration.periodicSync.register('runup-periodic', {
            minInterval: 60 * 1000, // Ask for 1 min — browser will give us 12h+
          });
        }
      }
    } catch (e) {
      console.warn('Periodic sync not available:', e.message);
    }
    // Start fallback interval that runs while SW is alive
    startFallbackTimer();
  })());
});

// ── The actual notification logic ─────────────────────
function isWithinActiveHours() {
  const h = new Date().getHours();
  return h >= 6 && h < 23; // 6 AM to 11 PM
}

async function fireReminderIfDue() {
  if (!isWithinActiveHours()) return;

  // Read last-fire timestamp from cache (SW has no localStorage)
  const cache = await caches.open('runup-state');
  const lastRes = await cache.match('last-reminder');
  const last = lastRes ? parseInt(await lastRes.text()) : 0;
  const now = Date.now();
  const fiveMin = 5 * 60 * 1000;

  if (now - last < fiveMin) return; // not yet time

  // Save new timestamp
  await cache.put('last-reminder', new Response(String(now)));

  // Pull saved step data from cache (the app stores it there on each sync)
  const stepsRes = await cache.match('today-steps');
  const stepsTxt = stepsRes ? await stepsRes.text() : '0';
  const steps = parseInt(stepsTxt) || 0;

  // Estimate step goal — default to 4000 (week 1-2)
  const goalRes = await cache.match('step-goal');
  const goalTxt = goalRes ? await goalRes.text() : '4000';
  const goal = parseInt(goalTxt) || 4000;

  const remaining = Math.max(0, goal - steps);
  let title, body;
  if (steps >= goal) {
    title = '🏆 Goal hit today!';
    body = steps.toLocaleString() + ' steps — keep moving for bonus XP!';
  } else if (steps === 0) {
    title = '👟 Time to walk!';
    body = 'No steps yet today. Step outside for 15 min to start earning XP.';
  } else {
    title = '🚶 ' + remaining.toLocaleString() + ' steps to go';
    body = 'You are at ' + steps.toLocaleString() + ' steps. Keep going!';
  }

  await self.registration.showNotification(title, {
    body,
    tag: 'runup-reminder',
    renotify: true,
    requireInteraction: false,
  });
}

// ── Periodic sync handler (best path on supported browsers) ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'runup-periodic') {
    event.waitUntil(fireReminderIfDue());
  }
});

// ── Fallback timer — runs while SW is alive ──
function startFallbackTimer() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(fireReminderIfDue, 60 * 1000); // check every 1 min
  // Fire once immediately too
  fireReminderIfDue();
}

// ── Click handler ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) if ('focus' in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

// ── Receive step data updates from the app ────────────
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'UPDATE_STATE') {
    const cache = await caches.open('runup-state');
    await cache.put('today-steps', new Response(String(event.data.steps || 0)));
    await cache.put('step-goal', new Response(String(event.data.goal || 4000)));
  }
});
