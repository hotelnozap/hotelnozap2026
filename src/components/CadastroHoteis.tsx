import React, { useState, useEffect, useMemo, useRef } from 'react';
import { hoteisService, quartosService, planosService } from '../services/supabaseService';
import { ModalImportarGoogleMaps } from './ModalImportarGoogleMaps';
import { ModalConfirmacaoExclusao } from './ModalConfirmacaoExclusao';

export interface Hotel {
  id: string;
  name: string;
  category: string; // e.g. Resort 5 estrelas, Pousada Boutique...
  cnpj: string;
  cityUf: string; // e.g. Ipojuca / PE, Gramado, RS
  city?: string;
  uf?: string;
  neighborhood?: string;
  plan: 'Enterprise' | 'Professional' | 'Starter' | 'Pousada VIP' | 'Free (Limitado)' | string;
  capacity: number;
  capacityUnit?: string;
  whatsappInstances: number;
  managerName: string;
  managerPhone?: string;
  status: 'ativo' | 'implantacao' | 'bloqueado' | 'inativo' | 'prospecto' | string;
  imageUrl?: string;
  razaoSocial?: string;
  cep?: string;
  street?: string;
  streetNumber?: string;
  managerEmail?: string;
  managerCpf?: string;
  managerRole?: string;
  loginEmail?: string;
  instanceName?: string;
  apiUrl?: string;
  apiKey?: string;
  notes?: string;
  link?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  createdAt?: string;
  isDestaque?: boolean;
  avatarColor?: string;
  initials?: string;
  isImportedFromGoogle?: boolean;
  agenteIa?: string;
}

export const INITIAL_HOTEIS: Hotel[] = [
  {
    id: 'HOT-001',
    name: 'Hotel Master Porto de Galinhas',
    razaoSocial: 'Bosque Hotelaria e Lazer Ltda',
    category: 'Resort & Spa',
    cnpj: '14.821.902/0001-44',
    cityUf: 'Ipojuca - PE',
    city: 'Ipojuca',
    uf: 'PE',
    capacity: 48,
    whatsappInstances: 2,
    plan: 'Plano Pousada VIP',
    managerName: 'Carlos Mendes',
    status: 'ativo',
    initials: 'HM',
    avatarColor: 'blue',
    instagram: '@hotelmaster',
    facebook: 'hotelmasterporto',
    tiktok: '@hotelmaster',
    whatsapp: '5581998765432'
  },
  {
    id: 'HOT-002',
    name: 'Pousada Recanto dos Corais',
    razaoSocial: 'Vila Aguas Hospedagens Eireli',
    category: 'Pousada Beira-Mar',
    cnpj: '23.419.001/0001-92',
    cityUf: 'Maragogi - AL',
    city: 'Maragogi',
    uf: 'AL',
    capacity: 24,
    whatsappInstances: 1,
    plan: 'Plano Starter',
    managerName: 'Marina Peixoto',
    status: 'ativo',
    isDestaque: true,
    initials: 'RC',
    avatarColor: 'amber'
  },
  {
    id: 'HOT-003',
    name: 'Hotel Solar das Dunas',
    razaoSocial: 'Pedras Resorts do Brasil S.A.',
    category: 'Hotel Urbano & Lazer',
    cnpj: '08.109.822/0002-19',
    cityUf: 'Natal - RN',
    city: 'Natal',
    uf: 'RN',
    capacity: 62,
    whatsappInstances: 2,
    plan: 'Plano Professional',
    managerName: 'Rogério Alcantara',
    status: 'ativo',
    initials: 'SD',
    avatarColor: 'orange'
  },
  {
    id: 'HOT-004',
    name: 'Grand Oasis Resort & Spa',
    razaoSocial: 'Colina Servicos Turisticos Ltda',
    category: 'Resort Internacional',
    cnpj: '05.772.311/0001-08',
    cityUf: 'Muro Alto - PE',
    city: 'Ipojuca',
    uf: 'PE',
    capacity: 110,
    whatsappInstances: 5,
    plan: 'Plano Enterprise',
    managerName: 'Juliana Castelo',
    status: 'ativo',
    initials: 'GO',
    avatarColor: 'purple'
  },
  {
    id: 'HOT-005',
    name: 'Pousada Vila dos Ventos',
    razaoSocial: 'Buzios Paradise Flats ME',
    category: 'Pousada de Charme',
    cnpj: '19.340.119/0001-55',
    cityUf: 'Jericoacoara - CE',
    city: 'Jijoca de Jericoacoara',
    uf: 'CE',
    capacity: 18,
    whatsappInstances: 1,
    plan: 'Plano Starter',
    managerName: 'Felipe Fontes',
    status: 'ativo',
    initials: 'VV',
    avatarColor: 'teal'
  },
  {
    id: 'HOT-006',
    name: 'Chalés Mirante da Serra',
    razaoSocial: 'Enseada Hospedagem Sustentável ME',
    category: 'Chalés de Montanha',
    cnpj: '31.092.114/0001-30',
    cityUf: 'Gramado - RS',
    city: 'Gramado',
    uf: 'RS',
    capacity: 32,
    whatsappInstances: 2,
    plan: 'Plano Professional',
    managerName: 'Helena Dorneles',
    status: 'ativo',
    initials: 'MS',
    avatarColor: 'emerald'
  }
];

export interface CadastroHoteisProps {
  onBackToDashboard?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToEdit?: (hotel: Hotel) => void;
  onNavigateToHotelDashboard?: (hotel: Hotel) => void;
}

export const CadastroHoteis: React.FC<CadastroHoteisProps> = ({
  onBackToDashboard,
  onNavigateToCreate,
  onNavigateToEdit,
  onNavigateToHotelDashboard
}) => {
  const [hoteis, setHoteis] = useState<Hotel[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Modais de Apoio
  const [selectedHotelDetails, setSelectedHotelDetails] = useState<Hotel | null>(null);
  const [selectedHotelDelete, setSelectedHotelDelete] = useState<Hotel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isGoogleMapsModalOpen, setIsGoogleMapsModalOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleToggleStatus = async (hotel: Hotel, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentStatus = (hotel.status || 'ativo').toLowerCase();
    const nextStatus = currentStatus === 'ativo' ? 'bloqueado' : 'ativo';
    try {
      const ok = await hoteisService.updateHotelStatus(hotel.id, nextStatus);
      if (ok) {
        setHoteis(prev => prev.map(h => h.id === hotel.id ? { ...h, status: nextStatus } : h));
        if (selectedHotelDetails && selectedHotelDetails.id === hotel.id) {
          setSelectedHotelDetails(prev => prev ? { ...prev, status: nextStatus } : null);
        }
        showToast(`Status do hotel "${hotel.name}" alterado para ${nextStatus.toUpperCase()}.`);
      } else {
        showToast('Erro ao atualizar status do hotel.');
      }
    } catch {
      showToast('Erro ao atualizar status do hotel.');
    }
  };

  // Carregar dados reais de hotéis e planos do Supabase (sem mock fallback)
  useEffect(() => {
    const fetchHoteis = async () => {
      try {
        const [data, planosData] = await Promise.all([
          hoteisService.getHoteis(),
          planosService.getPlanos().catch(() => [])
        ]);

        setHoteis(data || []);

        if (planosData && planosData.length > 0) {
          setPlanos(planosData);
        }
      } catch (err) {
        console.warn('Erro ao carregar hotéis do banco:', err);
        setHoteis([]);
      }
    };

    fetchHoteis();

    const handleUpdate = () => fetchHoteis();
    window.addEventListener('hotel_novo_hotel', handleUpdate);
    window.addEventListener('hotel_modificado', handleUpdate);
    window.addEventListener('hotel_deletado', handleUpdate);

    const unsubscribeHoteis = hoteisService.subscribeHoteis 
      ? hoteisService.subscribeHoteis(fetchHoteis) 
      : () => {};

    const unsubscribePlanos = planosService.subscribePlanos
      ? planosService.subscribePlanos(fetchHoteis)
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_hotel', handleUpdate);
      window.removeEventListener('hotel_modificado', handleUpdate);
      window.removeEventListener('hotel_deletado', handleUpdate);
      unsubscribeHoteis();
      unsubscribePlanos();
    };
  }, []);

  // Mapeamento de preços por plano para cálculo do MRR real
  const planPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    planos.forEach(p => {
      if (p.name && p.price !== undefined) {
        map.set(p.name.toLowerCase().trim(), Number(p.price));
      }
    });
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
    if (!map.has('pousada vip')) map.set('pousada vip', 349);
    if (!map.has('plano pousada vip')) map.set('plano pousada vip', 349);
    return map;
  }, [planos]);

  // Estados disponíveis dinamicamente com base nos hotéis
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    hoteis.forEach(h => {
      if (h.uf) states.add(h.uf.toUpperCase().trim());
      else if (h.cityUf && h.cityUf.includes('/')) {
        const u = h.cityUf.split('/')[1]?.trim();
        if (u) states.add(u.toUpperCase());
      } else if (h.cityUf && h.cityUf.includes('-')) {
        const u = h.cityUf.split('-')[1]?.trim();
        if (u) states.add(u.toUpperCase());
      }
    });
    return Array.from(states).filter(Boolean).sort();
  }, [hoteis]);

  // Planos disponíveis dinamicamente
  const availablePlans = useMemo(() => {
    const pSet = new Set<string>();
    hoteis.forEach(h => {
      if (h.plan) pSet.add(h.plan.trim());
    });
    planos.forEach(p => {
      if (p.name) pSet.add(p.name.trim());
    });
    return Array.from(pSet).filter(Boolean).sort();
  }, [hoteis, planos]);

  // Filtragem
  const filteredHoteis = useMemo(() => {
    return hoteis.filter(h => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        h.name.toLowerCase().includes(q) ||
        (h.cnpj || '').includes(q) ||
        (h.cityUf || '').toLowerCase().includes(q) ||
        (h.managerName || '').toLowerCase().includes(q) ||
        (h.razaoSocial || '').toLowerCase().includes(q);

      const matchesCity = !cityFilter || 
        (h.uf || '').toLowerCase() === cityFilter.toLowerCase() ||
        (h.cityUf || '').toLowerCase().includes(cityFilter.toLowerCase()) ||
        (h.city || '').toLowerCase().includes(cityFilter.toLowerCase());
      const matchesPlan = !planFilter || (h.plan || '').toLowerCase().includes(planFilter.toLowerCase());
      const matchesStatus = !statusFilter || (h.status || '').toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesCity && matchesPlan && matchesStatus;
    });
  }, [hoteis, searchQuery, cityFilter, planFilter, statusFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, cityFilter, planFilter, statusFilter]);

  const totalPages = Math.ceil(filteredHoteis.length / itemsPerPage) || 1;
  const paginatedHoteis = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHoteis.slice(start, start + itemsPerPage);
  }, [filteredHoteis, currentPage]);

  // KPIs reais calculados dinamicamente com base nos dados do Supabase
  const totalHoteisCount = hoteis.length;
  const hoteisAtivosCount = useMemo(() => {
    return hoteis.filter(h => (h.status || '').toLowerCase() === 'ativo').length;
  }, [hoteis]);

  const quartosConectadosCount = useMemo(() => {
    return hoteis.reduce((acc, h) => acc + (Number(h.capacity) || 0), 0);
  }, [hoteis]);

  const mrrRecorrenteValor = useMemo(() => {
    return hoteis.reduce((acc, h) => {
      const p = (h.plan || '').toLowerCase().trim();
      const price = planPriceMap.get(p) ?? (p.includes('free') ? 0 : 299);
      return acc + price;
    }, 0);
  }, [hoteis, planPriceMap]);

  const ticketMedio = useMemo(() => {
    const assinaturasPagas = hoteis.filter(h => {
      const p = (h.plan || '').toLowerCase().trim();
      return !p.includes('free') && !p.includes('limitado');
    }).length;
    if (assinaturasPagas > 0) {
      return mrrRecorrenteValor / assinaturasPagas;
    }
    return totalHoteisCount > 0 ? mrrRecorrenteValor / totalHoteisCount : 0;
  }, [hoteis, mrrRecorrenteValor, totalHoteisCount]);

  // Ações
  const handleClearFilters = () => {
    setSearchQuery('');
    setCityFilter('');
    setPlanFilter('');
    setStatusFilter('');
    showToast('Filtros restaurados para a visualização padrão.');
  };

  const handleExportar = () => {
    const headers = 'ID,Nome Fantasia,Razao Social,CNPJ,Localizacao,Capacidade,Instancias WhatsApp,Plano,Responsavel,Status\n';
    const rows = filteredHoteis.map(h => 
      `"${h.id}","${h.name}","${h.razaoSocial || ''}","${h.cnpj}","${h.cityUf}",${h.capacity},${h.whatsappInstances},"${h.plan}","${h.managerName}","${h.status}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hoteis_pousadas_hotelnozap_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relatório de hotéis e pousadas exportado com sucesso!');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast(`Processando arquivo "${file.name}"...`);
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        showToast('O arquivo selecionado está vazio ou contém apenas o cabeçalho.');
        setIsImportModalOpen(false);
        return;
      }

      const separator = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
      
      let importedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        if (!rawLine.trim()) continue;
        
        const cols = rawLine.split(separator).map(c => c.replace(/^["']|["']$/g, '').trim());
        const nameIndex = headers.findIndex(h => h.includes('nome') || h.includes('hotel') || h.includes('fantasia'));
        const hotelName = (nameIndex >= 0 ? cols[nameIndex] : cols[1] || cols[0] || '').trim();
        if (!hotelName) continue;

        const cnpjIndex = headers.findIndex(h => h.includes('cnpj'));
        const cityIndex = headers.findIndex(h => h.includes('cidade') || h.includes('localizacao') || h.includes('city'));
        const capIndex = headers.findIndex(h => h.includes('capacidade') || h.includes('quartos') || h.includes('capacity'));
        const planIndex = headers.findIndex(h => h.includes('plano') || h.includes('plan'));
        const managerIndex = headers.findIndex(h => h.includes('responsavel') || h.includes('gerente') || h.includes('manager'));

        const hotelCity = cityIndex >= 0 && cols[cityIndex] ? cols[cityIndex] : 'Sinop/MT';
        const cityParts = hotelCity.includes('/') ? hotelCity.split('/') : hotelCity.includes('-') ? hotelCity.split('-') : [hotelCity, 'MT'];

        const payload: Partial<Hotel> = {
          name: hotelName,
          razaoSocial: hotelName,
          category: 'Hotel Urbano / Executivo',
          cnpj: (cnpjIndex >= 0 && cols[cnpjIndex]) ? cols[cnpjIndex] : `10.${Math.floor(100+Math.random()*899)}.${Math.floor(100+Math.random()*899)}/0001-${Math.floor(10+Math.random()*89)}`,
          city: cityParts[0]?.trim() || 'Sinop',
          uf: cityParts[1]?.trim()?.toUpperCase() || 'MT',
          cityUf: `${cityParts[0]?.trim() || 'Sinop'}/${cityParts[1]?.trim()?.toUpperCase() || 'MT'}`,
          capacity: capIndex >= 0 && !isNaN(Number(cols[capIndex])) ? Number(cols[capIndex]) : 0,
          whatsappInstances: 0,
          plan: planIndex >= 0 && cols[planIndex] ? cols[planIndex] : 'Grátis (Google Maps)',
          managerName: managerIndex >= 0 && cols[managerIndex] ? cols[managerIndex] : `Recepção ${hotelName}`,
          status: 'ativo'
        };

        const res = await hoteisService.createHotel(payload);
        if (res.success) importedCount++;
      }

      showToast(`${importedCount} hotéis importados com sucesso!`);
      const updated = await hoteisService.getHoteis();
      setHoteis(updated || []);
    } catch (err) {
      console.error('Erro ao importar arquivo:', err);
      showToast('Erro ao processar o arquivo de importação.');
    } finally {
      setIsImportModalOpen(false);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedHotelDelete) return;
    setIsDeleting(true);
    try {
      const ok = await hoteisService.deleteHotel(selectedHotelDelete.id);
      if (ok) {
        setHoteis(prev => prev.filter(h => h.id !== selectedHotelDelete.id));
        if (selectedHotelDetails && selectedHotelDetails.id === selectedHotelDelete.id) {
          setSelectedHotelDetails(null);
        }
        showToast(`Hotel "${selectedHotelDelete.name}" excluído com sucesso.`);
        setSelectedHotelDelete(null);
      } else {
        showToast(`Não foi possível excluir o hotel "${selectedHotelDelete.name}".`);
      }
    } catch (e) {
      console.error('Erro ao excluir hotel:', e);
      showToast('Erro ao excluir hotel.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusBadge = (hotel: Hotel) => {
    const s = (hotel.status || 'ativo').toLowerCase();
    const isAtivo = s === 'ativo';
    const isBloqueado = s === 'bloqueado' || s === 'inativo';
    const isImplantacao = s === 'implantacao';

    const bgClass = isAtivo 
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
      : isBloqueado 
      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' 
      : isImplantacao 
      ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';

    const dotColor = isAtivo ? 'bg-emerald-500' : isBloqueado ? 'bg-rose-500' : isImplantacao ? 'bg-blue-500' : 'bg-amber-500';
    const label = isAtivo ? 'Ativo' : isBloqueado ? 'Bloqueado' : isImplantacao ? 'Implantação' : 'Prospecto';

    return (
      <button
        type="button"
        onClick={(e) => handleToggleStatus(hotel, e)}
        title="Clique para alternar status (Ativo / Bloqueado)"
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${bgClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isAtivo ? 'animate-pulse' : ''}`}></span>
        <span>{label}</span>
      </button>
    );
  };

  const getInitials = (h: Hotel) => {
    if (h.initials) return h.initials;
    const parts = (h.name || '').trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (h.name || 'H').substring(0, 2).toUpperCase();
  };

  const getAvatarBg = (color?: string) => {
    if (color === 'blue') return 'bg-blue-50 text-blue-600 border border-blue-100';
    if (color === 'amber') return 'bg-amber-50 text-amber-600 border border-amber-100';
    if (color === 'orange') return 'bg-orange-50 text-[#EA580C] border border-orange-100';
    if (color === 'purple') return 'bg-purple-50 text-purple-600 border border-purple-100';
    if (color === 'teal') return 'bg-teal-50 text-teal-600 border border-teal-100';
    return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  };

  const getPlanBadge = (plan: string) => {
    const p = (plan || '').toLowerCase();
    if (p.includes('google') || p.includes('maps')) {
      return (
        <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-xs inline-flex items-center gap-1 shadow-2xs">
          <span className="material-symbols-outlined text-[13px] text-blue-600">location_on</span>
          {plan || 'Grátis (Google Maps)'}
        </span>
      );
    }
    if (p.includes('vip')) {
      return <span className="font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md text-xs">{plan}</span>;
    }
    if (p.includes('enterprise')) {
      return <span className="font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md text-xs">{plan}</span>;
    }
    if (p.includes('professional')) {
      return <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md text-xs">{plan}</span>;
    }
    return <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs">{plan || 'Plano Starter'}</span>;
  };

  return (
    <>
      <div className="min-h-full bg-[#F8FAFC] text-slate-800 antialiased p-4 sm:p-6 lg:p-8 font-sans">
      
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[300] bg-[#003400] text-white px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-500/30 text-xs sm:text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto space-y-6">

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
        <header className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
              <span className="material-symbols-outlined text-3xl">domain</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Hotéis &amp; Pousadas</h1>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                Gerencie todos os estabelecimentos integrados, conexões de WhatsApp, planos contratados e limites operacionais.
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
            <button 
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-slate-500">upload</span>
              <span>Importar</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGoogleMapsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-xs sm:text-sm font-semibold text-white shadow-xs shadow-sky-500/20 transition cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-white">map</span>
              <span>Importar Google Maps</span>
            </button>

            <button 
              type="button"
              onClick={handleExportar}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 rounded-xl bg-[#FDB116] hover:bg-[#e5a013] text-xs sm:text-sm font-semibold text-slate-950 shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-slate-950">download</span>
              <span>Exportar</span>
            </button>

            <button 
              type="button"
              onClick={onNavigateToCreate}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-xs sm:text-sm font-semibold text-white shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base text-white">add</span>
              <span>Novo Hotel</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* KPI SECTION (4 INDICADORES)                               */}
        {/* ========================================================= */}
        <section aria-label="Indicadores Chave de Performance" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1 */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Hotéis</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <span className="material-symbols-outlined text-xl">domain</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900">{totalHoteisCount}</div>
              <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Estabelecimentos cadastrados</span>
              </p>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Hotéis Ativos</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <span className="material-symbols-outlined text-xl">verified</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900">{hoteisAtivosCount}</div>
              <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>Operando regularmente</span>
              </p>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Quartos Conectados</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-[#FDB116]">
                <span className="material-symbols-outlined text-xl">king_bed</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900">{quartosConectadosCount.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">meeting_room</span>
                <span>Capacidade total instalada</span>
              </p>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">MRR Recorrente</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 whitespace-nowrap">
                R$ {mrrRecorrenteValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-purple-600 font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">sync</span>
                <span>Ticket médio R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* TOOLBAR & FILTERS SECTION                                 */}
        {/* ========================================================= */}
        <section aria-label="Barra de Ferramentas e Filtros" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="w-full xl:w-auto flex-1 flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-80 lg:w-96">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-base">search</span>
              </div>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, cidade ou CNPJ..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all text-slate-800 placeholder-slate-400 outline-hidden"
              />
            </div>

            {/* Dropdown 1: Cidades/Estados */}
            <div className="w-full md:w-56">
              <select 
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full py-2 px-3 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all text-slate-700 font-medium cursor-pointer"
              >
                <option value="">Todas Cidades / Estados</option>
                {availableStates.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            {/* Dropdown 2: Planos */}
            <div className="w-full md:w-52">
              <select 
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="w-full py-2 px-3 text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all text-slate-700 font-medium cursor-pointer"
              >
                <option value="">Todos os Planos</option>
                {availablePlans.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            <button 
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              <span>Limpar Filtros</span>
            </button>
          </div>

          {/* View Switcher */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-end xl:self-auto">
            <button 
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_list</span>
              <span>Lista</span>
            </button>

            <button 
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className={`material-symbols-outlined text-sm ${viewMode === 'grid' ? 'text-emerald-700' : ''}`}>grid_view</span>
              <span>Grade</span>
            </button>
          </div>
        </section>

        {/* ========================================================= */}
        {/* MODO GRADE (CARDS FIÉIS AO HTML & SCREENSHOT)             */}
        {/* ========================================================= */}
        {viewMode === 'grid' ? (
          paginatedHoteis.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-sm">
              Nenhum hotel ou pousada cadastrado no momento.
            </div>
          ) : (
          <section aria-label="Grade de Estabelecimentos" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedHoteis.map(hotel => {
              const initials = getInitials(hotel);
              const avatarClass = getAvatarBg(hotel.avatarColor);

              if (hotel.isDestaque) {
                return (
                  /* CARD DESTAQUE OPERACIONAL */
                  <div key={hotel.id} className="bg-white rounded-2xl border-2 border-amber-400 shadow-md relative flex flex-col justify-between overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-[#003400] text-white text-[11px] font-bold text-center py-1 tracking-wider uppercase">
                      ★ Destaque Operacional
                    </div>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl font-bold flex items-center justify-center text-base ${avatarClass}`}>
                            {initials}
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-slate-900 leading-snug">{hotel.name}</h2>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              <span className="material-symbols-outlined text-xs text-slate-400">location_on</span>
                              <span>{hotel.cityUf}</span>
                            </div>
                          </div>
                        </div>
                        {renderStatusBadge(hotel)}
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl">
                          <span className="text-slate-400 block font-medium">Capacidade</span>
                          <span className="font-bold text-slate-800 text-sm">{hotel.capacity} quartos</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl">
                          <span className="text-slate-400 block font-medium">WhatsApp</span>
                          <span className="font-bold text-slate-800 text-sm">{hotel.whatsappInstances} {hotel.whatsappInstances === 1 ? 'Conexão' : 'Conexões'}</span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Plano Ativo:</span>
                          {getPlanBadge(hotel.plan)}
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Responsável:</span>
                          <span className="font-medium text-slate-800">{hotel.managerName}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                          <span className="text-slate-400 flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-xs text-emerald-600">smart_toy</span>
                            Agente IA:
                          </span>
                          {hotel.agenteIa ? (
                            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px]">
                              {hotel.agenteIa}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Em branco</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Ações rápidas</span>
                      <div className="flex items-center gap-1.5">
                        {onNavigateToHotelDashboard && (
                          <button 
                            type="button"
                            onClick={() => onNavigateToHotelDashboard(hotel)}
                            className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                            title="Acessar painel do hotel"
                          >
                            <span className="material-symbols-outlined text-base">login</span>
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => setSelectedHotelDetails(hotel)}
                          className="w-8 h-8 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                          title="Visualizar detalhes"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => onNavigateToEdit?.(hotel)}
                          className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                          title="Editar hotel"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSelectedHotelDelete(hotel)}
                          className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                          title="Excluir hotel"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                /* CARD PADRÃO */
                <div key={hotel.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl font-bold flex items-center justify-center text-base ${avatarClass}`}>
                          {initials}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-900 leading-snug">{hotel.name}</h2>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <span className="material-symbols-outlined text-xs text-slate-400">location_on</span>
                            <span>{hotel.cityUf}</span>
                          </div>
                        </div>
                      </div>
                      {renderStatusBadge(hotel)}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block font-medium">Capacidade</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {(!hotel.isImportedFromGoogle && hotel.capacity > 0) ? `${hotel.capacity} ${hotel.capacity === 1 ? 'quarto' : 'quartos'}` : '0 quartos'}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-400 block font-medium">WhatsApp</span>
                        <span className={`font-bold text-sm ${(!hotel.isImportedFromGoogle && hotel.whatsappInstances > 0) ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {(!hotel.isImportedFromGoogle && hotel.whatsappInstances > 0) ? `${hotel.whatsappInstances} ${hotel.whatsappInstances === 1 ? 'Conexão' : 'Conexões'}` : '0 Conexões'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Plano Ativo:</span>
                        {getPlanBadge(hotel.plan)}
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-400">Responsável:</span>
                        <span className="font-medium text-slate-800">{hotel.managerName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Ações rápidas</span>
                    <div className="flex items-center gap-1.5">
                      {onNavigateToHotelDashboard && (
                        <button 
                          type="button"
                          onClick={() => onNavigateToHotelDashboard(hotel)}
                          className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                          title="Acessar painel do hotel"
                        >
                          <span className="material-symbols-outlined text-base">login</span>
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={() => setSelectedHotelDetails(hotel)}
                        className="w-8 h-8 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                        title="Visualizar detalhes"
                      >
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => onNavigateToEdit?.(hotel)}
                        className="w-8 h-8 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                        title="Editar hotel"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSelectedHotelDelete(hotel)}
                        className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer" 
                        title="Excluir hotel"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
          )
        ) : (
          /* ========================================================= */
          /* MODO LISTA (TABELA FIEL AO HTML & SCREENSHOT)             */
          /* ========================================================= */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6 w-16 text-center">Ordem</th>
                    <th className="py-3.5 px-4">Hotel &amp; Pousada</th>
                    <th className="py-3.5 px-4">Localização</th>
                    <th className="py-3.5 px-4 text-center">Quartos</th>
                    <th className="py-3.5 px-4 text-center">Instâncias WhatsApp</th>
                    <th className="py-3.5 px-4 text-center">Plano Contratado</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedHoteis.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                        Nenhum hotel ou pousada cadastrado no momento.
                      </td>
                    </tr>
                  ) : (
                    paginatedHoteis.map((hotel, index) => {
                    const ordemNum = String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0');
                    const initials = getInitials(hotel);
                    const avatarClass = getAvatarBg(hotel.avatarColor);

                    return (
                      <tr key={hotel.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-4 sm:px-6 font-mono text-xs font-semibold text-slate-400 text-center">
                          #{ordemNum}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${avatarClass}`}>
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block leading-tight">{hotel.name}</span>
                              <span className="text-xs text-slate-500 block mt-0.5">{hotel.razaoSocial || 'Hospedagem & Turismo'} • {hotel.cnpj}</span>
                              {(hotel.instagram || hotel.facebook || hotel.tiktok || hotel.whatsapp) && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  {hotel.instagram && (
                                    <span className="text-[10px] font-bold text-pink-700 bg-pink-50 border border-pink-200 px-1.5 py-0.2 rounded" title={`Instagram: ${hotel.instagram}`}>
                                      Instagram
                                    </span>
                                  )}
                                  {hotel.facebook && (
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded" title={`Facebook: ${hotel.facebook}`}>
                                      Facebook
                                    </span>
                                  )}
                                  {hotel.tiktok && (
                                    <span className="text-[10px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded" title={`TikTok: ${hotel.tiktok}`}>
                                      TikTok
                                    </span>
                                  )}
                                  {hotel.whatsapp && (
                                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded" title={`WhatsApp: ${hotel.whatsapp}`}>
                                      WhatsApp
                                    </span>
                                  )}
                                </div>
                              )}
                              {hotel.agenteIa && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full" title="Nome do Agente IA exclusivo deste hotel">
                                    <span className="material-symbols-outlined text-xs text-emerald-600">smart_toy</span>
                                    Agente IA: {hotel.agenteIa}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">location_on</span>
                            <span>{hotel.cityUf}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={`font-semibold ${(!hotel.isImportedFromGoogle && hotel.capacity > 0) ? 'text-slate-800' : 'text-slate-400'}`}>
                            {(!hotel.isImportedFromGoogle && hotel.capacity > 0) ? `${hotel.capacity} ${hotel.capacity === 1 ? 'quarto' : 'quartos'}` : '0 quartos'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {(!hotel.isImportedFromGoogle && hotel.whatsappInstances > 0) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span>{hotel.whatsappInstances} {hotel.whatsappInstances === 1 ? 'Conexão Ativa' : 'Conexões Ativas'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              <span>0 Conexões</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {getPlanBadge(hotel.plan)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {renderStatusBadge(hotel)}
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {onNavigateToHotelDashboard && (
                              <button 
                                type="button"
                                onClick={() => onNavigateToHotelDashboard(hotel)}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition cursor-pointer" 
                                title="Acessar painel do hotel"
                              >
                                <span className="material-symbols-outlined text-sm">login</span>
                              </button>
                            )}
                            <button 
                              type="button"
                              onClick={() => setSelectedHotelDetails(hotel)}
                              className="p-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-blue-700 shadow-2xs transition cursor-pointer" 
                              title="Visualizar detalhes"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => onNavigateToEdit?.(hotel)}
                              className="p-1.5 rounded-lg bg-[#EA580C] text-white hover:bg-orange-700 shadow-2xs transition cursor-pointer" 
                              title="Editar hotel"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => setSelectedHotelDelete(hotel)}
                              className="p-1.5 rounded-lg bg-[#DC2626] text-white hover:bg-red-700 shadow-2xs transition cursor-pointer" 
                              title="Excluir hotel"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FOOTER PAGINAÇÃO                                          */}
        {/* ========================================================= */}
        <footer className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500 font-medium">
            Exibindo <span className="font-bold text-slate-800">{filteredHoteis.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredHoteis.length)}</span> de <span className="font-bold text-slate-800">{filteredHoteis.length}</span> hotéis cadastrados
          </div>

          <nav aria-label="Paginação" className="flex items-center gap-1.5">
            <button 
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-semibold transition cursor-pointer ${
                  currentPage === page 
                    ? 'bg-[#003400] text-white shadow-xs font-bold' 
                    : 'border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}

            <button 
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </nav>
        </footer>

      </div>

      {/* ========================================================= */}
      {/* MODAL DETALHES DO HOTEL                                   */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* MODAL DETALHES DO HOTEL (VISUALIZAÇÃO COMPLETA)           */}
      {/* ========================================================= */}
      {selectedHotelDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl font-bold flex items-center justify-center text-base ${getAvatarBg(selectedHotelDetails.avatarColor)}`}>
                  {getInitials(selectedHotelDetails)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedHotelDetails.name}</h3>
                  <p className="text-xs text-slate-500">{selectedHotelDetails.cityUf} • CNPJ: {selectedHotelDetails.cnpj}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedHotelDetails(null)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold p-1.5 rounded-xl transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs text-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Capacidade</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {(!selectedHotelDetails.isImportedFromGoogle && selectedHotelDetails.capacity > 0) ? `${selectedHotelDetails.capacity} ${selectedHotelDetails.capacity === 1 ? 'quarto' : 'quartos'}` : '0 quartos'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">WhatsApp</span>
                  <span className={`font-extrabold text-sm mt-0.5 block ${(!selectedHotelDetails.isImportedFromGoogle && selectedHotelDetails.whatsappInstances > 0) ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {(!selectedHotelDetails.isImportedFromGoogle && selectedHotelDetails.whatsappInstances > 0) ? `${selectedHotelDetails.whatsappInstances} ${selectedHotelDetails.whatsappInstances === 1 ? 'Conexão' : 'Conexões'}` : '0 Conexões'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Plano</span>
                  <span className="font-extrabold text-purple-700 text-sm mt-0.5 block">{selectedHotelDetails.plan}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Status</span>
                  <div className="mt-1 flex justify-center">
                    {renderStatusBadge(selectedHotelDetails)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-950 font-bold flex items-center gap-1.5 text-xs">
                    <span className="material-symbols-outlined text-base text-emerald-700">smart_toy</span>
                    Nome do Agente IA:
                  </span>
                  {selectedHotelDetails.agenteIa ? (
                    <span className="font-extrabold text-emerald-900 bg-white border border-emerald-300 px-3 py-0.5 rounded-full text-xs shadow-2xs">
                      {selectedHotelDetails.agenteIa}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Em branco</span>
                  )}
                </div>
                <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium">Razão Social:</span>
                  <span className="font-semibold text-slate-900">{selectedHotelDetails.razaoSocial || 'Não informada'}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium">Responsável Operacional:</span>
                  <span className="font-semibold text-slate-900">{selectedHotelDetails.managerName || 'Não informado'}</span>
                </div>
                {selectedHotelDetails.managerPhone && (
                  <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-500 font-medium">Telefone / WhatsApp:</span>
                    <span className="font-semibold text-slate-900">{selectedHotelDetails.managerPhone}</span>
                  </div>
                )}
                {selectedHotelDetails.managerEmail && (
                  <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-500 font-medium">E-mail:</span>
                    <span className="font-semibold text-slate-900">{selectedHotelDetails.managerEmail}</span>
                  </div>
                )}
                <div className="flex justify-between p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium">Endereço / Localização:</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {[
                      selectedHotelDetails.street && selectedHotelDetails.streetNumber ? `${selectedHotelDetails.street}, ${selectedHotelDetails.streetNumber}` : selectedHotelDetails.street,
                      selectedHotelDetails.neighborhood,
                      selectedHotelDetails.cityUf
                    ].filter(Boolean).join(' - ')}
                  </span>
                </div>

                {(selectedHotelDetails.instagram || selectedHotelDetails.facebook || selectedHotelDetails.tiktok || selectedHotelDetails.whatsapp) && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Redes Sociais Oficiais:</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {selectedHotelDetails.instagram && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-pink-700 font-bold block">Instagram:</span>
                          <span className="text-slate-700 truncate block font-mono">{selectedHotelDetails.instagram}</span>
                        </div>
                      )}
                      {selectedHotelDetails.facebook && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-blue-700 font-bold block">Facebook:</span>
                          <span className="text-slate-700 truncate block font-mono">{selectedHotelDetails.facebook}</span>
                        </div>
                      )}
                      {selectedHotelDetails.tiktok && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-slate-900 font-bold block">TikTok:</span>
                          <span className="text-slate-700 truncate block font-mono">{selectedHotelDetails.tiktok}</span>
                        </div>
                      )}
                      {selectedHotelDetails.whatsapp && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-emerald-700 font-bold block">WhatsApp:</span>
                          <span className="text-slate-700 truncate block font-mono">{selectedHotelDetails.whatsapp}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                {onNavigateToHotelDashboard && (
                  <button 
                    type="button"
                    onClick={() => {
                      const h = selectedHotelDetails;
                      setSelectedHotelDetails(null);
                      onNavigateToHotelDashboard(h);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Acessar painel do hotel"
                  >
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Acessar Painel</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => {
                    const h = selectedHotelDetails;
                    setSelectedHotelDetails(null);
                    setSelectedHotelDelete(h);
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Excluir hotel"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  <span>Excluir</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    const h = selectedHotelDetails;
                    setSelectedHotelDetails(null);
                    onNavigateToEdit?.(h);
                  }}
                  className="px-4 py-2 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  <span>Editar Hotel</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setSelectedHotelDetails(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL IMPORTAR HOTÉIS                                     */}
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
                  <h3 className="text-lg font-bold text-slate-900">Importar Hotéis</h3>
                  <p className="text-xs text-slate-500">Envie planilha CSV ou arquivo Excel</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="bg-[#b91c1c] hover:bg-red-800 text-white font-bold p-1.5 rounded-xl transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Faça o upload de uma planilha no formato CSV contendo os dados dos estabelecimentos:
                <br />
                <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono text-[10px] block mt-1">
                  Nome, CNPJ, Cidade, UF, Capacidade, Plano, Responsavel
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
      {/* MODAL EXCLUIR HOTEL (PADRÃO DO SISTEMA)                   */}
      {/* ========================================================= */}
      <ModalConfirmacaoExclusao
        isOpen={!!selectedHotelDelete}
        onClose={() => setSelectedHotelDelete(null)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        title="Excluir Hotel"
        subtitle="Confirmação de exclusão permanente"
        itemType="o estabelecimento"
        itemName={selectedHotelDelete?.name}
        description="Esta ação removerá a configuração do hotel, quartos cadastrados e instâncias vinculadas."
      />

    </div>

    <ModalImportarGoogleMaps
      isOpen={isGoogleMapsModalOpen}
      onClose={() => setIsGoogleMapsModalOpen(false)}
      existingHoteis={hoteis}
      onImportSuccess={(count) => {
        if (count > 0) showToast(`${count} hoteis importados do Google Maps com sucesso!`);
        hoteisService.getHoteis().then(data => setHoteis(data || []));
      }}
    />
    </>
  );
};

export default CadastroHoteis;
