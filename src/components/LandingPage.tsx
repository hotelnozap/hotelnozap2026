import React, { useState, useEffect, useMemo } from 'react';
import { planosService, hoteisService } from '../services/supabaseService';
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
  trialDays: number;
  roomLimit: number;
  whatsappConnections: number;
  isFeatured: boolean;
  features: string[];
  disabledFeatures: string[];
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToLogin, onNavigateToSystem, onNavigateToNovoHotel }) => {
  // Planos vindos do Supabase
  const [planos, setPlanos] = useState<PlanoView[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  // Calculadora de Economia
  const [roomsCount, setRoomsCount] = useState<number>(20);
  const [dailyRate, setDailyRate] = useState<number>(350);

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

  // Carregar planos da tabela 'planos' no Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchPlanos = async () => {
      try {
        setLoadingPlanos(true);
        const data = await planosService.getPlanos();
        if (data && data.length > 0 && isMounted) {
          // Filtrar planos ativos e comerciais (plano grátis do Google Maps não fica disponível)
          const activePlanos = data
            .filter((p: any) => p.status !== 'Inativo' && !p.name?.toLowerCase().includes('legado') && !p.name?.toLowerCase().includes('maps') && Number(p.basePrice) > 0)
            .map((p: any) => {
              let categoryLabel = 'Pousadas e Hotéis';
              if (p.name.toLowerCase().includes('starter')) categoryLabel = 'Pousadas Familiares';
              else if (p.name.toLowerCase().includes('pro')) categoryLabel = 'Hotéis de Médio Porte';
              else if (p.name.toLowerCase().includes('enterprise')) categoryLabel = 'Resorts & Redes';
              else if (p.name.toLowerCase().includes('free')) categoryLabel = 'Acesso Básico';

              return {
                id: p.id,
                name: p.name,
                tag: p.tag || (p.isFeatured ? 'Mais Vendido' : undefined),
                categoryLabel,
                description: p.description || 'Solução completa para gestão e motor de reservas via WhatsApp.',
                basePrice: Number(p.basePrice) || 0,
                trialDays: Number(p.trialDays) || 30,
                roomLimit: Number(p.roomLimit) || 10,
                whatsappConnections: Number(p.whatsappConnections) || 1,
                isFeatured: Boolean(p.isFeatured || p.name.toLowerCase().includes('professional')),
                features: Array.isArray(p.features) && p.features.length > 0 ? p.features : [
                  `Capacidade para até ${p.roomLimit || 10} quartos`,
                  `${p.whatsappConnections || 1} Conexão WhatsApp integrada`,
                  'Mapa de quartos e controle de check-in',
                  'Confirmação de reserva no WhatsApp'
                ],
                disabledFeatures: Array.isArray(p.disabledFeatures) ? p.disabledFeatures : []
              };
            });

          if (activePlanos.length > 0) {
            const commercial = activePlanos.filter((p: any) => !p.name.toLowerCase().includes('anual'));
            setPlanos(commercial.length > 0 ? commercial : activePlanos);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar planos na Landing Page:', err);
      } finally {
        if (isMounted) setLoadingPlanos(false);
      }
    };

    fetchPlanos();
    return () => { isMounted = false; };
  }, []);

  // Planos padrão de fallback se o banco estiver vazio ou offline
  const displayPlanos = useMemo(() => {
    if (planos.length > 0) return planos;
    return [
      {
        id: 'starter-default',
        name: 'Plano Starter',
        tag: 'Básico',
        categoryLabel: 'Pousadas Familiares',
        description: 'Ideal para pousadas e chalés que desejam automatizar as reservas pelo WhatsApp.',
        basePrice: 149,
        trialDays: 30,
        roomLimit: 10,
        whatsappConnections: 1,
        isFeatured: false,
        features: [
          'Capacidade para até 10 quartos',
          '1 Conexão WhatsApp oficial integrada',
          'Mapa de quartos e controle de check-in',
          'Confirmação de reserva no WhatsApp'
        ],
        disabledFeatures: ['Múltiplos atendentes simultâneos']
      },
      {
        id: 'pro-default',
        name: 'Plano Professional',
        tag: 'Mais Vendido',
        categoryLabel: 'Hotéis de Médio Porte',
        description: 'A solução completa para decolar ocupação com múltiplos atendentes e automação total.',
        basePrice: 299,
        trialDays: 30,
        roomLimit: 30,
        whatsappConnections: 2,
        isFeatured: true,
        features: [
          'Capacidade para até 30 quartos',
          '2 Conexões WhatsApp simultâneas',
          'Módulo governança & limpeza em tempo real',
          'Confirmação e voucher no WhatsApp',
          'Usuários ilimitados com permissões'
        ],
        disabledFeatures: []
      },
      {
        id: 'enterprise-default',
        name: 'Plano Enterprise',
        tag: 'Ilimitado',
        categoryLabel: 'Resorts & Redes',
        description: 'Máximo desempenho, suporte VIP e alta escala para operações hoteleiras robustas.',
        basePrice: 590,
        trialDays: 30,
        roomLimit: 150,
        whatsappConnections: 5,
        isFeatured: false,
        features: [
          'Até 150 quartos (sem sobretaxa)',
          '5 Conexões WhatsApp dedicadas',
          'IA de Atendimento 24/7 (Reserva Automática)',
          'Gerente de contas e onboarding dedicado',
          'Portal exclusivo de parceiros B2B'
        ],
        disabledFeatures: []
      }
    ];
  }, [planos]);

  // Cálculos do Simulador de Economia
  const { economiaMensal, economiaAnual } = useMemo(() => {
    const totalDiariasMes = roomsCount * 18;
    const faturamentoMes = totalDiariasMes * dailyRate;
    const economiaMes = faturamentoMes * 0.20;
    const economiaAno = economiaMes * 12;
    return {
      economiaMensal: economiaMes,
      economiaAnual: economiaAno
    };
  }, [roomsCount, dailyRate]);

  // Handler para navegar para o formulário de cadastro completo do hotel
  const handleOpenProspectModal = (_planName?: string) => {
    // Navegar para a página de cadastro multi-etapas /lp/lpnovohotel
    if (onNavigateToNovoHotel) {
      onNavigateToNovoHotel();
    } else {
      window.history.pushState({}, '', '/lp/lpnovohotel');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
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
        notes: `Prospecto cadastrado na Landing Page (/lp) em ${new Date().toLocaleDateString('pt-BR')}. Plano escolhido: ${selectedPlanForProspect}. Observações: ${prospectForm.notes}`,
        link: `/hoteis/${prospectForm.hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
      };

      const result = await hoteisService.createHotel(payload as any);
      if (result.success) {
        setProspectSuccess(true);
      } else {
        alert('Não foi possível registrar o teste grátis no momento. Tente novamente ou nos chame no WhatsApp.');
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
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* LOGO */}
          <a href="/lp" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003400] to-[#006c49] flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:scale-105 transition-transform">
              <span className="text-[#6cf8bb]">H</span>Z
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-lg text-[#0b1c30] flex items-center gap-1.5 leading-tight">
                HOTEL NO ZAP
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
                </span>
              </span>
              <span className="text-[10px] font-semibold text-[#45464d] tracking-widest uppercase">PMS & Direct Booking</span>
            </div>
          </a>

          {/* LINKS CENTRAIS (DESKTOP) */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-[#45464d]">
            <a href="#funcionalidades" className="hover:text-[#006c49] transition-colors">Funcionalidades</a>
            <a href="#motor-whatsapp" className="hover:text-[#006c49] transition-colors flex items-center gap-1">
              Motor WhatsApp
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#10b981]/15 text-[#006c49]">24/7</span>
            </a>
            <a href="#calculadora" className="hover:text-[#006c49] transition-colors">Calculadora de Economia</a>
            <a href="#planos" className="hover:text-[#006c49] transition-colors">Planos & Preços</a>
            <a href="#depoimentos" className="hover:text-[#006c49] transition-colors">Depoimentos</a>
          </nav>

          {/* AÇÕES À DIREITA */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onNavigateToLogin}
              className="hidden sm:inline-flex text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] px-3 py-2 transition-colors cursor-pointer"
            >
              Entrar no Sistema
            </button>
            <button
              onClick={() => handleOpenProspectModal('Plano Professional')}
              className="inline-flex items-center gap-2 bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-extrabold text-xs sm:text-sm px-3.5 sm:px-5 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Testar 30 Dias Grátis</span>
              <span className="material-symbols-outlined text-base font-bold">arrow_forward</span>
            </button>
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
              className="block text-sm font-semibold text-[#0b1c30] hover:text-[#006c49] py-1"
            >
              Motor WhatsApp (24/7)
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
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigateToLogin(); }}
                className="text-sm font-bold text-[#006c49]"
              >
                Acessar Login
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); handleOpenProspectModal('Plano Professional'); }}
                className="bg-[#003400] text-white text-xs font-bold px-3 py-1.5 rounded-lg"
              >
                Testar 30 Dias
              </button>
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <button
                onClick={() => handleOpenProspectModal('Plano Professional')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#003400] hover:bg-[#002000] text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl text-[#6cf8bb]">rocket_launch</span>
                <span>Iniciar Teste Gratuito de 30 Dias</span>
              </button>

              <a
                href="https://wa.me/5566981585014?text=Ol%C3%A1!%20Gostaria%20de%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20Hotel%20no%20Zap"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white hover:bg-[#f8f9ff] text-[#0b1c30] border border-[#e2e8f0] font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl shadow-sm transition-all hover:border-[#10b981]"
              >
                <span className="material-symbols-outlined text-xl text-[#10b981]">chat</span>
                <span>Ver Demonstração ao Vivo no Zap</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-[#45464d]">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981] font-bold">check_circle</span> Sem necessidade de cartão
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981] font-bold">check_circle</span> Configuração em 2 minutos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981] font-bold">check_circle</span> Suporte humano dedicado
              </span>
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
                    <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span> WhatsApp Conectado (Instância #01)
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
            Mais de 180+ hotéis, pousadas e resorts em todo o Brasil confiam no Hotel no Zap
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

      {/* 4.1 COMO FUNCIONA EM 3 PASSOS SIMPLES */}
      <section className="py-16 lg:py-20 bg-white border-b border-[#e2e8f0]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-[#006c49] bg-[#10b981]/10 px-3 py-1 rounded-full">
              Simplicidade Total
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0b1c30] mt-3 mb-4">
              Como Colocar Seu Hotel no Piloto Automático em 3 Passos
            </h2>
            <p className="text-[#45464d] text-sm sm:text-base">
              Sem instalações pesadas, sem necessidade de computador caro. Tudo pronto para operar em menos de 10 minutos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 relative">
            {/* Passo 1 */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-3xl p-6 sm:p-8 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#003400] to-[#006c49] text-white flex items-center justify-center font-black text-xl shadow-md">
                    1
                  </div>
                  <span className="text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">qr_code_scanner</span> 30 segundos
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] mb-2">
                  Conecte seu WhatsApp Oficial
                </h3>
                <p className="text-xs sm:text-sm text-[#45464d] leading-relaxed">
                  Basta apontar a câmera do seu celular e ler o QR Code, exatamente como no WhatsApp Web. Seu número atual é mantido e você não perde nenhuma conversa antiga.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">check_circle</span>
                <span>Sem troca de chip ou operadora</span>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-3xl p-6 sm:p-8 border border-[#e2e8f0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#006c49] text-white flex items-center justify-center font-black text-xl shadow-md">
                    2
                  </div>
                  <span className="text-xs font-bold text-[#006c49] bg-emerald-100/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">tune</span> 5 minutos
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] mb-2">
                  Cadastre Quartos e Valores
                </h3>
                <p className="text-xs sm:text-sm text-[#45464d] leading-relaxed">
                  Adicione seus tipos de acomodação (Luxo, Standard, Família), valores de diárias e fotos. O sistema gera automaticamente seu catálogo público e as regras de estadia.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">check_circle</span>
                <span>Importação simples de dados</span>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="relative z-10 bg-[#f8f9ff] rounded-3xl p-6 sm:p-8 border-2 border-[#10b981]/50 shadow-md hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#006c49] text-white flex items-center justify-center font-black text-xl shadow-md">
                    3
                  </div>
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-600">payments</span> 100% no seu bolso
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] mb-2">
                  Receba Reservas no PIX 24/7
                </h3>
                <p className="text-xs sm:text-sm text-[#45464d] leading-relaxed">
                  O sistema atende orçamentos em segundos, envia fotos, calcula diárias e gera o link de pagamento. Ao pagar, o mapa de quartos atualiza sozinho e o voucher cai no Zap do hóspede.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs font-semibold text-[#006c49] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">check_circle</span>
                <span>Zero comissão retida</span>
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

            {/* 4. CARDÁPIO DIGITAL & FRIGOBAR VIA QR CODE */}
            <div className="bg-[#f8f9ff] rounded-2xl border border-[#e2e8f0] p-6 lg:p-8 flex flex-col justify-between hover:shadow-lg transition-all">
              <div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white flex items-center justify-center mb-4 shadow-sm">
                  <span className="material-symbols-outlined text-2xl">restaurant_menu</span>
                </div>
                <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Receita Adicional</span>
                <h3 className="text-xl font-extrabold text-[#0b1c30] mt-1 mb-2">
                  Cardápio & Frigobar no Quarto via QR Code
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Coloque um display com QR Code na cabeceira da cama. O hóspede escolhe bebidas, petiscos e serviços pelo próprio celular. O pedido cai na cozinha/recepção e é lançado automaticamente na conta do quarto.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e2e8f0] text-xs text-[#006c49] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#10b981]">trending_up</span> +30% de aumento no consumo interno
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

            {/* 6. FLUXO DE CAIXA & PDV */}
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

            {/* 7. CADASTRO DE HÓSPEDES & MULTI-CONEXÕES WHATSAPP (SPAN 3) */}
            <div className="md:col-span-3 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 rounded-2xl border border-emerald-200 p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-lg transition-all">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse"></span>
                  <span className="text-xs font-bold uppercase text-[#006c49] tracking-wider">Histórico Centralizado & Multi-atendimento</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30] mb-2">
                  Histórico de Hóspedes, Cupons Promocionais & Múltiplas Conexões WhatsApp
                </h3>
                <p className="text-sm text-[#45464d] leading-relaxed">
                  Mantenha a base de dados organizada de todos os seus hóspedes, com histórico de estadias, documentos e preferências. Crie cupons de desconto exclusivos para campanhas de reservas diretas. Conecte múltiplos números de WhatsApp simultaneamente: Recepção, Comercial e Governança atendendo com rapidez e sem conflitos.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs text-center">
                  <p className="text-lg font-black text-[#003400]">Cupons</p>
                  <p className="text-[11px] text-gray-500 font-medium">Descontos Próprios</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs text-center">
                  <p className="text-lg font-black text-[#10b981]">Multi-Zap</p>
                  <p className="text-[11px] text-gray-500 font-medium">Recepção & Comercial</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                    Você está deixando cerca de <strong className="text-[#6cf8bb]">R$ {Math.round(economiaAnual).toLocaleString('pt-BR')},00 por ano</strong> nas mãos de intermediários. Com o <strong>Hotel no Zap</strong>, esse lucro fica 100% no caixa da sua propriedade.
                  </p>
                  <button
                    onClick={() => handleOpenProspectModal('Plano Professional')}
                    className="inline-flex items-center gap-2 bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <span>Quero Reter 100% das Minhas Reservas</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
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
            <p className="text-[#45464d] text-sm sm:text-base mb-8">
              Sem taxas sobre reservas, sem pegadinhas contratuais. Teste grátis por 30 dias.
            </p>

            <div className="inline-flex items-center p-1.5 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0]">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  billingPeriod === 'monthly'
                    ? 'bg-[#003400] text-white shadow-xs'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                Faturamento Mensal
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  billingPeriod === 'annual'
                    ? 'bg-[#003400] text-white shadow-xs'
                    : 'text-[#45464d] hover:text-[#0b1c30]'
                }`}
              >
                <span>Faturamento Anual</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FDB116] text-[#0b1c30]">
                  20% OFF
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-6xl mx-auto">
            {displayPlanos.map((plano) => {
              const displayedPrice = billingPeriod === 'annual'
                ? Math.round(plano.basePrice * 0.8)
                : plano.basePrice;

              return (
                <div
                  key={plano.id}
                  className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all relative ${
                    plano.isFeatured
                      ? 'bg-white border-2 border-[#FDB116] shadow-xl lg:-translate-y-2'
                      : 'bg-[#f8f9ff] border border-[#e2e8f0] hover:shadow-md'
                  }`}
                >
                  {plano.isFeatured && (
                    <div className="absolute top-0 right-0 bg-[#FDB116] text-[#0b1c30] font-black text-[10px] uppercase px-4 py-1 rounded-bl-2xl tracking-wider shadow-xs">
                      ★ Mais Escolhido
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[11px] font-bold text-[#006c49] uppercase tracking-wider">
                          {plano.categoryLabel || 'Pousadas & Hotéis'}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30] mt-0.5">
                          {plano.name}
                        </h3>
                      </div>
                      <span className={`p-2.5 rounded-xl ${plano.isFeatured ? 'bg-amber-50 text-[#FDB116]' : 'bg-white border border-[#e2e8f0] text-[#006c49]'}`}>
                        <span className="material-symbols-outlined font-bold">
                          {plano.isFeatured ? 'star' : plano.roomLimit > 50 ? 'apartment' : 'hotel'}
                        </span>
                      </span>
                    </div>

                    <p className="text-xs text-[#45464d] mb-6 min-h-[32px]">
                      {plano.description}
                    </p>

                    <div className="mb-6 pb-6 border-b border-[#e2e8f0]">
                      <span className="text-3xl sm:text-4xl font-black text-[#0b1c30]">
                        R$ {displayedPrice}
                      </span>
                      <span className="text-xs text-[#45464d] font-semibold ml-1">
                        {billingPeriod === 'annual' ? '/mês no anual' : '/mês'}
                      </span>
                    </div>

                    <ul className="space-y-3 text-xs text-[#0b1c30] mb-8 font-medium">
                      {plano.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="material-symbols-outlined text-sm font-bold shrink-0 mt-0.5 text-[#10b981]">
                            check_circle
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                      {plano.disabledFeatures.map((disabled, idx) => (
                        <li key={`dis-${idx}`} className="flex items-start gap-2.5 text-gray-400">
                          <span className="material-symbols-outlined text-sm text-gray-300 font-bold shrink-0 mt-0.5">
                            remove
                          </span>
                          <span>{disabled}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleOpenProspectModal(plano.name)}
                    className={`w-full text-center py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer ${
                      plano.isFeatured
                        ? 'bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] shadow-md hover:scale-[1.02]'
                        : 'border border-[#003400] text-[#003400] hover:bg-[#003400] hover:text-white'
                    }`}
                  >
                    {plano.isFeatured ? 'Testar Professional 30 Dias Grátis' : `Testar ${plano.name.replace('Plano ', '')} Grátis`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center text-xs text-[#45464d]">
            <p>💡 Quartos excedentes a partir de apenas R$ 2,50/adicional • Sem cobranças extras por mensagens • Cancele a qualquer momento sem multa.</p>
          </div>
        </div>
      </section>

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
                q: 'Como funciona o teste grátis de 30 dias?',
                a: 'Você tem acesso total e irrestrito a todas as funcionalidades do sistema, incluindo mapa de quartos, motor de reservas e automações durante os 30 dias de teste. Não pedimos cartão de crédito e você não assume nenhum compromisso para iniciar o teste.'
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
              Comece Hoje Mesmo • Configuração em 2 Minutos
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Pronto Para Encher Seus Quartos e Parar de Pagar Comissões Abusivas?
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-white/80 mb-8 max-w-2xl mx-auto leading-relaxed">
              Junte-se a centenas de proprietários de pousadas e hotéis que retomaram a autonomia do seu negócio e transformaram o WhatsApp no seu canal mais rentável.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
              <button
                onClick={() => handleOpenProspectModal('Plano Professional')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#FDB116] hover:bg-[#e59f10] text-[#0b1c30] font-extrabold text-sm sm:text-base px-8 py-4 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>Criar Minha Conta Grátis Agora</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
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
              ✓ 30 dias de garantia incondicional • Sem fidelidade contratual • Ativação imediata
            </p>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-[#050c06] text-white/80 pt-16 pb-12 border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#003400] to-[#006c49] flex items-center justify-center text-white font-extrabold text-base">
                  <span className="text-[#6cf8bb]">H</span>Z
                </div>
                <span className="font-extrabold text-lg text-white tracking-tight">HOTEL NO ZAP</span>
              </div>
              <p className="text-xs sm:text-sm text-white/60 leading-relaxed mb-6 max-w-sm">
                A inteligência que seu hotel precisa no canal que seu hóspede usa. Gestão operacional completa e motor de reservas diretas sem comissões.
              </p>
              <div className="text-xs text-white/40">
                © 2026 Hotel no Zap Tecnologia Hoteleira Ltda.<br />Todos os direitos reservados • Em conformidade com a LGPD.
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
                <li><a href="javascript:void(0)" className="hover:text-white transition-colors">Sobre Nós</a></li>
                <li><a href="javascript:void(0)" className="hover:text-white transition-colors">Blog do Hoteleiro</a></li>
                <li><a href="javascript:void(0)" className="hover:text-white transition-colors">Programa de Parceiros & Indicadores</a></li>
                <li><a href="javascript:void(0)" className="hover:text-white transition-colors">Termos de Uso</a></li>
                <li><a href="javascript:void(0)" className="hover:text-white transition-colors">Política de Privacidade</a></li>
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
                    🚀 Teste Grátis de 30 Dias
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-[#0b1c30] mt-2 mb-1">
                    Cadastre sua Propriedade
                  </h3>
                  <p className="text-xs text-gray-500">
                    Acesso imediato sem necessidade de cartão de crédito. Comece em menos de 2 minutos.
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
                            {p.name} (R$ {p.basePrice}/mês)
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
                          <span>Ativando seu teste...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg text-[#6cf8bb]">rocket_launch</span>
                          <span>Ativar Meu Teste de 30 Dias Grátis</span>
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
                    Status: Prospecto Ativado (Teste Grátis 30 Dias)
                  </p>
                  <p>
                    Nossa equipe já preparou sua instância. Clique abaixo para conectar seu WhatsApp imediatamente ou acesse o sistema:
                  </p>
                </div>

                <div className="space-y-3">
                  <a
                    href={`https://wa.me/5566981585014?text=Ol%C3%A1!%20Acabei%20de%20cadastrar%20o%20hotel%20${encodeURIComponent(prospectForm.hotelName)}%20no%20teste%20gr%C3%A1tis%20do%20Hotel%20no%20Zap.%20Meu%20WhatsApp%20%C3%A9%20${encodeURIComponent(prospectForm.phone)}`}
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
