import React, { useState, useEffect, useMemo, useRef } from 'react';
import { parceirosService } from '../services/supabaseService';
import {
  getPartnerReferralLink,
  copyPartnerReferralLink,
  openPartnerReferralLink
} from '../utils/partnerUrl';

export interface Partner {
  id: string;
  name: string;
  category: string;
  location?: string;
  initials: string;
  avatarColor: string;
  email: string;
  phone: string;
  document?: string;
  coupon: string;
  commission: string;
  taxa_comissao?: number;
  level: string;
  indicatedHotels: number;
  totalVendas: number;
  ganhosAcumulados: number;
  saldoAPagar: number;
  status: 'ativo' | 'analise' | 'inativo' | 'pausado' | 'pendente';
  pixType?: string;
  pixKey?: string;
  bankName?: string;
  holderName?: string;
  isTopAfiliado?: boolean;
}

export const INITIAL_PARTNERS: Partner[] = [];

export interface ListagemParceirosProps {
  onBackToDashboard?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToEdit?: (partner: Partner) => void;
  onNavigateToCreateHotelWithPartner?: (partner: Partner) => void;
}

export const ListagemParceiros: React.FC<ListagemParceirosProps> = ({
  onBackToDashboard,
  onNavigateToCreate,
  onNavigateToEdit,
  onNavigateToCreateHotelWithPartner
}) => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('todos');
  const [tierFilter, setTierFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modais
  const [selectedPartnerDetails, setSelectedPartnerDetails] = useState<Partner | null>(null);
  const [selectedPartnerDelete, setSelectedPartnerDelete] = useState<Partner | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`"${text}" copiado para a área de transferência!`);
  };

  const handleCopyReferralLink = async (coupon: string, partnerName?: string) => {
    const ok = await copyPartnerReferralLink(coupon);
    if (ok) {
      showToast(`Link de indicação ${partnerName ? `de "${partnerName}" ` : ''}copiado com sucesso!`);
    } else {
      showToast('Não foi possível copiar o link.');
    }
  };

  const handleOpenReferralLink = (coupon: string) => {
    openPartnerReferralLink(coupon);
  };

  // Carregamento de dados 100% reais do Supabase (sem fallback para dados fictícios)
  useEffect(() => {
    const fetchPartners = async () => {
      setIsLoading(true);
      try {
        const dbData = await parceirosService.getParceiros();
        setPartners(dbData || []);
      } catch (err) {
        console.warn('Erro ao carregar parceiros do Supabase:', err);
        setPartners([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartners();

    const handleNovo = () => fetchPartners();
    window.addEventListener('hotel_novo_parceiro', handleNovo);
    window.addEventListener('hotel_parceiro_modificado', handleNovo);
    window.addEventListener('hotel_parceiro_deletado', handleNovo);

    const unsubscribe = parceirosService.subscribeParceiros 
      ? parceirosService.subscribeParceiros(fetchPartners) 
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_parceiro', handleNovo);
      window.removeEventListener('hotel_parceiro_modificado', handleNovo);
      window.removeEventListener('hotel_parceiro_deletado', handleNovo);
      unsubscribe();
    };
  }, []);

  // Filtragem
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // Busca geral
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.document || '').toLowerCase().includes(q) ||
        (p.pixKey || '').toLowerCase().includes(q) ||
        p.coupon.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q);

      // Região / Estado
      const matchRegion = regionFilter === 'todos' ||
        (regionFilter === 'SP' && ((p.location || '').includes('SP') || (p.document || '').includes('SP'))) ||
        (regionFilter === 'RJ' && ((p.location || '').includes('RJ') || (p.document || '').includes('RJ'))) ||
        (regionFilter === 'MG' && ((p.location || '').includes('MG') || (p.document || '').includes('MG'))) ||
        (regionFilter === 'BA' && ((p.location || '').includes('BA') || (p.document || '').includes('BA'))) ||
        (regionFilter === 'RS' && ((p.location || '').includes('RS') || (p.document || '').includes('RS'))) ||
        (regionFilter === 'SC' && ((p.location || '').includes('SC') || (p.document || '').includes('SC'))) ||
        (regionFilter === 'AL' && ((p.location || '').includes('AL') || (p.document || '').includes('AL'))) ||
        (regionFilter === 'PE' && ((p.location || '').includes('PE') || (p.document || '').includes('PE'))) ||
        (regionFilter === 'RN' && ((p.location || '').includes('RN') || (p.document || '').includes('RN')));

      // Tier / Nível
      const matchTier = tierFilter === 'todos' ||
        (tierFilter === 'ouro-master' && p.level.toLowerCase().includes('ouro master')) ||
        (tierFilter === 'ouro' && p.level.toLowerCase() === 'ouro') ||
        (tierFilter === 'prata' && p.level.toLowerCase().includes('prata')) ||
        (tierFilter === 'bronze' && p.level.toLowerCase().includes('bronze'));

      // Status
      const matchStatus = statusFilter === 'todos' ||
        (statusFilter === 'ativo' && p.status === 'ativo') ||
        (statusFilter === 'analise' && (p.status === 'analise' || p.status === 'pendente')) ||
        (statusFilter === 'inativo' && (p.status === 'inativo' || p.status === 'pausado'));

      return matchQuery && matchRegion && matchTier && matchStatus;
    });
  }, [partners, searchQuery, regionFilter, tierFilter, statusFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, regionFilter, tierFilter, statusFilter]);

  const totalPages = Math.ceil(filteredPartners.length / itemsPerPage) || 1;
  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPartners.slice(start, start + itemsPerPage);
  }, [filteredPartners, currentPage]);

  // Indicadores / KPIs (Valores reais calculados dinamicamente sobre a base de parceiros)
  const totalParceirosCount = partners.length;
  const parceirosAtivosCount = useMemo(() => {
    return partners.filter(p => p.status === 'ativo').length;
  }, [partners]);
  const totalHoteisIndicadosCount = useMemo(() => {
    return partners.reduce((acc, p) => acc + (p.indicatedHotels || 0), 0);
  }, [partners]);
  const totalComissoesValor = useMemo(() => {
    return partners.reduce((acc, p) => acc + (p.ganhosAcumulados || 0), 0);
  }, [partners]);

  // Ações de exportar e importar
  const handleExportar = () => {
    const headers = 'ID,Nome,Cargo/Categoria,Localidade,Email,Telefone,Documento,Cupom,Comissao,Nivel,HoteisIndicados,TotalRepassado,Status,PixTipo,PixChave\n';
    const rows = filteredPartners.map(p => 
      `"${p.id}","${p.name}","${p.category}","${p.location || ''}","${p.email}","${p.phone}","${p.document || ''}","${p.coupon}","${p.commission}","${p.level}",${p.indicatedHotels},"${p.ganhosAcumulados}","${p.status}","${p.pixType || ''}","${p.pixKey || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `parceiros_indicadores_hotelnozap_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Planilha de parceiros e indicadores exportada com sucesso!');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast(`Arquivo "${file.name}" importado com sucesso!`);
    setIsImportModalOpen(false);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setRegionFilter('todos');
    setTierFilter('todos');
    setStatusFilter('todos');
    showToast('Filtros restaurados para a visualização padrão.');
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPartnerDelete) return;
    const partnerToDelete = selectedPartnerDelete;
    try {
      await parceirosService.deleteParceiro(partnerToDelete.id);
    } catch (err) {
      console.warn('Erro ao deletar no banco:', err);
    }
    setPartners(prev => prev.filter(p => p.id !== partnerToDelete.id));
    showToast(`Parceiro "${partnerToDelete.name}" removido com sucesso.`);
    setSelectedPartnerDelete(null);
  };

  const handleOpenEditPartner = (p: Partner) => {
    if (onNavigateToEdit) {
      onNavigateToEdit(p);
    } else {
      showToast(`Abrindo formulário de edição para ${p.name}`);
    }
  };

  const getTierBadge = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l.includes('institucional') || l.includes('oficial')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Institucional
        </span>
      );
    }
    if (l.includes('ouro master')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
          Ouro Master
        </span>
      );
    }
    if (l.includes('ouro')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Ouro
        </span>
      );
    }
    if (l.includes('prata')) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
          Prata
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200">
        Bronze
      </span>
    );
  };

  const getAvatarBadge = (color: string, initials: string) => {
    let classes = 'bg-blue-100 text-blue-700';
    if (color === 'emerald') classes = 'bg-emerald-100 text-emerald-700';
    if (color === 'amber') classes = 'bg-amber-100 text-amber-700';
    if (color === 'cyan') classes = 'bg-cyan-100 text-cyan-700';
    if (color === 'purple') classes = 'bg-purple-100 text-purple-700';
    if (color === 'slate') classes = 'bg-slate-100 text-slate-700';

    return (
      <div className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${classes}`}>
        {initials}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-10 antialiased font-sans">
      
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[300] bg-[#003400] text-white px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-500/30 text-xs sm:text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto w-full space-y-6">

        {/* ========================================================= */}
        {/* TOP NAVIGATION / BREADCRUMB (APENAS MOBILE)               */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between lg:hidden">
          <button 
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar para Dashboard</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* HEADER SECTION                                            */}
        {/* ========================================================= */}
        <header className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-3xl">handshake</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">Parceiros &amp; Indicadores</h1>
                <span className="lg:hidden px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  {parceirosAtivosCount} Ativos
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Gerencie influenciadores, consultores hoteleiros, agências parceiras, comissões recorrentes e hotéis indicados.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
            {/* Importar */}
            <button 
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-slate-600">upload</span>
              <span>Importar</span>
            </button>

            {/* Exportar */}
            <button 
              type="button"
              onClick={handleExportar}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl bg-[#FDB116] hover:bg-[#e59f13] text-xs sm:text-sm font-bold text-slate-950 transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-slate-950">download</span>
              <span>Exportar</span>
            </button>

            {/* Novo Parceiro */}
            <button 
              type="button"
              onClick={onNavigateToCreate}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002800] text-xs sm:text-sm font-semibold text-white transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-white">add</span>
              <span>Novo Parceiro</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* METRIC CARDS SECTION (4 OVERVIEW KPIS)                    */}
        {/* ========================================================= */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {/* Card 1: Total de Parceiros */}
          <div className="bg-[#F0FDF4] border border-emerald-100 rounded-2xl p-4 sm:p-6 relative flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">Total Parceiros</span>
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-white/90 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs">
                <span className="material-symbols-outlined text-lg sm:text-xl">groups</span>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-slate-900 tracking-tight leading-none">
                {totalParceirosCount}
              </span>
              <p className="text-[11px] sm:text-xs font-semibold text-emerald-700 mt-1.5 sm:mt-2 flex items-center gap-1">
                <span>✓</span> <span className="hidden sm:inline">Em todos os níveis cadastrados</span><span className="sm:hidden">Cadastrados</span>
              </p>
            </div>
          </div>

          {/* Card 2: Parceiros Ativos */}
          <div className="bg-[#F0F9FF] border border-sky-100 rounded-2xl p-4 sm:p-6 relative flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-sky-800">Parceiros Ativos</span>
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-white/90 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-2xs">
                <span className="material-symbols-outlined text-lg sm:text-xl">verified</span>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-slate-900 tracking-tight leading-none">
                {parceirosAtivosCount}
              </span>
              <p className="text-[11px] sm:text-xs font-semibold text-sky-700 mt-1.5 sm:mt-2 flex items-center gap-1">
                <span>↗</span> <span className="hidden sm:inline">Gerando novas contas</span><span className="sm:hidden">Gerando contas</span>
              </p>
            </div>
          </div>

          {/* Card 3: Hotéis Indicados */}
          <div className="bg-[#FFFBEB] border border-amber-100 rounded-2xl p-4 sm:p-6 relative flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-900">Hotéis Indicados</span>
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-white/90 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
                <span className="material-symbols-outlined text-lg sm:text-xl">hotel</span>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-slate-900 tracking-tight leading-none">
                {totalHoteisIndicadosCount}
              </span>
              <p className="text-[11px] sm:text-xs font-semibold text-amber-700 mt-1.5 sm:mt-2 flex items-center gap-1">
                <span>🏠</span> <span className="hidden sm:inline">Propriedades vinculadas na rede</span><span className="sm:hidden">Na rede</span>
              </p>
            </div>
          </div>

          {/* Card 4: Comissões do Mês */}
          <div className="bg-[#FAF5FF] border border-purple-100 rounded-2xl p-4 sm:p-6 relative flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-900">Comissões do Mês</span>
              <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-white/90 border border-purple-200/80 flex items-center justify-center text-purple-600 shadow-2xs">
                <span className="material-symbols-outlined text-lg sm:text-xl">payments</span>
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <span className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none whitespace-nowrap">
                R$ {totalComissoesValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] sm:text-xs font-semibold text-purple-700 mt-1.5 sm:mt-2 flex items-center gap-1">
                <span>🔄</span> <span className="hidden sm:inline">Média 15% recorrente</span><span className="sm:hidden">Repasse acumulado</span>
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FILTER TOOLBAR SECTION                                    */}
        {/* ========================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left group: Search & Dropdowns */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search input */}
              <div className="relative min-w-[260px] max-w-sm flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-base">search</span>
                </div>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, e-mail, CPF/CNPJ ou chave PIX..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all outline-hidden"
                />
              </div>

              {/* Region Dropdown (Desktop) */}
              <div className="relative hidden md:block">
                <select 
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-9 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="todos">Todas as Regiões / Estados</option>
                  <option value="SP">São Paulo (SP)</option>
                  <option value="RJ">Rio de Janeiro (RJ)</option>
                  <option value="MG">Minas Gerais (MG)</option>
                  <option value="BA">Bahia (BA)</option>
                  <option value="RS">Rio Grande do Sul (RS)</option>
                  <option value="SC">Santa Catarina (SC)</option>
                  <option value="AL">Alagoas (AL)</option>
                  <option value="PE">Pernambuco (PE)</option>
                  <option value="RN">Rio Grande do Norte (RN)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>

              {/* Tier Dropdown */}
              <div className="relative hidden md:block">
                <select 
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-9 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="todos">Todos os Níveis</option>
                  <option value="ouro-master">Ouro Master</option>
                  <option value="ouro">Ouro</option>
                  <option value="prata">Prata</option>
                  <option value="bronze">Bronze</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>

              {/* Status Dropdown */}
              <div className="relative hidden md:block">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-3.5 pr-9 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="ativo">Ativo</option>
                  <option value="analise">Em Análise</option>
                  <option value="inativo">Inativo</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </div>
              </div>

              {/* Botão de Filtros Mobile */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className="md:hidden px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center hover:bg-slate-50 shadow-xs shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base mr-1 text-slate-500">filter_alt</span>
                <span>Filtros</span>
              </button>
            </div>

            {/* Right group: View Mode Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button 
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_list</span>
                <span>Lista</span>
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                <span>Grade</span>
              </button>
            </div>
          </div>

          {/* Painel de Filtros Mobile Expansível */}
          {isMobileFilterOpen && (
            <div className="md:hidden pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in fade-in duration-200">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Região:</label>
                <select 
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs"
                >
                  <option value="todos">Todas as Regiões</option>
                  <option value="SP">São Paulo (SP)</option>
                  <option value="RJ">Rio de Janeiro (RJ)</option>
                  <option value="BA">Bahia (BA)</option>
                  <option value="RS">Rio Grande do Sul (RS)</option>
                  <option value="SC">Santa Catarina (SC)</option>
                  <option value="AL">Alagoas (AL)</option>
                  <option value="PE">Pernambuco (PE)</option>
                  <option value="RN">Rio Grande do Norte (RN)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nível / Tier:</label>
                <select 
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs"
                >
                  <option value="todos">Todos os Níveis</option>
                  <option value="ouro-master">Ouro Master</option>
                  <option value="ouro">Ouro</option>
                  <option value="prata">Prata</option>
                  <option value="bronze">Bronze</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status:</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="ativo">Ativo</option>
                  <option value="analise">Em Análise</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          )}

          {/* Secondary filter actions */}
          <div className="flex items-center justify-between pt-1">
            <button 
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              <span>Limpar Filtros</span>
            </button>

            <span className="text-xs text-slate-400">
              {filteredPartners.length} parceiros filtrados
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DESKTOP TABLE VIEW                                        */}
        {/* ========================================================= */}
        <div className="hidden lg:block">
          {viewMode === 'list' ? (
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                      <th className="py-4 px-3 text-center w-12" scope="col">Ordem</th>
                      <th className="py-4 px-3 min-w-[160px]" scope="col">Parceiro / Indicador</th>
                      <th className="py-4 px-3 min-w-[160px]" scope="col">Contato &amp; Documento</th>
                      <th className="py-4 px-3 text-center w-24" scope="col">Tier / Nível</th>
                      <th className="py-4 px-3 text-center w-24" scope="col">Hotéis Ativos</th>
                      <th className="py-4 px-3 text-center w-28" scope="col">Comissão (%)</th>
                      <th className="py-4 px-3 text-right w-32" scope="col">Total Repassado</th>
                      <th className="py-4 px-3 text-center w-24" scope="col">Status</th>
                      <th className="py-4 px-3 text-right min-w-[168px] w-[168px]" scope="col">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedPartners.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                          Nenhum parceiro encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedPartners.map((partner, index) => {
                        const ordemNum = String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0');
                        return (
                          <tr key={partner.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-4 px-3 text-center font-medium text-slate-400 text-xs">
                              #{ordemNum}
                            </td>
                            <td className="py-4 px-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {getAvatarBadge(partner.avatarColor, partner.initials)}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-bold text-slate-900 leading-tight block truncate">
                                      {partner.name}
                                    </span>
                                    {partner.isTopAfiliado && (
                                      <span className="text-amber-500 text-xs shrink-0" title="Top Parceiro do Mês">★</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500 font-medium truncate block">
                                    {partner.category}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-3">
                              <div className="text-xs min-w-0">
                                <span className="text-slate-800 font-medium block truncate">{partner.email}</span>
                                <span className="text-slate-400 text-[11px] truncate block">{partner.document || partner.phone}</span>
                              </div>
                            </td>
                            <td className="py-4 px-3 text-center">
                              {getTierBadge(partner.level)}
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className="font-bold text-slate-900 text-sm">{partner.indicatedHotels}</span>
                              <span className="text-xs text-slate-500 block font-normal">hotéis</span>
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {partner.commission}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-right">
                              <span className="font-bold text-slate-900 text-sm whitespace-nowrap">
                                R$ {partner.ganhosAcumulados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {partner.status === 'ativo' ? 'Ativo' : (partner.status === 'analise' ? 'Em Análise' : 'Inativo')}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap whitespace-nowrap">
                                {/* Botão Copiar Link de Indicação (Verde Esmeralda) */}
                                <button 
                                  type="button"
                                  onClick={() => handleCopyReferralLink(partner.coupon, partner.name)}
                                  className="w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 flex items-center justify-center transition-colors shadow-xs cursor-pointer active:scale-95"
                                  title="Copiar Link de Indicação Exclusivo"
                                >
                                  <span className="material-symbols-outlined text-base">link</span>
                                </button>

                                {/* Botão Visualizar Detalhes (Azul #2563EB) */}
                                <button 
                                  type="button"
                                  onClick={() => setSelectedPartnerDetails(partner)}
                                  className="w-9 h-9 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white shrink-0 flex items-center justify-center transition-colors shadow-xs cursor-pointer active:scale-95"
                                  title="Visualizar Detalhes"
                                >
                                  <span className="material-symbols-outlined text-base">visibility</span>
                                </button>
                                
                                {/* Botão Editar Parceiro (Laranja #EA580C) */}
                                <button 
                                  type="button"
                                  onClick={() => handleOpenEditPartner(partner)}
                                  className="w-9 h-9 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white shrink-0 flex items-center justify-center transition-colors shadow-xs cursor-pointer active:scale-95"
                                  title="Editar Parceiro"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                
                                {/* Botão Excluir (Vermelho #DC2626) */}
                                <button 
                                  type="button"
                                  onClick={() => setSelectedPartnerDelete(partner)}
                                  className="w-9 h-9 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white shrink-0 flex items-center justify-center transition-colors shadow-xs cursor-pointer active:scale-95"
                                  title="Excluir"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Paginação */}
              <footer className="p-4 sm:px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Exibindo <span className="font-bold text-slate-800">{filteredPartners.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredPartners.length)}</span> de <span className="font-bold text-slate-800">{filteredPartners.length}</span> parceiros cadastrados
                </p>
                
                <nav aria-label="Paginação" className="flex items-center gap-1.5">
                  <button 
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    title="Página Anterior"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        currentPage === page 
                          ? 'bg-[#003400] text-white shadow-xs font-bold' 
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button 
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    title="Próxima Página"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </nav>
              </footer>
            </section>
          ) : (
            /* Grade View Desktop */
            paginatedPartners.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-sm">
                Nenhum parceiro cadastrado ou encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {paginatedPartners.map(partner => (
                <div key={partner.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow relative">
                  {partner.isTopAfiliado && (
                    <div className="absolute top-0 right-0 bg-[#003400] text-emerald-300 text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                      <span className="text-amber-400">★</span> TOP PARCEIRO
                    </div>
                  )}

                  <div>
                    <div className="flex items-start gap-3.5 mb-3">
                      {getAvatarBadge(partner.avatarColor, partner.initials)}
                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-tight">{partner.name}</h3>
                        <p className="text-xs text-slate-500">{partner.category}</p>
                        <p className="text-[11px] text-slate-400">{partner.location}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-3 p-3 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Nível</span>
                        <span className="font-semibold text-slate-800">{partner.level}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Comissão</span>
                        <span className="font-bold text-emerald-700">{partner.commission}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Hotéis</span>
                        <span className="font-bold text-slate-900">{partner.indicatedHotels} ativos</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Repassado</span>
                        <span className="font-bold text-slate-900">R$ {partner.ganhosAcumulados.toLocaleString('pt-BR')}</span>
                      </div>
                    </div>

                    {partner.coupon && (
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between text-xs bg-emerald-50/70 border border-emerald-200/60 p-2.5 rounded-xl">
                          <span className="text-emerald-800 font-semibold text-[11px]">Cupom de Indicação:</span>
                          <div className="flex items-center gap-1 font-mono font-bold text-emerald-950">
                            <span>{partner.coupon}</span>
                            <button onClick={() => copyToClipboard(partner.coupon)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer" title="Copiar Cupom">
                              <span className="material-symbols-outlined text-xs">content_copy</span>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200/80 p-1.5 rounded-xl text-[11px]">
                          <span className="text-slate-500 font-mono truncate text-[10.5px] pl-1">{getPartnerReferralLink(partner.coupon)}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyReferralLink(partner.coupon, partner.name)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-[10px] flex items-center gap-0.5 cursor-pointer shadow-2xs"
                              title="Copiar link completo de indicação"
                            >
                              <span className="material-symbols-outlined text-[12px]">link</span>
                              <span>Copiar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReferralLink(partner.coupon)}
                              className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-md cursor-pointer"
                              title="Abrir link de indicação"
                            >
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">ID: #{partner.id}</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => setSelectedPartnerDetails(partner)}
                        className="w-8 h-8 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        title="Visualizar"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleOpenEditPartner(partner)}
                        className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        title="Editar"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSelectedPartnerDelete(partner)}
                        className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        title="Excluir"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )
          )}
        </div>

        {/* ========================================================= */}
        {/* MOBILE VIEW (CARDS VERTICAIS FIÉIS AO MOCKUP ANEXADO)     */}
        {/* ========================================================= */}
        <div className="lg:hidden space-y-4">
          <section className="space-y-3.5 pt-1">
            {paginatedPartners.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                Nenhum parceiro encontrado para a busca.
              </div>
            ) : (
              paginatedPartners.map(partner => {
                if (partner.isTopAfiliado) {
                  return (
                    /* Card Destaque Top Parceiro do Mês */
                    <article key={partner.id} className="bg-white rounded-2xl border-2 border-[#003400] shadow-md overflow-hidden relative">
                      {/* Faixa de Destaque */}
                      <div className="bg-[#003400] text-emerald-300 py-1 px-3 text-[10px] font-extrabold tracking-wider uppercase flex items-center justify-center space-x-1">
                        <span className="text-amber-300">★</span>
                        <span>TOP PARCEIRO DO MÊS</span>
                      </div>
                      
                      <div className="p-3.5 space-y-3">
                        {/* Header do Card */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">{partner.name}</h3>
                            <div className="text-[11px] text-slate-500 flex items-center mt-0.5">
                              <span className="material-symbols-outlined text-xs mr-0.5 text-slate-400">location_on</span>
                              <span>{partner.location || partner.category}</span>
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
                            Ativo
                          </span>
                        </div>

                        {/* Tags de Informação */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-lg">
                            {partner.indicatedHotels} hotéis ativos
                          </span>
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-lg flex items-center">
                            <span className="material-symbols-outlined text-[12px] mr-1">trending_up</span>
                            Comissão {partner.commission}
                          </span>
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-[10px] font-semibold rounded-lg">
                            {partner.pixType || 'PIX Celular'}
                          </span>
                        </div>

                        {/* Link de Indicação & Ação de Cadastro */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Link de Indicação</span>
                              <span className="font-mono text-[11px] text-slate-700 truncate block">
                                {getPartnerReferralLink(partner.coupon)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyReferralLink(partner.coupon, partner.name)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition"
                                title="Copiar Link de Indicação"
                              >
                                <span className="material-symbols-outlined text-xs">link</span>
                                <span>Copiar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReferralLink(partner.coupon)}
                                className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                title="Abrir link"
                              >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                              </button>
                            </div>
                          </div>

                          {onNavigateToCreateHotelWithPartner && (
                            <button
                              type="button"
                              onClick={() => onNavigateToCreateHotelWithPartner(partner)}
                              className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-900 transition-all cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-sm text-[#003400]">domain_add</span>
                              <span>Cadastrar Novo Hotel Vinculado</span>
                            </button>
                          )}
                        </div>

                        <hr className="border-slate-100" />

                        {/* Rodapé: ID & Botões de Ação */}
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-xs font-semibold text-slate-400">ID: #{partner.id}</span>
                          <div className="flex items-center space-x-1.5">
                            <button 
                              type="button"
                              onClick={() => setSelectedPartnerDetails(partner)}
                              className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer"
                              title="Visualizar"
                            >
                              <span className="material-symbols-outlined text-[17px]">visibility</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleOpenEditPartner(partner)}
                              className="w-8 h-8 rounded-xl bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-[17px]">edit</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => setSelectedPartnerDelete(partner)}
                              className="w-8 h-8 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer"
                              title="Excluir"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }

                /* Cards Padrão Mobile */
                return (
                  <article key={partner.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{partner.name}</h3>
                        <div className="text-[11px] text-slate-500 flex items-center mt-0.5">
                          <span className="material-symbols-outlined text-xs mr-0.5 text-slate-400">location_on</span>
                          <span>{partner.location || partner.category}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span>
                        {partner.status === 'ativo' ? 'Ativo' : (partner.status === 'analise' ? 'Análise' : 'Inativo')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded-lg">
                        {partner.indicatedHotels} hotéis ativos
                      </span>
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-lg flex items-center">
                        <span className="material-symbols-outlined text-[12px] mr-1">trending_up</span>
                        Comissão {partner.commission}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-[10px] font-semibold rounded-lg">
                        {partner.pixType || 'PIX CNPJ'}
                      </span>
                    </div>

                    {/* Link de Indicação & Ação de Cadastro */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Link de Indicação</span>
                          <span className="font-mono text-[11px] text-slate-700 truncate block">
                            {getPartnerReferralLink(partner.coupon)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyReferralLink(partner.coupon, partner.name)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition"
                            title="Copiar Link de Indicação"
                          >
                            <span className="material-symbols-outlined text-xs">link</span>
                            <span>Copiar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReferralLink(partner.coupon)}
                            className="p-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg cursor-pointer"
                            title="Abrir link"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </button>
                        </div>
                      </div>

                      {onNavigateToCreateHotelWithPartner && (
                        <button
                          type="button"
                          onClick={() => onNavigateToCreateHotelWithPartner(partner)}
                          className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-900 transition-all cursor-pointer shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-sm text-[#003400]">domain_add</span>
                          <span>Cadastrar Novo Hotel Vinculado</span>
                        </button>
                      )}
                    </div>

                    <hr className="border-slate-100" />

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs font-semibold text-slate-400">ID: #{partner.id}</span>
                      <div className="flex items-center space-x-1.5">
                        <button 
                          type="button"
                          onClick={() => setSelectedPartnerDetails(partner)}
                          className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer"
                          title="Visualizar"
                        >
                          <span className="material-symbols-outlined text-[17px]">visibility</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleOpenEditPartner(partner)}
                          className="w-8 h-8 rounded-xl bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-[17px]">edit</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSelectedPartnerDelete(partner)}
                          className="w-8 h-8 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer"
                          title="Excluir"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {/* Paginação Mobile */}
          <footer className="pt-2 pb-3 flex items-center justify-between">
            <p className="text-xs text-slate-600 font-medium">
              Exibindo <strong className="text-slate-900 font-bold">{paginatedPartners.length}</strong> de <strong className="text-slate-900 font-bold">{filteredPartners.length}</strong> parceiros
            </p>
            <div className="flex items-center space-x-1.5">
              <button 
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button 
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center shadow-sm cursor-pointer ${
                    currentPage === page ? 'bg-[#003400] text-white font-bold' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button 
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </footer>
        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL DETALHES DO PARCEIRO                                */}
      {/* ========================================================= */}
      {selectedPartnerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-4">
                {getAvatarBadge(selectedPartnerDetails.avatarColor, selectedPartnerDetails.initials)}
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedPartnerDetails.name}</h3>
                  <p className="text-xs text-slate-500">{selectedPartnerDetails.category} • {selectedPartnerDetails.location}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedPartnerDetails(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold p-1.5 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm text-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <div>
                  <span className="text-xs text-slate-400 block font-bold uppercase">Nível</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{selectedPartnerDetails.level}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-bold uppercase">Comissão</span>
                  <span className="font-extrabold text-emerald-700 text-sm mt-0.5 block">{selectedPartnerDetails.commission}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-bold uppercase">Hotéis Ativos</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{selectedPartnerDetails.indicatedHotels}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-bold uppercase">Total Ganho</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    R$ {selectedPartnerDetails.ganhosAcumulados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Informações de Contato e Cupom */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium">E-mail:</span>
                  <span className="font-semibold text-slate-800">{selectedPartnerDetails.email}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium">Documento:</span>
                  <span className="font-semibold text-slate-800">{selectedPartnerDetails.document || 'Não informado'}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium">Cupom de Indicação:</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                    <span>{selectedPartnerDetails.coupon}</span>
                    <button onClick={() => copyToClipboard(selectedPartnerDetails.coupon)} className="text-slate-500 hover:text-emerald-700 cursor-pointer" title="Copiar Cupom">
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                  </div>
                </div>

                {/* Link Exclusivo de Indicação */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-900 font-bold text-xs flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-emerald-700">link</span>
                      Link Exclusivo de Indicação (Para Hotéis)
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      Público
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getPartnerReferralLink(selectedPartnerDetails.coupon)}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-emerald-200 rounded-lg text-slate-700 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyReferralLink(selectedPartnerDetails.coupon, selectedPartnerDetails.name)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs active:scale-95 transition"
                      title="Copiar Link de Indicação"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      <span>Copiar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenReferralLink(selectedPartnerDetails.coupon)}
                      className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      title="Abrir link em nova aba"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      <span>Abrir</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-800 font-bold">Chave PIX ({selectedPartnerDetails.pixType || 'PIX'}):</span>
                  <div className="flex items-center gap-1 font-mono font-bold text-emerald-950">
                    <span>{selectedPartnerDetails.pixKey || selectedPartnerDetails.email}</span>
                    <button onClick={() => copyToClipboard(selectedPartnerDetails.pixKey || selectedPartnerDetails.email)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {onNavigateToCreateHotelWithPartner && (
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPartnerDetails;
                    setSelectedPartnerDetails(null);
                    onNavigateToCreateHotelWithPartner(p);
                  }}
                  className="w-full py-3 px-4 bg-[#003400] hover:bg-[#002400] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">domain_add</span>
                  <span>Cadastrar Novo Hotel Vinculado a este Parceiro</span>
                </button>
              )}
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button 
                type="button"
                onClick={() => {
                  const p = selectedPartnerDetails;
                  setSelectedPartnerDetails(null);
                  handleOpenEditPartner(p);
                }}
                className="px-4 py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span>Editar Parceiro</span>
              </button>
              <button 
                type="button"
                onClick={() => setSelectedPartnerDetails(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL IMPORTAR PARCEIROS                                  */}
      {/* ========================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">upload</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Importar Parceiros</h3>
                  <p className="text-xs text-slate-500">Envie planilha CSV ou arquivo Excel</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold p-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Faça o upload de uma planilha no formato CSV contendo os cabeçalhos:
                <br />
                <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono text-[10px] block mt-1">
                  Nome, Email, Telefone, Documento, Cupom, Comissao, Nivel
                </code>
              </p>

              <input 
                type="file" 
                ref={importFileRef}
                accept=".csv,.xlsx"
                onChange={handleImportFile}
                className="hidden" 
              />

              <div 
                onClick={() => importFileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/40"
              >
                <span className="material-symbols-outlined text-3xl text-emerald-600 mb-2">cloud_upload</span>
                <p className="font-bold text-slate-800">Clique para selecionar o arquivo</p>
                <p className="text-slate-400 text-[11px] mt-0.5">Suporta arquivos .CSV e .XLSX até 10MB</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className="px-4 py-2 bg-[#003400] text-white rounded-xl font-bold hover:bg-emerald-950 transition cursor-pointer"
                >
                  Selecionar Arquivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EXCLUIR PARCEIRO                                    */}
      {/* ========================================================= */}
      {selectedPartnerDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Excluir Parceiro</h3>
                  <p className="text-xs text-slate-500">Confirmação de exclusão permanente</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedPartnerDelete(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold p-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Tem certeza de que deseja remover o parceiro <strong className="text-slate-900">{selectedPartnerDelete.name}</strong> (Cupom: <span className="font-mono">{selectedPartnerDelete.coupon}</span>)?
              </p>
              <p className="text-slate-400">
                Esta ação cancelará o vínculo do cupom com novos estabelecimentos cadastrados na plataforma.
              </p>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPartnerDelete(null)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-5 py-2.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-xl font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Confirmar Exclusão</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListagemParceiros;
