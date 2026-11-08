export interface PushStats {
  total: number;
  app: number;
  web: number;
}

const DEFAULT_VAPID_PUBLIC_KEY = 'BNssYPXA_K4D951xVf3i7Uc__CzL_roft6oTXiJ27t3JvNbT_ftbGaqPvVaBc6CHpUZP1nfA8xqUZqosT_hlxzA';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const isAppInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandalone = Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const isIOSStandalone = Boolean((window.navigator as any).standalone);
  const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');
  return isStandalone || isIOSStandalone || isAndroidApp;
};

export const isPushSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

class NativePushService {
  private vapidPublicKeyCache: string | null = null;

  async getVapidPublicKey(): Promise<string> {
    if (this.vapidPublicKeyCache) return this.vapidPublicKeyCache;
    try {
      const res = await fetch('/api/send-push?action=vapid-public-key');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey) {
          this.vapidPublicKeyCache = data.publicKey;
          return data.publicKey;
        }
      }
    } catch (e) {
      console.warn('[NativePush] Usando chave VAPID padrão:', e);
    }
    this.vapidPublicKeyCache = DEFAULT_VAPID_PUBLIC_KEY;
    return DEFAULT_VAPID_PUBLIC_KEY;
  }

  async getPermissionState(): Promise<NotificationPermission> {
    if (!isPushSupported()) return 'denied';
    return Notification.permission;
  }

  async isSubscribed(): Promise<boolean> {
    if (!isPushSupported()) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return Boolean(sub);
    } catch {
      return false;
    }
  }

  async subscribeUser(hotelId?: string): Promise<{ success: boolean; error?: string }> {
    if (!isPushSupported()) {
      return { success: false, error: 'Notificações push não são suportadas neste navegador/dispositivo.' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Permissão de notificação não foi autorizada pelo usuário.' };
      }

      const vapidKey = await this.getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any
        });
      }

      const tipoDispositivo = isAppInstalled() ? 'app' : 'web';

      // Envia os dados para a API serverless gravar no Supabase
      const response = await fetch('/api/send-push?action=subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          tipoDispositivo,
          hotelId: hotelId || null,
          userAgent: navigator.userAgent
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Falha ao registrar inscrição no servidor.' };
      }

      localStorage.setItem('hotelnozap_native_push_subscribed', 'true');
      return { success: true };
    } catch (err: any) {
      console.error('[NativePush] Erro ao se inscrever:', err);
      return { success: false, error: err.message || 'Erro inesperado ao ativar notificações.' };
    }
  }

  async unsubscribeUser(): Promise<{ success: boolean; error?: string }> {
    if (!isPushSupported()) return { success: false };
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/send-push?action=subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        }).catch(() => {});
      }
      localStorage.removeItem('hotelnozap_native_push_subscribed');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async fetchStats(hotelId?: string): Promise<PushStats> {
    try {
      const url = hotelId 
        ? `/api/send-push?action=stats&hotelId=${encodeURIComponent(hotelId)}` 
        : '/api/send-push?action=stats';
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[NativePush] Erro ao obter estatísticas:', e);
    }
    return { total: 0, app: 0, web: 0 };
  }
}

export const nativePushService = new NativePushService();
