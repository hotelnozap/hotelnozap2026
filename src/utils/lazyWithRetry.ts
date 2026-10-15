import React from 'react';

/**
 * Força a limpeza de caches do navegador e recarrega a aplicação trazendo a versão
 * mais recente compilada após um novo deploy, evitando telas de erro de chunk desatualizado.
 * @param force - se verdadeiro, ignora o cooldown e força o reload imediato (ex: ao clicar no botão).
 */
export function forceCleanReload(force = false) {
  if (typeof window === 'undefined') return;
  const reloadKey = 'hotelnozap_chunk_reload_ts';
  const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
  const now = Date.now();

  // Limite de segurança de 4 segundos para evitar recarregamentos em loop infinito
  if (force || now - lastReload > 4000) {
    sessionStorage.setItem(reloadKey, String(now));
    try {
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name);
          }
        }).catch(() => {});
      }
    } catch {
      // Ignora erro em ambientes restritos/sandboxed
    }

    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('_v', String(now));
      window.location.replace(currentUrl.toString());
    } catch {
      window.location.reload();
    }
  }
}

/**
 * Utilitário para envolver React.lazy com tratamento automático de falhas de rede
 * e detecção de novos deploys/chunks desatualizados no Vite.
 * Quando o hash de um chunk muda após deploy e o navegador do usuário tenta carregar
 * o hash antigo (404), este utilitário recarrega a página automaticamente para sincronizar
 * com a versão mais recente em produção sem mostrar telas de erro ao usuário.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 800
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then((module) => {
            resolve(module);
          })
          .catch((error) => {
            const msg = (error?.message || '').toLowerCase();
            const isChunkLoadFailed =
              msg.includes('dynamically imported module') ||
              msg.includes('failed to fetch dynamically imported module') ||
              msg.includes('error loading dynamically imported module') ||
              msg.includes('failed to fetch') ||
              error?.name === 'ChunkLoadError';

            if (isChunkLoadFailed && typeof window !== 'undefined') {
              console.warn('[lazyWithRetry] Módulo desatualizado detectado após publicação. Sincronizando versão...');
              const reloadKey = 'hotelnozap_chunk_reload_ts';
              const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
              const now = Date.now();

              // Se ainda não tentou recarregar nos últimos 8s, força reload limpo com novo timestamp
              if (now - lastReload > 8000) {
                forceCleanReload(true);
                return;
              }
            }

            // Para outras falhas transitórias de conexão de rede, tenta novamente
            if (remaining > 0) {
              setTimeout(() => attempt(remaining - 1), interval);
            } else {
              reject(error);
            }
          });
      };
      attempt(retries);
    })
  );
}
