// Service Worker para Hotel no Zap PWA (PWABuilder Certified)
const CACHE_NAME = 'hotelnozap-pwa-v2';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Caching robusto: tenta adicionar todos individualmente para garantir sucesso
      await Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[SW] Falha ao pré-cachear asset:', asset, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de versões anteriores de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia de Fetch inteligente:
// 1. APIs e rotas dinâmicas do Supabase / Evolution API: sempre Network-Only
// 2. Navegação de páginas (HTML): Network-First com fallback de Cache e tela Offline
// 3. Arquivos estáticos (CSS, JS, Imagens, Fontes): Cache-First / Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Apenas processa requisições GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Não intercepta chamadas de API de backend nem autenticação
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('painelevolution') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return;
  }

  // Requisição de navegação principal (HTML)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) return cachedResponse;

          const offlineFallback = await cache.match(OFFLINE_URL);
          if (offlineFallback) return offlineFallback;

          return cache.match('/index.html');
        })
    );
    return;
  }

  // Arquivos estáticos e recursos locais
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualiza o cache silenciosamente em background
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
  }
});
