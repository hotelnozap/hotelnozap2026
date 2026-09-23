/**
 * Utilitário para geração e manipulação do link de indicação de parceiros.
 * Em produção, o link oficial sempre utiliza o domínio público principal:
 * https://hotelnozap.com.br/assinar?ref=CODIGO (sem o subdomínio app.)
 * Em ambiente local (localhost), mantém a porta/origem atual para testes.
 */

export const getPartnerPublicBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return window.location.origin;
    }
  }
  return 'https://hotelnozap.com.br';
};

export const getAppBaseUrl = (): string => {
  return getPartnerPublicBaseUrl();
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
  const baseUrl = getPartnerPublicBaseUrl();
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
