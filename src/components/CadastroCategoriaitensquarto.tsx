import React, { useState, useEffect } from 'react';
import { categoriasQuartosService, CategoriaQuartoData } from '../services/supabaseService';

export interface CadastroCategoriaitensquartoProps {
  categoriaToEdit?: CategoriaQuartoData | null;
  onBack: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroCategoriaitensquarto: React.FC<CadastroCategoriaitensquartoProps> = ({ 
  categoriaToEdit, 
  onBack, 
  onSaveSuccess 
}) => {
  const [status, setStatus] = useState<'ativa' | 'inativa'>('ativa');
  const [name, setName] = useState('');
  const [order, setOrder] = useState('1');
  const [observation, setObservation] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (categoriaToEdit) {
      setName(categoriaToEdit.name || '');
      setOrder(String(categoriaToEdit.ordenacao || 1));
      setObservation(categoriaToEdit.description || '');
      setStatus(categoriaToEdit.status === 'ativo' ? 'ativa' : 'inativa');
    } else {
      setName('');
      setOrder('1');
      setObservation('');
      setStatus('ativa');
    }
  }, [categoriaToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome da categoria.');
      return;
    }

    if (categoriaToEdit) {
      await categoriasQuartosService.updateCategoria(categoriaToEdit.id, {
        name: name.trim(),
        description: observation.trim(),
        ordenacao: parseInt(order) || 1,
        status: status === 'ativa' ? 'ativo' : 'inativo',
      });
    } else {
      await categoriasQuartosService.createCategoria({
        name: name.trim(),
        description: observation.trim(),
        icon: 'king_bed',
        ordenacao: parseInt(order) || 1,
        status: status === 'ativa' ? 'ativo' : 'inativo',
      });
    }

    setIsSaved(true);
    setTimeout(() => {
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        onBack();
      }
    }, 600);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-3xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* LINK DE RETORNO */}
      <div>
        <button 
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para Categorias dos Quartos</span>
        </button>
      </div>

      {/* CARD PRINCIPAL DO FORMULÁRIO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-10 space-y-6">

        {/* CABEÇALHO DO CARD COM TÍTULO E SWITCH DE STATUS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#003400] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">category</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                {categoriaToEdit ? 'Editar Categoria do Quarto' : 'Cadastro de Categoria'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {categoriaToEdit ? `Alterando dados da categoria ${categoriaToEdit.name}` : 'Defina os dados e parâmetros da categoria de acomodação'}
              </p>
            </div>
          </div>

          {/* SWITCH DE STATUS (ATIVA / INATIVA) */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">Status:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={status === 'ativa'} 
                onChange={(e) => setStatus(e.target.checked ? 'ativa' : 'inativa')}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              <span className={"ml-2.5 text-xs font-bold uppercase tracking-wide " + (status === 'ativa' ? 'text-emerald-800' : 'text-slate-500')}>
                {status === 'ativa' ? 'Ativa' : 'Inativa'}
              </span>
            </label>
          </div>
        </div>

        {/* TOAST DE SUCESSO */}
        {isSaved && (
          <div className="p-4 bg-[#d1fae5] border border-emerald-300 rounded-xl text-black font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[#003400]">check_circle</span>
            <span className="text-black font-bold">Categoria cadastrada com sucesso! Redirecionando...</span>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* GRID: NOME DA CATEGORIA E ORDENAÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            {/* NOME DA CATEGORIA (OCUPA 2 COLUNAS NO DESKTOP) */}
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="nomeCategoria">
                Nome da Categoria <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-xl">meeting_room</span>
                </span>
                <input 
                  type="text" 
                  id="nomeCategoria"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                  placeholder="Ex: Suíte Presidencial, Chalé Família, Standard Casal" 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all text-sm font-medium"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Nome identificador exibido nos mapas, reservas e orçamentos.</p>
            </div>

            {/* ORDENAÇÃO (OCUPA 1 COLUNA NO DESKTOP) */}
            <div className="sm:col-span-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="ordenacao">
                Ordenação <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-xl">format_list_numbered</span>
                </span>
                <input 
                  type="number" 
                  id="ordenacao"
                  min="1" 
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  required 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all text-sm font-medium"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">Prioridade de exibição na lista.</p>
            </div>

          </div>

          {/* OBSERVAÇÃO */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="observacao">
              Observação
            </label>
            <div className="relative">
              <textarea 
                id="observacao"
                rows={5} 
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Digite observações internas, particularidades ou anotações sobre esta categoria..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all text-sm font-medium resize-none"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">Informações opcionais para controle interno da equipe e recepção.</p>
          </div>

          {/* AÇÕES DO RODAPÉ (DESKTOP E MOBILE) */}
          <div className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button 
              type="button" 
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button 
              type="submit" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002200] text-white font-semibold text-sm transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>{categoriaToEdit ? 'Salvar Alterações' : 'Salvar Categoria'}</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};

export default CadastroCategoriaitensquarto;
