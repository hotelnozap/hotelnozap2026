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
  );
};
export default AdminDisparadorGoogle;
