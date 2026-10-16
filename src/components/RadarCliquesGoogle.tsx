import React, { useState, useEffect, useMemo } from 'react';
import { cliquesService, MetricasCliquesGoogle, CliqueWhatsappGoogle } from '../services/cliquesService';

export interface RadarCliquesGoogleProps {
  onRefreshParent?: () => void;
}

export const RadarCliquesGoogle: React.FC<RadarCliquesGoogleProps> = () => {
  const [metricas, setMetricas] = useState<MetricasCliquesGoogle>({
    totalCliques: 0,
    totalHoteisDistintos: 0,
    rankingHoteis: [],
    ultimosCliques: []
  });
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [visualizacao, setVisualizacao] = useState<'ranking' | 'feed'>('ranking');

  const carregarMetricas = async () => {
    setLoading(true);
    try {
      const data = await cliquesService.obterMetricas();
      setMetricas(data);
    } catch (e) {
      console.error('[RadarCliquesGoogle] Erro ao carregar:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
    // Atualização automática a cada 20 segundos
    const interval = setInterval(carregarMetricas, 20000);
    return () => clearInterval(interval);
  }, []);

  const hoteisFiltrados = useMemo(() => {
    if (!busca.trim()) return metricas.rankingHoteis;
    const t = busca.toLowerCase();
    return metricas.rankingHoteis.filter(h => 
      h.hotel_name.toLowerCase().includes(t) ||
      (h.hotel_city && h.hotel_city.toLowerCase().includes(t)) ||
      (h.hotel_uf && h.hotel_uf.toLowerCase().includes(t))
    );
  }, [metricas.rankingHoteis, busca]);

  const ultimosFiltrados = useMemo(() => {
    if (!busca.trim()) return metricas.ultimosCliques;
    const t = busca.toLowerCase();
    return metricas.ultimosCliques.filter(c => 
      c.hotel_name.toLowerCase().includes(t) ||
      (c.hotel_city && c.hotel_city.toLowerCase().includes(t))
    );
  }, [metricas.ultimosCliques, busca]);

  const formatarHoraRelativa = (isoString?: string) => {
    if (!isoString) return 'Agora';
    try {
      const diffMin = Math.round((Date.now() - new Date(isoString).getTime()) / 60000);
      if (diffMin <= 1) return 'Agora mesmo';
      if (diffMin < 60) return `Há ${diffMin} min`;
      const diffHoras = Math.round(diffMin / 60);
      if (diffHoras < 24) return `Há ${diffHoras}h`;
      return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recentemente';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5">
      {/* CABEÇALHO DO RADAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-2xl animate-pulse">radar</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Radar de Reservas • Hotéis do Google
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                Ao Vivo
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Hóspedes que clicaram no botão do WhatsApp nos hotéis importados do Google
            </p>
          </div>
        </div>

        {/* CONTROLES / ATUALIZAR */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setVisualizacao('ranking')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${visualizacao === 'ranking' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Ranking ({metricas.totalHoteisDistintos})
            </button>
            <button
              onClick={() => setVisualizacao('feed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${visualizacao === 'feed' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Últimos Cliques ({metricas.totalCliques})
            </button>
          </div>

          <button
            onClick={carregarMetricas}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
            title="Atualizar dados agora"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>
      </div>

      {/* CARDS RÁPIDOS DE MÉTRICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total de Cliques de Hóspedes</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900">{metricas.totalCliques}</span>
            <span className="text-[10px] font-bold text-emerald-600">demanda real</span>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Hotéis Procurados</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-900">{metricas.totalHoteisDistintos}</span>
            <span className="text-[10px] font-bold text-blue-600">estabelecimentos</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-3.5 rounded-xl border border-emerald-200 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Estratégia de Fechamento</span>
          <span className="text-xs font-semibold text-emerald-950 mt-1 leading-snug">
            Aborde os donos mostrando que há reservas esperando por eles!
          </span>
        </div>
      </div>

      {/* CAMPO DE BUSCA */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por hotel ou cidade..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* CONTEÚDO PRINCIPAL: RANKING OU FEED */}
      {visualizacao === 'ranking' ? (
        <div className="space-y-2.5">
          {hoteisFiltrados.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-300">travel_explore</span>
              <p>Nenhum clique registrado ainda ou filtro sem resultados.</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Assim que um visitante clicar no botão de WhatsApp em qualquer página de hotel do Google, ele aparecerá aqui instantaneamente!
              </p>
            </div>
          ) : (
            hoteisFiltrados.map((hotel, index) => {
              const linkZap = cliquesService.gerarLinkAbordagem(hotel);
              return (
                <div
                  key={`${hotel.hotel_name}_${index}`}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-sm text-slate-900 truncate">
                          {hotel.hotel_name}
                        </h5>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 shrink-0">
                          {hotel.total_cliques} {hotel.total_cliques === 1 ? 'clique' : 'cliques'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 truncate">
                        {hotel.hotel_city && (
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="material-symbols-outlined text-xs text-slate-400">location_on</span>
                            {hotel.hotel_city}{hotel.hotel_uf ? ` - ${hotel.hotel_uf}` : ''}
                          </span>
                        )}
                        <span>•</span>
                        <span className="text-[11px] text-slate-400">
                          Último interesse: {formatarHoraRelativa(hotel.ultimo_clique)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* BOTÃO DE ABORDAGEM COMERCIAL */}
                  <div className="flex items-center gap-2 shrink-0">
                    {linkZap ? (
                      <a
                        href={linkZap}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Abrir WhatsApp com proposta de ativação comercial"
                      >
                        <span className="material-symbols-outlined text-base">chat</span>
                        <span>Abordar Dono do Hotel</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic px-2">Telefone indisponível</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VISUALIZAÇÃO FEED EM TEMPO REAL */
        <div className="divide-y divide-slate-100 text-xs">
          {ultimosFiltrados.length === 0 ? (
            <div className="py-8 text-center text-slate-400">Nenhum evento recente encontrado.</div>
          ) : (
            ultimosFiltrados.map((item, idx) => (
              <div key={item.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-ping"></span>
                  <div className="truncate">
                    <span className="font-bold text-slate-800">{item.hotel_name}</span>
                    {item.hotel_city && <span className="text-slate-400 ml-1.5">({item.hotel_city})</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-slate-500 text-[11px]">
                  <span>{formatarHoraRelativa(item.created_at)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium uppercase">
                    WhatsApp
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
