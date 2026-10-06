import React, { useState } from 'react';
import { ZapHotelLogo } from './ZapHotelLogo';

interface LandingPageParceirosProps {
  onNavigateToLogin?: () => void;
  onNavigateToHome?: () => void;
  onNavigateToCheckout?: () => void;
}

export const LandingPageParceiros: React.FC<LandingPageParceirosProps> = ({
  onNavigateToLogin,
  onNavigateToHome,
  onNavigateToCheckout
}) => {
  // Simulador de Carteira Regional
  const [hotels, setHotels] = useState<number>(50);
  const commissionPerHotel = 98.50; // 50% de R$ 197,00
  const monthlyEarnings = hotels * commissionPerHotel;
  const annualEarnings = monthlyEarnings * 12;

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const handlePartnerBtnClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigateToCheckout) {
      onNavigateToCheckout();
    }
  };

  const faqs = [
    {
      pergunta: "Como funciona a Taxa de Franquia? Há cobrança de royalties ou taxas extras?",
      resposta: "A taxa de franquia é cobrada anualmente e é 100% livre de royalties mensais ou taxas escondidas. Você não repassa nenhum percentual sobre o seu faturamento para a matriz: 100% dos seus 50% de comissão são líquidos para você."
    },
    {
      pergunta: "Em quanto tempo consigo o Retorno do Investimento (ROI)?",
      resposta: "O retorno do investimento é imediato com apenas 2 hotéis indicados no plano mais básico (R$ 197/mês). Com 2 clientes ativos, a sua comissão recorrente anual já cobre o valor da licença da franquia. A partir do 3º hotel cadastrado, todo o faturamento recorrente é lucro líquido puro no seu bolso."
    },
    {
      pergunta: "Quem cuida da infraestrutura, servidores, IA e suporte técnico aos hotéis?",
      resposta: "Todo o operacional e suporte técnico é 100% por conta da matriz Hotel no Zap. Nós cuidamos de servidores em nuvem, atualizações do sistema, automação de IA para WhatsApp e atendimento de suporte aos hotéis. O franqueado não precisa entender de programação nem arcar com custos operacionais."
    },
    {
      pergunta: "Qual é o único trabalho e responsabilidade do Franqueado?",
      resposta: "O trabalho do franqueado consiste em prospectar estabelecimentos hoteleiros (hotéis, pousadas e resorts) na sua região e fornecer o acompanhamento e treinamento inicial para a equipe da recepção do cliente. Todo o pós-venda técnico fica com nossa matriz."
    },
    {
      pergunta: "Como e quando o Franqueado recebe seus repasses de comissão?",
      resposta: "Os repasses de 50% de comissão recorrente vitalícia são calculados mensalmente e transferidos diretamente via PIX para sua conta todo dia 05 útil de cada mês, com demonstrativo completo disponível no seu painel de franqueado."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-sans antialiased selection:bg-[#FDB116] selection:text-[#1b1b1b]">
      
      {/* ========================================================================= */}
      {/* 1. HEADER & BARRA DE NAVEGAÇÃO STICKY                                     */}
      {/* ========================================================================= */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-[#f8f9ff]/90 backdrop-blur-xl border-b border-slate-200 shadow-xs">
        <div className="h-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-4">
          
          {/* Logo & Identidade */}
          <div className="flex items-center gap-3">
            <a 
              href="https://hotelnozap.com.br/" 
              onClick={(e) => {
                if (onNavigateToHome) {
                  e.preventDefault();
                  onNavigateToHome();
                }
              }}
              className="flex items-center gap-2.5 group cursor-pointer hover:opacity-95 transition-opacity" 
              title="Ir para a página inicial"
            >
              <ZapHotelLogo size={38} className="group-hover:scale-105 transition-transform" />
              <div className="flex flex-col leading-none">
                <span className="font-extrabold text-base sm:text-lg text-[#0b1c30] tracking-tight">Hotel no Zap</span>
                <span className="text-[9px] text-[#006c49] font-bold uppercase tracking-wider mt-0.5">Franquia &amp; Revenda Oficial</span>
              </div>
            </a>
          </div>

          {/* Links Centrais (Desktop) */}
          <nav className="hidden xl:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#oportunidade" className="hover:text-[#003400] transition-colors py-1.5 px-2.5 rounded-lg">Oportunidade</a>
            <a href="#vantagens" className="hover:text-[#003400] transition-colors py-1.5 px-2.5 rounded-lg">Vantagens</a>
            <a href="#calculadora" className="hover:text-[#003400] transition-colors py-1.5 px-2.5 rounded-lg">Calculadora</a>
            <a href="#filtro-parceiro" className="hover:text-[#003400] transition-colors py-1.5 px-2.5 rounded-lg">Perfil</a>
            <a href="#faq" className="hover:text-[#003400] transition-colors py-1.5 px-2.5 rounded-lg">FAQ</a>
          </nav>

          {/* Ações Topo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                if (onNavigateToLogin) {
                  onNavigateToLogin();
                } else {
                  window.location.href = 'https://app.hotelnozap.com.br/';
                }
              }}
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-[#003400] px-2.5 sm:px-3 py-2 transition-colors cursor-pointer"
            >
              Entrar
            </button>
            <button
              onClick={handlePartnerBtnClick}
              className="inline-flex items-center justify-center font-bold text-xs sm:text-sm bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] px-4 sm:px-5 py-2.5 rounded-xl shadow-sm transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Seja um Franqueado
            </button>
            <div className="hidden sm:flex w-8 h-8 rounded-full bg-[#001c00] items-center justify-center text-white">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION - PITCH DA FRANQUIA                                       */}
      {/* ========================================================================= */}
      <section id="oportunidade" className="relative w-full bg-gradient-to-r from-[#001c00] via-[#003400] to-black text-white overflow-hidden">
        {/* Glows Decorativos */}
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[#6cf8bb]/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 bottom-0 w-80 h-80 rounded-full bg-[#FDB116]/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-14 sm:py-20 lg:py-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Lado Esquerdo: Pitch */}
            <div className="lg:col-span-7 flex flex-col gap-6 text-left">
              
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#6cf8bb]/15 text-[#6cf8bb] w-fit">
                  <span className="material-symbols-outlined text-[#6cf8bb] text-[18px]">verified</span>
                  <span className="text-[11px] tracking-wider uppercase font-semibold">Franquia Digital B2B • Taxa Anual Sem Royalties</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FDB116]/20 border border-[#FDB116]/40 text-[#FDB116] w-fit text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  <span>ROI com Apenas 2 Hotéis</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-3xl sm:text-4xl lg:text-[2.85rem] font-black tracking-tight text-white leading-tight">
                  Construa um império de receita recorrente com a Franquia Hotel no Zap na sua região.
                </h1>
                <p className="text-base sm:text-lg text-[#FDB116] font-semibold leading-snug">
                  50% de comissão recorrente vitalícia todo mês. Não é renda extra passageira — é o seu negócio de SaaS hoteleiro.
                </p>
              </div>

              <div className="flex flex-col gap-3 max-w-2xl text-slate-200">
                <p className="text-sm sm:text-base leading-relaxed">
                  O hoteleiro paga <strong className="text-white">R$ 197/mês</strong> pelo software e você recebe <strong className="text-[#6cf8bb] font-bold">R$ 98,50 líquido todo mês</strong> por hotel ativo. Com taxa de franquia cobrada <strong className="text-[#FDB116]">anualmente, 100% sem royalties mensais</strong> e sem taxas ocultas, bastam <strong className="text-white">2 hotéis indicados</strong> para pagar o investimento da sua licença anual e gerar lucro líquido puro a partir do 3º cliente!
                </p>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 flex items-start sm:items-center gap-3 text-white">
                  <span className="material-symbols-outlined text-[#FDB116] text-[22px] shrink-0 mt-0.5 sm:mt-0">check_circle</span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                    <strong className="text-white">Divisão Simples de Papéis:</strong> Nós assumimos todo o desenvolvimento, IA, servidores e suporte técnico aos hotéis. Seu único foco é prospectar hotéis na sua região e orientar o onboarding inicial.
                  </p>
                </div>
              </div>

              {/* Grid 3 Métricas Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                  <span className="block text-xl font-bold text-[#FDB116]">Sem Royalties</span>
                  <span className="text-[11px] text-slate-300">Taxa Anual Única • 100% Livre</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                  <span className="block text-xl font-bold text-[#6cf8bb]">R$ 98,50/mês</span>
                  <span className="text-[11px] text-slate-300">50% Líquido por Hotel Ativo</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                  <span className="block text-xl font-bold text-white">ROI com 2</span>
                  <span className="text-[11px] text-slate-300">Hotéis já Pagam o Investimento</span>
                </div>
              </div>

              {/* Botões CTA */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={handlePartnerBtnClick}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] text-sm sm:text-base font-bold shadow-lg shadow-[#FDB116]/20 transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  <span>Quero me Candidatar à Franquia Regional</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
                <a
                  href="#calculadora"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold transition-colors text-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">calculate</span>
                  <span>Simular Carteira de Clientes</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-2">
                <div className="flex items-center gap-1.5 text-[#6cf8bb]">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>Polos regionais com vagas limitadas</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="material-symbols-outlined text-[16px]">support_agent</span>
                  <span>Suporte técnico centralizado pelo Hotel no Zap</span>
                </div>
              </div>

            </div>

            {/* Lado Direito: Card Extrato Real do Franqueado */}
            <div className="lg:col-span-5 relative">
              <div className="relative w-full rounded-2xl bg-white p-6 shadow-2xl text-[#0b1c30]">
                
                {/* Header Card */}
                <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#003400] flex items-center justify-center text-[#6cf8bb]">
                      <span className="material-symbols-outlined text-[24px]">payments</span>
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm text-[#001c00] leading-tight">Extrato Real do Franqueado</span>
                      <span className="text-[11px] text-slate-500">Ciclo Recorrente de Direitos de Revenda</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    Status: Pago
                  </span>
                </div>

                {/* Big Stat */}
                <div className="p-5 rounded-xl bg-slate-50 my-5 flex flex-col gap-1 text-left border border-slate-200/60">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Repasse Mensal Atual</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl text-[#006c49] font-black">R$ 9.850,00</span>
                    <span className="text-xs text-slate-500 font-bold">/ mês</span>
                  </div>
                  <span className="text-xs text-slate-600 flex items-center gap-1 mt-1 font-medium">
                    <span className="material-symbols-outlined text-[#006c49] text-[16px]">trending_up</span>
                    Base: 100 Hotéis e Pousadas Ativos na Região
                  </span>
                </div>

                {/* Imagem Contexto */}
                <div className="relative w-full h-44 rounded-xl overflow-hidden mb-5 border border-slate-200">
                  <img
                    src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80"
                    alt="Hotelaria e Tecnologia"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3 text-white text-left">
                    <p className="text-[11px] font-medium leading-snug">
                      Hotel Boutique Atlântico • Ativo há 14 meses gerando R$ 98,50/mês para o franqueado
                    </p>
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-2.5 text-xs text-slate-700 text-left font-medium">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                    <span>Taxa anual sem royalties e sem cobranças extras</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                    <span>Todo o operacional, IA e suporte técnico é por nossa conta</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                    <span>ROI imediato com apenas 2 hotéis ativos no plano básico</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                    <span>Repasse mensal vitalício garantido todo dia 05 via PIX</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. TRANSPARÊNCIA: FRANQUIA ANUAL SEM ROYALTIES                            */}
      {/* ========================================================================= */}
      <section className="w-full bg-[#e6eeff] py-12 px-4 sm:px-6 lg:px-12 border-b border-slate-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 p-6 sm:p-8 rounded-2xl bg-white shadow-sm border border-slate-200">
          <div className="flex items-start gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-[#2b2b2b] shrink-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#FDB116] text-[28px]">verified</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base sm:text-lg text-[#0b1c30] font-bold">Franquia Anual sem Royalties &amp; Operacional Centralizado</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">100% Transparente</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                A taxa de franquia é cobrada anualmente, 100% livre de royalties mensais ou percentuais sobre seus repasses. A matriz Hotel no Zap assume todo o desenvolvimento, IA, servidores e suporte operacional aos hotéis. O <strong>único trabalho do franqueado</strong> é prospectar novos hotéis e pousadas e acompanhar o treinamento inicial dos seus clientes.
              </p>
            </div>
          </div>
          <button
            onClick={handlePartnerBtnClick}
            className="shrink-0 px-5 py-3 rounded-xl bg-[#e6eeff] hover:bg-[#d3e3ff] text-[#0b1c30] font-bold text-xs sm:text-sm transition-colors text-center cursor-pointer whitespace-nowrap"
          >
            Quero me Credenciar
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. POR QUE VENDE TÃO FÁCIL: 3 DORES X 3 SOLUÇÕES                         */}
      {/* ========================================================================= */}
      <section id="vantagens" className="w-full bg-[#f8f9ff] py-16 sm:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-14">
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 text-left">
            <div className="max-w-2xl flex flex-col gap-2">
              <span className="text-[11px] text-[#006c49] font-bold tracking-widest uppercase">Por que vende tão fácil</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#0b1c30] font-black tracking-tight leading-tight">
                O software que se paga com apenas 2 diárias recuperadas.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-1">
                Hotéis e pousadas independentes sangram faturamento todos os dias com comissões desumanas de agências online e demora no WhatsApp. O Hotel no Zap resolve o problema central do negócio deles por uma fração do prejuízo diário.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#eff4ff] max-w-sm flex flex-col gap-2 border border-[#006c49]/20 shadow-xs">
              <div className="flex items-center gap-2 text-[#006c49]">
                <span className="material-symbols-outlined text-[20px]">savings</span>
                <span className="text-xs font-bold uppercase tracking-wider">Retorno do Investimento (ROI)</span>
              </div>
              <span className="text-sm font-bold text-[#0b1c30] leading-tight">Retorno com apenas 2 Hotéis Indicados</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Indicando apenas 2 hotéis no plano mais barato de R$ 197/mês, os seus R$ 197,00/mês de comissão vitalícia já cobrem e superam o custo da taxa de franquia anual. Do 3º cliente em diante, é lucro recorrente líquido no seu bolso!
              </p>
            </div>
          </div>

          {/* Grid 3 Dores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            
            {/* Card 1 */}
            <div className="flex flex-col rounded-2xl bg-white p-6 sm:p-8 shadow-sm justify-between gap-6 border border-slate-200/80 text-left hover:-translate-y-1 transition-all duration-200">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-black uppercase tracking-wider">
                    Dor Crítica 01
                  </span>
                  <span className="material-symbols-outlined text-red-600 text-[24px]">trending_down</span>
                </div>
                <h3 className="text-lg font-bold text-[#0b1c30]">20% a 25% de taxa pras OTAs</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  O dono do hotel trabalha o mês inteiro para entregar 1/4 da sua receita líquida para Booking, Decolar e Airbnb.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[#006c49] font-bold text-xs sm:text-sm">
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  <span>A Sua Solução com o Hotel no Zap</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Motor de reservas direto integrado ao WhatsApp. O hóspede fecha por mensagem com tarifário dinâmico e sem intermediários.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="flex flex-col rounded-2xl bg-white p-6 sm:p-8 shadow-sm justify-between gap-6 border border-slate-200/80 text-left hover:-translate-y-1 transition-all duration-200">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-black uppercase tracking-wider">
                    Dor Crítica 02
                  </span>
                  <span className="material-symbols-outlined text-red-600 text-[24px]">timer_off</span>
                </div>
                <h3 className="text-lg font-bold text-[#0b1c30]">Demora no WhatsApp</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  O viajante pede cotação às 21h, a recepção só responde no dia seguinte às 9h e o hóspede já fechou com o concorrente.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[#006c49] font-bold text-xs sm:text-sm">
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  <span>A Sua Solução com o Hotel no Zap</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  IA de atendimento especializada em hospitalidade que envia cotações personalizadas, fotos dos quartos e chave PIX em 5 segundos 24/7.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="flex flex-col rounded-2xl bg-white p-6 sm:p-8 shadow-sm justify-between gap-6 border border-slate-200/80 text-left hover:-translate-y-1 transition-all duration-200">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-black uppercase tracking-wider">
                    Dor Crítica 03
                  </span>
                  <span className="material-symbols-outlined text-red-600 text-[24px]">table_rows</span>
                </div>
                <h3 className="text-lg font-bold text-[#0b1c30]">Overbooking e Caos</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Planilhas do Excel desatualizadas, reservas duplicadas em feriados prolongados e perda de controle da governança.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[#006c49] font-bold text-xs sm:text-sm">
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  <span>A Sua Solução com o Hotel no Zap</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  PMS hoteleiro intuitivo com mapa visual de apartamentos, controle de camareiras e sincronização de calendário instantânea.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. CALCULADORA INTERATIVA DA FRANQUIA                                     */}
      {/* ========================================================================= */}
      <section id="calculadora" className="w-full bg-[#003400] text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-12 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-[#6cf8bb]/10 to-transparent pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-10">
          
          <div className="text-center max-w-3xl mx-auto flex flex-col gap-2">
            <span className="text-[11px] text-[#FDB116] uppercase tracking-widest font-bold">Simulador Interativo da Franquia</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-white font-black tracking-tight">
              Quanto você quer faturar todos os meses com sua Franquia Hotel no Zap?
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Arraste a barra para simular seus ganhos recorrentes vitalícios baseados na comissão de 50% por assinatura (R$ 98,50 por mês por hotel ativado de R$ 197/mês).
            </p>
          </div>

          <div className="w-full rounded-3xl bg-black/40 backdrop-blur-xl p-6 sm:p-10 lg:p-12 shadow-2xl flex flex-col lg:flex-row gap-10 items-center border border-white/10">
            
            {/* Controles */}
            <div className="w-full lg:w-3/5 flex flex-col gap-6 text-left">
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm sm:text-base text-white font-bold" htmlFor="hotelSlider">
                    Número de Hotéis Ativos:
                  </label>
                  <div className="px-4 py-1.5 rounded-xl bg-[#6cf8bb]/20 text-[#6cf8bb] font-black text-lg">
                    {hotels} hotéis
                  </div>
                </div>

                <input
                  id="hotelSlider"
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={hotels}
                  onChange={(e) => setHotels(Number(e.target.value))}
                  className="w-full h-3 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#FDB116]"
                />

                <div className="flex justify-between text-[11px] text-slate-300 font-semibold">
                  <span>5 hotéis (Início)</span>
                  <span>50 hotéis</span>
                  <span>100 hotéis</span>
                  <span>200 hotéis (Líder Regional)</span>
                </div>
              </div>

              {/* Cenários Rápidos */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-300 font-bold mr-1">Cenários Prontos:</span>
                {[10, 30, 50, 100, 200].map((val) => (
                  <button
                    key={val}
                    onClick={() => setHotels(val)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      hotels === val ? 'bg-[#FDB116] text-[#1b1b1b]' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {val} Hotéis
                  </button>
                ))}
              </div>

              {/* Contexto */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs text-slate-300">
                <span className="material-symbols-outlined text-[#FDB116] text-[20px] shrink-0 mt-0.5">info</span>
                <div className="space-y-1">
                  <p><strong className="text-[#FDB116]">Retorno com Apenas 2 Hotéis:</strong> Ao credenciar apenas 2 hotéis (R$ 197/mês de comissão), você já recupera todo o valor da taxa de franquia anual.</p>
                  <p>Nossa taxa é anual e <strong>100% sem royalties mensais</strong> ou cobranças extras. Todo o suporte técnico aos hotéis é mantido por nossa conta!</p>
                </div>
              </div>

            </div>

            {/* Resultado Bento */}
            <div className="w-full lg:w-2/5 flex flex-col gap-5 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#003400] to-black border border-white/10 shadow-inner text-left">
              
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Seu Ganho Mensal Recorrente</span>
                <div className="flex items-baseline gap-1 text-[#FDB116]">
                  <span className="text-3xl sm:text-4xl font-black">
                    {monthlyEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <span className="text-xs text-white font-bold">/mês</span>
                </div>
                <span className="text-xs text-[#6cf8bb] flex items-center gap-1 mt-1 font-semibold">
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                  Depositado direto no seu PIX todo dia 05
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1">
                <span className="text-[10px] text-slate-300 uppercase tracking-wider font-bold">Faturamento Anual Acumulado</span>
                <span className="text-xl font-black text-white">
                  {annualEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-[11px] text-slate-400">Projeção considerando 12 meses de repasses da licença com retenção hoteleira.</span>
              </div>

              <button
                onClick={handlePartnerBtnClick}
                className="w-full py-4 rounded-xl bg-[#FDB116] hover:bg-[#e09c0f] text-[#1b1b1b] text-sm font-bold text-center shadow-lg transition-all duration-200 active:scale-95 cursor-pointer"
              >
                Construir Minha Carteira Regional
              </button>

            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. PERFIL DO FRANQUEADO REGIONAL                                          */}
      {/* ========================================================================= */}
      <section id="filtro-parceiro" className="w-full bg-[#eff4ff] py-16 sm:py-24 px-4 sm:px-6 lg:px-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex flex-col gap-12 text-left">
          
          <div className="max-w-3xl flex flex-col gap-2">
            <span className="text-[11px] text-[#006c49] font-bold tracking-widest uppercase">Processo de Qualificação</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#0b1c30] font-black tracking-tight leading-tight">
              O perfil do franqueado que buscamos para cada polo turístico.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Nós oferecemos 50% de sociedade na receita recorrente de cada cliente. Por isso, somos extremamente seletivos com quem representará o Hotel no Zap perante a rede hoteleira de cada região.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Quem Buscamos */}
            <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm flex flex-col gap-5 border border-slate-200">
              <div className="flex items-center gap-3 text-[#006c49]">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">verified</span>
                </div>
                <h3 className="text-lg font-bold text-[#0b1c30]">Quem Estamos Buscando</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#006c49] text-[22px] shrink-0 mt-0.5">check_circle</span>
                  <div className="flex flex-col">
                    <strong className="text-sm font-bold text-[#0b1c30]">Executivos e Representantes Comerciais B2B</strong>
                    <span className="text-xs text-slate-600 leading-relaxed">Profissionais com postura consultiva acostumados a negociar com gerentes gerais, proprietários e tomadores de decisão.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#006c49] text-[22px] shrink-0 mt-0.5">check_circle</span>
                  <div className="flex flex-col">
                    <strong className="text-sm font-bold text-[#0b1c30]">Agências Locais &amp; Consultores de Turismo</strong>
                    <span className="text-xs text-slate-600 leading-relaxed">Quem já atende meios de hospedagem com marketing, tráfego ou consultoria e quer expandir o portfólio com um SaaS indispensável.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#006c49] text-[22px] shrink-0 mt-0.5">check_circle</span>
                  <div className="flex flex-col">
                    <strong className="text-sm font-bold text-[#0b1c30]">Empreendedores com Visão de Longo Prazo</strong>
                    <span className="text-xs text-slate-600 leading-relaxed">Quem entende que construir uma carteira de 100 hotéis gera R$ 9.850/mês para o resto da vida sem precisar programar software.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quem Não Deve */}
            <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-sm flex flex-col gap-5 border border-slate-200">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">block</span>
                </div>
                <h3 className="text-lg font-bold text-[#0b1c30]">Quem NÃO Deve se Candidatar</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-[22px] shrink-0 mt-0.5">cancel</span>
                  <div className="flex flex-col">
                    <strong className="text-sm font-bold text-[#0b1c30]">Buscadores de Fórmulas Mágicas na Internet</strong>
                    <span className="text-xs text-slate-600 leading-relaxed">Quem acredita em ganhos sem trabalho comercial sério, sem reuniões de apresentação e sem disciplina de prospecção regional.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-[22px] shrink-0 mt-0.5">cancel</span>
                  <div className="flex flex-col">
                    <strong className="text-sm font-bold text-[#0b1c30]">Quem desiste nos Primeiros Obstáculos</strong>
                    <span className="text-xs text-slate-600 leading-relaxed">Venda consultiva B2B exige follow-up, paciência de negociação e resiliência para quebrar hábitos de hoteleiros tradicionais.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 text-[22px] shrink-0 mt-0.5">cancel</span>
                  <div className="flex flex-col">
                    <strong className="text-sm font-bold text-[#0b1c30]">Quem tem medo de conversar com empresários</strong>
                    <span className="text-xs text-slate-600 leading-relaxed">Se você não se sente confortável em ligar para pousadas ou tomar café com o gerente geral, este modelo de franquia não é para você.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. O QUE ESTÁ INCLUSO NA FRANQUIA                                         */}
      {/* ========================================================================= */}
      <section className="w-full bg-[#f8f9ff] py-16 sm:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col gap-14">
          
          <div className="text-center max-w-3xl mx-auto flex flex-col gap-2">
            <span className="text-[11px] text-[#006c49] uppercase tracking-widest font-bold">O Que Está Incluso na Franquia</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#0b1c30] font-black tracking-tight leading-tight">
              Nós entregamos a estrutura completa. Você entra com as conexões comerciais.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Você não precisa programar uma única linha de código ou contratar equipe técnica. O Hotel no Zap entrega o ecossistema pronto para sua revenda faturar imediatamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#003400] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">link</span>
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Link Exclusivo de Credenciamento</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Rastreamento de ponta com vinculação definitiva ao CNPJ do hotel cadastrado. Mesmo se o estabelecimento ativar semanas depois, os 50% de receita recorrente são creditados à sua franquia.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#003400] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">dashboard</span>
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Painel Executivo em Tempo Real</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Acompanhe hotéis em fase de teste, faturas pagas no ciclo, retenção de carteira e saldo acumulado com relatórios completos para gestão de receitas.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#003400] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">folder_special</span>
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Material Comercial Pronto e Validado</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Decks de apresentação em PDF para reuniões presenciais, scripts de abordagem por WhatsApp, comparativos de ROI contra OTAs e vídeos institucionais prontos para envio.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#003400] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">school</span>
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Treinamento em Vendas Hoteleiras</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aprenda a falar a linguagem dos donos e gestores de pousadas, entenda as métricas fundamentais da hotelaria (RevPAR, ADR, Diária Média) e saiba fechar contratos em poucos passos.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#003400] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">groups</span>
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Acesso Direto aos Fundadores</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Canal fechado e prioritário no WhatsApp diretamente com os líderes do Hotel no Zap para auxílio em negociações estratégicas de grande porte com redes ou resorts.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#003400] text-[#6cf8bb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[26px]">support_agent</span>
              </div>
              <h3 className="text-base font-bold text-[#0b1c30]">Suporte Técnico Centralizado</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Toda a ativação de API do WhatsApp, configuração de IA, treinamento das recepcionistas e suporte a dúvidas diárias é assumido integralmente pela nossa equipe técnica central.
              </p>
            </div>

          </div>

          {/* Banner Fotográfico Contexto */}
          <div className="w-full rounded-2xl overflow-hidden shadow-md relative border border-slate-200">
            <img
              src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&auto=format&fit=crop&q=80"
              alt="Hotelaria de Sucesso"
              className="w-full h-64 sm:h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#001c00]/90 via-[#001c00]/70 to-transparent flex items-center p-6 sm:p-12 text-left text-white">
              <div className="max-w-xl flex flex-col gap-3">
                <span className="px-3.5 py-1 rounded-full bg-[#FDB116] text-[#1b1b1b] text-[10px] font-bold w-fit uppercase">
                  Escalabilidade Pura
                </span>
                <span className="text-xl sm:text-3xl font-black leading-tight">
                  Seu papel é conectar o mercado. A tecnologia do Hotel no Zap entrega o valor.
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Enquanto você aproveita seu tempo, os hotéis da sua carteira continuam fechando diárias pelo WhatsApp e sua comissão recorrente de R$ 98,50 por hotel cai rigorosamente todo mês.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FAQ: DÚVIDAS FREQUENTES                                               */}
      {/* ========================================================================= */}
      <section id="faq" className="w-full bg-[#eff4ff] py-16 sm:py-24 px-4 sm:px-6 lg:px-12 border-t border-slate-200">
        <div className="max-w-4xl mx-auto flex flex-col gap-10">
          
          <div className="text-center flex flex-col gap-2">
            <span className="text-[11px] text-[#006c49] uppercase tracking-widest font-bold">Perguntas Frequentes</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-[#0b1c30] font-black tracking-tight">
              Dúvidas Frequentes sobre a Franquia &amp; Revenda Oficial
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Transparência total nas regras do modelo de franquia para uma parceria de longo prazo.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-left">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-xl bg-white p-5 shadow-xs border border-slate-200/80 transition-all">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-[#0b1c30] hover:text-[#006c49] transition-colors cursor-pointer gap-4"
                >
                  <span>{faq.pergunta}</span>
                  <span className={`material-symbols-outlined text-[#006c49] transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {openFaq === idx && (
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-3 border-t border-slate-100 mt-3">
                    {faq.resposta}
                  </p>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. CAPTURA / CANDIDATURA OFICIAL                                         */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 9. CAPTURA / CANDIDATURA OFICIAL & PACOTE DE BENEFÍCIOS                   */}
      {/* ========================================================================= */}
      <section id="candidatura" className="w-full bg-[#f8f9ff] py-16 sm:py-24 px-4 sm:px-6 lg:px-12">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden">
          
          {/* Header Superior com Gradiente Suave */}
          <div className="bg-gradient-to-br from-[#003400] via-[#004d00] to-[#006c49] p-8 sm:p-12 text-white text-center relative overflow-hidden">
            {/* Elementos Decorativos de Fundo */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#FDB116]/10 rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-[#FDB116] text-[11px] font-extrabold uppercase tracking-widest border border-white/10 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Franquia Oficial &amp; Revenda Regional</span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight max-w-2xl text-white">
                Pronto para Construir sua Carteira Recorrente na Hotelaria?
              </h2>

              <p className="text-xs sm:text-sm md:text-base text-emerald-100/90 max-w-xl leading-relaxed">
                Junte-se à rede oficial do Hotel no Zap e tenha seu próprio negócio escalável de tecnologia com suporte integral da nossa matriz.
              </p>

              {/* Bloco de Preço em Destaque */}
              <div className="mt-4 pt-4 border-t border-white/15 w-full max-w-lg flex flex-col items-center">
                <span className="text-[11px] uppercase tracking-wider font-bold text-white/80">
                  Taxa Única de Licenciamento &amp; Acesso Anual
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm sm:text-base font-semibold text-white/70">R$</span>
                  <span className="text-4xl sm:text-5xl md:text-6xl font-black text-[#FDB116] tracking-tight">197,00</span>
                  <span className="text-xs sm:text-sm font-semibold text-emerald-100">/ ano</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-200">
                  <span className="material-symbols-outlined text-[15px]">savings</span>
                  <span>Pagamento anual único • Retorno garantido a partir de apenas 2 hotéis</span>
                </div>
              </div>
            </div>
          </div>

          {/* Corpo do Card: Grade de Benefícios Exclusivos */}
          <div className="p-6 sm:p-10 lg:p-12 bg-white flex flex-col gap-8">
            <div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-6 pb-3 border-b border-slate-100">
                <h3 className="text-base sm:text-lg font-black text-[#0b1c30] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[22px]">workspace_premium</span>
                  Benefícios Inclusos na Sua Franquia
                </h3>
                <span className="text-[11px] font-extrabold text-[#006c49] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                  Ativação Imediata
                </span>
              </div>

              {/* Grid 2x2 com os 4 benefícios principais destacados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                
                {/* Benefício 1: Páginas Demonstrativas */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#eff4ff]/60 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-start gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">devices</span>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm sm:text-base text-[#0b1c30] group-hover:text-[#006c49] transition-colors">
                      Páginas Demonstrativas Prontas
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Ambiente completo de demonstração do sistema e do atendimento via WhatsApp para você apresentar a donos e gerentes de hotéis com total credibilidade.
                    </p>
                  </div>
                </div>

                {/* Benefício 2: Página de Indicação Exclusiva */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#eff4ff]/60 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-start gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-[#003400] text-[#FDB116] flex items-center justify-center shrink-0 shadow-md shadow-[#003400]/20 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">link</span>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm sm:text-base text-[#0b1c30] group-hover:text-[#006c49] transition-colors">
                      Página de Indicação Exclusiva
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Link e URL personalizada com o seu código de parceiro oficial. Cada cliente que contrata pelo seu link é automaticamente vinculado e comissionado a você.
                    </p>
                  </div>
                </div>

                {/* Benefício 3: Pagamento Anual */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#eff4ff]/60 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-start gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">event_repeat</span>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm sm:text-base text-[#0b1c30] group-hover:text-[#006c49] transition-colors">
                      Pagamento Anual (R$ 197,00)
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Sem surpresas no bolso: você paga apenas a taxa anual simbólica de R$ 197,00. Nenhuma mensalidade fixa de franquia é cobrada durante o ano todo.
                    </p>
                  </div>
                </div>

                {/* Benefício 4: Sem Royalties */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#eff4ff]/60 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-start gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[24px]">percent</span>
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-bold text-sm sm:text-base text-[#0b1c30] group-hover:text-[#006c49] transition-colors">
                      100% Livre de Royalties
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Zero cobranças sobre o seu faturamento. Os 50% de comissão recorrente vitalícia dos seus hotéis pertencem integralmente a você, sem nenhum desconto.
                    </p>
                  </div>
                </div>

              </div>

              {/* Lista Complementar de Vantagens */}
              <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                  <span>50% de repasse vitalício mensal</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                  <span>Matriz cuida do suporte &amp; servidores</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                  <span>Automação com IA no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                  <span>Painel financeiro com extrato em tempo real</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                  <span>Pagamentos automáticos via PIX todo dia 05</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006c49] text-[18px]">check_circle</span>
                  <span>Material comercial &amp; manuais prontos</span>
                </div>
              </div>
            </div>

            {/* Ação e Botão de Candidatura */}
            <div className="pt-2 flex flex-col items-center gap-3 w-full">
              <button
                onClick={handlePartnerBtnClick}
                className="w-full max-w-lg inline-flex items-center justify-center gap-3 py-4.5 px-8 rounded-xl bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] text-base sm:text-lg font-black shadow-xl shadow-[#FDB116]/25 transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <span>Quero ser Franqueado • R$ 197,00/ano</span>
                <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
              </button>
              
              <div className="flex items-center flex-wrap justify-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006c49] text-[16px]">lock</span>
                  Pagamento Seguro
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006c49] text-[16px]">bolt</span>
                  Acesso Imediato ao Painel
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#006c49] text-[16px]">shield_person</span>
                  Sem Royalties ou Mensalidades Ocultas
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="w-full bg-[#eff4ff] text-slate-600 border-t border-slate-200 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 text-left">
            
            <div className="md:col-span-1 flex flex-col gap-2.5">
              <a 
                href="https://hotelnozap.com.br/" 
                onClick={(e) => {
                  if (onNavigateToHome) {
                    e.preventDefault();
                    onNavigateToHome();
                  }
                }}
                className="flex items-center gap-2 group cursor-pointer"
              >
                <ZapHotelLogo size={28} />
                <span className="font-extrabold text-base text-[#0b1c30]">Hotel no Zap</span>
              </a>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Franquia digital B2B de software hoteleiro. Acelere as receitas da hotelaria transformando o WhatsApp em reservas diretas e gerando receita recorrente vitalícia para franqueados.
              </p>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-white shadow-xs w-fit border border-slate-200">
                <span className="material-symbols-outlined text-[#006c49] text-[18px]">verified_user</span>
                <span className="text-[11px] font-bold text-[#0b1c30]">Franquia &amp; Revenda Oficial</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#0b1c30]">Navegação</span>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="#oportunidade">Oportunidade de Franquia</a>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="#vantagens">Vantagens do Ecossistema</a>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="#calculadora">Simulador de Faturamento</a>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="#filtro-parceiro">Perfil do Franqueado</a>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#0b1c30]">Franquia &amp; Licenciamento</span>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="#filtro-parceiro">Diretrizes de Revenda Oficial</a>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="https://hotelnozap.com.br/termos" target="_blank" rel="noopener noreferrer">Termos e Condições Gerais</a>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="https://hotelnozap.com.br/privacidade" target="_blank" rel="noopener noreferrer">Privacidade e Tratamento LGPD</a>
              <a className="text-xs text-slate-600 hover:text-[#0b1c30] transition-colors" href="#faq">Central de Dúvidas (FAQ)</a>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-[#0b1c30]">Canal de Apoio Oficial</span>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="material-symbols-outlined text-[18px]">mail</span>
                <a className="text-xs hover:text-[#006c49] transition-colors" href="mailto:hotelnozap@gmail.com">hotelnozap@gmail.com</a>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <span className="material-symbols-outlined text-[18px]">support_agent</span>
                <span className="text-xs">Suporte Central Hotel no Zap</span>
              </div>
              <div className="mt-2">
                <button
                  onClick={handlePartnerBtnClick}
                  className="inline-flex items-center justify-center text-xs bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] px-3.5 py-2 rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Seja um Franqueado
                </button>
              </div>
            </div>

          </div>

          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 text-[11px] text-slate-500">
            <span>© 2026 Hotel no Zap Tecnologia Hoteleira Ltda. Todos os direitos reservados.</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[#006c49] text-[16px]">lock</span>
              <span>Ambiente Seguro SSL 256-bit</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default LandingPageParceiros;
