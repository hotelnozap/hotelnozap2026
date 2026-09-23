import React, { useState, useEffect, useMemo } from 'react';
import { quartosService, produtosService, hospedesService } from '../services/supabaseService';
import type { ProductData } from './ListagemProdutos';

export interface PedidosRecepcaoHospedeProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  perfil?: any;
  temCheckinAtivo?: boolean;
  hotelId?: string;
  onNavigateBack?: () => void;
}

export interface PedidoItemHistorico {
  id: string;
  codigo: string;
  itemNome: string;
  solicitadoEm: string;
  responsavel: string;
  status: 'Em Preparo / Rota' | 'Em Rota' | 'Entregue' | 'Concluído' | 'Pendente';
  tempoRestante?: string;
  categoria?: string;
}

export const PedidosRecepcaoHospede: React.FC<PedidosRecepcaoHospedeProps> = ({
  userRole = 'hospede',
  userName = 'Camila Torres',
  userEmail = 'camila.torres@gmail.com',
  perfil,
  temCheckinAtivo,
  hotelId,
  onNavigateBack,
}) => {
  const [perfilLocal, setPerfilLocal] = useState<any>(perfil || null);
  const [hotelProducts, setHotelProducts] = useState<ProductData[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('');

  // Sincroniza ou carrega perfil caso não tenha sido passado por props
  useEffect(() => {
    if (perfil) {
      setPerfilLocal(perfil);
    } else {
      hospedesService.getPerfilHospedeLogado(userEmail || userName).then((data) => {
        if (data) setPerfilLocal(data);
      });
    }
  }, [perfil, userEmail, userName]);

  const temCheckin = Boolean(perfilLocal ? perfilLocal.temCheckinAtivo : temCheckinAtivo);
  const targetHotelId = perfilLocal?.hotelId || hotelId;

  // Carrega produtos cadastrados para o hotel do hóspede somente se tiver check-in ativo
  useEffect(() => {
    if (temCheckin && targetHotelId) {
      setLoadingProducts(true);
      produtosService.getProdutos(targetHotelId).then((prods) => {
        setHotelProducts(prods || []);
        setLoadingProducts(false);
      }).catch((err) => {
        console.warn('Erro ao carregar produtos do hotel:', err);
        setLoadingProducts(false);
      });
    } else {
      setHotelProducts([]);
      setLoadingProducts(false);
    }
  }, [temCheckin, targetHotelId]);

  // Categorias únicas dos produtos cadastrados do hotel
  const categoriasDisponiveis = useMemo(() => {
    if (!temCheckin || hotelProducts.length === 0) return [];
    const cats = Array.from(new Set(hotelProducts.map((p) => (p.category?.trim() || 'Geral'))));
    return cats;
  }, [temCheckin, hotelProducts]);

  useEffect(() => {
    if (categoriasDisponiveis.length > 0 && !selectedCategoryTab) {
      setSelectedCategoryTab(categoriasDisponiveis[0]);
    } else if (categoriasDisponiveis.length > 0 && !categoriasDisponiveis.includes(selectedCategoryTab)) {
      setSelectedCategoryTab(categoriasDisponiveis[0]);
    }
  }, [categoriasDisponiveis, selectedCategoryTab]);

  // Mensagem Toast de Notificação
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lista de Pedidos do Histórico (Dinâmica)
  const [historicoPedidos, setHistoricoPedidos] = useState<PedidoItemHistorico[]>([]);

  useEffect(() => {
    if (temCheckin) {
      // Inicia histórico inicial para acomodação ativa
      setHistoricoPedidos((prev) => (prev.length > 0 ? prev : [
        {
          id: '1',
          codigo: '#P-1048',
          itemNome: '2x Toalhas de Banho Extras',
          solicitadoEm: 'Solicitado às 14:15',
          responsavel: 'Carlos M. (Governança)',
          status: 'Em Preparo / Rota',
          tempoRestante: '8 min',
          categoria: 'Governança',
        }
      ]));
    } else {
      setHistoricoPedidos([]);
    }
  }, [temCheckin]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handler para Pedido de 1 Clique
  const handleQuickRequest = (itemName: string, categoria: string = 'Governança') => {
    if (!temCheckin) {
      showToast('⚠️ É necessário ter um check-in ativo no hotel para solicitar pedidos.');
      return;
    }

    const novoCodigo = `#P-${Math.floor(1000 + Math.random() * 9000)}`;
    const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const novoItem: PedidoItemHistorico = {
      id: String(Date.now()),
      codigo: novoCodigo,
      itemNome: itemName,
      solicitadoEm: `Solicitado às ${horaAtual}`,
      responsavel: 'Equipe do Hotel',
      status: 'Em Preparo / Rota',
      tempoRestante: '10 min',
      categoria: categoria,
    };

    setHistoricoPedidos([novoItem, ...historicoPedidos]);

    // Disparo inteligente para a tela do Hotel em tempo real
    const qNum = perfilLocal?.quartoNumero && perfilLocal?.quartoNumero !== '—' ? perfilLocal.quartoNumero : '100';
    const solicitacaoPayload = {
      id: `solic-${Date.now()}`,
      hotelId: targetHotelId || 'global',
      hospedeNome: perfilLocal?.nome || userName || 'Hóspede',
      hospedeEmail: perfilLocal?.email || userEmail || '',
      quartoNumero: qNum,
      itemNome: itemName,
      categoria: categoria,
      horario: horaAtual,
      timestamp: new Date().toISOString(),
      tipo: 'pedido',
      status: 'Pendente'
    };

    // Se for solicitação de Limpeza/Governança, atualiza o status do quarto no Mapa de Quartos
    if (itemName.toLowerCase().includes('limpeza') || categoria.toLowerCase().includes('limpeza') || itemName.toLowerCase().includes('camareira')) {
      quartosService.solicitarLimpezaQuarto(qNum);
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

  // Cálculos dinâmicos de KPIs
  const emAndamentoCount = temCheckin ? historicoPedidos.filter(p => p.status === 'Em Preparo / Rota' || p.status === 'Em Rota').length : 0;
  const concluidosCount = temCheckin ? historicoPedidos.filter(p => p.status === 'Entregue' || p.status === 'Concluído').length : 0;
  const pendentesCount = temCheckin ? historicoPedidos.filter(p => p.status === 'Pendente').length : 0;
  const pedidoEmAndamento = temCheckin ? historicoPedidos.find(p => p.status === 'Em Preparo / Rota' || p.status === 'Em Rota') : null;

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
            {perfilLocal?.nome ? perfilLocal.nome.substring(0, 2).toUpperCase() : (userName ? userName.substring(0, 2).toUpperCase() : 'HP')}
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
              {temCheckin && perfilLocal?.quartoNumero && perfilLocal?.quartoNumero !== '—' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-[#003400] border border-emerald-200">
                  Quarto {perfilLocal.quartoNumero}
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {perfilLocal?.hotelNome ? `${perfilLocal.hotelNome} • Recepção Online 24h` : 'Recepção Online 24h • Atendimento Prioritário'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {perfilLocal?.hotelWifi && (
              <button
                onClick={() => showToast(`Wi-Fi: ${perfilLocal.hotelWifi}`)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-xs md:text-sm font-medium transition-all"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-700">wifi</span>
                <span className="font-semibold">Rede: {perfilLocal.hotelWifi}</span>
              </button>
            )}

            {temCheckin && (
              <a
                href="#solicitacao-rapida-box"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs md:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>Novo Pedido</span>
              </a>
            )}
          </div>
        </div>

        {/* 1. KPIS ROW (EM ANDAMENTO, CONCLUÍDOS, PENDENTES) - LARGURA COMPLETA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
          {/* Em Andamento */}
          <div className="bg-white rounded-2xl p-4 md:p-5 flex flex-col justify-between border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <span className="material-symbols-outlined text-lg md:text-[20px]">pending_actions</span>
              </div>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {emAndamentoCount > 0 ? 'Em Rota' : 'Sem fila'}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{emAndamentoCount}</p>
              <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">Em Andamento</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">
                {emAndamentoCount > 0 ? (pedidoEmAndamento?.itemNome || 'Itens em preparo') : 'Nenhum pedido ativo'}
              </p>
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
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{concluidosCount}</p>
              <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">Concluídos</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">
                {concluidosCount > 0 ? `${concluidosCount} atendidos` : 'Nenhum pedido hoje'}
              </p>
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
              <p className="text-xl md:text-2xl font-black text-slate-900 leading-none">{pendentesCount}</p>
              <p className="text-xs md:text-sm font-bold text-slate-800 mt-1">Pendentes</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate">Sem atrasos</p>
            </div>
          </div>
        </div>

        {/* 2. CARD DE ACOMPANHAMENTO DE PEDIDO EM ROUTE (PROGRESS BAR LIVE) - SOMENTE SE HOUVER PEDIDO ATIVO */}
        {temCheckin && pedidoEmAndamento && (
          <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-4 md:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-xl font-bold">pending_actions</span>
                <h3 className="text-xs md:text-sm font-extrabold text-slate-900">
                  Pedido em Andamento {perfilLocal?.quartoNumero && perfilLocal?.quartoNumero !== '—' ? `no Quarto ${perfilLocal.quartoNumero}` : ''}
                </h3>
              </div>
              <span className="text-[10px] md:text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Previsão: {pedidoEmAndamento.tempoRestante || '10 min'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <p className="text-sm md:text-base font-extrabold text-slate-900">{pedidoEmAndamento.itemNome}</p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-sm text-emerald-600">moped</span>
                  {pedidoEmAndamento.responsavel || 'Em atendimento'}
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
        )}

        {/* 3. CATÁLOGO DE SOLICITAÇÃO RÁPIDA (1 CLIQUE) - EXCLUSIVO PARA QUEM TEM CHECK-IN ATIVO */}
        {temCheckin && (
          <div id="solicitacao-rapida-box" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg md:text-xl font-black text-slate-900">Solicitação Rápida (1 Clique)</h2>
                <p className="text-xs md:text-sm text-slate-500">
                  Selecione o produto ou item desejado do hotel para despachar instantaneamente para a recepção/governança.
                </p>
              </div>
              <span className="text-xs text-slate-400">Entrega direta na sua acomodação</span>
            </div>

            {loadingProducts ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <span className="material-symbols-outlined animate-spin text-emerald-600">sync</span>
                <span>Carregando itens do hotel...</span>
              </div>
            ) : hotelProducts.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                Nenhum produto cadastrado para este hotel no momento.
              </div>
            ) : (
              <>
                {/* Abas no Mobile (< lg) se houver mais de uma categoria */}
                {categoriasDisponiveis.length > 1 && (
                  <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {categoriasDisponiveis.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategoryTab(cat)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                          (selectedCategoryTab || categoriasDisponiveis[0]) === cat
                            ? 'bg-[#003400] text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Grid Responsivo de Categorias de Produtos */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
                  {categoriasDisponiveis.map((cat) => {
                    const prods = hotelProducts.filter((p) => (p.category?.trim() || 'Geral') === cat);
                    const isTabActive = (selectedCategoryTab || categoriasDisponiveis[0]) === cat;

                    return (
                      <div
                        key={cat}
                        className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between ${
                          isTabActive ? 'block' : 'hidden lg:flex'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[18px]">
                                {cat.toLowerCase().includes('frig') || cat.toLowerCase().includes('bebid') ? 'local_bar'
                                  : cat.toLowerCase().includes('gov') || cat.toLowerCase().includes('enxov') || cat.toLowerCase().includes('limpez') ? 'dry_cleaning'
                                  : cat.toLowerCase().includes('confort') || cat.toLowerCase().includes('amenit') ? 'spa'
                                  : cat.toLowerCase().includes('manuten') || cat.toLowerCase().includes('suport') ? 'build'
                                  : 'inventory_2'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">{cat}</h3>
                              <p className="text-[11px] text-slate-500">
                                {prods.length} {prods.length === 1 ? 'item disponível' : 'itens disponíveis'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2.5 mt-3">
                            {prods.map((prod) => (
                              <div
                                key={prod.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/50 transition-colors"
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="text-xs font-bold text-slate-900 truncate">{prod.name}</span>
                                  <span className="text-[11px] text-slate-500 truncate">
                                    {prod.price > 0
                                      ? `R$ ${prod.price.toFixed(2).replace('.', ',')}`
                                      : 'Incluso na diária'}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleQuickRequest(prod.name, prod.category || cat)}
                                  className="px-3 py-1.5 rounded-lg bg-[#003400] text-white hover:bg-[#002600] text-xs font-bold transition-all shrink-0 cursor-pointer"
                                >
                                  Pedir
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. HISTÓRICO DE PEDIDOS RECENTES (LARGURA TOTAL) */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
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
          {historicoPedidos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs md:text-sm">
              Nenhum pedido realizado nesta estadia até o momento.
            </div>
          ) : (
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
          )}
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
