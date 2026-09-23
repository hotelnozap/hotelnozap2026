import React, { useState, useEffect, useMemo, useRef } from 'react';
import { maskPhone } from '../utils/masks';
import {
  evolutionApiService,
  EvolutionApiInstance,
  QrCodeResponse,
  InstanceMetadata
} from '../services/evolutionApiService';
import { currentHotelService, hoteisService, planosService } from '../services/supabaseService';
import {
  templateMensagemService,
  TemplateType,
  TemplatesConfig,
  TEMPLATES_PADRAO,
  AutomacoesConfig,
  AUTOMACOES_PADRAO
} from '../services/templateMensagemService';

export interface WhatsappInstance {
  id: string;
  code: string;
  name: string;
  instanceName: string;
  phone: string;
  department: string;
  status: 'conectado' | 'desconectado' | 'aguardando';
  battery: string;
  device: string;
  lastActivity: string;
  messagesSentToday: number;
  profilePicUrl?: string | null;
  token?: string;
  evolutionData?: EvolutionApiInstance;
}

export interface HotelPlanInfo {
  hotelName: string;
  planName: string;
  maxInstances: number;
  currentCount: number;
  canCreateMore: boolean;
  isLoading: boolean;
}

export interface ConexoesWhatsappProps {
  onNavigateToDashboard?: () => void;
  onNavigateToUpgrade?: () => void;
}

export const ConexoesWhatsapp: React.FC<ConexoesWhatsappProps> = ({
  onNavigateToDashboard,
  onNavigateToUpgrade
}) => {
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [atualizandoStatus, setAtualizandoStatus] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [departmentFilter, setDepartmentFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  // Modais
  const [selectedLogsInstance, setSelectedLogsInstance] = useState<WhatsappInstance | null>(null);
  const [qrModalInstance, setQrModalInstance] = useState<WhatsappInstance | null>(null);
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<QrCodeResponse | null>(null);
  const [qrConnectedSuccess, setQrConnectedSuccess] = useState<boolean>(false);
  const [tempoRestanteQr, setTempoRestanteQr] = useState<number>(45);

  const [editInstance, setEditInstance] = useState<WhatsappInstance | null>(null);
  const [isNovaConexaoOpen, setIsNovaConexaoOpen] = useState(false);
  const [criandoInstancia, setCriandoInstancia] = useState(false);
  const [deleteConfirmInstance, setDeleteConfirmInstance] = useState<WhatsappInstance | null>(null);
  const [excluindoInstancia, setExcluindoInstancia] = useState(false);

  // Form States para Nova Conexão
  const [novoNome, setNovoNome] = useState('');
  const [novoDept, setNovoDept] = useState('Recepção & Check-in');
  const [novoTelefone, setNovoTelefone] = useState('');

  // Regras e Limites do Plano do Hotel
  const [hotelPlanInfo, setHotelPlanInfo] = useState<HotelPlanInfo>({
    hotelName: '',
    planName: 'Carregando plano...',
    maxInstances: 1,
    currentCount: 0,
    canCreateMore: true,
    isLoading: true
  });
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const currentHotel = useMemo(() => currentHotelService.getCurrentHotel(), []);

  // ==========================================
  // ==========================================
  // ESTADOS DAS ABAS: INSTÂNCIAS, ATENDIMENTOS & TEMPLATES
  // ==========================================
  const [activeSubTab, setActiveSubTab] = useState<'instancias' | 'templates' | 'atendimentos'>('instancias');

  // Mensagens em tempo real / Atendimentos WhatsApp
  const [mensagensChat, setMensagensChat] = useState<any[]>([]);
  const [carregandoChat, setCarregandoChat] = useState<boolean>(false);
  const [contatoSelecionadoTelefone, setContatoSelecionadoTelefone] = useState<string | null>(null);
  const [filtroBuscaChat, setFiltroBuscaChat] = useState<string>('');
  const [mensagemRespostaManual, setMensagemRespostaManual] = useState<string>('');
  const [enviandoRespostaManual, setEnviandoRespostaManual] = useState<boolean>(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = false) => {
    requestAnimationFrame(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    });
  };

  // Escuta evento vindo do sino de notificações para abrir direto a aba de atendimentos e o contato correto
  useEffect(() => {
    const handleOpenAtendimentos = (e?: any) => {
      setActiveSubTab('atendimentos');
      const phone = e?.detail?.phone;
      if (phone) {
        setContatoSelecionadoTelefone(phone);
      }
      carregarMensagensDoServidor();
    };
    window.addEventListener('hotel_abrir_atendimentos_whatsapp', handleOpenAtendimentos);
    return () => {
      window.removeEventListener('hotel_abrir_atendimentos_whatsapp', handleOpenAtendimentos);
    };
  }, []);

  const carregarMensagensDoServidor = async () => {
    const online = instances.find((i) => i.status === 'conectado') || instances[0];
    if (!online) return;
    setCarregandoChat(true);
    try {
      const records = await evolutionApiService.findLatestMessages(online.instanceName, 60);
      if (Array.isArray(records)) {
        setMensagensChat(records);
      }
    } catch (err) {
      console.warn('Erro ao carregar mensagens do chat:', err);
    } finally {
      setCarregandoChat(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'atendimentos') {
      carregarMensagensDoServidor();
    }
  }, [activeSubTab, instances]);

  const hotelTemplatesState = templateMensagemService.getHotelTemplates(currentHotel.id);
  const [hotelTemplates, setHotelTemplates] = useState<TemplatesConfig>(() => hotelTemplatesState);
  const [selectedTemplateType, setSelectedTemplateType] = useState<
    'boas_vindas' | 'confirmacao' | 'lembrete_checkin' | 'checkout'
  >('boas_vindas');
  const [templateSalvoStatus, setTemplateSalvoStatus] = useState<boolean>(false);
  const [testSendPhone, setTestSendPhone] = useState<string>('');
  const [enviandoTeste, setEnviandoTeste] = useState<boolean>(false);
  const [testeFeedback, setTesteFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const textareaTemplateRef = useRef<HTMLTextAreaElement>(null);

  // Recarregar templates quando o hotel mudar
  useEffect(() => {
    setHotelTemplates(templateMensagemService.getHotelTemplates(currentHotel.id));
  }, [currentHotel.id]);

  // Dados de teste para a pré-visualização ao vivo
  const previewTagsExemplo = useMemo(
    () => ({
      nome_hospede: 'Carlos Eduardo Santos',
      nome_hotel: currentHotel.name || 'Hotel Recanto Verde',
      link_hotel: templateMensagemService.getHotelPublicLink(currentHotel.id),
      numero_quarto: '104',
      tipo_quarto: 'Suíte Luxo Vista Jardim',
      checkin: '22/09/2026 às 14:00',
      checkout: '25/09/2026 às 12:00',
      valor_total: 'R$ 840,00'
    }),
    [currentHotel.id, currentHotel.name]
  );

  const textoPrevisualizacao = useMemo(() => {
    let text = hotelTemplates[selectedTemplateType] || TEMPLATES_PADRAO[selectedTemplateType] || '';
    Object.entries(previewTagsExemplo).forEach(([key, val]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      text = text.replace(regex, val);
    });
    return text;
  }, [hotelTemplates, selectedTemplateType, previewTagsExemplo]);

  const instanciaOnlineDoHotel = useMemo(() => {
    return instances.find((i) => i.status === 'conectado');
  }, [instances]);

  // Agrupa mensagens recentes da Evolution API por contato para a aba de Atendimentos
  const conversasAgrupadas = useMemo(() => {
    const mapa = new Map<string, {
      phone: string;
      displayPhone: string;
      name: string;
      lastMessage: string;
      lastTimestamp: number;
      lastTimeStr: string;
      messages: Array<{
        id: string;
        fromMe: boolean;
        text: string;
        timestamp: number;
        timeStr: string;
      }>;
    }>();

    mensagensChat.forEach((r: any) => {
      const key = r.key || {};
      let phone = '';
      if (key.remoteJidAlt && key.remoteJidAlt.includes('@s.whatsapp.net')) {
        phone = key.remoteJidAlt.replace(/\D/g, '');
      } else if (key.remoteJid && key.remoteJid.includes('@s.whatsapp.net')) {
        phone = key.remoteJid.replace(/\D/g, '');
      } else {
        phone = (key.remoteJidAlt || key.remoteJid || '').replace(/@.*$/, '').replace(/\D/g, '');
      }

      if (!phone || phone.length < 8) return;

      const msgText = (
        r.message?.conversation ||
        r.message?.extendedTextMessage?.text ||
        ''
      ).trim();

      if (!msgText) return;

      const ts = r.messageTimestamp ? Number(r.messageTimestamp) * 1000 : Date.now();
      const timeStr = new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      if (!mapa.has(phone)) {
        let contactName = r.pushName && r.pushName !== 'Você' ? r.pushName : '';
        if (!contactName) {
          contactName = phone === '556681585014' ? 'Você (Teste de Si Mesmo)' : maskPhone(phone);
        }

        mapa.set(phone, {
          phone,
          displayPhone: maskPhone(phone),
          name: contactName,
          lastMessage: msgText,
          lastTimestamp: ts,
          lastTimeStr: timeStr,
          messages: []
        });
      }

      const conv = mapa.get(phone)!;
      conv.messages.push({
        id: r.id || r.key?.id || String(Math.random()),
        fromMe: key.fromMe === true,
        text: msgText,
        timestamp: ts,
        timeStr
      });

      if (ts > conv.lastTimestamp) {
        conv.lastTimestamp = ts;
        conv.lastMessage = msgText;
        conv.lastTimeStr = timeStr;
      }
    });

    const lista = Array.from(mapa.values());
    lista.forEach((c) => {
      c.messages.sort((a, b) => a.timestamp - b.timestamp);
    });
    lista.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    return lista;
  }, [mensagensChat]);

  const conversaAtiva = useMemo(() => {
    if (!conversasAgrupadas.length) return null;
    if (contatoSelecionadoTelefone) {
      const encontrada = conversasAgrupadas.find((c) => c.phone === contatoSelecionadoTelefone);
      if (encontrada) return encontrada;
    }
    return conversasAgrupadas[0];
  }, [conversasAgrupadas, contatoSelecionadoTelefone]);

  // Sempre rolar para a última mensagem recebida ao abrir ou trocar conversa
  useEffect(() => {
    if (activeSubTab === 'atendimentos' && conversaAtiva) {
      scrollToBottom(false);
      const timer1 = setTimeout(() => scrollToBottom(false), 50);
      const timer2 = setTimeout(() => scrollToBottom(false), 200);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [activeSubTab, conversaAtiva?.phone, conversaAtiva?.messages?.length]);

  const handleEnviarRespostaManual = async () => {
    if (!conversaAtiva || !mensagemRespostaManual.trim()) return;
    const online = instances.find((i) => i.status === 'conectado') || instances[0];
    if (!online) {
      showToast('Nenhuma instância conectada para envio.');
      return;
    }

    setEnviandoRespostaManual(true);
    try {
      const res = await evolutionApiService.sendTextMessageDetailed(
        online.instanceName,
        conversaAtiva.phone,
        mensagemRespostaManual.trim()
      );
      if (res.success) {
        setMensagemRespostaManual('');
        showToast(`Mensagem enviada com sucesso para ${conversaAtiva.displayPhone}!`);
        await carregarMensagensDoServidor();
        scrollToBottom(true);
      } else {
        showToast(`Erro ao enviar: ${res.error || 'Falha na Evolution API'}`);
      }
    } catch (err: any) {
      showToast(`Erro ao enviar mensagem: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setEnviandoRespostaManual(false);
    }
  };

  // Auto-Resposta Automática de Boas-Vindas
  const [webhookUrl, setWebhookUrl] = useState<string>(
    'https://obkvgluunbnktzulzjfg.supabase.co/functions/v1/whatsapp-webhook'
  );
  const [salvandoWebhook, setSalvandoWebhook] = useState<boolean>(false);
  const [verificandoWebhook, setVerificandoWebhook] = useState<boolean>(false);
  const [webhookAtivo, setWebhookAtivo] = useState<boolean>(false);
  const [showConfigAvancada, setShowConfigAvancada] = useState<boolean>(false);

  // Perfil do usuário atual: apenas administradores acessam opções avançadas de webhook
  const isAdmin = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const role = (localStorage.getItem('hotelnozap_user_role') || '').toLowerCase().trim();
    return role.includes('admin') || role.includes('super');
  }, []);

  // Configurações de Automações e Fuso Horário do Hotel
  const [hotelAutomacoes, setHotelAutomacoes] = useState<AutomacoesConfig>(() =>
    templateMensagemService.getHotelAutomacoes(currentHotel?.id)
  );
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  useEffect(() => {
    setHotelAutomacoes(templateMensagemService.getHotelAutomacoes(currentHotel?.id));
  }, [currentHotel?.id]);

  useEffect(() => {
    const updateClock = () => {
      setCurrentTimeStr(
        templateMensagemService.getHorarioFormatadoNoFuso(hotelAutomacoes.fuso_horario)
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [hotelAutomacoes.fuso_horario]);

  const handleUpdateAutomacao = (key: keyof AutomacoesConfig, val: any) => {
    const updated = { ...hotelAutomacoes, [key]: val };
    setHotelAutomacoes(updated);
    templateMensagemService.saveHotelAutomacoes(currentHotel.id, updated);
    if (key === 'fuso_horario') {
      showToast(
        `Horário oficial do hotel definido para ${
          val === 'America/Cuiaba' ? 'Cuiabá / MT (GMT-4)' : 'São Paulo / Brasília (GMT-3)'
        }!`
      );
    }
  };

  const checarWebhookDaInstancia = async (instName?: string) => {
    const target = instName || instanciaOnlineDoHotel?.instanceName;
    if (!target) return;
    setVerificandoWebhook(true);
    try {
      const res = await evolutionApiService.findInstanceWebhook(target);
      if (res && res.enabled) {
        setWebhookAtivo(true);
        if (res.url) setWebhookUrl(res.url);
      } else {
        setWebhookAtivo(false);
      }
    } catch {
      // ignore
    } finally {
      setVerificandoWebhook(false);
    }
  };

  useEffect(() => {
    if (instanciaOnlineDoHotel) {
      checarWebhookDaInstancia(instanciaOnlineDoHotel.instanceName);
    }
  }, [instanciaOnlineDoHotel, activeSubTab]);

  const handleToggleAutoResposta = async (habilitar: boolean) => {
    if (!instanciaOnlineDoHotel) {
      showToast('Conecte sua instância do WhatsApp primeiro na aba Instâncias.');
      return;
    }
    if (habilitar && !webhookUrl.trim()) {
      showToast('URL de integração não informada.');
      return;
    }

    setSalvandoWebhook(true);
    try {
      const res = await evolutionApiService.setInstanceWebhook(
        instanciaOnlineDoHotel.instanceName,
        webhookUrl,
        ['MESSAGES_UPSERT'],
        habilitar
      );
      if (res.success) {
        setWebhookAtivo(habilitar);
        checarWebhookDaInstancia(instanciaOnlineDoHotel.instanceName);
      }
    } catch {
      // ignore
    } finally {
      setSalvandoWebhook(false);
    }
  };

  const handleInserirTag = (tag: string) => {
    const textarea = textareaTemplateRef.current;
    const currentText = hotelTemplates[selectedTemplateType] || '';
    if (!textarea) {
      setHotelTemplates((prev) => ({
        ...prev,
        [selectedTemplateType]: currentText ? `${currentText} ${tag}` : tag
      }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = currentText.substring(0, start) + tag + currentText.substring(end);
    setHotelTemplates((prev) => ({
      ...prev,
      [selectedTemplateType]: newText
    }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleSalvarTemplates = () => {
    templateMensagemService.saveHotelTemplates(currentHotel.id, hotelTemplates);
    setTemplateSalvoStatus(true);
    showToast(`Templates de mensagens de ${currentHotel.name} salvos com sucesso!`);
    setTimeout(() => setTemplateSalvoStatus(false), 3500);
  };

  const handleRestaurarPadroes = () => {
    if (
      confirm(
        `Deseja restaurar as mensagens de ${currentHotel.name} para os modelos padrões da plataforma?`
      )
    ) {
      const padroes = templateMensagemService.resetHotelTemplates(currentHotel.id);
      setHotelTemplates(padroes);
      showToast('Modelos padrões do sistema restaurados com sucesso!');
    }
  };

  const handleEnviarTeste = async () => {
    if (!testSendPhone.trim()) {
      showToast('Por favor, informe o número de WhatsApp com DDD para o teste.');
      return;
    }

    setEnviandoTeste(true);
    setTesteFeedback(null);
    try {
      const res = await templateMensagemService.enviarMensagemWhatsApp(
        currentHotel.id,
        testSendPhone,
        textoPrevisualizacao
      );

      if (res.success) {
        setTesteFeedback({
          tipo: 'sucesso',
          texto: `Mensagem enviada com sucesso para ${testSendPhone} via ${res.instanceName}!`
        });
        showToast('Mensagem de teste enviada com sucesso!');
      } else {
        setTesteFeedback({
          tipo: 'erro',
          texto:
            res.error ||
            'Não foi possível enviar pela API. Conecte sua instância ou envie via WhatsApp Web.'
        });
      }
    } catch (err: any) {
      setTesteFeedback({
        tipo: 'erro',
        texto: 'Erro inesperado ao disparar teste pela Evolution API.'
      });
    } finally {
      setEnviandoTeste(false);
    }
  };

  const handleAbrirTesteWeb = () => {
    if (!testSendPhone.trim()) {
      showToast('Por favor, informe o número de WhatsApp com DDD para abrir o link.');
      return;
    }
    const link = templateMensagemService.gerarLinkWhatsAppWeb(
      testSendPhone,
      textoPrevisualizacao
    );
    window.open(link, '_blank');
  };

  const TEMPLATE_METADATA: Record<
    'boas_vindas' | 'confirmacao' | 'lembrete_checkin' | 'checkout',
    { label: string; icon: string; gatilho: string; desc: string; badge: string }
  > = {
    boas_vindas: {
      label: 'Boas-Vindas & Primeiro Contato',
      icon: 'waving_hand',
      badge: 'Atendimento & Recepção',
      gatilho: 'Enviado no primeiro contato ou após cadastro do hóspede',
      desc: 'Envia mensagem de boas-vindas com o link oficial do hotel para o hóspede consultar preços, quartos e fazer a reserva.'
    },
    confirmacao: {
      label: 'Confirmação de Reserva',
      icon: 'task_alt',
      badge: 'Reservas & Tarifas',
      gatilho: 'Disparado na tela de reservas ao confirmar ou salvar uma estadia',
      desc: 'Envia os detalhes completos da reserva confirmada: quarto, datas de entrada/saída e valor total.'
    },
    lembrete_checkin: {
      label: 'Lembrete de Check-in (24h)',
      icon: 'alarm',
      badge: 'Operação Pré-Chegada',
      gatilho: 'Disparado 24h antes do horário previsto para entrada no hotel',
      desc: 'Lembra o hóspede sobre o dia e hora do check-in, localização e orientações da recepção.'
    },
    checkout: {
      label: 'Pós Check-out & Avaliação',
      icon: 'star',
      badge: 'Pós-Venda & Fidelização',
      gatilho: 'Enviado após o check-out na quitação e encerramento da conta',
      desc: 'Agradece pela estadia, reforça o relacionamento e convida o hóspede a avaliar o hotel.'
    }
  };

  // Carregar dados e regras do plano do hotel
  const carregarDadosPlano = async (instanciasAtuais?: WhatsappInstance[]) => {
    try {
      const active = currentHotelService.getCurrentHotel();
      const dbHoteis = await hoteisService.getHoteis();
      const hotel = (dbHoteis || []).find((h) => h.id === active.id) || (dbHoteis && dbHoteis[0]);

      const planName = hotel?.plan || '1 Crédito (Adesão / Teste)';
      let maxInst = 1;

      // 1. Se o hotel tiver instâncias explicitamente configuradas no cadastro
      if (hotel?.whatsappInstances && Number(hotel.whatsappInstances) > 0) {
        maxInst = Number(hotel.whatsappInstances);
      } else {
        // 2. Busca na tabela de planos do Supabase
        const dbPlanos = await planosService.getPlanos();
        const matched = (dbPlanos || []).find(
          (p: any) =>
            p.id === planName ||
            (p.name && p.name.toLowerCase() === planName.toLowerCase()) ||
            (p.name && planName.toLowerCase().includes(p.name.toLowerCase()))
        );

        if (matched && matched.whatsappConnections !== undefined && matched.whatsappConnections !== null) {
          maxInst = Number(matched.whatsappConnections);
        } else {
          // 3. Heurística padrão pelos nomes dos planos oficiais do sistema
          const pLower = planName.toLowerCase();
          if (
            pLower.includes('gratis') ||
            pLower.includes('grátis') ||
            pLower.includes('free') ||
            pLower.includes('maps')
          ) {
            maxInst = 0;
          } else if (
            pLower.includes('12 credito') ||
            pLower.includes('12 crédito') ||
            pLower.includes('anual') ||
            pLower.includes('enterprise')
          ) {
            maxInst = 5;
          } else if (
            pLower.includes('6 credito') ||
            pLower.includes('6 crédito') ||
            pLower.includes('semestral')
          ) {
            maxInst = 4;
          } else if (
            pLower.includes('3 credito') ||
            pLower.includes('3 crédito') ||
            pLower.includes('trimestral') ||
            pLower.includes('ouro')
          ) {
            maxInst = 3;
          } else if (
            pLower.includes('2 credito') ||
            pLower.includes('2 crédito') ||
            pLower.includes('bimestral') ||
            pLower.includes('professional') ||
            pLower.includes('pousada vip')
          ) {
            maxInst = 2;
          } else {
            maxInst = 1; // 1 Crédito, Starter
          }
        }
      }

      const cleanHotelPrefix = (active?.id || 'hotel')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 8);

      const listToCheck = instanciasAtuais || instances;
      const metaMap = evolutionApiService.getLocalMetadata(active.id);

      // Instâncias associadas a este hotel
      const hotelInsts = listToCheck.filter((inst) => {
        const meta = metaMap[inst.instanceName];
        if (meta && meta.hotelId === active.id) return true;
        if (inst.instanceName.toLowerCase().startsWith(cleanHotelPrefix + '_')) return true;
        if (hotel?.instanceName && hotel.instanceName === inst.instanceName) return true;
        return true;
      });

      const currentCount = hotelInsts.length;
      const canCreate = currentCount < maxInst;

      setHotelPlanInfo({
        hotelName: hotel?.name || active.name,
        planName,
        maxInstances: maxInst,
        currentCount,
        canCreateMore: canCreate,
        isLoading: false
      });
    } catch (err) {
      console.warn('Erro ao calcular limite do plano:', err);
      setHotelPlanInfo((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Mapear dados da Evolution API para a interface da UI
  const mapEvolutionToUi = (
    evoList: EvolutionApiInstance[],
    metaMap: Record<string, InstanceMetadata>
  ): WhatsappInstance[] => {
    return evoList.map((evo) => {
      const meta = metaMap[evo.name];

      let st: 'conectado' | 'desconectado' | 'aguardando' = 'aguardando';
      if (evo.connectionStatus === 'open') st = 'conectado';
      else if (evo.connectionStatus === 'close') st = 'desconectado';
      else st = 'aguardando';

      let displayPhone = 'Aguardando pareamento';
      if (evo.ownerJid) {
        const cleanNum = evo.ownerJid.split('@')[0];
        displayPhone = maskPhone(cleanNum);
      } else if (meta?.phone) {
        displayPhone = maskPhone(meta.phone);
      }

      const shortId = (evo.id || evo.name).replace(/\D/g, '').slice(-3) || '1';

      return {
        id: evo.id || evo.name,
        code: `WZ${shortId.padStart(2, '0')}`,
        name: meta?.displayName || evo.profileName || evo.name,
        instanceName: evo.name,
        phone: displayPhone,
        department: meta?.department || 'Recepção & Check-in',
        status: st,
        battery: st === 'conectado' ? '100%' : 'Desconhecido',
        device: evo.clientName || 'WhatsApp Baileys',
        lastActivity: evo.updatedAt
          ? new Date(evo.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : 'Recente',
        messagesSentToday: evo._count?.Message || 0,
        profilePicUrl: evo.profilePicUrl,
        token: evo.token,
        evolutionData: evo
      };
    });
  };

  // Carregar instâncias da Evolution API
  const carregarInstancias = async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    else setAtualizandoStatus(true);

    try {
      const evoList = await evolutionApiService.fetchInstances();
      const metaMap = evolutionApiService.getLocalMetadata(currentHotel.id);
      const mapped = mapEvolutionToUi(evoList, metaMap);
      setInstances(mapped);
      await carregarDadosPlano(mapped);

      if (silencioso) {
        showToast('Instâncias e status sincronizados com a Evolution API!');
      }
    } catch (err) {
      console.error('Erro ao buscar instâncias da Evolution API:', err);
      showToast('Não foi possível conectar à Evolution API. Verifique a conexão.');
    } finally {
      setCarregando(false);
      setAtualizandoStatus(false);
    }
  };

  // Carregar ao montar
  useEffect(() => {
    carregarInstancias();
  }, [currentHotel.id]);

  // Função para abrir o modal de QR Code e iniciar a leitura
  const handleAbrirQrCodeModal = async (inst: WhatsappInstance) => {
    setQrModalInstance(inst);
    setQrCodeData(null);
    setQrConnectedSuccess(false);
    setQrLoading(true);
    setTempoRestanteQr(45);

    try {
      const res = await evolutionApiService.connectInstance(inst.instanceName);
      if (res.state === 'open') {
        setQrConnectedSuccess(true);
        setQrLoading(false);
        carregarInstancias(true);
        return;
      }

      if (res.qrcode) {
        setQrCodeData(res.qrcode);
      }
    } catch (err) {
      console.error('Erro ao conectar instância para QR Code:', err);
      showToast('Erro ao solicitar QR Code ao servidor.');
    } finally {
      setQrLoading(false);
    }
  };

  // Polling ativo enquanto o modal de QR Code estiver aberto
  useEffect(() => {
    if (!qrModalInstance || qrConnectedSuccess) return;

    // Polling do estado da conexão a cada 3.5 segundos
    const intervalState = setInterval(async () => {
      try {
        const state = await evolutionApiService.getConnectionState(qrModalInstance.instanceName);
        if (state === 'open') {
          setQrConnectedSuccess(true);
          carregarInstancias(true);
          showToast(`🎉 Instância "${qrModalInstance.name}" conectada com sucesso!`);
        }
      } catch {}
    }, 3500);

    // Contagem regressiva do QR Code
    const intervalTimer = setInterval(() => {
      setTempoRestanteQr((prev) => {
        if (prev <= 1) {
          // Auto-recarregar QR Code quando expirar
          evolutionApiService.connectInstance(qrModalInstance.instanceName).then((res) => {
            if (res.qrcode) setQrCodeData(res.qrcode);
            if (res.state === 'open') {
              setQrConnectedSuccess(true);
              carregarInstancias(true);
            }
          });
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalState);
      clearInterval(intervalTimer);
    };
  }, [qrModalInstance, qrConnectedSuccess]);

  // Criar Nova Instância na Evolution API (Respeitando Regras do Plano)
  const handleSaveNovaConexao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim() || criandoInstancia) return;

    // 🔒 Verificação Rigorosa das Regras do Plano
    if (!hotelPlanInfo.canCreateMore || hotelPlanInfo.currentCount >= hotelPlanInfo.maxInstances) {
      if (hotelPlanInfo.maxInstances === 0) {
        alert(
          `Plano sem direito a conexões de WhatsApp!\n\nSeu hotel (${hotelPlanInfo.hotelName}) está no plano "${hotelPlanInfo.planName}", que não inclui conexões de WhatsApp (0 inclusas).\n\nPara cadastrar e conectar instâncias de WhatsApp, faça o upgrade do seu plano.`
        );
      } else {
        alert(
          `Limite do plano atingido!\n\nSeu hotel (${hotelPlanInfo.hotelName}) está no plano "${hotelPlanInfo.planName}", que permite no máximo ${hotelPlanInfo.maxInstances} conexão(ões) simultânea(s) de WhatsApp.\n\nPara cadastrar mais números, faça o upgrade do plano.`
        );
      }
      setIsNovaConexaoOpen(false);
      setIsUpgradeModalOpen(true);
      return;
    }

    setCriandoInstancia(true);
    try {
      // 🏷️ Prefixo amigável com identificador do hotel para ser visto no painel da Evolution API:
      // Ex: hot001_recepcao_1234
      const cleanHotelPrefix = (currentHotel?.id || 'hotel')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 8);

      const cleanSlug = novoNome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 15);

      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const finalInstanceName = `${cleanHotelPrefix}_${cleanSlug || 'wa'}_${uniqueSuffix}`;

      const res = await evolutionApiService.createInstance(finalInstanceName, {
        qrcode: true,
        number: novoTelefone || undefined
      });

      if (!res.success) {
        alert(res.error || 'Erro ao criar instância na Evolution API.');
        setCriandoInstancia(false);
        return;
      }

      // Salva metadados locais associados ao hotel
      const newMeta: InstanceMetadata = {
        instanceName: finalInstanceName,
        displayName: novoNome.trim(),
        department: novoDept,
        hotelId: currentHotel.id,
        phone: novoTelefone || undefined,
        createdAt: new Date().toISOString()
      };
      evolutionApiService.saveLocalMetadata(currentHotel.id, newMeta);

      // Tenta vincular o nome da instância no cadastro do hotel no Supabase caso esteja em branco
      try {
        await hoteisService.updateHotel(currentHotel.id, { instanceName: finalInstanceName });
      } catch {}

      setIsNovaConexaoOpen(false);
      setNovoNome('');
      setNovoTelefone('');
      setNovoDept('Recepção & Check-in');

      showToast(`Instância "${newMeta.displayName}" criada com sucesso na Evolution API!`);

      // Recarrega as instâncias
      await carregarInstancias(true);

      // Abre imediatamente o modal de QR Code para escaneamento
      const novaInstanciaUi: WhatsappInstance = {
        id: finalInstanceName,
        code: `WZ${uniqueSuffix.slice(-2)}`,
        name: newMeta.displayName,
        instanceName: finalInstanceName,
        phone: novoTelefone ? maskPhone(novoTelefone) : 'Aguardando pareamento',
        department: newMeta.department,
        status: 'aguardando',
        battery: 'Desconhecido',
        device: 'WhatsApp Baileys',
        lastActivity: 'Agora',
        messagesSentToday: 0
      };

      if (res.qrcode) {
        setQrModalInstance(novaInstanciaUi);
        setQrCodeData(res.qrcode);
        setQrConnectedSuccess(false);
        setQrLoading(false);
        setTempoRestanteQr(45);
      } else {
        handleAbrirQrCodeModal(novaInstanciaUi);
      }
    } catch (err: any) {
      console.error('Falha ao salvar nova conexão:', err);
      alert('Erro inesperado ao criar conexão no servidor.');
    } finally {
      setCriandoInstancia(false);
    }
  };

  // Salvar Edição de Metadados da Instância
  const handleSaveEditInstance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstance) return;

    evolutionApiService.saveLocalMetadata(currentHotel.id, {
      instanceName: editInstance.instanceName,
      displayName: editInstance.name,
      department: editInstance.department,
      hotelId: currentHotel.id,
      phone: editInstance.phone,
      createdAt: new Date().toISOString()
    });

    setInstances((prev) =>
      prev.map((inst) => (inst.instanceName === editInstance.instanceName ? editInstance : inst))
    );

    showToast(`Instância "${editInstance.name}" atualizada com sucesso!`);
    setEditInstance(null);
  };

  // Excluir Instância na Evolution API
  const handleDeleteInstance = async () => {
    if (!deleteConfirmInstance || excluindoInstancia) return;

    setExcluindoInstancia(true);
    try {
      const res = await evolutionApiService.deleteInstance(deleteConfirmInstance.instanceName);
      if (!res.success) {
        alert(res.message || 'Falha ao excluir instância na Evolution API.');
        setExcluindoInstancia(false);
        return;
      }

      evolutionApiService.removeLocalMetadata(currentHotel.id, deleteConfirmInstance.instanceName);
      setInstances((prev) => prev.filter((i) => i.instanceName !== deleteConfirmInstance.instanceName));
      showToast(`Conexão "${deleteConfirmInstance.name}" excluída permanentemente.`);
      setDeleteConfirmInstance(null);
    } catch (err: any) {
      alert('Erro ao excluir instância do servidor.');
    } finally {
      setExcluindoInstancia(false);
    }
  };

  // Sincronizar / Checar Status Individual
  const handleSyncInstance = async (inst: WhatsappInstance) => {
    showToast(`Sincronizando status da instância "${inst.name}"...`);
    try {
      const state = await evolutionApiService.getConnectionState(inst.instanceName);
      let newStatus: 'conectado' | 'desconectado' | 'aguardando' = 'aguardando';
      if (state === 'open') newStatus = 'conectado';
      else if (state === 'close') newStatus = 'desconectado';

      setInstances((prev) =>
        prev.map((i) =>
          i.instanceName === inst.instanceName ? { ...i, status: newStatus } : i
        )
      );

      showToast(
        newStatus === 'conectado'
          ? `Status da instância "${inst.name}": 100% Online e Conectada!`
          : `Status da instância "${inst.name}": ${newStatus === 'aguardando' ? 'Aguardando Leitura de QR' : 'Desconectada'}.`
      );
    } catch {
      showToast(`Não foi possível atualizar o status de "${inst.name}".`);
    }
  };

  // Reiniciar Socket da Instância
  const handleRestartInstance = async (inst: WhatsappInstance) => {
    showToast(`Reiniciando conexão de "${inst.name}"...`);
    try {
      const res = await evolutionApiService.restartInstance(inst.instanceName);
      if (res.success) {
        showToast(`Instância "${inst.name}" reiniciada com sucesso!`);
        carregarInstancias(true);
      } else {
        showToast(res.message || 'Falha ao reiniciar.');
      }
    } catch {
      showToast('Erro ao enviar comando de reinício.');
    }
  };

  // Desconectar (Logout)
  const handleLogoutInstance = async (inst: WhatsappInstance) => {
    if (!confirm(`Deseja desconectar a sessão do WhatsApp da instância "${inst.name}"?`)) return;

    showToast(`Desconectando "${inst.name}"...`);
    try {
      await evolutionApiService.logoutInstance(inst.instanceName);
      setInstances((prev) =>
        prev.map((i) => (i.instanceName === inst.instanceName ? { ...i, status: 'desconectado' } : i))
      );
      showToast(`Instância "${inst.name}" desconectada.`);
    } catch {
      showToast('Erro ao desconectar instância.');
    }
  };

  // Filtros
  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      const matchesSearch =
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.instanceName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'conectado' && inst.status === 'conectado') ||
        (statusFilter === 'desconectado' && inst.status === 'desconectado') ||
        (statusFilter === 'aguardando' && inst.status === 'aguardando');

      const matchesDept = departmentFilter === 'todos' || inst.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [instances, searchQuery, statusFilter, departmentFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, departmentFilter]);

  const totalPages = Math.ceil(filteredInstances.length / itemsPerPage) || 1;
  const paginatedInstances = filteredInstances.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Métricas dos Cards
  const totalInstances = instances.length;
  const connectedCount = instances.filter((i) => i.status === 'conectado').length;
  const waitingQrCount = instances.filter((i) => i.status === 'aguardando').length;
  const totalMessagesToday = instances.reduce((acc, curr) => acc + curr.messagesSentToday, 0);

  const departments = useMemo(() => {
    return Array.from(new Set(instances.map((i) => i.department)));
  }, [instances]);

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 font-sans">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm">
            <span className="material-symbols-outlined text-emerald-800 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* CABEÇALHO & NAVEGAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              Conexões do WhatsApp
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gerencie instâncias ativas do WhatsApp, números conectados, leitura de QR Code e automações para {currentHotel.name}.
          </p>
        </div>

        {/* BOTÕES DE AÇÃO SUPERIORES */}
        {activeSubTab === 'instancias' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (instances.length > 0) {
                  const target = instances.find((i) => i.status === 'aguardando') || instances[0];
                  handleAbrirQrCodeModal(target);
                } else if (hotelPlanInfo.canCreateMore) {
                  setIsNovaConexaoOpen(true);
                } else {
                  setIsUpgradeModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#10B981] hover:bg-emerald-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
              <span>Escanear QR Code</span>
            </button>

            {hotelPlanInfo.canCreateMore ? (
              <button
                onClick={() => setIsNovaConexaoOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#003400] hover:bg-[#002500] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                <span>Nova Conexão</span>
              </button>
            ) : (
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                title="Limite de instâncias do seu plano atingido. Clique para ver opções de upgrade."
              >
                <span className="material-symbols-outlined text-xl">lock</span>
                <span>{hotelPlanInfo.maxInstances === 0 ? 'Sem Conexão no Plano Grátis' : `Limite do Plano (${hotelPlanInfo.currentCount}/${hotelPlanInfo.maxInstances})`}</span>
              </button>
            )}
          </div>
        ) : activeSubTab === 'atendimentos' ? (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={carregarMensagensDoServidor}
              disabled={carregandoChat}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#003400] hover:bg-[#002500] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-lg ${carregandoChat ? 'animate-spin' : ''}`}>sync</span>
              <span>{carregandoChat ? 'Sincronizando...' : 'Atualizar Mensagens'}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleRestaurarPadroes}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-lg">restart_alt</span>
              <span className="whitespace-nowrap">Restaurar Padrão</span>
            </button>
            <button
              type="button"
              onClick={handleSalvarTemplates}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${
                templateSalvoStatus
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#003400] hover:bg-[#002500] text-white'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {templateSalvoStatus ? 'check_circle' : 'save'}
              </span>
              <span className="whitespace-nowrap">{templateSalvoStatus ? 'Salvo!' : 'Salvar Templates'}</span>
            </button>
          </div>
        )}
      </div>

      {/* SELETOR DE ABAS PRINCIPAIS: INSTÂNCIAS VS ATENDIMENTOS VS TEMPLATES */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('instancias')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'instancias'
              ? 'bg-[#003400] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">devices</span>
          <span>Conexões</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeSubTab === 'instancias'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {instances.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('atendimentos');
            carregarMensagensDoServidor();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'atendimentos'
              ? 'bg-[#003400] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">forum</span>
          <span>Mensagens & Atendimentos</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeSubTab === 'atendimentos'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {conversasAgrupadas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
            activeSubTab === 'templates'
              ? 'bg-[#003400] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span className="material-symbols-outlined text-base">chat_bubble</span>
          <span>Templates & Automações</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeSubTab === 'templates'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            4 Modelos
          </span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: INSTÂNCIAS & CONEXÕES */}
      {activeSubTab === 'instancias' && (
        <>
          {/* BANNER DE REGRAS E CONSUMO DO PLANO */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          !hotelPlanInfo.canCreateMore
            ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-start md:items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              !hotelPlanInfo.canCreateMore ? 'bg-amber-500 text-white' : 'bg-[#003400] text-white'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              {!hotelPlanInfo.canCreateMore ? 'lock' : 'verified_user'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm text-slate-900">
                Plano do Hotel: <span className="text-emerald-800 font-black">{hotelPlanInfo.planName}</span>
              </span>
              <span
                className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  !hotelPlanInfo.canCreateMore
                    ? 'bg-amber-200 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {!hotelPlanInfo.canCreateMore ? 'Limite Atingido' : 'Conexão Disponível'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {!hotelPlanInfo.canCreateMore ? (
                <>
                  Seu plano permite no máximo <strong>{hotelPlanInfo.maxInstances} conexão(ões) de WhatsApp</strong> simultânea(s). Todas as vagas já estão ocupadas. Para conectar novos setores (ex: Reservas, Recepção, Governança), faça o upgrade do plano.
                </>
              ) : (
                <>
                  Uso de conexões: <strong>{hotelPlanInfo.currentCount} de {hotelPlanInfo.maxInstances}</strong> em uso ({hotelPlanInfo.maxInstances - hotelPlanInfo.currentCount} vaga restante no plano).
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 shadow-2xs"
          >
            <span className="material-symbols-outlined text-base text-amber-600">workspace_premium</span>
            <span>Regras & Upgrade</span>
          </button>
        </div>
      </div>

      {/* PAINEL KPIS BENTO GRID (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Instâncias / Limite do Plano */}
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Instâncias em Uso
            </p>
            <h3 className="text-2xl font-black text-emerald-950 mt-1">
              {hotelPlanInfo.currentCount}{' '}
              <span className="text-sm font-semibold text-emerald-700">
                / {hotelPlanInfo.maxInstances} permitida{hotelPlanInfo.maxInstances > 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              {hotelPlanInfo.canCreateMore
                ? `${hotelPlanInfo.maxInstances - hotelPlanInfo.currentCount} vaga(s) disponível(is)`
                : 'Capacidade do plano esgotada'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">devices</span>
          </div>
        </div>

        {/* Card 2: Conectadas / Online */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              Conectadas / Online
            </p>
            <h3 className="text-2xl font-black text-blue-950 mt-1">{connectedCount}</h3>
            <p className="text-xs text-blue-700 mt-0.5">
              {connectedCount > 0 ? 'Sincronização 100% ativa' : 'Nenhuma conexão ativa'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">wifi</span>
          </div>
        </div>

        {/* Card 3: Aguardando QR Code */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Aguardando QR Code
            </p>
            <h3 className="text-2xl font-black text-amber-950 mt-1">{waitingQrCount}</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              {waitingQrCount > 0 ? 'Requer leitura no celular' : 'Nenhuma pendente'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">pending</span>
          </div>
        </div>

        {/* Card 4: Mensagens Registradas */}
        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Mensagens Registradas
            </p>
            <h3 className="text-2xl font-black text-purple-950 mt-1">
              {totalMessagesToday.toLocaleString('pt-BR')}
            </h3>
            <p className="text-xs text-purple-700 mt-0.5">
              {totalMessagesToday > 0 ? 'Histórico no servidor' : 'Nenhuma mensagem enviada'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">chat</span>
          </div>
        </div>
      </div>

      {/* FILTROS, BUSCA & ALTERNADOR LISTA/GRADE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Busca e Selects */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por nome, número ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="conectado">Conectado</option>
              <option value="desconectado">Desconectado</option>
              <option value="aguardando">Aguardando Leitura</option>
            </select>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
            >
              <option value="todos">Todos os Departamentos</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle & Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Lista"
            >
              <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#003400] text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Grade"
            >
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
            </button>
          </div>

          <button
            onClick={() => carregarInstancias(true)}
            disabled={atualizandoStatus}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-100 transition cursor-pointer disabled:opacity-60"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                atualizandoStatus ? 'animate-spin text-emerald-700' : ''
              }`}
            >
              refresh
            </span>
            <span>{atualizandoStatus ? 'Sincronizando...' : 'Atualizar Status'}</span>
          </button>
        </div>
      </div>

      {/* EXIBIÇÃO DE INSTÂNCIAS (MODO LISTA / MODO GRADE) */}
      {carregando ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mb-4" />
          <h3 className="text-sm font-bold text-slate-800">Conectando à Evolution API...</h3>
          <p className="text-xs text-slate-500 mt-1">Carregando instâncias e status em tempo real.</p>
        </div>
      ) : filteredInstances.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-4xl">devices_off</span>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Nenhuma instância encontrada</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-4">
            Cadastre uma nova conexão para vincular o WhatsApp da recepção ou reservas do hotel.
          </p>
          <button
            onClick={() => setIsNovaConexaoOpen(true)}
            className="px-5 py-2.5 bg-[#003400] hover:bg-[#002500] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Cadastrar Primeira Conexão</span>
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* MODO LISTA / TABELA */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Instância / Identificação</th>
                  <th className="py-3.5 px-4">Número WhatsApp</th>
                  <th className="py-3.5 px-4">Departamento</th>
                  <th className="py-3.5 px-4">Status Conexão</th>
                  <th className="py-3.5 px-4">Dispositivo</th>
                  <th className="py-3.5 px-4">Última Atividade</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedInstances.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4 font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        {inst.profilePicUrl ? (
                          <img
                            src={inst.profilePicUrl}
                            alt={inst.name}
                            className="w-10 h-10 rounded-xl object-cover border border-emerald-200 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                              inst.status === 'conectado'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {inst.code}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-slate-900 block">{inst.name}</span>
                          <p className="text-[11px] text-slate-400 font-mono">
                            API: <span className="font-semibold text-slate-600">{inst.instanceName}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-700 font-mono text-xs font-semibold">
                      {inst.phone}
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-medium">{inst.department}</td>
                    <td className="py-4 px-4">
                      {inst.status === 'conectado' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                          Conectado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAbrirQrCodeModal(inst)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                          <span>Aguardando QR Code</span>
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span
                          className={`material-symbols-outlined text-[16px] ${
                            inst.status === 'conectado' ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          {inst.status === 'conectado' ? 'smartphone' : 'qr_code'}
                        </span>
                        <span>{inst.device}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-xs">{inst.lastActivity}</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedLogsInstance(inst)}
                          className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs cursor-pointer"
                          title="Ver Detalhes / Logs"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>

                        <button
                          onClick={() => handleAbrirQrCodeModal(inst)}
                          className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer"
                          title={inst.status === 'conectado' ? 'Ver Conexão QR Code' : 'Ler QR Code'}
                        >
                          <span className="material-symbols-outlined text-[18px]">qr_code</span>
                        </button>

                        <button
                          onClick={() => setEditInstance(inst)}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer"
                          title="Editar Nome / Departamento"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        <button
                          onClick={() => handleSyncInstance(inst)}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
                          title="Sincronizar Status"
                        >
                          <span className="material-symbols-outlined text-[18px]">sync</span>
                        </button>

                        {inst.status === 'conectado' && (
                          <button
                            onClick={() => handleLogoutInstance(inst)}
                            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs cursor-pointer"
                            title="Desconectar WhatsApp"
                          >
                            <span className="material-symbols-outlined text-[18px]">logout</span>
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteConfirmInstance(inst)}
                          className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-xs cursor-pointer"
                          title="Excluir Conexão"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer de Paginação */}
          <div className="bg-slate-50 px-4 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              Exibindo{' '}
              <span className="font-semibold text-slate-700">
                {(currentPage - 1) * itemsPerPage + 1} a{' '}
                {Math.min(currentPage * itemsPerPage, filteredInstances.length)}
              </span>{' '}
              de <span className="font-semibold text-slate-700">{filteredInstances.length}</span>{' '}
              instâncias ativas
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer font-medium"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 border font-semibold rounded-md transition-all cursor-pointer ${
                    currentPage === page
                      ? 'border-[#003400] bg-[#003400] text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer font-medium"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* MODO GRADE / CARDS */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedInstances.map((inst) => (
              <div
                key={inst.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {inst.profilePicUrl ? (
                      <img
                        src={inst.profilePicUrl}
                        alt={inst.name}
                        className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shadow-xs shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base shadow-xs shrink-0 ${
                          inst.status === 'conectado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inst.code}
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                        {inst.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        API: <span className="font-semibold text-slate-600">{inst.instanceName}</span>
                      </p>
                    </div>
                  </div>

                  {inst.status === 'conectado' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                      Conectado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAbrirQrCodeModal(inst)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                      Aguardando QR Code
                    </button>
                  )}
                </div>

                {/* Detalhes da Conexão */}
                <div className="space-y-2.5 py-3 border-y border-slate-100 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">
                        call
                      </span>
                      <span>Número WhatsApp:</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800">{inst.phone}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">
                        apartment
                      </span>
                      <span>Departamento:</span>
                    </span>
                    <span className="text-xs font-bold text-slate-700">{inst.department}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <span
                        className={`material-symbols-outlined text-[16px] ${
                          inst.status === 'conectado' ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {inst.status === 'conectado' ? 'smartphone' : 'qr_code'}
                      </span>
                      <span>Dispositivo:</span>
                    </span>
                    <span className="text-xs text-slate-700 font-medium">{inst.device}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">
                        schedule
                      </span>
                      <span>Última Atividade:</span>
                    </span>
                    <span className="text-xs text-slate-500">{inst.lastActivity}</span>
                  </div>
                </div>

                {/* Ações Rodapé do Card */}
                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedLogsInstance(inst)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                      title="Ver Detalhes / Logs"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      <span>Ver Logs</span>
                    </button>

                    <button
                      onClick={() => handleAbrirQrCodeModal(inst)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                      title={inst.status === 'conectado' ? 'Ver Conexão QR Code' : 'Ler QR Code'}
                    >
                      <span className="material-symbols-outlined text-[16px]">qr_code</span>
                      <span>{inst.status === 'conectado' ? 'Ver Conexão' : 'Ler QR'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditInstance(inst)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Editar Nome / Departamento"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>

                    <button
                      onClick={() => handleSyncInstance(inst)}
                      className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition cursor-pointer"
                      title="Sincronizar Status"
                    >
                      <span className="material-symbols-outlined text-[18px]">sync</span>
                    </button>

                    {inst.status === 'conectado' && (
                      <button
                        onClick={() => handleLogoutInstance(inst)}
                        className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition cursor-pointer"
                        title="Desconectar Sessão WhatsApp"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteConfirmInstance(inst)}
                      className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition cursor-pointer"
                      title="Excluir Conexão"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação Modo Grade */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              Exibindo{' '}
              <span className="font-semibold text-slate-700">
                {(currentPage - 1) * itemsPerPage + 1} a{' '}
                {Math.min(currentPage * itemsPerPage, filteredInstances.length)}
              </span>{' '}
              de <span className="font-semibold text-slate-700">{filteredInstances.length}</span>{' '}
              instâncias ativas
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer font-medium"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 border font-semibold rounded-md transition-all cursor-pointer ${
                    currentPage === page
                      ? 'border-[#003400] bg-[#003400] text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer font-medium"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* CONTEÚDO DA ABA 2: TEMPLATES DE MENSAGENS WHATSAPP */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* BANNER DE STATUS DA INSTÂNCIA VINCULADA AO HOTEL */}
          <div
            className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
              instanciaOnlineDoHotel
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs'
                : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
            }`}
          >
            <div className="flex items-start md:items-center gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  instanciaOnlineDoHotel ? 'bg-[#003400] text-white' : 'bg-amber-500 text-white'
                }`}
              >
                <span className="material-symbols-outlined text-2xl">
                  {instanciaOnlineDoHotel ? 'mark_chat_read' : 'cell_tower'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">
                    {instanciaOnlineDoHotel
                      ? `Instância Vinculada: ${instanciaOnlineDoHotel.name}`
                      : 'Nenhuma Instância de WhatsApp Conectada'}
                  </span>
                  <span
                    className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      instanciaOnlineDoHotel
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-200 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {instanciaOnlineDoHotel ? '● 100% Online & Pronta' : 'Aguardando Conexão'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {instanciaOnlineDoHotel ? (
                    <>
                      Os disparos automáticos e interações de reservas serão enviados através do número{' '}
                      <strong>{instanciaOnlineDoHotel.phone || instanciaOnlineDoHotel.instanceName}</strong> ({instanciaOnlineDoHotel.department}).
                    </>
                  ) : (
                    <>
                      Para disparos automáticos em tempo real, conecte sua instância na aba "Conexões". Enquanto desconectada, você ainda poderá enviar com 1 clique pelo WhatsApp Web.
                    </>
                  )}
                </p>
              </div>
            </div>

            {!instanciaOnlineDoHotel && (
              <button
                type="button"
                onClick={() => setActiveSubTab('instancias')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer self-end md:self-auto shrink-0 shadow-xs"
              >
                <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                <span>Conectar Instância Agora</span>
              </button>
            )}
          </div>

          {/* PAINEL DE AUTOMAÇÕES OPERACIONAIS & HORÁRIO DA REGIÃO */}
          <div className="bg-white rounded-3xl p-5 sm:p-7 text-slate-900 shadow-sm border border-slate-200/90 space-y-6">
            {/* CABEÇALHO DO PAINEL */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-2xl">auto_mode</span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg font-black tracking-tight text-slate-900">
                      Fuso Horário Operacional & Integração
                    </h3>
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                        instanciaOnlineDoHotel
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-extrabold shadow-2xs'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          instanciaOnlineDoHotel ? 'bg-emerald-700 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      {instanciaOnlineDoHotel
                        ? `Conexão Ativa: ${instanciaOnlineDoHotel.instanceName}`
                        : 'WhatsApp Desconectado'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    Configure a região e o fuso horário oficial do hotel para sincronização das reservas e integração operacional.
                  </p>
                </div>
              </div>

              {/* RELÓGIO AO VIVO */}
              <div className="flex items-center gap-3 self-start lg:self-center bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 shrink-0">
                <span className="material-symbols-outlined text-emerald-700 text-xl animate-pulse">
                  schedule
                </span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block leading-tight">
                    Horário no Hotel ({hotelAutomacoes.fuso_horario === 'America/Cuiaba' ? 'Cuiabá GMT-4' : 'Brasília GMT-3'})
                  </span>
                  <span className="text-base font-black font-mono text-emerald-800 tracking-wider">
                    {currentTimeStr || '--:--:--'}
                  </span>
                </div>
              </div>
            </div>

            {/* SELETOR DE HORÁRIO DA REGIÃO DO HOTEL */}
            <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-amber-600">schedule</span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Fuso Horário Operacional do Hotel
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Como Mato Grosso possui dois fusos oficiais, escolha a região exata do hotel para os horários dos lembretes baterem perfeitamente com a rotina dos hóspedes.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Opção 1: Cuiabá / Mato Grosso (GMT-4) */}
                <button
                  type="button"
                  onClick={() => handleUpdateAutomacao('fuso_horario', 'America/Cuiaba')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    hotelAutomacoes.fuso_horario === 'America/Cuiaba'
                      ? 'bg-emerald-50/80 border-emerald-600 text-slate-900 shadow-xs ring-2 ring-emerald-600/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        hotelAutomacoes.fuso_horario === 'America/Cuiaba'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      MT -4
                    </div>
                    <div>
                      <span className="font-extrabold text-xs sm:text-sm block text-slate-900">
                        Horário de Cuiabá / MT (GMT-4)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Cuiabá, Rondonópolis, Sinop, Cáceres e maior parte do MT
                      </span>
                    </div>
                  </div>
                  {hotelAutomacoes.fuso_horario === 'America/Cuiaba' && (
                    <span className="material-symbols-outlined text-emerald-700 text-xl shrink-0">
                      check_circle
                    </span>
                  )}
                </button>

                {/* Opção 2: Brasília / São Paulo (GMT-3) */}
                <button
                  type="button"
                  onClick={() => handleUpdateAutomacao('fuso_horario', 'America/Sao_Paulo')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    hotelAutomacoes.fuso_horario === 'America/Sao_Paulo'
                      ? 'bg-emerald-50/80 border-emerald-600 text-slate-900 shadow-xs ring-2 ring-emerald-600/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        hotelAutomacoes.fuso_horario === 'America/Sao_Paulo'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      BR -3
                    </div>
                    <div>
                      <span className="font-extrabold text-xs sm:text-sm block text-slate-900">
                        Horário de Brasília / São Paulo (GMT-3)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Barra do Garças, Araguaia e padrão de Brasília / SP
                      </span>
                    </div>
                  </div>
                  {hotelAutomacoes.fuso_horario === 'America/Sao_Paulo' && (
                    <span className="material-symbols-outlined text-emerald-700 text-xl shrink-0">
                      check_circle
                    </span>
                  )}
                </button>
              </div>

              {/* GATILHOS DE DISPARO AUTOMÁTICO DO HOTEL */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-700 text-base">bolt</span>
                      <span>Automações de Disparo pelo WhatsApp</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ative ou desative quais mensagens o sistema dispara automaticamente através da instância conectada.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Boas-Vindas & Início de Atendimento */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">waving_hand</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          Boas-Vindas / Início de Atendimento
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Ao receber mensagem ou cadastrar hóspede
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={hotelAutomacoes.auto_boas_vindas}
                        onChange={(e) => handleUpdateAutomacao('auto_boas_vindas', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* 2. Confirmação de Reserva */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">task_alt</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          Confirmação de Reserva
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Ao confirmar ou aprovar reserva no sistema
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={hotelAutomacoes.auto_confirmacao}
                        onChange={(e) => handleUpdateAutomacao('auto_confirmacao', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* 3. Lembrete de Check-in */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">alarm</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          Lembrete de Check-in
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          24 horas antes do horário de entrada
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={hotelAutomacoes.auto_lembrete_checkin}
                        onChange={(e) => handleUpdateAutomacao('auto_lembrete_checkin', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {/* 4. Pós Check-out & Avaliação */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-base">star</span>
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          Pós Check-out & Avaliação
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Ao realizar check-out na recepção
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={hotelAutomacoes.auto_checkout}
                        onChange={(e) => handleUpdateAutomacao('auto_checkout', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>



            {/* RODAPÉ DO PAINEL COM CONFIGURAÇÃO AVANÇADA (EXCLUSIVO PARA ADMINISTRADOR) */}
            {isAdmin && (
              <div className="flex items-center justify-end pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setShowConfigAvancada(!showConfigAvancada)}
                  className="text-slate-500 hover:text-slate-900 font-semibold transition cursor-pointer flex items-center gap-1.5 text-[11px]"
                  title="Configuração técnica do webhook (Apenas Administrador)"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  <span>{showConfigAvancada ? 'Ocultar Opções Avançadas' : 'Configurações Avançadas'}</span>
                </button>
              </div>
            )}

            {/* SEÇÃO AVANÇADA (EXPANSÍVEL - EXCLUSIVO PARA ADMINISTRADOR) */}
            {isAdmin && showConfigAvancada && (
              <div className="pt-3 border-t border-slate-200 flex flex-col gap-2 animate-in fade-in duration-200">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  URL do Webhook de Eventos do WhatsApp:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      showToast('URL copiada para a área de transferência!');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-300 shrink-0 flex items-center gap-1 whitespace-nowrap"
                    title="Copiar URL"
                  >
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                    <span>Copiar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* GRID PRINCIPAL: EDITOR (7 COLS) + PRÉ-VISUALIZAÇÃO WHATSAPP & TESTE (5 COLS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* COLUNA ESQUERDA: EDITOR DE TEMPLATES (7 COLS) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Personalização de Mensagens do Hotel
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecione o modelo operacional que deseja personalizar para {currentHotel.name}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 self-start sm:self-auto">
                  {TEMPLATE_METADATA[selectedTemplateType].badge}
                </span>
              </div>

              {/* SELEÇÃO DOS 4 MODELOS DE TEMPLATE (SEM PIX POR ENQUANTO) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    'boas_vindas',
                    'confirmacao',
                    'lembrete_checkin',
                    'checkout'
                  ] as Array<'boas_vindas' | 'confirmacao' | 'lembrete_checkin' | 'checkout'>
                ).map((key) => {
                  const meta = TEMPLATE_METADATA[key];
                  const isSelected = selectedTemplateType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateType(key);
                        setTesteFeedback(null);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-[#003400] bg-emerald-50/70 ring-2 ring-[#003400]/20 shadow-xs'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#003400] text-white'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-black truncate ${
                            isSelected ? 'text-[#003400]' : 'text-slate-800'
                          }`}
                        >
                          {meta.label}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {meta.gatilho}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* CARD EXPLICATIVO DO GATILHO SELECIONADO */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-base text-emerald-700 shrink-0 mt-0.5">
                  info
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">
                    Gatilho de Envio:{' '}
                    <span className="text-emerald-800">
                      {TEMPLATE_METADATA[selectedTemplateType].gatilho}
                    </span>
                  </span>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    {TEMPLATE_METADATA[selectedTemplateType].desc}
                  </p>
                </div>
              </div>

              {/* INSERÇÃO DE TAGS DINÂMICAS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Tags Dinâmicas (Clique para Inserir no Texto):
                  </span>
                  <span className="text-[10px] text-slate-400">Inserido na posição do cursor</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: '{link_hotel}', label: 'Link do Hotel / Reservas' },
                    { tag: '{nome_hospede}', label: 'Nome Hóspede' },
                    { tag: '{nome_hotel}', label: 'Nome Hotel' },
                    { tag: '{numero_quarto}', label: 'Nº Quarto' },
                    { tag: '{tipo_quarto}', label: 'Tipo Quarto' },
                    { tag: '{checkin}', label: 'Data Check-in' },
                    { tag: '{checkout}', label: 'Data Check-out' },
                    { tag: '{valor_total}', label: 'Valor Total' }
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInserirTag(item.tag)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-950 border border-slate-200 text-slate-700 font-mono text-[11px] font-semibold transition cursor-pointer active:scale-95"
                      title={`Inserir ${item.tag} no texto`}
                    >
                      <span className="text-emerald-700 font-bold">+</span>
                      <span>{item.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* TEXTAREA DO TEMPLATE */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Conteúdo da Mensagem WhatsApp
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {(hotelTemplates[selectedTemplateType] || '').length} caracteres
                  </span>
                </div>
                <textarea
                  ref={textareaTemplateRef}
                  rows={8}
                  value={hotelTemplates[selectedTemplateType] || ''}
                  onChange={(e) =>
                    setHotelTemplates({
                      ...hotelTemplates,
                      [selectedTemplateType]: e.target.value
                    })
                  }
                  placeholder="Digite o modelo de mensagem..."
                  className="w-full p-4 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] font-sans leading-relaxed text-slate-800"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">format_quote</span>
                  <span>
                    Dica: Você pode usar a formatação nativa do WhatsApp: <strong>*negrito*</strong>,{' '}
                    <em>_itálico_</em> e ~tachado~, além de emojis.
                  </span>
                </p>
              </div>

              {/* BOTÕES DE AÇÃO INFERIORES DO EDITOR */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleRestaurarPadroes}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  <span>Restaurar Padrão da Plataforma</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSalvarTemplates}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl transition cursor-pointer shadow-xs active:scale-95 whitespace-nowrap shrink-0 ${
                      templateSalvoStatus
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#003400] hover:bg-[#002500] text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {templateSalvoStatus ? 'check_circle' : 'save'}
                    </span>
                    <span>
                      {templateSalvoStatus
                        ? 'Salvo com Sucesso!'
                        : `Salvar Templates de ${currentHotel.name}`}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: PRÉ-VISUALIZAÇÃO AO VIVO & DISPARO DE TESTE (5 COLS) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* CARD CHAT WHATSAPP PREVIEW */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700">smartphone</span>
                    <h4 className="text-sm font-bold text-slate-900">
                      Pré-visualização no WhatsApp do Hóspede
                    </h4>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Ao Vivo
                  </span>
                </div>

                {/* DISPOSITIVO / TELA WHATSAPP */}
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex flex-col">
                  {/* WhatsApp Top Bar */}
                  <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-sm opacity-80">arrow_back</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#075E54] font-black text-xs flex items-center justify-center border border-white/20">
                        {currentHotel.name ? currentHotel.name.charAt(0).toUpperCase() : 'H'}
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight truncate max-w-[170px]">
                          {currentHotel.name || 'Hotel Recanto Verde'}
                        </div>
                        <div className="text-[10px] text-emerald-200 flex items-center gap-1 leading-none mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          <span>online</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <span className="material-symbols-outlined text-sm">videocam</span>
                      <span className="material-symbols-outlined text-sm">call</span>
                      <span className="material-symbols-outlined text-sm">more_vert</span>
                    </div>
                  </div>

                  {/* Fundo do Chat WhatsApp */}
                  <div className="bg-[#EFEAE2] p-4 flex flex-col justify-end min-h-[300px] relative">
                    {/* Balão de Mensagem */}
                    <div className="bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-xs max-w-[95%] self-start relative text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border border-slate-100">
                      <p>{textoPrevisualizacao}</p>
                      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-slate-400 font-mono">
                        <span>
                          {new Date().toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className="text-blue-500 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 text-center mt-3">
                  As tags dinâmicas são preenchidas com os dados de exemplo acima para você validar o visual antes do envio real.
                </p>
              </div>

              {/* CARD DE TESTE DE DISPARO */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="material-symbols-outlined text-emerald-700">send</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Testar Envio Deste Modelo
                  </h4>
                </div>

                <p className="text-xs text-slate-500">
                  Envie uma mensagem de demonstração deste template para o seu próprio WhatsApp para conferir a formatação.
                </p>

                {testeFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      testeFeedback.tipo === 'sucesso'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-red-50 text-red-900 border border-red-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                      {testeFeedback.tipo === 'sucesso' ? 'check_circle' : 'error'}
                    </span>
                    <span>{testeFeedback.texto}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Número do WhatsApp com DDD:
                    </label>
                    <input
                      type="text"
                      value={testSendPhone}
                      onChange={(e) => setTestSendPhone(maskPhone(e.target.value))}
                      placeholder="(65) 99999-9999"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleEnviarTeste}
                      disabled={enviandoTeste || !testSendPhone.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#003400] hover:bg-[#002500] text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      {enviandoTeste ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Disparando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">send</span>
                          <span>Enviar via API</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleAbrirTesteWeb}
                      disabled={!testSendPhone.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      <span>Abrir no Web</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: MENSAGENS & ATENDIMENTOS EM TEMPO REAL */}
      {activeSubTab === 'atendimentos' && (
        <div className="space-y-6">
          {/* BANNER DE INFORMAÇÕES DA INSTÂNCIA CONECTADA */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">forum</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Mensagens & Atendimentos do WhatsApp
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    <span>Em Tempo Real</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conexão ativa: <strong>{instanciaOnlineDoHotel?.name || 'meutim'}</strong> ({instanciaOnlineDoHotel?.phone || '55 66 8158-5014'}). Acompanhe os contatos, início de atendimento e envie mensagens diretas pelo WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={carregarMensagensDoServidor}
                disabled={carregandoChat}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-base ${carregandoChat ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>{carregandoChat ? 'Sincronizando...' : 'Atualizar Conversas'}</span>
              </button>
            </div>
          </div>

          {/* GRID PRINCIPAL: LISTA DE CONTATOS (4 COLS) + CONVERSA SELECIONADA (8 COLS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]">
            {/* COLUNA ESQUERDA: LISTA DE CONVERSAS (4 COLS) */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
              {/* Header da lista de conversas */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-emerald-700 text-base">chat</span>
                    <span>Conversas ({conversasAgrupadas.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Mais recentes</span>
                </div>

                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar contato ou número..."
                    value={filtroBuscaChat}
                    onChange={(e) => setFiltroBuscaChat(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                  />
                </div>
              </div>

              {/* Lista de Contatos */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[500px]">
                {carregandoChat && conversasAgrupadas.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <span className="w-6 h-6 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                    <span className="text-xs">Carregando conversas do WhatsApp...</span>
                  </div>
                ) : conversasAgrupadas.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-slate-300">chat_error</span>
                    <p className="text-xs font-semibold text-slate-600">Nenhuma conversa registrada ainda</p>
                    <p className="text-[11px] text-slate-400">
                      As mensagens enviadas por hóspedes ou respostas do robô aparecerão aqui automaticamente.
                    </p>
                  </div>
                ) : (
                  conversasAgrupadas
                    .filter((c) => {
                      if (!filtroBuscaChat.trim()) return true;
                      const q = filtroBuscaChat.toLowerCase();
                      return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                    })
                    .map((conv) => {
                      const isSelected = conversaAtiva?.phone === conv.phone;
                      const initial = conv.name ? conv.name.charAt(0).toUpperCase() : 'W';
                      return (
                        <button
                          key={conv.phone}
                          type="button"
                          onClick={() => setContatoSelecionadoTelefone(conv.phone)}
                          className={`w-full p-3.5 flex items-start gap-3 text-left transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/80 border-l-4 border-l-emerald-700'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-[#003400] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {conv.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {conv.lastTimeStr}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono block truncate mb-1">
                              {conv.displayPhone}
                            </span>
                            <p className="text-[11px] text-slate-600 truncate line-clamp-1 leading-snug">
                              {conv.lastMessage}
                            </p>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* COLUNA DIREITA: VISUALIZAÇÃO DA CONVERSA SELECIONADA (8 COLS) */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
              {conversaAtiva ? (
                <>
                  {/* Top Bar da conversa ativa */}
                  <div className="bg-[#075E54] text-white p-3.5 sm:px-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 text-white font-black text-sm flex items-center justify-center border border-white/30">
                        {conversaAtiva.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm leading-tight">{conversaAtiva.name}</h4>
                        <div className="text-[11px] text-emerald-200 flex items-center gap-2 mt-0.5 font-mono">
                          <span>{conversaAtiva.displayPhone}</span>
                          <span>•</span>
                          <span className="text-white font-bold">{conversaAtiva.messages.length} mensagen{conversaAtiva.messages.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${conversaAtiva.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition shadow-xs"
                        title="Abrir no WhatsApp Web / App"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span className="hidden sm:inline">WhatsApp Web</span>
                      </a>
                    </div>
                  </div>

                  {/* Fundo do Chat com mensagens em estilo WhatsApp */}
                  <div
                    ref={chatScrollRef}
                    className="flex-1 p-4 bg-[#EFEAE2] overflow-y-auto space-y-3 min-h-[380px] max-h-[460px] scroll-smooth"
                  >
                    <div className="text-center my-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 bg-white/80 text-slate-500 rounded-full shadow-2xs">
                        Conversa via WhatsApp Oficial
                      </span>
                    </div>

                    {conversaAtiva.messages.map((m) => {
                      if (m.fromMe) {
                        return (
                          <div key={m.id} className="flex justify-end">
                            <div className="bg-[#d9fdd3] rounded-2xl rounded-tr-xs px-4 py-2.5 max-w-[85%] sm:max-w-[75%] shadow-xs border border-emerald-200/60 text-slate-900 text-xs sm:text-sm">
                              <div className="font-semibold text-emerald-950 text-[11px] mb-0.5 flex items-center justify-between gap-3">
                                <span>{currentHotel.name || 'Hotel'}</span>
                                <span className="text-[9px] uppercase px-1.5 py-0.5 bg-emerald-700/10 text-emerald-900 rounded font-black tracking-wider">
                                  Robô / Recepção
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                              <div className="text-[10px] text-slate-500 text-right mt-1 flex items-center justify-end gap-1 font-mono">
                                <span>{m.timeStr}</span>
                                <span className="text-blue-600 font-bold">✓✓</span>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={m.id} className="flex justify-start">
                            <div className="bg-white rounded-2xl rounded-tl-xs px-4 py-2.5 max-w-[85%] sm:max-w-[75%] shadow-xs border border-slate-200/80 text-slate-900 text-xs sm:text-sm">
                              <div className="font-bold text-emerald-900 text-[11px] mb-0.5">
                                {conversaAtiva.name}
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{m.text}</p>
                              <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                                {m.timeStr}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                    {/* Elemento de âncora para garantir que a tela sempre comece na última mensagem recebida */}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input de Envio de Resposta Rápida pelo Painel */}
                  <div className="p-3.5 bg-white border-t border-slate-200">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleEnviarRespostaManual();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={mensagemRespostaManual}
                        onChange={(e) => setMensagemRespostaManual(e.target.value)}
                        placeholder={`Responder para ${conversaAtiva.name}...`}
                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] text-slate-800"
                      />
                      <button
                        type="submit"
                        disabled={enviandoRespostaManual || !mensagemRespostaManual.trim()}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#003400] hover:bg-[#002500] text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shrink-0"
                      >
                        {enviandoRespostaManual ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-base">send</span>
                            <span className="hidden sm:inline">Enviar</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <span className="material-symbols-outlined text-5xl text-slate-300">chat_bubble_outline</span>
                  <p className="text-sm font-bold text-slate-700">Selecione uma conversa ao lado</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Clique em um contato na lista à esquerda para visualizar todas as mensagens trocadas e responder diretamente pelo WhatsApp.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES & LOGS */}
      {selectedLogsInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl text-emerald-400">terminal</span>
                <div>
                  <h3 className="font-bold text-base">
                    Detalhes da Instância: {selectedLogsInstance.name}
                  </h3>
                  <span className="text-[11px] text-emerald-300 font-mono">
                    API: {selectedLogsInstance.instanceName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogsInstance(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-700 max-h-[70vh]">
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-xs font-bold text-blue-800 uppercase block">Departamento</span>
                  <span className="text-sm font-bold text-slate-900">
                    {selectedLogsInstance.department}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-800 uppercase block">Número Conectado</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">
                    {selectedLogsInstance.phone}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-800 uppercase block">Mensagens Servidor</span>
                  <span className="text-sm font-extrabold text-emerald-700">
                    {selectedLogsInstance.messagesSentToday}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                  Dados Técnicos do Servidor Evolution
                </h4>
                <div className="bg-slate-900 text-slate-200 font-mono text-xs p-4 rounded-2xl space-y-1.5 overflow-x-auto">
                  <div className="text-emerald-400">
                    [ENDPOINT] https://painelevolution.hotelnozap.com.br
                  </div>
                  <div className="text-slate-300">
                    [INSTANCE_NAME] {selectedLogsInstance.instanceName}
                  </div>
                  <div className="text-slate-300">
                    [STATUS] {selectedLogsInstance.status.toUpperCase()}
                  </div>
                  {selectedLogsInstance.token && (
                    <div className="text-slate-400">
                      [TOKEN] {selectedLogsInstance.token}
                    </div>
                  )}
                  {selectedLogsInstance.evolutionData?.Setting && (
                    <div className="text-emerald-300">
                      [SETTINGS] Rejeitar chamadas:{' '}
                      {selectedLogsInstance.evolutionData.Setting.rejectCall ? 'Sim' : 'Não'} | Online
                      sempre:{' '}
                      {selectedLogsInstance.evolutionData.Setting.alwaysOnline ? 'Sim' : 'Não'}
                    </div>
                  )}
                  {selectedLogsInstance.evolutionData?._count && (
                    <div className="text-blue-300">
                      [STATS] Chats: {selectedLogsInstance.evolutionData._count.Chat || 0} | Contatos:{' '}
                      {selectedLogsInstance.evolutionData._count.Contact || 0}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedLogsInstance(null)}
                className="bg-[#003400] hover:bg-[#002500] text-white font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESCANEAR QR CODE (INTEGRADO EM TEMPO REAL) */}
      {qrModalInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl text-emerald-400">
                  qr_code_scanner
                </span>
                <div>
                  <h3 className="font-bold text-base">Conectar WhatsApp</h3>
                  <p className="text-[11px] text-emerald-300 font-mono">
                    Instância: {qrModalInstance.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQrModalInstance(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-center flex flex-col items-center gap-4">
              {qrConnectedSuccess ? (
                /* ESTADO CONECTADO COM SUCESSO */
                <div className="py-8 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-300">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900">
                      WhatsApp Conectado com Sucesso!
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      A instância está online e pronta para disparos automáticos de reservas, cardápio e
                      check-in.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQrModalInstance(null);
                      carregarInstancias(true);
                    }}
                    className="px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    Fechar e Continuar
                  </button>
                </div>
              ) : qrLoading ? (
                /* CARREGANDO QR CODE */
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
                  <p className="text-xs font-bold text-slate-700">
                    Gerando QR Code oficial na Evolution API...
                  </p>
                  <p className="text-[11px] text-slate-400">Aguarde alguns segundos.</p>
                </div>
              ) : qrCodeData?.base64 ? (
                /* EXIBINDO QR CODE REAL DA API */
                <>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt;{' '}
                    <strong>Conectar um aparelho</strong> e aponte a câmera:
                  </p>

                  <div className="w-64 h-64 bg-white p-3 border-2 border-emerald-500 rounded-2xl shadow-lg flex items-center justify-center relative">
                    <img
                      src={
                        qrCodeData.base64.startsWith('data:')
                          ? qrCodeData.base64
                          : `data:image/png;base64,${qrCodeData.base64}`
                      }
                      alt="QR Code WhatsApp Evolution"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {qrCodeData.pairingCode && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-center">
                      <span className="text-[11px] text-slate-500 block">
                        Ou conecte usando o código de pareamento:
                      </span>
                      <strong className="text-base font-mono tracking-widest text-emerald-800">
                        {qrCodeData.pairingCode}
                      </strong>
                    </div>
                  )}

                  <div className="text-xs font-semibold text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">timer</span>
                    <span>Atualizando automaticamente em {tempoRestanteQr}s</span>
                  </div>
                </>
              ) : (
                /* SEM QR CODE / JÁ CONECTADO */
                <div className="py-8 space-y-3">
                  <span className="material-symbols-outlined text-4xl text-amber-500">info</span>
                  <p className="text-xs font-bold text-slate-700">
                    Esta instância já pode estar conectada ou inicializando.
                  </p>
                  <button
                    onClick={() => handleAbrirQrCodeModal(qrModalInstance)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Tentar Gerar QR Code Novamente
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleAbrirQrCodeModal(qrModalInstance)}
                disabled={qrLoading}
                className="text-xs font-bold text-[#003400] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                <span>Recarregar QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setQrModalInstance(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CONEXÃO */}
      {isNovaConexaoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-emerald-400">add_circle</span>
                <h3 className="font-bold text-base">Cadastrar Nova Instância</h3>
              </div>
              <button
                onClick={() => setIsNovaConexaoOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Alerta se estiver no limite do plano */}
            {!hotelPlanInfo.canCreateMore && (
              <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3 text-amber-900 text-xs font-bold">
                <span className="material-symbols-outlined text-amber-600 text-xl shrink-0">warning</span>
                <span>
                  Limite de {hotelPlanInfo.maxInstances} instância(s) atingido para o plano "{hotelPlanInfo.planName}". Faça upgrade para adicionar mais conexões.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveNovaConexao} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome da Conexão / Instância *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Recepção, Reservas, Suporte..."
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  A instância será gerada com o identificador do hotel no painel da Evolution API.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Departamento / Setor *
                </label>
                <select
                  value={novoDept}
                  onChange={(e) => setNovoDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 bg-white"
                >
                  <option value="Recepção & Check-in">Recepção & Check-in</option>
                  <option value="Central de Reservas">Central de Reservas</option>
                  <option value="Disparos & Avisos">Disparos & Avisos</option>
                  <option value="Camareiras & Manutenção">Camareiras & Manutenção</option>
                  <option value="Financeiro / Cobrança">Financeiro / Cobrança</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Número do WhatsApp de Referência (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(maskPhone(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNovaConexaoOpen(false)}
                  disabled={criandoInstancia}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoInstancia || !hotelPlanInfo.canCreateMore}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-2 ${
                    !hotelPlanInfo.canCreateMore
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#003400] hover:bg-[#002500] text-white disabled:opacity-50'
                  }`}
                >
                  {criandoInstancia ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Criando na Evolution API...</span>
                    </>
                  ) : !hotelPlanInfo.canCreateMore ? (
                    <>
                      <span className="material-symbols-outlined text-base">lock</span>
                      <span>Limite do Plano Atingido</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check</span>
                      <span>Criar Instância & Gerar QR Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE REGRAS DOS PLANOS & UPGRADE */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">Regras de Conexões por Plano</h3>
                  <p className="text-xs text-emerald-200">
                    Cada plano do Hotel no Zap possui um limite de instâncias de WhatsApp simultâneas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Situação Atual do Hotel */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Situação Atual do Hotel
                  </span>
                  <p className="text-base font-black text-slate-900">{hotelPlanInfo.hotelName}</p>
                  <p className="text-xs text-slate-600">
                    Plano Atual:{' '}
                    <strong className="text-emerald-800 font-bold">{hotelPlanInfo.planName}</strong>
                  </p>
                </div>
                <div className="sm:text-right">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                      !hotelPlanInfo.canCreateMore
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {hotelPlanInfo.currentCount} de {hotelPlanInfo.maxInstances} em uso
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {!hotelPlanInfo.canCreateMore
                      ? '🔒 Limite máximo atingido'
                      : '✓ Vaga disponível no plano'}
                  </p>
                </div>
              </div>

              {/* Mensagem explicativa */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <span className="material-symbols-outlined text-base text-emerald-700">info</span>
                  Por que há limite de conexões por plano?
                </p>
                <p className="text-emerald-900/90 leading-relaxed">
                  Para garantir a estabilidade do servidor Evolution API e cumprir o contrato de cada modalidade, estabelecimentos no plano de 1 crédito/adesão têm direito a 1 conexão oficial. Ao fazer upgrade para planos maiores, você desbloqueia múltiplas instâncias para conectar números de diferentes setores (ex: Recepção, Reservas, Governança e Room Service).
                </p>
              </div>

              {/* Tabela de Planos e Conexões WhatsApp */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-3">
                  Tabela Oficial de Conexões por Plano
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Plano 1 Crédito */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      hotelPlanInfo.planName.toLowerCase().includes('1 credito') ||
                      hotelPlanInfo.planName.toLowerCase().includes('1 crédito') ||
                      hotelPlanInfo.maxInstances === 1
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        1 Crédito (Adesão/Teste)
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        1 Instância
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      1 Conexão WhatsApp oficial integrada (Recepção ou Geral)
                    </p>
                    <p className="text-xs font-bold text-slate-700 mt-2">R$ 197,00 / 45 dias</p>
                  </div>

                  {/* Plano 2 Créditos */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      hotelPlanInfo.planName.toLowerCase().includes('2 credito') ||
                      hotelPlanInfo.planName.toLowerCase().includes('2 créditos') ||
                      hotelPlanInfo.maxInstances === 2
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        2 Créditos (Bimestral)
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        2 Instâncias
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      2 Conexões simultâneas (ex: Recepção + Central de Reservas)
                    </p>
                    <p className="text-xs font-bold text-slate-700 mt-2">R$ 349,00 / 75 dias</p>
                  </div>

                  {/* Plano 3 Créditos */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      hotelPlanInfo.planName.toLowerCase().includes('3 credito') ||
                      hotelPlanInfo.planName.toLowerCase().includes('3 créditos') ||
                      hotelPlanInfo.maxInstances === 3
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        3 Créditos (Trimestre)
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        3 Instâncias
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      3 Conexões simultâneas (Recepção + Reservas + Room Service)
                    </p>
                    <p className="text-xs font-bold text-slate-700 mt-2">
                      R$ 497,00 / 120 dias • Mais Vendido
                    </p>
                  </div>

                  {/* Plano 6 ou 12 Créditos */}
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      hotelPlanInfo.planName.toLowerCase().includes('6 credito') ||
                      hotelPlanInfo.planName.toLowerCase().includes('12 credito') ||
                      hotelPlanInfo.maxInstances >= 4
                        ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900">
                        6 a 12 Créditos (VIP/Anual)
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        4 a 5 Instâncias
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Até 5 conexões simultâneas para operações completas
                    </p>
                    <p className="text-xs font-bold text-slate-700 mt-2">A partir de R$ 947,00</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
              {onNavigateToUpgrade && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUpgradeModalOpen(false);
                    onNavigateToUpgrade();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base text-amber-300">upgrade</span>
                  <span>Fazer Upgrade do Plano</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR INSTÂNCIA */}
      {editInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-emerald-400">edit</span>
                <h3 className="font-bold text-base">Editar Conexão</h3>
              </div>
              <button
                onClick={() => setEditInstance(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditInstance} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome de Exibição
                </label>
                <input
                  type="text"
                  required
                  value={editInstance.name}
                  onChange={(e) => setEditInstance({ ...editInstance, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Departamento / Setor
                </label>
                <select
                  value={editInstance.department}
                  onChange={(e) => setEditInstance({ ...editInstance, department: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 bg-white"
                >
                  <option value="Recepção & Check-in">Recepção & Check-in</option>
                  <option value="Central de Reservas">Central de Reservas</option>
                  <option value="Disparos & Avisos">Disparos & Avisos</option>
                  <option value="Camareiras & Manutenção">Camareiras & Manutenção</option>
                  <option value="Financeiro / Cobrança">Financeiro / Cobrança</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Número do WhatsApp
                </label>
                <input
                  type="text"
                  value={editInstance.phone}
                  onChange={(e) => setEditInstance({ ...editInstance, phone: maskPhone(e.target.value) })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditInstance(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-red-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">warning</span>
                <h3 className="font-bold text-base">Excluir Instância</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmInstance(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 text-slate-700 text-xs sm:text-sm space-y-3">
              <p>
                Tem certeza de que deseja excluir a instância{' '}
                <strong>"{deleteConfirmInstance.name}"</strong> (
                <code>{deleteConfirmInstance.instanceName}</code>) da Evolution API?
              </p>
              <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200 font-semibold">
                ⚠️ A sessão do WhatsApp vinculada a este número será encerrada imediatamente no servidor.
              </p>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmInstance(null)}
                disabled={excluindoInstancia}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteInstance}
                disabled={excluindoInstancia}
                className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {excluindoInstancia ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConexoesWhatsapp;
