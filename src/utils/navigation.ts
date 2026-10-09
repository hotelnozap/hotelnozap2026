/**
 * Utilitário de navegação SPA (Single Page Application) fluida para o Hotel no Zap.
 * 
 * Evita o recarregamento total do documento HTML pelo navegador/WebView,
 * impedindo que o aplicativo Android gerado pelo PWABuilder (TWA) dispare a tela
 * nativa de pre-load ("Abrindo...", "Carregando...") e glitches visuais entre páginas.
 */

export const navigateSpa = (to: string): void => {
  if (typeof window === 'undefined') return;

  // Se for link externo completo (outro domínio ou protocolo), usa navegação padrão
  if (
    to.startsWith('http://') ||
    to.startsWith('https://') ||
    to.startsWith('mailto:') ||
    to.startsWith('tel:') ||
    to.startsWith('whatsapp:')
  ) {
    window.location.href = to;
    return;
  }

  // Se for hash pura na mesma página
  if (to.startsWith('#')) {
    window.location.hash = to;
    return;
  }

  const currentPath = window.location.pathname + window.location.search;
  const targetUrl = new URL(to, window.location.origin);
  const targetPath = targetUrl.pathname + targetUrl.search;

  if (currentPath !== targetPath || targetUrl.hash) {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};
