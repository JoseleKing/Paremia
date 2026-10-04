/* Paremia — service worker
   Cambia CACHE_VERSION en cada publicación para que todos reciban la versión nueva
   (ver README). Red primero para el juego (así los refranes nuevos llegan en cuanto
   se publican) y copia guardada si no hay conexión. */

const CACHE_VERSION = 'v9';
const CACHE = `paremia-${CACHE_VERSION}`;

const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './volver-almanaque.js',
  './data/refranes.json',
  './manifest.json',
  './icons/logo-cabecera.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-portada.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

const FUENTES_CSS = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap';
const ORIGENES_FUENTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const ESPERA_RED_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' })));

    // Tipografías de Google Fonts, para que se vea igual sin conexión.
    try {
      const css = await fetch(FUENTES_CSS);
      if (css.ok) {
        const texto = await css.clone().text();
        await cache.put(FUENTES_CSS, css);
        const urls = [...texto.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
        await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
      }
    } catch (e) { /* sin conexión al instalar: se usarán las fuentes del sistema */ }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves
      .filter((k) => k.startsWith('paremia-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const peticion = event.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  const esJuego = url.href.startsWith(self.registration.scope);
  const esFuente = ORIGENES_FUENTES.includes(url.origin);

  if (esFuente) {
    event.respondWith(cachePrimero(event, peticion));
  } else if (esJuego) {
    event.respondWith(redPrimero(peticion));
  }
});

// Red primero y, si no hay red o tarda, la copia guardada.
// ignoreSearch: ?v=1 en los recursos y ?dia=N en la página usan la misma copia.
async function redPrimero(peticion) {
  const cache = await caches.open(CACHE);

  const red = fetch(peticion).then((respuesta) => {
    if (respuesta.ok) cache.put(peticion, respuesta.clone());
    return respuesta;
  });

  const guardada = () => cache.match(peticion, { ignoreSearch: true })
    .then((r) => r || (peticion.mode === 'navigate' ? cache.match('./index.html') : undefined));

  try {
    return await Promise.race([
      red,
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lenta')), ESPERA_RED_MS))
    ]);
  } catch (e) {
    const copia = await guardada();
    if (copia) return copia;
    try {
      return await red;
    } catch (e2) {
      return Response.error();
    }
  }
}

// Caché primero y actualización en segundo plano (tipografías).
async function cachePrimero(event, peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);
  const red = fetch(peticion).then((respuesta) => {
    if (respuesta.ok || respuesta.type === 'opaque') cache.put(peticion, respuesta.clone());
    return respuesta;
  }).catch(() => undefined);

  if (guardada) {
    event.waitUntil(red);
    return guardada;
  }
  return (await red) || Response.error();
}
