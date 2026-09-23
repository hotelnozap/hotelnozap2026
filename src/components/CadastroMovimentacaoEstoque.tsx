import React, { useState, useRef, useEffect } from 'react';
import { produtosService } from '../services/supabaseService';

export interface CadastroMovimentacaoEstoqueProps {
  onBack: () => void;
  onSaveSuccess?: () => void;
  onNavigateToNovoProduto?: () => void;
}

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  costPrice: number;
}

const INITIAL_PRODUCTS: ProductOption[] = [];

export const CadastroMovimentacaoEstoque: React.FC<CadastroMovimentacaoEstoqueProps> = ({
  onBack,
  onSaveSuccess,
  onNavigateToNovoProduto
}) => {
  const [movementType, setMovementType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [productsList, setProductsList] = useState<ProductOption[]>(INITIAL_PRODUCTS);
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  useEffect(() => {
    produtosService.getProdutos().then((prods) => {
      const list: ProductOption[] = (prods || []).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit || 'Unidade',
        currentStock: p.stock,
        costPrice: p.costPrice || 0
      }));
      setProductsList(list);
      if (list.length > 0) {
        setSelectedProductId(list[0].id);
        setProductSearchQuery(`${list[0].code} - ${list[0].name}`);
        setUnitCost(list[0].costPrice);
      }
    });
  }, []);
  
  // Searchable Combobox State
  const selectedProduct = productsList.find(p => p.id === selectedProductId);
  const [productSearchQuery, setProductSearchQuery] = useState<string>(
    selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : ''
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(selectedProduct ? selectedProduct.costPrice : 3.50);
  
  // Dynamic reason options state
  const [reasonOptions, setReasonOptions] = useState([
    { value: 'reposicao', label: 'Compra p/ Reposição' },
    { value: 'consumo_hospede', label: 'Consumo de Hóspede (Frigobar/Restaurante)' },
    { value: 'consumo_interno', label: 'Consumo Interno / Limpeza' },
    { value: 'avaria', label: 'Avaria / Perda / Quebra' },
    { value: 'validade', label: 'Validade Expirada' },
    { value: 'inventario', label: 'Ajuste de Balanço / Inventário' },
    { value: 'outros', label: 'Outros Motivos' },
  ]);
  const [reason, setReason] = useState<string>('reposicao');

  // Modal state for Novo Motivo / Justificativa
  const [isNovoMotivoModalOpen, setIsNovoMotivoModalOpen] = useState(false);
  const [novoMotivoNome, setNovoMotivoNome] = useState('');
  const [novoMotivoObs, setNovoMotivoObs] = useState('');

  const [documentRef, setDocumentRef] = useState<string>('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSaveNovoMotivo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoMotivoNome.trim()) return;

    const newValue = novoMotivoNome.toLowerCase().trim().replace(/\s+/g, '_') + '_' + Date.now();
    const newOption = {
      value: newValue,
      label: novoMotivoNome.trim(),
    };

    setReasonOptions(prev => [...prev, newOption]);
    setReason(newValue);
    setIsNovoMotivoModalOpen(false);
    setNovoMotivoNome('');
    setNovoMotivoObs('');

    setToastMessage(`Motivo "${newOption.label}" cadastrado com sucesso!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products by approximate search (name, code, category)
  const filteredProducts = productsList.filter(p => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return p.name.toLowerCase().includes(query) ||
           p.code.toLowerCase().includes(query) ||
           p.category.toLowerCase().includes(query);
  });

  const handleSelectProduct = (prod: ProductOption) => {
    setSelectedProductId(prod.id);
    setProductSearchQuery(`${prod.code} - ${prod.name}`);
    setUnitCost(prod.costPrice);
    setIsDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) return;

    setToastMessage(`Movimentação de ${movementType === 'entrada' ? 'Entrada' : movementType === 'saida' ? 'Saída' : 'Ajuste'} registrada com sucesso!`);
    
    setTimeout(() => {
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        onBack();
      }
    }, 1200);
  };

  const calculatedTotal = (quantity * unitCost).toFixed(2);

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-5xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* BOTAO VOLTAR & CABEÇALHO */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onBack}
          className="self-start flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para Estoque</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Registrar Movimentação de Estoque
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Faça a entrada, saída ou ajuste de inventário dos produtos em estoque.
            </p>
          </div>
        </div>
      </div>

      {/* FORMULARIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 flex flex-col gap-6">

        {/* 1. SELETOR TIPO DE MOVIMENTAÇÃO */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
            Tipo de Movimentação
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setMovementType('entrada')}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer ${
                movementType === 'entrada'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-emerald-600 text-xl">arrow_downward</span>
              <span>Entrada (+)</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType('saida')}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer ${
                movementType === 'saida'
                  ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-rose-600 text-xl">arrow_upward</span>
              <span>Saída (-)</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType('ajuste')}
              className={`flex items-center justify-center gap-2 p-3.5 rounded-xl font-bold text-sm border-2 transition-all cursor-pointer ${
                movementType === 'ajuste'
                  ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-amber-600 text-xl">tune</span>
              <span>Ajuste (=)</span>
            </button>
          </div>
        </div>

        {/* 2. SELEÇÃO DO PRODUTO (BUSCA APROXIMADA COM BOTÃO + DENTRO DA LINHA) */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Produto em Estoque * (Digite para Buscar)
          </label>
          <div className="flex items-center gap-2">
            
            {/* COMBOBOX DE BUSCA APROXIMADA */}
            <div className="relative flex-1" ref={comboboxRef}>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-xl pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Digite o nome, código ou categoria do produto..."
                  value={productSearchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  className="w-full pl-11 pr-10 py-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]/30 focus:border-[#003400] transition-all"
                />
                {productSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearchQuery('');
                      setIsDropdownOpen(true);
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                    title="Limpar Busca"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>

              {/* LISTA DROPDOWN DE RESULTADOS DA BUSCA */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => {
                      const isSelected = p.id === selectedProductId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className={`px-4 py-3 cursor-pointer text-sm transition-colors flex items-center justify-between ${
                            isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-500 font-semibold">{p.code}</span>
                              <span className="font-bold text-slate-900">{p.name}</span>
                            </div>
                            <span className="text-xs text-slate-500">{p.category}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold text-slate-600 block">Estoque Atual:</span>
                            <span className={`text-xs font-bold ${p.currentStock <= 15 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {p.currentStock} {p.unit}(s)
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">
                      Nenhum produto encontrado para "{productSearchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BOTÃO + QUE ABRE A TELA DE CADASTRO DE NOVO PRODUTO DO SISTEMA */}
            <button
              type="button"
              onClick={() => {
                if (onNavigateToNovoProduto) {
                  onNavigateToNovoProduto();
                }
              }}
              className="bg-[#d1fae5] hover:bg-emerald-200 border border-emerald-400 text-black font-bold p-3.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
              title="Cadastrar Novo Produto (Abre Formulário do Sistema)"
            >
              <span className="material-symbols-outlined text-xl text-black font-bold">add</span>
            </button>

          </div>

          {selectedProduct && (
            <p className="text-xs text-slate-500 mt-1">
              Produto Selecionado: <strong className="text-slate-900">{selectedProduct.code} - {selectedProduct.name}</strong> • Estoque atual em sistema: <strong className="text-slate-900">{selectedProduct.currentStock} {selectedProduct.unit}(s)</strong>
            </p>
          )}
        </div>

        {/* 3. QUANTIDADE, CUSTO UNITÁRIO E VALOR TOTAL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Quantidade */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Quantidade *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-11 h-11 rounded-xl border border-slate-300 flex items-center justify-center font-extrabold text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-center py-2.5 border border-slate-300 rounded-xl font-extrabold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-11 h-11 rounded-xl border border-slate-300 flex items-center justify-center font-extrabold text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                +
              </button>
            </div>
          </div>

          {/* Custo Unitário */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Custo Unitário (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
              />
            </div>
          </div>

          {/* Valor Total (Calculado) */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Valor Total Estimado
            </label>
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-black text-slate-900 text-lg flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">R$</span>
              <span>{calculatedTotal}</span>
            </div>
          </div>

        </div>

        {/* 4. MOTIVO, DOCUMENTO E DATA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Motivo */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Motivo / Justificativa *
            </label>
            <div className="flex items-center gap-2">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#003400]/30 cursor-pointer"
              >
                {reasonOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsNovoMotivoModalOpen(true)}
                className="bg-[#d1fae5] hover:bg-emerald-200 border border-emerald-400 text-black font-bold p-2.5 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-sm"
                title="Cadastrar Novo Motivo / Justificativa"
              >
                <span className="material-symbols-outlined text-xl text-black font-bold">add</span>
              </button>
            </div>
          </div>

          {/* Documento Ref */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Doc. / NF / Nº Pedido (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: NF-10492 ou RES-8821"
              value={documentRef}
              onChange={(e) => setDocumentRef(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
            />
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Data da Movimentação
            </label>
            <input
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/30 cursor-pointer"
            />
          </div>

        </div>

        {/* 5. OBSERVAÇÕES */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Observações Adicionais (Opcional)
          </label>
          <textarea
            rows={3}
            placeholder="Detalhes sobre fornecedor, recebedor ou motivo do ajuste..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
          />
        </div>

        {/* BOTÕES DE AÇÃO DO FORMULÁRIO */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">check</span>
            <span>Salvar Movimentação</span>
          </button>
        </div>

      </form>

      {/* MODAL NOVO MOTIVO / JUSTIFICATIVA */}
      {isNovoMotivoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl">format_list_bulleted</span>
                <h3 className="font-bold text-base">Novo Motivo / Justificativa</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNovoMotivoModalOpen(false)}
                className="bg-[#b91c1c] hover:bg-[#991b1b] text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveNovoMotivo} className="p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Motivo / Justificativa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Amostras p/ Eventos, Testes de Qualidade..."
                  value={novoMotivoNome}
                  onChange={(e) => setNovoMotivoNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Observações (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalhes ou regras de uso para esta justificativa..."
                  value={novoMotivoObs}
                  onChange={(e) => setNovoMotivoObs(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 mt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNovoMotivoModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-lg">check</span>
                  <span>Salvar Motivo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CadastroMovimentacaoEstoque;

