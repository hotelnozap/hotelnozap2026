/**
 * superAgenteVendedorService.ts
 * Motor Comercial e Fluxo do "Super Agente Vendedor" do Hotel no Zap
 * Atende leads de hotéis no WhatsApp, responde com IA/regras humanizadas,
 * envia link de degustação da LP e executa transbordo VIP com follow-up de 5 minutos.
 */

import { evolutionApiService } from './evolutionApiService';
import { disparadorGoogleService, HotelGoogleItem } from './disparadorGoogleService';

export interface SuperAgenteConfig {
  ativo: boolean;
  nomeFluxo: string;
  instanciaMonitorada: string;
  telefoneAdminNotificacao: string; // WhatsApp do Sr. Everaldo (ex: 5565996173004)
  linkCadastro: string; // https://lp.hotelnozap.com.br
  tempoFollowupMinutos: number; // 5 minutos
  delayMinSegundos: number; // 8s
  delayMaxSegundos: number; // 15s
  simularDigitando: boolean; // true
  // Textos Oficiais Aprovados
  mensagemApresentacao: string;
  mensagemFechamentoLink: string;
  mensagemFollowup5Min: string;
  mensagemObjecaoSistema: string;
  mensagemObjecaoPreco: string;
  mensagemObjecaoRobo: string;
}

export interface LeadMensagem {
  id: string;
  remetente: 'lead' | 'agente' | 'sistema';
  texto: string;
  timestamp: string;
}

export interface LeadConversa {
  id: string; // cleanPhone
  hotelId?: string;
  hotelNome: string;
  cidade: string;
  uf: string;
  telefone: string;
  status:
    | 'conversando'
    | 'link_enviado'
    | 'aguardando_followup'
    | 'followup_enviado'
    | 'transbordo_vip'
    | 'pausado_manual'
    | 'descartado';
  ultimaMensagemLead?: string;
  ultimaRespostaIa?: string;
  linkEnviadoEm?: string;
  followupAgendadoPara?: number; // timestamp ms
  followupEnviadoEm?: string;
  alertaVipEnviadoEm?: string;
  criadoEm: string;
  atualizadoEm: string;
  mensagens: LeadMensagem[];
}

const STORAGE_KEY_CONFIG = 'hotelnozap_super_agente_config_v1';
const STORAGE_KEY_CONVERSAS = 'hotelnozap_super_agente_conversas_v1';

export const CONFIG_PADRAO_SUPER_AGENTE: SuperAgenteConfig = {
  ativo: true,
  nomeFluxo: 'Super Agente Vendedor',
  instanciaMonitorada: 'meutim',
  telefoneAdminNotificacao: '5565996173004',
  linkCadastro: 'https://lp.hotelnozap.com.br',
  tempoFollowupMinutos: 5,
  delayMinSegundos: 8,
  delayMaxSegundos: 15,
  simularDigitando: true,
  mensagemApresentacao:
    'Oi! Aqui é o *Everaldo Souza*, fundador do *Hotel no Zap* aqui de MT. Encontrei o hotel de vocês no Google e entrei em contato direto porque criamos a Plataforma de Gestão de Hotéis com Inteligência Artificial especializada para hotéis e pousadas atenderem hóspedes no WhatsApp.',
  mensagemFechamentoLink:
    'Maravilha! Você pode fazer a ativação imediata do seu hotel por este link inteiramente grátis:\n🔗 https://lp.hotelnozap.com.br\n\nLeva menos de 2 minutos para preencher. Vou ficar te aguardando por aqui!',
  mensagemFollowup5Min:
    '{primeiro_nome}, deu tudo certo com o preenchimento do cadastro pelo link? Se tiver qualquer dúvida estou por aqui para te ajudar a finalizar!',
  mensagemObjecaoSistema:
    'Excelente! O Hotel no Zap não substitui o seu sistema interno. Ele atua direto no WhatsApp para desafogar sua recepção e não deixar hóspede esperando resposta de madrugada. Você pode testar os 60 dias sem compromisso!',
  mensagemObjecaoPreco:
    'Temos planos super acessíveis a partir de R$ 97/mês, mas o senhor tem 60 dias inteiros inteiramente grátis para comprovar o aumento de reservas antes de investir qualquer centavo!',
  mensagemObjecaoRobo:
    'Aqui é a tecnologia inteligente do Hotel no Zap! Respondo em segundos exatamente como responderia aos hóspedes do seu hotel. Muito prático, né?'
};

export const superAgenteVendedorService = {
  /**
   * Obtém as configurações do Super Agente Vendedor
   */
  getConfig(): SuperAgenteConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (!raw) return { ...CONFIG_PADRAO_SUPER_AGENTE };
      return { ...CONFIG_PADRAO_SUPER_AGENTE, ...JSON.parse(raw) };
    } catch {
      return { ...CONFIG_PADRAO_SUPER_AGENTE };
    }
  },

  /**
   * Salva configurações
   */
  saveConfig(config: SuperAgenteConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('Erro ao salvar config do Super Agente:', e);
    }
  },

  /**
   * Mapa de conversas ativas
   */
  getConversas(): Record<string, LeadConversa> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONVERSAS);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  saveConversas(map: Record<string, LeadConversa>): void {
    try {
      localStorage.setItem(STORAGE_KEY_CONVERSAS, JSON.stringify(map));
    } catch (e) {
      console.warn('Erro ao salvar conversas do Super Agente:', e);
    }
  },

  /**
   * Classifica a intenção da mensagem recebida do hotel
   */
  classificarIntencao(texto: string): {
    intencao:
      | 'FECHAMENTO'
      | 'QUEM_FALA'
      | 'OBJECAO_SISTEMA'
      | 'OBJECAO_PRECO'
      | 'OBJECAO_ROBO'
      | 'DESCARTE'
      | 'GERAL_POSITIVO'
      | 'OUTRO';
    confianca: number;
  } {
    const limpo = texto.toLowerCase().trim();

    // 1. Fechamento / Interesse / Pedido de Link / Ligação
    if (
      limpo.includes('pode me ligar') ||
      limpo.includes('me liga') ||
      limpo.includes('quanto custa o plano anual') ||
      limpo.includes('como pago') ||
      limpo.includes('como contratar') ||
      limpo.includes('como funciona') ||
      limpo.includes('quero testar') ||
      limpo.includes('pode mandar') ||
      limpo.includes('manda o link') ||
      limpo.includes('manda aí') ||
      limpo.includes('manda ai') ||
      limpo.includes('pode enviar') ||
      limpo.includes('quero sim') ||
      limpo.includes('me passa') ||
      limpo.includes('aceito') ||
      limpo.includes('cadastra') ||
      limpo.includes('vamos testar') ||
      limpo.includes('tenho interesse')
    ) {
      return { intencao: 'FECHAMENTO', confianca: 0.98 };
    }

    // 2. Quem fala / Do que se trata
    if (
      limpo.includes('quem fala') ||
      limpo.includes('quem e') ||
      limpo.includes('quem é') ||
      limpo.includes('do que se trata') ||
      limpo.includes('sobre o que') ||
      limpo.includes('qual empresa') ||
      limpo.includes('quem esta falando') ||
      limpo.includes('quem está falando') ||
      limpo.includes('quem mandou') ||
      limpo.includes('quem enviou') ||
      limpo === 'quem?' ||
      limpo === 'quem'
    ) {
      return { intencao: 'QUEM_FALA', confianca: 0.95 };
    }

    // 3. Objeção de Sistema Atual
    if (
      limpo.includes('ja temos sistema') ||
      limpo.includes('já temos sistema') ||
      limpo.includes('ja tenho sistema') ||
      limpo.includes('já tenho sistema') ||
      limpo.includes('ja usamos') ||
      limpo.includes('já usamos') ||
      limpo.includes('hotsys') ||
      limpo.includes('totvs') ||
      limpo.includes('desbravador') ||
      limpo.includes('silbeck') ||
      limpo.includes('ja temos programa')
    ) {
      return { intencao: 'OBJECAO_SISTEMA', confianca: 0.92 };
    }

    // 4. Objeção Preço
    if (
      limpo.includes('quanto custa') ||
      limpo.includes('qual o valor') ||
      limpo.includes('qual o preco') ||
      limpo.includes('qual o preço') ||
      limpo.includes('e pago') ||
      limpo.includes('é pago') ||
      limpo.includes('cobra quanto')
    ) {
      return { intencao: 'OBJECAO_PRECO', confianca: 0.9 };
    }

    // 5. Objeção Robô
    if (
      limpo.includes('e robo') ||
      limpo.includes('é robô') ||
      limpo.includes('e bot') ||
      limpo.includes('inteligencia artificial') ||
      limpo.includes('resposta automatica') ||
      limpo.includes('eh robo')
    ) {
      return { intencao: 'OBJECAO_ROBO', confianca: 0.9 };
    }

    // 6. Descarte
    if (
      limpo.includes('nao quero') ||
      limpo.includes('não quero') ||
      limpo.includes('tira meu numero') ||
      limpo.includes('remover meu numero') ||
      limpo.includes('para de mandar') ||
      limpo.includes('nao tenho interesse') ||
      limpo.includes('não tenho interesse')
    ) {
      return { intencao: 'DESCARTE', confianca: 0.95 };
    }

    // 7. Geral positivo
    if (
      limpo === 'sim' ||
      limpo === 'é sim' ||
      limpo === 'e sim' ||
      limpo === 'ola' ||
      limpo === 'olá' ||
      limpo === 'bom dia' ||
      limpo === 'boa tarde' ||
      limpo === 'boa noite' ||
      limpo === 'oi' ||
      limpo === 'pode falar' ||
      limpo.startsWith('sim,') ||
      limpo.startsWith('ola,')
    ) {
      return { intencao: 'GERAL_POSITIVO', confianca: 0.85 };
    }

    return { intencao: 'OUTRO', confianca: 0.5 };
  },

  /**
   * Processa uma mensagem recebida de um lead e gera a resposta comercial
   */
  async processarMensagemRecebida(
    cleanPhone: string,
    textoRecebido: string,
    hotelInfo?: Partial<HotelGoogleItem>
  ): Promise<{
    resposta: string | null;
    devePausar: boolean;
    acionouTransbordo: boolean;
    agendouFollowup: boolean;
    intencaoDetectada: string;
  }> {
    const config = this.getConfig();
    if (!config.ativo) {
      return {
        resposta: null,
        devePausar: false,
        acionouTransbordo: false,
        agendouFollowup: false,
        intencaoDetectada: 'DESATIVADO'
      };
    }

    const conversas = this.getConversas();
    let conversa: LeadConversa = conversas[cleanPhone];

    const hotelNome = hotelInfo?.nome || conversa?.hotelNome || 'Hotel Parceiro';
    const primeiroNome = hotelNome.split(' ')[0] || hotelNome;
    const cidade = hotelInfo?.cidade || conversa?.cidade || 'sua cidade';
    const uf = hotelInfo?.uf || conversa?.uf || 'MT';
    const nowIso = new Date().toISOString();

    if (!conversa) {
      conversa = {
        id: cleanPhone,
        hotelId: hotelInfo?.id,
        hotelNome,
        cidade,
        uf,
        telefone: hotelInfo?.cleanPhone || cleanPhone,
        status: 'conversando',
        criadoEm: nowIso,
        atualizadoEm: nowIso,
        mensagens: []
      };
    }

    // Registra a mensagem do lead
    conversa.mensagens.push({
      id: Math.random().toString(36).substring(2, 9),
      remetente: 'lead',
      texto: textoRecebido,
      timestamp: nowIso
    });
    conversa.ultimaMensagemLead = textoRecebido;
    conversa.atualizadoEm = nowIso;

    // Se já estiver pausado manualmente, não responde
    if (conversa.status === 'pausado_manual') {
      this.saveConversas(conversas);
      return {
        resposta: null,
        devePausar: true,
        acionouTransbordo: false,
        agendouFollowup: false,
        intencaoDetectada: 'PAUSADO_MANUAL'
      };
    }

    const { intencao } = this.classificarIntencao(textoRecebido);
    let textoResposta: string | null = null;
    let acionouTransbordo = false;
    let agendouFollowup = false;

    switch (intencao) {
      case 'FECHAMENTO':
        // Envio do link da LP + Agenda Follow-up de 5 minutos + Alerta VIP
        textoResposta = config.mensagemFechamentoLink;
        conversa.status = 'link_enviado';
        conversa.linkEnviadoEm = nowIso;
        conversa.followupAgendadoPara = Date.now() + config.tempoFollowupMinutos * 60 * 1000;
        agendouFollowup = true;
        acionouTransbordo = true;

        // Dispara Alerta VIP para o Everaldo
        this.notificarAdminTransbordoVip(conversa, textoRecebido);
        break;

      case 'QUEM_FALA':
        textoResposta = config.mensagemApresentacao;
        conversa.status = 'conversando';
        break;

      case 'OBJECAO_SISTEMA':
        textoResposta = config.mensagemObjecaoSistema;
        conversa.status = 'conversando';
        break;

      case 'OBJECAO_PRECO':
        textoResposta = config.mensagemObjecaoPreco;
        conversa.status = 'conversando';
        break;

      case 'OBJECAO_ROBO':
        textoResposta = config.mensagemObjecaoRobo;
        conversa.status = 'conversando';
        break;

      case 'DESCARTE':
        textoResposta = 'Entendido perfeitamente! Já registrei aqui e não te enviaremos mais mensagens. Um abraço e boas reservas!';
        conversa.status = 'descartado';
        break;

      case 'GERAL_POSITIVO':
      default:
        // Se já recebeu o link e respondeu algo positivo, agradece e reforça
        if (conversa.status === 'link_enviado' || conversa.status === 'followup_enviado') {
          textoResposta = `Qualquer dúvida para acessar a plataforma pelo link ${config.linkCadastro}, estou aqui!`;
        } else {
          // Apresenta com foco na dor
          textoResposta = `Olá! Tudo bem? Me chamo Everaldo, sou fundador do Hotel no Zap aqui no MT. Vocês perdem muito tempo na recepção do ${hotelNome} respondendo dúvidas e fechando reservas no WhatsApp? Desenvolvemos uma IA que atende em segundos e fecha reservas diretas sem comissão!`;
        }
        break;
    }

    if (textoResposta) {
      // Substitui variáveis
      textoResposta = textoResposta
        .replace(/\{nome_hotel\}/gi, hotelNome)
        .replace(/\{primeiro_nome\}/gi, primeiroNome)
        .replace(/\{cidade\}/gi, cidade)
        .replace(/\{uf\}/gi, uf);

      conversa.mensagens.push({
        id: Math.random().toString(36).substring(2, 9),
        remetente: 'agente',
        texto: textoResposta,
        timestamp: new Date().toISOString()
      });
      conversa.ultimaRespostaIa = textoResposta;
    }

    conversas[cleanPhone] = conversa;
    this.saveConversas(conversas);

    return {
      resposta: textoResposta,
      devePausar: conversa.status === 'descartado',
      acionouTransbordo,
      agendouFollowup,
      intencaoDetectada: intencao
    };
  },

  /**
   * Envia o alerta VIP de Transbordo diretamente para o WhatsApp do Everaldo
   */
  async notificarAdminTransbordoVip(conversa: LeadConversa, textoLead: string): Promise<void> {
    const config = this.getConfig();
    if (!config.telefoneAdminNotificacao) return;

    const mensagemAlerta =
      `🚨 *NOVO CLIENTE EM FECHAMENTO - HOTEL NO ZAP!*\n\n` +
      `🏨 *Hotel:* ${conversa.hotelNome}\n` +
      `📍 *Local:* ${conversa.cidade} - ${conversa.uf}\n` +
      `📞 *Telefone:* ${conversa.telefone}\n` +
      `💬 *O que ele disse:* "${textoLead}"\n\n` +
      `✅ *Ação do Super Agente:* Link da LP (${config.linkCadastro}) enviado. Follow-up de 5 min agendado!\n\n` +
      `👉 *Falar com ele agora no WhatsApp:*\nhttps://wa.me/${conversa.telefone.replace(/\D/g, '')}`;

    try {
      await evolutionApiService.sendTextMessageDetailed(
        config.instanciaMonitorada,
        config.telefoneAdminNotificacao,
        mensagemAlerta
      );
      conversa.alertaVipEnviadoEm = new Date().toISOString();
      const map = this.getConversas();
      map[conversa.id] = conversa;
      this.saveConversas(map);
    } catch (err) {
      console.warn('[Super Agente] Erro ao enviar notificação VIP:', err);
    }
  },

  /**
   * Verifica se há follow-ups de 5 minutos pendentes e executa o envio
   */
  async executarVerificacaoFollowups(): Promise<number> {
    const config = this.getConfig();
    if (!config.ativo) return 0;

    const conversas = this.getConversas();
    const now = Date.now();
    let enviados = 0;

    for (const key of Object.keys(conversas)) {
      const conv = conversas[key];
      if (
        conv.status === 'link_enviado' &&
        conv.followupAgendadoPara &&
        now >= conv.followupAgendadoPara
      ) {
        // Envia o follow-up amigável
        const primeiroNome = conv.hotelNome.split(' ')[0] || conv.hotelNome;
        const msgFollowup = config.mensagemFollowup5Min
          .replace(/\{primeiro_nome\}/gi, primeiroNome)
          .replace(/\{nome_hotel\}/gi, conv.hotelNome);

        try {
          if (config.simularDigitando) {
            await new Promise(r => setTimeout(r, 4000));
          }

          await evolutionApiService.sendTextMessageDetailed(
            config.instanciaMonitorada,
            conv.telefone,
            msgFollowup
          );

          conv.status = 'followup_enviado';
          conv.followupEnviadoEm = new Date().toISOString();
          conv.mensagens.push({
            id: Math.random().toString(36).substring(2, 9),
            remetente: 'agente',
            texto: msgFollowup,
            timestamp: new Date().toISOString()
          });
          conv.ultimaRespostaIa = msgFollowup;
          enviados++;
        } catch (err) {
          console.warn('[Super Agente] Falha no follow-up de 5 min:', err);
        }
      }
    }

    if (enviados > 0) {
      this.saveConversas(conversas);
    }
    return enviados;
  },

  /**
   * Reseta o histórico de conversas do Super Agente
   */
  limparConversas(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_CONVERSAS);
    } catch { /* ignore */ }
  }
};

export default superAgenteVendedorService;
