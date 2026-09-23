import React, { useState } from 'react';
import { tiposQuartosService } from '../services/supabaseService';
import { RoomTypeData } from './ListagemTiposQuartos';

export interface CadastroTipoQuartoProps {
  onBack: () => void;
  onSaveSuccess?: () => void;
  tipoToEdit?: RoomTypeData | null;
}

export const CadastroTipoQuarto: React.FC<CadastroTipoQuartoProps> = ({ onBack, onSaveSuccess, tipoToEdit }) => {
  const [status, setStatus] = useState<'ativo' | 'inativo'>(tipoToEdit?.status || 'ativo');
  const [nomeTipo, setNomeTipo] = useState(tipoToEdit?.name || '');
  const [capacidade, setCapacidade] = useState(tipoToEdit?.capacity ? String(tipoToEdit.capacity) : '2');
  const [ordenacao, setOrdenacao] = useState('1');
  const [observacao, setObservacao] = useState(tipoToEdit?.description || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeTipo.trim()) {
      alert('Por favor, informe o nome do tipo de quarto.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: nomeTipo.trim(),
      description: observacao.trim() || 'Sem observações adicionais.',
      capacity: Number(capacidade) || 2,
      status: status,
    };

    if (tipoToEdit) {
      await tiposQuartosService.updateTipoQuarto(tipoToEdit.id, payload);
    } else {
      await tiposQuartosService.createTipoQuarto(payload);
    }

    setIsSubmitting(false);
    setIsSaved(true);

    setTimeout(() => {
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        onBack();
      }
    }, 800);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-3xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* LINK DE RETORNO */}
      <div>
        <button 
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#003400] hover:text-emerald-950 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para Tipos de Quartos</span>
        </button>
      </div>

      {/* CARD PRINCIPAL DO FORMULÁRIO */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-10 space-y-6">

        {/* CABEÇALHO DO CARD COM TÍTULO E SWITCH DE STATUS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-50 text-[#003400] flex items-center justify-center shrink-0 border border-violet-100">
              <span className="material-symbols-outlined text-2xl">meeting_room</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                Cadastro de Tipo de Quarto
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Defina o nome, ordenação de exibição e observações da acomodação
              </p>
            </div>
          </div>

          {/* SWITCH DE STATUS (ATIVO / INATIVO) */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">Status:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={status === 'ativo'} 
                onChange={(e) => setStatus(e.target.checked ? 'ativo' : 'inativo')}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              <span className={"ml-2.5 text-xs font-bold uppercase tracking-wide " + (status === 'ativo' ? 'text-emerald-800' : 'text-slate-500')}>
                {status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </label>
          </div>
        </div>

        {/* TOAST DE SUCESSO */}
        {isSaved && (
          <div className="p-4 bg-[#d1fae5] border border-emerald-300 rounded-xl text-black font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[#003400]">check_circle</span>
            <span className="text-black font-bold">Tipo de Quarto cadastrado com sucesso! Redirecionando...</span>
          </div>
        )}

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* GRID: NOME DO TIPO, CAPACIDADE E ORDENAÇÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            {/* NOME DO TIPO (2 COLUNAS) */}
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="nomeTipo">
                Nome do Tipo <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">label</span>
                </span>
                <input 
                  id="nomeTipo"
                  type="text" 
                  required
                  value={nomeTipo} 
                  onChange={(e) => setNomeTipo(e.target.value)}
                  placeholder="Ex: Suíte Presidencial, Chalé Vista Mar..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400] transition-shadow"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Informe a denominação oficial da modalidade.</p>
            </div>

            {/* CAPACIDADE (HÓSPEDES) */}
            <div className="sm:col-span-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="capacidade">
                Capacidade <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">group</span>
                </span>
                <input 
                  id="capacidade"
                  type="number" 
                  min={1}
                  required
                  value={capacidade} 
                  onChange={(e) => setCapacidade(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#003400] transition-shadow"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Hóspedes comportados.</p>
            </div>

            {/* ORDENAÇÃO */}
            <div className="sm:col-span-3">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="ordenacao">
                Ordenação <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">format_list_numbered</span>
                </span>
                <input 
                  id="ordenacao"
                  type="number" 
                  min={1}
                  required
                  value={ordenacao} 
                  onChange={(e) => setOrdenacao(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#003400] transition-shadow"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Prioridade de exibição nas listagens.</p>
            </div>

          </div>

          {/* OBSERVAÇÃO */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2" htmlFor="observacao">
              Observação
            </label>
            <div className="relative">
              <span className="absolute top-3.5 left-3.5 flex items-start pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-lg">notes</span>
              </span>
              <textarea 
                id="observacao"
                rows={4}
                value={observacao} 
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Insira detalhes adicionais, especificações técnicas, regras de ocupação ou notas internas..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400] transition-shadow resize-none"
              ></textarea>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Observações técnicas ou recomendações operacionais.</p>
          </div>

          {/* BOTOEIRA DE AÇÕES NO RODAPÉ */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onBack}
              className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-bold transition-colors cursor-pointer inline-flex items-center justify-center"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="h-11 px-6 rounded-xl bg-[#003400] hover:bg-emerald-950 text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-2 border border-transparent"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              <span>Salvar</span>
            </button>
          </div>

        </form>

      </div>

    </div>
  );
};

export default CadastroTipoQuarto;
