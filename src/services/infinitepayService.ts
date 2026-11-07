/**
 * src/services/infinitepayService.ts
 * Serviço de integração com InfinitePay para pagamentos via Pix e Checkout Integrado.
 * Blindado contra exposição de chaves no frontend.
 */

import { hotelConfigService, HotelConfigData } from './supabaseService';
import { systemLogsService } from './systemLogsService';
import { getApiBaseUrl } from './mercadopagoService';

export interface InfinitePayCredentials {
  enabled: boolean;
  apiKey: string;
  handle: string; // e.g. "everaldo-souza-6yb"
  environment: 'production' | 'sandbox';
  enablePix: boolean;
  enableCreditCard: boolean;
  maxInstallments: string;
  updatedAt?: string;
}

export const DEFAULT_INFINITEPAY_CREDENTIALS: InfinitePayCredentials = {
  enabled: true,
  apiKey: '', // Mascarada ou mantida segura no backend
  handle: 'everaldo-souza-6yb',
  environment: 'production',
  enablePix: true,
  enableCreditCard: true,
  maxInstallments: '12'
};

export interface CriarLinkInfinitePayParams {
  order_nsu: string;
  amount: number; // Em reais (ex: 150.00)
  items?: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  redirect_url?: string;
  hotelId?: string;
}

export interface LinkInfinitePayResult {
  success: boolean;
  url?: string;
  order_nsu?: string;
  error?: string;
}

export const infinitepayService = {
  getHotelCredentials(hotelId: string): InfinitePayCredentials {
    if (!hotelId) return DEFAULT_INFINITEPAY_CREDENTIALS;
    try {
      const stored = localStorage.getItem(`hotelnozap_config_infinitepay_${hotelId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          enabled: parsed.enabled !== false,
          apiKey: parsed.apiKey || '',
          handle: parsed.handle || 'everaldo-souza-6yb',
          environment: parsed.environment || 'production',
          enablePix: parsed.enablePix !== false,
          enableCreditCard: parsed.enableCreditCard !== false,
          maxInstallments: parsed.maxInstallments || '12',
          updatedAt: parsed.updatedAt
        };
      }
    } catch (e) {
      console.warn(`Erro ao carregar credenciais InfinitePay do hotel ${hotelId}:`, e);
    }
    return DEFAULT_INFINITEPAY_CREDENTIALS;
  },

  async saveHotelCredentials(hotelId: string, credentials: InfinitePayCredentials, hotelNome?: string): Promise<boolean> {
    if (!hotelId) return false;
    try {
      const payloadToStore = {
        ...credentials,
        hotelId,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(`hotelnozap_config_infinitepay_${hotelId}`, JSON.stringify(payloadToStore));

      // Sincroniza com Supabase via hotelConfigService
      try {
        const existingConfig = await hotelConfigService.getConfig(hotelId);
        const mergedConfig = {
          ...(existingConfig || {}),
          infinitepayEnabled: credentials.enabled,
          infinitepayHandle: credentials.handle,
          infinitepayEnablePix: credentials.enablePix,
          infinitepayEnableCreditCard: credentials.enableCreditCard
        } as HotelConfigData;
        await hotelConfigService.saveConfig(mergedConfig, hotelId);
      } catch (e) {
        console.warn('Aviso sincronização Supabase hotel config (InfinitePay):', e);
      }

      // Se houver nova chave informada, salva no backend de forma segura
      if (credentials.apiKey && credentials.apiKey.startsWith('inchk_') && !credentials.apiKey.includes('••••')) {
        try {
          await fetch(`${getApiBaseUrl()}/api/infinitepay-pix?action=save_config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              newApiKey: credentials.apiKey,
              handle: credentials.handle
            })
          });
        } catch (e) {
          console.warn('Aviso ao sincronizar chave com backend:', e);
        }
      }

      // Log de auditoria
      await systemLogsService.addLog({
        level: 'success',
        module: 'financeiro',
        action: `Configurações InfinitePay Atualizadas (${hotelNome || hotelId})`,
        details: 'Configurações de recebimento via Pix InfinitePay (Taxa Zero) salvas.',
        hotelId,
        hotelName: hotelNome,
        metadata: {
          gateway: 'infinitepay',
          handle: credentials.handle,
          enablePix: credentials.enablePix
        }
      });

      return true;
    } catch (e) {
      console.error('Erro ao salvar credenciais InfinitePay:', e);
      return false;
    }
  },

  async testConnection(customApiKey?: string): Promise<{ success: boolean; message: string; sampleUrl?: string; detectedHandle?: string }> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/infinitepay-pix?action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customApiKey ? { apiKey: customApiKey } : {})
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message || 'Conexão com InfinitePay validada com sucesso!',
          sampleUrl: data.sampleUrl,
          detectedHandle: data.detectedHandle
        };
      }
      return {
        success: false,
        message: data.error || 'Falha ao validar chave com a InfinitePay.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Erro ao conectar à API da InfinitePay: ' + (err?.message || String(err))
      };
    }
  },

  async criarLinkPagamento(params: CriarLinkInfinitePayParams): Promise<LinkInfinitePayResult> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/infinitepay-pix?action=create_link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        return {
          success: true,
          url: data.url,
          order_nsu: data.order_nsu
        };
      }
      return {
        success: false,
        error: data.error || 'Não foi possível gerar o link de pagamento.'
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'Erro de comunicação ao criar link: ' + (err?.message || String(err))
      };
    }
  }
};
