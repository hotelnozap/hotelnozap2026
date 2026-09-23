import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Truck, 
  XCircle, 
  Trash2, 
  Eye, 
  Receipt, 
  ArrowLeft, 
  RefreshCw, 
  Printer, 
  AlertCircle,
  Calendar,
  User,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { 
  pedidosCardapioService, 
  PedidoCardapio, 
  ExtratoConsumoQuarto 
} from '../services/pedidosCardapioService';

interface GestaoPedidosCardapioProps {
  hotelId?: string;
  hotelNome?: string;
  currentUser?: any;
  onNavigate?: (tab: string) => void;
}

export const GestaoPedidosCardapio: React.FC<GestaoPedidosCardapioProps> = ({
  hotelId = '1',
  hotelNome = 'Hotel Morada da Lua',
  currentUser,
  onNavigate
}) => {
  const [pedidos, setPedidos] = useState<PedidoCardapio[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState<string>('');
  const [quartoFiltro, setQuartoFiltro] = useState<string>('todos');
  
  // Modais
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCardapio | null>(null);
  const [modalExtratoQuarto, setModalExtratoQuarto] = useState<string | null>(null);
  const [extratoDados, setExtratoDados] = useState<ExtratoConsumoQuarto | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const carregarPedidos = async () => {
    const list = await pedidosCardapioService.getPedidos(hotelId);
    setPedidos(list);
  };

  useEffect(() => {
    carregarPedidos();

    // Escutar novos pedidos em tempo real
    const handleNovoPedido = () => {
      carregarPedidos();
      showToast('Novo pedido de cardápio recebido!', 'success');
    };

    window.addEventListener('hotel_novo_pedido_cardapio', handleNovoPedido);
    window.addEventListener('hotel_nova_solicitacao', handleNovoPedido);

    return () => {
      window.removeEventListener('hotel_novo_pedido_cardapio', handleNovoPedido);
      window.removeEventListener('hotel_nova_solicitacao', handleNovoPedido);
    };
  }, [hotelId]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const quartosUnicos = Array.from(new Set(pedidos.map(p => p.quartoNumero))).sort();

  const handleMudarStatus = async (pedidoId: string, novoStatus: PedidoCardapio['status']) => {
    const atualizado = await pedidosCardapioService.atualizarStatusPedido(pedidoId, novoStatus);
    if (atualizado) {
      await carregarPedidos();
      if (pedidoSelecionado && pedidoSelecionado.id === pedidoId) {
        setPedidoSelecionado(prev => prev ? { ...prev, status: novoStatus } : null);
      }
      showToast(`Status do pedido atualizado para: ${novoStatus.toUpperCase()}`);
    }
  };

  const handleExcluirPedido = async (pedido: PedidoCardapio) => {
    if (!window.confirm(`Tem certeza que deseja cancelar e excluir o pedido #${pedido.id.slice(-6)} do Quarto ${pedido.quartoNumero}?`)) {
      return;
    }

    const papel = currentUser?.tipo || currentUser?.role || 'hotel';
    const resultado = await pedidosCardapioService.excluirPedido(pedido.id, papel);
    if (resultado.success) {
      await carregarPedidos();
      if (pedidoSelecionado?.id === pedido.id) {
        setPedidoSelecionado(null);
      }
      showToast('Pedido excluído com sucesso!');
    } else {
      showToast(resultado.error || 'Apenas administradores e recepção do hotel podem excluir pedidos.', 'error');
    }
  };

  const handleAbrirExtrato = async (quartoNum: string) => {
    const extrato = await pedidosCardapioService.getExtratoQuarto(hotelId, quartoNum);
    setExtratoDados(extrato);
    setModalExtratoQuarto(quartoNum);
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus;
    const matchQuarto = quartoFiltro === 'todos' || p.quartoNumero === quartoFiltro;
    const matchBusca = busca === '' || 
      p.hospedeNome.toLowerCase().includes(busca.toLowerCase()) ||
      p.quartoNumero.includes(busca) ||
      p.itens.some(item => (item.nome || '').toLowerCase().includes(busca.toLowerCase()));

    return matchStatus && matchQuarto && matchBusca;
  });

  // Estatísticas rápidas
  const totalPendentes = pedidos.filter(p => p.status === 'pendente').length;
  const totalEmPreparo = pedidos.filter(p => p.status === 'em_preparo').length;
  const totalEntregues = pedidos.filter(p => p.status === 'entregue').length;
  const faturamentoTotal = pedidos
    .filter(p => p.status !== 'cancelado')
    .reduce((acc, p) => acc + (p.valorTotal || 0), 0);

  const getStatusBadge = (status: PedidoCardapio['status']) => {
    switch (status) {
      case 'pendente':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><Clock className="w-3.5 h-3.5" /> Pendente</span>;
      case 'em_preparo':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><ChefHat className="w-3.5 h-3.5" /> Em Preparo</span>;
      case 'entregue':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> Entregue</span>;
      case 'cancelado':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300"><XCircle className="w-3.5 h-3.5" /> Cancelado</span>;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-2 animate-bounce ${
          toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          <AlertCircle className="w-5 h-5" />
          {toastMsg.text}
        </div>
      )}

      {/* Topo / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShoppingBag className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                Pedidos do Cardápio & Frigobar
              </h1>
              <p className="text-sm text-slate-500">
                Acompanhamento em tempo real para cobrança no check-out dos hóspedes
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={carregarPedidos}
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition"
            title="Atualizar lista"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('produtos')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Listagem de Produtos
            </button>
          )}
          <a
            href={`/hoteis/cardapio/${hotelNome.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Cardápio do Hóspede
          </a>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Novos / Pendentes</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{totalPendentes}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Em Preparo</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{totalEmPreparo}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <ChefHat className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Entregues</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{totalEntregues}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Consumo Total</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              R$ {faturamentoTotal.toFixed(2).replace('.', ',')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por hóspede, quarto ou item..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtro por status */}
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="em_preparo">Em Preparo</option>
            <option value="entregue">Entregues</option>
            <option value="cancelado">Cancelados</option>
          </select>

          {/* Filtro por Quarto */}
          <select
            value={quartoFiltro}
            onChange={e => setQuartoFiltro(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todos">Todos os Quartos</option>
            {quartosUnicos.map(q => (
              <option key={q} value={q}>Quarto {q}</option>
            ))}
          </select>

          {/* Botão Extrato do Quarto Selecionado */}
          {quartoFiltro !== 'todos' && (
            <button
              onClick={() => handleAbrirExtrato(quartoFiltro)}
              className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-medium flex items-center gap-1 border border-emerald-200 transition"
            >
              <Receipt className="w-4 h-4" />
              Extrato Quarto {quartoFiltro}
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {pedidosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ShoppingBag className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-medium">Nenhum pedido encontrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Os pedidos realizados pelos hóspedes no cardápio aparecerão aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Pedido / Data</th>
                  <th className="py-3 px-4">Quarto & Hóspede</th>
                  <th className="py-3 px-4">Itens</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pedidosFiltrados.map(pedido => (
                  <tr key={pedido.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">#{pedido.id.slice(-6)}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(pedido.criadoEm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(pedido.criadoEm).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-xs border border-slate-200">
                          Quarto {pedido.quartoNumero}
                        </span>
                        <button
                          onClick={() => handleAbrirExtrato(pedido.quartoNumero)}
                          className="text-emerald-600 hover:text-emerald-700 text-xs flex items-center gap-0.5 underline font-medium"
                          title="Ver extrato completo para checkout"
                        >
                          <Receipt className="w-3 h-3" />
                          Extrato
                        </button>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 font-medium flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {pedido.hospedeNome}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="max-w-xs truncate text-xs text-slate-700">
                        {pedido.itens.map(item => `${item.quantidade}x ${item.nome}`).join(', ')}
                      </div>
                      {pedido.observacoesGerais && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 inline-block border border-amber-200">
                          Obs: {pedido.observacoesGerais}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-emerald-700">
                        R$ {pedido.valorTotal.toFixed(2).replace('.', ',')}
                      </span>
                      <div className="text-[10px] text-slate-400">Na conta do quarto</div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(pedido.status)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setPedidoSelecionado(pedido)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Detalhes do pedido"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Ações de status rápidas */}
                        {pedido.status === 'pendente' && (
                          <button
                            onClick={() => handleMudarStatus(pedido.id, 'em_preparo')}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Iniciar preparo"
                          >
                            <ChefHat className="w-4 h-4" />
                          </button>
                        )}

                        {pedido.status === 'em_preparo' && (
                          <button
                            onClick={() => handleMudarStatus(pedido.id, 'entregue')}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Marcar como entregue"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Exclusão/Cancelamento - exclusivo para Hotel/Recepção */}
                        <button
                          onClick={() => handleExcluirPedido(pedido)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Excluir ou Cancelar Pedido (Apenas Hotel)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {pedidoSelecionado && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Pedido #{pedidoSelecionado.id.slice(-6)}
                </h3>
                <p className="text-xs text-slate-500">
                  {new Date(pedidoSelecionado.criadoEm).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setPedidoSelecionado(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Info do Quarto */}
            <div className="bg-slate-50 p-4 rounded-xl space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Quarto:</span>
                <span className="font-bold text-slate-800">Quarto {pedidoSelecionado.quartoNumero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hóspede:</span>
                <span className="font-medium text-slate-800">{pedidoSelecionado.hospedeNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Forma de Cobrança:</span>
                <span className="font-semibold text-emerald-700">Lançado na Conta do Quarto</span>
              </div>
              {pedidoSelecionado.observacoesGerais && (
                <div className="pt-2 text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                  <strong>Observação:</strong> {pedidoSelecionado.observacoesGerais}
                </div>
              )}
            </div>

            {/* Itens */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Itens Solicitados</h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {pedidoSelecionado.itens.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                        {item.quantidade}x
                      </span>
                      <div>
                        <p className="font-medium text-slate-800">{item.nome}</p>
                        <p className="text-xs text-slate-400">Unit: R$ {item.precoUnitario.toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-800">
                      R$ {item.subtotal.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <span className="font-bold text-emerald-900">Total do Pedido:</span>
              <span className="text-xl font-black text-emerald-700">
                R$ {pedidoSelecionado.valorTotal.toFixed(2).replace('.', ',')}
              </span>
            </div>

            {/* Status Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Alterar Status:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['pendente', 'em_preparo', 'entregue', 'cancelado'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => handleMudarStatus(pedidoSelecionado.id, st)}
                    className={`py-2 px-2 text-xs rounded-xl font-bold transition border ${
                      pedidoSelecionado.status === st
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'pendente' && 'Pendente'}
                    {st === 'em_preparo' && 'Em Preparo'}
                    {st === 'entregue' && 'Entregue'}
                    {st === 'cancelado' && 'Cancelado'}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-100">
              <button
                onClick={() => handleExcluirPedido(pedidoSelecionado)}
                className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Pedido
              </button>
              <button
                onClick={() => setPedidoSelecionado(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Extrato do Quarto (Para Check-out) */}
      {modalExtratoQuarto && extratoDados && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                  <Receipt className="w-6 h-6 text-emerald-600" />
                  Extrato de Consumo - Quarto {extratoDados.quartoNumero}
                </h3>
                <p className="text-xs text-slate-500">
                  Total para lançamento no fechamento da conta do check-out
                </p>
              </div>
              <button
                onClick={() => setModalExtratoQuarto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Informações do Hóspede */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Hóspede</span>
                <span className="font-bold text-slate-800">{extratoDados.hospedeNome}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Quarto</span>
                <span className="font-bold text-slate-800">Quarto {extratoDados.quartoNumero}</span>
              </div>
            </div>

            {/* Itens do Extrato */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Histórico de Pedidos Válidos ({extratoDados.pedidos.length})
              </h4>
              {extratoDados.pedidos.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm border border-slate-100 rounded-xl">
                  Nenhum consumo registrado para este quarto.
                </div>
              ) : (
                <div className="space-y-3">
                  {extratoDados.pedidos.map(p => (
                    <div key={p.id} className="p-3 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-500 border-b border-slate-100 pb-1.5">
                        <span>Pedido #{p.id.slice(-6)} • {new Date(p.criadoEm).toLocaleString()}</span>
                        {getStatusBadge(p.status)}
                      </div>
                      <div className="space-y-1 text-sm">
                        {p.itens.map((it, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-700">
                            <span>{it.quantidade}x {it.nome}</span>
                            <span className="font-medium">R$ {it.subtotal.toFixed(2).replace('.', ',')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-1 font-bold text-xs text-slate-900">
                        <span>Subtotal do Pedido:</span>
                        <span>R$ {p.valorTotal.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total a cobrar no Checkout */}
            <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg flex justify-between items-center">
              <div>
                <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
                  Total a ser cobrado no Check-out
                </p>
                <p className="text-2xl md:text-3xl font-black">
                  R$ {extratoDados.totalConsumo.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-sm flex items-center gap-2 shadow transition"
              >
                <Printer className="w-4 h-4" />
                Imprimir Extrato
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setModalExtratoQuarto(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
