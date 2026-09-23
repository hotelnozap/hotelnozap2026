import React, { useState, useEffect } from 'react';
import { produtosService } from '../services/supabaseService';

export interface StockItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  lastUpdated: string;
  status: 'normal' | 'baixo' | 'esgotado';
}

export interface StockMovement {
  id: string;
  date: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  reason: string;
  user: string;
  documentRef?: string;
}

const INITIAL_STOCK_ITEMS: StockItem[] = [];

const SAMPLE_MOVEMENTS: Record<string, StockMovement[]> = {};

export interface EstoqueProdutosProps {
  onNavigateToNovaMovimentacao?: () => void;
  onNavigateToDashboard?: () => void;
}

export const EstoqueProdutos: React.FC<EstoqueProdutosProps> = ({
  onNavigateToNovaMovimentacao,
  onNavigateToDashboard
}) => {
  const [items, setItems] = useState<StockItem[]>(INITIAL_STOCK_ITEMS);

  useEffect(() => {
    produtosService.getProdutos().then((prods) => {
      const stockItems: StockItem[] = (prods || []).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit || 'Unidade',
        currentStock: p.stock,
        minStock: p.minStock || 10,
        maxStock: p.maxStock || 100,
        unitPrice: p.price,
        lastUpdated: p.updatedAt || 'Hoje',
        status: p.stock === 0 ? 'esgotado' : (p.stock <= (p.minStock || 10) ? 'baixo' : 'normal')
      }));
      setItems(stockItems);
    });
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'normal' | 'baixo' | 'esgotado'>('todos');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Modal States
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<StockItem | null>(null);
  const [quickAdjustmentItem, setQuickAdjustmentItem] = useState<StockItem | null>(null);
  const [quickAdjType, setQuickAdjType] = useState<'entrada' | 'saida'>('entrada');
  const [quickAdjQty, setQuickAdjQty] = useState<number>(1);
  const [quickAdjReason, setQuickAdjReason] = useState<string>('');

  // Toast Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Filtered list
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'todos' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Unique categories for filter
  const categories = Array.from(new Set(items.map(i => i.category)));

  // Bento KPI Calculations
  const totalItems = items.reduce((acc, curr) => acc + curr.currentStock, 0);
  const totalValue = items.reduce((acc, curr) => acc + (curr.currentStock * curr.unitPrice), 0);
  const lowStockCount = items.filter(i => i.status === 'baixo' || i.status === 'esgotado').length;

  const handleQuickAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdjustmentItem || quickAdjQty <= 0) return;

    setItems(prev => prev.map(item => {
      if (item.id === quickAdjustmentItem.id) {
        const newStock = quickAdjType === 'entrada' 
          ? item.currentStock + quickAdjQty 
          : Math.max(0, item.currentStock - quickAdjQty);
        
        let newStatus: 'normal' | 'baixo' | 'esgotado' = 'normal';
        if (newStock === 0) newStatus = 'esgotado';
        else if (newStock <= item.minStock) newStatus = 'baixo';

        return {
          ...item,
          currentStock: newStock,
          status: newStatus,
          lastUpdated: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        };
      }
      return item;
    }));

    const actionText = quickAdjType === 'entrada' ? 'Entrada' : 'Saída';
    showToast(`${actionText} de ${quickAdjQty} ${quickAdjustmentItem.unit}(s) realizada com sucesso!`);
    setQuickAdjustmentItem(null);
    setQuickAdjQty(1);
    setQuickAdjReason('');
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <button 
              onClick={onNavigateToDashboard}
              className="hover:text-slate-800 transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <span>/</span>
            <span className="text-[#003400]">Controle de Estoque</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Controle de Estoque
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o saldo, valor de inventário, alertas de reposição e histórico de movimentações.
          </p>
        </div>

        {/* BOTOES DE ACAO DESKTOP & MOBILE 2X2 */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={onNavigateToNovaMovimentacao}
            className="col-span-2 sm:col-span-1 bg-[#003400] hover:bg-[#002500] text-white flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">swap_horiz</span>
            <span>Nova Movimentação</span>
          </button>

          <button
            onClick={() => {
              if (items.length > 0) {
                setQuickAdjustmentItem(items[0]);
                setQuickAdjType('entrada');
              }
            }}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-emerald-600 text-lg">add_circle</span>
            <span>Entrada Rápida</span>
          </button>

          <button
            onClick={() => {
              if (items.length > 0) {
                setQuickAdjustmentItem(items[0]);
                setQuickAdjType('saida');
              }
            }}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-rose-600 text-lg">remove_circle</span>
            <span>Saída Rápida</span>
          </button>
        </div>
      </div>

      {/* PAINEL BENTO KPIS (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total em Estoque */}
        <div className="bg-blue-50/70 border border-blue-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total de Itens</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {totalItems.toLocaleString('pt-BR')} <span className="text-xs font-medium text-slate-500">unid.</span>
            </span>
            <span className="text-xs text-blue-700 font-medium mt-1">
              {items.length} produtos cadastrados
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
        </div>

        {/* Card 2: Valor do Estoque */}
        <div className="bg-emerald-50/70 border border-emerald-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Valor em Inventário</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-800 font-medium mt-1">
              Preço de custo estimado
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
        </div>

        {/* Card 3: Alerta Reposição */}
        <div className="bg-amber-50/70 border border-amber-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Alertas de Reposição</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {lowStockCount} <span className="text-xs font-medium text-slate-500">itens</span>
            </span>
            <span className="text-xs text-amber-800 font-medium mt-1">
              Estoque baixo ou esgotado
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
        </div>

        {/* Card 4: Movimentações do Mês */}
        <div className="bg-purple-50/70 border border-purple-100 p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Movimentações Mês</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              184
            </span>
            <span className="text-xs text-purple-800 font-medium mt-1">
              +14% em relação ao mês anterior
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">trending_up</span>
          </div>
        </div>

      </div>

      {/* BARRA DE FILTROS & BUSCA */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por código, produto ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003400]/30 focus:border-[#003400] transition-all bg-slate-50/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtros Dropdown & Toggle de Modos */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          
          {/* Categoria */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/30 cursor-pointer"
          >
            <option value="todos">Todas Categorias</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]/30 cursor-pointer"
          >
            <option value="todos">Todos Status</option>
            <option value="normal">Estoque Ok</option>
            <option value="baixo">Estoque Baixo</option>
            <option value="esgotado">Esgotado</option>
          </select>

          {/* Alternate List/Grid View Mode */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Lista"
            >
              <span className="material-symbols-outlined text-xl">view_list</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visualização em Grade"
            >
              <span className="material-symbols-outlined text-xl">grid_view</span>
            </button>
          </div>

        </div>

      </div>

      {/* LISTAGEM DOS PRODUTOS DO ESTOQUE */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-3xl">inventory_2</span>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Nenhum item encontrado</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
            Tente ajustar os filtros de pesquisa ou alterar o termo de busca digitado.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* MODO LISTA / TABELA */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Produto</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4 text-center">Qtd Atual</th>
                  <th className="py-3.5 px-4 text-center">Qtd Mínima</th>
                  <th className="py-3.5 px-4 text-right">Preço Custo</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500 font-semibold">
                      {item.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-400">Unidade: {item.unit}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {item.category}
                    </td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-base text-slate-900">
                      {item.currentStock}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-500">
                      {item.minStock}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                      R$ {item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.status === 'normal' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Ok
                        </span>
                      )}
                      {item.status === 'baixo' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          Estoque Baixo
                        </span>
                      )}
                      {item.status === 'esgotado' && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 font-bold">
                          Esgotado
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedItemForHistory(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Ver Histórico de Movimentações"
                        >
                          <span className="material-symbols-outlined text-lg">history</span>
                        </button>
                        <button
                          onClick={() => {
                            setQuickAdjustmentItem(item);
                            setQuickAdjType('entrada');
                          }}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Lançar Entrada"
                        >
                          <span className="material-symbols-outlined text-lg">add_circle</span>
                        </button>
                        <button
                          onClick={() => {
                            setQuickAdjustmentItem(item);
                            setQuickAdjType('saida');
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Lançar Saída"
                        >
                          <span className="material-symbols-outlined text-lg">remove_circle</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MODO GRADE / CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div 
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {item.code}
                  </span>
                  {item.status === 'normal' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      Ok
                    </span>
                  )}
                  {item.status === 'baixo' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                      Estoque Baixo
                    </span>
                  )}
                  {item.status === 'esgotado' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                      Esgotado
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{item.category} • {item.unit}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Atual</span>
                    <span className="text-lg font-black text-slate-900">{item.currentStock}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Mínimo</span>
                    <span className="text-sm font-bold text-slate-600">{item.minStock}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Custo</span>
                    <span className="text-sm font-bold text-slate-700">R$ {item.unitPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedItemForHistory(item)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">history</span>
                  <span>Histórico</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setQuickAdjustmentItem(item);
                      setQuickAdjType('entrada');
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Entrada</span>
                  </button>
                  <button
                    onClick={() => {
                      setQuickAdjustmentItem(item);
                      setQuickAdjType('saida');
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">remove</span>
                    <span>Saída</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE MOVIMENTAÇÕES */}
      {selectedItemForHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-400 text-2xl">history</span>
                <div>
                  <h3 className="font-bold text-base">Histórico de Movimentações</h3>
                  <p className="text-xs text-slate-300">{selectedItemForHistory.name} ({selectedItemForHistory.code})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForHistory(null)}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {SAMPLE_MOVEMENTS[selectedItemForHistory.id]?.length ? (
                <div className="flex flex-col gap-3">
                  {SAMPLE_MOVEMENTS[selectedItemForHistory.id].map((mov) => (
                    <div key={mov.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                          mov.type === 'entrada' ? 'bg-emerald-600' : mov.type === 'saida' ? 'bg-rose-600' : 'bg-amber-600'
                        }`}>
                          <span className="material-symbols-outlined text-xl">
                            {mov.type === 'entrada' ? 'arrow_downward' : mov.type === 'saida' ? 'arrow_upward' : 'tune'}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {mov.reason}
                          </div>
                          <div className="text-xs text-slate-500">
                            {mov.date} • {mov.user} {mov.documentRef ? `• Ref: ${mov.documentRef}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className={`font-extrabold text-base ${
                        mov.type === 'entrada' ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {mov.type === 'entrada' ? '+' : '-'}{mov.quantity} {selectedItemForHistory.unit}(s)
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Nenhuma movimentação registrada recentemente para este produto.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedItemForHistory(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-5 py-2 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE / ENTRADA / SAÍDA RÁPIDA */}
      {quickAdjustmentItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">
                  {quickAdjType === 'entrada' ? 'add_circle' : 'remove_circle'}
                </span>
                <h3 className="font-bold text-base">
                  {quickAdjType === 'entrada' ? 'Lançar Entrada Rápida' : 'Lançar Saída Rápida'}
                </h3>
              </div>
              <button
                onClick={() => setQuickAdjustmentItem(null)}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleQuickAdjustSubmit} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Produto Selecionado</label>
                <div className="p-3 bg-slate-100 rounded-xl font-bold text-slate-900 text-sm flex justify-between items-center">
                  <span>{quickAdjustmentItem.name}</span>
                  <span className="text-xs text-slate-500 font-normal">Estoque: {quickAdjustmentItem.currentStock}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Quantidade</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickAdjQty(Math.max(1, quickAdjQty - 1))}
                    className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quickAdjQty}
                    onChange={(e) => setQuickAdjQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center py-2 border border-slate-300 rounded-xl font-extrabold text-lg focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setQuickAdjQty(quickAdjQty + 1)}
                    className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  placeholder="Ex: Compra local, consumo extra, avaria..."
                  value={quickAdjReason}
                  onChange={(e) => setQuickAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickAdjustmentItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-sm"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default EstoqueProdutos;

