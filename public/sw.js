// Service Worker para Hotel no Zap PWA (PWABuilder Certified)
const CACHE_NAME = 'hotelnozap-pwa-v13';
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
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
});

// Ativação e limpeza de versões anteriores de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim()).then(() => {
      // Notifica abas e janelas abertas para atualizar e rodar o bundle limpo
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'FORCE_RELOAD' });
        }
      });
    })
  );
});

// Estratégia de Fetch inteligente:
// 1. APIs e rotas dinâmicas do Supabase / Evolution API: sempre Network-Only
// 2. Navegação de páginas (HTML): Network-First com fallback prioritário para index.html (SPA)
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
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/')
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
            return response;
          }
          // Se a rota de navegação falhar no servidor, tenta carregar o index.html da SPA
          if (response && (response.status === 404 || response.status >= 500)) {
            return caches.match('/index.html').then((cachedIndex) => cachedIndex || response);
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          // 1. Em SPA, SEMPRE prioriza o index.html da aplicação para carregar rotas React (ex: /lp)
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;

          const cachedRoot = await cache.match('/');
          if (cachedRoot) return cachedRoot;

          const cachedResponse = await cache.match(request);
          if (cachedResponse) return cachedResponse;

          // 2. Se nem o index.html estiver em cache, exibe tela de offline
          const offlineFallback = await cache.match(OFFLINE_URL);
          if (offlineFallback) return offlineFallback;

          return new Response('Sem conexão com a internet', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
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

// ==========================================
// 4. Background Sync (Sincronização em 2º Plano)
// ==========================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Evento sync recebido:', event.tag);
  event.waitUntil(
    (async () => {
      try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach((client) => {
          client.postMessage({
            type: 'BACKGROUND_SYNC',
            tag: event.tag,
            timestamp: Date.now()
          });
        });
      } catch (err) {
        console.warn('[SW] Erro durante Background Sync:', err);
      }
    })()
  );
});

// ==========================================
// 5. Periodic Sync (Sincronização Periódica)
// ==========================================
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Evento periodicsync recebido:', event.tag);
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch('/?ref=periodic-sync', { cache: 'no-cache' });
        if (response && response.status === 200) {
          await cache.put('/', response);
        }
      } catch (err) {
        console.warn('[SW] Falha na sincronização periódica de dados:', err);
      }
    })()
  );
});

// ==========================================
// 6. Push Notifications (OneSignal & Web Push)
// ==========================================
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.warn('[SW] OneSignal worker import ignorado no contexto local:', e);
}

self.addEventListener('push', (event) => {
  console.log('[SW] Notificação Push recebida:', event);
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Hotel no Zap';
      const options = {
        body: data.body || data.message || 'Nova notificação de reserva!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: data.url || '/'
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (err) {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification('Hotel no Zap', {
          body: text,
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && typeof event.notification.data === 'string')
    ? event.notification.data
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});


