import React, { useState, useEffect, useRef } from 'react';
import { MeusDadosCadastrais } from './MeusDadosCadastrais';
import { MinhasReservasHospede } from './MinhasReservasHospede';
import { PedidosRecepcaoHospede } from './PedidosRecepcaoHospede';
import { hospedesService, quartosService, usuariosService, currentHotelService, hotelConfigService, extractConfigFromObservacoes } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { DEFAULT_CONFIG, HotelConfigData, loadHotelConfigFromStorage, saveHotelConfigToStorage } from './ConfiguracoesHotel';

export interface AreaHospedeProps {
  userRole?: string; // 'administrador' | 'hospede' | 'recepcao' | 'financeiro' | etc.
  userName?: string;
  userEmail?: string;
  onNavigateToSystem?: () => void;
  onNavigateToLogin?: () => void;
  onLogout?: () => void;
}

interface PedidoItem {
  id: string;
  descricao: string;
  solicitadoEm: string;
  status: 'Em Preparo' | 'Em Rota' | 'Entregue';
  quarto: string;
  responsavel?: string;
}

interface ConsumoItem {
  id: string;
  descricao: string;
  dataHora: string;
  local: string;
  valor: number;
}

interface ReservaItem {
  id: string;
  codigo: string;
  quarto: string;
  hotel: string;
  periodo: string;
  diarias: number;
  valorTotal: number;
  status: 'Em Andamento' | 'Concluída' | 'Confirmada' | 'Cancelada';
}

export interface ItemAcaoRapida {
  nome: string;
  categoria: string;
  icone: string;
  preco: string;
  subtitulo: string;
}

export const AreaHospede: React.FC<AreaHospedeProps> = ({
  userRole = 'hospede',
  userName = 'Everaldo Souza da Silva',
  userEmail = 'everaldosouza@gmail.com',
  onNavigateToSystem,
  onNavigateToLogin,
  onLogout,
}) => {
  // Controle de Permissão: Somente 'administrador' e 'hospede' têm acesso
  const normalizedRole = userRole.toLowerCase().trim();
  const hasAccess = normalizedRole === 'administrador' || normalizedRole === 'admin' || normalizedRole === 'hospede' || normalizedRole === 'hóspede';

  // Estados de navegação e UI
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'pedidos' | 'minhas-reservas' | 'horarios' | 'dados-cadastrais' | 'enderecos' | 'seguranca' | 'consumo'>('dashboard');
  const [hotelConfig, setHotelConfig] = useState<HotelConfigData>(DEFAULT_CONFIG);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados para o Modal Inteligente de Confirmação de Solicitação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<ItemAcaoRapida | null>(null);
  const [observacaoSolicitacao, setObservacaoSolicitacao] = useState('');
  const [quartoConfirmacao, setQuartoConfirmacao] = useState('');
  const rtChannelRef = useRef<any>(null);

  // Estados de formulário de pedido personalizado
  const [customRequestText, setCustomRequestText] = useState('');

  // Perfil Real do Hóspede carregado do Supabase
  const [perfil, setPerfil] = useState<any>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  // Estados dos Dados Cadastrais do Hóspede
  const [formData, setFormData] = useState({
    nome: userName,
    email: userEmail,
    cpf: '',
    telefone: '',
    dataNascimento: '1990-01-01',
    genero: 'Masculino',
    documentoTipo: 'CPF',
    nacionalidade: 'Brasileira',
  });

  // Estado dos Endereços
  const [enderecos, setEnderecos] = useState<any[]>([]);

  const carregarPerfilReal = async () => {
    try {
      setLoadingPerfil(true);
      const data = await hospedesService.getPerfilHospedeLogado(userEmail || userName);
      if (userEmail || data?.email) {
        usuariosService.registrarUltimoAcesso(userEmail || data?.email);
      }
      if (data) {
        setPerfil(data);
        if (data.hotelConfig) {
          setHotelConfig(data.hotelConfig);
          saveHotelConfigToStorage(data.hotelConfig, data.hotelId);
        }
        setFormData({
          nome: data.nome,
          email: data.email,
          cpf: data.cpf,
          telefone: data.telefone,
          dataNascimento: '1990-01-01',
          genero: 'Masculino',
          documentoTipo: 'CPF',
          nacionalidade: 'Brasileira',
        });
        setEnderecos([
          {
            id: '1',
            tipo: 'Endereço Residencial Principal',
            cep: data.cep || '78720-750',
            logradouro: data.logradouro || 'Rua João Paulo II',
            numero: data.numero || '891',
            complemento: data.complemento || '',
            bairro: data.bairro || 'Jardim Sumaré',
            cidade: data.cidade || 'Rondonópolis',
            uf: data.uf || 'MT',
          }
        ]);
        if (data.historicoReservas) {
          setReservas(data.historicoReservas);
        } else {
          setReservas([]);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados reais do hóspede:', err);
    } finally {
      setLoadingPerfil(false);
    }
  };

  // Garante que a rota exibida no navegador seja sempre /minhaconta
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/minhaconta') {
      window.history.replaceState({}, '', '/minhaconta');
    }
  }, []);

  // Carrega e sincroniza em tempo real as configurações de horários do hotel (Supabase + Realtime + Storage)
  useEffect(() => {
    // 1. Carregamento inicial rápido do cache local para resposta sem delay
    const initialConfig = loadHotelConfigFromStorage(perfil?.hotelId);
    setHotelConfig(initialConfig);

    // 2. Busca do Supabase e sincroniza se houver dados cadastrados
    hotelConfigService.getConfig(perfil?.hotelId).then(dbConfig => {
      if (dbConfig) {
        setHotelConfig(dbConfig);
        saveHotelConfigToStorage(dbConfig, perfil?.hotelId);
      }
    }).catch(err => console.warn('Aviso Supabase config:', err));

    // 3. Listener do Supabase Realtime (WebSockets) nas tabelas hotel_configuracoes e hoteis
    const channelName = `realtime_hotel_config_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const rtChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hotel_configuracoes' },
        (payload: any) => {
          if (payload?.new) {
            const mapped = hotelConfigService.mapRowToConfig(payload.new);
            setHotelConfig(mapped);
            saveHotelConfigToStorage(mapped, perfil?.hotelId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hoteis' },
        (payload: any) => {
          if (payload?.new?.observacoes) {
            const extracted = extractConfigFromObservacoes(payload.new.observacoes);
            if (extracted) {
              setHotelConfig(extracted);
              saveHotelConfigToStorage(extracted, perfil?.hotelId);
            }
          }
        }
      )
      .subscribe();

    // 4. Manipulador unificado de atualização de estado
    const handleUpdate = (updated?: any) => {
      if (updated && typeof updated === 'object' && ('checkInHorario' in updated || 'cafeInicio' in updated)) {
        setHotelConfig(prev => ({ ...prev, ...updated }));
      } else {
        const fresh = loadHotelConfigFromStorage(perfil?.hotelId);
        setHotelConfig(fresh);
      }
    };

    // 5. Listener de CustomEvent na mesma aba
    const handleCustomEvent = (e: any) => {
      handleUpdate(e?.detail);
    };
    window.addEventListener('hotel_config_atualizado', handleCustomEvent);

    // 6. Listener nativo de storage (quando alterado em qualquer aba do navegador)
    const handleStorageEvent = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('hotelnozap_config_hotel')) {
        if (e.newValue) {
          try {
            handleUpdate(JSON.parse(e.newValue));
            return;
          } catch { /* ignore */ }
        }
        handleUpdate();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 7. BroadcastChannel para comunicação instantânea entre abas
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('hotelnozap_hotel_config_channel');
        bc.onmessage = (event) => {
          if (event.data) {
            handleUpdate(event.data);
          }
        };
      } catch { /* ignore */ }
    }

    return () => {
      supabase.removeChannel(rtChannel);
      window.removeEventListener('hotel_config_atualizado', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) {
        try {
          bc.close();
        } catch { /* ignore */ }
      }
    };
  }, [perfil?.hotelId]);

  useEffect(() => {
    carregarPerfilReal();

    const handleAtualizacao = () => {
      carregarPerfilReal();
    };

    window.addEventListener('hotel_hospede_atualizado', handleAtualizacao);
    window.addEventListener('hotel_novo_hospede', handleAtualizacao);
    window.addEventListener('hotel_changed', handleAtualizacao);

    return () => {
      window.removeEventListener('hotel_hospede_atualizado', handleAtualizacao);
      window.removeEventListener('hotel_novo_hospede', handleAtualizacao);
      window.removeEventListener('hotel_changed', handleAtualizacao);
    };
  }, [userEmail, userName]);

  // Mantém o canal Realtime do Supabase inscrito e pronto para broadcast instantâneo
  useEffect(() => {
    const ch = supabase.channel('realtime_hotel_notifications');
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('📡 AreaHospede Realtime conectado com sucesso');
      }
    });
    rtChannelRef.current = ch;

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch (e) {}
    };
  }, []);

  // Lista de Pedidos Ativos nesta estadia (inicia vazia ou baseada na estadia real)
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);

  // Lista de Consumo acumulado (inicia vazia se não houver consumo registrado)
  const [consumo] = useState<ConsumoItem[]>([]);

  // Histórico de Reservas
  const [reservas, setReservas] = useState<any[]>([]);

  // Cálculo de total de consumo
  const totalConsumo = perfil?.temCheckinAtivo ? consumo.reduce((acc, item) => acc + item.valor, 0) : 0;

  // Helper para exibir toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Abre o modal inteligente de confirmação para qualquer item rápido
  const handleAbrirConfirmacaoItem = (item: ItemAcaoRapida) => {
    setConfirmingAction(item);
    setObservacaoSolicitacao('');
    const defaultQuarto = (perfil?.quartoNumero && perfil.quartoNumero !== '—') ? perfil.quartoNumero : '100';
    setQuartoConfirmacao(defaultQuarto);
    setIsConfirmModalOpen(true);
  };

  // Handler para submeter pedido rápido - agora abre o modal inteligente de confirmação
  const handleFazerPedidoRapido = (itemNome: string) => {
    // Mapeia metadados inteligentes do item
    let categoria = 'Governança';
    let icone = 'room_service';
    let preco = 'Grátis (Incluso)';
    let subtitulo = 'Atendimento Rápido';

    if (itemNome.includes('Toalhas')) {
      categoria = 'Governança';
      icone = 'dry_cleaning';
      preco = 'Grátis (Incluso)';
      subtitulo = 'Banho / Piscina (Grátis)';
    } else if (itemNome.includes('Limpeza')) {
      categoria = 'Governança';
      icone = 'cleaning_services';
      preco = 'Grátis (Incluso)';
      subtitulo = 'Camareira agora';
    } else if (itemNome.includes('Travesseiro')) {
      categoria = 'Governança';
      icone = 'bed';
      preco = 'Grátis (Incluso)';
      subtitulo = 'Macio / Firme (Grátis)';
    } else if (itemNome.includes('Amenities')) {
      categoria = 'Higiene & Bem-estar';
      icone = 'sanitizer';
      preco = 'Grátis (Incluso)';
      subtitulo = 'Shampoo, sabonete';
    } else if (itemNome.includes('Água') || itemNome.includes('Agua')) {
      categoria = 'Frigobar';
      icone = 'water_bottle';
      preco = 'R$ 6,00';
      subtitulo = 'Com / Sem gás (R$ 6)';
    } else if (itemNome.includes('Gelo')) {
      categoria = 'Bar & Recepção';
      icone = 'ac_unit';
      preco = 'Grátis (Incluso)';
      subtitulo = 'Entrega rápida';
    }

    handleAbrirConfirmacaoItem({
      nome: itemNome,
      categoria,
      icone,
      preco,
      subtitulo,
    });
  };

  // Executa o envio confirmado e notifica a recepção do hotel em tempo real
  const handleConfirmarEnvioSolicitacao = () => {
    if (!confirmingAction) return;

    const quartoNumFinal = quartoConfirmacao.trim() || (perfil?.quartoNumero && perfil.quartoNumero !== '—' ? perfil.quartoNumero : '100');
    const quartoIdentificador = `Quarto ${quartoNumFinal}`;
    const isMensagemEspecial = confirmingAction.categoria === 'Mensagem Especial';

    // 1. Registra localmente para o hóspede
    const novoPedido: PedidoItem = {
      id: `P-${Date.now().toString().slice(-4)}`,
      descricao: isMensagemEspecial
        ? `Mensagem: "${confirmingAction.nome}"`
        : `1x ${confirmingAction.nome}${observacaoSolicitacao.trim() ? ` (${observacaoSolicitacao.trim()})` : ''}`,
      solicitadoEm: 'Agora mesmo',
      status: 'Em Preparo',
      quarto: quartoIdentificador,
      responsavel: 'Equipe de Atendimento',
    };
    setPedidos([novoPedido, ...pedidos]);

    // 2. Monta payload de notificação inteligente do hotel
    const solicitacaoPayload = {
      id: `solic-${Date.now()}`,
      hotelId: perfil?.hotelId || 'global',
      hotelNome: perfil?.hotelNome || 'Hotel',
      hospedeNome: perfil?.nome || formData.nome || userName || 'Hóspede',
      hospedeEmail: perfil?.email || formData.email || userEmail || '',
      hospedeTelefone: perfil?.telefone || formData.telefone || '',
      quartoNumero: quartoNumFinal,
      quartoNome: perfil?.quartoNome || `Quarto ${quartoNumFinal}`,
      itemNome: confirmingAction.nome,
      categoria: confirmingAction.categoria,
      preco: confirmingAction.preco,
      observacoes: isMensagemEspecial ? '' : observacaoSolicitacao.trim(),
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      tipo: isMensagemEspecial ? 'whatsapp' : 'pedido',
      origem: 'area_hospede_mensagem',
      status: 'Pendente'
    };

    // 3. Se for solicitação de Limpeza/Governança, altera o status do quarto no Mapa de Quartos
    const isSolicitacaoLimpeza = 
      confirmingAction.nome.toLowerCase().includes('limpeza') ||
      confirmingAction.categoria.toLowerCase().includes('limpeza') ||
      observacaoSolicitacao.toLowerCase().includes('limpeza') ||
      confirmingAction.nome.toLowerCase().includes('camareira') ||
      confirmingAction.nome.toLowerCase().includes('faxina');

    if (isSolicitacaoLimpeza) {
      quartosService.solicitarLimpezaQuarto(quartoNumFinal, perfil?.hotelId);
    }

    // 4. Dispara CustomEvent no Window para a tela do hotel
    window.dispatchEvent(new CustomEvent('hotel_nova_solicitacao', { detail: solicitacaoPayload }));

    // 5. Dispara BroadcastChannel multi-abas instantâneo
    try {
      const bc = new BroadcastChannel('hotel_notifications_channel');
      bc.postMessage({ type: 'NOVA_SOLICITACAO_HOSPEDE', data: solicitacaoPayload });
      bc.close();
    } catch (bcErr) {
      console.warn('BroadcastChannel indisponível:', bcErr);
    }

    // 5. Salva no localStorage com trigger de storage event para outras janelas/abas do hotel
    try {
      localStorage.setItem('hotel_nova_solicitacao_trigger', JSON.stringify({
        ...solicitacaoPayload,
        _triggerUid: `${Date.now()}_${Math.random()}`
      }));
      const rawNotifs = localStorage.getItem('hotel_notificacoes_pedidos');
      const list = rawNotifs ? JSON.parse(rawNotifs) : [];
      localStorage.setItem('hotel_notificacoes_pedidos', JSON.stringify([solicitacaoPayload, ...list].slice(0, 50)));
    } catch (stErr) {
      console.warn('Erro ao salvar notificação no storage:', stErr);
    }

    // 6. Broadcast via Supabase Realtime usando canal ativo
    try {
      if (rtChannelRef.current) {
        rtChannelRef.current.send({
          type: 'broadcast',
          event: 'solicitacao_hospede',
          payload: solicitacaoPayload
        });
      } else {
        const ch = supabase.channel('realtime_hotel_notifications');
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            ch.send({
              type: 'broadcast',
              event: 'solicitacao_hospede',
              payload: solicitacaoPayload
            });
          }
        });
      }
    } catch (rtErr) {
      console.warn('Supabase Realtime indisponível:', rtErr);
    }

    // 7. Feedback ao hóspede e limpeza de campos
    setIsConfirmModalOpen(false);
    setConfirmingAction(null);
    setObservacaoSolicitacao('');
    setCustomRequestText('');
    showToast(isMensagemEspecial
      ? `💬 Mensagem enviada! A recepção do ${perfil?.hotelNome || 'hotel'} recebeu o alerta com seu aviso.`
      : `🛎️ Solicitação enviada! A recepção do ${perfil?.hotelNome || 'hotel'} recebeu o alerta.`
    );
  };

  // Handler para submeter pedido ou mensagem personalizada
  const handleEnviarPedidoPersonalizado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRequestText.trim()) return;

    handleAbrirConfirmacaoItem({
      nome: customRequestText.trim(),
      categoria: 'Mensagem Especial',
      icone: 'chat',
      preco: 'Atendimento de Quarto',
      subtitulo: 'Observação ou Solicitação Especial para a Recepção',
    });
    setIsNewOrderModalOpen(false);
  };

  // Handler para copiar chave PIX
  const handleCopiarPix = () => {
    navigator.clipboard.writeText('00020126580014br.gov.bcb.pix0136d89e4720-hotelnozap-pix-suite204-key5204000053039865406180.005802BR5922HOTEL MASTER PORTO DE6009PORTO GALI62070503***6304D1A2');
    setPixCopied(true);
    showToast('Chave PIX copia e cola copiada para a área de transferência!');
    setTimeout(() => setPixCopied(false), 3000);
  };

  // Handler para logout completo da Área do Hóspede e retorno à Home (localhost:5173 ou hotelnozap.com.br)
  const handleSairDaConta = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Erro ao deslogar do Supabase:', err);
    }
    try {
      localStorage.removeItem('hotelnozap_user_role');
      localStorage.removeItem('hotelnozap_user_email');
      localStorage.removeItem('hotelnozap_user_name');
      localStorage.removeItem('hotelnozap_current_user');
      localStorage.removeItem('hotelnozap_sb_session');
      localStorage.removeItem('hotelnozap_hotel_atual');
      localStorage.removeItem('hotelnozap_last_authenticated_at');
      sessionStorage.clear();
    } catch (err) {
      console.warn('Erro ao limpar storage de sessão:', err);
    }

    if (onLogout) {
      onLogout();
      return;
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const defaultProd = import.meta.env?.VITE_APP_BASE_URL || 'https://app.hotelnozap.com.br/';
    const targetUrl = isLocalhost ? `${window.location.protocol}//${window.location.host}/` : (window.location.origin || defaultProd);
    window.location.href = targetUrl;
  };

  // TELA DE ACESSO NEGADO CASO NÃO SEJA ADMIN OU HÓSPEDE
  if (!hasAccess) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans text-white">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white">Acesso Restrito</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            A <strong>Área do Hóspede (/minhaconta)</strong> é de acesso exclusivo para usuários com perfil de <span className="text-emerald-400 font-bold">Hóspede</span> ou <span className="text-emerald-400 font-bold">Administrador</span>.
          </p>
          <div className="pt-3">
            <button
              onClick={onNavigateToSystem || onNavigateToLogin}
              className="w-full py-3 px-4 rounded-xl bg-[#003400] hover:bg-[#004D00] text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Voltar ao Sistema
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 antialiased flex flex-col lg:flex-row relative">
      {/* TOAST SYSTEM NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#003400] text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR DESKTOP (Fixa no Padrão Oficial dos Perfis de Hotéis)             */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-72 bg-gradient-to-b from-[#003400] to-[#000000] text-white justify-between shrink-0 shadow-2xl z-40 overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto no-scrollbar">
          {/* Topo: Marca & Info do Hotel */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <span className="material-symbols-outlined text-2xl">hotel</span>
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  HOTEL NO ZAP
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hóspede
                  </span>
                </h1>
                <p className="text-xs text-emerald-200/70 font-medium">Portal do Hóspede VIP</p>
              </div>
            </div>
          </div>

          {/* Card Resumo do Quarto Atual / Status da Estadia */}
          <div className="mx-4 mt-5 p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 backdrop-blur-sm">
            <div className="w-11 h-11 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg shrink-0">
              {perfil?.temCheckinAtivo ? (perfil?.quartoNumero || '100') : '—'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${perfil?.temCheckinAtivo ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {perfil?.statusEstadia || (perfil?.temCheckinAtivo ? 'Hospedado' : 'Sem Estadia Ativa')}
                </span>
                {perfil?.temCheckinAtivo && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
              </div>
              <p className="text-sm font-bold text-white truncate">{perfil?.temCheckinAtivo ? (perfil?.quartoNome || 'Quarto Casal') : 'Nenhum quarto ocupado'}</p>
              <p className="text-[11px] text-slate-400 truncate">{perfil?.hotelNome || 'Hotel'}</p>
            </div>
          </div>

          {/* Menu de Navegação da Sidebar */}
          <nav className="mt-6 px-3 space-y-1">
            <button
              onClick={() => setActiveSubTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'dashboard'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${activeSubTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'}`}>dashboard</span>
              <span>Visão Geral & Estadia</span>
            </button>

            <button
              onClick={() => setActiveSubTab('pedidos')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'pedidos'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-xl ${activeSubTab === 'pedidos' ? 'text-emerald-400' : 'text-slate-400'}`}>room_service</span>
                <span>Pedidos & Recepção</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {pedidos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('minhas-reservas')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'minhas-reservas'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${activeSubTab === 'minhas-reservas' ? 'text-emerald-400' : 'text-slate-400'}`}>calendar_month</span>
              <span>Minhas Reservas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('horarios')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'horarios'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${activeSubTab === 'horarios' ? 'text-emerald-400' : 'text-slate-400'}`}>schedule</span>
              <span>Horários & Hotel</span>
            </button>

            <button
              onClick={() => setActiveSubTab('dados-cadastrais')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'dados-cadastrais'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${activeSubTab === 'dados-cadastrais' ? 'text-emerald-400' : 'text-slate-400'}`}>badge</span>
              <span>Meus Dados</span>
            </button>

            <button
              onClick={() => setActiveSubTab('seguranca')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'seguranca'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${activeSubTab === 'seguranca' ? 'text-emerald-400' : 'text-slate-400'}`}>lock</span>
              <span>Segurança & Senha</span>
            </button>

            <button
              onClick={() => setActiveSubTab('consumo')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeSubTab === 'consumo'
                  ? 'bg-emerald-600/25 text-emerald-300 border-l-4 border-emerald-400 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-xl ${activeSubTab === 'consumo' ? 'text-emerald-400' : 'text-slate-400'}`}>receipt_long</span>
                <span>Extrato de Consumo</span>
              </div>
              <span className="text-[11px] font-bold text-amber-300">
                R$ {totalConsumo.toFixed(2).replace('.', ',')}
              </span>
            </button>
          </nav>
        </div>

        {/* Rodapé da Sidebar: Usuário + Opções de Painel e Logout */}
        <div className="p-4 border-t border-white/10 bg-black/30 space-y-2 shrink-0 mt-auto">
          {/* Perfil */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-700 border border-emerald-400/50 flex items-center justify-center font-extrabold text-white text-sm">
                {formData.nome.substring(0, 2).toUpperCase()}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black"></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{formData.nome}</p>
              <p className="text-xs text-slate-400 truncate">{formData.email}</p>
            </div>
          </div>

          {/* Botão de retorno ao painel administrativo (Se for Administrador) */}
          {(normalizedRole === 'administrador' || normalizedRole === 'admin') && onNavigateToSystem && (
            <button
              onClick={onNavigateToSystem}
              className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
            >
              <span className="material-symbols-outlined text-base text-emerald-400">admin_panel_settings</span>
              <span>Painel Admin do Hotel</span>
            </button>
          )}

          {/* Botão Sair da Conta */}
          <button
            onClick={handleSairDaConta}
            className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors text-sm font-semibold group cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-white group-hover:translate-x-0.5 transition-transform">logout</span>
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* ESTRUTURA PRINCIPAL MOBILE + DESKTOP                                       */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72 bg-slate-50 min-h-screen">
        
        {/* CABEÇALHO MOBILE (390px / Dispositivos móveis) */}
        <header className="lg:hidden sticky top-0 z-40 bg-gradient-to-r from-[#003400] to-[#000000] text-white px-4 py-3.5 shadow-md flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-transform text-white focus:outline-none"
            >
              <span className="material-symbols-outlined text-[26px]">menu</span>
            </button>
            <div className="flex flex-col">
              <span className="text-[13px] font-extrabold tracking-wider uppercase text-emerald-400 leading-none">HOTEL NO ZAP</span>
              <span className="text-[11px] text-slate-300 font-medium leading-tight">Portal do Hóspede VIP</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => showToast('Wi-Fi da Pousada: HotelMaster_VIP | Senha: zap12345')}
              className="flex items-center space-x-1 px-2 py-1 rounded-full bg-white/10 text-[11px] font-medium transition-all text-emerald-300 border border-emerald-500/30"
            >
              <span className="material-symbols-outlined text-[15px]">wifi</span>
              <span>Wi-Fi</span>
            </button>

            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-1.5 rounded-full hover:bg-white/10 text-white transition-transform"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-black"></span>
            </button>

            <div className="w-8 h-8 rounded-full bg-emerald-800 border border-emerald-400 flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden">
              {formData.nome.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* DRAWER MENU MOBILE (DESLIZANTE) */}
        {isMobileDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex">
            <div className="w-4/5 max-w-xs bg-gradient-to-b from-[#003400] to-[#000000] text-white p-5 flex flex-col justify-between h-full shadow-2xl animate-in slide-in-from-left duration-200">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-2xl">hotel</span>
                    <span className="font-extrabold text-white text-base">HOTEL NO ZAP</span>
                  </div>
                  <button onClick={() => setIsMobileDrawerOpen(false)} className="text-slate-400 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-white/10 border border-white/15">
                  <span className={`text-[10px] uppercase font-bold ${perfil?.temCheckinAtivo ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {perfil?.temCheckinAtivo ? `Quarto ${perfil?.quartoNumero} • ${perfil?.statusEstadia}` : (perfil?.statusEstadia || 'Sem Estadia Ativa')}
                  </span>
                  <p className="text-sm font-bold text-white">{perfil?.temCheckinAtivo ? (perfil?.quartoNome || 'Quarto') : 'Nenhum quarto ocupado'}</p>
                </div>

                <nav className="mt-5 space-y-1">
                  <button
                    onClick={() => { setActiveSubTab('dashboard'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">dashboard</span>
                    Visão Geral & Estadia
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('pedidos'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-emerald-400 text-lg">room_service</span>
                      Pedidos & Recepção
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">{pedidos.length}</span>
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('minhas-reservas'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">calendar_month</span>
                    Minhas Reservas
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('horarios'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">schedule</span>
                    Horários & Hotel
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('dados-cadastrais'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">badge</span>
                    Meus Dados Cadastrais
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('seguranca'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">lock</span>
                    Segurança & Senha
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('consumo'); setIsMobileDrawerOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-xs font-bold text-slate-200"
                  >
                    <span className="material-symbols-outlined text-emerald-400 text-lg">receipt_long</span>
                    Extrato de Consumo
                  </button>
                </nav>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-2">
                {(normalizedRole === 'administrador' || normalizedRole === 'admin') && onNavigateToSystem && (
                  <button
                    onClick={onNavigateToSystem}
                    className="w-full py-2 bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold"
                  >
                    Painel Admin do Hotel
                  </button>
                )}
                <button
                  onClick={handleSairDaConta}
                  className="w-full py-2 text-white hover:bg-white/10 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sair da Conta
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileDrawerOpen(false)}></div>
          </div>
        )}

        {/* CABEÇALHO DESKTOP */}
        <header className="hidden lg:flex h-20 bg-white border-b border-slate-200 px-8 items-center justify-between shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Olá, {perfil?.nome || formData.nome || userName}! 👋</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
              {perfil?.status === 'ativo' ? 'Hóspede Ativo' : 'Hóspede VIP'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700">
              <span className="material-symbols-outlined text-base text-emerald-600">wifi</span>
              <span className="font-medium">
                Wi-Fi: <strong className="font-bold text-slate-900">{perfil?.hotelWifi || 'HotelNoZap_VIP'}</strong>
              </span>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              </button>

              {/* POPUP DE NOTIFICAÇÕES */}
              {isNotificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <h4 className="text-xs font-extrabold uppercase text-slate-700">Notificações da Estadia</h4>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">2 Novas</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <p className="font-bold text-slate-900">Café da Manhã Servido</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">O buffet principal está pronto no restaurante até as 10:30.</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="font-bold text-slate-900">Solicitação em Andamento</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">A camareira Maria está a caminho do Quarto 204.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs font-bold shadow-md shadow-[#003400]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-base text-emerald-400">room_service</span>
              <span>+ Fazer Pedido</span>
            </button>
          </div>
        </header>

        {/* CONTEÚDO SCROLLÁVEL DA ÁREA DO HÓSPEDE */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8 space-y-6 lg:space-y-8 pb-24 lg:pb-8">
          
          {/* ================================================================= */}
          {/* CONTEÚDO DINÂMICO: ABA VISÃO GERAL & ESTADIA                      */}
          {/* ================================================================= */}
          {activeSubTab === 'dashboard' && (
            <>
              {/* BANNER HERO DE BOAS-VINDAS / ESTADIA EM ANDAMENTO */}
              <section className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-xl border border-slate-800 p-5 lg:p-7">
            <div className="absolute -right-10 -bottom-10 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                    perfil?.temCheckinAtivo 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-slate-700/60 text-slate-300 border border-slate-600/50'
                  }`}>
                    {perfil?.temCheckinAtivo && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                    {perfil?.statusEstadia || (perfil?.temCheckinAtivo ? 'Estadia em Andamento' : 'Sem Estadia Ativa')}
                  </span>
                  {perfil?.temCheckinAtivo && perfil?.reservaCodigo && perfil.reservaCodigo !== '—' && (
                    <span className="text-xs text-slate-300 font-medium">Reserva {perfil.reservaCodigo}</span>
                  )}
                </div>
                <h3 className="text-xl lg:text-3xl font-black tracking-tight text-white">
                  {perfil?.temCheckinAtivo 
                    ? `${perfil?.quartoNome} • ${perfil?.hotelNome}`
                    : `Bem-vindo(a) ao ${perfil?.hotelNome || 'Hotel'}!`
                  }
                </h3>
                <p className="text-xs lg:text-sm text-slate-300 leading-relaxed">
                  {perfil?.temCheckinAtivo ? (
                    <>
                      Check-in em <strong>{perfil?.dataCheckin}</strong>. Seu check-out está previsto para <strong>{perfil?.dataCheckout}</strong> ({perfil?.totalDiarias} diárias). Aproveite sua estadia!
                    </>
                  ) : (
                    <>
                      Você ainda não realizou check-in ou não possui hospedagem em andamento no momento. Consulte a recepção para consultar tarifas, realizar sua reserva ou dar entrada na sua acomodação!
                    </>
                  )}
                </p>

                {/* Comodidades do Quarto (quando houver check-in ativo) */}
                {perfil?.temCheckinAtivo && perfil?.quartoComodidades && perfil.quartoComodidades.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {perfil.quartoComodidades.map((comod: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-xs text-slate-200 border border-white/10">
                        <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span> {comod}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Box de Ação Rápida no Hero (Recepção 24h / WhatsApp) */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/15 flex flex-col sm:flex-row xl:flex-col gap-4 min-w-[280px] shadow-lg">
                <div>
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Atendimento & Suporte</div>
                  <div className="text-xl lg:text-2xl font-black text-white flex items-center gap-2 mt-0.5">
                    <span className="material-symbols-outlined text-emerald-400 text-2xl lg:text-3xl">support_agent</span>
                    Recepção 24h
                  </div>
                  <p className="text-[11px] text-emerald-200/80 mt-1">Canal direto com a equipe do {perfil?.hotelNome || 'hotel'}</p>
                </div>
                <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                  <a
                    href={`https://wa.me/55${(perfil?.hotelWhatsapp || '66981585014').replace(/\D/g, '')}?text=${encodeURIComponent(
                      perfil?.temCheckinAtivo 
                        ? `Olá! Sou o hóspede ${perfil?.nome || userName} (${perfil?.quartoNome || 'Quarto'}) do ${perfil?.hotelNome || 'Hotel'} e gostaria de consultar informações sobre minha estadia.`
                        : `Olá! Sou o hóspede ${perfil?.nome || userName} cadastrado no ${perfil?.hotelNome || 'Hotel'} e gostaria de consultar informações sobre tarifas e disponibilidade de reservas!`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    {perfil?.temCheckinAtivo ? 'Falar com Recepção (WhatsApp)' : 'Consultar Reservas & Tarifas'}
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* CARDS DE HORÁRIOS & COMODIDADES (CHECK-IN/OUT, CAFÉ, SILÊNCIO, LAZER) */}
          {/* ================================================================= */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-lg">schedule</span>
                </div>
                <div>
                  <h3 className="text-sm lg:text-base font-extrabold text-slate-900 tracking-tight">
                    Horários & Comodidades da Estadia
                  </h3>
                  <p className="text-[11px] lg:text-xs text-slate-500">
                    Horários oficiais configurados pelo hotel para seu conforto e tranquilidade
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSubTab('horarios')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver detalhes completos</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {/* Card 1: Entrada e Saída (Check-in/Out) */}
              <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-lg">hotel</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Entrada e Saída</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Check-in/Out
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-sm">login</span>
                        Horário de check-in
                      </span>
                      <strong className="text-sm font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {hotelConfig.checkInHorario}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-amber-600 text-sm">logout</span>
                        Horário de check-out
                      </span>
                      <strong className="text-sm font-black text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {hotelConfig.checkOutHorario}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-emerald-600">timelapse</span>
                  <span>Tolerância de saída: <strong>{hotelConfig.toleranciaCheckOutMinutos} min</strong></span>
                </div>
              </div>

              {/* Card 2: Café da Manhã */}
              <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-lg">bakery_dining</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Café da Manhã</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Incluso
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500">Buffet servido no restaurante:</div>
                    <div className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>{hotelConfig.cafeInicio}</span>
                      <span className="text-xs font-semibold text-slate-400">às</span>
                      <span>{hotelConfig.cafeFim}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-amber-600">restaurant</span>
                  <span>Buffet completo de café da manhã</span>
                </div>
              </div>

              {/* Card 3: Horário de Silêncio */}
              <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-lg">volume_off</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Horário de Silêncio</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Repouso
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500">Período de repouso nos quartos:</div>
                    <div className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>{hotelConfig.silencioInicio}</span>
                      <span className="text-xs font-semibold text-slate-400">às</span>
                      <span>{hotelConfig.silencioFim}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-indigo-600">bedtime</span>
                  <span>Respeito ao descanso de todos</span>
                </div>
              </div>

              {/* Card 4: Recepção & Lazer */}
              <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-lg">concierge</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">Recepção & Lazer</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                      {hotelConfig.recepcao24Horas ? '24 Horas' : 'Comodidades'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-teal-600 text-sm">support_agent</span>
                        Recepção
                      </span>
                      <strong className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                        {hotelConfig.recepcao24Horas ? '24 Horas Disponível' : `${hotelConfig.recepcaoInicio} - ${hotelConfig.recepcaoFim}`}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-600 text-sm">pool</span>
                        Piscina & Lazer
                      </span>
                      <strong className="text-xs font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {hotelConfig.lazerInicio} às {hotelConfig.lazerFim}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-teal-600">verified</span>
                  <span>Acesso livre para os hóspedes</span>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* CARDS DE INDICADORES / ATALHOS DO HÓSPEDE (4 CARDS PADRÃO)       */}
          {/* ================================================================= */}
          <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
            <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg lg:text-xl">hotel</span>
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold text-slate-900">
                {perfil?.totalHospedagens || 0} {(perfil?.totalHospedagens || 0) === 1 ? 'Hospedagem' : 'Hospedagens'}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                {(perfil?.totalHospedagens || 0) > 0 ? `${perfil?.totalHospedagens} estadias concluídas` : 'Nenhuma estadia concluída'}
              </p>
            </div>

            <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">Pontos Fidelidade</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg lg:text-xl">workspace_premium</span>
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold text-slate-900">
                {(perfil?.pontosFidelidade || 0).toLocaleString('pt-BR')} Pontos
              </div>
              <p className="text-xs text-purple-700 font-medium mt-1">
                {(perfil?.pontosFidelidade || 0) > 0 ? `${perfil?.pontosFidelidade} pts acumulados` : '10 pts por hospedagem concluída'}
              </p>
            </div>

            <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">Estadia Atual</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg lg:text-xl">calendar_month</span>
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold text-slate-900">
                {perfil?.temCheckinAtivo ? `${perfil?.diariaAtual || 1} de ${perfil?.totalDiarias || 1} Diárias` : '0 Diárias'}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {perfil?.temCheckinAtivo ? `Check-out: ${perfil?.dataCheckout}` : 'Nenhum check-in ativo'}
              </p>
            </div>

            <div className="bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">Consumo Quarto</span>
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg lg:text-xl">receipt_long</span>
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-extrabold text-slate-900">
                R$ {(perfil?.temCheckinAtivo ? totalConsumo : 0).toFixed(2).replace('.', ',')}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">
                  {perfil?.temCheckinAtivo ? 'Sem lançamentos pendentes' : 'Sem consumo registrado'}
                </span>
                <button onClick={() => setActiveSubTab('consumo')} className="text-xs text-emerald-700 font-bold hover:underline">
                  Ver extrato
                </button>
              </div>
            </div>
          </section>

          {/* COLUNA PRINCIPAL DA VISÃO GERAL: PEDIDOS RÁPIDOS & CONSUMO */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            {/* COLUNA ESQUERDA: PEDIDOS RÁPIDOS & HISTÓRICO (7 COLUNAS) */}
            <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:p-6">
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600">room_service</span>
                        Ações Rápidas & Pedidos Frequentes
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">Solicite itens com 1 clique para entrega direta na sua acomodação.</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      Atendimento 24h
                    </span>
                  </div>

                  {/* Grid de Pedidos Pré-definidos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                    <button
                      onClick={() => handleFazerPedidoRapido('Toalhas Extras (Banho/Piscina)')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">dry_cleaning</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Toalhas Extras</div>
                      <p className="text-[11px] text-slate-500">Banho / Piscina (Grátis)</p>
                    </button>

                    <button
                      onClick={() => handleFazerPedidoRapido('Limpeza do Quarto')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">cleaning_services</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Limpeza do Quarto</div>
                      <p className="text-[11px] text-slate-500">Camareira agora</p>
                    </button>

                    <button
                      onClick={() => handleFazerPedidoRapido('Travesseiros Extras (Macio/Firme)')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">bed</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Travesseiros</div>
                      <p className="text-[11px] text-slate-500">Macio / Firme (Grátis)</p>
                    </button>

                    <button
                      onClick={() => handleFazerPedidoRapido('Kit Amenities (Shampoo & Sabonete)')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">sanitizer</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Kit Amenities</div>
                      <p className="text-[11px] text-slate-500">Shampoo, sabonete</p>
                    </button>

                    <button
                      onClick={() => handleFazerPedidoRapido('Água Mineral 500ml')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">water_bottle</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Água Mineral</div>
                      <p className="text-[11px] text-slate-500">Com / Sem gás (R$ 6)</p>
                    </button>

                    <button
                      onClick={() => handleFazerPedidoRapido('Balde de Gelo com Pinça')}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-700 flex items-center justify-center mb-2">
                        <span className="material-symbols-outlined text-lg">ac_unit</span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">Balde de Gelo</div>
                      <p className="text-[11px] text-slate-500">Entrega rápida</p>
                    </button>
                  </div>

                  {/* Formulário de Pedido Personalizado */}
                  <form onSubmit={handleEnviarPedidoPersonalizado} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">Outra solicitação ou observação especial para o quarto:</label>
                    <textarea
                      value={customRequestText}
                      onChange={(e) => setCustomRequestText(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      placeholder="Ex: Por favor, enviar ferro de passar e tábua ao Quarto 204, ou não bater na porta antes das 10h..."
                      rows={2}
                    ></textarea>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <span className="material-symbols-outlined text-sm text-emerald-600">bolt</span>
                        Tempo médio de atendimento: 10 a 15 minutos
                      </div>
                      <button
                        type="submit"
                        disabled={!customRequestText.trim()}
                        className="px-4 py-2 bg-[#003400] hover:bg-[#002600] disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        Enviar Solicitação
                      </button>
                    </div>
                  </form>

                  {/* Histórico de Pedidos Desta Estadia */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">Pedidos Desta Estadia</h5>
                      <span className="text-xs text-slate-400">
                        {perfil?.quartoNumero && perfil.quartoNumero !== '—' ? `Quarto ${perfil.quartoNumero}` : 'Acomodação Principal'}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {pedidos.map((pedido) => (
                        <div
                          key={pedido.id}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                            pedido.status === 'Em Preparo' || pedido.status === 'Em Rota'
                              ? 'bg-amber-50/70 border-amber-200/80'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                                pedido.status === 'Em Preparo' || pedido.status === 'Em Rota'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              <span className="material-symbols-outlined text-base">
                                {pedido.status === 'Em Preparo' ? 'hourglass_bottom' : pedido.status === 'Em Rota' ? 'local_shipping' : 'check_circle'}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{pedido.descricao}</p>
                              <p className="text-[11px] text-slate-500">
                                {pedido.solicitadoEm} • {pedido.responsavel}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] uppercase tracking-wide ${
                              pedido.status === 'Em Preparo' || pedido.status === 'Em Rota'
                                ? 'bg-amber-200/60 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {pedido.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: CONSUMO & HORÁRIOS DA POUSADA (5 COLUNAS) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Card de Extrato de Frigobar e Consumo */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-600">receipt_long</span>
                        Consumo & Frigobar
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {perfil?.quartoNumero && perfil?.quartoNumero !== '—' ? `Lançamentos acumulados no Quarto ${perfil.quartoNumero}` : 'Lançamentos acumulados da estadia'}
                      </p>
                    </div>
                    <span className="text-base font-black text-slate-900">
                      R$ {totalConsumo.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  {/* Tabela de Itens Consumidos */}
                  <div className="divide-y divide-slate-100 text-xs mt-3">
                    {consumo.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">{item.descricao}</div>
                          <div className="text-[11px] text-slate-400">
                            {item.dataHora} ({item.local})
                          </div>
                        </div>
                        <span className="font-bold text-slate-700">R$ {item.valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rodapé do Extrato */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Pagamento no check-out ou via PIX antecipado</span>
                    <button
                      onClick={() => setIsPixModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-[#003400] hover:bg-[#002600] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base text-emerald-400">qr_code_2</span>
                      Pagar via PIX
                    </button>
                  </div>
                </div>

                {/* Card de Horários & Serviços do Hotel */}
                <div className="bg-gradient-to-br from-emerald-950 to-[#003400] rounded-2xl text-white p-6 shadow-md border border-emerald-900">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">info</span>
                      Horários do Hotel
                    </h4>
                    <span className="text-[10px] bg-emerald-800/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-700/60 font-medium">
                      Oficial
                    </span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-200">Entrada (Check-in):</span>
                      <span className="font-bold text-white">A partir das {hotelConfig.checkInHorario}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-200">Saída (Check-out):</span>
                      <span className="font-bold text-white">Até às {hotelConfig.checkOutHorario}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-200">Café da Manhã:</span>
                      <span className="font-bold text-amber-300">{hotelConfig.cafeInicio} às {hotelConfig.cafeFim}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-200">Horário de Silêncio:</span>
                      <span className="font-bold text-indigo-300">{hotelConfig.silencioInicio} às {hotelConfig.silencioFim}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-200">Área de Lazer / Piscina:</span>
                      <span className="font-bold text-white">{hotelConfig.lazerInicio} às {hotelConfig.lazerFim}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">Recepção:</span>
                      <span className="font-bold text-emerald-300">
                        {hotelConfig.recepcao24Horas ? '24 Horas Disponível' : `${hotelConfig.recepcaoInicio} às ${hotelConfig.recepcaoFim}`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      Tolerância Check-out: <strong>{hotelConfig.toleranciaCheckOutMinutos} min</strong>
                    </span>
                    <button onClick={() => setActiveSubTab('horarios')} className="text-emerald-300 font-bold hover:underline flex items-center gap-1 cursor-pointer">
                      <span className="material-symbols-outlined text-sm">open_in_new</span> Ver regras
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

          {/* ================================================================= */}
          {/* ABA: PEDIDOS & RECEPÇÃO                                           */}
          {/* ================================================================= */}
          {activeSubTab === 'pedidos' && (
            <PedidosRecepcaoHospede
              userRole={userRole}
              userName={perfil?.nome || userName}
              userEmail={perfil?.email || userEmail}
              perfil={perfil}
              temCheckinAtivo={perfil?.temCheckinAtivo}
              hotelId={perfil?.hotelId}
              onNavigateBack={() => setActiveSubTab('dashboard')}
            />
          )}

          {/* ================================================================= */}
          {/* ABA: MINHAS RESERVAS                                              */}
          {/* ================================================================= */}
          {activeSubTab === 'minhas-reservas' && (
            <MinhasReservasHospede
              userRole={userRole}
              userName={perfil?.nome || userName}
              userEmail={perfil?.email || userEmail}
              onNavigateBack={() => setActiveSubTab('dashboard')}
            />
          )}

          {/* ================================================================= */}
          {/* ABA: HORÁRIOS & COMODIDADES DO HOTEL                              */}
          {/* ================================================================= */}
          {activeSubTab === 'horarios' && (
            <div className="space-y-6 max-w-5xl animate-in fade-in duration-200">
              {/* Cabeçalho da Aba */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveSubTab('dashboard')}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    title="Voltar para a Visão Geral"
                  >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                  </button>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600">schedule</span>
                      Horários & Informações do Hotel
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Consulte os horários oficiais, refeições, lazer e normas de convivência da sua estadia
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://wa.me/55${(perfil?.hotelWhatsapp || '66981585014').replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá! Sou o hóspede ${perfil?.nome || userName} e gostaria de tirar uma dúvida sobre os horários e serviços do hotel.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    Falar com a Recepção
                  </a>
                </div>
              </div>

              {/* Grid com os 4 Cards Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Entrada e Saída */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">hotel</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">Entrada & Saída</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Check-in/Out
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Horário de Check-in:</div>
                        <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                          <span className="material-symbols-outlined text-emerald-600 text-base">login</span>
                          A partir das {hotelConfig.checkInHorario}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Horário de Check-out:</div>
                        <div className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                          <span className="material-symbols-outlined text-amber-600 text-base">logout</span>
                          Até às {hotelConfig.checkOutHorario}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-600">timelapse</span>
                    <span>Tolerância de <strong>{hotelConfig.toleranciaCheckOutMinutos} minutos</strong> sem taxa</span>
                  </div>
                </div>

                {/* 2. Café da Manhã */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">bakery_dining</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">Café da Manhã</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        Incluso
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium">Buffet Completo:</div>
                      <div className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <span>{hotelConfig.cafeInicio}</span>
                        <span className="text-sm font-semibold text-slate-400">às</span>
                        <span>{hotelConfig.cafeFim}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Pães artesanais, bolos, frios, frutas frescas, sucos naturais e café colonial servidos no restaurante principal.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-600">restaurant</span>
                    <span>Salão de Refeições Principal</span>
                  </div>
                </div>

                {/* 3. Horário de Silêncio */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">volume_off</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">Horário de Silêncio</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Repouso
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium">Período Noturno:</div>
                      <div className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <span>{hotelConfig.silencioInicio}</span>
                        <span className="text-sm font-semibold text-slate-400">às</span>
                        <span>{hotelConfig.silencioFim}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Para o bem-estar e repouso de todos os hóspedes, é vedado o uso de aparelhos de som e barulho excessivo nos corredores.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-600">bedtime</span>
                    <span>Tranquilidade nos quartos</span>
                  </div>
                </div>

                {/* 4. Recepção & Lazer */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">concierge</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">Recepção & Lazer</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        {hotelConfig.recepcao24Horas ? '24 Horas' : 'Comodidades'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Atendimento da Recepção:</div>
                        <div className="text-sm font-extrabold text-teal-800 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200 mt-0.5 inline-block">
                          {hotelConfig.recepcao24Horas ? '24 Horas por dia' : `${hotelConfig.recepcaoInicio} às ${hotelConfig.recepcaoFim}`}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-400 font-medium">Área de Lazer & Piscina:</div>
                        <div className="text-base font-black text-slate-900 flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-emerald-600 text-base">pool</span>
                          {hotelConfig.lazerInicio} às {hotelConfig.lazerFim}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-teal-600">verified</span>
                    <span>Toalhas disponíveis na recepção</span>
                  </div>
                </div>
              </div>

              {/* Seção Complementar: Regras & Políticas da Propriedade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Card de Regras Gerais */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">policy</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">Políticas & Regras da Estadia</h4>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="material-symbols-outlined text-emerald-600 text-base mt-0.5">pets</span>
                      <div>
                        <strong className="text-slate-800">Animais de Estimação (Pet Friendly):</strong>
                        <p className="text-slate-600 mt-0.5">
                          {hotelConfig.permitePet === 'sim'
                            ? 'São permitidos animais de estimação.'
                            : hotelConfig.permitePet === 'sob_consulta'
                            ? 'Permitido mediante consulta prévia com a administração.'
                            : 'Não são permitidos animais de estimação.'}
                          {hotelConfig.taxaPet > 0 && ` (Taxa de limpeza: R$ ${hotelConfig.taxaPet.toFixed(2).replace('.', ',')})`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="material-symbols-outlined text-red-600 text-base mt-0.5">smoke_free</span>
                      <div>
                        <strong className="text-slate-800">Ambiente Livre de Fumo:</strong>
                        <p className="text-slate-600 mt-0.5">
                          {hotelConfig.proibidoFumar
                            ? 'É estritamente proibido fumar nos quartos e dependências internas fechadas do hotel (Lei Federal antifumo).'
                            : 'Fumo permitido apenas em áreas externas abertas e demarcadas.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="material-symbols-outlined text-blue-600 text-base mt-0.5">assignment_return</span>
                      <div>
                        <strong className="text-slate-800">Política de Cancelamento:</strong>
                        <p className="text-slate-600 mt-0.5">
                          {hotelConfig.politicaCancelamentoTexto || 'Cancelamento flexível até 7 dias antes do check-in.'}
                        </p>
                      </div>
                    </div>

                    {hotelConfig.regrasGeraisTexto && (
                      <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-slate-700">
                        <strong className="text-emerald-900 block mb-1">Orientações de Convivência:</strong>
                        <p className="text-[11px] leading-relaxed text-slate-600">{hotelConfig.regrasGeraisTexto}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card de Informações e Suporte */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg">support_agent</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">Atendimento & Apoio ao Hóspede</h4>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Wi-Fi de Alta Velocidade:</span>
                        <strong className="text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          {perfil?.hotelWifi || 'HotelNoZap_VIP'}
                        </strong>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Ramal da Recepção no Quarto:</span>
                        <strong className="text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          Ramal 9
                        </strong>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Privacidade & LGPD:</span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">verified</span>
                          Conforme Lei 13.709/18
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <button
                      onClick={() => setActiveSubTab('pedidos')}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-base text-emerald-400">room_service</span>
                      <span>Solicitar Serviço de Quarto / Toalhas</span>
                    </button>
                    <button
                      onClick={() => setActiveSubTab('dashboard')}
                      className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Voltar ao Painel Principal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA: MEUS DADOS CADASTRAIS                                        */}
          {/* ================================================================= */}
          {activeSubTab === 'dados-cadastrais' && (
            <MeusDadosCadastrais
              userRole={userRole}
              userName={perfil?.nome || userName}
              userEmail={perfil?.email || userEmail}
              onNavigateBack={() => setActiveSubTab('dashboard')}
              onNavigateToLogin={onNavigateToLogin}
            />
          )}

          {/* ================================================================= */}
          {/* ABA: SEGURANÇA & SENHA                                            */}
          {/* ================================================================= */}
          {activeSubTab === 'seguranca' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">lock</span>
                  Segurança & Alteração de Senha
                </h3>
                <p className="text-xs text-slate-500 mt-1">Altere sua senha de acesso ao portal do hóspede no Supabase Auth</p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const target = e.target as any;
                  const nova = target[1]?.value;
                  const confirma = target[2]?.value;
                  if (!nova || nova.length < 6) {
                    showToast('A nova senha deve ter no mínimo 6 caracteres.');
                    return;
                  }
                  if (nova !== confirma) {
                    showToast('As senhas não coincidem.');
                    return;
                  }
                  try {
                    const { error } = await supabase.auth.updateUser({ password: nova });
                    if (error) throw error;
                    showToast('Senha atualizada com sucesso no Supabase Auth!');
                    target.reset();
                  } catch (err: any) {
                    showToast(err?.message || 'Erro ao alterar senha.');
                  }
                }}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Senha Atual</label>
                  <input type="password" required className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003400]" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nova Senha</label>
                  <input type="password" required className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003400]" placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Confirmar Nova Senha</label>
                  <input type="password" required className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003400]" placeholder="Repita a nova senha" />
                </div>
                <div className="pt-2">
                  <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#003400] text-white font-bold text-xs hover:bg-[#002200] transition cursor-pointer">
                    Atualizar Senha no Supabase
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================================================================= */}
          {/* ABA: EXTRATO DE CONSUMO COMPLETO                                  */}
          {/* ================================================================= */}
          {activeSubTab === 'consumo' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600">receipt_long</span>
                    Extrato de Consumo Completo (Quarto 204)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Lançamentos detalhados de frigobar, restaurante e serviços</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => showToast('Comprovante gerado em PDF!')} className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    Imprimir / PDF
                  </button>
                  <button onClick={() => setIsPixModalOpen(true)} className="px-4 py-2 rounded-xl bg-[#003400] text-white text-xs font-bold shadow-md">
                    Pagar via PIX
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {consumo.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{item.descricao}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {item.dataHora} • Local: <strong className="text-slate-700">{item.local}</strong>
                      </div>
                    </div>
                    <span className="font-black text-slate-900 text-base">R$ {item.valor.toFixed(2).replace('.', ',')}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold">
                <span className="text-slate-700">TOTAL ACUMULADO</span>
                <span className="text-xl text-slate-900">R$ {totalConsumo.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          )}
        </main>

        {/* ========================================================================= */}
        {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA (MOBILE 390px)                           */}
        {/* ========================================================================= */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 py-1.5 shadow-lg flex justify-around items-center">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold ${
              activeSubTab === 'dashboard' ? 'text-[#003400]' : 'text-slate-500'
            }`}
          >
            <div className={`w-8 h-7 rounded-full flex items-center justify-center mb-0.5 ${activeSubTab === 'dashboard' ? 'bg-emerald-100' : ''}`}>
              <span className="material-symbols-outlined text-[20px]">hotel</span>
            </div>
            <span className="text-[10px] tracking-tight">Estadia</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pedidos')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold ${
              activeSubTab === 'pedidos' ? 'text-[#003400]' : 'text-slate-500'
            }`}
          >
            <div className={`w-8 h-7 rounded-full flex items-center justify-center mb-0.5 ${activeSubTab === 'pedidos' ? 'bg-emerald-100' : ''}`}>
              <span className="material-symbols-outlined text-[20px]">room_service</span>
            </div>
            <span className="text-[10px] tracking-tight">Pedidos</span>
          </button>

          <button
            onClick={() => setActiveSubTab('consumo')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold ${
              activeSubTab === 'consumo' ? 'text-[#003400]' : 'text-slate-500'
            }`}
          >
            <div className={`w-8 h-7 rounded-full flex items-center justify-center mb-0.5 ${activeSubTab === 'consumo' ? 'bg-emerald-100' : ''}`}>
              <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            </div>
            <span className="text-[10px] tracking-tight">Consumo</span>
          </button>

          <button
            onClick={() => setActiveSubTab('dados-cadastrais')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold ${
              activeSubTab === 'dados-cadastrais' ? 'text-[#003400]' : 'text-slate-500'
            }`}
          >
            <div className={`w-8 h-7 rounded-full flex items-center justify-center mb-0.5 ${activeSubTab === 'dados-cadastrais' ? 'bg-emerald-100' : ''}`}>
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </div>
            <span className="text-[10px] tracking-tight">Perfil</span>
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* MODAL INTELIGENTE DE CONFIRMAÇÃO DE SOLICITAÇÃO                            */}
      {/* ========================================================================= */}
      {isConfirmModalOpen && confirmingAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative border border-slate-100 font-sans text-slate-800">
            {/* Botão Fechar */}
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            {/* Topo do Modal */}
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200/80 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <span className="material-symbols-outlined text-3xl">{confirmingAction.icone || 'room_service'}</span>
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                {confirmingAction.categoria === 'Mensagem Especial' ? 'Notificação Direta para Recepção' : 'Notificação Inteligente'}
              </div>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                {confirmingAction.categoria === 'Mensagem Especial' ? 'Confirmar Envio da Mensagem?' : 'Confirmar Solicitação de Quarto?'}
              </h3>
              <p className="text-xs text-slate-500">
                {confirmingAction.categoria === 'Mensagem Especial'
                  ? <>Deseja enviar este aviso diretamente para a equipe de recepção do <strong>{perfil?.hotelNome || 'Hotel'}</strong>?</>
                  : <>Deseja enviar este pedido para a equipe de recepção do <strong>{perfil?.hotelNome || 'Hotel'}</strong>?</>}
              </p>
            </div>

            {/* Card de Detalhes da Solicitação ou Mensagem */}
            {confirmingAction.categoria === 'Mensagem Especial' ? (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                    Mensagem / Observação Especial
                  </span>
                  <span className="text-[10px] font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    Recepção 24h
                  </span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/60 text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed shadow-inner">
                  "{confirmingAction.nome}"
                </div>
                <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Acomodação</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-bold text-slate-700">Quarto:</span>
                      <input
                        type="text"
                        value={quartoConfirmacao}
                        onChange={(e) => setQuartoConfirmacao(e.target.value)}
                        placeholder="Ex: 100"
                        className="w-16 px-2 py-0.5 text-xs font-black text-slate-900 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Hóspede Solicitante</span>
                    <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
                      {perfil?.nome || formData.nome || userName}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{confirmingAction.categoria}</span>
                    <h4 className="text-sm font-extrabold text-slate-900">{confirmingAction.nome}</h4>
                    <p className="text-xs text-slate-500">{confirmingAction.subtitulo}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor</span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {confirmingAction.preco}
                    </span>
                  </div>
                </div>

                {/* Informações de Destino / Acomodação */}
                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">Acomodação de Entrega</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-bold text-slate-700">Quarto:</span>
                      <input
                        type="text"
                        value={quartoConfirmacao}
                        onChange={(e) => setQuartoConfirmacao(e.target.value)}
                        placeholder="Ex: 100"
                        className="w-16 px-2 py-0.5 text-xs font-black text-slate-900 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block">Hóspede Solicitante</span>
                    <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
                      {perfil?.nome || formData.nome || userName}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Campo Opcional de Instruções / Observação (apenas para itens de catálogo) */}
            {confirmingAction.categoria !== 'Mensagem Especial' && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Observações ou instruções adicionais (opcional):
                </label>
                <textarea
                  value={observacaoSolicitacao}
                  onChange={(e) => setObservacaoSolicitacao(e.target.value)}
                  placeholder="Ex: Pode deixar na porta, entregar urgente, preferência sem gás..."
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                ></textarea>
              </div>
            )}

            {/* Alerta de Notificação em Tempo Real */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">
              <span className="material-symbols-outlined text-emerald-700 text-lg shrink-0 mt-0.5 animate-bounce">
                notifications_active
              </span>
              <p className="text-[11px] leading-relaxed">
                Ao clicar em <strong>Sim, {confirmingAction.categoria === 'Mensagem Especial' ? 'Enviar Mensagem' : 'Confirmar'}</strong>, um <strong>alerta sonoro e visual em tempo real</strong> será disparado imediatamente no painel da recepção do hotel com a sua solicitação.
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="py-3 px-4 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors text-center cursor-pointer"
              >
                Não, Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEnvioSolicitacao}
                className="py-3 px-4 rounded-xl bg-[#003400] hover:bg-[#002600] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                {confirmingAction.categoria === 'Mensagem Especial' ? 'Sim, Enviar Mensagem' : 'Sim, Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE PAGAMENTO VIA PIX                                                */}
      {/* ========================================================================= */}
      {isPixModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative">
            <button onClick={() => setIsPixModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <span className="material-symbols-outlined text-2xl">qr_code_2</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Pagamento via PIX</h3>
              <p className="text-xs text-slate-500">
                {perfil?.quartoNumero && perfil.quartoNumero !== '—' ? `Quarto ${perfil.quartoNumero}` : 'Acomodação'} • Extrato de Consumo
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-3">
              <span className="text-xs font-bold text-slate-500 block uppercase">Valor Total do Consumo</span>
              <div className="text-3xl font-black text-slate-900">
                R$ {totalConsumo.toFixed(2).replace('.', ',')}
              </div>

              {/* QR Code Simulado */}
              <div className="w-44 h-44 bg-white border border-slate-300 rounded-xl p-2 mx-auto flex items-center justify-center shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=HOTELNOZAP-PIX-SUITE204-${totalConsumo}`}
                  alt="QR Code PIX"
                  className="w-full h-full object-contain"
                />
              </div>

              <p className="text-[11px] text-slate-500">Abra o app do seu banco e escaneie o código acima</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCopiarPix}
                className="w-full py-3 rounded-xl bg-[#003400] hover:bg-[#002600] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-base">{pixCopied ? 'check' : 'content_copy'}</span>
                {pixCopied ? 'Chave PIX Copiada!' : 'Copiar Chave PIX (Copia e Cola)'}
              </button>

              <button
                onClick={() => setIsPixModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE NOVO PEDIDO PERSONALIZADO                                        */}
      {/* ========================================================================= */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setIsNewOrderModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">room_service</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Novo Pedido para {perfil?.quartoNumero && perfil.quartoNumero !== '—' ? `o Quarto ${perfil.quartoNumero}` : 'sua Acomodação'}
                </h3>
                <p className="text-xs text-slate-500">Solicite qualquer item ou serviço da recepção</p>
              </div>
            </div>

            <form onSubmit={handleEnviarPedidoPersonalizado} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição da Solicitação</label>
                <textarea
                  value={customRequestText}
                  onChange={(e) => setCustomRequestText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  rows={4}
                  placeholder="Ex: Favor trazer 2 toalhas de piscina e um secador de cabelo..."
                  required
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!customRequestText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#003400] text-white font-bold disabled:opacity-50"
                >
                  Enviar para Recepção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AreaHospede;
