/**
 * trackingService.ts
 * Gerenciamento dinâmico de scripts e tags de rastreamento / marketing:
 * - Meta Pixel (Facebook Pixel)
 * - Google Site Verification (Metatag)
 * - Google Analytics 4 (GA4)
 * - Google reCAPTCHA
 */

export interface TrackingConfig {
  metaPixelId?: string;
  googleMetaTag?: string;
  googleAnalyticsId?: string;
  recaptchaSiteKey?: string;
  recaptchaSecretKey?: string;
}

const STORAGE_KEY_PARAMETROS = 'hotelnozap_parametros_sistema';
const STORAGE_KEY_TRACKING = 'hotelnozap_tracking_credentials';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    grecaptcha?: any;
  }
}

/**
 * Extrai o código de verificação limpo caso o usuário cole a tag inteira <meta ... content="..." />
 */
export function extractGoogleVerificationCode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Se for uma tag HTML completa: <meta name="google-site-verification" content="XYZ" ... />
  const match = trimmed.match(/content=["']([^"']+)["']/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Se for apenas o código alfanumérico
  return trimmed.replace(/[<>"']/g, '').trim();
}

export const trackingService = {
  /**
   * Obtém a configuração atual do localStorage (com fallback em parametros_sistema)
   */
  getConfig(): TrackingConfig {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      // 1. Tenta da chave direta
      const direct = localStorage.getItem(STORAGE_KEY_TRACKING);
      if (direct) {
        return JSON.parse(direct);
      }

      // 2. Tenta da chave geral de parâmetros
      const params = localStorage.getItem(STORAGE_KEY_PARAMETROS);
      if (params) {
        const p = JSON.parse(params);
        return {
          metaPixelId: p.metaPixelId || p.pixelId || '',
          googleMetaTag: p.googleMetaTag || '',
          googleAnalyticsId: p.googleAnalyticsId || '',
          recaptchaSiteKey: p.recaptchaSiteKey || '',
          recaptchaSecretKey: p.recaptchaSecretKey || ''
        };
      }
    } catch (e) {
      console.warn('[trackingService] Erro ao ler credenciais de rastreamento:', e);
    }

    return {};
  },

  /**
   * Salva as credenciais no localStorage e emite evento para atualização dinâmica
   */
  saveConfig(config: TrackingConfig): void {
    if (typeof window === 'undefined') return;

    try {
      const sanitized: TrackingConfig = {
        metaPixelId: (config.metaPixelId || '').trim(),
        googleMetaTag: extractGoogleVerificationCode(config.googleMetaTag || ''),
        googleAnalyticsId: (config.googleAnalyticsId || '').trim(),
        recaptchaSiteKey: (config.recaptchaSiteKey || '').trim(),
        recaptchaSecretKey: (config.recaptchaSecretKey || '').trim()
      };

      // Salva na chave específica
      localStorage.setItem(STORAGE_KEY_TRACKING, JSON.stringify(sanitized));

      // Atualiza também na chave global de parâmetros
      const currentParamsRaw = localStorage.getItem(STORAGE_KEY_PARAMETROS);
      const currentParams = currentParamsRaw ? JSON.parse(currentParamsRaw) : {};
      const updatedParams = {
        ...currentParams,
        metaPixelId: sanitized.metaPixelId,
        pixelId: sanitized.metaPixelId,
        googleMetaTag: sanitized.googleMetaTag,
        googleAnalyticsId: sanitized.googleAnalyticsId,
        recaptchaSiteKey: sanitized.recaptchaSiteKey,
        recaptchaSecretKey: sanitized.recaptchaSecretKey
      };
      localStorage.setItem(STORAGE_KEY_PARAMETROS, JSON.stringify(updatedParams));

      // Aplica imediatamente no DOM
      this.applyTracking(sanitized);

      // Dispara evento para outros componentes
      window.dispatchEvent(new CustomEvent('hotelnozap_tracking_atualizado', { detail: sanitized }));
    } catch (e) {
      console.warn('[trackingService] Erro ao salvar credenciais:', e);
    }
  },

  /**
   * Aplica / Injeta dinamicamente as tags e scripts no documento (<head>)
   */
  applyTracking(config?: TrackingConfig): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const conf = config || this.getConfig();

    // ─────────────────────────────────────────────────────────────
    // 1. GOOGLE SITE VERIFICATION (Metatag)
    // ─────────────────────────────────────────────────────────────
    const verificationCode = extractGoogleVerificationCode(conf.googleMetaTag || '');
    let existingMeta = document.querySelector('meta[name="google-site-verification"]');
    if (verificationCode) {
      if (!existingMeta) {
        existingMeta = document.createElement('meta');
        existingMeta.setAttribute('name', 'google-site-verification');
        document.head.appendChild(existingMeta);
      }
      existingMeta.setAttribute('content', verificationCode);
    } else if (existingMeta) {
      existingMeta.remove();
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GOOGLE ANALYTICS 4 (gtag.js)
    // ─────────────────────────────────────────────────────────────
    const gaId = (conf.googleAnalyticsId || '').trim();
    const gaScriptId = 'hotelnozap-gtag-script';
    let existingGaScript = document.getElementById(gaScriptId);

    if (gaId && gaId.startsWith('G-')) {
      if (!existingGaScript) {
        const script = document.createElement('script');
        script.id = gaScriptId;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(script);

        // Inicializa window.dataLayer e gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(...args: any[]) {
          window.dataLayer?.push(arguments);
        }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', gaId, { send_page_view: true });
      } else {
        // Atualiza gtag config se já existia
        if (typeof window.gtag === 'function') {
          window.gtag('config', gaId);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. META PIXEL (Facebook Pixel)
    // ─────────────────────────────────────────────────────────────
    const pixelId = (conf.metaPixelId || '').trim();
    const pixelScriptId = 'hotelnozap-fb-pixel';
    let existingPixelScript = document.getElementById(pixelScriptId);

    if (pixelId && /^\d+$/.test(pixelId)) {
      if (!existingPixelScript) {
        const script = document.createElement('script');
        script.id = pixelScriptId;
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);
      } else if (typeof window.fbq === 'function') {
        window.fbq('init', pixelId);
        window.fbq('track', 'PageView');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. GOOGLE reCAPTCHA (v3 Invisível)
    // ─────────────────────────────────────────────────────────────
    const siteKey = (conf.recaptchaSiteKey || '').trim() || import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Ldg2eMtAAAAAEN2nszCuOjWQfSDwrXpm66xEGm8';
    const recaptchaScriptId = 'hotelnozap-recaptcha-script';
    let existingRecaptchaScript = document.getElementById(recaptchaScriptId);

    if (siteKey && siteKey.length > 10) {
      if (!existingRecaptchaScript) {
        const script = document.createElement('script');
        script.id = recaptchaScriptId;
        script.async = true;
        script.defer = true;
        script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
        document.head.appendChild(script);
      }
    }
  },

  /**
   * Executa a verificação invisível do Google reCAPTCHA v3 e retorna o token de segurança
   */
  async executeRecaptcha(action: string = 'page_view'): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const conf = this.getConfig();
    const siteKey = (conf.recaptchaSiteKey || '').trim() || import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Ldg2eMtAAAAAEN2nszCuOjWQfSDwrXpm66xEGm8';

    if (!siteKey || typeof window.grecaptcha === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      try {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(siteKey, { action });
            resolve(token);
          } catch (e) {
            console.warn('[reCAPTCHA] Falha ao executar ação:', e);
            resolve(null);
          }
        });
      } catch (err) {
        console.warn('[reCAPTCHA] Erro na chamada grecaptcha.ready:', err);
        resolve(null);
      }
    });
  },

  /**
   * Inicializa o rastreamento no carregamento da aplicação
   */
  initTracking(): () => void {
    if (typeof window === 'undefined') return () => {};

    // Aplica na inicialização
    this.applyTracking();

    // Listener para quando os parâmetros do sistema forem salvos
    const handleParametrosAtualizados = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const detail = customEvent.detail;
        this.applyTracking({
          metaPixelId: detail.metaPixelId || detail.pixelId,
          googleMetaTag: detail.googleMetaTag,
          googleAnalyticsId: detail.googleAnalyticsId,
          recaptchaSiteKey: detail.recaptchaSiteKey,
          recaptchaSecretKey: detail.recaptchaSecretKey
        });
      }
    };

    window.addEventListener('hotelnozap_parametros_atualizados', handleParametrosAtualizados);
    window.addEventListener('hotelnozap_tracking_atualizado', handleParametrosAtualizados);

    return () => {
      window.removeEventListener('hotelnozap_parametros_atualizados', handleParametrosAtualizados);
      window.removeEventListener('hotelnozap_tracking_atualizado', handleParametrosAtualizados);
    };
  }
};
