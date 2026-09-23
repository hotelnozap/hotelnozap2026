import React, { useState } from 'react';
import { categoriasHoteisService, CategoriaHotelData } from '../services/supabaseService';

export interface CadastroCategoriaHotelProps {
  categoriaToEdit?: CategoriaHotelData | null;
  onBack: () => void;
  onSaveSuccess: () => void;
}

const AVAILABLE_ICONS = [
  { id: 'domain', label: 'Hotel Clássico' },
  { id: 'apartment', label: 'Prédio Urbano' },
  { id: 'villa', label: 'Pousada / Villa' },
  { id: 'beach_access', label: 'Resort Praia' },
  { id: 'cabin', label: 'Chalé / Rústico' },
  { id: 'holiday_village', label: 'Eco Village' },
  { id: 'forest', label: 'Hotel Fazenda' },
  { id: 'bed', label: 'Hostel / Cama' },
  { id: 'pool', label: 'Parque Aquático' },
  { id: 'spa', label: 'Spa & Wellness' },
  { id: 'landscape', label: 'Montanha / Serra' },
  { id: 'hotel_class', label: 'Luxo / Estrelas' },
];

export const CadastroCategoriaHotel: React.FC<CadastroCategoriaHotelProps> = ({
  categoriaToEdit,
  onBack,
  onSaveSuccess
}) => {
  const isEditing = Boolean(categoriaToEdit && categoriaToEdit.id);

  const [name, setName] = useState(categoriaToEdit?.name || '');
  const [description, setDescription] = useState(categoriaToEdit?.description || '');
  const [icon, setIcon] = useState(categoriaToEdit?.icon || 'domain');
  const [status, setStatus] = useState<'ativo' | 'inativo'>(categoriaToEdit?.status === 'inativo' ? 'inativo' : 'ativo');
  const [order, setOrder] = useState<number | string>(categoriaToEdit?.order !== undefined ? categoriaToEdit.order : 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome da categoria.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (isEditing && categoriaToEdit) {
        const res = await categoriasHoteisService.updateCategoria(categoriaToEdit.id, {
          name: name.trim(),
          description: description.trim(),
          icon,
          status,
          order: Number(order) || 1
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Erro ao atualizar categoria.');
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await categoriasHoteisService.createCategoria({
          name: name.trim(),
          description: description.trim(),
          icon,
          status,
          order: Number(order) || 1
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Erro ao cadastrar categoria.');
          setIsSubmitting(false);
          return;
        }
      }

      onSaveSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao processar operação.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 md:p-8 text-slate-800">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Topbar / Voltar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-slate-600 hover:text-[#003400] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Voltar para Lista de Categorias</span>
          </button>
        </div>

        {/* Card Principal */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Header do Card */}
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center gap-4 bg-gradient-to-r from-slate-50 to-white">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-2xl">{icon || 'domain'}</span>
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                Categorias de Hospedagem
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                {isEditing ? `Editar Categoria: ${categoriaToEdit?.name}` : 'Cadastrar Nova Categoria'}
              </h1>
              <p className="text-xs text-slate-500">
                Categorias definem os tipos de acomodações hoteleiras disponíveis no sistema e catálogo.
              </p>
            </div>
          </div>

          {/* Erro */}
          {errorMsg && (
            <div className="mx-6 md:mx-8 mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-rose-600">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Campos do Formulário */}
          <div className="p-6 md:p-8 space-y-6">
            
            {/* Nome da Categoria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nome da Categoria / Tipo de Hospedagem *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Resort All-Inclusive / Lazer, Pousada Boutique, etc."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white transition-all font-semibold text-slate-900"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Descrição Detalhada (Opcional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva as características principais desse tipo de estabelecimento..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white transition-all text-slate-800 resize-none"
              />
            </div>

            {/* Seleção de Ícone */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ícone Representativo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                {AVAILABLE_ICONS.map((item) => {
                  const isSelected = icon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIcon(item.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center cursor-pointer ${
                        isSelected
                          ? 'border-[#003400] bg-emerald-50/50 text-[#003400] font-bold ring-2 ring-[#003400]/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-2xl mb-1 ${isSelected ? 'text-[#003400]' : 'text-slate-500'}`}>
                        {item.id}
                      </span>
                      <span className="text-[10px] leading-tight line-clamp-1">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Linha com Status e Ordem */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              
              {/* Status */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Status de Operação
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="status_categoria"
                      value="ativo"
                      checked={status === 'ativo'}
                      onChange={() => setStatus('ativo')}
                      className="text-[#003400] focus:ring-[#003400]"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Ativo</span>
                      <span className="text-[10px] text-slate-500 block">Disponível no cadastro</span>
                    </div>
                  </label>

                  <label className="flex-1 flex items-center gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                      type="radio"
                      name="status_categoria"
                      value="inativo"
                      checked={status === 'inativo'}
                      onChange={() => setStatus('inativo')}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Inativo</span>
                      <span className="text-[10px] text-slate-500 block">Oculto do cadastro</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Ordem de exibição */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  min="1"
                  value={order}
                  onChange={(e) => setOrder(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="1"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white transition-all font-semibold"
                />
                <p className="text-[10px] text-slate-400">
                  Define a posição no menu dropdown do cadastro de hotéis.
                </p>
              </div>

            </div>

          </div>

          {/* Rodapé / Ações */}
          <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {isSubmitting ? 'sync' : 'check'}
              </span>
              <span>{isSubmitting ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Cadastrar Categoria')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default CadastroCategoriaHotel;
