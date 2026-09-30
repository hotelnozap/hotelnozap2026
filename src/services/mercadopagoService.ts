import { hotelConfigService, HotelConfigData } from './supabaseService';
import { systemLogsService } from './systemLogsService';

export interface MercadoPagoCredentials {
  environment: 'production' | 'sandbox';
  publicKey: string;
  accessToken: string;
  clientId?: string;
  clientSecret?: string;
  enablePix: boolean;
  enableCreditCard: boolean;
  enableBoleto: boolean;
  maxInstallments: string;
  updatedAt?: string;
}

export const STORAGE_KEY_MASTER_MP = 'hotelnozap_config_mercadopago_master';
export const STORAGE_KEY_PARAMETROS = 'hotelnozap_parametros_sistema';

export const DEFAULT_MP_CREDENTIALS: MercadoPagoCredentials = {
  environment: 'production',
  publicKey: '',
  accessToken: '',
  clientId: '',
  clientSecret: '',
  enablePix: true,
  enableCreditCard: true,
  enableBoleto: false,
  maxInstallments: '12'
};

export const mercadopagoService = {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. REGRA: VERIFICA SE O PLANO É GRATUITO (ISENTO DE COBRANÇA)
  // ─────────────────────────────────────────────────────────────────────────
  isPlanoGratis(plano?: { name?: string; basePrice?: number | string; id?: string } | null): boolean {
    if (!plano) return false;
    const nameLower = (plano.name || '').toLowerCase().trim();
    const idLower = (plano.id || '').toLowerCase().trim();
    const priceNum = Number(plano.basePrice) || 0;

    // Se o preço for zero
    if (priceNum === 0) return true;

    // Se o nome contiver termos de isenção ou gratuidade
    if (
      nameLower.includes('grátis') ||
      nameLower.includes('gratis') ||
      nameLower.includes('free') ||
      nameLower.includes('google maps') ||
      nameLower.includes('degustação') ||
      nameLower.includes('degustacao') ||
      idLower.includes('gratis') ||
      idLower.includes('maps')
    ) {
      return true;
    }

    return false;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CREDENCIAIS MASTER (EXCLUSIVAS DO ADMINISTRADOR PARA PLANOS & CRÉDITOS)
  // ─────────────────────────────────────────────────────────────────────────
  getMasterCredentials(): MercadoPagoCredentials {
    if (typeof window === 'undefined') return DEFAULT_MP_CREDENTIALS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MASTER_MP);
      if (stored) {
        return { ...DEFAULT_MP_CREDENTIALS, ...JSON.parse(stored) };
      }

      // Fallback em parametros_sistema
      const storedParams = localStorage.getItem(STORAGE_KEY_PARAMETROS);
      if (storedParams) {
        const parsedP = JSON.parse(storedParams);
        return {
          ...DEFAULT_MP_CREDENTIALS,
          environment: parsedP.gatewayEnvironment || 'production',
          accessToken: parsedP.gatewayToken || '',
          publicKey: parsedP.gatewayPublicKey || '',
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar credenciais Master do Mercado Pago:', e);
    }
    return DEFAULT_MP_CREDENTIALS;
  },

  async saveMasterCredentials(credentials: MercadoPagoCredentials): Promise<boolean> {
    try {
      const payload: MercadoPagoCredentials = {
        ...credentials,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY_MASTER_MP, JSON.stringify(payload));

      // Sincroniza com hotelnozap_parametros_sistema
      try {
        const storedParams = localStorage.getItem(STORAGE_KEY_PARAMETROS);
        const parsedP = storedParams ? JSON.parse(storedParams) : {};
        parsedP.gatewayEnvironment = payload.environment;
        parsedP.gatewayToken = payload.accessToken;
        parsedP.gatewayProvider = 'mercadopago';
        localStorage.setItem(STORAGE_KEY_PARAMETROS, JSON.stringify(parsedP));
      } catch { /* ignore */ }

      // Registra evento de auditoria
      await systemLogsService.addLog({
        level: 'success',
        module: 'financeiro',
        action: 'Credenciais Master SaaS Mercado Pago Salvas',
        details: `Ambiente: ${payload.environment === 'production' ? 'Produção' : 'Sandbox'}. Chaves configuradas para cobrança exclusiva de planos SaaS.`,
        metadata: {
          scope: 'admin_master_saas',
          environment: payload.environment,
          enablePix: payload.enablePix,
          enableCreditCard: payload.enableCreditCard,
          enableBoleto: payload.enableBoleto
        }
      });

      return true;
    } catch (err) {
      console.error('Erro ao salvar credenciais Master do Mercado Pago:', err);
      return false;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CREDENCIAIS PRÓPRIAS DE CADA HOTEL (RECEBIMENTO DIRETO DE RESERVAS)
  // ─────────────────────────────────────────────────────────────────────────
  getHotelCredentials(hotelId: string): MercadoPagoCredentials {
    if (!hotelId || typeof window === 'undefined') return DEFAULT_MP_CREDENTIALS;
    try {
      const stored = localStorage.getItem(`hotelnozap_config_hotel_${hotelId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          environment: parsed.mpEnvironment || 'production',
          publicKey: parsed.mpPublicKey || '',
          accessToken: parsed.mpAccessToken || '',
          clientId: parsed.mpClientId || '',
          clientSecret: parsed.mpClientSecret || '',
          enablePix: parsed.mpEnablePix !== false,
          enableCreditCard: parsed.mpEnableCreditCard !== false,
          enableBoleto: parsed.mpEnableBoleto === true,
          maxInstallments: parsed.mpMaxInstallments || '12',
          updatedAt: parsed.atualizadoEm || parsed.updatedAt
        };
      }
    } catch (e) {
      console.warn(`Erro ao carregar credenciais do hotel ${hotelId}:`, e);
    }
    return DEFAULT_MP_CREDENTIALS;
  },

  async saveHotelCredentials(hotelId: string, credentials: MercadoPagoCredentials, hotelNome?: string): Promise<boolean> {
    if (!hotelId) return false;
    try {
      const currentStored = localStorage.getItem(`hotelnozap_config_hotel_${hotelId}`);
      const baseObj = currentStored ? JSON.parse(currentStored) : {};

      const updatedObj = {
        ...baseObj,
        hotelId,
        mpEnvironment: credentials.environment,
        mpPublicKey: credentials.publicKey,
        mpAccessToken: credentials.accessToken,
        mpClientId: credentials.clientId || '',
        mpClientSecret: credentials.clientSecret || '',
        mpEnablePix: credentials.enablePix,
        mpEnableCreditCard: credentials.enableCreditCard,
        mpEnableBoleto: credentials.enableBoleto,
        mpMaxInstallments: credentials.maxInstallments,
        atualizadoEm: new Date().toISOString()
      };

      localStorage.setItem(`hotelnozap_config_hotel_${hotelId}`, JSON.stringify(updatedObj));

      // Sincroniza com Supabase via hotelConfigService
      try {
        const existingConfig = await hotelConfigService.getConfig(hotelId);
        const mergedConfig = {
          ...(existingConfig || {}),
          mpEnvironment: credentials.environment,
          mpPublicKey: credentials.publicKey,
          mpAccessToken: credentials.accessToken,
          mpClientId: credentials.clientId || '',
          mpClientSecret: credentials.clientSecret || '',
          mpEnablePix: credentials.enablePix,
          mpEnableCreditCard: credentials.enableCreditCard,
          mpEnableBoleto: credentials.enableBoleto,
          mpMaxInstallments: credentials.maxInstallments,
        } as HotelConfigData;
        await hotelConfigService.saveConfig(mergedConfig, hotelId);
      } catch (e) {
        console.warn('Aviso sincronização Supabase hotel config:', e);
      }

      // Registra evento de auditoria no log
      await systemLogsService.addLog({
        level: 'success',
        module: 'financeiro',
        action: `Credenciais do Hotel Atualizadas (${hotelNome || hotelId})`,
        details: `Hotel configurou chaves próprias de Mercado Pago para recebimento direto de reservas.`,
        hotelId,
        hotelName: hotelNome,
        metadata: {
          scope: 'hotel_proprio',
          hotelId,
          environment: credentials.environment,
          enablePix: credentials.enablePix,
          enableCreditCard: credentials.enableCreditCard
        }
      });

      return true;
    } catch (err) {
      console.error(`Erro ao salvar credenciais do hotel ${hotelId}:`, err);
      return false;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PROCESSADOR DE PAGAMENTO DE PLANO SAAS
  // ─────────────────────────────────────────────────────────────────────────
  processarCobrancaPlano(plano: { name?: string; basePrice?: number; id?: string }) {
    if (this.isPlanoGratis(plano)) {
      return {
        deveCobrar: false,
        motivo: 'Plano Gratuito / Isento de Cobrança',
        gateway: 'nenhum'
      };
    }

    const masterCreds = this.getMasterCredentials();
    const hasKeys = Boolean(masterCreds.accessToken && masterCreds.accessToken.trim().length > 10);

    return {
      deveCobrar: true,
      motivo: 'Plano Comercial SaaS (Cobrança Master)',
      gateway: 'mercadopago_master',
      credenciaisMasterConfiguradas: hasKeys,
      publicKeyMaster: masterCreds.publicKey,
      ambiente: masterCreds.environment
    };
  }
};
