/* يخزّن ملفات الواجهة فقط ليعمل البرنامج بدون إنترنت. لا يمرّ عبره أي بيانات قضايا (تُحفظ في IndexedDB). */
const CACHE = 'tahqiq-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/lib/qrcode.js', 'js/lib/jsQR.js', 'js/util.js', 'js/store.js', 'js/doc.js',
  'js/templates.js', 'js/share.js', 'js/case.js', 'js/auth.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// من الذاكرة أولاً للسرعة والعمل بدون إنترنت، مع تحديث النسخة المخزّنة في الخلفية عند توفر الاتصال
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
