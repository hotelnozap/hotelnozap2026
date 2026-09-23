import React, { useState, useRef } from 'react';
import { categoriasService } from '../services/supabaseService';

export interface CadastroCategoriaProdutoProps {
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroCategoriaProduto: React.FC<CadastroCategoriaProdutoProps> = ({
  onBack,
  onSaveSuccess,
}) => {
  const [status, setStatus] = useState<boolean>(true);
  const [ordem, setOrdem] = useState<number>(1);
  const [nome, setNome] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFotoUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    setSubmitted(true);
    await categoriasService.createCategoriaProduto(nome, descricao);
    setTimeout(() => {
      setSubmitted(false);
      if (onSaveSuccess) {
        onSaveSuccess();
      } else if (onBack) {
        onBack();
      }
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-4xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* 1. LINK DE RETORNO (ACIMA DO TÍTULO) */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-800 hover:text-emerald-900 transition-colors cursor-pointer w-fit"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">arrow_back</span>
            <span>Voltar para Listagem de Categorias</span>
          </button>
        </div>
      )}

      {/* 2. CABEÇALHO DO FORMULÁRIO */}
      <header className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Cadastro de Categoria
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Preencha os dados da categoria para organização e controle dos produtos e serviços.
        </p>
      </header>

      {/* FEEDBACK TOAST DE SUCESSO */}
      {submitted && (
        <div className="bg-[#d1fae5] border border-emerald-300 text-black font-bold p-4 rounded-xl flex items-center gap-3 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">Categoria salva com sucesso!</span>
        </div>
      )}

      {/* FORMULÁRIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* INPUT DE ARQUIVO OCULTO */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />

        {/* CARD 1: STATUS E ORDENAÇÃO */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            
            {/* TOGGLE STATUS */}
            <div className="flex items-center justify-between">
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                  <span className="material-symbols-outlined text-emerald-700 text-lg">toggle_on</span>
                  Status da Categoria
                </label>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina se a categoria está visível e disponível para associação.
                </p>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={status}
                  onChange={(e) => setStatus(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
                <span className="ml-2.5 text-xs sm:text-sm font-medium text-emerald-800 peer-checked:font-bold">
                  {status ? 'Ativa' : 'Inativa'}
                </span>
              </label>
            </div>

            {/* CAMPO DE ORDENAÇÃO */}
            <div>
              <label htmlFor="ordem" className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
                <span className="material-symbols-outlined text-emerald-700 text-lg">format_list_numbered</span>
                Ordem de Exibição
              </label>
              <input
                type="number"
                id="ordem"
                name="ordem"
                value={ordem}
                min={1}
                onChange={(e) => setOrdem(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white outline-none transition-all"
                placeholder="Ex: 1, 2, 3..."
              />
              <p className="text-xs text-slate-400 mt-1">
                Ordem de prioridade exibida nos menus e listagens.
              </p>
            </div>

          </div>
        </section>

        {/* CARD 2: IMAGEM DA CATEGORIA */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
              <span className="material-symbols-outlined text-emerald-700 text-lg">image</span>
              Imagem da Categoria
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Carregar ícone ou imagem de destaque da categoria (coletar do computador). Formatos: JPG, PNG até 5MB.
            </p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-700 rounded-xl p-6 sm:p-8 text-center bg-slate-50 hover:bg-emerald-50/30 transition-all cursor-pointer flex flex-col items-center justify-center"
          >
            {fotoUrl ? (
              <div className="relative group">
                <img
                  src={fotoUrl}
                  alt="Pré-visualização"
                  className="w-32 h-32 object-cover rounded-xl border border-slate-300 shadow-xs"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFotoUrl(null);
                  }}
                  className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700 transition-colors"
                  title="Remover Imagem"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-700">
                  Arraste e solte o arquivo aqui ou clique para procurar
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  JPG, PNG até 5MB (Recomendado: 800x800px)
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                    <span>Selecionar arquivo do computador</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* CARD 3: INFORMAÇÕES PRINCIPAIS */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
            <span className="material-symbols-outlined text-emerald-700 text-lg">category</span>
            Informações Principais
          </h2>
          <div>
            <label htmlFor="nome" className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
              Nome da Categoria <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="nome"
              name="nome"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white outline-none transition-all"
              placeholder="Ex: Bebidas, Snacks & Petiscos, Higiene & Amenities..."
            />
          </div>
        </section>

        {/* CARD 4: DESCRIÇÃO */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
            <span className="material-symbols-outlined text-emerald-700 text-lg">description</span>
            Descrição
          </h2>
          <div>
            <label htmlFor="descricao" className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5">
              Descrição Detalhada
            </label>
            <textarea
              id="descricao"
              name="descricao"
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 focus:bg-white outline-none transition-all resize-y"
              placeholder="Informações detalhadas sobre os produtos e serviços desta categoria..."
            />
          </div>
        </section>

        {/* BOTÕES DE AÇÃO DO RODAPÉ (DESKTOP E MOBILE) */}
        <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3 pt-4 border-t border-slate-200">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer text-center"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#003400] hover:bg-[#002800] text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Salvar Categoria</span>
          </button>
        </div>

      </form>
    </div>
  );
};

export default CadastroCategoriaProduto;
