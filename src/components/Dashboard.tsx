import React, { useState, useEffect, useCallback } from 'react';
import { dashboardService, DashboardMetrics, currentHotelService, reservasService, quartosService } from '../services/supabaseService';

interface DashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const [period, setPeriod] = useState<'hoje' | 'semana' | 'mes'>('hoje');
  const [currentHotelName, setCurrentHotelName] = useState<string>(() => {
    return currentHotelService.getCurrentHotel()?.name || 'Hotel Master';
  });
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    quartosDisponiveis: 0,
    quartosOcupados: 0,
    quartosReservados: 0,
    emLimpeza: 0,
    emCheckOut: 0,
    faturamentoDia: 0,
    faturamentoPeriodo: 0,
    totalQuartos: 0,
    taxaOcupacao: 0,
    faturamentoSemanaDias: [],
    ocupacaoCategorias: [],
    atividadesRecentes: []
  });

  const loadMetrics = useCallback(async (selectedPeriod: 'hoje' | 'semana' | 'mes' = period) => {
    try {
      const activeHotel = currentHotelService.getCurrentHotel();
      if (activeHotel?.name) {
        setCurrentHotelName(activeHotel.name);
      }
      const data = await dashboardService.getMetrics(activeHotel?.id, selectedPeriod);
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar dados reais da dashboard:', err);
    }
  }, [period]);

  useEffect(() => {
    loadMetrics(period);
  }, [period, loadMetrics]);

  useEffect(() => {
    const handleRefresh = () => {
      const activeHotel = currentHotelService.getCurrentHotel();
      if (activeHotel?.name) {
        setCurrentHotelName(activeHotel.name);
      }
      loadMetrics(period);
    };

    window.addEventListener('hotel_changed', handleRefresh);
    window.addEventListener('hotel_novo_quarto', handleRefresh);
    window.addEventListener('hotel_nova_reserva', handleRefresh);
    window.addEventListener('hotel_reserva_modificada', handleRefresh);
    window.addEventListener('hotel_quarto_atualizado', handleRefresh);
    window.addEventListener('hotel_quarto_modificado', handleRefresh);

    // 1. Inscrição em tempo real de Quartos no Supabase (WebSocket bidirecional Hotel <-> Camareiras)
    const unsubscribeQuartos = quartosService.subscribeQuartos
      ? quartosService.subscribeQuartos(() => {
          loadMetrics(period);
        })
      : () => {};

    // 2. Inscrição em tempo real nas reservas do Supabase (WebSocket)
    const unsubscribeReservas = reservasService.subscribeReservas(() => {
      loadMetrics(period);
    });

    // 3. BroadcastChannel para sincronização instantânea de Check-out, Limpeza e Novas Reservas
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_notifications_channel');
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'NOVA_RESERVA_HOSPEDE' ||
          event.data?.type === 'CHECKOUT_REALIZADO' ||
          event.data?.type === 'QUARTO_STATUS_ALTERADO'
        ) {
          loadMetrics(period);
        }
      };
    } catch {}

    // 4. StorageEvent para sincronização entre abas no mesmo navegador
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'hotel_quarto_status_trigger' || e.key?.startsWith('hotelnozap_quartos_')) {
        loadMetrics(period);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 5. Atualização automática ao focar ou reativar a aba
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadMetrics(period);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // 6. Polling heartbeat rápido (a cada 3 segundos atualiza métricas em segundo plano)
    const timerCheckouts = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadMetrics(period);
      }
    }, 3000);

    return () => {
      clearInterval(timerCheckouts);
      window.removeEventListener('hotel_changed', handleRefresh);
      window.removeEventListener('hotel_novo_quarto', handleRefresh);
      window.removeEventListener('hotel_nova_reserva', handleRefresh);
      window.removeEventListener('hotel_reserva_modificada', handleRefresh);
      window.removeEventListener('hotel_quarto_atualizado', handleRefresh);
      window.removeEventListener('hotel_quarto_modificado', handleRefresh);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      if (bc) {
        try { bc.close(); } catch {}
      }
      unsubscribeQuartos();
      unsubscribeReservas();
    };
  }, [period, loadMetrics]);

  const totalSemana = (metrics.faturamentoSemanaDias || []).reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="p-6 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* Mobile Welcome Header */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Dashboard</h1>
          <p className="text-sm text-[#45464d]">
            Visão geral de {currentHotelName} ({period === 'hoje' ? 'Hoje' : period === 'semana' ? 'Esta Semana' : 'Este Mês'}).
          </p>
        </div>

        {/* Mobile Period Filter Tabs */}
        <div className="flex items-center bg-[#eff4ff] p-1 rounded-xl border border-[#c6c6cd]/40 w-full">
          <button 
            type="button"
            onClick={() => setPeriod('hoje')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              period === 'hoje' ? 'bg-white text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
            }`}
          >
            Hoje
          </button>
          <button 
            type="button"
            onClick={() => setPeriod('semana')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              period === 'semana' ? 'bg-white text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
            }`}
          >
            Esta Semana
          </button>
          <button 
            type="button"
            onClick={() => setPeriod('mes')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              period === 'mes' ? 'bg-white text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
            }`}
          >
            Este Mês
          </button>
        </div>
      </div>

      {/* Desktop Welcome Header */}
      <div className="hidden lg:flex justify-between items-center mb-2">
        <div>
          <h1 className="text-3xl font-bold text-[#0b1c30] tracking-tight">Visão Geral</h1>
          <p className="text-[#45464d] text-base mt-1">
            Acompanhe o desempenho em tempo real do hotel <span className="font-semibold text-[#0b1c30]">{currentHotelName}</span>.
          </p>
        </div>

        {/* Period Filter Tabs */}
        <div className="flex items-center bg-[#eff4ff] p-1 rounded-xl border border-[#c6c6cd]/40">
          <button 
            type="button"
            onClick={() => setPeriod('hoje')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              period === 'hoje' ? 'bg-white text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
            }`}
          >
            Hoje
          </button>
          <button 
            type="button"
            onClick={() => setPeriod('semana')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              period === 'semana' ? 'bg-white text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
            }`}
          >
            Esta Semana
          </button>
          <button 
            type="button"
            onClick={() => setPeriod('mes')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              period === 'mes' ? 'bg-white text-[#0b1c30] shadow-sm' : 'text-[#45464d] hover:text-[#0b1c30]'
            }`}
          >
            Este Mês
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (2 cols on mobile, 3 on tablet, 6 on desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* KPI 1: Quartos Disponíveis */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('mapa')}
          className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-xs active:scale-[0.98] transition-all duration-150"
          title="Ver no Mapa de Quartos"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Quartos Disponíveis</span>
            <span className="material-symbols-outlined text-[#006c49]">bed</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.quartosDisponiveis}</div>
            <div className="text-xs text-emerald-700 font-medium mt-0.5">Prontos para uso</div>
          </div>
        </div>

        {/* KPI 2: Quartos Ocupados */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('mapa')}
          className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-xs active:scale-[0.98] transition-all duration-150"
          title="Ver no Mapa de Quartos"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Quartos Ocupados</span>
            <span className="material-symbols-outlined text-blue-600">door_front</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.quartosOcupados}</div>
            <div className="text-xs text-blue-700 font-medium mt-0.5">Hóspedes ativos</div>
          </div>
        </div>

        {/* KPI 3: Quartos Reservados */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('reservas')}
          className="bg-indigo-50/70 border border-indigo-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-xs active:scale-[0.98] transition-all duration-150"
          title="Ver Reservas"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Quartos Reservados</span>
            <span className="material-symbols-outlined text-indigo-600">event_available</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.quartosReservados}</div>
            <div className="text-xs text-indigo-700 font-medium mt-0.5">{period === 'hoje' ? 'Para hoje' : 'Ativas'}</div>
          </div>
        </div>

        {/* KPI 4: Em Limpeza */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('mapa')}
          className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-amber-300 hover:shadow-xs active:scale-[0.98] transition-all duration-150"
          title="Ver no Mapa de Quartos"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Em Limpeza</span>
            <span className="material-symbols-outlined text-amber-600">cleaning_services</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.emLimpeza}</div>
            <div className="text-xs text-amber-700 font-medium mt-0.5">Em andamento</div>
          </div>
        </div>

        {/* KPI 5: Em Check-Out */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('reservas')}
          className="bg-rose-50/70 border border-rose-200/70 rounded-xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-rose-300 hover:shadow-xs active:scale-[0.98] transition-all duration-150"
          title="Ver Reservas em Check-Out"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-slate-700">Em Check-Out</span>
            <span className="material-symbols-outlined text-rose-600">logout</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.emCheckOut}</div>
            <div className="text-xs text-rose-700 font-medium mt-0.5">
              {new Date().getHours() >= 12 ? 'Encerrado às 12:00' : 'Aguardando saída (até 12h)'}
            </div>
          </div>
        </div>

        {/* KPI 6: Faturamento do Período */}
        <div 
          onClick={() => onNavigateTab && onNavigateTab('controle-caixa')}
          className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-xs active:scale-[0.98] transition-all duration-150"
          title="Ver Controle de Caixa"
        >
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium text-slate-700 truncate">
              {period === 'hoje' ? 'Faturamento do Dia' : period === 'semana' ? 'Faturamento da Semana' : 'Faturamento do Mês'}
            </span>
            <span className="material-symbols-outlined text-[#006c49]">payments</span>
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {metrics.faturamentoPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div className="text-xs text-[#006c49] flex items-center font-medium mt-0.5">
              <span className="material-symbols-outlined text-[14px] mr-0.5">
                {metrics.faturamentoPeriodo > 0 ? 'trending_up' : 'trending_flat'}
              </span>
              {metrics.faturamentoPeriodo > 0 ? 'Movimentado' : 'Sem movimento'}
            </div>
          </div>
        </div>

      </div>

      {/* Main Charts Bento Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly Revenue Chart */}
        <div className="lg:col-span-2 bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[280px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0b1c30]">Faturamento da Semana</h2>
              <p className="text-xs text-[#76777d] mt-0.5">
                Total registrado nos últimos 7 dias: <span className="font-bold text-[#006c49]">{totalSemana.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </p>
            </div>
            {onNavigateTab && (
              <button 
                type="button"
                onClick={() => onNavigateTab('controle-caixa')}
                className="text-xs font-semibold text-[#006c49] hover:underline cursor-pointer"
              >
                Ver financeiro
              </button>
            )}
          </div>

          {/* CSS Bar Chart */}
          <div className="flex items-end justify-between h-40 pt-4 gap-2 border-b border-[#c6c6cd]/30 pb-2 px-2">
            {metrics.faturamentoSemanaDias && metrics.faturamentoSemanaDias.length > 0 ? (
              metrics.faturamentoSemanaDias.map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full group cursor-pointer h-full justify-end relative">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-9 bg-[#0b1c30] text-white text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                    {bar.name} ({bar.date}): {bar.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <div 
                    className={`w-full max-w-[36px] rounded-t-sm transition-all duration-300 ${
                      bar.active 
                        ? 'bg-[#006c49] ring-2 ring-[#006c49]/30' 
                        : (bar.value > 0 ? 'bg-[#006c49]/80 hover:bg-[#006c49]' : 'bg-[#c6c6cd]/40 hover:bg-[#006c49]/40')
                    }`}
                    style={{ height: bar.height }}
                    title={`${bar.name} (${bar.date}): ${bar.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                  />
                  <span className={`text-xs font-semibold ${bar.active ? 'text-[#006c49] font-bold' : 'text-[#45464d]'}`}>
                    {bar.day}
                  </span>
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#76777d]">
                Sem dados de faturamento nesta semana
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart (Desktop focus, neat on tablet/mobile) */}
        <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-sm flex flex-col items-center justify-between min-h-[280px]">
          <div className="flex justify-between items-center w-full mb-2">
            <h2 className="text-lg sm:text-xl font-bold text-[#0b1c30]">Ocupação por Categoria</h2>
            {onNavigateTab && (
              <button 
                type="button"
                onClick={() => onNavigateTab('categorias-quartos')}
                className="text-xs font-semibold text-[#006c49] hover:underline cursor-pointer"
              >
                Gerenciar
              </button>
            )}
          </div>
          
          {/* Donut graphic */}
          <div className="relative flex items-center justify-center w-32 h-32 my-3">
            <div 
              className="w-32 h-32 rounded-full flex items-center justify-center shadow-sm transition-all duration-500"
              style={{
                background: metrics.taxaOcupacao > 0 
                  ? `conic-gradient(#006c49 0% ${metrics.taxaOcupacao}%, #e2e8f0 ${metrics.taxaOcupacao}% 100%)`
                  : '#e2e8f0'
              }}
            >
              <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="font-black text-[#0b1c30] text-xl">{metrics.taxaOcupacao}%</span>
                <span className="text-[10px] text-[#76777d] uppercase font-bold tracking-wider">Ocupação</span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-2 pt-2">
            {metrics.ocupacaoCategorias && metrics.ocupacaoCategorias.length > 0 ? (
              metrics.ocupacaoCategorias.map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs sm:text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></div>
                    <span className="text-[#0b1c30] font-medium truncate max-w-[110px] sm:max-w-[130px]">{cat.name}</span>
                    <span className="text-[11px] text-[#76777d] shrink-0">({cat.count} {cat.count === 1 ? 'quarto' : 'quartos'})</span>
                  </div>
                  <span className="font-bold text-[#0b1c30]">{cat.percentage}%</span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-xs text-[#76777d]">
                Nenhum quarto cadastrado para este hotel
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Recent Activities Section */}
      <div className="bg-white border border-[#c6c6cd]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[#c6c6cd]/30 bg-[#f8f9ff] flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-[#0b1c30]">Atividades Recentes</h2>
          {onNavigateTab && (
            <button 
              type="button"
              onClick={() => onNavigateTab('reservas')}
              className="hidden sm:block text-xs sm:text-sm font-bold text-[#006c49] hover:underline cursor-pointer"
            >
              Ver reservas
            </button>
          )}
        </div>

        <div className="divide-y divide-[#c6c6cd]/20">
          {metrics.atividadesRecentes && metrics.atividadesRecentes.length > 0 ? (
            metrics.atividadesRecentes.map((ativ) => (
              <div 
                key={ativ.id} 
                onClick={() => onNavigateTab && onNavigateTab(ativ.tipo === 'quarto' ? 'mapa' : 'reservas')}
                className="p-4 flex items-start gap-4 hover:bg-[#eff4ff] transition-colors cursor-pointer"
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: ativ.corBg, color: ativ.corTexto }}
                >
                  <span className="material-symbols-outlined text-[20px]">{ativ.icone}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#0b1c30] leading-tight">
                    {ativ.titulo}
                  </p>
                  <p className="text-xs text-[#45464d] mt-1">{ativ.detalhe} • {ativ.tempo}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-[#76777d] text-sm">
              Nenhuma atividade recente registrada neste hotel.
            </div>
          )}
        </div>

        {metrics.atividadesRecentes && metrics.atividadesRecentes.length > 0 && onNavigateTab && (
          <button 
            type="button"
            onClick={() => onNavigateTab('reservas')}
            className="w-full py-3.5 text-center border-t border-[#c6c6cd]/30 text-xs sm:text-sm font-bold text-[#131b2e] hover:bg-[#eff4ff] transition-colors cursor-pointer"
          >
            Ver todas as reservas
          </button>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
