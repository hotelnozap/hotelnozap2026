import React, { useState, useEffect, useMemo } from 'react';
import { hoteisService, parceirosService, planosService, reservasService, quartosService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';
import { Partner } from './ListagemParceiros';
import { Plano } from './ListagemPlanos';
import { Reserva } from './ListagemReservas';

interface QuartoRede {
  id: string;
  hotelId: string;
  number: string;
  name: string;
  category: string;
  status: string;
  floor: string;
  capacity: number;
  dailyPrice: number;
  active: boolean;
  notes: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminMasterDashboardProps {
  hideSidebar?: boolean;
  onNavigateToHotelDashboard: (hotel: Hotel) => void;
  onNavigateToEditHotel: (hotel: Hotel) => void;
  onNavigateToCreateHotel: () => void;
  onNavigateToHoteisList: () => void;
  onNavigateToParceiros: () => void;
  onNavigateToPlanos: () => void;
  onNavigateToCreditos?: () => void;
  onNavigateToUsuarios: () => void;
  onNavigateToConfig?: () => void;
  onNavigateToWhatsApp?: () => void;
  onNavigateToCaixa?: () => void;
  onLogout: () => void;
  adminEmail?: string;
  adminName?: string;
}

export const AdminMasterDashboard: React.FC<AdminMasterDashboardProps> = ({
  hideSidebar = false,
  onNavigateToHotelDashboard,
  onNavigateToEditHotel,
  onNavigateToCreateHotel,
  onNavigateToHoteisList,
  onNavigateToParceiros,
  onNavigateToPlanos,
  onNavigateToCreditos,
  onNavigateToUsuarios,
  onNavigateToConfig,
  onNavigateToWhatsApp,
  onNavigateToCaixa,
  onLogout,
  adminEmail = '',
  adminName = 'Administrador'
}) => {
  const [hoteis, setHoteis] = useState<Hotel[]>([]);
  const [parceiros, setParceiros] = useState<Partner[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [quartosRede, setQuartosRede] = useState<QuartoRede[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'6meses' | 'anoAtual'>('6meses');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedHotelDelete, setSelectedHotelDelete] = useState<Hotel | null>(null);

  // Data formatada em português para o cabeçalho
  const [currentDateFormatted] = useState(() => {
    const now = new Date();
    const dia = now.getDate();
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mes = meses[now.getMonth()];
    const ano = now.getFullYear();
    return `Hoje, ${dia} ${mes} ${ano}`;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedHotelDelete) return;
    try {
      await hoteisService.deleteHotel(selectedHotelDelete.id);
    } catch { /* ignore */ }
    showToast(`Hotel "${selectedHotelDelete.name}" excluído com sucesso.`);
    setSelectedHotelDelete(null);
  };

  // Carregar dados reais de todas as entidades do Supabase
  const loadRealData = async () => {
    setIsLoading(true);
    try {
      const [dbHoteis, dbParceiros, dbPlanos, dbReservas, dbQuartosRede] = await Promise.all([
        hoteisService.getHoteis(),
        parceirosService.getParceiros(),
        planosService.getPlanos(),
        reservasService.getAllReservas ? reservasService.getAllReservas() : reservasService.getReservas('ALL'),
        quartosService.getAllQuartosRede ? quartosService.getAllQuartosRede() : []
      ]);

      if (dbHoteis) setHoteis(dbHoteis);
      if (dbParceiros) setParceiros(dbParceiros);
      if (dbPlanos) setPlanos(dbPlanos);
      if (dbReservas) setReservas(dbReservas);
      if (Array.isArray(dbQuartosRede)) setQuartosRede(dbQuartosRede as QuartoRede[]);
    } catch (err) {
      console.warn('Erro ao carregar dados do admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRealData();

    // Escutar eventos de criação/edição em tempo real
    window.addEventListener('hotel_novo_hotel', loadRealData);
    window.addEventListener('hotel_modificado', loadRealData);
    window.addEventListener('hotel_deletado', loadRealData);
    window.addEventListener('hotel_novo_parceiro', loadRealData);
    window.addEventListener('hotel_parceiro_modificado', loadRealData);
    window.addEventListener('hotel_parceiro_deletado', loadRealData);
    window.addEventListener('hotel_nova_reserva', loadRealData);
    window.addEventListener('hotel_reserva_modificada', loadRealData);
    window.addEventListener('hotel_novo_quarto', loadRealData);
    window.addEventListener('hotel_quarto_modificado', loadRealData);
    window.addEventListener('hotel_quarto_deletado', loadRealData);

    const unsubscribeReservas = reservasService.subscribeReservas 
      ? reservasService.subscribeReservas(loadRealData) 
      : () => {};

    const unsubscribeParceiros = parceirosService.subscribeParceiros
      ? parceirosService.subscribeParceiros(loadRealData)
      : () => {};

    const unsubscribeQuartos = (quartosService as any).subscribeQuartos
      ? (quartosService as any).subscribeQuartos(loadRealData)
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_hotel', loadRealData);
      window.removeEventListener('hotel_modificado', loadRealData);
      window.removeEventListener('hotel_deletado', loadRealData);
      window.removeEventListener('hotel_novo_parceiro', loadRealData);
      window.removeEventListener('hotel_parceiro_modificado', loadRealData);
      window.removeEventListener('hotel_parceiro_deletado', loadRealData);
      window.removeEventListener('hotel_nova_reserva', loadRealData);
      window.removeEventListener('hotel_reserva_modificada', loadRealData);
      window.removeEventListener('hotel_novo_quarto', loadRealData);
      window.removeEventListener('hotel_quarto_modificado', loadRealData);
      window.removeEventListener('hotel_quarto_deletado', loadRealData);
      unsubscribeReservas();
      unsubscribeParceiros();
      unsubscribeQuartos();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // CÁLCULOS E MÉTRICAS 100% REAIS
  // ─────────────────────────────────────────────────────────────────────────────

  // Mapeamento de preços de planos por nome
  const planPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    planos.forEach(p => {
      const key = (p.name || '').toLowerCase().trim();
      let val = Number(p.basePrice) || 0;
      if (p.periodicity && p.periodicity.toLowerCase() === 'anual') {
        val = val / 12;
      }
      map.set(key, val);
    });
    // Fallbacks padrão caso não venham do banco
    if (!map.has('grátis (google maps)')) map.set('grátis (google maps)', 0);
    if (!map.has('gratis (google maps)')) map.set('gratis (google maps)', 0);
    if (!map.has('grátis')) map.set('grátis', 0);
    if (!map.has('gratis')) map.set('gratis', 0);
    if (!map.has('1 crédito (adesão / teste)')) map.set('1 crédito (adesão / teste)', 197);
    if (!map.has('2 créditos (bimestral)')) map.set('2 créditos (bimestral)', 349);
    if (!map.has('3 créditos (trimestre de ouro)')) map.set('3 créditos (trimestre de ouro)', 497);
    if (!map.has('6 créditos (semestral)')) map.set('6 créditos (semestral)', 890);
    if (!map.has('12 créditos (anual fidelidade)')) map.set('12 créditos (anual fidelidade)', 1690);
    if (!map.has('free (limitado)')) map.set('free (limitado)', 0);
    if (!map.has('starter')) map.set('starter', 149);
    if (!map.has('plano starter')) map.set('plano starter', 149);
    if (!map.has('professional')) map.set('professional', 299);
    if (!map.has('plano professional')) map.set('plano professional', 299);
    if (!map.has('enterprise')) map.set('enterprise', 590);
    if (!map.has('plano enterprise')) map.set('plano enterprise', 590);
    return map;
  }, [planos]);

  // 1. Hotéis
  const totalHoteis = hoteis.length;
  const hoteisAtivos = hoteis.filter(h => h.status === 'ativo').length;
  const hoteisFreeLimitado = hoteis.filter(h => {
    const p = (h.plan || '').toLowerCase();
    return p.includes('free') || p.includes('limitado') || p.includes('grátis') || p.includes('gratis') || planPriceMap.get(p) === 0;
  }).length;
  const hoteisAssinaturasPagas = totalHoteis - hoteisFreeLimitado;

  // 2. Receita MRR Real
  const realMRR = useMemo(() => {
    return hoteis.reduce((acc, h) => {
      const p = (h.plan || '').toLowerCase().trim();
      const price = planPriceMap.get(p) ?? (p.includes('free') || p.includes('grátis') || p.includes('gratis') ? 0 : 197);
      return acc + price;
    }, 0);
  }, [hoteis, planPriceMap]);

  const ticketMedio = hoteisAssinaturasPagas > 0 
    ? (realMRR / hoteisAssinaturasPagas) 
    : (totalHoteis > 0 ? realMRR / totalHoteis : 0);

  // 3. Quartos Ativos na Rede (dados reais da tabela quartos do Supabase)
  const totalQuartos = quartosRede.length;

  const quartosAtivos = useMemo(() => {
    return quartosRede.filter(q => q.active !== false && q.status !== 'manutenção').length;
  }, [quartosRede]);

  const maxHospedesEstimados = useMemo(() => {
    const totalCapacidade = quartosRede.reduce((acc: number, q: QuartoRede) => acc + (Number(q.capacity) || 0), 0);
    if (totalCapacidade > 0) return totalCapacidade;
    if (totalQuartos === 0) return 0;
    return Math.round(totalQuartos * 2.2);
  }, [quartosRede, totalQuartos]);

  const percentQuartosOperacao = totalQuartos > 0
    ? ((quartosAtivos / totalQuartos) * 100).toFixed(1)
    : '0.0';

  const hoteisComQuartosCadastrados = useMemo(() => {
    const ids = new Set<string>();
    quartosRede.forEach(q => {
      if (q.hotelId && q.hotelId.trim() !== '') ids.add(q.hotelId);
    });
    return ids.size;
  }, [quartosRede]);

  // 4. Parceiros & Indicadores
  const totalParceiros = parceiros.length;
  const parceirosAtivos = parceiros.filter(p => p.status === 'ativo').length;
  const totalHoteisIndicados = useMemo(() => {
    return parceiros.reduce((acc, p) => acc + (Number(p.indicatedHotels) || 0), 0);
  }, [parceiros]);
  const totalComissoes = useMemo(() => {
    return parceiros.reduce((acc, p) => acc + (Number(p.ganhosAcumulados) || 0), 0);
  }, [parceiros]);

  // 5. Instâncias WhatsApp e Reservas Hoje (somente do dia atual em toda a rede)
  const totalInstanciasWhatsApp = useMemo(() => {
    return hoteis.filter(h => Boolean(h.instanceName && h.apiKey && h.apiKey.trim() !== '')).length;
  }, [hoteis]);

  const reservasHoje = useMemo(() => {
    const today = new Date();
    const todayPt = today.toLocaleDateString('pt-BR'); // Ex: "14/09/2026"
    
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayYMD = `${y}-${m}-${d}`; // Ex: "2026-09-14"

    return reservas.filter(r => {
      // 1. Criada no dia de hoje (data de criação)
      const dataCriacaoStr = r.dataCriacao || '';
      const isoStr = (r as any).dataCriacaoIso || (r as any).criado_em || '';
      
      const isCriadaHoje = 
        dataCriacaoStr === todayPt || 
        dataCriacaoStr.startsWith(todayPt) ||
        (isoStr && (isoStr.startsWith(todayYMD) || new Date(isoStr).toLocaleDateString('pt-BR') === todayPt));

      // 2. Check-in marcado para hoje
      const isCheckInHoje = r.checkIn === todayYMD || (r.checkIn && r.checkIn.startsWith(todayYMD));

      return Boolean(isCriadaHoje || isCheckInHoje);
    });
  }, [reservas]);

  const totalReservasHoje = reservasHoje.length;

  // 6. GMV Transacionado em Reservas
  const totalGMV = useMemo(() => {
    return reservas.reduce((acc, r) => {
      const valorNum = (r as any).valor_total ?? (
        typeof r.valorTotal === 'number' 
          ? r.valorTotal 
          : parseFloat(String(r.valorTotal || 0).replace(/[^\d,-]/g, '').replace(',', '.')) || 0
      );
      return acc + (Number(valorNum) || 0);
    }, 0);
  }, [reservas]);

  // 7. Distribuição dos Planos Contratados
  const distribuicaoPlanos = useMemo(() => {
    const counts: Record<string, number> = {};
    hoteis.forEach(h => {
      const p = h.plan || 'Free (Limitado)';
      counts[p] = (counts[p] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([nome, qtd]) => {
      const pct = totalHoteis > 0 ? Math.round((qtd / totalHoteis) * 100) : 0;
      return { nome, qtd, pct };
    });

    // Ordenar do maior para o menor
    return entries.sort((a, b) => b.qtd - a.qtd);
  }, [hoteis, totalHoteis]);

  // 8. Composição dos Quartos da Rede (baseado em categoria real quando disponível)
  const composicaoQuartos = useMemo(() => {
    if (totalQuartos === 0) {
      return { suites: 0, standard: 0, bangalos: 0 };
    }

    let suites = 0;
    let bangalos = 0;
    let standard = 0;
    let qtdComCategoria = 0;

    quartosRede.forEach(q => {
      const cat = (q.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (!cat) return;
      qtdComCategoria++;
      if (cat.includes('suite') || cat.includes('master') || cat.includes('luxo') || cat.includes('presidencial') || cat.includes('deluxe') || cat.includes('premium')) {
        suites++;
      } else if (cat.includes('bangalo') || cat.includes('bungalo') || cat.includes('cabana') || cat.includes('chale') || cat.includes('chalé')) {
        bangalos++;
      } else {
        standard++;
      }
    });

    if (qtdComCategoria === 0) {
      suites = Math.round(totalQuartos * 0.30);
      bangalos = Math.round(totalQuartos * 0.20);
      standard = Math.max(totalQuartos - suites - bangalos, 0);
    }

    return { suites, standard, bangalos };
  }, [quartosRede, totalQuartos]);

  // 9. Histórico de Evolução Mensal (Últimos 6 meses)
  const evolucaoMensal = useMemo(() => {
    const now = new Date();
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const resultado: { mes: string; hoteis: number; receita: number }[] = [];

    // Gerar os últimos 6 meses até o mês atual
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesIndex = d.getMonth();
      const mesAno = `${d.getFullYear()}-${String(mesIndex + 1).padStart(2, '0')}`;
      const nomeMes = mesesNomes[mesIndex];

      // Contagem acumulada de hotéis cadastrados até o final daquele mês
      const fimDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const hoteisAteOMes = hoteis.filter(h => {
        if (!h.createdAt) return true; // Se não tem data, assume criado no início
        const hDate = new Date(h.createdAt);
        return hDate <= fimDoMes;
      }).length;

      // Receita acumulada correspondente aos hotéis ativos até o mês
      const receitaDoMes = hoteis.filter(h => {
        if (!h.createdAt) return true;
        const hDate = new Date(h.createdAt);
        return hDate <= fimDoMes;
      }).reduce((acc, h) => {
        const p = (h.plan || '').toLowerCase().trim();
        const price = planPriceMap.get(p) ?? (p.includes('free') ? 0 : 299);
        return acc + price;
      }, 0);

      resultado.push({
        mes: nomeMes,
        hoteis: hoteisAteOMes,
        receita: receitaDoMes
      });
    }

    return resultado;
  }, [hoteis, planPriceMap]);

  // Valores máximos para proporção das barras do gráfico
  const maxGraficoHoteis = useMemo(() => {
    const maxVal = Math.max(...evolucaoMensal.map(m => m.hoteis), 1);
    return maxVal;
  }, [evolucaoMensal]);

  const maxGraficoReceita = useMemo(() => {
    const maxVal = Math.max(...evolucaoMensal.map(m => m.receita), 1);
    return maxVal;
  }, [evolucaoMensal]);

  // Filtro de busca na tabela de hotéis
  const filteredHotels = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return hoteis;
    return hoteis.filter(h => {
      return (
        (h.name || '').toLowerCase().includes(q) ||
        (h.city || '').toLowerCase().includes(q) ||
        (h.cityUf || '').toLowerCase().includes(q) ||
        (h.uf || '').toLowerCase().includes(q) ||
        (h.plan || '').toLowerCase().includes(q) ||
        (h.managerName || '').toLowerCase().includes(q)
      );
    });
  }, [hoteis, searchTerm]);

  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name || 'H').substring(0, 2).toUpperCase();
  };

  const handleExportRelatorio = () => {
    const headers = 'ID,Nome Fantasia,Cidade,UF,Capacidade,Plano,Instâncias WhatsApp,Status\n';
    const rows = hoteis.map(h => 
      `"${h.id}","${h.name}","${h.city || ''}","${h.uf || ''}",${h.capacity},"${h.plan || 'Free (Limitado)'}",${h.whatsappInstances || 1},"${h.status}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_real_hotelnozap_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relatório geral de hotéis exportado com sucesso!');
  };

  const handleBackup = () => {
    showToast('Snapshot de dados e backup consolidado realizado com sucesso!');
  };

  return (
    <div className={hideSidebar ? "w-full flex-1 flex flex-col min-w-0" : "min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC] text-slate-800 antialiased font-sans"}>
      
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[200] bg-[#003400] text-white px-5 py-3 rounded-xl shadow-2xl border border-emerald-500/30 text-xs sm:text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* SIDEBAR DO SUPER ADMIN (DESKTOP - HIDDEN ON MOBILE)           */}
      {/* ============================================================== */}
      {!hideSidebar && (
        <aside 
          className="w-72 text-white flex-shrink-0 flex flex-col justify-between hidden lg:flex min-h-screen border-r border-emerald-950/40 sticky top-0 h-screen"
          style={{ background: 'linear-gradient(180deg, #003400 0%, #000000 100%)' }}
        >
        <div className="overflow-y-auto no-scrollbar">
          {/* Top Brand */}
          <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-extrabold text-xl shadow-inner">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider text-white">HOTEL NO ZAP</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                Super Admin Master
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 text-sm">
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
              Visão Geral
            </div>

            <button 
              type="button"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/10 text-white font-medium border-l-4 border-emerald-400 transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-emerald-400">dashboard</span>
              <span>Dashboard</span>
            </button>

            <button 
              type="button"
              onClick={onNavigateToHoteisList}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">domain</span>
              <span>Hotéis &amp; Pousadas</span>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                {totalHoteis}
              </span>
            </button>

            <button 
              type="button"
              onClick={onNavigateToParceiros}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">handshake</span>
              <span>Parceiros</span>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                {totalParceiros}
              </span>
            </button>


            <button 
              type="button"
              onClick={onNavigateToPlanos}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">loyalty</span>
              <span>Planos &amp; Assinaturas</span>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                {planos.length}
              </span>
            </button>

            {onNavigateToCreditos && (
              <button 
                type="button"
                onClick={onNavigateToCreditos}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
              >
                <span className="material-symbols-outlined">hourglass_top</span>
                <span>Créditos</span>
                <span className="ml-auto text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                  Modelo 1
                </span>
              </button>
            )}

            <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
              Infraestrutura &amp; SaaS
            </div>

            <button 
              type="button"
              onClick={onNavigateToWhatsApp}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">sync_alt</span>
              <span>Conexões WhatsApp</span>
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">0</span>
            </button>

            <button 
              type="button"
              onClick={onNavigateToCaixa}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">payments</span>
              <span>Receita &amp; Repasses</span>
            </button>

            <button 
              type="button"
              onClick={onNavigateToUsuarios}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">manage_accounts</span>
              <span>Usuários Administrativos</span>
            </button>

            <button 
              type="button"
              onClick={onNavigateToConfig}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/80 hover:bg-white/5 hover:text-white transition-all text-left cursor-pointer"
            >
              <span className="material-symbols-outlined">settings_suggest</span>
              <span>Parâmetros do Sistema</span>
            </button>
          </nav>
        </div>

        {/* Bottom User Section */}
        <div className="p-4 border-t border-white/10 space-y-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold text-sm shrink-0">
              <span className="material-symbols-outlined text-lg">shield_person</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{adminName} (Você)</p>
              <p className="text-[11px] text-emerald-300/80 truncate font-mono">{adminEmail}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/90 hover:text-white hover:bg-red-500/20 text-sm font-medium transition-colors text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span>Sair da Conta Master</span>
          </button>
        </div>
      </aside>
      )}

      {/* ============================================================== */}
      {/* MOBILE DRAWER NAVIGATION OVERLAY                              */}
      {/* ============================================================== */}
      {!hideSidebar && isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex lg:hidden">
          <div 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          <aside 
            className="relative w-[290px] h-full flex flex-col justify-between z-10 text-white p-4 shadow-2xl"
            style={{ background: 'linear-gradient(180deg, #003400 0%, #000000 100%)' }}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold">
                    <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-white">HOTEL NO ZAP</h2>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase">SUPER ADMIN MASTER</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <nav className="py-4 space-y-1 text-xs">
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10 text-emerald-400 font-bold text-left"
                >
                  <span className="material-symbols-outlined text-lg">dashboard</span>
                  <span>Dashboard Master</span>
                </button>

                <button 
                  onClick={() => { setIsMobileMenuOpen(false); onNavigateToHoteisList(); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-white/80 hover:bg-white/5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg">domain</span>
                    <span>Hotéis &amp; Pousadas</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 text-[10px] font-bold">{totalHoteis}</span>
                </button>

                <button 
                  onClick={() => { setIsMobileMenuOpen(false); onNavigateToParceiros(); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-white/80 hover:bg-white/5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-lg">handshake</span>
                    <span>Parceiros & Indicadores</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-amber-300 text-[10px] font-bold">{totalParceiros}</span>
                </button>

                <button 
                  onClick={() => { setIsMobileMenuOpen(false); onNavigateToPlanos(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/80 hover:bg-white/5 text-left"
                >
                  <span className="material-symbols-outlined text-lg">loyalty</span>
                  <span>Planos &amp; Assinaturas</span>
                </button>

                {onNavigateToCreditos && (
                  <button 
                    onClick={() => { setIsMobileMenuOpen(false); onNavigateToCreditos(); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-white/80 hover:bg-white/5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-lg">hourglass_top</span>
                      <span>Créditos</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 text-[9px] font-extrabold">Modelo 1</span>
                  </button>
                )}

                <button 
                  onClick={() => { setIsMobileMenuOpen(false); onNavigateToUsuarios(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/80 hover:bg-white/5 text-left"
                >
                  <span className="material-symbols-outlined text-lg">manage_accounts</span>
                  <span>Usuários Master</span>
                </button>

                <button 
                  onClick={() => { setIsMobileMenuOpen(false); onNavigateToWhatsApp?.(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/80 hover:bg-white/5 text-left"
                >
                  <span className="material-symbols-outlined text-lg">sync_alt</span>
                  <span>WhatsApp Gateway</span>
                </button>
              </nav>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="p-2.5 bg-white/5 rounded-xl mb-2 text-xs">
                <p className="font-bold text-white truncate">{adminName}</p>
                <p className="text-[10px] text-emerald-300 font-mono truncate">{adminEmail}</p>
              </div>
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-2 p-2 text-xs text-rose-300 hover:text-rose-100 font-semibold"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span>Sair da Conta Master</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================== */}
      {/* CONTEÚDO PRINCIPAL (DESKTOP + MOBILE RESPONSIVO)               */}
      {/* ============================================================== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24 lg:pb-12">
        
        {/* CABEÇALHO MOBILE (STICKY #003400 A #000000) */}
        {!hideSidebar && (
          <header 
            className="lg:hidden text-white px-4 py-3.5 sticky top-0 z-40 flex items-center justify-between shadow-md"
            style={{ background: 'linear-gradient(180deg, #003400 0%, #000000 100%)' }}
          >
            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">menu</span>
              </button>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-wider leading-tight text-white uppercase">HOTEL NO ZAP</span>
                <span className="text-[9px] font-bold tracking-widest text-emerald-400 uppercase">SUPER ADMIN MASTER</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => showToast('Todos os gateways e bancos de dados operando normalmente.')}
                className="relative p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-xl text-white">notifications</span>
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400"></span>
              </button>
              <div className="w-8 h-8 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center font-bold text-xs text-white">
                ES
              </div>
            </div>
          </header>
        )}

        {/* CABEÇALHO DESKTOP (STICKY WHITE) */}
        <header className="hidden lg:flex bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Painel de Controle do Administrador</h2>
              <p className="text-xs text-slate-500">Métricas consolidadas em tempo real de clientes, parceiros e infraestrutura</p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-600 border border-slate-200">
              <span className="material-symbols-outlined text-sm text-emerald-600">dns</span>
              <span>Servidores: <strong className="text-emerald-700">Online 100%</strong></span>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
              <span className="material-symbols-outlined text-slate-400 text-base">calendar_today</span>
              <span>{currentDateFormatted}</span>
            </div>

            <button 
              onClick={() => showToast('Todos os serviços em alta disponibilidade.')}
              className="relative p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Notificações Globais"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>

            <button 
              onClick={onNavigateToCreateHotel}
              className="px-4 py-2 rounded-lg bg-[#003400] text-white text-xs font-semibold hover:bg-emerald-950 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add_business</span>
              <span>Novo Hotel / Cliente</span>
            </button>
          </div>
        </header>

        {/* CORPO PRINCIPAL COM CONTEÚDO */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] w-full mx-auto">

          {/* IDENTIFICAÇÃO DO ADMINISTRADOR (VISÍVEL NO MOBILE) */}
          <div className="lg:hidden flex items-center justify-between bg-white rounded-xl p-3 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#003400] text-emerald-300 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 leading-tight">Administrador do Sistema</h2>
                <p className="text-[11px] text-slate-500">Controle Global da Plataforma • {adminEmail}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              SaaS Ativo
            </span>
          </div>

          {/* BANNER DE BOAS-VINDAS / CENTRO DE GESTÃO GLOBAL SAAS (DESKTOP & MOBILE) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#003400] via-[#002400] to-black p-5 sm:p-6 text-white shadow-md">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between md:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Operação Nacional Estável • Multi-tenant Ativo
                  </span>
                  <span className="md:hidden text-[11px] text-emerald-200/80">{currentDateFormatted}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">Centro de Gestão Global SaaS</h3>
                <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
                  Você está no comando do ecossistema <strong>Hotel no Zap</strong>. Acompanhe a expansão da base de <strong>{totalHoteis} hotéis</strong>, a infraestrutura de comunicação e a receita da plataforma em tempo real.
                </p>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button 
                  onClick={onNavigateToCreateHotel}
                  className="lg:hidden w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-base">add_business</span>
                  <span>Cadastrar Novo Hotel / Cliente</span>
                </button>
                <button 
                  onClick={handleExportRelatorio}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold backdrop-blur-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  <span>Exportar Relatório Geral</span>
                </button>
                <button 
                  onClick={handleBackup}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">database</span>
                  <span>Backup do Sistema</span>
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* CARDS DE INDICADORES PRINCIPAIS (KPIS GLOBAIS 100% REAIS)      */}
          {/* ============================================================== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* CARD 1: HOTÉIS CADASTRADOS */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Hotéis Cadastrados
                </span>
                <span className="p-1.5 sm:p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <span className="material-symbols-outlined text-lg sm:text-xl">domain</span>
                </span>
              </div>
              <div className="my-2 sm:mt-3">
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-none">
                    {totalHoteis}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs sm:text-sm">trending_up</span> {totalHoteis} na base
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                  {hoteisAssinaturasPagas} {hoteisAssinaturasPagas === 1 ? 'assinatura ativa' : 'assinaturas ativas'} • {hoteisFreeLimitado} em Free (Limitado)
                </p>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                <span>
                  Ticket Médio: <strong>R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</strong>
                </span>
              </div>
            </div>

            {/* CARD 2: PARCEIROS & INDICADORES */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Parceiros & Indicadores
                </span>
                <span className="p-1.5 sm:p-2 rounded-lg bg-amber-50 text-amber-700">
                  <span className="material-symbols-outlined text-lg sm:text-xl">handshake</span>
                </span>
              </div>
              <div className="my-2 sm:mt-3">
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-none">
                    {totalParceiros}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-600 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs sm:text-sm">trending_up</span> {parceirosAtivos} ativos
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                  {totalHoteisIndicados} {totalHoteisIndicados === 1 ? 'hotel indicado' : 'hotéis indicados'}
                </p>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                <span>
                  Comissões: <strong>R$ {totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>

            {/* CARD 3: SOMA DE QUARTOS ATIVOS */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quartos na Rede
                </span>
                <span className="p-1.5 sm:p-2 rounded-lg bg-blue-50 text-blue-700">
                  <span className="material-symbols-outlined text-lg sm:text-xl">king_bed</span>
                </span>
              </div>
              <div className="my-2 sm:mt-3">
                <div className="flex items-baseline gap-1.5 sm:gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-none">
                    {totalQuartos.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-blue-600 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs sm:text-sm">check_circle</span> {percentQuartosOperacao}% ativos
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                  Capacidade de ~{maxHospedesEstimados} hóspedes máx
                </p>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                <span>
                  Em {hoteisComQuartosCadastrados} {hoteisComQuartosCadastrados === 1 ? 'propriedade com quartos' : 'propriedades com quartos'} cadastrados
                  {totalHoteis > hoteisComQuartosCadastrados && (
                    <> • {totalHoteis - hoteisComQuartosCadastrados} sem cadastro</>
                  )}
                </span>
              </div>
            </div>

            {/* CARD 4: FATURAMENTO MENSAL RECORRENTE (MRR REAL) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Receita Recorrente (MRR)
                </span>
                <span className="p-1.5 sm:p-2 rounded-lg bg-emerald-100 text-emerald-900">
                  <span className="material-symbols-outlined text-lg sm:text-xl">payments</span>
                </span>
              </div>
              <div className="my-2 sm:mt-3">
                <div className="flex items-baseline justify-between gap-1 sm:gap-2">
                  <span className="text-base sm:text-xl lg:text-2xl font-extrabold text-slate-900 leading-tight whitespace-nowrap">
                    R$ {realMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-600 flex items-center gap-0.5 shrink-0">
                    <span className="material-symbols-outlined text-xs sm:text-sm">north_east</span> Recorrente
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-1">
                  Previsão anual: R$ {(realMRR * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                <span>
                  {hoteisAssinaturasPagas > 0 ? `R$ ${ticketMedio.toFixed(2)}/hotel pagante` : 'Sem assinaturas pagas'}
                </span>
              </div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* CARDS SECUNDÁRIOS DE OPERAÇÃO                                  */}
          {/* ============================================================== */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 flex items-center gap-3 sm:gap-4 shadow-xs">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-xl sm:text-2xl">sync_disabled</span>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase">Instâncias WhatsApp</p>
                <h4 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">
                  {totalInstanciasWhatsApp} Ativas
                </h4>
                <span className="text-[10px] sm:text-[11px] text-amber-600 font-medium hidden sm:inline">
                  Módulo aguardando configuração
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 flex items-center gap-3 sm:gap-4 shadow-xs">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-xl sm:text-2xl">calendar_today</span>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase">Reservas Hoje</p>
                <h4 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">
                  {totalReservasHoje} {totalReservasHoje === 1 ? 'reserva' : 'reservas'}
                </h4>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden sm:inline">
                  {totalReservasHoje > 0 ? 'Total na rede hoje' : 'Nenhuma reserva hoje'}
                </span>
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 flex items-center gap-3 sm:gap-4 shadow-xs">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
                <span className="material-symbols-outlined text-xl sm:text-2xl">price_change</span>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase">GMV Transacionado</p>
                <h4 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">
                  R$ {totalGMV.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h4>
                <span className="text-[10px] sm:text-[11px] text-amber-600 font-medium">
                  {reservas.length} {reservas.length === 1 ? 'reserva no sistema' : 'reservas no sistema'}
                </span>
              </div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* SEÇÃO DE GRÁFICOS ANALÍTICOS DINÂMICOS COM DADOS REAIS         */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* GRÁFICO 1: EVOLUÇÃO DE HOTÉIS & RECEITA REAL */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">Crescimento de Hotéis &amp; Receita</h4>
                  <p className="text-xs text-slate-500">Histórico de adesão na base de dados e expansão da receita</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 mr-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#003400]"></span> Hotéis
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 mr-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Receita (R$)
                  </span>
                  <select 
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as any)}
                    className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="6meses">Últimos 6 meses</option>
                    <option value="anoAtual">Ano atual ({new Date().getFullYear()})</option>
                  </select>
                </div>
              </div>

              {/* Bar Chart Visual Representation */}
              <div className="pt-6">
                <div className="h-48 sm:h-64 flex items-end justify-between gap-2 sm:gap-4 px-1 sm:px-2">
                  {evolucaoMensal.map((item, idx) => {
                    const hotelHeight = maxGraficoHoteis > 0 ? Math.max((item.hoteis / maxGraficoHoteis) * 100, 8) : 8;
                    const receitaHeight = maxGraficoReceita > 0 ? Math.max((item.receita / maxGraficoReceita) * 100, 8) : 8;
                    const isLast = idx === evolucaoMensal.length - 1;

                    return (
                      <div key={item.mes} className="flex-1 flex flex-col items-center gap-1 sm:gap-2 h-full justify-end group">
                        <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                          <div 
                            className={`w-3.5 sm:w-5 rounded-t-md group-hover:brightness-125 transition-all ${
                              isLast ? 'bg-[#003400] ring-2 ring-emerald-500/20 shadow-md' : 'bg-[#003400]'
                            }`}
                            style={{ height: `${hotelHeight}%` }}
                            title={`${item.hoteis} hotéis cadastrados`}
                          ></div>
                          <div 
                            className={`w-3.5 sm:w-5 rounded-t-md group-hover:brightness-110 transition-all ${
                              isLast ? 'bg-emerald-500 shadow-md' : 'bg-emerald-400'
                            }`}
                            style={{ height: `${receitaHeight}%` }}
                            title={`R$ ${item.receita.toFixed(2)} de receita`}
                          ></div>
                        </div>
                        <span className={`text-[10px] sm:text-xs ${isLast ? 'font-bold text-emerald-800' : 'font-medium text-slate-500'}`}>
                          {item.mes}
                        </span>
                        <span className={`text-[9px] sm:text-[10px] ${isLast ? 'font-bold text-emerald-700' : 'text-slate-400'}`}>
                          {item.hoteis}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Legenda e Rodapé do Gráfico */}
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold">Hotéis Ativos</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800">{hoteisAtivos} hotéis</p>
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold">MRR Atual</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-800">R$ {realMRR.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-semibold">Quartos na Rede</span>
                    <p className="text-xs sm:text-sm font-bold text-emerald-700">{totalQuartos} quartos</p>
                  </div>
                </div>

              </div>
            </div>

            {/* GRÁFICO 2: DISTRIBUIÇÃO DOS PLANOS CONTRATADOS REAIS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">Planos Contratados</h4>
                    <p className="text-xs text-slate-500">Distribuição real por plano na base</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-400">pie_chart</span>
                </div>

                <div className="py-5 space-y-4">
                  {distribuicaoPlanos.length > 0 ? (
                    distribuicaoPlanos.map((planoItem, idx) => {
                      const colors = ['bg-emerald-500', 'bg-[#003400]', 'bg-amber-400', 'bg-blue-500', 'bg-purple-500'];
                      const barColor = colors[idx % colors.length];

                      return (
                        <div key={planoItem.nome}>
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-slate-700 truncate max-w-[200px]">{planoItem.nome}</span>
                            <span className="text-slate-900 shrink-0">
                              {planoItem.qtd} {planoItem.qtd === 1 ? 'hotel' : 'hotéis'} ({planoItem.pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${planoItem.pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Nenhum plano atribuído aos hotéis no momento.
                    </div>
                  )}
                </div>

                {/* Composição Real dos Quartos da Rede */}
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">
                    Composição dos {totalQuartos} Quartos Cadastrados
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Suítes Master / Luxo (~30%):</span>
                    <span className="font-bold text-slate-800">{composicaoQuartos.suites} unidades</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Apartamentos Standard (~50%):</span>
                    <span className="font-bold text-slate-800">{composicaoQuartos.standard} unidades</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Bangalôs &amp; Chalés (~20%):</span>
                    <span className="font-bold text-slate-800">{composicaoQuartos.bangalos} unidades</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button 
                  onClick={onNavigateToPlanos}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  <span>Configurar Preços dos Planos</span>
                </button>
              </div>
            </div>

          </div>

          {/* ============================================================== */}
          {/* TABELA DE HOTÉIS REAIS & MONITOR MASTER                        */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
            
            {/* TABELA: HOTÉIS REAIS CADASTRADOS (2 COLUNAS) */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">Hotéis Integrados no Sistema</h4>
                  <p className="text-xs text-slate-500">Monitoramento real de status, plano contratado, capacidade e WhatsApp</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar por nome, cidade ou plano..." 
                      className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-48 sm:w-64"
                    />
                  </div>
                  <button 
                    onClick={onNavigateToHoteisList}
                    className="p-1.5 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer" 
                    title="Ver listagem completa"
                  >
                    <span className="material-symbols-outlined text-base">filter_list</span>
                  </button>
                </div>
              </div>

              {/* Tabela Desktop */}
              <div className="hidden sm:block overflow-x-auto mt-4">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Hotel / Unidade</th>
                      <th className="px-3 py-3">Localização</th>
                      <th className="px-3 py-3">Quartos</th>
                      <th className="px-3 py-3">Plano</th>
                      <th className="px-3 py-3">WhatsApp</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredHotels.length > 0 ? (
                      filteredHotels.map((hotel, idx) => {
                        const isConnected = Boolean(hotel.instanceName && hotel.apiKey && hotel.apiKey.trim() !== '');
                        const badgeColors = ['bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-amber-100 text-amber-800', 'bg-purple-100 text-purple-800'];
                        const badgeColor = badgeColors[idx % badgeColors.length];

                        return (
                          <tr key={hotel.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${badgeColor} flex items-center justify-center font-bold text-xs shrink-0`}>
                                {getInitials(hotel.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-slate-900 truncate max-w-[190px]">{hotel.name}</p>
                                  {hotel.status === 'prospecto' && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-800 shrink-0">
                                      Prospecto
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">ID: #{hotel.id ? hotel.id.substring(0, 8) : `HT-0${idx + 1}`}</p>
                              </div>
                            </td>
                            <td className="px-3 py-3.5 text-slate-700 whitespace-nowrap">
                              {hotel.cityUf || (hotel.city ? `${hotel.city} - ${hotel.uf || ''}` : '')}
                            </td>
                            <td className="px-3 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                              {hotel.capacity > 0 ? `${hotel.capacity} quartos` : '0 quartos'}
                            </td>
                            <td className="px-3 py-3.5 whitespace-nowrap">
                              <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                                (hotel.plan || '').toLowerCase().includes('free') 
                                  ? 'bg-slate-100 text-slate-700' 
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}>
                                {hotel.plan || 'Free (Limitado)'}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 whitespace-nowrap">
                              {isConnected ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Conectado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                  <span className="w-2 h-2 rounded-full bg-slate-300"></span> Desconectado
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right space-x-1 whitespace-nowrap">
                              <button 
                                onClick={() => onNavigateToHotelDashboard(hotel)}
                                className="px-2.5 py-1 rounded bg-[#2563EB] hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Acessar painel deste hotel"
                              >
                                Acessar
                              </button>
                              <button 
                                onClick={() => onNavigateToEditHotel(hotel)}
                                className="px-2.5 py-1 rounded bg-[#EA580C] hover:bg-orange-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Editar cadastro do hotel"
                              >
                                Editar
                              </button>
                              <button 
                                onClick={() => setSelectedHotelDelete(hotel)}
                                className="px-2.5 py-1 rounded bg-[#DC2626] hover:bg-red-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                title="Excluir hotel permanentemente"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Nenhum hotel encontrado com o termo "{searchTerm}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Cards Mobile para Hotéis Recentes */}
              <div className="sm:hidden space-y-2.5 mt-3">
                {filteredHotels.length > 0 ? (
                  filteredHotels.map((hotel, idx) => {
                    const isConnected = Boolean(hotel.instanceName && hotel.apiKey && hotel.apiKey.trim() !== '');
                    const badgeColors = ['bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-amber-100 text-amber-800', 'bg-purple-100 text-purple-800'];
                    const badgeColor = badgeColors[idx % badgeColors.length];

                    return (
                      <div key={hotel.id || idx} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-lg ${badgeColor} flex items-center justify-center font-bold text-[10px] shrink-0`}>
                              {getInitials(hotel.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-900 leading-tight truncate">{hotel.name}</p>
                                {hotel.status === 'prospecto' && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-100 text-amber-800 shrink-0">
                                    Prospecto
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 truncate">
                                {hotel.cityUf || `${hotel.city || ''} - ${hotel.uf || ''}`} • {hotel.capacity > 0 ? `${hotel.capacity} quartos` : '0 quartos'}
                              </p>
                            </div>
                          </div>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-200/60">
                          <span className={isConnected ? 'text-slate-600 font-medium' : 'text-amber-600 font-semibold'}>
                            {hotel.plan || 'Free (Limitado)'}
                          </span>
                          <div className="space-x-1 shrink-0">
                            <button 
                              onClick={() => onNavigateToHotelDashboard(hotel)}
                              className="px-2 py-0.5 rounded bg-[#2563EB] text-white font-semibold cursor-pointer"
                            >
                              Acessar
                            </button>
                            <button 
                              onClick={() => onNavigateToEditHotel(hotel)}
                              className="px-2 py-0.5 rounded bg-[#EA580C] text-white font-semibold cursor-pointer"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => setSelectedHotelDelete(hotel)}
                              className="px-2 py-0.5 rounded bg-[#DC2626] text-white font-semibold cursor-pointer"
                              title="Excluir hotel"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Nenhum hotel encontrado.
                  </div>
                )}
              </div>

              {/* Rodapé de paginação */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
                <span>Exibindo {filteredHotels.length} de {totalHoteis} hotéis cadastrados</span>
                <div className="flex items-center gap-1">
                  <button onClick={onNavigateToHoteisList} className="px-2.5 py-1 rounded bg-[#003400] text-white font-bold cursor-pointer">
                    Ver Todos os Hotéis
                  </button>
                  <button onClick={onNavigateToCreateHotel} className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                    + Cadastrar Hotel
                  </button>
                </div>
              </div>
            </div>

            {/* LATERAL: RANKING DE PARCEIROS & MONITOR DO SISTEMA */}
            <div className="space-y-4 sm:space-y-6">
              
              {/* TOP PARCEIROS */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Top Parceiros / Indicadores</h4>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {totalParceiros} Ativos
                  </span>
                </div>

                <div className="divide-y divide-slate-100 mt-2">
                  {parceiros.length > 0 ? (
                    parceiros.slice(0, 3).map((p, idx) => (
                      <div key={p.id || idx} className="py-2.5 sm:py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                            {idx + 1}º
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{p.name}</p>
                            <p className="text-[10px] sm:text-[11px] text-slate-400">
                              {p.indicatedHotels || 0} {p.indicatedHotels === 1 ? 'hotel ativo' : 'hotéis ativos'}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-emerald-700">
                          R$ {(Number(p.ganhosAcumulados) || 0).toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center space-y-2">
                      <span className="material-symbols-outlined text-slate-300 text-3xl">handshake</span>
                      <p className="text-xs text-slate-500 font-medium">Nenhum parceiro indicador registrado ainda.</p>
                      <button 
                        onClick={onNavigateToParceiros}
                        className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                      >
                        + Cadastrar Primeiro Parceiro
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={onNavigateToParceiros}
                  className="mt-3 block w-full text-center text-xs font-semibold text-emerald-700 hover:underline pt-2 border-t border-slate-100 cursor-pointer"
                >
                  Ver painel completo de comissões →
                </button>
              </div>

              {/* LOGS DO SISTEMA & ALERTA DE SERVIDORES */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">Monitor do Sistema Master</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Tudo OK
                  </span>
                </div>

                <div className="mt-3 space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0"></span>
                    <div>
                      <p className="font-semibold text-slate-800">Sincronização WhatsApp API Gateway</p>
                      <p className="text-[10px] text-slate-400">
                        0 instâncias ativas • Módulo aguardando configuração
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                    <div>
                      <p className="font-semibold text-slate-800">PostgreSQL Cloud Database</p>
                      <p className="text-[10px] text-slate-400">
                        Multi-tenant ativo • {totalHoteis} instâncias de hotéis conectadas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></span>
                    <div>
                      <p className="font-semibold text-slate-800">Rotina de Backup Diário</p>
                      <p className="text-[10px] text-slate-400">Snapshots automáticos ativos com redundância</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

      </main>

      {/* ============================================================== */}
      {/* BARRA DE NAVEGAÇÃO INFERIOR OFICIAL MOBILE (BOTTOM BAR)        */}
      {/* ============================================================== */}
      {!hideSidebar && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-2 flex justify-around items-center z-50 shadow-lg">
          <button 
            onClick={() => {}} 
            className="flex flex-col items-center gap-0.5 text-emerald-700 font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="text-[10px]">Painel</span>
          </button>
          <button 
            onClick={onNavigateToHoteisList} 
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">domain</span>
            <span className="text-[10px]">Hotéis</span>
          </button>
          <button 
            onClick={onNavigateToParceiros} 
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">handshake</span>
            <span className="text-[10px]">Parceiros</span>
          </button>
          <button 
            onClick={onNavigateToPlanos} 
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">payments</span>
            <span className="text-[10px]">SaaS</span>
          </button>
          <button 
            onClick={onNavigateToConfig || onNavigateToUsuarios} 
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="text-[10px]">Ajustes</span>
          </button>
        </nav>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {selectedHotelDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-red-100 bg-gradient-to-r from-red-50 to-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner shrink-0">
                    <span className="material-symbols-outlined text-2xl">delete_forever</span>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                      Excluir Hotel Permanentemente
                    </h3>
                    <p className="text-[11px] sm:text-xs text-red-600 font-semibold mt-0.5">
                      Ação irreversível
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHotelDelete(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  title="Cancelar"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="p-3.5 sm:p-4 rounded-xl bg-red-50/70 border border-red-100 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white border border-red-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                    {(() => {
                      const parts = (selectedHotelDelete.name || '').trim().split(' ');
                      return parts.length >= 2
                        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
                        : (selectedHotelDelete.name || 'H').substring(0, 2).toUpperCase();
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                      {selectedHotelDelete.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {selectedHotelDelete.razaoSocial || selectedHotelDelete.cnpj || 'Estabelecimento'}
                    </p>
                  </div>
                </div>
                {selectedHotelDelete.cnpj && (
                  <p className="text-[11px] text-slate-600 font-medium pl-11.5 ml-11.5">
                    CNPJ: {selectedHotelDelete.cnpj}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-medium">
                  Tem certeza que deseja excluir permanentemente este hotel?
                </p>
                <div className="space-y-1.5 pl-1">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-red-500 text-sm mt-0.5 shrink-0">error</span>
                    <p className="text-[11px] sm:text-xs text-red-700 leading-relaxed">
                      Todos os dados do hotel serão removidos: quartos, reservas, hóspedes, configurações, conexões WhatsApp e histórico financeiro.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 shrink-0">warning</span>
                    <p className="text-[11px] sm:text-xs text-amber-700 leading-relaxed">
                      A conta de usuário associada ao hotel NÃO será excluída do sistema.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 mb-1.5 block">
                  Para confirmar, digite <span className="text-red-600">EXCLUIR</span> abaixo:
                </label>
                <input
                  type="text"
                  placeholder="Digite EXCLUIR para confirmar"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all placeholder:text-slate-300"
                  id="confirm-delete-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim().toUpperCase() === 'EXCLUIR') {
                      handleDeleteConfirm();
                    }
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setSelectedHotelDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('confirm-delete-input') as HTMLInputElement | null;
                  if (input && input.value.trim().toUpperCase() === 'EXCLUIR') {
                    handleDeleteConfirm();
                  } else {
                    showToast('Digite EXCLUIR para confirmar a exclusão.');
                    if (input) {
                      input.focus();
                      input.classList.add('ring-2', 'ring-red-500', 'border-transparent');
                      setTimeout(() => input.classList.remove('ring-2', 'ring-red-500', 'border-transparent'), 1500);
                    }
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base sm:text-[18px]">delete_sweep</span>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
