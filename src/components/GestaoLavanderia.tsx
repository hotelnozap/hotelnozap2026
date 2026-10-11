import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HotelAtivo, currentHotelService, quartosService } from '../services/supabaseService';
import { Room } from './MapaQuartos';
import { 
  lavanderiaService, 
  PedidoLavanderia, 
  StatusLavanderia, 
  TipoCobrancaLavanderia, 
  ItemLavanderia 
} from '../services/lavanderiaService';

export interface GestaoLavanderiaProps {
  activeHotel?: HotelAtivo;
  onBackToDashboard?: () => void;
}

// Itens rápidos predefinidos para facilitar a rotina do balcão
const ITENS_RAPIDOS = [
  { descricao: 'Camisa / Camiseta', valorUnitario: 8 },
  { descricao: 'Calça / Bermuda', valorUnitario: 10 },
  { descricao: 'Vestido / Peça Delicada', valorUnitario: 15 },
  { descricao: 'Peça Íntima / Meias', valorUnitario: 4 },
  { descricao: 'Lavagem por Quilo (kg)', valorUnitario: 22 },
  { descricao: 'Casaco / Jaqueta', valorUnitario: 20 },
];

export const GestaoLavanderia: React.FC<GestaoLavanderiaProps> = ({
  activeHotel,
  onBackToDashboard
}) => {
  const [pedidos, setPedidos] = useState<PedidoLavanderia[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [visualizacao, setVisualizacao] = useState<'kanban' | 'tabela'>('kanban');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [termoBusca, setTermoBusca] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados do Modal "Nova Entrada"
  const [isModalNovoAberto, setIsModalNovoAberto] = useState<boolean>(false);
  const [quartoSelecionado, setQuartoSelecionado] = useState<string>('');
  const [hospedeNome, setHospedeNome] = useState<string>('');
  const [hospedeTelefone, setHospedeTelefone] = useState<string>('');
  const [formaCobranca, setFormaCobranca] = useState<TipoCobrancaLavanderia>('quarto');
  const [previsaoEntrega, setPrevisaoEntrega] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [itensPedido, setItensPedido] = useState<ItemLavanderia[]>([
    { id: '1', descricao: 'Camisa / Camiseta', quantidade: 1, valorUnitario: 8, subtotal: 8 }
  ]);

  // Modal Detalhes / WhatsApp
  const [pedidoDetalhes, setPedidoDetalhes] = useState<PedidoLavanderia | null>(null);

  const hotelId = activeHotel?.id || currentHotelService.getCurrentHotel()?.id || '';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carregar dados
  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    try {
      const hId = hotelId || currentHotelService.getCurrentHotel()?.id;
      if (!hId) {
        setIsLoading(false);
        return;
      }

      const [dataPedidos, dataQuartos] = await Promise.all([
        lavanderiaService.getPedidos(hId),
        quartosService.getQuartos(hId)
      ]);

      setPedidos(dataPedidos || []);
      setRooms(dataQuartos || []);
    } catch (err) {
      console.warn('Erro ao carregar dados de lavanderia:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    carregarDados();

    const handleAtualizado = () => carregarDados();
    window.addEventListener('hotel_lavanderia_atualizado', handleAtualizado);
    window.addEventListener('hotel_changed', handleAtualizado);

    return () => {
      window.removeEventListener('hotel_lavanderia_atualizado', handleAtualizado);
      window.removeEventListener('hotel_changed', handleAtualizado);
    };
  }, [carregarDados]);

  // Quando o recepcionista seleciona um quarto no modal, auto-preenche o hóspede
  const handleSelecionarQuarto = (num: string) => {
    setQuartoSelecionado(num);
    const roomEncontrado = rooms.find(r => String(r.number) === String(num));
    if (roomEncontrado && roomEncontrado.guestName) {
      setHospedeNome(roomEncontrado.guestName);
    }
  };

  // Funções de manipulação dos itens da lavanderia no modal
  const handleAdicionarItemRapido = (item: { descricao: string; valorUnitario: number }) => {
    setItensPedido(prev => {
      const existente = prev.find(p => p.descricao === item.descricao);
      if (existente) {
        return prev.map(p => 
          p.descricao === item.descricao 
            ? { ...p, quantidade: p.quantidade + 1, subtotal: (p.quantidade + 1) * p.valorUnitario }
            : p
        );
      }
      return [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          descricao: item.descricao,
          quantidade: 1,
          valorUnitario: item.valorUnitario,
          subtotal: item.valorUnitario
        }
      ];
    });
  };

  const handleAtualizarQuantidadeItem = (id: string, delta: number) => {
    setItensPedido(prev => {
      return prev
        .map(item => {
          if (item.id === id) {
            const novaQtd = Math.max(1, item.quantidade + delta);
            return { ...item, quantidade: novaQtd, subtotal: novaQtd * item.valorUnitario };
          }
          return item;
        })
        .filter(item => item.quantidade > 0);
    });
  };

  const handleRemoverItem = (id: string) => {
    setItensPedido(prev => prev.filter(p => p.id !== id));
  };

  const handleAdicionarLinhaCustomizada = () => {
    setItensPedido(prev => [
      ...prev,
      {
        id: String(Date.now()),
        descricao: 'Peça Avulsa',
        quantidade: 1,
        valorUnitario: 10,
        subtotal: 10
      }
    ]);
  };

  // Cálculos do modal
  const modalTotalPecas = useMemo(() => {
    return itensPedido.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
  }, [itensPedido]);

  const modalValorTotal = useMemo(() => {
    return itensPedido.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
  }, [itensPedido]);

  // Salvar novo pedido
  const handleSalvarNovoPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quartoSelecionado.trim()) {
      alert('Por favor, informe o quarto do hóspede.');
      return;
    }
    if (!hospedeNome.trim()) {
      alert('Por favor, informe o nome do hóspede.');
      return;
    }
    if (itensPedido.length === 0) {
      alert('Adicione pelo menos uma peça para lavagem.');
      return;
    }

    try {
      const hId = hotelId || currentHotelService.getCurrentHotel()?.id || '';
      const novo = await lavanderiaService.createPedido({
        hotelId: hId,
        quartoNumero: quartoSelecionado,
        hospedeNome: hospedeNome.trim(),
        hospedeTelefone: hospedeTelefone.trim() || undefined,
        itens: itensPedido,
        totalPecas: modalTotalPecas,
        valorTotal: modalValorTotal,
        formaCobranca,
        status: 'recebido',
        previsaoEntrega: previsaoEntrega.trim() || undefined,
        observacoes: observacoes.trim() || undefined
      }, hId);

      showToast(`✅ Pedido ${novo.codigo} do Quarto ${quartoSelecionado} registrado com sucesso!`);
      setIsModalNovoAberto(false);
      // Reset
      setQuartoSelecionado('');
      setHospedeNome('');
      setHospedeTelefone('');
      setPrevisaoEntrega('');
      setObservacoes('');
      setItensPedido([{ id: '1', descricao: 'Camisa / Camiseta', quantidade: 1, valorUnitario: 8, subtotal: 8 }]);
      carregarDados();
    } catch (err) {
      console.warn('Erro ao salvar pedido de lavanderia:', err);
      alert('Erro ao registrar o pedido de lavanderia. Tente novamente.');
    }
  };

  // Mudar Status do Pedido
  const handleAvancarStatus = async (pedido: PedidoLavanderia) => {
    let proximo: StatusLavanderia = 'recebido';
    if (pedido.status === 'recebido') proximo = 'lavando';
    else if (pedido.status === 'lavando') proximo = 'pronto';
    else if (pedido.status === 'pronto') proximo = 'entregue';
    else return;

    try {
      const atualizado = await lavanderiaService.updateStatus(pedido.id, proximo, hotelId);
      if (atualizado) {
        const nomesStatus: Record<StatusLavanderia, string> = {
          recebido: 'Recebido no Balcão',
          lavando: 'Em Lavagem / Passadoria',
          pronto: 'Pronto para Retirada',
          entregue: 'Entregue ao Hóspede',
          cancelado: 'Cancelado'
        };
        showToast(`Quarto ${pedido.quartoNumero} alterado para: ${nomesStatus[proximo]}`);
        carregarDados();

        // Se ficou pronto e tem telefone, oferece abrir WhatsApp
        if (proximo === 'pronto') {
          setPedidoDetalhes(atualizado);
        }
      }
    } catch (err) {
      console.warn('Erro ao atualizar status:', err);
    }
  };

  // Cancelar pedido
  const handleCancelarPedido = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este pedido de lavanderia?')) return;
    await lavanderiaService.updateStatus(id, 'cancelado', hotelId);
    showToast('Pedido cancelado.');
    carregarDados();
  };

  // Abrir WhatsApp do Hóspede
  const handleAbrirWhatsApp = (pedido: PedidoLavanderia) => {
    const hotelNome = activeHotel?.name || currentHotelService.getCurrentHotel()?.name || 'Hotel';
    const { linkZap, texto } = lavanderiaService.gerarMensagemWhatsApp(pedido, hotelNome);

    if (linkZap) {
      window.open(linkZap, '_blank');
    } else {
      navigator.clipboard.writeText(texto);
      showToast('📋 Mensagem copiada! Cole no WhatsApp do hóspede.');
    }
  };

  // Estatísticas do Topo (KPIs)
  const stats = useMemo(() => {
    const recebidos = pedidos.filter(p => p.status === 'recebido').length;
    const lavando = pedidos.filter(p => p.status === 'lavando').length;
    const pronto = pedidos.filter(p => p.status === 'pronto').length;
    const entregues = pedidos.filter(p => p.status === 'entregue').length;
    const totalPecasAtivas = pedidos
      .filter(p => p.status === 'recebido' || p.status === 'lavando' || p.status === 'pronto')
      .reduce((acc, p) => acc + (p.totalPecas || 0), 0);

    return { recebidos, lavando, pronto, entregues, totalPecasAtivas };
  }, [pedidos]);

  // Filtro de Busca
  const pedidosFiltrados = useMemo(() => {
    let list = [...pedidos];

    if (filtroStatus !== 'todos') {
      list = list.filter(p => p.status === filtroStatus);
    }

    if (termoBusca.trim()) {
      const t = termoBusca.toLowerCase().trim();
      list = list.filter(p => 
        p.codigo.toLowerCase().includes(t) ||
        String(p.quartoNumero).toLowerCase().includes(t) ||
        p.hospedeNome.toLowerCase().includes(t) ||
        (p.observacoes && p.observacoes.toLowerCase().includes(t))
      );
    }

    return list;
  }, [pedidos, filtroStatus, termoBusca]);

  // Colunas Kanban
  const kanbanColunas = [
    {
      id: 'recebido' as StatusLavanderia,
      titulo: 'Recebido no Balcão',
      badge: `${stats.recebidos}`,
      corHeader: 'bg-amber-500/10 text-amber-800 border-amber-300',
      icone: 'inbox',
      btnProximo: 'Iniciar Lavagem',
      iconeProximo: 'local_laundry_service'
    },
    {
      id: 'lavando' as StatusLavanderia,
      titulo: 'Em Lavagem / Passando',
      badge: `${stats.lavando}`,
      corHeader: 'bg-blue-500/10 text-blue-800 border-blue-300',
      icone: 'local_laundry_service',
      btnProximo: 'Marcar como Pronto',
      iconeProximo: 'check_circle'
    },
    {
      id: 'pronto' as StatusLavanderia,
      titulo: 'Pronto no Balcão',
      badge: `${stats.pronto}`,
      corHeader: 'bg-emerald-500/10 text-emerald-900 border-emerald-300',
      icone: 'check_circle',
      btnProximo: 'Confirmar Entrega',
      iconeProximo: 'task_alt'
    },
    {
      id: 'entregue' as StatusLavanderia,
      titulo: 'Entregue ao Hóspede',
      badge: `${stats.entregues}`,
      corHeader: 'bg-slate-500/10 text-slate-700 border-slate-300',
      icone: 'done_all',
      btnProximo: null,
      iconeProximo: null
    }
  ];

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 animate-in fade-in">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300">
              Serviços de Balcão
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {activeHotel?.name || currentHotelService.getCurrentHotel()?.name || 'Hotel'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1c30] tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-blue-700 text-3xl">dry_cleaning</span>
            Lavanderia &amp; Roupas de Hóspedes
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Controle de entrega de sacolas de roupas no balcão, etapas de lavagem, cobrança no checkout e avisos via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setIsModalNovoAberto(true)}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            <span>Nova Entrada no Balcão</span>
          </button>

          <button
            type="button"
            onClick={() => carregarDados()}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-xs active:scale-95"
            title="Atualizar Pedidos"
          >
            <span className="material-symbols-outlined text-lg">sync</span>
          </button>
        </div>
      </div>

      {/* CARDS DE INDICADORES (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: No Balcão */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">No Balcão</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">inbox</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-950 block">{stats.recebidos}</span>
            <span className="text-[11px] text-amber-800 font-medium block mt-0.5">
              Aguardando início de lavagem
            </span>
          </div>
        </div>

        {/* Card 2: Em Lavagem */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">Em Lavagem</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">local_laundry_service</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-blue-950 block">{stats.lavando}</span>
            <span className="text-[11px] text-blue-800 font-medium block mt-0.5">
              Lavando e passando roupas
            </span>
          </div>
        </div>

        {/* Card 3: Pronto no Balcão */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Pronto para Retirada</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-950 block">{stats.pronto}</span>
            <span className="text-[11px] text-emerald-800 font-medium block mt-0.5">
              Limpo aguardando hóspede
            </span>
          </div>
        </div>

        {/* Card 4: Total de Peças Ativas */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">Peças em Processo</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">dry_cleaning</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-purple-950 block">{stats.totalPecasAtivas} peças</span>
            <span className="text-[11px] text-purple-800 font-medium block mt-0.5">
              Volume total sob custódia
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE CONTROLE, BUSCA E VISUALIZAÇÃO */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Alternador Kanban / Lista */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setVisualizacao('kanban')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              visualizacao === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">view_kanban</span>
            <span>Quadro Kanban</span>
          </button>

          <button
            type="button"
            onClick={() => setVisualizacao('tabela')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              visualizacao === 'tabela' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-base">format_list_bulleted</span>
            <span>Lista Completa</span>
          </button>
        </div>

        {/* Busca e Filtro de Status */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar por quarto, hóspede ou #LAV..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => setTermoBusca('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {visualizacao === 'tabela' && (
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-hidden text-slate-700 font-semibold"
            >
              <option value="todos">Todos os Status</option>
              <option value="recebido">Recebido</option>
              <option value="lavando">Em Lavagem</option>
              <option value="pronto">Pronto</option>
              <option value="entregue">Entregue</option>
            </select>
          )}
        </div>
      </div>

      {/* VISUALIZAÇÃO 1: QUADRO KANBAN */}
      {visualizacao === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {kanbanColunas.map(coluna => {
            const pedidosColuna = pedidosFiltrados.filter(p => p.status === coluna.id);

            return (
              <div
                key={coluna.id}
                className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-3 min-h-[450px]"
              >
                {/* Header da Coluna */}
                <div className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center justify-between ${coluna.corHeader}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">{coluna.icone}</span>
                    <span>{coluna.titulo}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white font-extrabold shadow-2xs">
                    {coluna.badge}
                  </span>
                </div>

                {/* Cards da Coluna */}
                <div className="flex flex-col gap-2.5 flex-1">
                  {pedidosColuna.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic flex-1 flex items-center justify-center">
                      Nenhum pedido nesta etapa
                    </div>
                  ) : (
                    pedidosColuna.map(pedido => {
                      const isQuartoCobranca = pedido.formaCobranca === 'quarto';
                      const isPagoBalcao = pedido.formaCobranca === 'pago_balcao';

                      return (
                        <div
                          key={pedido.id}
                          className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-3.5 flex flex-col gap-2.5 text-xs"
                        >
                          {/* Cabeçalho do Card */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-sm font-black text-slate-900 block flex items-center gap-1">
                                <span className="material-symbols-outlined text-base text-blue-700">meeting_room</span>
                                Quarto {pedido.quartoNumero}
                              </span>
                              <span className="text-[11px] font-bold text-slate-700 block truncate max-w-[150px]">
                                {pedido.hospedeNome}
                              </span>
                            </div>

                            <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {pedido.codigo}
                            </span>
                          </div>

                          {/* Resumo de Peças */}
                          <div className="bg-[#f8f9ff] p-2 rounded-lg border border-slate-100 text-[11px]">
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span>Total de Peças:</span>
                              <span className="font-black text-blue-900">{pedido.totalPecas} peças</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                              {pedido.itens.map(i => `${i.quantidade}x ${i.descricao}`).join(', ')}
                            </div>
                            {pedido.observacoes && (
                              <div className="mt-1 text-[10px] text-amber-800 bg-amber-50 p-1 rounded italic">
                                &quot;{pedido.observacoes}&quot;
                              </div>
                            )}
                          </div>

                          {/* Preço e Forma de Cobrança */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-black text-slate-900 text-sm">
                              R$ {pedido.valorTotal.toFixed(2).replace('.', ',')}
                            </span>

                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                                isQuartoCobranca
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : isPagoBalcao
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  : 'bg-blue-50 text-blue-900 border-blue-200'
                              }`}
                            >
                              {isQuartoCobranca ? 'Lançado no Quarto' : isPagoBalcao ? 'Pago no Balcão' : 'Cortesia'}
                            </span>
                          </div>

                          {/* Previsão de Entrega */}
                          {pedido.previsaoEntrega && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">alarm</span>
                              <span>Previsão: <strong>{pedido.previsaoEntrega}</strong></span>
                            </div>
                          )}

                          {/* Ações do Card */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            {/* Botão WhatsApp */}
                            <button
                              type="button"
                              onClick={() => handleAbrirWhatsApp(pedido)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                              title="Avisar hóspede no WhatsApp"
                            >
                              <span className="material-symbols-outlined text-base">chat</span>
                            </button>

                            {/* Botão Ver Detalhes */}
                            <button
                              type="button"
                              onClick={() => setPedidoDetalhes(pedido)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                              title="Ver Rol de Roupas"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                            </button>

                            {/* Botão Próxima Etapa */}
                            {coluna.btnProximo && (
                              <button
                                type="button"
                                onClick={() => handleAvancarStatus(pedido)}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                              >
                                {coluna.iconeProximo && (
                                  <span className="material-symbols-outlined text-xs">{coluna.iconeProximo}</span>
                                )}
                                <span>{coluna.btnProximo}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISUALIZAÇÃO 2: TABELA COMPLETA */}
      {visualizacao === 'tabela' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#f8f9ff] text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Código / Quarto</th>
                  <th className="px-4 py-3">Hóspede</th>
                  <th className="px-4 py-3">Peças &amp; Rol</th>
                  <th className="px-4 py-3">Valor &amp; Cobrança</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                      Nenhum pedido de lavanderia encontrado.
                    </td>
                  </tr>
                ) : (
                  pedidosFiltrados.map(p => {
                    const statusObj = kanbanColunas.find(k => k.id === p.status);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-[10px] font-bold text-slate-400 block">{p.codigo}</span>
                          <span className="font-extrabold text-slate-900 text-sm">Quarto {p.quartoNumero}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-bold text-slate-900 block">{p.hospedeNome}</span>
                          {p.hospedeTelefone && (
                            <span className="text-[10px] text-slate-500 font-mono">{p.hospedeTelefone}</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-bold text-blue-900 block">{p.totalPecas} peças</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-xs block">
                            {p.itens.map(i => `${i.quantidade}x ${i.descricao}`).join(', ')}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-black text-slate-900 block">
                            R$ {p.valorTotal.toFixed(2).replace('.', ',')}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {p.formaCobranca === 'quarto' ? 'Na conta do Quarto' : p.formaCobranca === 'pago_balcao' ? 'Pago Balcão' : 'Cortesia'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusObj?.corHeader || 'bg-slate-100'}`}>
                            <span className="material-symbols-outlined text-xs">{statusObj?.icone || 'info'}</span>
                            <span>{statusObj?.titulo || p.status}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAbrirWhatsApp(p)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                              title="Avisar WhatsApp"
                            >
                              <span className="material-symbols-outlined text-base">chat</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPedidoDetalhes(p)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                              title="Ver Detalhes"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                            </button>

                            {p.status !== 'entregue' && p.status !== 'cancelado' && (
                              <button
                                type="button"
                                onClick={() => handleAvancarStatus(p)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold text-[10px] hover:bg-black transition cursor-pointer"
                              >
                                Avançar Etapa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NOVA ENTRADA NO BALCÃO */}
      {isModalNovoAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg sm:max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92dvh] sm:max-h-[88vh]">
            {/* Header */}
            <div className="px-5 py-3.5 sm:py-4 flex items-center justify-between bg-[#003400] text-white shadow-md shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-xl">dry_cleaning</span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Nova Entrada de Roupas no Balcão</h3>
                  <span className="text-[11px] text-emerald-300 font-medium block">Rol de lavanderia &amp; identificação de hóspede</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalNovoAberto(false)}
                className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form Body com Scroll */}
            <form onSubmit={handleSalvarNovoPedido} className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto overscroll-contain flex-1 touch-pan-y text-xs">
              {/* Seleção do Quarto e Hóspede */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f8f9ff] p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Quarto do Hóspede *
                  </label>
                  <select
                    value={quartoSelecionado}
                    onChange={(e) => handleSelecionarQuarto(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Selecione o Quarto...</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.number}>
                        Quarto {r.number} {r.guestName ? `(${r.guestName})` : ''} - {r.category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Nome do Hóspede *
                  </label>
                  <input
                    type="text"
                    value={hospedeNome}
                    onChange={(e) => setHospedeNome(e.target.value)}
                    required
                    placeholder="Nome completo do hóspede"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    WhatsApp do Hóspede (com DDD)
                  </label>
                  <input
                    type="text"
                    value={hospedeTelefone}
                    onChange={(e) => setHospedeTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Previsão de Conclusão
                  </label>
                  <input
                    type="text"
                    value={previsaoEntrega}
                    onChange={(e) => setPrevisaoEntrega(e.target.value)}
                    placeholder="Ex: Hoje às 18:00 ou Amanhã 10h"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Botões de Adição Rápida de Peças */}
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Adicionar Peças Rápidas (1 Clique):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ITENS_RAPIDOS.map((rap, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAdicionarItemRapido(rap)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-xs text-emerald-600">add</span>
                      <span>{rap.descricao} (R$ {rap.valorUnitario},00)</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleAdicionarLinhaCustomizada}
                    className="px-2.5 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">edit</span>
                    <span>Outro Item...</span>
                  </button>
                </div>
              </div>

              {/* Tabela de Peças Selecionadas */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8f9ff] text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Descrição da Peça</th>
                      <th className="px-3 py-2 text-center">Qtd</th>
                      <th className="px-3 py-2 text-right">Valor Unit.</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 text-center">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itensPedido.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItensPedido(prev => prev.map(p => p.id === item.id ? { ...p, descricao: val } : p));
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-200 font-semibold"
                          />
                        </td>

                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleAtualizarQuantidadeItem(item.id, -1)}
                              className="w-5 h-5 bg-white text-slate-700 rounded flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-bold text-xs px-1.5">{item.quantidade}</span>
                            <button
                              type="button"
                              onClick={() => handleAtualizarQuantidadeItem(item.id, 1)}
                              className="w-5 h-5 bg-white text-slate-700 rounded flex items-center justify-center font-bold hover:bg-slate-200 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.valorUnitario}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setItensPedido(prev => prev.map(p => p.id === item.id ? { ...p, valorUnitario: val, subtotal: p.quantidade * val } : p));
                            }}
                            className="w-16 px-1.5 py-1 text-right rounded border border-slate-200 font-semibold"
                          />
                        </td>

                        <td className="px-3 py-2 text-right font-extrabold text-slate-900">
                          R$ {item.subtotal.toFixed(2).replace('.', ',')}
                        </td>

                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoverItem(item.id)}
                            className="text-red-500 hover:text-red-700 cursor-pointer p-1"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td className="px-3 py-2 font-extrabold text-slate-800">Total</td>
                      <td className="px-3 py-2 text-center font-black text-blue-900">{modalTotalPecas} peças</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-black text-slate-900 text-sm">
                        R$ {modalValorTotal.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Forma de Cobrança */}
              <div className="bg-[#f8f9ff] p-3 rounded-xl border border-slate-200 space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  Forma de Cobrança do Serviço:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 cursor-pointer transition ${formaCobranca === 'quarto' ? 'bg-amber-100 border-amber-400 text-amber-950' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="cobranca"
                      value="quarto"
                      checked={formaCobranca === 'quarto'}
                      onChange={() => setFormaCobranca('quarto')}
                      className="accent-emerald-700"
                    />
                    <div>
                      <span className="block text-[11px] font-black">Lançar no Quarto</span>
                      <span className="text-[10px] text-slate-500 font-normal">Pagar no Checkout</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 cursor-pointer transition ${formaCobranca === 'pago_balcao' ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="cobranca"
                      value="pago_balcao"
                      checked={formaCobranca === 'pago_balcao'}
                      onChange={() => setFormaCobranca('pago_balcao')}
                      className="accent-emerald-700"
                    />
                    <div>
                      <span className="block text-[11px] font-black">Pago no Balcão</span>
                      <span className="text-[10px] text-slate-500 font-normal">Já quitado agora</span>
                    </div>
                  </label>

                  <label className={`p-2.5 rounded-xl border font-bold flex items-center gap-2 cursor-pointer transition ${formaCobranca === 'cortesia' ? 'bg-blue-100 border-blue-400 text-blue-950' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <input
                      type="radio"
                      name="cobranca"
                      value="cortesia"
                      checked={formaCobranca === 'cortesia'}
                      onChange={() => setFormaCobranca('cortesia')}
                      className="accent-emerald-700"
                    />
                    <div>
                      <span className="block text-[11px] font-black">Cortesia do Hotel</span>
                      <span className="text-[10px] text-slate-500 font-normal">Sem custo</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[11px] font-bold text-slate-800 mb-1">
                  Observações e Cuidados Especiais:
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Não passar a ferro peça de linho, separar camisa branca..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              {/* Footer do Modal com Submit */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalNovoAberto(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Registrar Entrada no Balcão</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO PEDIDO / ROL DE ROUPAS */}
      {pedidoDetalhes && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-emerald-300 font-bold block">{pedidoDetalhes.codigo}</span>
                <h3 className="text-lg font-black text-white">Quarto {pedidoDetalhes.quartoNumero} • {pedidoDetalhes.hospedeNome}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPedidoDetalhes(null)}
                className="bg-red-700 hover:bg-red-800 text-white p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-700">
              <div className="bg-[#f8f9ff] p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Atual:</span>
                  <span className="font-black text-slate-900 uppercase">{pedidoDetalhes.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Forma de Cobrança:</span>
                  <span className="font-bold text-slate-900">
                    {pedidoDetalhes.formaCobranca === 'quarto' ? 'Lançado no Quarto (Checkout)' : pedidoDetalhes.formaCobranca === 'pago_balcao' ? 'Pago no Balcão' : 'Cortesia'}
                  </span>
                </div>
                {pedidoDetalhes.previsaoEntrega && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Previsão:</span>
                    <span className="font-semibold text-slate-800">{pedidoDetalhes.previsaoEntrega}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="font-bold text-slate-900 block mb-1">Rol de Roupas:</span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {pedidoDetalhes.itens.map((it, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center bg-white text-xs">
                      <span><strong>{it.quantidade}x</strong> {it.descricao}</span>
                      <span className="font-mono font-bold text-slate-900">R$ {it.subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                  <div className="p-2.5 bg-slate-50 flex justify-between font-extrabold text-sm border-t border-slate-200">
                    <span>Total ({pedidoDetalhes.totalPecas} peças)</span>
                    <span className="text-emerald-900 font-black">R$ {pedidoDetalhes.valorTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>

              {pedidoDetalhes.observacoes && (
                <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200 italic">
                  &quot;{pedidoDetalhes.observacoes}&quot;
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleAbrirWhatsApp(pedidoDetalhes)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  <span>Enviar Aviso no WhatsApp do Hóspede</span>
                </button>

                {pedidoDetalhes.status !== 'cancelado' && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCancelarPedido(pedidoDetalhes.id);
                      setPedidoDetalhes(null);
                    }}
                    className="w-full py-1.5 text-center text-red-600 hover:text-red-800 font-bold text-[11px] cursor-pointer"
                  >
                    Cancelar este Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoLavanderia;
