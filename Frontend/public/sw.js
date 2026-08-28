/**
 * Service worker del Hostal Inteligente.
 *
 * Sin esto Chrome no ofrece "Instalar", que es lo que hace falta para que recepción y
 * limpieza tengan la app en la tablet como una más.
 *
 * Qué NO cachea, a propósito:
 *
 *  - `/api/*`. Son datos operativos y de una sesión concreta: un cuarto "libre"
 *    servido desde caché lleva a dos check-ins en la misma habitación, y una respuesta
 *    guardada quedaría legible para quien use el equipo después. Sin caché, siempre red.
 *  - Los documentos HTML se piden a la red primero. Si no hay red, sale la página de
 *    "sin conexión", que dice la verdad en vez de mostrar datos viejos.
 *
 * Lo único que se guarda es lo inmutable: los archivos con hash de `/_next/static`
 * y los iconos.
 */

const VERSION = 'hostal-v1';
const ESTATICOS = `${VERSION}-estaticos`;
const CASCARA = `${VERSION}-cascara`;

const SIN_CONEXION = '/sin-conexion.html';

const PRECARGA = [SIN_CONEXION, '/icono.svg', '/icono-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CASCARA)
      .then((cache) => cache.addAll(PRECARGA))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;

  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  // Datos operativos y sesión: nunca desde caché.
  if (url.pathname.startsWith('/api/')) return;

  // Estáticos con hash en el nombre: no cambian nunca, se sirven de caché.
  if (url.pathname.startsWith('/_next/static/') || PRECARGA.includes(url.pathname)) {
    evento.respondWith(
      caches.match(peticion).then(
        (guardada) =>
          guardada ??
          fetch(peticion).then((respuesta) => {
            if (respuesta.ok) {
              const copia = respuesta.clone();
              caches.open(ESTATICOS).then((cache) => cache.put(peticion, copia));
            }
            return respuesta;
          })
      )
    );
    return;
  }

  // Páginas: red primero. Sin red, la de "sin conexión".
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion).catch(() => caches.match(SIN_CONEXION).then((r) => r ?? Response.error()))
    );
  }
});
