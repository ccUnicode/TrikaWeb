// Service worker vacío: evita 404 si el navegador lo solicita por caché antigua
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
