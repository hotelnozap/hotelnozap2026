import React, { useState } from 'react';
import { itensQuartosService } from '../services/supabaseService';

export interface CadastroItemProps {
  onBack: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroItem: React.FC<CadastroItemProps> = ({ onBack, onSaveSuccess }) => {
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o nome do item.');
      return;
    }

    await itensQuartosService.createItem({
      name: name.trim(),
      description: description.trim(),
      icon: 'inventory_2',
      status,
    });

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
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-2xl mx-auto flex flex-col gap-5 pb-24 lg:pb-12">
      
      {/* LINK DE VOLTAR */}
      <div>
        <button 
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-[#003400] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para Itens dos Quartos</span>
        </button>
      </div>

      {/* CARD PRINCIPAL DO FORMULÁRIO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        
        {/* CABEÇALHO DO CARD */}
        <div className="px-6 sm:px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#003400] flex items-center justify-center text-xl shrink-0">
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Cadastro de Novo Item</h1>
              <p className="text-xs text-slate-500 mt-0.5">Cadastre itens e comodidades para vincular aos quartos do hotel</p>
            </div>
          </div>

          {/* SWITCH DE STATUS */}
          <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/60 self-start sm:self-auto">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={status === 'ativo'} 
                onChange={(e) => setStatus(e.target.checked ? 'ativo' : 'inativo')}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
            </label>
            <span className={"text-xs font-bold " + (status === 'ativo' ? 'text-emerald-800' : 'text-slate-500')}>
              {status === 'ativo' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* TOAST DE SUCESSO */}
          {isSaved && (
            <div className="p-4 bg-[#d1fae5] border border-emerald-300 rounded-xl text-black font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
              <span className="material-symbols-outlined text-[#003400]">check_circle</span>
              <span className="text-black font-bold">Item cadastrado com sucesso! Redirecionando...</span>
            </div>
          )}

          {/* CAMPO NOME DO ITEM */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="nomeItem">
              Nome do Item <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-lg">label</span>
              </div>
              <input 
                type="text" 
                id="nomeItem"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cama King Size, Ar-condicionado Split, Frigobar..." 
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Nome exibido na ficha do quarto e nas listas de comodidades.</p>
          </div>

          {/* CAMPO DESCRIÇÃO / DETALHES */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="descricaoItem">
              Descrição / Detalhes
            </label>
            <div className="relative">
              <textarea 
                id="descricaoItem"
                rows={4} 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva detalhes adicionais sobre o item, modelo, voltagem ou especificações..."
                className="w-full p-3.5 bg-slate-50/50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all resize-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Informações opcionais para controle da equipe ou governança.</p>
          </div>

          {/* RODAPÉ DE AÇÕES */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button 
              type="button" 
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            
            <button 
              type="submit" 
              className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-sm font-semibold shadow-sm hover:shadow transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>Salvar Item</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default CadastroItem;
