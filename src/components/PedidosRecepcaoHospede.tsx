import React, { useState } from 'react';
import { quartosService } from '../services/supabaseService';

export interface PedidosRecepcaoHospedeProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onNavigateBack?: () => void;
}

export interface PedidoItemHistorico {
  id: string;
  codigo: string;
  itemNome: string;
  solicitadoEm: string;
  responsavel: string;
  status: 'Em Preparo / Rota' | 'Em Rota' | 'Entregue' | 'Concluído';
  tempoRestante?: string;
  categoria?: string;
}

export const PedidosRecepcaoHospede: React.FC<PedidosRecepcaoHospedeProps> = ({
  userRole = 'hospede',
  userName = 'Camila Torres',
  userEmail = 'camila.torres@gmail.com',
  onNavigateBack,
}) => {
  // Aba ativa do Catálogo no Mobile / Desktop
  const [activeCatalogTab, setActiveCatalogTab] = useState<'gov' | 'frig' | 'conf' | 'tec'>('gov');

  // Estado do formulário de pedido personalizado
  const [sectorSelect, setSectorSelect] = useState('Governança & Arrumação');
  const [customText, setCustomText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mensagem Toast de Notificação
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lista de Pedidos do Histórico (Dinâmica)
  const [historicoPedidos, setHistoricoPedidos] = useState<PedidoItemHistorico[]>([
    {
      id: '1',
      codigo: '#P-1048',
      itemNome: '2x Toalhas de Banho Extras',
      solicitadoEm: 'Solicitado às 14:15',
      responsavel: 'Carlos M. (Governança)',
      status: 'Em Preparo / Rota',
      tempoRestante: '8 min',
      categoria: 'Governança',
    },
    {
      id: '2',
      codigo: '#P-1042',
      itemNome: '1x Balde de Gelo com Pinça',
      solicitadoEm: 'Solicitado às 11:30',
      responsavel: 'Entregue no quarto',
      status: 'Entregue',
      categoria: 'Frigobar',
    },
    {
      id: '3',
      codigo: '#P-1039',
      itemNome: 'Limpeza Geral e Arrumação Matinal',
      solicitadoEm: 'Solicitado às 09:00',
      responsavel: 'Concluído às 09:42 por Ana Clara',
      status: 'Concluído',
      categoria: 'Governança',
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handler para Pedido de 1 Clique
  const handleQuickRequest = (itemName: string, categoria: string = 'Governança') => {
    const novoCodigo = `#P-${Math.floor(1000 + Math.random() * 9000)}`;
    const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const novoItem: PedidoItemHistorico = {
      id: String(Date.now()),
      codigo: novoCodigo,
      itemNome: itemName,
      solicitadoEm: `Solicitado às ${horaAtual}`,
      responsavel: 'Equipe de Governança',
      status: 'Em Preparo / Rota',
      tempoRestante: '10 min',
      categoria: categoria,
    };

    setHistoricoPedidos([novoItem, ...historicoPedidos]);

    // Disparo inteligente para a tela do Hotel em tempo real
    const solicitacaoPayload = {
      id: `solic-${Date.now()}`,
      hotelId: 'global',
      hospedeNome: userName || 'Hóspede',
      hospedeEmail: userEmail || '',
      quartoNumero: '100',
      itemNome: itemName,
      categoria: categoria,
      horario: horaAtual,
      timestamp: new Date().toISOString(),
      tipo: 'pedido',
      status: 'Pendente'
    };

    // Se for solicitação de Limpeza/Governança, atualiza o status do quarto no Mapa de Quartos
    if (itemName.toLowerCase().includes('limpeza') || categoria.toLowerCase().includes('limpeza') || itemName.toLowerCase().includes('camareira')) {
      quartosService.solicitarLimpezaQuarto('100');
    }

    window.dispatchEvent(new CustomEvent('hotel_nova_solicitacao', { detail: solicitacaoPayload }));
    try {
      const bc = new BroadcastChannel('hotel_notifications_channel');
      bc.postMessage({ type: 'NOVA_SOLICITACAO_HOSPEDE', data: solicitacaoPayload });
      bc.close();
    } catch (e) {}
    try {
      localStorage.setItem('hotel_nova_solicitacao_trigger', JSON.stringify(solicitacaoPayload));
      const raw = localStorage.getItem('hotel_notificacoes_pedidos');
      const list = raw ? JSON.parse(raw) : [];
      localStorage.setItem('hotel_notificacoes_pedidos', JSON.stringify([solicitacaoPayload, ...list].slice(0, 50)));
    } catch (e) {}

    showToast(`🛎️ Solicitação enviada! A recepção do hotel recebeu seu pedido de "${itemName}".`);
  };

  // Handler para Pedido Personalizado
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      handleQuickRequest(`${sectorSelect}: ${customText}`, sectorSelect);
      setCustomText('');
      setIsSubmitting(false);
    }, 800);
  };

  // Handler para simular chamada telefônica Ramal 9
  const handleCallRamal = () => {
    showToast('Ligando para o Ramal 9 da Recepção (Suíte 204)...');
  };

  // Itens do Catálogo por Categoria
  const catalogData = {
    gov: [
      { id: 'g1', title: 'Toalhas Extras', desc: '2x Toalhas de banho 500g', price: 'Gratuito' },
      { id: 'g2', title: 'Troca de Lençóis', desc: 'Algodão egípcio 400 fios', price: 'Gratuito' },
      { id: 'g3', title: 'Travesseiros Extras', desc: 'Viscoelástico / Pluma de ganso', price: 'Gratuito' },
      { id: 'g4', title: 'Limpeza Completa', desc: 'Higienização e arrumação da suíte', price: 'Gratuito' },
    ],
    frig: [
      { id: 'f1', title: 'Água Mineral 500ml', desc: 'Com ou sem gás geladinha', price: 'R$ 6,00' },
      { id: 'f2', title: 'Refrigerante Lata', desc: 'Coca-Cola / Guaraná Zero 350ml', price: 'R$ 8,00' },
      { id: 'f3', title: 'Corona Long Neck', desc: 'Cerveja Puro Malte 330ml', price: 'R$ 16,00' },
      { id: 'f4', title: 'Balde de Gelo', desc: 'Com pegador de inox higienizado', price: 'Cortesia' },
    ],
    conf: [
      { id: 'c1', title: 'Kit Shampoo & Sabonete', desc: 'L\'Occitane Verbena premium', price: 'Gratuito' },
      { id: 'c2', title: 'Secador de Cabelo', desc: 'Potência 2000W Bivolt turbo', price: 'Gratuito' },
      { id: 'c3', title: 'Ferro & Tábua de Passar', desc: 'Ferro a vapor portátil no quarto', price: 'Gratuito' },
      { id: 'c4', title: 'Adaptador de Tomada', desc: 'Padrão universal + USB-C', price: 'Gratuito' },
    ],
    tec: [
      { id: 't1', title: 'Suporte Ar Condicionado', desc: 'Ajuste técnico de temperatura', price: 'Atendimento Rápido' },
      { id: 't2', title: 'Smart TV & Netflix', desc: 'Configuração de canais e streaming', price: 'Atendimento Rápido' },
      { id: 't3', title: 'Cofre Eletrônico', desc: 'Reset de senha ou destravamento', price: 'Atendimento Rápido' },
      { id: 't4', title: 'Outro Reparo Geral', desc: 'Solicitar técnico de manutenção', price: 'Atendimento Rápido' },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#003400] text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER MOBILE (Dispositivos móveis / < lg)                                */}
      {/* ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-gradient-to-r from-[#003400] to-[#000000] text-white px-4 py-3.5 shadow-md flex items-center justify-between border-b border-emerald-950/40">
        <div className="flex items-center gap-2.5">
          <button onClick={onNavigateBack} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 flex items-center justify-center transition-transform">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <div>
            <span className="text-[10px] tracking-widest text-emerald-400 font-semibold block leading-none">PORTAL DO HÓSPEDE</span>
            <h1 className="text-base font-extrabold tracking-wider leading-tight text-white uppercase">HOTEL NO ZAP</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToast('Nenhuma notificação nova')} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 flex items-center justify-center relative transition-transform">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>
          <div className="w-9 h-9 rounded-lg bg-white/20 text-white font-bold text-xs flex items-center justify-center border border-white/20">
            CT
          </div>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 pb-28 lg:pb-12">

        {/* TOP BAR / NAVEGAÇÃO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <button
              onClick={onNavigateBack}
              className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-emerald-800 hover:text-emerald-950 transition-colors group cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
              Voltar para Minha Conta
            </button>
            <div className="flex items-center gap-3 pt-1">
              <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">Pedidos & Atendimento</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-[#003400] border border-emerald-200">
                Suíte 204
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Recepção Online 24h • Atendimento Prioritário Hóspede VIP
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => showToast('Wi-Fi da Pousada: ZapHotel_Hospedes')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs md:text-sm font-medium transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-emerald-700">wifi</span>
              <span className="font-semibold">Rede: ZapHotel_Hospedes</span>
            </button>

            <a
              href="#custom-request-box"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs md:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Novo Pedido</span>
            </a>
          </div>
        </div>

        {/* 1. HERO BANNER DE ATENDIMENTO RÁPIDO & KPIS ROW */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          {/* Banner Atendimento Rápido (7 cols) */}
          <div className="xl:col-span-7 bg-gradient-to-r from-[#003400] to-[#000000] text-white rounded-2xl p-5 lg:p-7 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Tempo de resposta: ~3 minutos
                </span>
              </div>
              <h2 className="text-xl lg:text-2xl font-black text-white mt-1">Precisa de algo com urgência?</h2>
              <p className="text-xs lg:text-sm text-slate-300 max-w-lg leading-relaxed">
                Fale agora mesmo com nosso concierge de prontidão através do WhatsApp ou solicite um toque direto no telefone do quarto.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-6 relative z-10">
              <a
                href="https://wa.me/5581999998888?text=Ol%C3%A1%2C%20estou%20na%20Su%C3%ADte%20204%20e%20preciso%20de%20atendimento"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs md:text-sm shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
                <span>Chamar no WhatsApp</span>
              </a>
              <button
                onClick={handleCallRamal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm backdrop-blur-sm transition-all border border-white/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">call</span>
                <span>Ligar para o Quarto (Ramal 9)</span>
              </button>
            </div>
          </div>

          {/* Status & KPIs (5 cols) */}
          <div className="xl:col-span-5 grid grid-cols-3 gap-3 md:gap-4">
            {/* Em Andamento */}
            <div className="bg-white rounded-2xl p-4 md:p-5 flex flex-col justify-between border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg md:text-[20px]">pending_actions</span>
                </div>
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Em Rota
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">1</p>
                <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">Em Andamento</p>
                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">Toalhas Extras (± 8 min)</p>
              </div>
            </div>

            {/* Concluídos */}
            <div className="bg-white rounded-2xl p-4 md:p-5 flex flex-col justify-between border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg md:text-[20px]">check_circle</span>
                </div>
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Hoje
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">3</p>
                <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">Concluídos</p>
                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">Atendidos hoje</p>
              </div>
            </div>

            {/* Pendentes */}
            <div className="bg-white rounded-2xl p-4 md:p-5 flex flex-col justify-between border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg md:text-[20px]">schedule</span>
                </div>
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Fila
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">0</p>
                <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">Pendentes</p>
                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">Sem atrasos</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. CARD DE ACOMPANHAMENTO DE PEDIDO EM ROUTE (PROGRESS BAR LIVE) */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-4 md:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-xl font-bold">pending_actions</span>
              <h3 className="text-xs md:text-sm font-extrabold text-slate-900">Pedido em Andamento na Suíte 204</h3>
            </div>
            <span className="text-[10px] md:text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Previsão: 8 min
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <p className="text-sm md:text-base font-extrabold text-slate-900">2x Toalhas de Banho Extras</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-sm text-emerald-600">moped</span>
                Em rota com a camareira Maristela
              </p>
            </div>
          </div>

          {/* Barra de Progresso em Passos */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full transition-all duration-500 w-3/4"></div>
          </div>
          <div className="flex justify-between items-center text-[10px] md:text-xs font-semibold">
            <span className="text-emerald-700">Recebido</span>
            <span className="text-emerald-700">Separado</span>
            <span className="text-emerald-800 font-extrabold">Em trânsito</span>
            <span className="text-slate-400">Entregue</span>
          </div>
        </div>

        {/* 3. CATÁLOGO DE SOLICITAÇÃO RÁPIDA (1 CLIQUE) */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900">Solicitação Rápida (1 Clique)</h2>
              <p className="text-xs md:text-sm text-slate-500">Selecione o item desejado para despachar instantaneamente para a governança.</p>
            </div>
            <span className="text-xs text-slate-400">Taxa de serviço inclusa na diária</span>
          </div>

          {/* Abas no Mobile (< lg) */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setActiveCatalogTab('gov')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                activeCatalogTab === 'gov' ? 'bg-[#003400] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Governança
            </button>
            <button
              onClick={() => setActiveCatalogTab('frig')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                activeCatalogTab === 'frig' ? 'bg-[#003400] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Frigobar & Bebidas
            </button>
            <button
              onClick={() => setActiveCatalogTab('conf')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                activeCatalogTab === 'conf' ? 'bg-[#003400] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Conforto & Amenities
            </button>
            <button
              onClick={() => setActiveCatalogTab('tec')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                activeCatalogTab === 'tec' ? 'bg-[#003400] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              Suporte Técnico
            </button>
          </div>

          {/* Visualização Desktop (4 Colunas) & Visualização Mobile Selecionada */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
            {/* Categoria 1: Governança & Enxoval */}
            <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between ${
              activeCatalogTab === 'gov' ? 'block' : 'hidden lg:flex'
            }`}>
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">dry_cleaning</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Governança & Enxoval</h3>
                    <p className="text-[11px] text-slate-500">Roupas de cama e banho</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 mt-3">
                  {catalogData.gov.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                        <span className="text-[11px] text-slate-500 truncate">{item.desc}</span>
                      </div>
                      <button
                        onClick={() => handleQuickRequest(item.title, 'Governança')}
                        className="px-3 py-1.5 rounded-lg bg-[#003400] text-white hover:bg-[#002600] text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        Pedir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Categoria 2: Frigobar & Bebidas */}
            <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between ${
              activeCatalogTab === 'frig' ? 'block' : 'hidden lg:flex'
            }`}>
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">local_bar</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Frigobar & Bebidas</h3>
                    <p className="text-[11px] text-slate-500">Bebidas geladas no quarto</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 mt-3">
                  {catalogData.frig.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                        <span className="text-[11px] text-slate-500 truncate">{item.desc}</span>
                      </div>
                      <button
                        onClick={() => handleQuickRequest(item.title, 'Frigobar')}
                        className="px-3 py-1.5 rounded-lg bg-[#003400] text-white hover:bg-[#002600] text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        Pedir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Categoria 3: Conforto & Amenities */}
            <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between ${
              activeCatalogTab === 'conf' ? 'block' : 'hidden lg:flex'
            }`}>
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">spa</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Conforto & Amenities</h3>
                    <p className="text-[11px] text-slate-500">Itens de cuidado e uso diário</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 mt-3">
                  {catalogData.conf.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                        <span className="text-[11px] text-slate-500 truncate">{item.desc}</span>
                      </div>
                      <button
                        onClick={() => handleQuickRequest(item.title, 'Conforto')}
                        className="px-3 py-1.5 rounded-lg bg-[#003400] text-white hover:bg-[#002600] text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        Pedir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Categoria 4: Manutenção & Suporte */}
            <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between ${
              activeCatalogTab === 'tec' ? 'block' : 'hidden lg:flex'
            }`}>
              <div>
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">build</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Manutenção & Suporte</h3>
                    <p className="text-[11px] text-slate-500">Assistência técnica na suíte</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 mt-3">
                  {catalogData.tec.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 transition-colors">
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                        <span className="text-[11px] text-slate-500 truncate">{item.desc}</span>
                      </div>
                      <button
                        onClick={() => handleQuickRequest(item.title, 'Manutenção')}
                        className="px-3 py-1.5 rounded-lg bg-[#003400] text-white hover:bg-[#002600] text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        Pedir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. HISTÓRICO RECENTE & 5. PEDIDO PERSONALIZADO (DUAS COLUNAS: 8 COLS + 4 COLS) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* HISTÓRICO DE PEDIDOS RECENTES (8 COLS) */}
          <div className="xl:col-span-8 bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base md:text-lg font-extrabold text-slate-900">Histórico de Pedidos Recentes</h3>
                <p className="text-xs text-slate-500 mt-0.5">Acompanhe a linha do tempo do atendimento do seu quarto em tempo real.</p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Atualizado agora
              </span>
            </div>

            {/* Lista de Pedidos */}
            <div className="flex flex-col gap-3">
              {historicoPedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    pedido.status === 'Em Preparo / Rota' || pedido.status === 'Em Rota'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        pedido.status === 'Em Preparo / Rota' || pedido.status === 'Em Rota'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {pedido.status === 'Em Preparo / Rota' ? 'room_service' : pedido.status === 'Entregue' ? 'check_circle' : 'verified'}
                      </span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">{pedido.codigo}</span>
                        <span className="text-xs md:text-sm font-bold text-slate-900">{pedido.itemNome}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {pedido.solicitadoEm} • {pedido.responsavel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                        pedido.status === 'Em Preparo / Rota' || pedido.status === 'Em Rota'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {pedido.status === 'Em Preparo / Rota' && <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>}
                      {pedido.status} {pedido.tempoRestante ? `(${pedido.tempoRestante})` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. PEDIDO PERSONALIZADO OU OBSERVAÇÃO ESPECIAL (4 COLS) */}
          <div className="xl:col-span-4 bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col gap-4" id="custom-request-box">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#003400] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Pedido Personalizado</h3>
                <p className="text-xs text-slate-500">Alguma preferência ou instrução específica?</p>
              </div>
            </div>

            <form onSubmit={handleCustomSubmit} className="flex flex-col gap-4 mt-1 text-xs md:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Setor de Atendimento</label>
                <select
                  value={sectorSelect}
                  onChange={(e) => setSectorSelect(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-3 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Governança & Arrumação">Governança & Arrumação</option>
                  <option value="Recepção & Concierge">Recepção & Concierge</option>
                  <option value="Frigobar & Gastronomia">Frigobar & Gastronomia</option>
                  <option value="Manutenção Técnica">Manutenção Técnica</option>
                  <option value="Transporte de Bagagem">Transporte de Bagagem / Bellboy</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Descreva sua Solicitação</label>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl p-3.5 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-white"
                  placeholder="Ex: Por favor, enviar 2 travesseiros antialérgicos e agendar arrumação para as 15h..."
                  rows={4}
                  required
                ></textarea>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-700 text-xl">schedule</span>
                <span className="text-xs text-slate-600 leading-tight">
                  Horário de preferência: <strong>Imediato (fila rápida)</strong>. Se preferir outro horário, mencione acima.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !customText.trim()}
                className="w-full py-3 px-4 rounded-xl bg-[#003400] hover:bg-[#002600] disabled:opacity-50 text-white font-bold text-xs md:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>{isSubmitting ? 'Enviando...' : 'Enviar para a Recepção'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA (MOBILE 390px)                           */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-around z-50 shadow-lg">
        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">hotel</span>
          <span className="text-[10px] font-medium">Estadia</span>
        </button>

        <button className="flex flex-col items-center gap-0.5 text-[#003400] font-bold">
          <div className="w-10 h-7 rounded-full bg-emerald-100 text-[#003400] flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">room_service</span>
          </div>
          <span className="text-[10px]">Pedidos</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">receipt_long</span>
          <span className="text-[10px] font-medium">Consumo</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-800 transition-colors">
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[10px] font-medium">Perfil</span>
        </button>
      </nav>
    </div>
  );
};

export default PedidosRecepcaoHospede;
