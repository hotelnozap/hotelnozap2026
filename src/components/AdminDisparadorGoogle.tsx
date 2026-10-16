import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  disparadorGoogleService,
  HotelGoogleItem,
  DisparoLog,
  TEMPLATES_DISPARO_PADRAO
} from '../services/disparadorGoogleService';
import { evolutionApiService } from '../services/evolutionApiService';

export interface AdminDisparadorGoogleProps {
  onBackToDashboard: () => void;
}

export const AdminDisparadorGoogle: React.FC<AdminDisparadorGoogleProps> = ({ onBackToDashboard }) => {
  // Lista de Hotéis
  const [hoteis, setHoteis] = useState<HotelGoogleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Instâncias Evolution API
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('meutim');

  // Configurações do Lote
  const [cidadeFiltro, setCidadeFiltro] = useState<string>('todas');
  const [apenasCelulares, setApenasCelulares] = useState<boolean>(true);
  const [ignorarJaContatados, setIgnorarJaContatados] = useState<boolean>(true);
  const [tamanhoLote, setTamanhoLote] = useState<number>(30);

  // Antibloqueio Delays
  const [intervaloMin, setIntervaloMin] = useState<number>(60);
  const [intervaloMax, setIntervaloMax] = useState<number>(120);
  const [simularDigitando, setSimularDigitando] = useState<boolean>(true);

  // Template e Spintax
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('recepcao-amiga');
  const [mensagemTemplate, setMensagemTemplate] = useState<string>(TEMPLATES_DISPARO_PADRAO[0].texto);
  const [previewExemplos, setPreviewExemplos] = useState<string[]>([]);

  // Estado da Fila de Execução
  const [filaStatus, setFilaStatus] = useState<'idle' | 'running' | 'paused' | 'finished'>('idle');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [countdownSegundos, setCountdownSegundos] = useState<number>(0);
  const [hotelAtual, setHotelAtual] = useState<HotelGoogleItem | null>(null);

  // Sub-abas do Disparador: 'disparo' | 'lista-hoteis' | 'validador'
  const [activeSubTab, setActiveSubTab] = useState<'disparo' | 'lista-hoteis' | 'validador'>('disparo');

  // Estados da Aba Lista de Hotéis & Pesquisa
  const [buscaTermo, setBuscaTermo] = useState<string>('');
  const [filtroStatusLista, setFiltroStatusLista] = useState<
    'todos' | 'contatados' | 'pendentes' | 'celulares' | 'fixos' | 'wa-ativo' | 'wa-inexistente'
  >('todos');
  const [filtroCidadeLista, setFiltroCidadeLista] = useState<string>('todas');
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(25);

  // Estados do Validador de WhatsApp
  const [numeroAvulso, setNumeroAvulso] = useState<string>('');
  const [validandoAvulso, setValidandoAvulso] = useState<boolean>(false);
  const [resultadoAvulso, setResultadoAvulso] = useState<{
    tested: boolean;
    number: string;
    exists: boolean;
    jid?: string;
    error?: string;
  } | null>(null);

  // Validação em Massa e individual
  const [validandoMassa, setValidandoMassa] = useState<boolean>(false);
  const [massaProgresso, setMassaProgresso] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [validandoHotelId, setValidandoHotelId] = useState<string | null>(null);

  // Logs e Cota Diária
  const [logs, setLogs] = useState<DisparoLog[]>([]);
  const [dailySentCount, setDailySentCount] = useState<number>(0);

  // Refs de controle de loop
  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);
  const countdownTimerRef = useRef<any>(null);

  // Carrega dados iniciais
  useEffect(() => {
    carregarDados();
    setDailySentCount(disparadorGoogleService.getDailySentCount());
    setLogs(disparadorGoogleService.getRecentLogs(30));

    // Carrega instâncias da Evolution API
    evolutionApiService.fetchInstances().then(list => {
      if (Array.isArray(list) && list.length > 0) {
        setInstances(list);
        const openInst = list.find((i: any) => i.connectionStatus === 'open');
        if (openInst) setSelectedInstance(openInst.name);
        else setSelectedInstance(list[0].name);
      }
    }).catch(() => {});
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    const data = await disparadorGoogleService.getHoteisGoogle();
    setHoteis(data);
    setLoading(false);
  };

  // Cidades únicas ordenadas
  const cidadesDisponiveis = useMemo(() => {
    const map = new Map<string, number>();
    hoteis.forEach(h => {
      const c = h.cidade.trim();
      if (c && c !== 'Não informada') {
        map.set(c, (map.get(c) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([nome, qtd]) => ({ nome, qtd }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [hoteis]);

  // Hotéis filtrados para envio
  const hoteisFiltrados = useMemo(() => {
    return hoteis.filter(h => {
      if (cidadeFiltro !== 'todas' && h.cidade.toLowerCase() !== cidadeFiltro.toLowerCase()) {
        return false;
      }
      if (apenasCelulares && !h.isMobile) {
        return false;
      }
      if (ignorarJaContatados && h.alreadySent) {
        return false;
      }
      // Pula números que comprovadamente NÃO existem no WhatsApp para proteger o chip
      if (h.waStatus === 'inexistente') {
        return false;
      }
      return true;
    });
  }, [hoteis, cidadeFiltro, apenasCelulares, ignorarJaContatados]);

  // Lista selecionada para o lote atual
  const loteParaEnvio = useMemo(() => {
    return hoteisFiltrados.slice(0, tamanhoLote);
  }, [hoteisFiltrados, tamanhoLote]);

  // Métricas
  const totalHoteis = hoteis.length;
  const totalCelularesValidos = hoteis.filter(h => h.isMobile).length;
  const totalFixos = hoteis.filter(h => h.phoneStatus === 'fixo').length;
  const totalJaContatados = hoteis.filter(h => h.alreadySent).length;
  const totalPendentesEnvio = hoteis.filter(h => h.isMobile && !h.alreadySent && h.waStatus !== 'inexistente').length;
  const totalWaAtivos = hoteis.filter(h => h.waStatus === 'ativo').length;
  const totalWaInexistentes = hoteis.filter(h => h.waStatus === 'inexistente').length;
  const totalWaNaoVerificados = hoteis.filter(h => h.isMobile && (!h.waStatus || h.waStatus === 'nao_verificado')).length;

  // Hotéis filtrados na Aba de Pesquisa / Lista Geral
  const hoteisListaFiltrados = useMemo(() => {
    return hoteis.filter(h => {
      // Filtro por cidade na lista
      if (filtroCidadeLista !== 'todas' && h.cidade.toLowerCase() !== filtroCidadeLista.toLowerCase()) {
        return false;
      }

      // Filtro por status
      if (filtroStatusLista === 'contatados' && !h.alreadySent) return false;
      if (filtroStatusLista === 'pendentes' && (!h.isMobile || h.alreadySent || h.waStatus === 'inexistente')) return false;
      if (filtroStatusLista === 'celulares' && !h.isMobile) return false;
      if (filtroStatusLista === 'fixos' && h.phoneStatus !== 'fixo') return false;
      if (filtroStatusLista === 'wa-ativo' && h.waStatus !== 'ativo') return false;
      if (filtroStatusLista === 'wa-inexistente' && h.waStatus !== 'inexistente') return false;

      // Busca por termo (nome, cidade, bairro, telefone)
      if (buscaTermo.trim()) {
        const termo = buscaTermo.toLowerCase().trim();
        const nomeMatch = h.nome.toLowerCase().includes(termo);
        const cidadeMatch = h.cidade.toLowerCase().includes(termo);
        const bairroMatch = (h.bairro || '').toLowerCase().includes(termo);
        const foneRawMatch = (h.rawPhone || '').includes(termo);
        const foneCleanMatch = (h.cleanPhone || '').includes(termo);
        if (!nomeMatch && !cidadeMatch && !bairroMatch && !foneRawMatch && !foneCleanMatch) {
          return false;
        }
      }

      return true;
    });
  }, [hoteis, filtroCidadeLista, filtroStatusLista, buscaTermo]);

  // Paginação da lista geral
  const totalPaginasLista = Math.max(1, Math.ceil(hoteisListaFiltrados.length / itensPorPagina));
  const hoteisPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return hoteisListaFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [hoteisListaFiltrados, paginaAtual, itensPorPagina]);

  // Resetar página quando os filtros mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [buscaTermo, filtroStatusLista, filtroCidadeLista, itensPorPagina]);

  // Atualiza preview de Spintax
  const handleGerarPreviews = () => {
    if (hoteisFiltrados.length === 0) {
      setPreviewExemplos(['Nenhum hotel disponível com os filtros atuais para gerar prévia.']);
      return;
    }
    const amostra = hoteisFiltrados.slice(0, 3);
    const gerados = amostra.map(h => disparadorGoogleService.parseSpintax(mensagemTemplate, h));
    setPreviewExemplos(gerados);
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = TEMPLATES_DISPARO_PADRAO.find(t => t.id === id);
    if (tmpl) {
      setMensagemTemplate(tmpl.texto);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // VALIDADOR DE WHATSAPP (AVULSO, INDIVIDUAL E EM MASSA)
  // ───────────────────────────────────────────────────────────────────────────
  const handleValidarNumeroAvulso = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!numeroAvulso.trim()) {
      alert('Por favor, informe um número de telefone com DDD para testar.');
      return;
    }
    if (!selectedInstance) {
      alert('Selecione uma instância WhatsApp conectada para consultar.');
      return;
    }

    setValidandoAvulso(true);
    setResultadoAvulso(null);

    try {
      const res = await evolutionApiService.checkSingleWhatsAppNumber(selectedInstance, numeroAvulso);
      setResultadoAvulso({
        tested: true,
        number: numeroAvulso,
        exists: res.exists,
        jid: res.jid,
        error: res.error
      });
    } catch (err: any) {
      setResultadoAvulso({
        tested: true,
        number: numeroAvulso,
        exists: false,
        error: err?.message || 'Falha ao consultar Evolution API'
      });
    } finally {
      setValidandoAvulso(false);
    }
  };

  const handleValidarHotelIndividual = async (hotel: HotelGoogleItem) => {
    if (!selectedInstance) {
      alert('Selecione uma instância WhatsApp conectada para validar.');
      return;
    }
    setValidandoHotelId(hotel.id);

    try {
      const res = await disparadorGoogleService.validateSingleHotel(selectedInstance, hotel);
      setHoteis(prev =>
        prev.map(h => {
          if (h.id === hotel.id) {
            return {
              ...h,
              waStatus: res.exists ? 'ativo' : 'inexistente',
              waJid: res.jid,
              waCheckedAt:
                new Date().toLocaleDateString('pt-BR') +
                ' ' +
                new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            };
          }
          return h;
        })
      );
    } catch (err) {
      console.warn('Erro ao validar hotel individual:', err);
    } finally {
      setValidandoHotelId(null);
    }
  };

  const handleValidarEmMassa = async (loteAlvo: 'todos-celulares' | 'cidade-atual' | 'proximos-50') => {
    if (!selectedInstance) {
      alert('Selecione uma instância WhatsApp conectada para validar.');
      return;
    }

    let lista: HotelGoogleItem[] = [];
    if (loteAlvo === 'cidade-atual') {
      lista = hoteis.filter(
        h => h.isMobile && (cidadeFiltro === 'todas' || h.cidade.toLowerCase() === cidadeFiltro.toLowerCase())
      );
    } else if (loteAlvo === 'proximos-50') {
      lista = hoteis.filter(h => h.isMobile && h.waStatus !== 'ativo').slice(0, 50);
    } else {
      lista = hoteis.filter(h => h.isMobile);
    }

    if (lista.length === 0) {
      alert('Nenhum hotel para validar com o critério selecionado.');
      return;
    }

    setValidandoMassa(true);
    setMassaProgresso({ current: 0, total: lista.length });

    try {
      await disparadorGoogleService.validateBatchHotels(selectedInstance, lista, (current, total) => {
        setMassaProgresso({ current, total });
      });

      // Recarrega lista com os dados atualizados
      await carregarDados();
    } catch (err) {
      console.error('Falha na validação em massa:', err);
    } finally {
      setValidandoMassa(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // MOTOR DE DISPARO DA FILA COM DELAY HUMANIZADO
  // ───────────────────────────────────────────────────────────────────────────
  const iniciarFila = async () => {
    if (loteParaEnvio.length === 0) {
      alert('Nenhum hotel disponível para envio com os filtros selecionados.');
      return;
    }
    if (!selectedInstance) {
      alert('Selecione uma instância WhatsApp conectada para disparar.');
      return;
    }

    isRunningRef.current = true;
    isPausedRef.current = false;
    setFilaStatus('running');
    setCurrentIndex(0);

    for (let i = 0; i < loteParaEnvio.length; i++) {
      if (!isRunningRef.current) break;

      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 1000));
        if (!isRunningRef.current) break;
      }
      if (!isRunningRef.current) break;

      const hotel = loteParaEnvio[i];
      setCurrentIndex(i + 1);
      setHotelAtual(hotel);

      // Gera mensagem única via Spintax
      const mensagemFinal = disparadorGoogleService.parseSpintax(mensagemTemplate, hotel);

      // Simulação visual de digitando antes do envio
      if (simularDigitando) {
        await new Promise(r => setTimeout(r, 3500));
      }

      // Envia
      const res = await disparadorGoogleService.sendSingleMessage(
        selectedInstance,
        hotel,
        mensagemFinal
      );

      // Atualiza logs na UI
      setDailySentCount(disparadorGoogleService.getDailySentCount());
      setLogs(disparadorGoogleService.getRecentLogs(30));

      // Atualiza status do hotel na lista
      setHoteis(prev => prev.map(h => h.id === hotel.id ? { ...h, alreadySent: res.success, lastStatus: res.success ? 'sucesso' : 'erro' } : h));

      // Se não for o último, aguarda delay aleatório humanizado
      if (i < loteParaEnvio.length - 1 && isRunningRef.current) {
        const segsEspera = Math.floor(Math.random() * (intervaloMax - intervaloMin + 1)) + intervaloMin;
        setCountdownSegundos(segsEspera);

        for (let s = segsEspera; s > 0; s--) {
          if (!isRunningRef.current) break;
          while (isPausedRef.current) {
            await new Promise(r => setTimeout(r, 1000));
            if (!isRunningRef.current) break;
          }
          setCountdownSegundos(s);
          await new Promise(r => setTimeout(r, 1000));
        }
        setCountdownSegundos(0);
      }
    }

    isRunningRef.current = false;
    setFilaStatus('finished');
    setHotelAtual(null);
  };

  const pausarFila = () => {
    isPausedRef.current = true;
    setFilaStatus('paused');
  };

  const retomarFila = () => {
    isPausedRef.current = false;
    setFilaStatus('running');
  };

  const cancelarFila = () => {
    isRunningRef.current = false;
    isPausedRef.current = false;
    setFilaStatus('idle');
    setCountdownSegundos(0);
    setHotelAtual(null);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* TOPO: Cabeçalho & Ações */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-2xl">send_to_mobile</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Antibloqueio IA Ativo
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Prospecção de Hotéis do Google Maps
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                Disparador Inteligente de WhatsApp
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Instância WhatsApp */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3.5 py-2 rounded-2xl">
              <span className="material-symbols-outlined text-emerald-400 text-sm">wifi</span>
              <span className="text-xs text-slate-400 font-medium">Instância:</span>
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                disabled={filaStatus === 'running'}
                className="bg-transparent text-white text-xs font-bold focus:outline-hidden cursor-pointer"
              >
                {instances.map((inst: any) => (
                  <option key={inst.name} value={inst.name} className="bg-slate-900 text-white">
                    {inst.name} ({inst.connectionStatus === 'open' ? '🟢 Conectado' : '🔴 Desconectado'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-2 rounded-2xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar ao Painel
            </button>
          </div>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-slate-400 text-xs font-medium block">Total Hotéis Google</span>
          <span className="text-2xl font-black text-white mt-1 block">{loading ? '...' : totalHoteis}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Importados do Google Places</span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-sm">
          <span className="text-emerald-400 text-xs font-medium block flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            WhatsApp Válidos
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{loading ? '...' : totalCelularesValidos}</span>
          <span className="text-[11px] text-emerald-500/70 mt-1 block">Celulares com 9 dígitos aptos</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-slate-400 text-xs font-medium block">Disparados Hoje</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white">{dailySentCount}</span>
            <span className="text-xs text-slate-400 font-semibold">/ cota máx 30</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                dailySentCount >= 30 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (dailySentCount / 30) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-slate-400 text-xs font-medium block flex items-center gap-1">
            <span className="material-symbols-outlined text-amber-400 text-sm">shield</span>
            Protegidos / Fixo
          </span>
          <span className="text-2xl font-black text-amber-400 mt-1 block">{loading ? '...' : totalFixos}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Fixos ignorados para evitar ban</span>
        </div>
      </div>

      {/* SELETOR DE SUB-ABAS */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('disparo')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'disparo'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">rocket_launch</span>
          <span>Disparo em Lote &amp; Antibloqueio</span>
          {filaStatus === 'running' && (
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('lista-hoteis')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'lista-hoteis'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          <span>Lista de Hotéis &amp; Pesquisa</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeSubTab === 'lista-hoteis' ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
          }`}>
            {totalHoteis}
          </span>
          {totalJaContatados > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
              activeSubTab === 'lista-hoteis'
                ? 'bg-emerald-950/40 text-emerald-900 border border-emerald-900/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {totalJaContatados} contatados
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('validador')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === 'validador'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <span className="material-symbols-outlined text-base">verified</span>
          <span>Validador de WhatsApp</span>
          {totalWaAtivos > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeSubTab === 'validador' ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {totalWaAtivos} ativos
            </span>
          )}
          {totalWaInexistentes > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeSubTab === 'validador' ? 'bg-slate-950 text-red-300' : 'bg-red-500/20 text-red-300'
            }`}>
              {totalWaInexistentes} sem WA
            </span>
          )}
        </button>
      </div>

      {/* PAINEL DE CONTROLE DA FILA (SE ATIVA OU EM ANDAMENTO) */}
      {(filaStatus === 'running' || filaStatus === 'paused' || filaStatus === 'finished') && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                filaStatus === 'running' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : filaStatus === 'paused' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                <span className="material-symbols-outlined text-2xl">
                  {filaStatus === 'running' ? 'sync' : filaStatus === 'paused' ? 'pause' : 'done_all'}
                </span>
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  {filaStatus === 'running' ? 'Fila em Andamento • Modo Seguro Ativo' : filaStatus === 'paused' ? 'Fila Pausada pelo Administrador' : 'Lote Concluído com Sucesso!'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {hotelAtual ? `Enviando para: ${hotelAtual.nome}` : filaStatus === 'finished' ? 'Todos os disparos do lote foram enviados' : 'Aguardando próximo ciclo...'}
                </h3>
              </div>
            </div>

            {/* Botões de Ação na Fila */}
            <div className="flex items-center gap-2">
              {filaStatus === 'running' && (
                <button
                  type="button"
                  onClick={pausarFila}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">pause</span>
                  Pausar
                </button>
              )}

              {filaStatus === 'paused' && (
                <button
                  type="button"
                  onClick={retomarFila}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  Retomar
                </button>
              )}

              <button
                type="button"
                onClick={cancelarFila}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">stop</span>
                {filaStatus === 'finished' ? 'Fechar' : 'Cancelar'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-slate-400 font-medium">Progresso do Lote:</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-white">{currentIndex}</span>
                <span className="text-xs text-slate-400 font-semibold">de {loteParaEnvio.length} hotéis</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(currentIndex / Math.max(1, loteParaEnvio.length)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-medium">Intervalo Humanizado:</span>
              <div className="text-xl font-black text-amber-300 mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">hourglass_top</span>
                {countdownSegundos > 0 ? `${countdownSegundos}s para o próximo hotel` : 'Disparando agora...'}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Espaçamento dinâmico {intervaloMin}s-{intervaloMax}s</span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-medium">Cidade do Lote:</span>
              <span className="text-xl font-black text-white mt-1 block capitalize truncate">
                {cidadeFiltro === 'todas' ? 'Várias Cidades' : cidadeFiltro}
              </span>
              <span className="text-[11px] text-emerald-400 mt-1 block">Simulação de digitação ativa</span>
            </div>
          </div>
        </div>
      )}

      {/* ABA 1: DISPARO EM LOTE & ANTIBLOQUEIO */}
      {activeSubTab === 'disparo' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* ÁREA DE CONFIGURAÇÃO DO DISPARO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: FILTROS & REGRAS */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400">tune</span>
              Filtro &amp; Seleção da Base
            </h2>

            {/* Filtro por Cidade */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">Filtrar por Cidade:</label>
              <select
                value={cidadeFiltro}
                onChange={(e) => setCidadeFiltro(e.target.value)}
                disabled={filaStatus === 'running'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
              >
                <option value="todas">Todas as Cidades ({hoteis.length} hotéis)</option>
                {cidadesDisponiveis.map(c => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome} ({c.qtd} hotéis)
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade do Lote (Máx Seguro) */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                <span>Tamanho do Lote Seguro:</span>
                <span className="text-emerald-400 font-extrabold">{tamanhoLote} hotéis</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={tamanhoLote}
                onChange={(e) => setTamanhoLote(Number(e.target.value))}
                disabled={filaStatus === 'running'}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Recomendado para 1 chip: 20 a 30 mensagens por dia.
              </span>
            </div>

            {/* Checkboxes de Proteção */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={apenasCelulares}
                  onChange={(e) => setApenasCelulares(e.target.checked)}
                  disabled={filaStatus === 'running'}
                  className="w-4 h-4 rounded-sm border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                />
                <span className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  <strong>Apenas Celulares WhatsApp válidos:</strong> filtra 173 telefones fixos para evitar taxa de rejeição da Meta.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={ignorarJaContatados}
                  onChange={(e) => setIgnorarJaContatados(e.target.checked)}
                  disabled={filaStatus === 'running'}
                  className="w-4 h-4 rounded-sm border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                />
                <span className="text-xs text-slate-300 group-hover:text-white leading-relaxed">
                  <strong>Ignorar hotéis já contatados:</strong> nunca repete o envio para estabelecimentos já abordados anteriormente.
                </span>
              </label>
            </div>

            {/* Delays Antibloqueio */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Delays Antibloqueio:</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Mínimo (seg):</label>
                  <input
                    type="number"
                    min={30}
                    max={180}
                    value={intervaloMin}
                    onChange={(e) => setIntervaloMin(Number(e.target.value))}
                    disabled={filaStatus === 'running'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Máximo (seg):</label>
                  <input
                    type="number"
                    min={60}
                    max={300}
                    value={intervaloMax}
                    onChange={(e) => setIntervaloMax(Number(e.target.value))}
                    disabled={filaStatus === 'running'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={simularDigitando}
                  onChange={(e) => setSimularDigitando(e.target.checked)}
                  disabled={filaStatus === 'running'}
                  className="w-4 h-4 rounded-sm text-emerald-600"
                />
                <span>Simular status "Digitando..." por 3 a 5 segundos</span>
              </label>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: TEMPLATE DE MENSAGEM & SPINTAX */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">psychology</span>
                Abordagem &amp; Variação Spintax
              </h2>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Anti-Hash Meta
              </span>
            </div>

            {/* Modelos Prontos */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">Modelos Estratégicos Testados:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TEMPLATES_DISPARO_PADRAO.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplate(t.id)}
                    disabled={filaStatus === 'running'}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                      selectedTemplateId === t.id
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-xs'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold block truncate">{t.nome.split('(')[0]}</span>
                    <span className="text-[10px] text-slate-400 block mt-1 line-clamp-2">{t.descricao}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editor de Texto com Spintax */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                <span>Mensagem com Spintax &#123;op1|op2&#125; e Tags:</span>
                <span className="text-[11px] text-slate-500">Variáveis: &#123;nome_hotel&#125;, &#123;cidade&#125;</span>
              </div>
              <textarea
                rows={4}
                value={mensagemTemplate}
                onChange={(e) => setMensagemTemplate(e.target.value)}
                disabled={filaStatus === 'running'}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs text-white leading-relaxed focus:outline-hidden focus:border-emerald-500 font-mono resize-y"
                placeholder="Digite a mensagem com spintax..."
              />
            </div>

            {/* Botão de Teste de Variação Spintax */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleGerarPreviews}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">casino</span>
                Testar Variações em Tempo Real
              </button>

              <span className="text-[11px] text-slate-400">
                Lote selecionado: <strong>{loteParaEnvio.length} hotéis</strong>
              </span>
            </div>

            {/* Visualizador de Prévias Geradas */}
            {previewExemplos.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Exemplos reais de como a mensagem sairá:
                </span>
                {previewExemplos.map((ex, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-xs text-slate-300 font-medium">
                    <span className="text-slate-500 font-mono mr-2">#{i + 1}:</span>
                    "{ex}"
                  </div>
                ))}
              </div>
            )}

            {/* BOTÃO MASTER DE INICIAR DISPARO */}
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={iniciarFila}
                disabled={filaStatus === 'running' || loteParaEnvio.length === 0}
                className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all transform active:scale-98 cursor-pointer ${
                  filaStatus === 'running'
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-900/30'
                }`}
              >
                <span className="material-symbols-outlined text-xl">rocket_launch</span>
                <span>
                  {filaStatus === 'running'
                    ? 'Campanha em Execução no WhatsApp...'
                    : `Iniciar Disparos Seguros (Lote de ${loteParaEnvio.length} hotéis)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FEED AO VIVO DE DISPAROS & HISTÓRICO */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-emerald-400">history</span>
            <h3 className="text-base font-black text-white">Histórico Recente de Disparos</h3>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">
              Total disparados hoje: <strong className="text-white">{dailySentCount}</strong>
            </span>
            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Deseja limpar os logs de histórico locais?')) {
                    disparadorGoogleService.clearLogs();
                    setLogs([]);
                  }
                }}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                Limpar Logs
              </button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            Nenhum disparo registrado ainda hoje. Inicie um lote seguro de 20 a 30 hotéis para acompanhar em tempo real.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Horário</th>
                  <th className="py-3 px-4">Hotel</th>
                  <th className="py-3 px-4">Cidade</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Mensagem Enviada</th>
                  <th className="py-3 px-4 rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(log.enviadoEm).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="py-3 px-4 text-white font-bold max-w-[180px] truncate">{log.hotelNome}</td>
                    <td className="py-3 px-4 text-slate-300">{log.cidade}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{log.telefone}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-[280px] truncate" title={log.mensagem}>
                      "{log.mensagem}"
                    </td>
                    <td className="py-3 px-4">
                      {log.status === 'sucesso' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 text-[11px]">
                          <span className="material-symbols-outlined text-xs">check</span>
                          Enviado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30 text-[11px]" title={log.erro}>
                          <span className="material-symbols-outlined text-xs">error</span>
                          Falha
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      )}

      {/* ABA 2: LISTA GERAL DE HOTÉIS & PESQUISA */}
      {activeSubTab === 'lista-hoteis' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          {/* TOPO: TÍTULO & AÇÕES DE RECARGA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">travel_explore</span>
                <h2 className="text-lg font-black text-white">Explorador &amp; Auditoria da Base de Hotéis</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Consulte todos os {totalHoteis} hotéis importados do Google Maps. Identifique imediatamente quem já recebeu mensagem, quem está na fila e quem possui telefone fixo protegido.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={carregarDados}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Recarregar base do Supabase"
              >
                <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
                {loading ? 'Atualizando...' : 'Atualizar Base'}
              </button>
            </div>
          </div>

          {/* BARRA DE PESQUISA E FILTROS RÁPIDOS */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Campo de Pesquisa Textual */}
              <div className="md:col-span-8 relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={buscaTermo}
                  onChange={(e) => setBuscaTermo(e.target.value)}
                  placeholder="Pesquisar por nome do hotel, cidade, bairro ou telefone (ex: Recanto, Cuiabá, 6599...)"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                />
                {buscaTermo && (
                  <button
                    type="button"
                    onClick={() => setBuscaTermo('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Seletor de Cidade */}
              <div className="md:col-span-4">
                <select
                  value={filtroCidadeLista}
                  onChange={(e) => setFiltroCidadeLista(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-3.5 py-3 text-xs text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                >
                  <option value="todas">Todas as Cidades ({hoteis.length})</option>
                  {cidadesDisponiveis.map(c => (
                    <option key={c.nome} value={c.nome}>
                      {c.nome} ({c.qtd} hotéis)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* CHIPS DE FILTRO DE STATUS */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">filter_alt</span>
                Filtrar por:
              </span>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('todos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'todos'
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>Todos</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/80 text-slate-300">
                  {hoteis.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('contatados')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'contatados'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Já Contatados</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filtroStatusLista === 'contatados' ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {totalJaContatados}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('pendentes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'pendentes'
                    ? 'bg-blue-500 text-slate-950 font-black shadow-md'
                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span>Na Fila de Disparo</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filtroStatusLista === 'pendentes' ? 'bg-slate-950 text-blue-300' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {totalPendentesEnvio}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('celulares')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'celulares'
                    ? 'bg-purple-500 text-slate-950 font-black shadow-md'
                    : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm">smartphone</span>
                <span>Celulares WhatsApp</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filtroStatusLista === 'celulares' ? 'bg-slate-950 text-purple-300' : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {totalCelularesValidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('fixos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'fixos'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm">shield</span>
                <span>Fixos Protegidos</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filtroStatusLista === 'fixos' ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {totalFixos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('wa-ativo')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'wa-ativo'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>WhatsApp Confirmado</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filtroStatusLista === 'wa-ativo' ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {totalWaAtivos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFiltroStatusLista('wa-inexistente')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filtroStatusLista === 'wa-inexistente'
                    ? 'bg-red-500 text-white font-black shadow-md'
                    : 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                <span>Sem WhatsApp</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filtroStatusLista === 'wa-inexistente' ? 'bg-slate-950 text-red-300' : 'bg-red-500/20 text-red-300'
                }`}>
                  {totalWaInexistentes}
                </span>
              </button>
            </div>
          </div>

          {/* TABELA DE RESULTADOS */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Hotel / Pousada</th>
                  <th className="py-3 px-4">Cidade / UF</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Status de Disparo</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-3xl animate-spin text-emerald-400">sync</span>
                        <span>Carregando hotéis do Google Maps...</span>
                      </div>
                    </td>
                  </tr>
                ) : hoteisPaginados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      <span className="material-symbols-outlined text-3xl text-slate-600 block mb-2">search_off</span>
                      Nenhum hotel encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  hoteisPaginados.map((hotel, idx) => {
                    const indexGlobal = (paginaAtual - 1) * itensPorPagina + idx + 1;
                    const phoneRes = disparadorGoogleService.resolvePhone(hotel.rawPhone);

                    return (
                      <tr key={hotel.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {indexGlobal}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-xs leading-snug">{hotel.nome}</div>
                          {hotel.bairro && (
                            <div className="text-[11px] text-slate-500">Bairro: {hotel.bairro}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-300 font-medium">{hotel.cidade}</span>
                          <span className="text-slate-500 ml-1 font-mono text-[11px]">/ {hotel.uf}</span>
                        </td>
                        <td className="py-3 px-4">
                          {phoneRes.formatted ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-300 text-[11px]">{phoneRes.formatted}</span>
                                {hotel.isMobile ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Celular
                                  </span>
                                ) : hotel.phoneStatus === 'fixo' ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Fixo
                                  </span>
                                ) : null}
                              </div>

                              {/* Status Real no WhatsApp via Evolution API */}
                              <div className="flex items-center gap-1.5">
                                {hotel.waStatus === 'ativo' ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    title={`Confirmado no WhatsApp (${hotel.waJid || ''}) em ${hotel.waCheckedAt || ''}`}
                                  >
                                    <span className="material-symbols-outlined text-[12px] text-emerald-400">verified</span>
                                    WhatsApp Ativo
                                  </span>
                                ) : hotel.waStatus === 'inexistente' ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40"
                                    title="Não possui conta registrada no WhatsApp"
                                  >
                                    <span className="material-symbols-outlined text-[12px] text-red-400">cancel</span>
                                    Sem WhatsApp
                                  </span>
                                ) : hotel.isMobile ? (
                                  <button
                                    type="button"
                                    onClick={() => handleValidarHotelIndividual(hotel)}
                                    disabled={validandoHotelId === hotel.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                                    title="Consultar na Evolution API se este número possui WhatsApp ativo agora"
                                  >
                                    <span
                                      className={`material-symbols-outlined text-[12px] ${
                                        validandoHotelId === hotel.id ? 'animate-spin text-emerald-400' : 'text-slate-400'
                                      }`}
                                    >
                                      sync
                                    </span>
                                    {validandoHotelId === hotel.id ? 'Checando...' : 'Checar WA'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic text-[11px]">Sem telefone</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {hotel.alreadySent ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs">
                              <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                              <span>Já Contatado</span>
                              {hotel.lastSentAt && (
                                <span className="text-[10px] text-emerald-400/80 font-mono ml-1">
                                  • {hotel.lastSentAt}
                                </span>
                              )}
                            </div>
                          ) : hotel.phoneStatus === 'fixo' ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30" title="Ignorado automaticamente para proteger o chip de suspensões">
                              <span className="material-symbols-outlined text-sm text-amber-400">shield</span>
                              <span>Fixo Protegido</span>
                            </div>
                          ) : hotel.isMobile ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              <span className="material-symbols-outlined text-sm text-blue-400">schedule</span>
                              <span>Pendente na Fila</span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">Sem número válido</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hotel.cleanPhone ? (
                            <a
                              href={`https://wa.me/${hotel.cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                              title="Abrir conversa no WhatsApp Web"
                            >
                              <span className="material-symbols-outlined text-sm">chat</span>
                              WhatsApp
                            </a>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CONTROLE DE PAGINAÇÃO E RESULTADOS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Exibindo <strong>{hoteisListaFiltrados.length === 0 ? 0 : (paginaAtual - 1) * itensPorPagina + 1}</strong> até{' '}
                <strong>{Math.min(paginaAtual * itensPorPagina, hoteisListaFiltrados.length)}</strong> de{' '}
                <strong>{hoteisListaFiltrados.length}</strong> hotéis encontrados
              </span>
              {hoteisListaFiltrados.length !== totalHoteis && (
                <span className="text-slate-500">({totalHoteis} no total)</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Seletor de itens por página */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Por página:</span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => setItensPorPagina(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-hidden cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Botões Anterior / Próxima */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                  disabled={paginaAtual <= 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                  Anterior
                </button>

                <span className="px-3 py-1 text-slate-300 font-mono text-xs">
                  {paginaAtual} / {totalPaginasLista}
                </span>

                <button
                  type="button"
                  onClick={() => setPaginaAtual(p => Math.min(totalPaginasLista, p + 1))}
                  disabled={paginaAtual >= totalPaginasLista}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  Próxima
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: VALIDADOR DE WHATSAPP */}
      {activeSubTab === 'validador' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* BANNER INFORMATIVO */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Checagem Direta na Rede Meta / WhatsApp
                </span>
                <h2 className="text-lg font-black text-white mt-1">
                  Validador Oficial de Contas WhatsApp
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifique se o número realmente possui cadastro ativo no WhatsApp sem enviar mensagem e sem risco de denúncia.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-2xl">
              <span className="material-symbols-outlined text-emerald-400 text-sm">wifi</span>
              <span className="text-xs text-slate-400 font-medium">Instância Ativa:</span>
              <strong className="text-white text-xs font-mono">{selectedInstance}</strong>
            </div>
          </div>

          {/* GRID DE VALIDAÇÃO: AVULSO + EM MASSA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CARD 1: VALIDADOR AVULSO (TESTAR QUALQUER NÚMERO) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">dialpad</span>
                <h3 className="text-base font-black text-white">Validar Número Avulso</h3>
              </div>
              <p className="text-xs text-slate-400">
                Digite qualquer número de telefone (com DDD) para saber instantaneamente se existe conta de WhatsApp vinculada.
              </p>

              <form onSubmit={handleValidarNumeroAvulso} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Telefone para teste:</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                      phone
                    </span>
                    <input
                      type="text"
                      value={numeroAvulso}
                      onChange={(e) => setNumeroAvulso(e.target.value)}
                      placeholder="Ex: 65 99617-3004 ou 65 3624-0000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={validandoAvulso || !numeroAvulso.trim()}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-base ${validandoAvulso ? 'animate-spin' : ''}`}>
                    {validandoAvulso ? 'sync' : 'search_check'}
                  </span>
                  <span>{validandoAvulso ? 'Consultando WhatsApp...' : 'Verificar se tem WhatsApp'}</span>
                </button>
              </form>

              {/* RESULTADO DA CONSULTA AVULSA */}
              {resultadoAvulso && (
                <div className="pt-2 animate-in fade-in duration-200">
                  {resultadoAvulso.exists ? (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-left space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                        <span className="material-symbols-outlined text-xl">check_circle</span>
                        <span>SIM! NÚMERO CADASTRADO NO WHATSAPP</span>
                      </div>
                      <div className="text-xs text-slate-300 font-mono">
                        Telefone: <strong className="text-white">{resultadoAvulso.number}</strong>
                      </div>
                      {resultadoAvulso.jid && (
                        <div className="text-[11px] text-emerald-400/80 font-mono break-all">
                          ID Oficial (JID): {resultadoAvulso.jid}
                        </div>
                      )}
                      <div className="pt-2">
                        <a
                          href={`https://wa.me/${resultadoAvulso.number.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs transition-all hover:bg-emerald-400"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                          Abrir Conversa no WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-left space-y-2">
                      <div className="flex items-center gap-2 text-red-400 font-black text-sm">
                        <span className="material-symbols-outlined text-xl">cancel</span>
                        <span>NÃO! NÚMERO SEM CONTA NO WHATSAPP</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        O número <strong className="font-mono text-white">{resultadoAvulso.number}</strong> não possui registro ativo no WhatsApp. Pode ser um telefone fixo convencional, linha desativada ou número restrito.
                      </p>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-amber-300 font-medium flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-amber-400 shrink-0">shield</span>
                        <span>O disparador inteligente ignora esse número automaticamente para proteger seu chip!</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CARD 2: VALIDADOR EM MASSA DA BASE DE HOTÉIS */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">playlist_add_check</span>
                  <h3 className="text-base font-black text-white">Validação em Lote da Base de Hotéis</h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {totalCelularesValidos} celulares na base
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Passe um pente fino na sua lista de hotéis. Os números que não tiverem WhatsApp serão etiquetados como <strong>Sem WhatsApp</strong> e bloqueados para não gastar sua cota diária.
              </p>

              {/* CARDS RESUMO DO ESTADO ATUAL DA BASE */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-emerald-500/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">WhatsApp Ativo</span>
                  <span className="text-xl font-black text-white mt-1 block">{totalWaAtivos}</span>
                  <span className="text-[10px] text-slate-400 block">Contas confirmadas</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-red-500/30">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block">Sem WhatsApp</span>
                  <span className="text-xl font-black text-white mt-1 block">{totalWaInexistentes}</span>
                  <span className="text-[10px] text-slate-400 block">Números descartados</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Não Verificados</span>
                  <span className="text-xl font-black text-white mt-1 block">{totalWaNaoVerificados}</span>
                  <span className="text-[10px] text-slate-400 block">Aguardando auditoria</span>
                </div>
              </div>

              {/* PROGRESSO EM ANDAMENTO (SE HOUVER) */}
              {validandoMassa && (
                <div className="p-4 rounded-2xl bg-slate-800 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      Validando números com a Evolution API...
                    </span>
                    <span className="font-mono text-white font-black">
                      {massaProgresso.current} / {massaProgresso.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${massaProgresso.total > 0 ? (massaProgresso.current / massaProgresso.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* BOTÕES DE AÇÃO EM MASSA */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleValidarEmMassa('proximos-50')}
                    disabled={validandoMassa}
                    className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-left border border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">
                        Validar Próximos 50 Hotéis
                      </span>
                      <span className="material-symbols-outlined text-sm text-slate-400">arrow_forward</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Audita 50 números pendentes em lotes seguros.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleValidarEmMassa('cidade-atual')}
                    disabled={validandoMassa}
                    className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-left border border-slate-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400">
                        Validar Cidade: {cidadeFiltro === 'todas' ? 'Todas' : cidadeFiltro}
                      </span>
                      <span className="material-symbols-outlined text-sm text-slate-400">location_city</span>
                    </div>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Verifica apenas os hotéis da cidade filtrada.
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleValidarEmMassa('todos-celulares')}
                  disabled={validandoMassa}
                  className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-slate-700 text-white hover:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">checklist</span>
                  <span>Auditar Todos os Celulares da Base ({totalCelularesValidos} hotéis)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminDisparadorGoogle;
