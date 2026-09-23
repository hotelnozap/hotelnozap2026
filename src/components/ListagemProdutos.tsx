import React, { useState } from 'react';
import { produtosService } from '../services/supabaseService';

export interface ProductData {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  status: 'ativo' | 'inativo' | 'esgotado';
  icon: string;
  description?: string;
  image?: string;
  costPrice?: number;
  barcode?: string;
  sku?: string;
  minStock?: number;
  maxStock?: number;
  unit?: string;
  supplier?: string;
  location?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface ListagemProdutosProps {
  onNavigateToNovoProduto?: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToNovaCategoria?: () => void;
}

const INITIAL_PRODUCTS: ProductData[] = [];

export interface ListagemProdutosProps {
  onNavigateToNovoProduto?: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToNovaCategoria?: () => void;
  onNavigateToPedidosCardapio?: () => void;
  initialSubView?: 'todos' | 'categorias' | 'estoque';
}

export const ListagemProdutos: React.FC<ListagemProdutosProps> = ({
  onNavigateToNovoProduto,
  onNavigateToDashboard,
  onNavigateToNovaCategoria,
  onNavigateToPedidosCardapio,
  initialSubView = 'todos',
}) => {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(initialSubView === 'categorias' ? 'bebidas' : '');
  const [statusFilter, setStatusFilter] = useState(initialSubView === 'estoque' ? 'esgotado' : '');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await produtosService.getProdutos();
      setProducts(data || []);
    } catch (err) {
      console.warn('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();

    const handleNovoProduto = () => {
      fetchProducts();
    };

    window.addEventListener('hotel_novo_produto', handleNovoProduto);
    window.addEventListener('hotel_changed', handleNovoProduto);

    const unsubscribe = produtosService.subscribeProdutos
      ? produtosService.subscribeProdutos(fetchProducts)
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_produto', handleNovoProduto);
      window.removeEventListener('hotel_changed', handleNovoProduto);
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (initialSubView === 'categorias') {
      setCategoryFilter('bebidas');
      setStatusFilter('');
    } else if (initialSubView === 'estoque') {
      setStatusFilter('esgotado');
      setCategoryFilter('');
    }
  }, [initialSubView]);

  // Modals state
  const [selectedProductForView, setSelectedProductForView] = useState<ProductData | null>(null);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<ProductData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStock, setEditStock] = useState<number>(0);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<'ativo' | 'inativo' | 'esgotado'>('ativo');

  // KPIs Reais calculados a partir dos dados do Supabase
  const totalProdutos = products.length;
  const produtosAtivos = products.filter(p => p.status === 'ativo').length;
  const estoqueBaixo = products.filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 5)).length;
  const semEstoque = products.filter(p => p.stock <= 0 || p.status === 'esgotado').length;
  const percentAtivos = totalProdutos > 0 ? ((produtosAtivos / totalProdutos) * 100).toFixed(1) : '0';

  const categoriasDisponiveis = React.useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
  }, [products]);

  // Filtered List
  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (statusFilter && p.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(q);
      const codeMatch = p.code.toLowerCase().includes(q);
      const catMatch = p.category.toLowerCase().includes(q);
      return nameMatch || codeMatch || catMatch;
    }
    return true;
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este produto?')) {
      setProducts(products.filter((p) => p.id !== id));
      await produtosService.deleteProduto(id);
      showToast('Produto excluído com sucesso!');
    }
  };

  const handleOpenEdit = (p: ProductData) => {
    setSelectedProductForEdit(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditStock(p.stock);
    setEditPrice(p.price);
    setEditStatus(p.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForEdit || !editName) return;
    const changes: Partial<ProductData> = {
      name: editName,
      category: editCategory,
      stock: Number(editStock),
      price: Number(editPrice),
      status: editStatus,
    };
    setProducts(
      products.map((p) => {
        if (p.id === selectedProductForEdit.id) {
          return {
            ...p,
            ...changes,
          };
        }
        return p;
      })
    );
    await produtosService.updateProduto(selectedProductForEdit.id, changes);
    showToast('Produto atualizado com sucesso!');
    setSelectedProductForEdit(null);
  };

  return (
    <div className="p-3 sm:p-6 w-full max-w-full 2xl:max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}
      
      {/* MOBILE CONTAINER (sm:hidden - 1:1 COM DESIGN MOBILE) */}
      <div className="flex flex-col gap-4 sm:hidden">
        
        {/* CABEÇALHO MOBILE */}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-900 mt-1">Listagem de Produtos</h2>
          <p className="text-xs text-slate-500">Gerencie seu inventário.</p>
        </div>

        {onNavigateToPedidosCardapio && (
          <button
            onClick={onNavigateToPedidosCardapio}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-base">receipt_long</span>
            <span>Ver Pedidos do Cardápio & Frigobar</span>
          </button>
        )}

        {/* GRID 2X2 DE AÇÕES RÁPIDAS MOBILE */}
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={() => {
              if (onNavigateToNovoProduto) {
                onNavigateToNovoProduto();
              } else {
                alert('Novo Produto...');
              }
            }}
            className="w-full py-2.5 px-3 bg-[#000000] hover:bg-[#0b1c30] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="truncate">Novo Produto</span>
          </button>

          <button
            onClick={() => {
              if (onNavigateToNovaCategoria) {
                onNavigateToNovaCategoria();
              } else {
                alert('Nova Categoria...');
              }
            }}
            className="w-full py-2.5 px-3 bg-[#10B981] hover:bg-emerald-600 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">create_new_folder</span>
            <span className="truncate">Nova Categoria</span>
          </button>

          <button
            onClick={() => alert('Importando lista de produtos...')}
            className="w-full py-2.5 px-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">upload</span>
            <span>Importar</span>
          </button>

          <button
            onClick={() => alert('Exportando cadastro de produtos...')}
            className="w-full py-2.5 px-3 bg-[#FDB116] hover:bg-amber-500 text-[#1F2937] rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar</span>
          </button>
        </div>

        {/* BUSCA E FILTROS MOBILE */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos por nome, categoria ou ID..."
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] shadow-xs"
            />
          </div>

          <button
            onClick={() => {
              if (categoryFilter || statusFilter) {
                setCategoryFilter('');
                setStatusFilter('');
              } else {
                setCategoryFilter(categoryFilter ? '' : 'bebidas');
              }
            }}
            className="bg-white border border-slate-200 text-slate-800 font-semibold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Filtros</span>
          </button>
        </div>

        {/* CARDS KPIS 2X2 MOBILE */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl shadow-xs border bg-blue-50 border-blue-200">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-blue-700">TOTAL DE PRODUTOS</p>
            <p className="text-xl font-black text-blue-900">{totalProdutos}</p>
          </div>

          <div className="p-3.5 rounded-xl shadow-xs border bg-emerald-50 border-emerald-200">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-emerald-700">ATIVOS</p>
            <p className="text-xl font-black text-emerald-900">{produtosAtivos}</p>
          </div>

          <div className="p-3.5 rounded-xl shadow-xs border bg-rose-50 border-rose-200">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-rose-700">SEM ESTOQUE</p>
            <p className="text-xl font-black text-rose-900">{semEstoque}</p>
          </div>

          <div className="p-3.5 rounded-xl shadow-xs border bg-amber-50 border-amber-200">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-amber-700">ESTOQUE BAIXO</p>
            <p className="text-xl font-black text-amber-900">{estoqueBaixo}</p>
          </div>
        </div>

        {/* LISTA DE PRODUTOS MOBILE */}
        <div className="flex flex-col gap-3">
          {filteredProducts.map((p) => {
            const isNoStock = p.stock === 0;
            const isLowStock = p.stock > 0 && p.stock <= 15;

            return (
              <div
                key={p.id}
                className={
                  "bg-white border rounded-xl shadow-xs flex flex-col overflow-hidden transition-shadow relative " +
                  (isNoStock ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200')
                }
              >
                <div className="p-4 flex-1">
                  {/* CATEGORIA E STATUS */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-slate-100 text-slate-800 font-semibold text-xs px-2.5 py-1 rounded-full inline-block">
                      {p.category}
                    </span>

                    {isNoStock ? (
                      <div className="flex items-center gap-1 text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <span className="material-symbols-outlined text-xs">warning</span>
                        <span>Sem Estoque</span>
                      </div>
                    ) : isLowStock ? (
                      <div className="flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                        <span>Baixo Estoque</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-xs font-semibold">
                        <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                        <span>Em Estoque</span>
                      </div>
                    )}
                  </div>

                  {/* NOME DO PRODUTO */}
                  <h3 className="font-bold text-base text-slate-900 mb-1">{p.name}</h3>

                  {/* PREÇO E ESTOQUE */}
                  <div className="flex justify-between items-end mt-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Preço</p>
                      <p className="text-base font-bold text-slate-900">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Estoque</p>
                      <p className={"text-base font-bold " + (isNoStock ? 'text-rose-600' : 'text-slate-900')}>
                        {p.stock} un
                      </p>
                    </div>
                  </div>
                </div>

                {/* RODAPÉ AÇÕES MOBILE */}
                <div className="border-t border-slate-100 bg-slate-50/50 p-2 flex justify-end gap-1">
                  <button
                    onClick={() => setSelectedProductForView(p)}
                    className="text-[#005cbb] hover:bg-[#e6f1ff] p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                    title="Ver"
                  >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="text-[#b87500] hover:bg-[#fff2df] p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                    title="Excluir"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhum produto encontrado.
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP CONTAINER (hidden sm:flex) */}
      <div className="hidden sm:flex flex-col gap-6">
      
        {/* CABEÇALHO PRINCIPAL DA PÁGINA (DESKTOP) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Listagem de Produtos</h1>
            <p className="text-sm text-slate-500 mt-1">Gerencie e visualize as informações de todos os produtos do hotel.</p>
          </div>

          {/* BOTÕES DESKTOP DE AÇÃO */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => alert('Importando lista de produtos...')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#2563EB] hover:bg-[#1d4ed8] cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">upload</span>
              <span>Importar</span>
            </button>

            <button
              onClick={() => alert('Exportando cadastro de produtos...')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-[#1F2937] bg-[#FDB116] hover:bg-[#eab308] cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span>Exportar</span>
            </button>

            {onNavigateToPedidosCardapio && (
              <button
                onClick={onNavigateToPedidosCardapio}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-xl">receipt_long</span>
                <span>Pedidos do Cardápio</span>
              </button>
            )}

            <button
              onClick={() => {
                if (onNavigateToNovaCategoria) {
                  onNavigateToNovaCategoria();
                } else {
                  alert('Nova Categoria...');
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#10B981] hover:bg-[#059669] cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">create_new_folder</span>
              <span>Nova Categoria</span>
            </button>

            <button
              onClick={() => {
                if (onNavigateToNovoProduto) {
                  onNavigateToNovoProduto();
                } else {
                  alert('Novo Produto...');
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm shadow-sm transition-all text-white bg-[#000000] hover:bg-[#0b1c30] cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              <span>Novo Produto</span>
            </button>
          </div>
        </div>

      {/* CARDS DE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 - TOTAL DE PRODUTOS */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Total de Produtos</h3>
            <div className="p-2 bg-blue-100 rounded-lg text-blue-800">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{totalProdutos.toLocaleString()}</p>
            <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">inventory</span>
              <span>No catálogo do hotel</span>
            </p>
          </div>
        </div>

        {/* KPI 2 - PRODUTOS ATIVOS */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Produtos Ativos</h3>
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{produtosAtivos.toLocaleString()}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {percentAtivos}% do total
            </p>
          </div>
        </div>

        {/* KPI 3 - ESTOQUE BAIXO */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Estoque Baixo</h3>
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
              <span className="material-symbols-outlined text-xl">low_priority</span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{estoqueBaixo}</p>
            <p className="text-xs font-semibold text-amber-600 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>Abaixo do limite mínimo</span>
            </p>
          </div>
        </div>

        {/* KPI 4 - SEM ESTOQUE */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Produtos sem Estoque</h3>
            <div className="p-2 bg-rose-100 rounded-lg text-rose-800">
              <span className="material-symbols-outlined text-xl">warning</span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{semEstoque}</p>
            <p className="text-xs font-semibold text-rose-600 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>Requer atenção</span>
            </p>
          </div>
        </div>
      </div>

      {/* CONTAINER PRINCIPAL: TOOLBAR E LISTAGEM */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        
        {/* TOOLBAR SUPERIOR */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
          
          {/* FILTROS E PESQUISA */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap flex-1">
            
            {/* BUSCA BARRA COMPLETA */}
            <div className="relative flex-1 min-w-[240px]">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por Nome, Código (#ID) ou Categoria..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400] transition-colors"
              />
            </div>

            {/* FILTRO CATEGORIA */}
            <div className="relative w-full sm:w-44 shrink-0">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400] appearance-none cursor-pointer"
              >
                <option value="">Todas as Categorias</option>
                {categoriasDisponiveis.map(cat => (
                  <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                arrow_drop_down
              </span>
            </div>

            {/* FILTRO STATUS */}
            <div className="relative w-full sm:w-40 shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400] appearance-none cursor-pointer"
              >
                <option value="">Todos os Status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="esgotado">Esgotado</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
                arrow_drop_down
              </span>
            </div>

            {/* LIMPAR FILTROS */}
            {(searchQuery || categoryFilter || statusFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); }}
                className="inline-flex items-center justify-center px-3 py-2.5 border border-slate-200 text-xs font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="material-symbols-outlined text-base mr-1">filter_alt_off</span>
                <span>Limpar</span>
              </button>
            )}
          </div>

          {/* CONTROLES DE VISUALIZAÇÃO (TOGGLE LISTA / GRADE) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
              <button
                onClick={() => setViewMode('list')}
                title="Modo Lista"
                className={
                  "px-3.5 py-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold " +
                  (viewMode === 'list'
                    ? 'bg-[#003400] text-white'
                    : 'text-slate-600 hover:bg-slate-100')
                }
              >
                <span className="material-symbols-outlined text-lg">list</span>
                <span className="hidden lg:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Modo Grade"
                className={
                  "px-3.5 py-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold border-l border-slate-300 " +
                  (viewMode === 'grid'
                    ? 'bg-[#003400] text-white'
                    : 'text-slate-600 hover:bg-slate-100')
                }
              >
                <span className="material-symbols-outlined text-lg">grid_view</span>
                <span className="hidden lg:inline">Grade</span>
              </button>
            </div>
          </div>

        </div>

        {/* VISUALIZAÇÃO: MODO LISTA (TABELA) */}
        {viewMode === 'list' && (
          <div className="w-full overflow-hidden">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-slate-100/70 border-b border-slate-200">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-3 sm:px-4 py-3 w-16">ID</th>
                  <th className="px-3 sm:px-4 py-3">Nome</th>
                  <th className="px-3 sm:px-4 py-3 hidden md:table-cell">Categoria</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Estoque</th>
                  <th className="px-3 sm:px-4 py-3 text-right">Preço</th>
                  <th className="px-3 sm:px-4 py-3 text-center">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {paginatedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 sm:px-4 py-3 font-medium text-slate-500 whitespace-nowrap text-xs">{p.code}</td>
                    
                    <td className="px-3 sm:px-4 py-3">
                      <div className="flex items-center min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 mr-2.5 shrink-0">
                          <span className="material-symbols-outlined text-lg">{p.icon}</span>
                        </div>
                        <span className="font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-[200px] lg:max-w-[260px] xl:max-w-xs" title={p.name}>
                          {p.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-slate-600 hidden md:table-cell text-xs">{p.category}</td>

                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right font-semibold text-xs">
                      <span className={p.stock === 0 ? 'text-red-600 font-bold' : 'text-slate-900'}>
                        {p.stock}
                      </span>
                    </td>

                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right font-bold text-slate-900 text-xs">
                      R$ {p.price.toFixed(2).replace('.', ',')}
                    </td>

                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                      <span className={
                        "px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full border " +
                        (p.status === 'ativo' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : p.status === 'esgotado'
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200')
                      }>
                        {p.status === 'ativo' ? 'Ativo' : p.status === 'esgotado' ? 'Esgotado' : 'Inativo'}
                      </span>
                    </td>

                    <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedProductForView(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Ver detalhes do produto"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          <span>Ver</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Editar produto"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#DC2626] hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Excluir produto"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                          <span>Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                          <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                          <span>Carregando produtos do Supabase...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                          <p className="font-semibold text-slate-700">Nenhum produto encontrado</p>
                          <p className="text-xs text-slate-400">Cadastre novos produtos para exibi-los no inventário e no cardápio.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VISUALIZAÇÃO: MODO GRADE (CARDS) */}
        {viewMode === 'grid' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-slate-50/30">
            {paginatedProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group relative"
              >
                <div>
                  {/* TOPO CARD: ÍCONE E BADGE */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                      <span className="material-symbols-outlined text-2xl">{p.icon}</span>
                    </div>

                    <span className={
                      "px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full border " +
                      (p.status === 'ativo' 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : p.status === 'esgotado'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200')
                    }>
                      {p.status === 'ativo' ? 'Ativo' : p.status === 'esgotado' ? 'Esgotado' : 'Inativo'}
                    </span>
                  </div>

                  {/* CÓDIGO E CATEGORIA */}
                  <p className="text-xs text-slate-500 mb-1">{p.code} • {p.category}</p>

                  {/* NOME DO PRODUTO */}
                  <h3 className="font-bold text-sm text-slate-900 mb-3 line-clamp-2">{p.name}</h3>

                  {/* ESTOQUE E PREÇO */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-500">
                      Estoque: <strong className={p.stock === 0 ? 'text-red-600' : 'text-slate-900'}>{p.stock}</strong>
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      R$ {p.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* RODAPÉ DO CARD: ÍCONES DE AÇÃO */}
                <div className="flex justify-end gap-1 border-t border-slate-100 pt-3 mt-2">
                  <button
                    onClick={() => setSelectedProductForView(p)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="Ver Detalhes"
                  >
                    <span className="material-symbols-outlined text-xl">visibility</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar Produto"
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Excluir Produto"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                Nenhum produto encontrado na visualização em grade.
              </div>
            )}
          </div>
        )}

        {/* RODAPÉ: PAGINAÇÃO */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-white">
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Exibindo <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> de{' '}
                <span className="font-bold text-slate-900">{filteredProducts.length}</span> produtos
              </p>
            </div>

            <div>
              <nav className="inline-flex rounded-lg shadow-xs -space-x-px border border-slate-200 bg-white items-center">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1.5 rounded-l-lg text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      currentPage === page
                        ? 'bg-[#003400] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1.5 rounded-r-lg text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

      </div>

      </div>

      {/* MODAL VER DETALHES DO PRODUTO */}
      {selectedProductForView && (() => {
        const prod = selectedProductForView;
        const price = prod.price;
        const costPrice = prod.costPrice || (price * 0.44);
        const profit = price - costPrice;
        const profitMargin = Math.round((profit / costPrice) * 100);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col my-auto overflow-hidden max-h-[92vh]">
              
              {/* MODAL HEADER */}
              <div className="bg-[#003400] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#25D366] text-xl shrink-0">inventory_2</span>
                    <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">Detalhes do Produto</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-emerald-950/80 text-emerald-300 font-mono px-1.5 py-0.5 rounded border border-emerald-800 shrink-0">
                      {prod.code}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/40 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {prod.status === 'ativo' ? 'Ativo' : prod.status === 'inativo' ? 'Inativo' : 'Esgotado'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProductForView(null)}
                  type="button"
                  aria-label="Fechar Modal"
                  className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              {/* MODAL SCROLLABLE CONTENT */}
              <div className="overflow-y-auto px-3.5 sm:px-6 py-4 space-y-4 text-slate-700 text-xs sm:text-sm">
                
                {/* PRODUCT IDENTITY CARD */}
                <section className="p-3 sm:p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 rounded-xl flex items-start gap-3 sm:gap-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white border border-blue-200 text-blue-600 shadow-2xs flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl sm:text-3xl">{prod.icon || 'water_drop'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                      <span className="text-emerald-700 font-bold">{prod.category}</span>
                      <span>•</span>
                      <span className="truncate">Frigobar & Recepção</span>
                    </div>
                    <h3 className="text-sm sm:text-xl font-bold text-slate-900 leading-snug">{prod.name}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-slate-500">
                      <div className="flex items-center gap-1 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                        <span className="material-symbols-outlined text-[13px] text-slate-600">barcode_scanner</span>
                        <span>{prod.barcode || '7891234567890'}</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono font-medium text-slate-600">SKU: <strong className="text-slate-800">{prod.sku || `BEB-${prod.code.replace('#', '')}`}</strong></span>
                    </div>
                  </div>
                </section>

                {/* PREÇOS E RENTABILIDADE */}
                <section>
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] sm:text-xs tracking-wider text-slate-500 mb-2">
                    <span className="material-symbols-outlined text-sm sm:text-base text-emerald-700">payments</span>
                    <span>Preços e Rentabilidade</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {/* Preço de Custo */}
                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Preço de Custo</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">R$ {costPrice.toFixed(2).replace('.', ',')}</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Última compra</span>
                    </div>

                    {/* Preço de Venda */}
                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Preço de Venda</span>
                      <span className="text-base sm:text-lg font-bold text-emerald-800 mt-0.5">R$ {price.toFixed(2).replace('.', ',')}</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1">Tabela Padrão</span>
                    </div>

                    {/* Margem de Lucro Bruta */}
                    <div className="col-span-2 sm:col-span-1 bg-emerald-50/80 p-2.5 sm:p-3 rounded-xl border border-emerald-200 shadow-2xs flex items-center justify-between sm:flex-col sm:items-start">
                      <div>
                        <span className="text-[10px] sm:text-xs text-emerald-800 font-medium block">Margem de Lucro Bruta</span>
                        <span className="text-sm sm:text-base font-extrabold text-emerald-700">
                          {profitMargin}% <span className="text-xs font-semibold text-emerald-600">(+R$ {profit.toFixed(2).replace('.', ',')})</span>
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-white/80 border border-emerald-300 px-2 py-1 rounded-lg mt-1">
                        <span className="material-symbols-outlined text-xs text-emerald-600">trending_up</span>
                        <span>Rentabilidade alta</span>
                      </span>
                    </div>
                  </div>
                </section>

                {/* CONTROLE DE ESTOQUE */}
                <section>
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] sm:text-xs tracking-wider text-slate-500 mb-2">
                    <span className="material-symbols-outlined text-sm sm:text-base text-emerald-700">warehouse</span>
                    <span>Controle de Estoque</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {/* Estoque Atual */}
                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Estoque Atual</span>
                      <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                        {prod.stock} <span className="text-[11px] sm:text-xs font-normal text-slate-500">un.</span>
                      </div>
                      <span className={
                        "inline-block mt-1 text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded border " +
                        (prod.stock > 30 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                          : prod.stock > 0 
                          ? 'bg-amber-100 text-amber-800 border-amber-200' 
                          : 'bg-rose-100 text-rose-800 border-rose-200')
                      }>
                        {prod.stock > 30 ? 'Nível Saudável' : prod.stock > 0 ? 'Estoque Baixo' : 'Esgotado'}
                      </span>
                    </div>

                    {/* Estoque Mínimo */}
                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Mínimo</span>
                      <div className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
                        {prod.minStock || 30} <span className="text-[11px] sm:text-xs font-normal text-slate-500">un.</span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-1">Ponto de reposição</span>
                    </div>

                    {/* Estoque Máximo */}
                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Máximo</span>
                      <div className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
                        {prod.maxStock || 300} <span className="text-[11px] sm:text-xs font-normal text-slate-500">un.</span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-1">Capacidade total</span>
                    </div>

                    {/* Unidade */}
                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/90 shadow-2xs">
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Unidade</span>
                      <div className="text-base sm:text-lg font-bold text-slate-800 mt-0.5 uppercase">
                        {prod.unit || 'UN'}
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-1">Unidade individual</span>
                    </div>
                  </div>
                </section>

                {/* DESCRIÇÃO & DETALHES OPERACIONAIS */}
                <section className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 sm:p-4 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] sm:text-xs tracking-wider text-slate-500">
                    <span className="material-symbols-outlined text-sm sm:text-base text-emerald-700">description</span>
                    <span>Descrição & Detalhes Operacionais</span>
                  </div>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-slate-600 bg-white p-2.5 sm:p-3 rounded-lg border border-slate-100">
                    {prod.description || 'Garrafa pet 500ml com gás, ideal para frigobar dos quartos e consumo rápido na recepção. Produto de alta rotatividade com validade média de 12 meses.'}
                  </p>
                  <div className="space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between pt-1 text-[11px] sm:text-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-medium shrink-0">Fornecedor:</span>
                      <span className="font-semibold text-slate-800 truncate">{prod.supplier || 'Distribuidora Fontes Claras Ltda'}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 font-medium shrink-0">Localização Interna:</span>
                      <span className="font-semibold text-slate-800">{prod.location || 'Depósito Central - Prateleira B3'}</span>
                    </div>
                  </div>
                </section>

                {/* AUDIT METADATA */}
                <div className="pt-1 text-[9.5px] sm:text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between gap-1 border-t border-slate-100">
                  <div>Criado em: <strong className="font-medium text-slate-600">{prod.createdAt || '12/01/2025 às 10:34'}</strong> por <strong className="font-medium text-slate-600">{prod.createdBy || 'Gerência'}</strong></div>
                  <div>Última atualização: <strong className="font-medium text-slate-600">{prod.updatedAt || '04/03/2025 às 14:18'}</strong></div>
                </div>

              </div>

              {/* MODAL ACTIONS FOOTER */}
              <footer className="bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  onClick={() => setSelectedProductForView(null)}
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 bg-[#b91c1c] hover:bg-red-800 active:scale-95 text-white font-bold text-xs sm:text-sm py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                  <span>Fechar</span>
                </button>
                <button
                  onClick={() => {
                    const targetProd = prod;
                    setSelectedProductForView(null);
                    handleOpenEdit(targetProd);
                  }}
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 bg-[#EA580C] hover:bg-orange-700 active:scale-95 text-white font-semibold text-xs sm:text-sm py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  <span>Editar Produto</span>
                </button>
              </footer>

            </div>
          </div>
        );
      })()}

      {/* MODAL EDITAR PRODUTO */}
      {selectedProductForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xl">
                  <span className="material-symbols-outlined">edit</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Editar Produto</h3>
                  <p className="text-xs text-slate-500">Altere as informações cadastrais do produto</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductForEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  >
                    <option value="Bebidas">Bebidas</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Higiene">Higiene</option>
                    <option value="Souvenirs">Souvenirs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Estoque
                  </label>
                  <input
                    type="number"
                    value={editStock}
                    onChange={(e) => setEditStock(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="esgotado">Esgotado</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedProductForEdit(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#003400] text-white text-xs font-semibold hover:bg-[#002200]"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListagemProdutos;
