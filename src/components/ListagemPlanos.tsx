import React, { useState, useEffect, useMemo } from 'react';
import { planosService, hoteisService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';

export interface Plano {
  id: string;
  order: string;
  emoji: string;
  name: string;
  tag?: string;
  description: string;
  periodicity: 'Mensal' | 'Bimestral' | 'Trimestral' | 'Semestral' | 'Anual' | string;
  basePrice: number;
  pricePeriodText: string;
  priceSubtitle?: string;
  roomLimit: number;
  roomLimitText: string;
  roomExtraPriceText: string;
  whatsappConnections: number;
  whatsappConnectionsText: string;
  whatsappExtraPriceText: string;
  hotelsSubscribersCount: number;
  status: 'Ativo' | 'Inativo';
  isFeatured?: boolean;
  features: string[];
  disabledFeatures?: string[];
}

const INITIAL_PLANOS: Plano[] = [
  {
    id: 'gratis-google-maps',
    order: '#00',
    emoji: '🗺️',
    name: 'Grátis (Google Maps)',
    tag: 'Google Maps',
    isFeatured: false,
    description: 'Plano gratuito de entrada para hotéis importados via Google Maps / Places',
    periodicity: 'Mensal',
    basePrice: 0.00,
    pricePeriodText: 'Grátis',
    priceSubtitle: 'Acesso gratuito inicial para estabelecimentos importados',
    roomLimit: 10,
    roomLimitText: 'Capacidade para até 10 quartos',
    roomExtraPriceText: 'Sem quartos adicionais',
    whatsappConnections: 1,
    whatsappConnectionsText: '1 Conexão WhatsApp',
    whatsappExtraPriceText: 'Sem expansão',
    hotelsSubscribersCount: 8,
    status: 'Ativo',
    features: [
      'Plano Gratuito de Entrada (R$ 0,00)',
      'Importado via Google Maps',
      'Página pública do hotel liberada',
      '1 Conexão WhatsApp',
      'Capacidade para até 10 quartos'
    ]
  },
  {
    id: '1-credito',
    order: '#01',
    emoji: '🎁',
    name: '1 Crédito (Adesão / Teste)',
    tag: 'Degustação',
    isFeatured: false,
    description: '1 Crédito • 30 dias base + 15 dias de bônus (45 dias de acesso)',
    periodicity: 'Mensal',
    basePrice: 197.00,
    pricePeriodText: '/45 dias',
    priceSubtitle: '30 dias base + 15 dias bônus • Sem compromisso',
    roomLimit: 15,
    roomLimitText: 'Capacidade para até 15 quartos',
    roomExtraPriceText: 'R$ 3,50/adicional',
    whatsappConnections: 1,
    whatsappConnectionsText: '1 Conexão WhatsApp oficial integrada',
    whatsappExtraPriceText: 'R$ 49,90/adicional',
    hotelsSubscribersCount: 10,
    status: 'Ativo',
    features: [
      '1 Crédito de Acesso',
      '30 dias base + 15 dias bônus (45 dias)',
      'Capacidade para até 15 quartos',
      '1 Conexão WhatsApp oficial integrada',
      'Ideal para começar sem compromisso'
    ]
  },
  {
    id: '2-creditos',
    order: '#02',
    emoji: '⚡',
    name: '2 Créditos (Bimestral)',
    tag: 'Econômico',
    description: '2 Créditos • 60 dias base + 15 dias de bônus (75 dias de acesso)',
    periodicity: 'Mensal',
    basePrice: 349.00,
    pricePeriodText: '/75 dias',
    priceSubtitle: 'Economia imediata com 2 meses e meio de acesso',
    roomLimit: 25,
    roomLimitText: 'Capacidade para até 25 quartos',
    roomExtraPriceText: 'R$ 3,50/adicional',
    whatsappConnections: 2,
    whatsappConnectionsText: '2 Conexões WhatsApp simultâneas',
    whatsappExtraPriceText: 'R$ 49,90/adicional',
    hotelsSubscribersCount: 0,
    status: 'Ativo',
    features: [
      '2 Créditos de Acesso',
      '60 dias base + 15 dias bônus (75 dias)',
      'Capacidade para até 25 quartos',
      '2 Conexões WhatsApp simultâneas',
      'Economia imediata de 2 meses e meio'
    ]
  },
  {
    id: '3-creditos',
    order: '#03',
    emoji: '🥈',
    name: '3 Créditos (Trimestre de Ouro)',
    tag: 'Mais Vendido',
    isFeatured: true,
    description: '3 Créditos • 90 dias base + 30 dias de bônus (120 dias / 4 meses)',
    periodicity: 'Trimestral',
    basePrice: 497.00,
    pricePeriodText: '/120 dias',
    priceSubtitle: 'Perfeito para cobrir uma alta temporada inteira (4 meses)',
    roomLimit: 40,
    roomLimitText: 'Capacidade para até 40 quartos',
    roomExtraPriceText: 'R$ 3,00/adicional',
    whatsappConnections: 3,
    whatsappConnectionsText: '3 Conexões WhatsApp simultâneas',
    whatsappExtraPriceText: 'R$ 39,90/adicional',
    hotelsSubscribersCount: 0,
    status: 'Ativo',
    features: [
      '3 Créditos de Acesso',
      '90 dias base + 30 dias bônus (4 meses)',
      'Capacidade para até 40 quartos',
      '3 Conexões WhatsApp simultâneas',
      'Perfeito para cobrir a alta temporada',
      'Suporte prioritário via WhatsApp'
    ]
  },
  {
    id: '6-creditos',
    order: '#04',
    emoji: '🎖️',
    name: '6 Créditos (Semestral)',
    tag: 'Popular',
    description: '6 Créditos • 180 dias base + 45 dias de bônus (225 dias / 7,5 meses)',
    periodicity: 'Semestral',
    basePrice: 890.00,
    pricePeriodText: '/225 dias',
    priceSubtitle: 'Mais de 7 meses de tranquilidade para a operação',
    roomLimit: 80,
    roomLimitText: 'Capacidade para até 80 quartos',
    roomExtraPriceText: 'R$ 2,50/adicional',
    whatsappConnections: 4,
    whatsappConnectionsText: '4 Conexões WhatsApp dedicadas',
    whatsappExtraPriceText: 'R$ 39,90/adicional',
    hotelsSubscribersCount: 0,
    status: 'Ativo',
    features: [
      '6 Créditos de Acesso',
      '180 dias base + 45 dias bônus (225 dias)',
      'Capacidade para até 80 quartos',
      '4 Conexões WhatsApp dedicadas',
      'Mais de 7 meses de tranquilidade'
    ]
  },
  {
    id: '12-creditos',
    order: '#05',
    emoji: '💎',
    name: '12 Créditos (Anual Fidelidade)',
    tag: '-35% OFF',
    description: '12 Créditos • 365 dias base + 60 dias de bônus (425 dias / > 14 meses)',
    periodicity: 'Anual',
    basePrice: 1690.00,
    pricePeriodText: '/425 dias',
    priceSubtitle: '2 meses inteiros de bônus e maior economia garantida',
    roomLimit: 150,
    roomLimitText: 'Quartos ilimitados (até 150 inclusos)',
    roomExtraPriceText: 'R$ 2,00/adicional',
    whatsappConnections: 5,
    whatsappConnectionsText: '5 Conexões WhatsApp dedicadas',
    whatsappExtraPriceText: 'R$ 29,90/adicional',
    hotelsSubscribersCount: 0,
    status: 'Ativo',
    features: [
      '12 Créditos de Acesso',
      '365 dias base + 60 dias bônus (425 dias)',
      'Quartos ilimitados (até 150 inclusos)',
      '5 Conexões WhatsApp dedicadas',
      '2 meses inteiros de bônus grátis',
      'Gerente de contas e onboarding VIP'
    ]
  }
];

interface ListagemPlanosProps {
  onNavigateToDashboard: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToEdit?: (plan: Plano) => void;
}

export const ListagemPlanos: React.FC<ListagemPlanosProps> = ({ 
  onNavigateToDashboard,
  onNavigateToCreate,
  onNavigateToEdit
}) => {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  const [periodicityFilter, setPeriodicityFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isRegrasModalOpen, setIsRegrasModalOpen] = useState(false);
  const [hoteis, setHoteis] = useState<Hotel[]>([]);

  // Carregar planos e hotéis reais do Supabase e escutar em tempo real
  useEffect(() => {
    let isMounted = true;
    const fetchPlanosEHoteis = async () => {
      try {
        const [dbPlanos, dbHoteis] = await Promise.all([
          planosService.getPlanos(),
          hoteisService.getHoteis()
        ]);

        if (isMounted) {
          if (dbHoteis) {
            setHoteis(dbHoteis);
          }
          if (dbPlanos) {
            // Sincronizar quantidade real de hotéis ativos assinantes em cada plano
            const syncedPlanos = dbPlanos.map(p => {
              const matching = (dbHoteis || []).filter(h => {
                if (h.status === 'bloqueado') return false;
                const hPlan = (h.plan || '').toLowerCase();
                const pName = p.name.toLowerCase();
                return pName.includes(hPlan) || hPlan.includes(pName);
              });
              return {
                ...p,
                hotelsSubscribersCount: matching.length
              };
            });
            setPlanos(syncedPlanos);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar planos e hotéis do banco:', err);
      }
    };

    fetchPlanosEHoteis();

    const handleUpdate = () => fetchPlanosEHoteis();
    window.addEventListener('hotel_novo_hotel', handleUpdate);
    window.addEventListener('hotel_modificado', handleUpdate);

    const unsubscribePlanos = planosService.subscribePlanos(() => {
      fetchPlanosEHoteis();
    });

    const unsubscribeHoteis = hoteisService.subscribeHoteis
      ? hoteisService.subscribeHoteis(fetchPlanosEHoteis)
      : () => {};

    return () => {
      isMounted = false;
      window.removeEventListener('hotel_novo_hotel', handleUpdate);
      window.removeEventListener('hotel_modificado', handleUpdate);
      unsubscribePlanos();
      unsubscribeHoteis();
    };
  }, []);

  // Modais de ação
  const [selectedPlanForView, setSelectedPlanForView] = useState<Plano | null>(null);
  const [planToEdit, setPlanToEdit] = useState<Plano | null>(null);
  const [isModalCreateOpen, setIsModalCreateOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<Plano | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State para Criação / Edição
  const [formData, setFormData] = useState<Partial<Plano>>({
    name: '',
    description: '',
    periodicity: 'Mensal',
    basePrice: 199.00,
    roomLimit: 20,
    whatsappConnections: 1,
    status: 'Ativo',
    features: []
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const savePlanosToStorage = (updated: Plano[]) => {
    setPlanos(updated);
    try {
      localStorage.setItem('hotelnozap_planos_assinatura_v1', JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  // KPIs Reais Dinâmicos
  const totalPlanos = planos.length;
  const planosAtivos = planos.filter(p => p.status === 'Ativo').length;
  
  // Total real de hotéis ativos assinantes
  const totalHoteisAssinantes = useMemo(() => {
    if (hoteis && hoteis.length > 0) {
      return hoteis.filter(h => h.status !== 'bloqueado').length;
    }
    return planos.reduce((acc, p) => acc + (p.hotelsSubscribersCount || 0), 0);
  }, [hoteis, planos]);

  // Novos hotéis cadastrados no mês atual
  const novosHoteisMes = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return (hoteis || []).filter(h => {
      if (!h.createdAt) return false;
      const d = new Date(h.createdAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
  }, [hoteis]);

  // MRR Recorrente Real
  const mrrTotal = useMemo(() => {
    return planos.reduce((acc, p) => {
      if (p.status !== 'Ativo') return acc;
      const count = p.hotelsSubscribersCount || 0;
      let monthlyVal = p.basePrice;
      if (p.periodicity === 'Trimestral') monthlyVal = p.basePrice / 3;
      if (p.periodicity === 'Anual') monthlyVal = p.basePrice / 12;
      return acc + (monthlyVal * count);
    }, 0);
  }, [planos]);

  // Ticket Médio Real por hotel ativo
  const ticketMedio = useMemo(() => {
    if (totalHoteisAssinantes <= 0) return 0;
    return mrrTotal / totalHoteisAssinantes;
  }, [mrrTotal, totalHoteisAssinantes]);

  // Filtragem
  const filteredPlanos = useMemo(() => {
    return planos.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.periodicity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.features.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPeriod =
        periodicityFilter === 'Todas' ||
        p.periodicity.toLowerCase() === periodicityFilter.toLowerCase();

      const matchStatus =
        statusFilter === 'Todos' ||
        p.status.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchPeriod && matchStatus;
    });
  }, [planos, searchTerm, periodicityFilter, statusFilter]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setPeriodicityFilter('Todas');
    setStatusFilter('Todos');
    setIsMobileFilterOpen(false);
  };

  // Exportar em formato CSV
  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Ordem,Nome,Periodicidade,Valor Base,Limite Quartos,Conexoes WhatsApp,Hoteis Assinantes,Status\n" +
      filteredPlanos.map(p => 
        `"${p.order}","${p.name}","${p.periodicity}","R$ ${p.basePrice.toFixed(2)}","${p.roomLimitText}","${p.whatsappConnectionsText}","${p.hotelsSubscribersCount}","${p.status}"`
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `planos_assinatura_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planos exportados com sucesso em CSV!');
  };

  // Excluir plano
  const confirmDelete = async () => {
    if (!planToDelete) return;
    const ok = await planosService.deletePlano(planToDelete.id);
    if (ok) {
      setPlanos(prev => prev.filter(p => p.id !== planToDelete.id));
    } else {
      const updated = planos.filter(p => p.id !== planToDelete.id);
      savePlanosToStorage(updated);
    }
    setPlanToDelete(null);
    showToast(`Plano "${planToDelete.name}" removido com sucesso.`);
  };

  // Abrir Formulário / Modal de Edição
  const handleOpenEdit = (plan: Plano) => {
    if (onNavigateToEdit) {
      onNavigateToEdit(plan);
    } else {
      setPlanToEdit(plan);
      setFormData({ ...plan });
    }
  };

  // Abrir Formulário / Modal de Novo Plano
  const handleOpenCreate = () => {
    if (onNavigateToCreate) {
      onNavigateToCreate();
    } else {
      setPlanToEdit(null);
      setFormData({
        order: `#0${planos.length + 1}`,
        emoji: '⭐',
        name: '',
        tag: '',
        description: '',
        periodicity: 'Mensal',
        basePrice: 249.00,
        pricePeriodText: '/mês',
        priceSubtitle: 'Cobrança recorrente automatizada',
        roomLimit: 25,
        roomLimitText: 'Até 25 quartos',
        roomExtraPriceText: 'R$ 3,50/adicional',
        whatsappConnections: 2,
        whatsappConnectionsText: '2 Conexões WhatsApp',
        whatsappExtraPriceText: 'R$ 49,90/adicional',
        hotelsSubscribersCount: 0,
        status: 'Ativo',
        features: [
          'Capacidade base de 25 quartos',
          '2 Conexões WhatsApp inclusas',
          'Quartos excedentes: + R$ 3,50 /quarto',
          'Instância extra: + R$ 49,90 /conexão',
          'Operadores simultâneos inclusos'
        ]
      });
      setIsModalCreateOpen(true);
    }
  };

  // Salvar Novo ou Editado (Modal)
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Informe o nome do plano.');
      return;
    }

    if (planToEdit) {
      await planosService.updatePlano(planToEdit.id, formData);
      const updated = planos.map(p => {
        if (p.id === planToEdit.id) {
          return {
            ...p,
            ...formData,
            roomLimitText: `Capacidade para até ${formData.roomLimit} quartos`,
            whatsappConnectionsText: `${formData.whatsappConnections} Conexão${(formData.whatsappConnections || 1) > 1 ? 'ões' : ''} WhatsApp`
          } as Plano;
        }
        return p;
      });
      savePlanosToStorage(updated);
      setPlanToEdit(null);
      showToast(`Plano "${formData.name}" atualizado com sucesso!`);
    } else {
      const created = await planosService.createPlano(formData);
      const newPlan: Plano = {
        id: created?.id || `plano-${Date.now()}`,
        order: formData.order || `#0${planos.length + 1}`,
        emoji: formData.emoji || '⭐',
        name: formData.name || 'Novo Plano',
        tag: formData.tag || '',
        description: formData.description || 'Plano customizado',
        periodicity: (formData.periodicity as any) || 'Mensal',
        basePrice: Number(formData.basePrice) || 199.00,
        pricePeriodText: formData.periodicity === 'Anual' ? '/ano' : formData.periodicity === 'Trimestral' ? '/trimestre' : '/mês',
        priceSubtitle: formData.priceSubtitle || 'Cobrança recorrente',
        roomLimit: Number(formData.roomLimit) || 20,
        roomLimitText: `Capacidade para até ${formData.roomLimit || 20} quartos`,
        roomExtraPriceText: formData.roomExtraPriceText || 'R$ 3,50/adicional',
        whatsappConnections: Number(formData.whatsappConnections) || 1,
        whatsappConnectionsText: `${formData.whatsappConnections || 1} Conexão WhatsApp`,
        whatsappExtraPriceText: formData.whatsappExtraPriceText || 'R$ 49,90/adicional',
        hotelsSubscribersCount: 0,
        status: (formData.status as any) || 'Ativo',
        features: formData.features && formData.features.length > 0 ? formData.features : [
          `Capacidade para até ${formData.roomLimit || 20} quartos`,
          `${formData.whatsappConnections || 1} Conexão WhatsApp oficial integrada`,
          'Suporte integrado'
        ]
      };
      savePlanosToStorage([...planos, newPlan]);
      setIsModalCreateOpen(false);
      showToast(`Novo plano "${newPlan.name}" criado com sucesso!`);
    }
  };

  return (
    <div className="bg-[#F8FAFC] text-slate-800 min-h-screen font-sans antialiased">
      
      {/* TOAST FLUTUANTE GLOBAL */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VERSÃO MOBILE (Exibida em telas menores que lg)
          1:1 fiel à imagem e especificação mobile
      ───────────────────────────────────────────────────────────── */}
      <div className="block lg:hidden px-3.5 pt-3 pb-28 space-y-4 max-w-md mx-auto">
        
        {/* TÍTULO MOBILE */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between pt-0.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Planos de Assinatura</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              {planosAtivos} Ativos
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal">Gerencie os pacotes e regras de SaaS.</p>
        </section>

        {/* 2 LINHAS DE BOTÕES DE AÇÃO MOBILE */}
        <section className="space-y-2">
          {/* Linha 1 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center justify-center gap-1.5 bg-[#003400] text-white py-2.5 px-3 rounded-lg text-xs font-semibold shadow-xs hover:bg-[#002500] active:scale-[0.98] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Novo Plano</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRegrasModalOpen(true)}
              className="flex items-center justify-center gap-1.5 bg-[#10B981] text-white py-2.5 px-3 rounded-lg text-xs font-semibold shadow-xs hover:bg-emerald-600 active:scale-[0.98] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">rule</span>
              <span>Regras Gerais</span>
            </button>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 bg-[#FDB116] text-slate-950 py-2 px-3 rounded-lg text-xs font-semibold shadow-xs hover:bg-amber-400 active:scale-[0.98] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-slate-950">download</span>
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Módulo de importação em lote acionado.')}
              className="flex items-center justify-center gap-1.5 bg-white text-slate-700 border border-slate-300 py-2 px-3 rounded-lg text-xs font-semibold shadow-xs hover:bg-slate-50 active:scale-[0.98] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-slate-600">upload</span>
              <span>Importar</span>
            </button>
          </div>
        </section>

        {/* BUSCA E FILTROS MOBILE */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar planos..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className={`flex items-center gap-1 px-3 py-2 border rounded-lg text-xs font-medium active:scale-95 transition cursor-pointer ${
                isMobileFilterOpen || periodicityFilter !== 'Todas' || statusFilter !== 'Todos'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-base text-slate-500">tune</span>
              <span>Filtros</span>
            </button>
          </div>

          {/* Painel Expansível de Filtros Mobile */}
          {isMobileFilterOpen && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Periodicidade</label>
                  <select
                    value={periodicityFilter}
                    onChange={(e) => setPeriodicityFilter(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <option value="Todas">Todas</option>
                    <option value="Mensal">Mensal</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>
              {(searchTerm || periodicityFilter !== 'Todas' || statusFilter !== 'Todos') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full py-1.5 text-xs text-center text-slate-600 font-semibold hover:text-slate-900 border-t border-slate-100 pt-2 cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          )}
        </section>

        {/* 4 KPIS EM GRID 2X2 MOBILE */}
        <section className="grid grid-cols-2 gap-2.5">
          {/* Total Planos */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-[10px] font-bold tracking-wide uppercase">TOTAL PLANOS</span>
              <span className="material-symbols-outlined text-sm opacity-80">layers</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-black text-slate-900 leading-tight">{totalPlanos}</span>
              <p className="text-[10px] text-emerald-700 font-medium">
                {planosAtivos === totalPlanos ? 'Todos ativos' : `${planosAtivos} de ${totalPlanos} ativos`}
              </p>
            </div>
          </div>

          {/* Ativos */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-800">
              <span className="text-[10px] font-bold tracking-wide uppercase">ATIVOS</span>
              <span className="material-symbols-outlined text-sm opacity-80">check</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-black text-slate-900 leading-tight">{planosAtivos}</span>
              <p className="text-[10px] text-blue-700 font-medium">Visíveis no portal</p>
            </div>
          </div>

          {/* Assinantes */}
          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-800">
              <span className="text-[10px] font-bold tracking-wide uppercase">ASSINANTES</span>
              <span className="material-symbols-outlined text-sm opacity-80">bed</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-black text-slate-900 leading-tight">{totalHoteisAssinantes}</span>
              <p className="text-[10px] text-amber-700 font-semibold">+{novosHoteisMes} no mês</p>
            </div>
          </div>

          {/* MRR Mensal */}
          <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-800">
              <span className="text-[10px] font-bold tracking-wide uppercase">MRR MENSAL</span>
              <span className="material-symbols-outlined text-sm opacity-80">payments</span>
            </div>
            <div className="mt-1">
              <span className="text-base font-black text-slate-900 leading-tight">
                R$ {Math.round(mrrTotal).toLocaleString('pt-BR')}
              </span>
              <p className="text-[10px] text-purple-700 font-medium">Ticket R$ {Math.round(ticketMedio)}/mês</p>
            </div>
          </div>
        </section>

        {/* LISTAGEM DE CARDS DOS PLANOS MOBILE */}
        <section className="space-y-3.5">
          {filteredPlanos.map((plan) => {
            const isProfessional = plan.isFeatured || plan.name.includes('Professional');
            const isInactive = plan.status === 'Inativo';

            return (
              <article
                key={`mob-${plan.id}`}
                className={`bg-white rounded-xl shadow-xs overflow-hidden relative ${
                  isProfessional ? 'border-2 border-emerald-600 shadow-md' : 'border border-slate-200'
                } ${isInactive ? 'opacity-85' : ''}`}
              >
                {/* Banner Superior Destaque */}
                {isProfessional && (
                  <div className="bg-gradient-to-r from-emerald-950 via-[#003400] to-emerald-900 text-amber-400 text-[10px] font-bold tracking-wide py-1 px-3 text-center flex items-center justify-center gap-1">
                    <span>★</span>
                    <span>MAIS ESCOLHIDO PELOS HOTÉIS</span>
                  </div>
                )}

                <div className="p-3.5 space-y-3">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                        isInactive
                          ? 'bg-slate-100 text-slate-500'
                          : isProfessional
                          ? 'bg-emerald-100 text-emerald-800'
                          : plan.name.includes('Enterprise')
                          ? 'bg-purple-100 text-purple-800'
                          : plan.name.includes('Anual')
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {plan.emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h2 className={`text-sm font-bold leading-tight ${isInactive ? 'text-slate-700' : 'text-slate-900'}`}>
                            {plan.name}
                          </h2>
                          {plan.tag && plan.tag !== 'Mais Vendido' && (
                            <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                              {plan.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{plan.description}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      plan.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${plan.status === 'Ativo' ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                      {plan.status}
                    </span>
                  </div>

                  {/* Preço e Período */}
                  <div className="flex items-baseline justify-between pt-1 border-b border-slate-100 pb-2.5">
                    <div>
                      <span className={`text-2xl font-black ${isInactive ? 'text-slate-700' : 'text-slate-950'}`}>
                        R$ {plan.basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-slate-500 font-medium"> {plan.pricePeriodText}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      plan.periodicity === 'Anual'
                        ? 'text-blue-700 bg-blue-50 border border-blue-100'
                        : isProfessional
                        ? 'text-emerald-800 bg-emerald-50 border border-emerald-100'
                        : plan.name.includes('Enterprise')
                        ? 'text-purple-700 bg-purple-50 border border-purple-100'
                        : isInactive
                        ? 'text-slate-500 bg-slate-100'
                        : 'text-slate-600 bg-slate-100'
                    }`}>
                      {plan.periodicity === 'Anual' ? 'Equiv. R$ 239/mês' : plan.name.includes('Enterprise') ? 'Ilimitado' : plan.periodicity}
                    </span>
                  </div>

                  {/* Lista de Recursos / Limites */}
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-base shrink-0 ${
                          isInactive ? 'text-slate-400' : 'text-emerald-600'
                        }`}>
                          check
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.disabledFeatures && plan.disabledFeatures.map((dFeature, dIdx) => (
                      <li key={`dis-${dIdx}`} className="flex items-center gap-1.5 text-slate-400 line-through">
                        <span className="material-symbols-outlined text-base shrink-0 text-slate-400">
                          close
                        </span>
                        <span>{dFeature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Rodapé do Card: Assinantes e Ações Rápidas */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">
                        {plan.hotelsSubscribersCount} {plan.hotelsSubscribersCount === 1 ? 'hotel' : 'hotéis'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {isInactive ? 'sem renovações' : 'assinantes ativos'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForView(plan)}
                        className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 shadow-xs cursor-pointer"
                        title="Visualizar"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(plan)}
                        className="w-8 h-8 rounded-lg bg-[#EA580C] text-white flex items-center justify-center hover:bg-orange-700 active:scale-95 shadow-xs cursor-pointer"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanToDelete(plan)}
                        className="w-8 h-8 rounded-lg bg-[#DC2626] text-white flex items-center justify-center hover:bg-red-700 active:scale-95 shadow-xs cursor-pointer"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {/* PAGINAÇÃO MOBILE */}
        <nav aria-label="Paginação" className="flex items-center justify-between pt-2 pb-2 text-xs text-slate-500">
          <span>Exibindo <strong>{filteredPlanos.length}</strong> planos</span>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 rounded border border-slate-200 bg-white text-slate-300 flex items-center justify-center cursor-not-allowed" disabled type="button">
              <span className="material-symbols-outlined text-xs">chevron_left</span>
            </button>
            <button className="w-7 h-7 rounded bg-[#003400] text-white font-bold flex items-center justify-center shadow-xs" type="button">
              1
            </button>
            <button className="w-7 h-7 rounded border border-slate-200 bg-white text-slate-300 flex items-center justify-center cursor-not-allowed" disabled type="button">
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>
        </nav>

      </div>


      {/* ─────────────────────────────────────────────────────────────
          VERSÃO DESKTOP (Exibida em telas lg e superiores)
          1:1 fiel à especificação de desktop
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block p-4 sm:p-6 lg:p-6 w-full max-w-[1440px] mx-auto space-y-6">

        {/* HEADER CARD */}
        <header className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs border border-emerald-200">
              <span className="material-symbols-outlined text-2xl">sell</span>
            </div>
            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Planos de Assinatura</h1>
              <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                Gerencie os planos de assinatura do sistema, precificação baseada em limites de quartos e conexões de WhatsApp integradas.
              </p>
            </div>
          </div>

          {/* Action Buttons - Always on same line */}
          <div className="flex items-center gap-3 shrink-0 flex-nowrap self-start xl:self-center">
            <button
              type="button"
              onClick={() => showToast('Módulo de importação em lote acionado.')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm bg-white hover:bg-slate-50 transition shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-base text-slate-500">upload</span>
              <span>Importar</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FDB116] hover:bg-[#e59f10] text-slate-950 font-bold text-sm transition shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-base text-slate-900">download</span>
              <span>Exportar</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white font-bold text-sm transition shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Novo Plano</span>
            </button>
          </div>
        </header>

        {/* 3. KPI SECTION DESKTOP */}
        <section aria-label="Indicadores de Desempenho" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total de Planos */}
          <article className="bg-[#F4FBF7] border border-[#D5EFE3] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-[#0F6537] uppercase">Total de Planos</span>
              <div className="w-10 h-10 rounded-xl bg-white/90 border border-[#CEEBDD] flex items-center justify-center text-[#0F6537] shadow-xs">
                <span className="material-symbols-outlined text-xl">layers</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">{totalPlanos}</span>
              <p className="text-xs font-medium text-emerald-800 flex items-center gap-1.5 mt-2">
                <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                <span>{planosAtivos === totalPlanos ? 'Todos os planos ativos' : `${planosAtivos} de ${totalPlanos} ativos`}</span>
              </p>
            </div>
          </article>

          {/* KPI 2: Planos Ativos */}
          <article className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-blue-800 uppercase">Planos Ativos</span>
              <div className="w-10 h-10 rounded-xl bg-white/90 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <span className="material-symbols-outlined text-xl">check</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">{planosAtivos}</span>
              <p className="text-xs font-medium text-blue-700 flex items-center gap-1.5 mt-2">
                <span className="material-symbols-outlined text-sm text-blue-600">trending_up</span>
                <span>Visíveis para contratação</span>
              </p>
            </div>
          </article>

          {/* KPI 3: Hotéis Assinantes */}
          <article className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-amber-800 uppercase">Hotéis Assinantes</span>
              <div className="w-10 h-10 rounded-xl bg-white/90 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
                <span className="material-symbols-outlined text-xl">bed</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">{totalHoteisAssinantes}</span>
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5 mt-2">
                <span className="material-symbols-outlined text-sm text-amber-600">group</span>
                <span>+{novosHoteisMes} {novosHoteisMes === 1 ? 'assinatura no mês' : 'assinaturas no mês'}</span>
              </p>
            </div>
          </article>

          {/* KPI 4: MRR Recorrente */}
          <article className="bg-[#FAF5FF] border border-[#F3E8FF] rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-purple-800 uppercase">MRR Recorrente</span>
              <div className="w-10 h-10 rounded-xl bg-white/90 border border-purple-200 flex items-center justify-center text-purple-600 shadow-xs">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900">
                R$ {mrrTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <p className="text-xs font-medium text-purple-700 flex items-center gap-1.5 mt-2">
                <span className="material-symbols-outlined text-sm text-purple-600">sync</span>
                <span>Ticket médio R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
              </p>
            </div>
          </article>
        </section>

        {/* 4. FILTER TOOLBAR & VIEW TOGGLE DESKTOP */}
        <section aria-label="Ferramentas e Filtros" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Campo de Busca */}
            <div className="relative flex-1 sm:w-80">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome do plano, periodicidade ou recurso..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-800 placeholder-slate-400 transition"
              />
            </div>

            {/* Periodicidade Dropdown */}
            <select
              value={periodicityFilter}
              onChange={(e) => setPeriodicityFilter(e.target.value)}
              className="py-2 pl-3.5 pr-8 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
            >
              <option value="Todas">Todas Periodicidades</option>
              <option value="Mensal">Mensal</option>
              <option value="Trimestral">Trimestral</option>
              <option value="Anual">Anual</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 pl-3.5 pr-8 text-sm bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>

            {/* Limpar Filtros */}
            {(searchTerm || periodicityFilter !== 'Todas' || statusFilter !== 'Todos') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-slate-400">filter_alt_off</span>
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-end lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base">format_list_bulleted</span>
              <span>Lista</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grade')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                viewMode === 'grade'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base text-emerald-700">grid_view</span>
              <span>Grade</span>
            </button>
          </div>
        </section>

        {/* 5A. MODO LISTA DESKTOP */}
        {viewMode === 'lista' && (
          <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-14" scope="col">Ordem</th>
                    <th className="py-3 px-3 min-w-[200px]" scope="col">Nome do Plano</th>
                    <th className="py-3 px-3" scope="col">Periodicidade</th>
                    <th className="py-3 px-3" scope="col">Valor Base</th>
                    <th className="py-3 px-3" scope="col">Limite de Quartos</th>
                    <th className="py-3 px-3" scope="col">Conexões WhatsApp</th>
                    <th className="py-3 px-3 text-center" scope="col">Hotéis</th>
                    <th className="py-3 px-3 text-center" scope="col">Status</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)]" scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredPlanos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Nenhum plano encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredPlanos.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-semibold text-xs">
                          {plan.order}
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg shrink-0">
                              {plan.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">{plan.name}</span>
                                {plan.tag && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    plan.tag === 'Mais Vendido' 
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                      : plan.tag === '-20% OFF'
                                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                                      : plan.tag === 'Ilimitado'
                                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {plan.tag}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{plan.description}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            plan.periodicity === 'Anual'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <span className="material-symbols-outlined text-sm text-slate-500">calendar_today</span>
                            <span>{plan.periodicity}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-extrabold text-slate-900">
                            R$ {plan.basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {plan.pricePeriodText}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-800 text-xs">{plan.roomLimitText}</div>
                          <div className="text-[11px] text-slate-500">{plan.roomExtraPriceText}</div>
                        </td>

                        <td className="py-3.5 px-3">
                          {plan.whatsappConnections > 1 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {plan.whatsappConnectionsText}
                            </span>
                          ) : (
                            <div className="font-semibold text-slate-800 text-xs">{plan.whatsappConnectionsText}</div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-0.5">{plan.whatsappExtraPriceText}</div>
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="font-extrabold text-slate-900">{plan.hotelsSubscribersCount}</span>
                            <span className="text-xs text-slate-500">hotéis</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {plan.status === 'Ativo' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Ativo</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>Inativo</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setSelectedPlanForView(plan)}
                              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95"
                              title="Visualizar Plano"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(plan)}
                              className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95"
                              title="Editar Plano"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPlanToDelete(plan)}
                              className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95"
                              title="Excluir Plano"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé da Tabela */}
            <footer className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
              <p className="text-sm text-slate-500 font-medium">
                Exibindo <span className="font-bold text-slate-900">1</span> a{' '}
                <span className="font-bold text-slate-900">{filteredPlanos.length}</span> de{' '}
                <span className="font-bold text-slate-900">{totalPlanos}</span> planos cadastrados
              </p>

              <nav aria-label="Paginação" className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 cursor-not-allowed bg-white"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>

                <button
                  type="button"
                  aria-current="page"
                  className="w-8 h-8 rounded-lg bg-[#003400] text-white font-bold text-xs flex items-center justify-center shadow-xs"
                >
                  1
                </button>

                <button
                  type="button"
                  disabled
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 cursor-not-allowed bg-white"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </nav>
            </footer>
          </section>
        )}

        {/* 5B. MODO GRADE DESKTOP */}
        {viewMode === 'grade' && (
          <section aria-label="Catálogo de Planos" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlanos.map((plan) => {
              const isProfessional = plan.isFeatured || plan.name.includes('Professional');
              const isInactive = plan.status === 'Inativo';

              return (
                <article
                  key={plan.id}
                  className={`bg-white rounded-2xl shadow-xs flex flex-col justify-between hover:shadow-md transition relative overflow-hidden ${
                    isProfessional
                      ? 'border-2 border-emerald-600 shadow-md'
                      : 'border border-slate-200'
                  } ${isInactive ? 'opacity-85' : ''}`}
                >
                  {isProfessional && (
                    <div className="bg-[#003400] text-amber-300 text-[11px] font-extrabold tracking-wider py-1.5 text-center uppercase shadow-xs">
                      ★ MAIS ESCOLHIDO PELOS HOTÉIS
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border ${
                          isInactive 
                            ? 'bg-slate-100 border-slate-200 grayscale' 
                            : isProfessional 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          {plan.emoji}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-lg text-slate-900 leading-snug">{plan.name}</h3>
                          <p className="text-xs text-slate-500">{plan.description}</p>
                        </div>
                      </div>

                      {plan.tag && plan.tag !== 'Mais Vendido' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                          plan.tag === '-20% OFF' 
                            ? 'bg-amber-100 text-amber-900 border-amber-200' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {plan.tag}
                        </span>
                      )}

                      {(!plan.tag || plan.tag === 'Mais Vendido') && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          plan.status === 'Ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {plan.status === 'Ativo' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
                          <span>{plan.status}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-6 pb-6 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-black ${isInactive ? 'text-slate-400' : 'text-slate-900'}`}>
                          R$ {plan.basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-sm font-semibold text-slate-500">{plan.pricePeriodText}</span>
                      </div>
                      <p className={`text-xs mt-1 ${isProfessional ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                        {plan.priceSubtitle || 'Cobrança automatizada'}
                      </p>
                    </div>

                    <ul className="mt-6 space-y-3 text-sm text-slate-600">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2.5">
                          <span className={`material-symbols-outlined text-base shrink-0 ${
                            isInactive ? 'text-slate-400' : 'text-emerald-600'
                          }`}>
                            check
                          </span>
                          <span className="text-xs leading-relaxed text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={`px-6 py-4 border-t border-slate-100 rounded-b-2xl flex items-center justify-between ${
                    isProfessional ? 'bg-emerald-50/50' : 'bg-slate-50'
                  }`}>
                    <span className="text-xs font-bold text-slate-700">
                      {plan.hotelsSubscribersCount} {plan.hotelsSubscribersCount === 1 ? 'hotel ativo' : 'hotéis ativos'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlanForView(plan)}
                        className="w-8 h-8 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                        title="Visualizar Plano"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(plan)}
                        className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                        title="Editar Plano"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPlanToDelete(plan)}
                        className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                        title="Excluir Plano"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* RODAPÉ GERAL DE PAGINAÇÃO NO MODO GRADE DESKTOP */}
        {viewMode === 'grade' && (
          <footer className="bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500 font-medium">
              Exibindo <strong className="text-slate-900">{filteredPlanos.length}</strong> cards de planos de assinatura
            </p>
            <nav aria-label="Paginação" className="inline-flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="p-2 rounded-xl border border-slate-200 text-slate-300 cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button
                type="button"
                className="w-9 h-9 flex items-center justify-center text-sm font-bold rounded-xl bg-[#003400] text-white shadow-xs"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="p-2 rounded-xl border border-slate-200 text-slate-300 cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </nav>
          </footer>
        )}

      </div>


      {/* ─────────────────────────────────────────────────────────────
          MODAIS COMPARTILHADOS (MOBILE & DESKTOP)
      ───────────────────────────────────────────────────────────── */}

      {/* MODAL: REGRAS GERAIS SAAS */}
      {isRegrasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">rule</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Regras Gerais do SaaS</h3>
                  <p className="text-[11px] text-slate-500">Diretrizes de precificação e capacidades</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegrasModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-600">bed</span>
                  Quartos Excedentes
                </h4>
                <p className="leading-relaxed">
                  Quartos cadastrados que ultrapassarem o limite base do plano são cobrados automaticamente a R$ 3,50/mês por quarto extra.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
                <h4 className="font-bold text-blue-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-blue-600">chat</span>
                  Instâncias Extras de WhatsApp
                </h4>
                <p className="leading-relaxed">
                  Cada conexão adicional oficial integrada para atendimento simultâneo possui o custo de R$ 49,90/mês.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
                <h4 className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-amber-600">savings</span>
                  Desconto no Pagamento Anual
                </h4>
                <p className="leading-relaxed">
                  Planos contratados no ciclo anual possuem 20% de desconto imediato (equivalente a 2 meses gratuitos de assinatura).
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRegrasModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#003400] hover:bg-[#002600] text-white font-bold text-xs transition shadow-xs cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISUALIZAR DETALHES DO PLANO */}
      {selectedPlanForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl">
                  {selectedPlanForView.emoji}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-900">{selectedPlanForView.name}</h3>
                  <p className="text-xs text-slate-500">{selectedPlanForView.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForView(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Valor da Assinatura</span>
                <div className="text-2xl font-black text-slate-900">
                  R$ {selectedPlanForView.basePrice.toFixed(2)}
                  <span className="text-xs font-normal text-slate-500"> {selectedPlanForView.pricePeriodText}</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                {selectedPlanForView.status}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recursos e Limitações</h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {selectedPlanForView.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPlanForView(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR OU EDITAR PLANO */}
      {(isModalCreateOpen || planToEdit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">
                    {planToEdit ? 'edit' : 'add'}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {planToEdit ? 'Editar Plano de Assinatura' : 'Novo Plano de Assinatura'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina os limites de quartos, instâncias de WhatsApp e periodicidade.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalCreateOpen(false);
                  setPlanToEdit(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Plano Gold Premium"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Badge / Tag Opcional</label>
                  <input
                    type="text"
                    value={formData.tag || ''}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    placeholder="Ex: Mais Vendido, -20% OFF"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição Comercial</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Para redes hoteleiras e resorts de grande porte"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Periodicidade</label>
                  <select
                    value={formData.periodicity || 'Mensal'}
                    onChange={(e) => setFormData({ ...formData, periodicity: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="Mensal">Mensal</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Preço Base (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.basePrice || 0}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status || 'Ativo'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Limite Base de Quartos</label>
                  <input
                    type="number"
                    value={formData.roomLimit || 15}
                    onChange={(e) => setFormData({ ...formData, roomLimit: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Conexões WhatsApp Inclusas</label>
                  <input
                    type="number"
                    value={formData.whatsappConnections || 1}
                    onChange={(e) => setFormData({ ...formData, whatsappConnections: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalCreateOpen(false);
                    setPlanToEdit(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-[#003400] hover:bg-[#002600] rounded-xl shadow-xs transition cursor-pointer"
                >
                  {planToEdit ? 'Salvar Alterações' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">delete</span>
            </div>
            <h3 className="font-bold text-lg text-slate-900">Excluir este plano?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Você tem certeza que deseja remover o plano <strong className="text-slate-800">{planToDelete.name}</strong>?
              Essa ação afetará a exibição no catálogo de assinaturas.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListagemPlanos;
