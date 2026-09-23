import React, { useState } from 'react';
import { categoriasService } from '../services/supabaseService';

export interface CadastroCategoriaContaReceberProps {
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroCategoriaContaReceber: React.FC<CadastroCategoriaContaReceberProps> = ({
  onBack,
  onSaveSuccess,
}) => {
  const [status, setStatus] = useState<boolean>(true);
  const [ordem, setOrdem] = useState<number>(1);
  const [nome, setNome] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      showToast('Por favor, preencha o nome da categoria.');
      return;
    }

    await categoriasService.createCategoriaContaReceber(nome, descricao);

    showToast(`Categoria "${nome}" salva com sucesso!`);

    setTimeout(() => {
      if (onSaveSuccess) {
        onSaveSuccess();
      } else if (onBack) {
        onBack();
      }
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-3xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 text-slate-800 font-sans antialiased">
      
      {/* TOAST SYSTEM STANDARD (VERDE CLARO COM FONTE PRETA E NEGRITO) */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{toastMessage}</span>
        </div>
      )}

      {/* 1. LINK DE RETORNO (ACIMA DO TÍTULO) */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer w-fit"
          >
            <span className="material-symbols-outlined text-base sm:text-lg">arrow_back</span>
            <span>Voltar para Categorias de Contas a Receber</span>
          </button>
        </div>
      )}

      {/* 2. CABEÇALHO DO FORMULÁRIO */}
      <header className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Cadastro de Categoria de Recebível
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Preencha os dados da categoria para organização e controle das contas a receber.
        </p>
      </header>

      {/* 3. FORMULÁRIO PRINCIPAL E CARDS */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* CARD 1: STATUS E ORDENAÇÃO */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#003400] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">category</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Situação da Categoria</h3>
              <p className="text-xs text-slate-500">Defina a visibilidade no sistema e a ordem de exibição.</p>
            </div>
          </div>

          {/* TOGGLE STATUS SWITCH PADRÃO SISTEMA */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={status}
                onChange={(e) => setStatus(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
            </label>
            <span className={`text-xs sm:text-sm font-bold ${status ? 'text-emerald-700' : 'text-slate-500'}`}>
              {status ? 'Ativa' : 'Inativa'}
            </span>
          </div>
        </div>

        {/* CARD 2: DADOS DA CATEGORIA */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Nome da Categoria */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nome da Categoria <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Hospedagem & Diárias, Consumo Frigobar..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all font-semibold text-slate-900"
                  required
                />
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg font-normal">label</span>
              </div>
            </div>

            {/* Ordenação */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ordenação <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={ordem}
                  onChange={(e) => setOrdem(parseInt(e.target.value) || 1)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-sm bg-slate-50/50 focus:bg-white transition-all font-semibold text-slate-900"
                  required
                />
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg font-normal">format_list_numbered</span>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Descrição / Detalhes da Categoria
            </label>
            <textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o tipo de receita ou serviços cujos recebíveis serão alocados nesta categoria..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#003400] text-xs sm:text-sm bg-slate-50/50 focus:bg-white transition-all text-slate-800"
            />
          </div>
        </div>

        {/* 4. BOTÕES DE AÇÃO INFERIOR */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-sm text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#003400] hover:bg-emerald-950 font-semibold text-sm text-white transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Salvar Categoria</span>
          </button>
        </div>

      </form>
    </div>
  );
};

export default CadastroCategoriaContaReceber;
