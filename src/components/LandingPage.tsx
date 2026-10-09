import React, { useState, useEffect, useMemo } from 'react';
import { planosService, hoteisService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { maskPhone } from '../utils/masks';

interface LandingPageProps {
  onNavigateToLogin: () => void;
  onNavigateToSystem?: () => void;
  onNavigateToNovoHotel?: () => void;
}

interface PlanoView {
  id: string;
  name: string;
  tag?: string;
  categoryLabel?: string;
  description: string;
  basePrice: number;
  periodicity?: string;
  cycleDiscount?: string;
  trialDays: number;
  bonusDays?: number;
  roomLimit: number;
  extraRoomPrice?: number;
  allowExtraRooms?: boolean;
  whatsappConnections: number;
  extraWaPrice?: number;
  allowExtraWa?: boolean;
  isFeatured: boolean;
  features: string[];
  disabledFeatures: string[];
}

// Helper para formatar o sufixo de periodicidade ao lado do valor (ex: "/ mês", "Bimestral", "Trimestral", "Semestral", "Anual")
export const getPeriodicitySuffix = (periodicity?: string): string => {
  if (!periodicity) return '/ mês';
  const p = periodicity.trim().toLowerCase();
  if (p === 'mensal') return '/ mês';
  return periodicity.trim();
};

// Helper para formatar o preço com separador decimal e de milhar no padrão pt-BR
export const formatPrice = (val: number): string => {
  if (typeof val !== 'number' || isNaN(val)) return '0';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: val % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

// Helper para formatar o título do plano incorporando desconto administrativo e ciclo
export const formatPlanTitle = (name: string, periodicity?: string, cycleDiscount?: string): string => {
  // Extrai nome base sem parênteses antigos ou descontos fixos (ex: "2 Créditos (Bimestral)" -> "2 Créditos")
  const baseName = name
    .replace(/\s*-\s*\d+%.*$/, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();

  const rawDisc = (cycleDiscount || '').replace(/[^0-9]/g, '');
  const discNum = parseInt(rawDisc, 10);
  const period = periodicity ? periodicity.trim() : 'Mensal';

  if (!isNaN(discNum) && discNum > 0) {
    return `${baseName} -${discNum}% (${period})`;
  }

  // Se não tem desconto e a periodicidade não é Mensal e não está no nome, adiciona o ciclo
  if (period.toLowerCase() !== 'mensal' && !name.includes('(')) {
    return `${baseName} (${period})`;
  }

  return name;
};

// Helper para ajustar terminologia com concordância contextual (ex: "instância" -> "conexão")
export const sanitizeFeatureText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/inst[aâ]ncia extra/gi, 'Conexão extra')
    .replace(/inst[aâ]ncias extras/gi, 'Conexões extras')
    .replace(/por inst[aâ]ncia/gi, 'por conexão')
    .replace(/inst[aâ]ncias/gi, 'conexões')
    .replace(/inst[aâ]ncia/gi, 'conexão')
    .replace(/1 Conexão WhatsApp simultâneas/gi, '1 Conexão WhatsApp oficial')
    .replace(/1 Conexão WhatsApp simultânea/gi, '1 Conexão WhatsApp oficial');
};

// Helper para construir todos os benefícios completos do hotel dinamicamente para cada plano
export const buildPlanBenefits = (plano: PlanoView): string[] => {
  const rooms = plano.roomLimit || 10;
  const wa = plano.whatsappConnections || 1;
  const roomExtraVal = plano.extraRoomPrice !== undefined ? plano.extraRoomPrice : 3.5;
  const waExtraVal = plano.extraWaPrice !== undefined ? plano.extraWaPrice : 49.9;

  const roomExtraText = plano.allowExtraRooms === false 
    ? 'Sem quartos excedentes' 
    : `Quartos excedentes: + R$ ${formatPrice(roomExtraVal)} /quarto`;

  const waExtraText = plano.allowExtraWa === false 
    ? 'Conexões extras inclusas' 
    : `Conexão extra: + R$ ${formatPrice(waExtraVal)} /conexão`;

  const waConnText = wa === 1 
    ? '1 Conexão do WhatsApp' 
    : `${wa} Conexões do WhatsApp simultâneas`;

  return [
    'Acesso total ao sistema',
    `Capacidade para até ${rooms} quartos`,
    waConnText,
    'Área administrativa para acompanhar o desempenho do hotel',
    'Área para camareira',
    'Área exclusiva pra seu hóspede',
    'Página de divulgação do seu hotel com todos os seus quartos cadastrados',
    'Atendimento no WhatsApp por IA (Inteligência Artificial de forma humanizada)',
    roomExtraText,
    waExtraText,
    'Mapa dos quartos',
    'Reservas no balcão em menos de 5 minutos (feito pelo usuário recepcionista)',
    'Controle de caixa',
    'Cadastro de produtos e controle de estoque',
    'Cardápio dos produtos cadastrados (disponível na área do hóspede)',
    'Cadastro de cupons',
    'Relatórios completos',
    'Suporte humanizado'
  ];
};

export interface PlanCardTheme {
  isDark: boolean;
  containerClass: string;
  badgeClass?: string;
  categoryClass: string;
  titleClass: string;
  descClass: string;
  priceClass: string;
  periodicityClass: string;
  dividerClass: string;
  featureItemClass: string;
  checkIconClass: string;
  benefitsBtnClass: string;
  ctaBtnClass: string;
  iconBoxClass: string;
}

export const getPlanCardTheme = (plano: PlanoView, index: number): PlanCardTheme => {
  // PLANO EM DESTAQUE - FUNDO VERDE ESCURO COM AJUSTE TOTAL DE CONTRASTE E TIPOGRAFIA CLARA
  if (plano.isFeatured) {
    return {
      isDark: true,
      containerClass: 'bg-gradient-to-b from-[#003400] to-[#002200] border-2 border-[#10b981] shadow-2xl lg:-translate-y-3 ring-4 ring-[#10b981]/25 text-white',
      badgeClass: 'bg-[#FDB116] text-[#0b1c30] font-black',
      categoryClass: 'text-emerald-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-emerald-400/25 font-bold inline-block',
      titleClass: 'text-white font-black',
      descClass: 'text-emerald-100/90',
      priceClass: 'text-white font-black',
      periodicityClass: 'text-emerald-300 font-semibold',
      dividerClass: 'border-white/15',
      featureItemClass: 'text-white font-medium',
      checkIconClass: 'text-[#10b981]',
      benefitsBtnClass: 'bg-white/10 hover:bg-white/20 text-emerald-200 border border-white/20 hover:border-emerald-400/40 font-bold',
      ctaBtnClass: 'bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-black shadow-lg hover:scale-[1.02]',
      iconBoxClass: 'bg-white/10 text-[#FDB116] border border-white/20'
    };
  }

  // DEMAIS PLANOS - CORES DE FUNDO DIFERENCIADAS (Fundo Claro com Alto Contraste)
  const cycleIndex = index % 4;

  if (cycleIndex === 0) {
    // 1 Crédito / Estilo 1: Slate Suave / Branco Gelo
    return {
      isDark: false,
      containerClass: 'bg-[#f8fafc] border-2 border-slate-200/90 hover:border-emerald-600/40 hover:shadow-lg',
      badgeClass: 'bg-[#006c49] text-white',
      categoryClass: 'text-[#006c49] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold inline-block',
      titleClass: 'text-[#0b1c30] font-extrabold',
      descClass: 'text-[#45464d]',
      priceClass: 'text-[#0b1c30] font-black',
      periodicityClass: 'text-[#45464d] font-semibold',
      dividerClass: 'border-slate-200',
      featureItemClass: 'text-[#0b1c30] font-medium',
      checkIconClass: 'text-[#10b981]',
      benefitsBtnClass: 'bg-white hover:bg-slate-100 text-[#006c49] border border-slate-200 font-bold',
      ctaBtnClass: 'border-2 border-[#003400] text-[#003400] hover:bg-[#003400] hover:text-white font-bold',
      iconBoxClass: 'bg-white border border-slate-200 text-[#006c49]'
    };
  }

  if (cycleIndex === 1) {
    // 2 Créditos / Estilo 2: Areia Dourada Quente (Warm Amber / Sand)
    return {
      isDark: false,
      containerClass: 'bg-[#fffdf5] border-2 border-amber-200/80 hover:border-amber-400 hover:shadow-lg',
      badgeClass: 'bg-amber-600 text-white',
      categoryClass: 'text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200 font-bold inline-block',
      titleClass: 'text-[#0b1c30] font-extrabold',
      descClass: 'text-slate-600',
      priceClass: 'text-[#0b1c30] font-black',
      periodicityClass: 'text-slate-600 font-semibold',
      dividerClass: 'border-amber-200/60',
      featureItemClass: 'text-[#0b1c30] font-medium',
      checkIconClass: 'text-amber-600',
      benefitsBtnClass: 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 font-bold',
      ctaBtnClass: 'border-2 border-amber-900 text-amber-950 hover:bg-amber-900 hover:text-white font-bold',
      iconBoxClass: 'bg-amber-50 border border-amber-200 text-amber-700'
    };
  }

  if (cycleIndex === 2) {
    // 6 Créditos / Estilo 3: Azul Celeste Náutico (Sky Blue)
    return {
      isDark: false,
      containerClass: 'bg-[#f0f9ff] border-2 border-sky-200/90 hover:border-sky-400 hover:shadow-lg',
      badgeClass: 'bg-sky-600 text-white',
      categoryClass: 'text-sky-800 bg-sky-100/70 px-2.5 py-0.5 rounded-full border border-sky-200 font-bold inline-block',
      titleClass: 'text-[#0b1c30] font-extrabold',
      descClass: 'text-slate-600',
      priceClass: 'text-[#0b1c30] font-black',
      periodicityClass: 'text-slate-600 font-semibold',
      dividerClass: 'border-sky-200/60',
      featureItemClass: 'text-[#0b1c30] font-medium',
      checkIconClass: 'text-sky-600',
      benefitsBtnClass: 'bg-white hover:bg-sky-50 text-sky-900 border border-sky-200 font-bold',
      ctaBtnClass: 'border-2 border-sky-900 text-sky-950 hover:bg-sky-900 hover:text-white font-bold',
      iconBoxClass: 'bg-sky-50 border border-sky-200 text-sky-700'
    };
  }

  // 12 Créditos / Estilo 4: Verde Menta Refrescante (Fresh Mint)
  return {
    isDark: false,
    containerClass: 'bg-[#f2fbf7] border-2 border-emerald-200/80 hover:border-emerald-400 hover:shadow-lg',
    badgeClass: 'bg-emerald-700 text-white',
    categoryClass: 'text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold inline-block',
    titleClass: 'text-[#0b1c30] font-extrabold',
    descClass: 'text-slate-600',
    priceClass: 'text-[#0b1c30] font-black',
    periodicityClass: 'text-slate-600 font-semibold',
    dividerClass: 'border-emerald-200/60',
    featureItemClass: 'text-[#0b1c30] font-medium',
    checkIconClass: 'text-emerald-600',
    benefitsBtnClass: 'bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold',
    ctaBtnClass: 'border-2 border-[#003400] text-[#003400] hover:bg-[#003400] hover:text-white font-bold',
    iconBoxClass: 'bg-emerald-50 border border-emerald-200 text-emerald-700'
  };
};

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin, onNavigateToSystem, onNavigateToNovoHotel }) => {
  // Planos vindos do Supabase
  const [planos, setPlanos] = useState<PlanoView[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);

  // Modal para Visualizar Todos os Benefícios do Plano
  const [selectedPlanForBenefits, setSelectedPlanForBenefits] = useState<PlanoView | null>(null);

  // Calculadora de Economia
  const [roomsCount, setRoomsCount] = useState<number>(20);
  const [dailyRate, setDailyRate] = useState<number>(350);
  const [occupancyRate, setOccupancyRate] = useState<number>(60);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Mobile navigation drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modal de Prospecto (Iniciar Teste de 30 Dias)
  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false);
  const [selectedPlanForProspect, setSelectedPlanForProspect] = useState<string>('Plano Professional');
  const [prospectForm, setProspectForm] = useState({
    hotelName: '',
    managerName: '',
    phone: '',
    email: '',
    city: '',
    uf: 'PE',
    capacity: 15,
    notes: ''
  });
  const [isSubmittingProspect, setIsSubmittingProspect] = useState(false);
  const [prospectSuccess, setProspectSuccess] = useState(false);

  // Carregar planos da tabela 'planos' no Supabase com sincronização em tempo real
  useEffect(() => {
    let isMounted = true;
    const fetchPlanos = async () => {
      try {
        setLoadingPlanos(true);
        const data = await planosService.getPlanos();
        if (data && data.length > 0 && isMounted) {
          // Filtrar planos ativos e comerciais (exclui inativos, legado e grátis)
          const activePlanos = data
            .filter((p: any) => p.status !== 'Inativo' && !p.name?.toLowerCase().includes('legado') && !p.name?.toLowerCase().includes('maps') && Number(p.basePrice || p.valor_base) > 0)
            .map((p: any) => {
              const cleanTag = (p.tag !== undefined && p.tag !== null) ? String(p.tag).trim() : '';

              let categoryLabel = 'Pousadas e Hotéis';
              if (p.name.includes('1 Crédito')) categoryLabel = 'Acesso Mensal Flexível';
              else if (p.name.includes('2 Créditos')) categoryLabel = 'Pacote Econômico Bimestral';
              else if (p.name.includes('3 Créditos')) categoryLabel = 'Mais Escolhido • Alta Temporada';
              else if (p.name.includes('4 Créditos')) categoryLabel = 'Quadrimestral Flex';
              else if (p.name.includes('6 Créditos')) categoryLabel = 'Semestral • Estabilidade Total';
              else if (p.name.includes('12 Créditos')) categoryLabel = 'Anual VIP • Maior Economia';
              else if (p.name.toLowerCase().includes('starter')) categoryLabel = 'Pousadas Familiares';
              else if (p.name.toLowerCase().includes('pro')) categoryLabel = 'Hotéis de Médio Porte';
              else if (p.name.toLowerCase().includes('enterprise')) categoryLabel = 'Resorts & Redes';

              return {
                id: p.id,
                name: p.name,
                tag: cleanTag || undefined,
                categoryLabel,
                description: p.description || p.descricao || 'Solução completa para gestão e motor de reservas via WhatsApp.',
                basePrice: Number(p.basePrice || p.valor_base) || 0,
                periodicity: p.periodicity || p.periodicidade || 'Mensal',
                cycleDiscount: p.cycleDiscount || p.desconto_ciclo || '',
                trialDays: Number(p.bonusDays !== undefined ? p.bonusDays : (p.trialDays || p.dias_trial)) || 0,
                bonusDays: Number(p.bonusDays !== undefined ? p.bonusDays : (p.trialDays || p.dias_trial)) || 0,
                roomLimit: Number(p.roomLimit || p.limite_quartos) || 10,
                extraRoomPrice: Number(p.extraRoomPrice || p.valor_quarto_extra) || 3.5,
                allowExtraRooms: p.allowExtraRooms !== undefined ? p.allowExtraRooms : p.permite_quartos_extras !== false,
                whatsappConnections: Number(p.whatsappConnections || p.conexoes_whatsapp) || 1,
                extraWaPrice: Number(p.extraWaPrice || p.valor_conexao_extra) || 49.9,
                allowExtraWa: p.allowExtraWa !== undefined ? p.allowExtraWa : p.permite_conexoes_extras !== false,
                isFeatured: Boolean(p.isFeatured || p.destaque || p.name.toLowerCase().includes('trimestre') || p.name.toLowerCase().includes('professional')),
                features: Array.isArray(p.features) && p.features.length > 0 ? p.features : Array.isArray(p.recursos) && p.recursos.length > 0 ? p.recursos : [
                  `Capacidade para até ${p.roomLimit || p.limite_quartos || 10} quartos`,
                  'Conexão WhatsApp oficial integrada',
                  'Mapa de quartos e controle de check-in',
                  'Confirmação de reserva no WhatsApp'
                ],
                disabledFeatures: Array.isArray(p.disabledFeatures) ? p.disabledFeatures : Array.isArray(p.recursos_desabilitados) ? p.recursos_desabilitados : []
              };
            });

          if (activePlanos.length > 0) {
            setPlanos(activePlanos);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar planos na Landing Page:', err);
      } finally {
        if (isMounted) setLoadingPlanos(false);
      }
    };

    fetchPlanos();

    // Sincronizar em tempo real quando alterações de preços ou descontos forem feitas no painel administrativo
    const planosChannel = supabase
      .channel('landing-page-planos-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'planos' },
        () => {
          fetchPlanos();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(planosChannel);
    };
  }, []);

  // Contagem dinâmica de hotéis cadastrados (atualizada em tempo real via Supabase)
  const [totalHoteis, setTotalHoteis] = useState<number>(293);

  // Carregar contagem real de hotéis cadastrados (planos + Google Maps) e escutar atualizações em tempo real
  useEffect(() => {
    let isMounted = true;

    const fetchHoteisCount = async () => {
      try {
        const count = await hoteisService.getTotalHoteisCount();
        if (isMounted && count > 0) {
          setTotalHoteis(count);
        }
      } catch (err) {
        console.warn('Erro ao buscar contagem de hotéis para a LP:', err);
      }
    };

    fetchHoteisCount();

    // Inscrever no canal Realtime do Supabase para atualizar automaticamente quando um hotel for adicionado (seja via plano ou importador)
    const channel = supabase
      .channel('landing-page-hoteis-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hoteis' },
        () => {
          fetchHoteisCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Planos padrão de fallback se o banco estiver vazio ou offline
  const displayPlanos = useMemo(() => {
    if (planos.length > 0) return planos;
    return [
      {
        id: '1-credito-default',
        name: '1 Crédito',
        tag: 'Inicie sem medo',
        categoryLabel: 'Acesso Mensal Flexível',
        description: '1 Crédito • 30 dias base + 15 dias de bônus + 1 Conexão no Whatsapp (45 dias de acesso)',
        basePrice: 197,
        periodicity: 'Mensal',
        cycleDiscount: '',
        trialDays: 15,
        roomLimit: 50,
        extraRoomPrice: 30,
        allowExtraRooms: true,
        whatsappConnections: 1,
        extraWaPrice: 49.9,
        allowExtraWa: true,
        isFeatured: false,
        features: [
          '1 Crédito de Acesso Oficial',
          '30 dias base + 15 dias bônus (45 dias)',
          'Capacidade para até 50 quartos',
          '1 Conexão WhatsApp oficial integrada',
          'Ideal para começar sem compromisso'
        ],
        disabledFeatures: []
      },
      {
        id: '2-creditos-default',
        name: '2 Créditos (Bimestral)',
        tag: 'Econômico',
        categoryLabel: 'Pacote Econômico Bimestral',
        description: '2 Créditos • 60 dias base + 15 dias de bônus + 1 Conexão no Whatsapp (75 dias de acesso)',
        basePrice: 354.60,
        periodicity: 'Bimestral',
        cycleDiscount: '10%',
        trialDays: 0,
        roomLimit: 25,
        extraRoomPrice: 3.5,
        allowExtraRooms: true,
        whatsappConnections: 1,
        extraWaPrice: 49.9,
        allowExtraWa: true,
        isFeatured: false,
        features: [
          '2 Créditos de Acesso',
          '60 dias base + 15 dias bônus (75 dias)',
          'Capacidade para até 25 quartos',
          '1 Conexão WhatsApp oficial',
          'Economia imediata de 2 meses e meio'
        ],
        disabledFeatures: []
      },
      {
        id: '3-creditos-default',
        name: '3 Créditos (Trimestre de Ouro)',
        tag: 'Mais Vendido',
        categoryLabel: 'Mais Escolhido • Alta Temporada',
        description: '3 Créditos • 90 dias base + 30 dias de bônus + 1 Conexão no Whatsapp (120 dias / 4 meses)',
        basePrice: 497,
        periodicity: 'Trimestral',
        cycleDiscount: '',
        trialDays: 0,
        roomLimit: 40,
        extraRoomPrice: 3,
        allowExtraRooms: true,
        whatsappConnections: 3,
        extraWaPrice: 39.9,
        allowExtraWa: true,
        isFeatured: true,
        features: [
          '3 Créditos de Acesso',
          '90 dias base + 30 dias bônus (4 meses)',
          'Capacidade para até 40 quartos',
          '3 Conexões WhatsApp simultâneas',
          'Perfeito para cobrir a alta temporada',
          'Suporte prioritário via WhatsApp'
        ],
        disabledFeatures: []
      }
    ];
  }, [planos]);

  // Cálculos do Simulador de Economia
  const { economiaMensal, economiaAnual, faturamentoEstimado, totalDiariasMes } = useMemo(() => {
    const totalDiarias = Math.round(roomsCount * 30 * (occupancyRate / 100));
    const faturamentoMes = totalDiarias * dailyRate;
    const economiaMes = faturamentoMes * 0.20; // 20% média praticada por OTAs
    const economiaAno = economiaMes * 12;
    return {
      totalDiariasMes: totalDiarias,
      faturamentoEstimado: faturamentoMes,
      economiaMensal: economiaMes,
      economiaAnual: economiaAno
    };
  }, [roomsCount, dailyRate, occupancyRate]);

  // Handler para navegar para o formulário de cadastro completo do hotel
  const handleOpenProspectModal = (planName?: string) => {
    // Abrir a página de cadastro multi-etapas /lp/lpnovohotel em nova aba passando o plano selecionado
    const cleanPlan = planName ? planName.split('•')[0].trim() : '';
    const url = cleanPlan 
      ? `/lp/lpnovohotel?plano=${encodeURIComponent(cleanPlan)}` 
      : '/lp/lpnovohotel';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Submissão do Prospecto no Supabase (tabela hoteis com status: 'prospecto')
  const handleRegisterProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectForm.hotelName.trim() || !prospectForm.phone.trim() || !prospectForm.email.trim()) {
      alert('Por favor, preencha o Nome do Hotel, WhatsApp e E-mail.');
      return;
    }

    try {
      setIsSubmittingProspect(true);

      const payload = {
        name: prospectForm.hotelName.trim(),
        razaoSocial: prospectForm.hotelName.trim(),
        cnpj: '00.000.000/0001-00',
        category: 'Pousada / Hotel',
        city: prospectForm.city.trim() || '',
        uf: prospectForm.uf || '',
        cityUf: prospectForm.city && prospectForm.uf ? `${prospectForm.city.trim()}/${prospectForm.uf}` : (prospectForm.city || prospectForm.uf || ''),
        plan: selectedPlanForProspect,
        capacity: Number(prospectForm.capacity) || 0,
        capacityUnit: 'quartos',
        whatsappInstances: 0,
        managerName: prospectForm.managerName.trim() || 'Proprietário',
        managerPhone: prospectForm.phone.trim(),
        managerEmail: prospectForm.email.trim(),
        loginEmail: prospectForm.email.trim(),
        status: 'prospecto',
        partnerRef: 'HOTELNOZAP',
        notes: `Prospecto cadastrado na Landing Page (/lp) em ${new Date().toLocaleDateString('pt-BR')}. Plano escolhido: ${selectedPlanForProspect}. Parceiro: HOTELNOZAP. Observações: ${prospectForm.notes}`,
        link: `/hoteis/${prospectForm.hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
      };

      const result = await hoteisService.createHotel(payload as any);
      if (result.success) {
        setProspectSuccess(true);
      } else {
        alert('Não foi possível registrar o cadastro no momento. Tente novamente ou nos chame no WhatsApp.');
      }
    } catch (err) {
      console.error('Erro ao registrar prospecto:', err);
      alert('Ocorreu um erro ao registrar sua solicitação. Por favor, tente novamente.');
    } finally {
      setIsSubmittingProspect(false);
    }
  };

  // Máscara de Telefone/WhatsApp
  const formatPhone = (val: string) => maskPhone(val);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] antialiased selection:bg-[#10b981] selection:text-white font-sans">
      {/* 1. HEADER & BARRA DE NAVEGAÇÃO STICKY */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] transition-all">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-20 sm:h-24 flex items-center justify-between gap-4">
          {/* LOGO OFICIAL */}
          <a href="https://hotelnozap.com.br/" className="flex items-center shrink-0 group py-1" title="Ir para a página inicial">
            <img
              src="/logo.png"
              alt="Hotel no Zap - Hospitalidade Digital"
              className="h-12 sm:h-14 md:h-16 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </a>

          {/* LINKS CENTRAIS (DESKTOP) */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-7 text-xs xl:text-sm font-semibold text-[#45464d] whitespace-nowrap">
            <a href="#funcionalidades" className="hover:text-[#006c49] transition-colors py-1">Funcionalidades</a>
            <a href="#motor-whatsapp" className="hover:text-[#006c49] transition-colors py-1 flex items-center gap-1.5">
              <span>Motor WhatsApp</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#10b981]/15 text-[#006c49]">24/7</span>
            </a>
            <a href="#calculadora" className="hover:text-[#006c49] transition-colors py-1">Calculadora</a>
            <a href="#planos" className="hover:text-[#006c49] transition-colors py-1">Planos & Preços</a>
            <a href="#depoimentos" className="hover:text-[#006c49] transition-colors py-1">Depoimentos</a>
          </nav>

          {/* AÇÕES À DIREITA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 whitespace-nowrap">
            <button
              onClick={onNavigateToLogin}
              className="hidden md:inline-flex text-xs xl:text-sm font-bold text-[#0b1c30] hover:text-[#006c49] px-2.5 xl:px-3 py-2 transition-colors cursor-pointer"
            >
              Entrar
            </button>
            <a
              href="/lp/lpnovohotel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-black text-xs xl:text-sm px-3 sm:px-4 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <span>Cadastrar Meu Hotel</span>
              <span className="material-symbols-outlined text-base font-bold hidden sm:inline">arrow_forward</span>
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#0b1c30] hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined text-2xl">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-4 space-y-3 shadow-lg">
            <a 
              href="#funcionalidades" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] py-1"
            >
              Funcionalidades
            </a>
            <a 
              href="#motor-whatsapp" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] py-1 flex items-center justify-between"
            >
              <span>Motor WhatsApp</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#10b981]/15 text-[#006c49]">24/7</span>
            </a>
            <a 
              href="#calculadora" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] py-1"
            >
              Calculadora de Economia
            </a>
            <a 
              href="#planos" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] py-1"
            >
              Planos & Preços
            </a>
            <a 
              href="#depoimentos" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] py-1"
            >
              Depoimentos
            </a>
            <div className="pt-3 border-t border-gray-100 flex items-center gap-3 justify-between">
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigateToLogin(); }}
                className="text-xs sm:text-sm font-bold text-[#006c49] py-2 px-3 rounded-lg border border-[#006c49]/30"
              >
                Acessar Login
              </button>
              <a
                href="/lp/lpnovohotel"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-[#003400] text-white text-xs font-bold px-3.5 py-2 rounded-lg inline-flex items-center justify-center"
              >
                Cadastrar Meu Hotel
              </a>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-10 pb-16 lg:pt-16 lg:pb-28 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50/70 via-[#f8f9ff] to-[#f8f9ff]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/25 text-[#006c49] font-bold text-xs sm:text-sm mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>🚀 +40% em Reservas Diretas • Zero Comissões para OTAs</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0b1c30] leading-[1.18] mb-6">
              Transforme o WhatsApp do seu Hotel na sua <span className="bg-gradient-to-r from-[#006c49] to-[#10b981] bg-clip-text text-transparent">Maior Máquina</span> de Reservas Diretas
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-[#45464d] leading-relaxed mb-8">
              O primeiro sistema de gestão hoteleira (PMS) com inteligência automatizada no WhatsApp: controle mapa de quartos, check-in, frigobar e pagamentos enquanto sua taxa de ocupação decola.
            </p>

            <div className="flex justify-center mb-6">
              <a
                href="/lp/lpnovohotel"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#003400] hover:bg-[#002000] text-white font-bold text-sm sm:text-base px-8 py-4 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl text-[#6cf8bb]">rocket_launch</span>
                <span>Cadastrar Meu Hotel Agora</span>
              </a>
            </div>

            <div className="flex flex-col items-center justify-center gap-2.5 max-w-2xl mx-auto">
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm font-semibold text-[#45464d]">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#10b981] font-bold">check_circle</span> Sem necessidade de cartão
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#10b981] font-bold">check_circle</span> Suporte humano dedicado
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-[#45464d] leading-relaxed text-center">
                (Seu único trabalho é cadastrar seus quartos com fotos reais e cadastrar a sua equipe de atendimento no sistema, Recepicionistas, Camareiras, Gerente e Administradores do Sistema.)
              </p>
            </div>
          </div>

          {/* HERO MOCKUP DUPLO */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-2 bg-gradient-to-r from-[#003400] via-[#10b981] to-[#FDB116] rounded-3xl blur-2xl opacity-15"></div>

            <div className="relative bg-white rounded-2xl border border-[#e2e8f0] shadow-xl overflow-hidden">
              <div className="bg-[#003400] px-4 py-3 flex items-center justify-between border-b border-[#081a0b]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                  <span className="ml-3 text-xs font-semibold text-white/80 hidden sm:inline">
                    Hotel no Zap PMS • Mapa de Quartos em Tempo Real
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/90">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span> WhatsApp Oficial Conectado
                  </span>
                  <span className="font-bold hidden md:inline">Ocupação: 84%</span>
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-[#f8f9ff] grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-[#45464d] uppercase">Disponíveis</span>
                    <p className="text-lg sm:text-xl font-extrabold text-[#10b981]">08 <span className="text-xs font-normal text-[#45464d]">quartos</span></p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-[#45464d] uppercase">Ocupados</span>
                    <p className="text-lg sm:text-xl font-extrabold text-[#0b1c30]">24 <span className="text-xs font-normal text-[#45464d]">quartos</span></p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-[#45464d] uppercase">Em Limpeza</span>
                    <p className="text-lg sm:text-xl font-extrabold text-[#FDB116]">03 <span className="text-xs font-normal text-[#45464d]">quartos</span></p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-xs">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-[#45464d] uppercase">Faturamento Hoje</span>
                    <p className="text-lg sm:text-xl font-extrabold text-[#006c49]">R$ 8.420 <span className="text-xs font-normal text-[#10b981]">100% Direto</span></p>
                  </div>
                </div>

                <div className="lg:col-span-8 bg-white p-4 rounded-xl border border-[#e2e8f0]">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#e2e8f0]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#006c49] text-lg">bed</span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#0b1c30]">Mapa Operacional de Ocupação</h4>
                    </div>
                    <div className="flex gap-1.5 text-[10px] sm:text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">Livre</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">Ocupado</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">Limpeza</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                    <div className="p-2.5 rounded-lg border-2 border-emerald-500 bg-emerald-50/50 flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-xs text-[#0b1c30]">Q-101</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">LIVRE</span>
                      </div>
                      <span className="text-[11px] text-gray-600">Luxo King</span>
                      <span className="text-xs font-bold text-[#006c49] mt-1">R$ 420/d</span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-xs text-[#0b1c30]">Q-102</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">OCUPADO</span>
                      </div>
                      <span className="text-[11px] text-gray-600">Família Duplo</span>
                      <span className="text-[10px] text-gray-500 mt-1">Check-out 12h</span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/40 flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-xs text-[#0b1c30]">Q-103</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">GOVERN.</span>
                      </div>
                      <span className="text-[11px] text-gray-600">Standard Vista</span>
                      <span className="text-[10px] text-gray-500 mt-1">Camareira Ana</span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-xs text-[#0b1c30]">Q-104</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">OCUPADO</span>
                      </div>
                      <span className="text-[11px] text-gray-600">Suíte Nupcial</span>
                      <span className="text-[10px] text-gray-500 mt-1">PIX Confirmado</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-[#e2e8f0] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-[#006c49] font-bold text-xs">
                      <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                      Fluxo WhatsApp Recente
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="p-2 rounded bg-emerald-50/70 border border-emerald-100">
                        <p className="font-bold text-[#0b1c30] text-[11px]">Reserva Direta Confirmada</p>
                        <p className="text-[10px] text-gray-600">Hóspede: Carlos M. • R$ 1.260 (PIX Instantâneo)</p>
                      </div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-100">
                        <p className="font-bold text-[#0b1c30] text-[11px]">Orçamento Respondido em 3s</p>
                        <p className="text-[10px] text-gray-600">Período: 14 a 17 Nov • Quarto Luxo King</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#e2e8f0] flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">Taxa OTA economizada:</span>
                    <span className="font-extrabold text-[#006c49]">+R$ 315,00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SMARTPHONE FLUTUANTE SIMULANDO WHATSAPP */}
            <div className="hidden sm:block absolute -right-2 -bottom-8 lg:-right-6 lg:-bottom-10 w-72 bg-[#0b1c30] p-2.5 rounded-[36px] shadow-2xl border-4 border-[#1e293b] z-20">
              <div className="bg-[#e5ddd5] rounded-[28px] overflow-hidden shadow-inner flex flex-col text-xs font-sans h-[360px]">
                <div className="bg-[#003400] text-white p-3 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    HZ
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate">Hotel no Zap</p>
                    <p className="text-[10px] text-emerald-300">Online • Resposta Imediata</p>
                  </div>
                  <span className="material-symbols-outlined text-sm text-white/80">more_vert</span>
                </div>

                <div className="flex-1 p-2.5 space-y-2 overflow-y-auto bg-[#efeae2]">
                  <div className="bg-white p-2 rounded-lg rounded-tl-none shadow-xs max-w-[85%]">
                    <p className="text-[11px] text-[#0b1c30]">Tem vaga para casal de 15 a 18 deste mês?</p>
                    <span className="text-[8px] text-gray-400 block text-right">14:32</span>
                  </div>

                  <div className="bg-[#dcf8c6] p-2.5 rounded-lg rounded-tr-none shadow-xs ml-auto max-w-[92%] border border-[#c3ebb2]">
                    <p className="font-bold text-[10px] text-[#003400] mb-1">🏨 Olá! Temos vagas disponíveis sim no Hotel Morada da Lua!</p>
                    <p className="text-[10px] text-gray-800 leading-tight mb-2">
                      É só acessar nosso link oficial abaixo e fazer sua reserva em minutos:
                    </p>
                    <a
                      href="https://hotelnozap.com.br/hoteis/hotelmoradalua"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white p-2 rounded-lg border border-emerald-300 shadow-xs hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="material-symbols-outlined text-xs text-[#006c49]">hotel</span>
                        <span className="text-[10px] font-black text-[#003400] truncate">Hotel Morada da Lua</span>
                      </div>
                      <p className="text-[9px] text-blue-700 underline truncate font-medium">
                        hotelnozap.com.br/hoteis/hotelmoradalua
                      </p>
                      <span className="block bg-[#10b981] text-white font-bold text-[9px] py-1 px-2 rounded mt-1.5 text-center shadow-xs">
                        Acessar e Fazer Reserva em Minutos →
                      </span>
                    </a>
                    <span className="text-[8px] text-gray-500 block text-right mt-1.5">14:32 • Resposta Imediata</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TRUST BAR */}
      <section className="py-10 lg:py-12 bg-white border-y border-[#e2e8f0]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#45464d] mb-6 sm:mb-8">
            Mais de {totalHoteis} hotéis, pousadas e resorts cadastrados no Hotel no Zap
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0]/80">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#003400] mb-1">R$ 4.2M+</p>
              <p className="text-xs sm:text-sm text-[#45464d] font-medium">Em diárias faturadas sem comissões</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0]/80">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#10b981] mb-1">98.4%</p>
              <p className="text-xs sm:text-sm text-[#45464d] font-medium">Taxa de resposta imediata no WhatsApp</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0]/80">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#006c49] mb-1">+42%</p>
              <p className="text-xs sm:text-sm text-[#45464d] font-medium">Aumento médio em reservas diretas</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0]/80">
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#FDB116] mb-1">4.9 / 5</p>
              <p className="text-xs sm:text-sm text-[#45464d] font-medium">Avaliação de satisfação dos hoteleiros</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMPARATIVO */}
      <section className="py-16 lg:py-24 bg-[#f8f9ff]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Diagnóstico Financeiro
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              O Custo Real de Ficar Preso a Intermediários e Atendimento Lento
            </h2>
            <p className="text-[#45464d] text-sm sm:text-base">
              Veja a diferença clara no seu faturamento quando você retoma o controle das suas vendas diretas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border-2 border-red-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500 text-white font-extrabold text-[10px] uppercase px-4 py-1 rounded-bl-xl tracking-wider">
                Modo Tradicional
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined">close</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-red-900">Sem o Hotel no Zap</h3>
                  <p className="text-xs text-red-600/80">Perda de margem e clientes desatendidos</p>
                </div>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-[#45464d]">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">cancel</span>
                  <span><strong>Comissões abusivas de até 25%</strong> fatiadas a cada diária por OTAs (Booking, Airbnb, Decolar).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">cancel</span>
                  <span><strong>Atendimento manual lento:</strong> o hóspede chama no WhatsApp, espera 40 minutos e fecha com o concorrente.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">cancel</span>
                  <span><strong>Planilhas desatualizadas e risco diário de overbooking</strong> por falhas na comunicação da recepção.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-lg shrink-0 mt-0.5">cancel</span>
                  <span><strong>Hóspede sem histórico de fidelidade:</strong> o cliente pertence à agência intermediária, não ao seu hotel.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border-2 border-[#10b981] p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-[#006c49] to-[#10b981] text-white font-extrabold text-[10px] uppercase px-4 py-1 rounded-bl-xl tracking-wider">
                Recomendado
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#006c49] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined">check_circle</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-[#003400]">Com o Hotel no Zap</h3>
                  <p className="text-xs text-[#006c49]">100% de lucro retido e atendimento 24/7</p>
                </div>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-[#0b1c30]">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#10b981] text-lg shrink-0 mt-0.5">verified</span>
                  <span><strong>0% de taxa por reserva:</strong> todo o valor pago pelo hóspede vai direto e limpo para sua conta bancária.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#10b981] text-lg shrink-0 mt-0.5">verified</span>
                  <span><strong>IA Concierge responde em até 5 segundos 24/7:</strong> envia orçamentos, fotos dos quartos e chave PIX automática.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#10b981] text-lg shrink-0 mt-0.5">verified</span>
                  <span><strong>Mapa de quartos unificado em tempo real:</strong> atualização automática ao confirmar a reserva, sem erro humano.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#10b981] text-lg shrink-0 mt-0.5">verified</span>
                  <span><strong>Histórico completo de hóspedes:</strong> consulte reservas anteriores, documentos e dados de contato de forma organizada e ágil.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4.1 COMO FUNCIONA EM 6 PASSOS SIMPLES */}
      <section className="py-16 lg:py-20 bg-white border-b border-[#e2e8f0]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Simplicidade Total
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              Como Colocar Seu Hotel no Piloto Automático em 6 Passos
            </h2>
            <p className="text-[#45464d] text-xs sm:text-sm sm:text-base">
              Sem instalações pesadas, sem necessidade de computador caro. Tudo pronto para operar em minutos.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-8 relative">
            {/* Passo 1 - Cadastre Quartos e Valores */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-[#006c49] text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md">
                    1
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs sm:text-sm">tune</span> 5 minutos
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold text-[#0b1c30] mb-1.5 sm:mb-2">
                  Cadastre Quartos e Valores
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-[#45464d] leading-snug sm:leading-relaxed">
                  Adicione seus tipos de acomodação (Luxo, Standard, Família) e valores com <strong>fotos 100% reais dos seus quartos</strong>. Imagens reais geram alta credibilidade e aceleram o fechamento imediato.
                </p>
              </div>
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#e2e8f0] text-[10px] sm:text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs sm:text-sm text-[#10b981]">photo_camera</span>
                <span>Fotos reais dos quartos</span>
              </div>
            </div>

            {/* Passo 2 - Cadastrar a Equipe de Atendimento */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-[#006c49] text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md">
                    2
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs sm:text-sm">badge</span> Equipe Unida
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold text-[#0b1c30] mb-1.5 sm:mb-2">
                  Cadastre Sua Equipe no Sistema
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-[#45464d] leading-snug sm:leading-relaxed">
                  Dê o acesso perfeito para quem faz seu hotel girar: <strong>Recepção, Camareiras, Governança, Gerência e Administradores</strong>. Cada setor com sua tela inteligente e zero confusão operacional.
                </p>
              </div>
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#e2e8f0] text-[10px] sm:text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs sm:text-sm text-[#10b981]">check_circle</span>
                <span>Acessos para toda a equipe</span>
              </div>
            </div>

            {/* Passo 3 - Divulgar o Seu Link */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-[#006c49] text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md">
                    3
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs sm:text-sm">share</span> Seu Link Web
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold text-[#0b1c30] mb-1.5 sm:mb-2">
                  Divulgue o Seu Link Exclusivo
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-[#45464d] leading-snug sm:leading-relaxed">
                  Coloque o link oficial do seu hotel na bio do Instagram, no perfil do Google Meu Negócio e nas suas redes. Seus clientes acessam, escolhem as datas e reservam diretamente com você.
                </p>
              </div>
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#e2e8f0] text-[10px] sm:text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs sm:text-sm text-[#10b981]">link</span>
                <span>Link direto no Instagram & Google</span>
              </div>
            </div>

            {/* Passo 4 - Conecte seu WhatsApp Oficial */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-[#003400] text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md">
                    4
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs sm:text-sm">qr_code_scanner</span> 30 segundos
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold text-[#0b1c30] mb-1.5 sm:mb-2">
                  Conecte seu WhatsApp Oficial
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-[#45464d] leading-snug sm:leading-relaxed">
                  Basta apontar a câmera do seu celular e ler o QR Code, exatamente como no WhatsApp Web. Seu número atual é 100% mantido e você não perde nenhuma conversa anterior.
                </p>
              </div>
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#e2e8f0] text-[10px] sm:text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs sm:text-sm text-[#10b981]">check_circle</span>
                <span>Sem troca de chip ou operadora</span>
              </div>
            </div>

            {/* Passo 5 - Acompanhar as Reservas pelo Sistema */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-[#006c49] text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md">
                    5
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs sm:text-sm">calendar_month</span> Gestão Total
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold text-[#0b1c30] mb-1.5 sm:mb-2">
                  Acompanhe as Reservas pelo Sistema
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-[#45464d] leading-snug sm:leading-relaxed">
                  Controle check-ins, check-outs, mapa de ocupação e financeiro em tempo real. Veja quais quartos estão limpos ou ocupados e acompanhe o faturamento do seu hotel na palma da mão.
                </p>
              </div>
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#e2e8f0] text-[10px] sm:text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs sm:text-sm text-[#10b981]">check_circle</span>
                <span>Mapa visual & governança ao vivo</span>
              </div>
            </div>

            {/* Passo 6 - Receba Reservas no PIX 24/7 */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border-2 border-[#10b981]/50 shadow-md hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#10b981] to-[#006c49] text-white flex items-center justify-center font-black text-base sm:text-xl shadow-md">
                    6
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs sm:text-sm text-amber-600">payments</span> 100% no seu bolso
                  </span>
                </div>
                <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold text-[#0b1c30] mb-1.5 sm:mb-2">
                  Receba Reservas no PIX 24/7
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-[#45464d] leading-snug sm:leading-relaxed">
                  O sistema atende, apresenta valores e gera a cobrança via PIX instantâneo. Ao pagar, o mapa de quartos atualiza sozinho e o voucher cai no Zap do hóspede com 0% de comissão retida.
                </p>
              </div>
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#e2e8f0] text-[10px] sm:text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs sm:text-sm text-[#10b981]">check_circle</span>
                <span>Zero comissão para intermediários</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BENTO GRID */}
      <section className="py-16 lg:py-24 bg-white" id="funcionalidades">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Ecossistema Integrado
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              Tudo o Que Seu Hotel Precisa em Uma Única Tela
            </h2>
            <p className="text-[#45464d] text-sm sm:text-base">
              Projetado especificamente para hoteleiros independentes que buscam eficiência máxima e operação enxuta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. MAPA DE QUARTOS */}
            <div className="md:col-span-2 bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#003400] to-[#006c49] text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">grid_view</span>
                </div>
                <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Gestão Visual PMS</span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Mapa de Quartos Dinâmico (Grid de Ocupação em Tempo Real)
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Visualize de relance todos os quartos livres, ocupados, em higienização ou manutenção. Altere status com facilidade, controle horários de check-in/check-out e integre diretamente com a governança.
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">Q-101<br /><span className="text-[10px] font-normal">Livre</span></div>
                <div className="p-2 rounded bg-blue-50 border border-blue-200 font-bold text-blue-800">Q-102<br /><span className="text-[10px] font-normal">Ocupado</span></div>
                <div className="p-2 rounded bg-blue-50 border border-blue-200 font-bold text-blue-800">Q-103<br /><span className="text-[10px] font-normal">Ocupado</span></div>
                <div className="p-2 rounded bg-amber-50 border border-amber-200 font-bold text-amber-800">Q-104<br /><span className="text-[10px] font-normal">Limpeza</span></div>
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">Q-105<br /><span className="text-[10px] font-normal">Livre</span></div>
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">Q-106<br /><span className="text-[10px] font-normal">Livre</span></div>
              </div>
            </div>

            {/* 2. MOTOR DE RESERVAS WHATSAPP */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all" id="motor-whatsapp">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#10b981] text-white flex items-center justify-center mb-4 shadow-md">
                  <span className="material-symbols-outlined text-2xl">chat</span>
                </div>
                <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Vendas Automatizadas</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Motor de Reservas no WhatsApp Oficial
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Disponibilize seu catálogo exclusivo com link direto, gere vouchers com QR Code e receba via PIX ou Cartão sem intermediários e com resposta em menos de 5 segundos.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] flex items-center justify-between text-xs font-semibold text-[#006c49]">
                <span>Confirmação instantânea no Zap</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </div>

            {/* 3. PAINEL DA CAMAREIRA / GOVERNANÇA */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">cleaning_services</span>
                </div>
                <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">Governança Ágil</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Painel Mobile da Camareira
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Sua equipe de limpeza acessa pelo smartphone sem precisar instalar apps pesados. Ao finalizar a faxina, a camareira atualiza para <strong>"Limpo"</strong> e a recepção é liberada instantaneamente para check-in antecipado.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#006c49] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">smartphone</span> Fim dos rádios e interfones barulhentos
              </div>
            </div>

            {/* 4. CADASTRO DE PRODUTOS E CONTROLE DE ESTOQUE */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">inventory_2</span>
                </div>
                <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Estoque & Frigobar</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Cadastro de Produtos e Controle de Estoque
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  O hotel tem total controle dos produtos cadastrados no frigobar, bebidas, petiscos e comodidades. Todos os produtos podem ser solicitados pelo hóspede diretamente da sua <strong>área exclusiva</strong> pelo celular, e o sistema já realiza de forma 100% automática o <strong>controle e baixa de estoque</strong>, integrando os lançamentos à conta do quarto.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#006c49] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">inventory</span> Baixa automática no estoque & pedidos via área exclusiva
              </div>
            </div>

            {/* 5. VITRINE PRÓPRIA & MOTOR WEB */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-600 to-blue-800 text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">language</span>
                </div>
                <span className="text-xs font-bold uppercase text-sky-700 tracking-wider">Presença Digital</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Página Própria do Hotel na Web
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Ganhe um link oficial exclusivo com fotos das suas suítes, mapa de comodidades e motor de reservas para colocar na bio do Instagram e Google Meu Negócio. Sem mensalidades para agências criarem sites.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#006c49] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">link</span> Seu link próprio com fotos e reservas
              </div>
            </div>

            {/* 6. FIDELIZAÇÃO DO HÓSPEDE (ÁREA EXCLUSIVA) */}
            <div className="bg-[#f8f9ff] rounded-2xl border-2 border-emerald-200/80 p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#006c49] text-white text-[10px] font-bold uppercase px-3 py-0.5 rounded-bl-xl tracking-wider">
                Exclusivo
              </div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#006c49] to-[#10b981] text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">loyalty</span>
                </div>
                <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Fidelização Total</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Fidelização do Hóspede & Área Exclusiva
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  O hóspede recebe uma <strong>página exclusiva</strong> para acompanhar suas reservas em tempo real. Uma vez que o mesmo fez uma reserva com o hotel, <strong>nunca mais ele entra em contato com a recepção</strong>: basta orientá-lo que quando quiser fazer outra reserva, é só acessar a área exclusiva dele, verificar as acomodações disponíveis e efetuar a nova reserva em segundos.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#006c49] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">verified</span> Recompra automática sem sobrecarregar a recepção
              </div>
            </div>

            {/* 7. CUPONS DE DESCONTO */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FDB116] to-amber-600 text-[#0b1c30] flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">sell</span>
                </div>
                <span className="text-xs font-bold uppercase text-amber-700 tracking-wider">Marketing Direto</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Cupons de Desconto Personalizados
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Crie cupons promocionais sob medida (ex: <strong>VERAO10</strong>, <strong>CLIENTEVIP</strong>, <strong>CARNAVAL</strong>) em porcentagem ou valor fixo, com limite de usos e datas de validade. <strong>Todos os cupons ficam disponíveis na área do hóspede, que pode utilizá-los a qualquer momento</strong> — a estratégia perfeita para incentivar reservas diretas e lotar o seu hotel o ano inteiro.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#006c49] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">local_offer</span> Cupons visíveis na área do hóspede para uso a qualquer momento
              </div>
            </div>

            {/* 8. FLUXO DE CAIXA & PDV */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0b1c30] to-[#1e293b] text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">point_of_sale</span>
                </div>
                <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Fluxo de Caixa</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Gestão Financeira & PDV Frigobar
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Contas a pagar e receber, fechamento de caixa diário por turno e lançamento instantâneo de consumo da recepção/frigobar diretamente na conta do quarto com conciliação bancária.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#45464d] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">receipt_long</span> Relatórios diários para o proprietário
              </div>
            </div>

            {/* 9. CENTRAL HISTÓRICO & BASE DE HÓSPEDES (SPAN 3) */}
            <div className="md:col-span-3 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 rounded-2xl border border-emerald-200 p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-lg transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse"></span>
                  <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Base de Dados & Organização</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30] mb-2">
                  Histórico Centralizado & Ficha Completa de Hóspedes
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Mantenha a base de dados organizada de todos os seus hóspedes, com histórico de estadias anteriores, dados de contato, documentos e preferências. Localize cadastros em segundos e proporcione um atendimento muito mais ágil, seguro e acolhedor.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs text-center">
                  <p className="text-lg font-black text-[#003400]">Histórico</p>
                  <p className="text-[11px] text-gray-500 font-medium">Estadias Anteriores</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs text-center">
                  <p className="text-lg font-black text-[#10b981]">LGPD</p>
                  <p className="text-[11px] text-gray-500 font-medium">Dados Seguros</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CALCULADORA */}
      <section className="py-16 lg:py-24 bg-[#f8f9ff]" id="calculadora">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-[#e2e8f0] shadow-xl overflow-hidden">
            <div className="p-6 sm:p-10 lg:p-12">
              <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
                <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
                  Simulador em Tempo Real
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0b1c30] mt-3 mb-2">
                  Quanto Dinheiro Seu Hotel Está Deixando na Mesa das OTAs?
                </h2>
                <p className="text-xs sm:text-sm text-[#45464d]">
                  Ajuste os controles abaixo para calcular quanto você economiza por mês cortando as taxas abusivas das agências online.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {/* 1. Quartos */}
                <div className="bg-[#f8f9ff] p-5 rounded-2xl border border-[#e2e8f0]">
                  <div className="flex justify-between items-center mb-3">
                    <label className="font-bold text-xs sm:text-sm text-[#0b1c30]">Número de Quartos:</label>
                    <span className="text-base sm:text-lg font-extrabold text-[#006c49] bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                      {roomsCount} quartos
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="1"
                    value={roomsCount}
                    onChange={(e) => setRoomsCount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#006c49]"
                  />
                  <div className="flex justify-between text-[11px] text-[#45464d] mt-2 font-medium">
                    <span>5 quartos</span>
                    <span>50 quartos</span>
                    <span>100 quartos</span>
                  </div>
                </div>

                {/* 2. Diária Média */}
                <div className="bg-[#f8f9ff] p-5 rounded-2xl border border-[#e2e8f0]">
                  <div className="flex justify-between items-center mb-3">
                    <label className="font-bold text-xs sm:text-sm text-[#0b1c30]">Diária Média (R$):</label>
                    <span className="text-base sm:text-lg font-extrabold text-[#006c49] bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                      R$ {dailyRate}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1200"
                    step="25"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#006c49]"
                  />
                  <div className="flex justify-between text-[11px] text-[#45464d] mt-2 font-medium">
                    <span>R$ 100</span>
                    <span>R$ 600</span>
                    <span>R$ 1.200</span>
                  </div>
                </div>

                {/* 3. Taxa de Ocupação */}
                <div className="bg-[#f8f9ff] p-5 rounded-2xl border border-[#e2e8f0]">
                  <div className="flex justify-between items-center mb-3">
                    <label className="font-bold text-xs sm:text-sm text-[#0b1c30]">Taxa de Ocupação:</label>
                    <span className="text-base sm:text-lg font-extrabold text-[#006c49] bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                      {occupancyRate}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={occupancyRate}
                    onChange={(e) => setOccupancyRate(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#006c49]"
                  />
                  <div className="flex justify-between text-[11px] text-[#45464d] mt-2 font-medium">
                    <span>20% (baixa)</span>
                    <span>60% (média)</span>
                    <span>100% (lotado)</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#003400] via-[#081a0b] to-[#000000] text-white rounded-2xl p-6 sm:p-8 text-center shadow-lg">
                <div className="max-w-xl mx-auto">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#6cf8bb]">
                    Economia Estimada em Comissões (20% Médio de OTAs)
                  </span>
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#FDB116] my-3">
                    R$ {Math.round(economiaMensal).toLocaleString('pt-BR')},00 <span className="text-sm sm:text-base font-semibold text-white/80">/ mês</span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed mb-6">
                    Com <strong className="text-[#6cf8bb]">{occupancyRate}% de ocupação</strong> ({totalDiariasMes} diárias/mês), seu faturamento bruto é de cerca de <strong>R$ {Math.round(faturamentoEstimado).toLocaleString('pt-BR')},00/mês</strong>. Sem o Hotel no Zap, você deixaria cerca de <strong className="text-[#FDB116]">R$ {Math.round(economiaAnual).toLocaleString('pt-BR')},00 por ano</strong> em comissões para intermediários. Esse lucro agora fica 100% no seu caixa!
                  </p>
                  <a
                    href="/lp/lpnovohotel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <span>Quero Reter 100% das Minhas Reservas</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PLANOS DINÂMICOS */}
      <section className="py-16 lg:py-24 bg-white" id="planos">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Preços Claros & Transparentes
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              Escolha o Plano Ideal para o Tamanho da sua Operação
            </h2>
            <p className="text-[#45464d] text-sm sm:text-base">
              Sem taxas sobre reservas, sem pegadinhas contratuais. Ativação imediata e sem fidelidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-6xl mx-auto">
            {displayPlanos.map((plano, idx) => {
              const formattedTitle = formatPlanTitle(plano.name, plano.periodicity, plano.cycleDiscount);
              const periodicitySuffix = getPeriodicitySuffix(plano.periodicity);
              const priceText = formatPrice(plano.basePrice);
              const theme = getPlanCardTheme(plano, idx);

              return (
                <div
                  key={plano.id}
                  className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all relative ${theme.containerClass}`}
                >
                  {plano.tag && plano.tag.trim() ? (
                    <div className={`absolute top-0 right-0 font-black text-[10px] uppercase px-4 py-1 rounded-bl-2xl tracking-wider shadow-xs ${
                      plano.isFeatured 
                        ? 'bg-[#FDB116] text-[#0b1c30]' 
                        : (theme.badgeClass || 'bg-[#006c49] text-white')
                    }`}>
                      ★ {plano.tag.replace(/^★\s*/, '').trim()}
                    </div>
                  ) : null}

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className={`text-[11px] uppercase tracking-wider ${theme.categoryClass}`}>
                          {plano.categoryLabel || 'Pousadas & Hotéis'}
                        </span>
                        <h3 className={`text-xl sm:text-2xl mt-1.5 ${theme.titleClass}`}>
                          {formattedTitle}
                        </h3>
                      </div>
                      <span className={`p-2.5 rounded-xl ${theme.iconBoxClass}`}>
                        <span className="material-symbols-outlined font-bold">
                          {plano.isFeatured ? 'star' : plano.roomLimit > 50 ? 'apartment' : 'hotel'}
                        </span>
                      </span>
                    </div>

                    <p className={`text-xs mb-6 min-h-[32px] ${theme.descClass}`}>
                      {plano.description}
                    </p>

                    <div className={`mb-6 pb-6 border-b ${theme.dividerClass}`}>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className={`text-3xl sm:text-4xl ${theme.priceClass}`}>
                          R$ {priceText}
                        </span>
                        <span className={`text-xs sm:text-sm ${theme.periodicityClass}`}>
                          {periodicitySuffix}
                        </span>
                      </div>
                    </div>

                    {(() => {
                      const allBenefits = buildPlanBenefits(plano);
                      const previewBenefits = allBenefits.slice(0, 6);

                      return (
                        <>
                          <ul className="space-y-2.5 text-xs mb-4 font-medium min-h-[175px]">
                            {previewBenefits.map((benefit, bIdx) => (
                              <li key={bIdx} className={`flex items-start gap-2 ${theme.featureItemClass}`}>
                                <span className={`material-symbols-outlined text-sm font-bold shrink-0 mt-0.5 ${theme.checkIconClass}`}>
                                  check_circle
                                </span>
                                <span className="leading-snug">{benefit}</span>
                              </li>
                            ))}
                          </ul>

                          <button
                            type="button"
                            onClick={() => setSelectedPlanForBenefits(plano)}
                            className={`w-full mb-6 py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${theme.benefitsBtnClass}`}
                          >
                            <span className="material-symbols-outlined text-sm">checklist</span>
                            <span>Ver todos os benefícios ({allBenefits.length})</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => handleOpenProspectModal(formattedTitle)}
                    className={`w-full text-center py-3.5 rounded-xl text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${theme.ctaBtnClass}`}
                  >
                    {plano.isFeatured ? 'Assinar Plano em Destaque' : `Assinar ${plano.name.replace(/\s*\([^)]*\)/g, '').trim()}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center justify-center gap-2.5 bg-emerald-50 border border-emerald-200/90 px-6 py-3.5 rounded-2xl shadow-xs">
              <span className="material-symbols-outlined text-[#006c49] text-xl shrink-0">verified_user</span>
              <p className="text-sm sm:text-base md:text-lg font-extrabold text-[#0b1c30] tracking-tight">
                Sem cobranças extras por mensagens • Cancele a qualquer momento sem multa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL: TODOS OS BENEFÍCIOS DO PLANO */}
      {selectedPlanForBenefits && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedPlanForBenefits(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPlanForBenefits(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fechar modal"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="border-b border-gray-100 pb-4 mb-4 pr-10">
              <span className="text-[11px] font-bold text-[#006c49] uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                Todos os Benefícios Inclusos
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-[#0b1c30] mt-2">
                {formatPlanTitle(selectedPlanForBenefits.name, selectedPlanForBenefits.periodicity, selectedPlanForBenefits.cycleDiscount)}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {selectedPlanForBenefits.description} • <strong className="text-[#006c49]">R$ {formatPrice(selectedPlanForBenefits.basePrice)} {getPeriodicitySuffix(selectedPlanForBenefits.periodicity)}</strong>
              </p>
            </div>

            <div className="overflow-y-auto pr-1 space-y-2.5 flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {buildPlanBenefits(selectedPlanForBenefits).map((benefit, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-[#0b1c30] font-medium"
                  >
                    <span className="material-symbols-outlined text-base font-bold shrink-0 text-[#10b981] mt-0.5">
                      check_circle
                    </span>
                    <span className="leading-snug">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 mt-4 flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setSelectedPlanForBenefits(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  const planToOpen = formatPlanTitle(selectedPlanForBenefits.name, selectedPlanForBenefits.periodicity, selectedPlanForBenefits.cycleDiscount);
                  setSelectedPlanForBenefits(null);
                  handleOpenProspectModal(planToOpen);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002000] text-white text-xs font-bold shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Quero Assinar Este Plano</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. DEPOIMENTOS */}
      <section className="py-16 lg:py-24 bg-[#f8f9ff]" id="depoimentos">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Histórias de Sucesso
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              Quem Usa o Hotel no Zap Não Volta Para o Método Antigo
            </h2>
            <p className="text-[#45464d] text-sm sm:text-base">
              Depoimentos de hoteleiros reais que recuperaram a autonomia financeira de suas propriedades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e2e8f0] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex text-[#FDB116] gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-sm">star</span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-[#0b1c30] leading-relaxed italic mb-6">
                  "Saímos de 30% para 78% de reservas diretas no primeiro mês usando a confirmação no WhatsApp. A economia mensal em comissões pagou o sistema do ano inteiro em apenas 15 dias!"
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#e2e8f0]">
                <div className="w-10 h-10 rounded-full bg-[#003400] text-[#6cf8bb] flex items-center justify-center font-bold text-sm">
                  ES
                </div>
                <div>
                  <p className="font-extrabold text-xs text-[#0b1c30]">Eduardo Silveira</p>
                  <p className="text-[11px] text-[#45464d]">Pousada Mar Azul • Fernando de Noronha</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e2e8f0] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex text-[#FDB116] gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-sm">star</span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-[#0b1c30] leading-relaxed italic mb-6">
                  "Eliminamos completamente o overbooking e a resposta automática fecha clientes enquanto durmo. O cliente clica no link, escolhe a suíte e o PIX cai direto na minha conta!"
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#e2e8f0]">
                <div className="w-10 h-10 rounded-full bg-[#006c49] text-white flex items-center justify-center font-bold text-sm">
                  CR
                </div>
                <div>
                  <p className="font-extrabold text-xs text-[#0b1c30]">Camila Rodrigues</p>
                  <p className="text-[11px] text-[#45464d]">Hotel Pampa Imperial • Gramado, RS</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e2e8f0] shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex text-[#FDB116] gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-sm">star</span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-[#0b1c30] leading-relaxed italic mb-6">
                  "A equipe da recepção e a camareira usam no celular sem nenhuma dificuldade. O suporte técnico é rápido e a ferramenta é muito mais simples que os PMS antigos pesados."
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#e2e8f0]">
                <div className="w-10 h-10 rounded-full bg-[#0b1c30] text-white flex items-center justify-center font-bold text-sm">
                  MV
                </div>
                <div>
                  <p className="font-extrabold text-xs text-[#0b1c30]">Marcos Vinícius</p>
                  <p className="text-[11px] text-[#45464d]">Pousada Recanto dos Corais • Maragogi, AL</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FAQ */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-[850px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Tire Suas Dúvidas
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              Perguntas Frequentes dos Hoteleiros
            </h2>
            <p className="text-[#45464d] text-sm sm:text-base">
              Tudo o que você precisa saber sobre a integração e o funcionamento do Hotel no Zap.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: 'Preciso trocar meu número atual de WhatsApp?',
                a: 'Não! Você continua utilizando exatamente o mesmo número comercial da sua recepção ou pousada. A conexão é realizada em menos de 1 minuto via leitura de QR Code, similar ao WhatsApp Web.'
              },
              {
                q: 'Como funciona a contratação e ativação do sistema?',
                a: 'Você escolhe o plano mais adequado para o tamanho da sua propriedade e preenche o cadastro. Nossa equipe auxilia você na ativação rápida para começar a receber reservas no WhatsApp imediatamente, sem fidelidade contratual.'
              },
              {
                q: 'Consigo importar meus hóspedes e dados antigos?',
                a: 'Sim! O Hotel no Zap possui importador automático em planilha Excel ou CSV. Nossa equipe de suporte também auxilia você na migração dos seus dados sem custo adicional.'
              },
              {
                q: 'Como recebo o dinheiro das reservas?',
                a: 'O valor cai diretamente na sua conta bancária. Quando o cliente paga via PIX ou cartão (integrado com Mercado Pago, Asaas ou sua adquirente favorita), o dinheiro é 100% seu. O Hotel no Zap cobra zero comissão sobre suas vendas.'
              },
              {
                q: 'Funciona no celular para mim e minha equipe?',
                a: '100% responsivo! A interface foi desenhada tanto para desktop quanto para padrão mobile com ergonomia para uma mão. Camareiras atualizam o status dos quartos do celular e o dono acompanha o faturamento em tempo real de qualquer lugar.'
              }
            ].map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-4 sm:p-5 transition-all">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex justify-between items-center text-left font-bold text-sm sm:text-base text-[#0b1c30] cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className={`material-symbols-outlined text-[#006c49] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                  {isOpen && (
                    <p className="text-xs sm:text-sm text-[#45464d] mt-3 leading-relaxed border-t border-[#e2e8f0] pt-3">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. BANNER FINAL CTA */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-[#003400] via-[#081a0b] to-[#000000] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.22),transparent_70%)] pointer-events-none"></div>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[#6cf8bb] font-bold text-xs mb-6">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
              Comece Hoje Mesmo • Ativação Imediata
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Pronto Para Encher Seus Quartos e Parar de Pagar Comissões Abusivas?
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-white/80 mb-8 max-w-2xl mx-auto leading-relaxed">
              Junte-se a centenas de proprietários de pousadas e hotéis que retomaram a autonomia do seu negócio e transformaram o WhatsApp no seu canal mais rentável.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <a
                href="/lp/lpnovohotel"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-extrabold text-sm sm:text-base px-8 py-4 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>Cadastrar Meu Hotel Agora</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </a>
              <a
                href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20o%20Hotel%20no%20Zap"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm sm:text-base px-6 py-4 rounded-xl backdrop-blur-sm border border-white/15 transition-all"
              >
                <span className="material-symbols-outlined text-xl text-[#6cf8bb]">chat</span>
                <span>Tirar Dúvidas com Especialista</span>
              </a>
            </div>
            <p className="text-xs text-white/60">
              ✓ Sem fidelidade contratual • Ativação imediata • Suporte humano dedicado
            </p>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-[#050c06] text-white/80 pt-16 pb-12 border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="mb-5">
                <a href="https://hotelnozap.com.br/" className="inline-block bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm hover:opacity-90 transition-opacity" title="Ir para a página inicial">
                  <img
                    src="/logo.png"
                    alt="Hotel no Zap - Hospitalidade Digital"
                    className="h-10 sm:h-12 md:h-14 w-auto object-contain"
                  />
                </a>
              </div>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed mb-6 max-w-sm">
                A inteligência que seu hotel precisa no canal que seu hóspede usa. Gestão operacional completa e motor de reservas diretas sem comissões.
              </p>
              <div className="text-xs text-white/40">
                © 2026 Hotel no Zap CNPJ: 53.422.578/0001-00<br />Todos os direitos reservados • Em conformidade com a LGPD.
              </div>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white mb-4">Produto</h4>
              <ul className="space-y-2.5 text-xs text-white/70">
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Mapa de Quartos (PMS)</a></li>
                <li><a href="#motor-whatsapp" className="hover:text-white transition-colors">Motor no WhatsApp</a></li>
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Painel da Camareira</a></li>
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Cardápio & Frigobar QR</a></li>
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Controle Financeiro</a></li>
                <li><a href="#planos" className="hover:text-white transition-colors">Tabela de Planos</a></li>
                <li><a href="#calculadora" className="hover:text-white transition-colors">Calculadora de Economia</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white mb-4">Empresa</h4>
              <ul className="space-y-2.5 text-xs text-white/70">
                <li><a href="/quem-somos" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Sobre Nós</a></li>
                <li><a href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20as%20novidades%20do%20Hotel%20no%20Zap" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Blog do Hoteleiro</a></li>
                <li><a href="/parceiros" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Programa de Parceiros & Indicadores</a></li>
                <li><a href="/termos" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Termos de Uso</a></li>
                <li><a href="/privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Política de Privacidade</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-white mb-4">Status & Suporte</h4>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
                <span>Todos os serviços operacionais</span>
              </div>
              <p className="text-xs text-white/60 mb-2">Central de Atendimento:</p>
              <a
                href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Gostaria%20de%20falar%20com%20o%20atendimento%20do%20Hotel%20no%20Zap"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#6cf8bb] hover:underline flex items-center gap-1.5 mb-2 font-semibold"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
                (66) 98158-5014 (WhatsApp)
              </a>
              <a
                href="mailto:hotelnozap@gmail.com"
                className="text-xs text-white/80 hover:text-white flex items-center gap-1.5 mb-2"
              >
                <span className="material-symbols-outlined text-sm text-gray-400">mail</span>
                hotelnozap@gmail.com
              </a>
              <span className="text-[11px] text-white/40 block">Segunda a Sábado, 08h às 20h</span>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <p>Desenvolvido para revolucionar a hotelaria independente no Brasil.</p>
            <div className="flex gap-4">
              <button onClick={onNavigateToLogin} className="hover:text-white transition-colors underline cursor-pointer">
                Acessar Sistema
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* 12. MODAL DE CADASTRO DO PROSPECTO */}
      {isProspectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#e2e8f0] relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsProspectModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {!prospectSuccess ? (
              <>
                <div className="mb-6">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#006c49] bg-[#10b981]/15 px-3 py-1 rounded-full">
                    🚀 Cadastre sua Propriedade
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-[#0b1c30] mt-2 mb-1">
                    Cadastre sua Propriedade
                  </h3>
                  <p className="text-xs text-gray-500">
                    Acesso imediato e ativação rápida para começar a receber reservas diretas.
                  </p>
                </div>

                <form onSubmit={handleRegisterProspect} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nome do Hotel ou Pousada *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Pousada Recanto do Sol"
                      value={prospectForm.hotelName}
                      onChange={(e) => setProspectForm({ ...prospectForm, hotelName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Seu Nome Completo (Proprietário/Gerente) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Roberto"
                      value={prospectForm.managerName}
                      onChange={(e) => setProspectForm({ ...prospectForm, managerName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        WhatsApp Comercial *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="(00) 00000-0000"
                        value={prospectForm.phone}
                        onChange={(e) => setProspectForm({ ...prospectForm, phone: formatPhone(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="contato@pousada.com"
                        value={prospectForm.email}
                        onChange={(e) => setProspectForm({ ...prospectForm, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Porto de Galinhas"
                        value={prospectForm.city}
                        onChange={(e) => setProspectForm({ ...prospectForm, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        UF
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="PE"
                        value={prospectForm.uf}
                        onChange={(e) => setProspectForm({ ...prospectForm, uf: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm uppercase text-center focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nº de Quartos Aproximado
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={prospectForm.capacity}
                        onChange={(e) => setProspectForm({ ...prospectForm, capacity: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Plano de Interesse
                      </label>
                      <select
                        value={selectedPlanForProspect}
                        onChange={(e) => setSelectedPlanForProspect(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                      >
                        {displayPlanos.map((p) => (
                          <option key={p.id} value={p.name}>
                            {formatPlanTitle(p.name, p.periodicity, p.cycleDiscount)} (R$ {formatPrice(p.basePrice)} {getPeriodicitySuffix(p.periodicity)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingProspect}
                      className="w-full py-4 rounded-xl bg-[#003400] hover:bg-[#002000] text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingProspect ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Cadastrando propriedade...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg text-[#6cf8bb]">rocket_launch</span>
                          <span>Cadastrar Minha Propriedade Agora</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-400 text-center">
                    🔒 Sem fidelidade, cancele a qualquer momento. Seus dados estão protegidos pela LGPD.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#006c49] flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <h3 className="text-2xl font-black text-[#0b1c30] mb-2">
                  🎉 Parabéns, {prospectForm.managerName || 'Hoteleiro'}!
                </h3>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  O cadastro de <strong>{prospectForm.hotelName}</strong> foi recebido com sucesso no plano <strong>{selectedPlanForProspect}</strong>!
                </p>

                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-left mb-6 text-xs text-emerald-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#10b981]">verified</span>
                    Status: Solicitação Recebida com Sucesso
                  </p>
                  <p>
                    Nossa equipe já preparou sua conexão. Clique abaixo para conectar seu WhatsApp imediatamente ou acesse o sistema:
                  </p>
                </div>

                <div className="space-y-3">
                  <a
                    href={`https://wa.me/5566981585014?text=Ol%C3%A1!%20Acabei%20de%20cadastrar%20o%20hotel%20${encodeURIComponent(prospectForm.hotelName)}%20no%20plano%20${encodeURIComponent(selectedPlanForProspect)}%20do%20Hotel%20no%20Zap.%20Meu%20WhatsApp%20%C3%A9%20${encodeURIComponent(prospectForm.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 rounded-xl bg-[#10b981] hover:bg-[#006c49] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">chat</span>
                    <span>Conectar meu WhatsApp Agora</span>
                  </a>

                  {onNavigateToNovoHotel && (
                    <button
                      onClick={() => {
                        setIsProspectModalOpen(false);
                        onNavigateToNovoHotel();
                      }}
                      className="w-full py-3 rounded-xl bg-[#003400] hover:bg-[#002000] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base text-[#6cf8bb]">domain_add</span>
                      <span>Configurar Meus Quartos Agora (2 min)</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsProspectModalOpen(false);
                      onNavigateToLogin();
                    }}
                    className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Ir para a Tela de Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 13. BOTÃO FLUTUANTE DE WHATSAPP (ALTA CONVERSÃO) */}
      <aside aria-label="Atendimento via WhatsApp" className="fixed bottom-6 right-6 z-40 flex items-center group">
        <a
          href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Estou%20no%20site%20do%20Hotel%20no%20Zap%20e%20gostaria%20de%20tirar%20algumas%20d%C3%BAvidas."
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-[#25D366] hover:bg-[#20ba59] text-white px-4 py-3.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-white/50 cursor-pointer"
          title="Fale conosco no WhatsApp (66) 98158-5014"
        >
          <div className="relative flex items-center justify-center">
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300"></span>
            </span>
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[11px] font-medium leading-none text-emerald-100">Atendimento Online</span>
            <span className="text-sm font-extrabold leading-tight">Falar no WhatsApp</span>
          </div>
        </a>
      </aside>
    </div>
  );
};
