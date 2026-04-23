// FUBY Tracker Service Worker — with scheduled local notifications
const CACHE_NAME = 'fuby-tracker-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  // Start scheduling as soon as SW activates
  scheduleMorningNotif();
  scheduleEveningNotif();
});

// ── FETCH (offline support) ───────────────────────────────────
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── NOTIFICATION MESSAGES ─────────────────────────────────────
const MORNING_MSGS = [
  "🌅 Good morning! What goal will you conquer today?",
  "🔥 Rise and grind. Your FUBY goals are waiting.",
  "⭐ New day, new XP. Open FUBY and tick something off.",
  "👑 Champions start their morning with intention. What's yours?",
  "🎯 Morning check-in: pick ONE goal and start ticking.",
];

const EVENING_MSGS = [
  "🌙 Evening check-in: Did you tick at least one task today?",
  "💎 Don't break your streak! Open FUBY before midnight.",
  "🏆 One tick before bed keeps the streak alive. Do it.",
  "⚡ Your future self is counting on today-you. Don't let her down.",
  "🔥 Protect your streak. Open FUBY. Tick. Sleep like a champion.",
];

function randomMsg(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── HOW LONG UNTIL A TARGET HOUR ─────────────────────────────
function msUntil(hour, minute) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute || 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

let morningTimer = null;
let eveningTimer = null;

function scheduleMorningNotif() {
  clearTimeout(morningTimer);
  morningTimer = setTimeout(function() {
    self.registration.showNotification('FUBY Tracker 🌅', {
      body: randomMsg(MORNING_MSGS),
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [200, 100, 200],
      tag: 'fuby-morning',
      renotify: true,
      data: { url: './' }
    });
    scheduleMorningNotif(); // reschedule for next day
  }, msUntil(9, 0));
}

function scheduleEveningNotif() {
  clearTimeout(eveningTimer);
  eveningTimer = setTimeout(function() {
    self.registration.showNotification('FUBY Tracker 🌙', {
      body: randomMsg(EVENING_MSGS),
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [300, 150, 300],
      tag: 'fuby-evening',
      renotify: true,
      data: { url: './' }
    });
    scheduleEveningNotif(); // reschedule for next day
  }, msUntil(19, 0));
}

// ── MESSAGES FROM APP ─────────────────────────────────────────
self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'START_REMINDERS') {
    scheduleMorningNotif();
    scheduleEveningNotif();
    // Immediate confirmation notification
    self.registration.showNotification('FUBY Tracker 🔔', {
      body: "Reminders are ON! You'll hear from us at 9AM and 7PM daily. Keep levelling up!",
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [100, 50, 100],
      tag: 'fuby-setup',
      data: { url: './' }
    });
  }
});

// ── NOTIFICATION CLICK ────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('fuby') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('./');
    })
  );
});
