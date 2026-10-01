import { hotelConfigService, HotelConfigData, hoteisService } from './supabaseService';
import { systemLogsService } from './systemLogsService';
import { creditosService } from './creditosService';

export interface CriarPixMasterParams {
  hotelId: string;
  hotelNome: string;
  planoId?: string;
  planoNome: string;
  valor: number;
  pagadorEmail: string;
  pagadorNome: string;
  pagadorDoc?: string;
}

export interface PixMasterResult {
  success: boolean;
  paymentId: string;
  status: 'pending' | 'approved' | 'in_process' | 'rejected';
  qrCode: string;
  qrCodeBase64?: string;
  fallbackQrUrl?: string;
  ticketUrl?: string;
  gateway: 'mercadopago' | 'pix_chave';
  error?: string;
}

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
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. GERADOR EMV BR CODE PIX (PADRÃO BANCO CENTRAL)
  // ─────────────────────────────────────────────────────────────────────────
  gerarPayloadPixEstatico(params: {
    chavePix: string;
    beneficiarioNome: string;
    cidade: string;
    valor: number;
    identificador: string;
    descricao?: string;
  }): string {
    const formatField = (id: string, val: string) => {
      const len = String(val.length).padStart(2, '0');
      return `${id}${len}${val}`;
    };

    const chave = params.chavePix.trim();
    const nome = params.beneficiarioNome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .substring(0, 25)
      .trim() || 'HOTEL NO ZAP';
    const cidade = params.cidade
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .substring(0, 15)
      .trim() || 'BRASILIA';
    const txid = (params.identificador || 'HOTELNOZAP')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 25) || 'HOTELNOZAP';
    const valorStr = params.valor.toFixed(2);

    let mai = formatField('00', 'br.gov.bcb.pix') + formatField('01', chave);
    if (params.descricao) {
      const desc = params.descricao
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .substring(0, 35);
      mai += formatField('02', desc);
    }

    const additional = formatField('05', txid);

    const payloadSemCrc =
      formatField('00', '01') +
      formatField('26', mai) +
      formatField('52', '0000') +
      formatField('53', '986') +
      formatField('54', valorStr) +
      formatField('58', 'BR') +
      formatField('59', nome) +
      formatField('60', cidade) +
      formatField('62', additional) +
      '6304';

    let crc = 0xFFFF;
    for (let i = 0; i < payloadSemCrc.length; i++) {
      crc ^= payloadSemCrc.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return `${payloadSemCrc}${crcHex}`;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CRIAÇÃO DE PAGAMENTO PIX MASTER (MERCADO PAGO + FALLBACK)
  // ─────────────────────────────────────────────────────────────────────────
  async criarPagamentoPixMaster(params: CriarPixMasterParams): Promise<PixMasterResult> {
    const { hotelId, hotelNome, planoNome, valor, pagadorEmail, pagadorNome, pagadorDoc } = params;
    const masterCreds = this.getMasterCredentials();
    const token = masterCreds.accessToken?.trim();

    // 1. Se houver token do Mercado Pago, tenta gerar via API oficial
    if (token && token.length > 15) {
      try {
        const cleanDoc = (pagadorDoc || '').replace(/\D/g, '') || '00000000000';
        const docType = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';
        const nameParts = (pagadorNome || hotelNome).trim().split(' ');
        const firstName = nameParts[0] || 'Cliente';
        const lastName = nameParts.slice(1).join(' ') || 'Hotel';

        const idempotencyKey = `mp_pix_${hotelId}_${Date.now()}`;
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            transaction_amount: Number(valor.toFixed(2)),
            description: `Assinatura ${planoNome} - ${hotelNome}`,
            payment_method_id: 'pix',
            payer: {
              email: pagadorEmail || 'contato@hotelnozap.com.br',
              first_name: firstName,
              last_name: lastName,
              identification: {
                type: docType,
                number: cleanDoc
              }
            },
            external_reference: `hotel_${hotelId}`
          })
        });

        if (response.ok) {
          const data = await response.json();
          const qrCode = data.point_of_interaction?.transaction_data?.qr_code || '';
          const qrCodeBase64 = data.point_of_interaction?.transaction_data?.qr_code_base64 || '';
          const ticketUrl = data.point_of_interaction?.transaction_data?.ticket_url;

          return {
            success: true,
            paymentId: String(data.id),
            status: data.status || 'pending',
            qrCode: qrCode,
            qrCodeBase64: qrCodeBase64 ? `data:image/png;base64,${qrCodeBase64}` : undefined,
            fallbackQrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrCode)}`,
            ticketUrl,
            gateway: 'mercadopago'
          };
        } else {
          console.warn('Mercado Pago API retornou status não-200. Utilizando gerador Pix padrão.');
        }
      } catch (err) {
        console.warn('Erro ao conectar na API do Mercado Pago. Acionando fallback PIX:', err);
      }
    }

    // 2. Fallback: Gera Pix Copia e Cola Oficial com Chave Pix Master
    let chavePix = 'financeiro@hotelnozap.com.br';
    try {
      const paramsStorage = localStorage.getItem(STORAGE_KEY_PARAMETROS);
      if (paramsStorage) {
        const parsed = JSON.parse(paramsStorage);
        if (parsed.gatewayPixKey) chavePix = parsed.gatewayPixKey.trim();
        else if (parsed.chave_pix_master) chavePix = parsed.chave_pix_master.trim();
      }
    } catch { /* ignore */ }

    const txid = `HNZ${hotelId.replace(/\D/g, '').substring(0, 10)}${Date.now().toString().slice(-6)}`;
    const pixCopiaECola = this.gerarPayloadPixEstatico({
      chavePix,
      beneficiarioNome: 'HOTEL NO ZAP SAAS',
      cidade: 'BRASILIA',
      valor,
      identificador: txid,
      descricao: `Plano ${planoNome.substring(0, 20)}`
    });

    return {
      success: true,
      paymentId: `pix_hnz_${Date.now()}`,
      status: 'pending',
      qrCode: pixCopiaECola,
      fallbackQrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(pixCopiaECola)}`,
      gateway: 'pix_chave'
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. CONSULTA DE STATUS DE PAGAMENTO
  // ─────────────────────────────────────────────────────────────────────────
  async consultarPagamentoMaster(paymentId: string): Promise<{ approved: boolean; status: string }> {
    if (!paymentId) return { approved: false, status: 'unknown' };

    // Se for mock/chave local com flag de aprovação manual simulada
    if (paymentId.startsWith('pix_hnz_')) {
      const isApprovedLocal = localStorage.getItem(`hotelnozap_pay_approved_${paymentId}`) === 'true';
      return {
        approved: isApprovedLocal,
        status: isApprovedLocal ? 'approved' : 'pending'
      };
    }

    const masterCreds = this.getMasterCredentials();
    const token = masterCreds.accessToken?.trim();
    if (!token) return { approved: false, status: 'pending' };

    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const isApproved = data.status === 'approved';
        return {
          approved: isApproved,
          status: data.status || 'pending'
        };
      }
    } catch (e) {
      console.warn('Erro ao consultar status no Mercado Pago:', e);
    }

    return { approved: false, status: 'pending' };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. ATIVAÇÃO AUTOMÁTICA DA CONTA DO HOTEL APÓS PAGAMENTO
  // ─────────────────────────────────────────────────────────────────────────
  async ativarHotelAposPagamento(params: {
    hotelId: string;
    hotelNome?: string;
    plano: any;
    paymentId?: string;
    metodo: string;
    valor: number;
  }): Promise<boolean> {
    const { hotelId, hotelNome, plano, paymentId = 'manual', metodo, valor } = params;
    if (!hotelId) return false;

    try {
      // 1. Atualizar hotel para 'ativo' no Supabase
      const updateOk = await hoteisService.updateHotel(hotelId, {
        status: 'ativo',
        plan: plano?.name || 'Plano Oficial',
        notes: `Conta ativada automaticamente com pagamento aprovado via ${metodo} (Ref: ${paymentId}) em ${new Date().toLocaleString('pt-BR')}. Valor: R$ ${valor.toFixed(2)}.`
      } as any);

      // 2. Calcular validade e registrar créditos SaaS
      const cicloDays = Number(plano?.cicloDays || 30);
      const bonusDays = Number(plano?.bonusDays || 15);
      const totalDias = cicloDays + bonusDays;
      const creditos = Number(plano?.creditos || 1);

      const now = new Date();
      const expDate = new Date(now.getTime() + totalDias * 24 * 60 * 60 * 1000);
      const todayStr = now.toISOString().split('T')[0];

      creditosService.saveCreditoHotel(hotelId, creditos, expDate.toISOString(), false, todayStr);

      // 3. Registrar auditoria no Log do Sistema
      await systemLogsService.addLog({
        level: 'success',
        module: 'financeiro',
        action: `Assinatura de Plano Ativada (${plano?.name || 'SaaS'})`,
        details: `Hotel "${hotelNome || hotelId}" liberado para uso. Pagamento via ${metodo}. Validade: +${totalDias} dias (${expDate.toLocaleDateString('pt-BR')}).`,
        hotelId,
        hotelName: hotelNome,
        metadata: {
          paymentId,
          metodo,
          valor,
          plano: plano?.name,
          diasLiberados: totalDias
        }
      });

      return updateOk;
    } catch (err) {
      console.error('Erro na liberação automática da conta do hotel:', err);
      return false;
    }
  }
};
