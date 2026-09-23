import React, { useState, useRef } from 'react';
import { produtosService } from '../services/supabaseService';
import { uploadImageToStorage } from '../services/storageService';

export interface CadastroProdutoProps {
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroProduto: React.FC<CadastroProdutoProps> = ({ onBack, onSaveSuccess }) => {
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    unidade: 'UN',
    precoCusto: '',
    precoVenda: '',
    estoqueMinimo: '',
    estoqueMaximo: '',
    descricao: '',
    ativo: true,
  });
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const prodFileInputRef = useRef<HTMLInputElement>(null);

  const handleProductFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFotoUrl(URL.createObjectURL(file));
      const uploadedUrl = await uploadImageToStorage(file, 'produtos');
      if (uploadedUrl) {
        setFotoUrl(uploadedUrl);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    await produtosService.createProduto({
      name: formData.nome,
      category: formData.categoria || 'Geral',
      price: parseFloat(formData.precoVenda.replace(',', '.')) || 0,
      costPrice: parseFloat(formData.precoCusto.replace(',', '.')) || 0,
      stock: parseInt(formData.estoqueMinimo) || 0,
      minStock: parseInt(formData.estoqueMinimo) || 5,
      status: formData.ativo ? 'ativo' : 'inativo',
      icon: 'inventory_2'
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_produto'));
    }
    setTimeout(() => {
      setSubmitted(false);
      if (onSaveSuccess) {
        onSaveSuccess();
      } else if (onBack) {
        onBack();
      }
    }, 1200);
  };

  // Cálculo da Margem de Lucro Estimada
  const custoNum = parseFloat(formData.precoCusto.replace(',', '.')) || 0;
  const vendaNum = parseFloat(formData.precoVenda.replace(',', '.')) || 0;
  const margemCalculada = custoNum > 0 && vendaNum > custoNum ? Math.round(((vendaNum - custoNum) / custoNum) * 100) : 0;

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-5xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* LINK VOLTAR ACIMA DO TÍTULO */}
      {onBack && (
        <div>
          <button
            onClick={onBack}
            type="button"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#006c49] hover:text-[#005236] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">arrow_back</span>
            <span>Voltar para Listagem de Produtos</span>
          </button>
        </div>
      )}

      {/* HEADER DA PÁGINA (TÍTULO E SUBTÍTULO) */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Cadastro de Produto</h1>
        <p className="text-xs sm:text-sm text-slate-500">Preencha os dados do item para controle de estoque e vendas.</p>
      </div>

      {/* TOAST FEEDBACK DE SUCESSO */}
      {submitted && (
        <div className="bg-[#d1fae5] border border-emerald-300 text-black font-bold p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-xl text-[#003400]">check_circle</span>
          <span className="text-sm text-black font-bold">Produto cadastrado com sucesso! Redirecionando...</span>
        </div>
      )}

      {/* FORMULÁRIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* 1. STATUS DO PRODUTO CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-xl">toggle_on</span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Status do Produto</h2>
            </div>
            <span className="text-xs sm:text-sm text-slate-500 mt-0.5">Defina se o produto está disponível para venda e lançamento</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006c49]"></div>
            <span className={"ml-2.5 text-xs sm:text-sm font-semibold " + (formData.ativo ? 'text-[#006c49]' : 'text-slate-500')}>
              {formData.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </label>
        </div>

        {/* 2. IMAGEM DO PRODUTO CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] text-xl">photo_camera</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Imagem do Produto</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Carregar imagem do produto (coletar do celular/computador). Formatos aceitos: JPG, PNG até 5MB
          </p>

          <input
            type="file"
            ref={prodFileInputRef}
            accept="image/*"
            onChange={handleProductFileSelect}
            className="hidden"
          />

          <div
            onClick={() => prodFileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-[#006c49] rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group"
          >
            {fotoUrl ? (
              <div className="flex flex-col items-center gap-2">
                <img src={fotoUrl} alt="Pré-visualização do produto" className="h-32 w-32 object-cover rounded-xl border border-slate-200 shadow-xs" />
                <p className="text-xs font-semibold text-[#006c49]">Imagem selecionada do computador! Clique para alterar.</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-50 flex items-center justify-center mb-3 text-[#006c49] group-hover:bg-[#006c49] group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-2xl sm:text-3xl">cloud_upload</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-1">
                  <span className="hidden sm:inline">Arraste e solte o arquivo aqui ou clique para procurar</span>
                  <span className="sm:hidden">Toque para selecionar imagem</span>
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 mb-4">JPG, PNG até 5MB (Recomendado: 800x800px)</p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-[#006c49]">add_photo_alternate</span>
                  <span>Selecionar do celular/computador</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 3. INFORMAÇÕES PRINCIPAIS CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] text-xl">inventory_2</span>
            <span>Informações Principais</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
            
            {/* Categoria */}
            <div className="md:col-span-4">
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Categoria *</label>
              <select
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] cursor-pointer"
              >
                <option value="">Selecione a categoria...</option>
                <option value="Bebidas">Bebidas</option>
                <option value="Frigobar">Frigobar</option>
                <option value="Alimentos">Alimentos</option>
                <option value="Amenities">Amenities</option>
                <option value="Limpeza">Limpeza</option>
              </select>
            </div>

            {/* Nome do Produto */}
            <div className="md:col-span-5">
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Nome do Produto *</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Água Mineral sem Gás 500ml"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
              />
            </div>

            {/* Unidade de Medida */}
            <div className="md:col-span-3">
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Unidade de Medida *</label>
              <select
                value={formData.unidade}
                onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] cursor-pointer"
              >
                <option value="UN">Unidade (UN)</option>
                <option value="PCT">Pacote (PCT)</option>
                <option value="CX">Caixa (CX)</option>
                <option value="GF">Garrafa (GF)</option>
                <option value="LT">Lata (LT)</option>
                <option value="KG">Kg</option>
              </select>
            </div>

          </div>
        </div>

        {/* 4. DESCRIÇÃO CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] text-xl">description</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Descrição</h2>
          </div>
          <textarea
            rows={4}
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            placeholder="Informações detalhadas sobre o produto..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] resize-y"
          />
        </div>

        {/* 5. VALORES E PREÇOS CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] text-xl">payments</span>
            <span>Valores e Preços</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
            
            {/* Preço de Custo */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Preço de Custo *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-semibold text-xs sm:text-sm">R$</span>
                <input
                  type="text"
                  required
                  value={formData.precoCusto}
                  onChange={(e) => setFormData({ ...formData, precoCusto: e.target.value })}
                  placeholder="2,50"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                />
              </div>
            </div>

            {/* Preço de Venda */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Preço de Venda *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-semibold text-xs sm:text-sm">R$</span>
                <input
                  type="text"
                  required
                  value={formData.precoVenda}
                  onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
                  placeholder="6,00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                />
              </div>
            </div>

            {/* Lucro Estimado */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Lucro Estimado</label>
              <div className="h-[42px] px-3.5 rounded-lg bg-blue-50/70 flex items-center justify-between border border-blue-100">
                <span className="text-xs text-slate-600 font-medium">Margem Calculada:</span>
                <span className="text-xs text-[#006c49] font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Margem: {margemCalculada}%
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* 6. GESTÃO DE ESTOQUE CARD */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] text-xl">warehouse</span>
            <span>Gestão de Estoque</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            
            {/* Estoque Mínimo */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1 flex items-center gap-1">
                <span>Estoque Mínimo *</span>
                <span className="material-symbols-outlined text-[16px] text-amber-500" title="Aviso de estoque baixo">warning</span>
              </label>
              <input
                type="number"
                required
                value={formData.estoqueMinimo}
                onChange={(e) => setFormData({ ...formData, estoqueMinimo: e.target.value })}
                placeholder="Ex: 10"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
              />
              <span className="text-[11px] sm:text-xs text-slate-500 mt-1 block">Alerta automático para reposição quando atingir este limite</span>
            </div>

            {/* Estoque Máximo */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1">Estoque Máximo</label>
              <input
                type="number"
                value={formData.estoqueMaximo}
                onChange={(e) => setFormData({ ...formData, estoqueMaximo: e.target.value })}
                placeholder="Ex: 100"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
              />
              <span className="text-[11px] sm:text-xs text-slate-500 mt-1 block">Capacidade máxima recomendada para armazenagem</span>
            </div>

          </div>
        </div>

        {/* 7. RODAPÉ DE AÇÕES DESKTOP */}
        <div className="hidden md:flex items-center justify-end gap-4 pt-4 pb-8">
          <button
            onClick={onBack}
            type="button"
            className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition-colors cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>Salvar Produto</span>
          </button>
        </div>

        {/* 7. RODAPÉ DE AÇÕES MOBILE */}
        <div className="flex md:hidden flex-col gap-2.5 pt-2 pb-6">
          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg bg-[#003400] hover:bg-black text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-colors active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>Salvar Produto</span>
          </button>
          <button
            onClick={onBack}
            type="button"
            className="w-full py-3 px-4 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>

      </form>

    </div>
  );
};

export default CadastroProduto;

