/**
 * Utilitário para geração e manipulação do link de indicação de parceiros.
 * Detecta dinamicamente a origem atual (localhost, IP local, ou domínio de produção)
 * para evitar erros de "URL não encontrada" / 404 ao testar localmente ou em produção.
 */

export const getAppBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return import.meta.env?.VITE_APP_BASE_URL || 'https://app.hotelnozap.com.br';
};

/**
 * Retorna o link oficial para login / painel administrativo corporativo.
 * Em localhost retorna /paineladmin ou http://localhost:5173/paineladmin.
 * Em produção retorna https://app.hotelnozap.com.br/
 */
export const getAppLoginUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return '/paineladmin';
    }
  }
  return 'https://app.hotelnozap.com.br/';
};

export const getPartnerReferralLink = (coupon?: string): string => {
  const code = (coupon || 'HOTELNOZAP').trim();
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/assinar?ref=${encodeURIComponent(code)}`;
};

export const copyPartnerReferralLink = async (coupon?: string): Promise<boolean> => {
  const link = getPartnerReferralLink(coupon);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return true;
    }
  } catch {
    // fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = link;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
};

export const openPartnerReferralLink = (coupon?: string): void => {
  const link = getPartnerReferralLink(coupon);
  if (typeof window !== 'undefined') {
    window.open(link, '_blank', 'noopener,noreferrer');
  }
};
