import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HotelAtivo, quartosService, currentHotelService } from '../services/supabaseService';
import { Room } from './MapaQuartos';

export interface GestaoGovernancaProps {
  activeHotel?: HotelAtivo;
  onBackToDashboard?: () => void;
  onNavigateToMapa?: () => void;
}

export interface RegistroLimpezaHistorico {
  id: string;
  quartoId?: string;
  numero: string;
  categoria?: string;
  andar?: string;
  limpoPor: string;
  camareiraId?: string;
  horarioInicio?: string;
  horarioConclusao: string;
  dataConclusao: string;
  dataHoraFormatada?: string;
  tempoGastoMinutos: number;
  tipoArrumacao?: string;
  servicosRealizados?: string[];
  observacoes?: string;
}

export const GestaoGovernanca: React.FC<GestaoGovernancaProps> = ({
  activeHotel,
  onBackToDashboard,
  onNavigateToMapa
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [historico, setHistorico] = useState<RegistroLimpezaHistorico[]>([]);
  const [cacheHousekeeping, setCacheHousekeeping] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filtroTab, setFiltroTab] = useState<'ativos' | 'historico' | 'todos'>('ativos');
  const [filtroData, setFiltroData] = useState<'hoje' | 'ontem' | '7dias' | 'todos'>('hoje');
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const hotelId = activeHotel?.id || currentHotelService.getCurrentHotel()?.id || '';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carregar dados de quartos e histórico
  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    try {
      const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
      if (!hId) {
        setIsLoading(false);
        return;
      }

      // 1. Quartos do hotel
      const dataQuartos = await quartosService.getQuartos(hId);
      setRooms(dataQuartos || []);

      // 2. Cache local de housekeeping (camareira_dados)
      try {
        const rawCache = localStorage.getItem(`hotelnozap_camareira_dados_${hId}`) || 
                         localStorage.getItem('hotelnozap_camareira_dados');
        if (rawCache) {
          setCacheHousekeeping(JSON.parse(rawCache));
        } else {
          setCacheHousekeeping({});
        }
      } catch {
        setCacheHousekeeping({});
      }

      // 3. Histórico de limpeza persistido
      try {
        const rawHist = localStorage.getItem(`hotelnozap_historico_limpeza_${hId}`);
        if (rawHist) {
          const parsed = JSON.parse(rawHist);
          if (Array.isArray(parsed)) {
            setHistorico(parsed);
          }
        } else {
          setHistorico([]);
        }
      } catch {
        setHistorico([]);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados de governança:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    carregarDados();

    // Atualiza relógio / tempo decorrido a cada 30 segundos
    const intervalTimer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 30000);

    // Ouvintes de tempo real para quartos e storage
    const unsubscribe = quartosService.subscribeQuartos ? quartosService.subscribeQuartos(() => {
      carregarDados();
    }) : () => {};

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && (e.key.includes('historico_limpeza') || e.key.includes('camareira_dados'))) {
        carregarDados();
      }
    };

    const handleCustomEvents = () => {
      carregarDados();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('hotel_quarto_atualizado', handleCustomEvents);
    window.addEventListener('hotel_changed', handleCustomEvents);

    return () => {
      clearInterval(intervalTimer);
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('hotel_quarto_atualizado', handleCustomEvents);
      window.removeEventListener('hotel_changed', handleCustomEvents);
    };
  }, [carregarDados]);

  // Função auxiliar para extrair detalhes de quem está limpando e início
  const getDetalhesLimpeza = (room: Room) => {
    const hk = (room as any).items?.housekeeping || (room as any).housekeeping;
    const cache = cacheHousekeeping[room.id] || {};

    const camareiraNome = hk?.camareira_nome || cache.camareiraNome || null;
    const inicioLimpeza = hk?.inicio_limpeza || cache.inicioLimpeza || null;

    let tempoDecorridoMin = 0;
    if (inicioLimpeza) {
      const diffMs = nowTimestamp - new Date(inicioLimpeza).getTime();
      tempoDecorridoMin = Math.max(1, Math.round(diffMs / 60000));
    } else if (cache.tempoDecorrido) {
      tempoDecorridoMin = cache.tempoDecorrido;
    }

    const estaEmLimpeza = room.status === 'limpeza' || room.status === 'ocupado_em_limpeza';
    const temCamareira = Boolean(camareiraNome);

    return {
      estaEmLimpeza,
      temCamareira,
      camareiraNome: camareiraNome || 'Aguardando camareira assumir',
      inicioLimpeza,
      tempoDecorridoMin
    };
  };

  // Separação de quartos
  const quartosEmLimpeza = useMemo(() => {
    return rooms.filter(r => r.status === 'limpeza' || r.status === 'ocupado_em_limpeza');
  }, [rooms]);

  const quartosEmAndamento = useMemo(() => {
    return quartosEmLimpeza.filter(r => {
      const d = getDetalhesLimpeza(r);
      return d.temCamareira;
    });
  }, [quartosEmLimpeza, cacheHousekeeping, nowTimestamp]);

  const quartosAguardando = useMemo(() => {
    return quartosEmLimpeza.filter(r => {
      const d = getDetalhesLimpeza(r);
      return !d.temCamareira;
    });
  }, [quartosEmLimpeza, cacheHousekeeping]);

  // Datas para filtro do histórico
  const todayYmd = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const yesterdayYmd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const historicoFiltrado = useMemo(() => {
    let list = [...historico];

    // Filtro por Data
    if (filtroData === 'hoje') {
      list = list.filter(h => h.dataConclusao === todayYmd);
    } else if (filtroData === 'ontem') {
      list = list.filter(h => h.dataConclusao === yesterdayYmd);
    } else if (filtroData === '7dias') {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      const minDate = seteDiasAtras.toISOString().split('T')[0];
      list = list.filter(h => h.dataConclusao >= minDate);
    }

    // Busca textual (quarto ou camareira)
    if (termoBusca.trim()) {
      const t = termoBusca.toLowerCase().trim();
      list = list.filter(h => 
        String(h.numero).toLowerCase().includes(t) ||
        (h.limpoPor && h.limpoPor.toLowerCase().includes(t)) ||
        (h.categoria && h.categoria.toLowerCase().includes(t)) ||
        (h.observacoes && h.observacoes.toLowerCase().includes(t))
      );
    }

    return list;
  }, [historico, filtroData, termoBusca, todayYmd, yesterdayYmd]);

  // Estatísticas do Topo
  const stats = useMemo(() => {
    const hojeLimpos = historico.filter(h => h.dataConclusao === todayYmd);
    const totalMinutosHoje = hojeLimpos.reduce((acc, curr) => acc + (curr.tempoGastoMinutos || 25), 0);
    const mediaMinutosHoje = hojeLimpos.length > 0 ? Math.round(totalMinutosHoje / hojeLimpos.length) : 0;

    return {
      emAndamento: quartosEmAndamento.length,
      aguardando: quartosAguardando.length,
      totalEmLimpeza: quartosEmLimpeza.length,
      limposHoje: hojeLimpos.length,
      mediaMinutosHoje: mediaMinutosHoje || 25
    };
  }, [quartosEmAndamento, quartosAguardando, quartosEmLimpeza, historico, todayYmd]);

  // Ação de liberar quarto diretamente pelo hotel caso o gestor precise
  const handleLiberarQuartoPeloHotel = async (room: Room) => {
    if (!window.confirm(`Deseja confirmar e liberar o Quarto ${room.number} como limpo?`)) {
      return;
    }
    try {
      const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
      await quartosService.updateQuarto(room.id, {
        status: 'livre',
        housekeeping: {
          hkStatus: 'pronto',
          liberado_por_hotel: true
        }
      }, hId);

      // Registra no histórico
      const now = new Date();
      const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const det = getDetalhesLimpeza(room);
      const tempo = det.tempoDecorridoMin || 20;

      const novoHist: RegistroLimpezaHistorico = {
        id: `liberado_hotel_${room.id}_${Date.now()}`,
        quartoId: room.id,
        numero: String(room.number),
        categoria: room.category || 'Standard',
        andar: String(room.floor || '1º Andar'),
        limpoPor: det.temCamareira ? det.camareiraNome : 'Equipe de Governança',
        horarioConclusao: horaStr,
        dataConclusao: todayYmd,
        tempoGastoMinutos: tempo,
        tipoArrumacao: 'Higienização Padrão',
        servicosRealizados: ['Higienização Completa', 'Inspeção e Liberação pelo Hotel'],
        observacoes: 'Liberado através do painel de Governança do Hotel'
      };

      const nextHist = [novoHist, ...historico];
      setHistorico(nextHist);
      localStorage.setItem(`hotelnozap_historico_limpeza_${hId}`, JSON.stringify(nextHist));

      showToast(`✅ Quarto ${room.number} liberado e marcado como limpo!`);
      carregarDados();
    } catch (err) {
      console.warn('Erro ao liberar quarto:', err);
      showToast('❌ Erro ao atualizar o quarto. Tente novamente.');
    }
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 animate-in fade-in">
      {/* Toast de Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
              Gestão do Hotel
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {activeHotel?.name || currentHotelService.getCurrentHotel()?.name || 'Hotel'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1c30] tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-700 text-3xl">cleaning_services</span>
            Governança &amp; Higienização
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Acompanhamento em tempo real dos quartos sendo higienizados, equipe responsável e tempo de conclusão.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          {onNavigateToMapa && (
            <button
              type="button"
              onClick={onNavigateToMapa}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
            >
              <span className="material-symbols-outlined text-base">calendar_view_month</span>
              <span>Mapa dos Quartos</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => carregarDados()}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm active:scale-95"
            title="Atualizar dados de governança"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Sendo Limpos Agora */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Em Limpeza Agora</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">autorenew</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-950 block">{stats.emAndamento}</span>
            <span className="text-[11px] text-amber-800 font-medium block mt-0.5">
              Com camareira em atendimento
            </span>
          </div>
        </div>

        {/* Card 2: Aguardando Camareira */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-orange-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-900 uppercase tracking-wider">Aguardando Início</span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">hourglass_empty</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-orange-950 block">{stats.aguardando}</span>
            <span className="text-[11px] text-orange-800 font-medium block mt-0.5">
              Quartos pós-checkout na fila
            </span>
          </div>
        </div>

        {/* Card 3: Limpos Hoje */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Higienizados Hoje</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-950 block">{stats.limposHoje}</span>
            <span className="text-[11px] text-emerald-800 font-medium block mt-0.5">
              Liberados para check-in
            </span>
          </div>
        </div>

        {/* Card 4: Tempo Médio de Limpeza */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">Tempo Médio</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">timer</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-blue-950 block">{stats.mediaMinutosHoje} min</span>
            <span className="text-[11px] text-blue-800 font-medium block mt-0.5">
              Média por quarto hoje
            </span>
          </div>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO E CONTROLE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Seletor de Abas */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFiltroTab('ativos')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              filtroTab === 'ativos'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">cleaning_services</span>
            <span>Em Limpeza ({quartosEmLimpeza.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTab('historico')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              filtroTab === 'historico'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">history</span>
            <span>Histórico Concluído ({historico.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTab('todos')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              filtroTab === 'todos'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">meeting_room</span>
            <span>Todos os Quartos ({rooms.length})</span>
          </button>
        </div>

        {/* Busca Rápida */}
        <div className="relative min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar quarto ou camareira..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
          />
          {termoBusca && (
            <button
              type="button"
              onClick={() => setTermoBusca('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: ABA 1 - QUARTOS EM LIMPEZA AGORA */}
      {filtroTab === 'ativos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">cleaning_services</span>
              <span>Acompanhamento em Tempo Real dos Quartos</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {quartosEmLimpeza.length} acomodação(ões) na rotina de governança
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <span className="material-symbols-outlined text-3xl text-emerald-700 animate-spin">sync</span>
              <p className="text-xs text-slate-500 mt-2 font-semibold">Carregando quartos em limpeza...</p>
            </div>
          ) : quartosEmLimpeza.length === 0 ? (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-8 text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">task_alt</span>
              </div>
              <h3 className="text-base font-bold text-emerald-950">Nenhum Quarto Aguardando ou em Limpeza no Momento</h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                Todos os quartos do hotel estão higienizados, livres para locação ou ocupados pelos hóspedes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quartosEmLimpeza
                .filter(r => {
                  if (!termoBusca.trim()) return true;
                  const t = termoBusca.toLowerCase().trim();
                  const det = getDetalhesLimpeza(r);
                  return (
                    String(r.number).toLowerCase().includes(t) ||
                    det.camareiraNome.toLowerCase().includes(t) ||
                    (r.category && r.category.toLowerCase().includes(t))
                  );
                })
                .map(room => {
                  const det = getDetalhesLimpeza(room);

                  return (
                    <div
                      key={room.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
                    >
                      {/* Header do Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-mono font-bold text-emerald-700 uppercase tracking-wider block">
                            {room.category || 'Standard'} • {room.floor || '1º Andar'}
                          </span>
                          <h3 className="text-2xl font-black text-slate-900 leading-tight">
                            Quarto {room.number}
                          </h3>
                        </div>

                        {det.temCamareira ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Em Higienização</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1 shrink-0">
                            <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                            <span>Aguardando Início</span>
                          </span>
                        )}
                      </div>

                      {/* Informações Centrais: Quem está limpando e Tempo */}
                      <div className="bg-[#f8f9ff] p-3.5 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                            Quem está limpando:
                          </span>
                          <span className={`font-bold ${det.temCamareira ? 'text-emerald-950 font-black' : 'text-amber-800 italic'}`}>
                            {det.camareiraNome}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                          <span className="text-slate-500 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                            Tempo em limpeza:
                          </span>
                          {det.temCamareira ? (
                            <span className="font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                              <span>⏱️ Há {det.tempoDecorridoMin} min</span>
                              {det.inicioLimpeza && (
                                <span className="text-[10px] text-slate-500">
                                  ({new Date(det.inicioLimpeza).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">
                              Aguardando camareira assumir
                            </span>
                          )}
                        </div>

                        {room.status === 'ocupado_em_limpeza' && (
                          <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-blue-900 bg-blue-50/70 p-1.5 rounded-lg">
                            ℹ️ Quarto ocupado por hóspede com solicitação de arrumação diária.
                          </div>
                        )}
                      </div>

                      {/* Ações Rápidas do Hotel */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          Status: <strong className="text-slate-800">{room.status}</strong>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleLiberarQuartoPeloHotel(room)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 shrink-0"
                          title="Liberar Quarto e Marcar Limpo"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Marcar Limpo</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: ABA 2 - HISTÓRICO DE QUARTOS LIMPOS E TEMPOS GASTOS */}
      {filtroTab === 'historico' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700">history_edu</span>
                <span>Histórico de Higienização Concluída &amp; Produtividade</span>
              </h2>
              <p className="text-xs text-slate-500">
                Auditoria de quem limpou cada quarto, horários e tempo exato de serviço.
              </p>
            </div>

            {/* Filtro de Período */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setFiltroData('hoje')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filtroData === 'hoje' ? 'bg-white text-emerald-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setFiltroData('ontem')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filtroData === 'ontem' ? 'bg-white text-emerald-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={() => setFiltroData('7dias')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filtroData === '7dias' ? 'bg-white text-emerald-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Últimos 7 Dias
              </button>
              <button
                type="button"
                onClick={() => setFiltroData('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filtroData === 'todos' ? 'bg-white text-emerald-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {historicoFiltrado.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-400">inbox</span>
              <h3 className="text-sm font-bold text-slate-800">Nenhum registro de limpeza encontrado neste período</h3>
              <p className="text-xs text-slate-500">
                Os novos quartos limpos pelas camareiras aparecerão aqui com data, horários e minutos gastos.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#f8f9ff] text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Quarto</th>
                      <th className="px-4 py-3">Quem Limpou</th>
                      <th className="px-4 py-3">Tempo de Limpeza</th>
                      <th className="px-4 py-3">Horário Conclusão</th>
                      <th className="px-4 py-3">Serviços / Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historicoFiltrado.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-extrabold text-slate-900 text-sm">
                            Quarto {item.numero}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.categoria || 'Standard'} • {item.andar || '1º Andar'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-emerald-700">badge</span>
                            <span>{item.limpoPor || 'Camareira'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Equipe de Governança
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold font-mono text-xs">
                            <span className="material-symbols-outlined text-sm text-emerald-700">timer</span>
                            <span>{item.tempoGastoMinutos || 25} min</span>
                          </div>
                          {item.horarioInicio && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              {item.horarioInicio} às {item.horarioConclusao}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">
                            {item.horarioConclusao}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.dataConclusao}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 max-w-xs">
                          {item.servicosRealizados && item.servicosRealizados.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {item.servicosRealizados.slice(0, 3).map((serv, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold border border-slate-200"
                                >
                                  ✓ {serv}
                                </span>
                              ))}
                              {item.servicosRealizados.length > 3 && (
                                <span className="text-[9px] text-slate-500 font-bold">
                                  +{item.servicosRealizados.length - 3} itens
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Higienização Padrão</span>
                          )}

                          {item.observacoes && (
                            <div className="text-[11px] text-amber-900 bg-amber-50/80 border border-amber-200/60 p-1.5 rounded text-xs mt-1 italic">
                              &quot;{item.observacoes}&quot;
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: ABA 3 - TODOS OS QUARTOS (STATUS GERAL) */}
      {filtroTab === 'todos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-700">domain</span>
              <span>Visão Geral das Acomodações</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              Total de {rooms.length} quartos cadastrados
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rooms
              .filter(r => {
                if (!termoBusca.trim()) return true;
                const t = termoBusca.toLowerCase().trim();
                return (
                  String(r.number).toLowerCase().includes(t) ||
                  (r.category && r.category.toLowerCase().includes(t)) ||
                  (r.status && r.status.toLowerCase().includes(t))
                );
              })
              .map(room => {
                const det = getDetalhesLimpeza(room);
                const isLimpeza = room.status === 'limpeza' || room.status === 'ocupado_em_limpeza';
                const isLivre = room.status === 'livre';

                return (
                  <div
                    key={room.id}
                    className={`p-3.5 rounded-xl border text-center transition-all ${
                      isLimpeza
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30'
                        : isLivre
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">
                      {room.floor || '1º Andar'}
                    </span>
                    <span className="text-xl font-black text-slate-900 block my-1">
                      {room.number}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                        isLimpeza
                          ? 'bg-amber-200 text-amber-900'
                          : isLivre
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {room.status}
                    </span>

                    {isLimpeza && (
                      <span className="text-[10px] font-bold text-amber-950 block mt-2 line-clamp-1">
                        {det.camareiraNome}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoGovernanca;
