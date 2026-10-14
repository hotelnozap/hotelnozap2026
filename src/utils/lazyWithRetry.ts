import React from 'react';

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
              msg.includes('failed to fetch') ||
              error?.name === 'ChunkLoadError';

            if (isChunkLoadFailed && typeof window !== 'undefined') {
              const reloadKey = 'hotelnozap_chunk_reload_ts';
              const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
              const now = Date.now();
              if (now - lastReload > 8000) {
                sessionStorage.setItem(reloadKey, String(now));
                window.location.reload();
                return;
              }
            }

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
