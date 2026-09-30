import React, { useState, useEffect, useMemo } from 'react';
import { cuponsService, CupomDesconto } from '../services/cuponsService';
import { currentHotelService } from '../services/supabaseService';

interface ListagemCuponsProps {
  onNavigateToDashboard: () => void;
  onNavigateToNovoCupom: () => void;
  onNavigateToEditCupom: (cupom: CupomDesconto) => void;
}

export const ListagemCupons: React.FC<ListagemCuponsProps> = ({
  onNavigateToDashboard,
  onNavigateToNovoCupom,
  onNavigateToEditCupom
}) => {
  const [cupons, setCupons] = useState<CupomDesconto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [tipoFilter, setTipoFilter] = useState<'Todos' | 'porcentagem' | 'fixo'>('Todos');
  const [cupomParaExcluir, setCupomParaExcluir] = useState<CupomDesconto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeHotel = currentHotelService.getCurrentHotel();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const carregarCupons = async () => {
    setLoading(true);
    try {
      const dados = await cuponsService.getCuponsHotel(activeHotel?.id);
      setCupons(dados);
    } catch (err) {
      console.error('Erro ao carregar cupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCupons();
  }, [activeHotel?.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(`Código "${text}" copiado com sucesso!`);
  };

  const handleToggleStatus = async (cupom: CupomDesconto) => {
    const novoStatus = cupom.status === 'Ativo' ? 'Inativo' : 'Ativo';
    await cuponsService.updateCupom(cupom.id, { status: novoStatus });
    setCupons(prev => prev.map(c => (c.id === cupom.id ? { ...c, status: novoStatus } : c)));
    showToast(`Cupom "${cupom.codigo}" agora está ${novoStatus}!`);
  };

  const handleConfirmarExclusao = async () => {
    if (!cupomParaExcluir) return;
    await cuponsService.deleteCupom(cupomParaExcluir.id);
    setCupons(prev => prev.filter(c => c.id !== cupomParaExcluir.id));
    showToast(`Cupom "${cupomParaExcluir.codigo}" excluído com sucesso!`);
    setCupomParaExcluir(null);
  };

  // Cupons filtrados
  const cuponsFiltrados = useMemo(() => {
    return cupons.filter(c => {
      const matchBusca =
        c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.descricao && c.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === 'Todos' || c.status === statusFilter;
      const matchTipo = tipoFilter === 'Todos' || c.tipo_desconto === tipoFilter;
      return matchBusca && matchStatus && matchTipo;
    });
  }, [cupons, searchTerm, statusFilter, tipoFilter]);

  // Estatísticas do Topo
  const stats = useMemo(() => {
    const total = cupons.length;
    const ativos = cupons.filter(c => c.status === 'Ativo').length;
    const totalUsos = cupons.reduce((acc, c) => acc + (c.usos_atuais || 0), 0);
    const visiveis = cupons.filter(c => c.visivel_hospedes && c.status === 'Ativo').length;
    return { total, ativos, totalUsos, visiveis };
  }, [cupons]);

  const isExpirado = (dataExp: string) => {
    if (!dataExp) return false;
    const today = new Date().toISOString().split('T')[0];
    return today > dataExp;
  };

  const formatarDataBR = (dataStr: string) => {
    if (!dataStr) return '-';
    try {
      const [ano, mes, dia] = dataStr.split('-');
      if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
      return new Date(dataStr).toLocaleDateString('pt-BR');
    } catch {
      return dataStr;
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-800 font-sans pb-16">
      {/* Toast Flutuante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {cupomParaExcluir && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Excluir Cupom de Desconto?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Você tem certeza que deseja excluir o cupom <strong className="text-slate-900 font-mono">{cupomParaExcluir.codigo}</strong>?
                Hóspedes que tentarem utilizá-lo não receberão mais este desconto no checkout.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCupomParaExcluir(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Sim, Excluir Cupom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Principal */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onNavigateToDashboard}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="Voltar ao Dashboard"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
              </button>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006c49] shrink-0">
                <span className="material-symbols-outlined text-2xl">confirmation_number</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                    Cupons de Desconto
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    Checkout & Hóspedes
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Gerencie promoções, códigos de desconto para o checkout e ofertas visíveis para os hóspedes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onNavigateToNovoCupom}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span>Novo Cupom de Desconto</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* CARDS DE MÉTRICAS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <span className="material-symbols-outlined text-2xl">confirmation_number</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Cupons</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Cupons Ativos</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700">{stats.ativos}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <span className="material-symbols-outlined text-2xl">loyalty</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Resgates</span>
              <span className="text-xl sm:text-2xl font-black text-purple-900">{stats.totalUsos}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <span className="material-symbols-outlined text-2xl">visibility</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Na Área do Hóspede</span>
              <span className="text-xl sm:text-2xl font-black text-amber-700">{stats.visiveis}</span>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS & BUSCA */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código do cupom ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro de Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Somente Ativos</option>
              <option value="Inativo">Somente Inativos</option>
            </select>

            {/* Filtro de Tipo */}
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
            >
              <option value="Todos">Todos os Tipos</option>
              <option value="porcentagem">Porcentagem (%)</option>
              <option value="fixo">Valor Fixo (R$)</option>
            </select>
          </div>
        </div>

        {/* LISTAGEM DE CUPONS */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-emerald-600 animate-spin">sync</span>
            <p className="text-xs text-slate-500">Carregando cupons de desconto...</p>
          </div>
        ) : cuponsFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">confirmation_number</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nenhum cupom encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {searchTerm || statusFilter !== 'Todos' || tipoFilter !== 'Todos'
                  ? 'Nenhum cupom corresponde aos filtros de busca selecionados.'
                  : 'Crie seu primeiro cupom promocional para incentivar reservas diretas e fidelizar hóspedes.'}
              </p>
            </div>
            <button
              onClick={onNavigateToNovoCupom}
              className="px-5 py-2.5 rounded-xl bg-[#003400] text-white text-xs font-bold hover:bg-[#002600] transition cursor-pointer"
            >
              Criar Primeiro Cupom
            </button>
          </div>
        ) : (
          <>
            {/* MODO DESKTOP: TABELA ELEGANTE */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                      <th className="py-3.5 px-4">Código do Cupom</th>
                      <th className="py-3.5 px-4">Desconto</th>
                      <th className="py-3.5 px-4">Regras & Mínimo</th>
                      <th className="py-3.5 px-4">Validade</th>
                      <th className="py-3.5 px-4">Utilizações</th>
                      <th className="py-3.5 px-4 text-center">Área do Hóspede</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cuponsFiltrados.map((cupom) => {
                      const expirado = isExpirado(cupom.data_expiracao);
                      const limiteAtingido = cupom.limite_usos && cupom.usos_atuais >= cupom.limite_usos;

                      return (
                        <tr key={cupom.id} className="hover:bg-slate-50/60 transition-colors group">
                          {/* Código */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm tracking-wide text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                {cupom.codigo}
                              </span>
                              <button
                                onClick={() => copyToClipboard(cupom.codigo)}
                                className="text-slate-400 hover:text-emerald-700 transition p-1 rounded hover:bg-slate-100 cursor-pointer"
                                title="Copiar Código"
                              >
                                <span className="material-symbols-outlined text-base">content_copy</span>
                              </button>
                            </div>
                            {cupom.descricao && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs mt-1">
                                {cupom.descricao}
                              </p>
                            )}
                          </td>

                          {/* Desconto */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 font-black text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <span className="material-symbols-outlined text-base">savings</span>
                              {cupom.tipo_desconto === 'porcentagem'
                                ? `${cupom.valor_desconto}% de Desconto`
                                : `R$ ${cupom.valor_desconto.toFixed(2).replace('.', ',')} de Desconto`}
                            </span>
                          </td>

                          {/* Regras e Mínimo */}
                          <td className="py-3.5 px-4">
                            {cupom.valor_minimo_reserva && cupom.valor_minimo_reserva > 0 ? (
                              <div className="space-y-0.5">
                                <span className="text-slate-700 font-semibold block">
                                  Mínimo: R$ {cupom.valor_minimo_reserva.toFixed(2).replace('.', ',')}
                                </span>
                                <span className="text-[10px] text-slate-400">em diárias</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-medium">Sem valor mínimo</span>
                            )}
                          </td>

                          {/* Validade */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="text-slate-700 font-medium block">
                                Até {formatarDataBR(cupom.data_expiracao)}
                              </span>
                              {expirado ? (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block">
                                  Expirado
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  Desde {formatarDataBR(cupom.data_inicio)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Utilizações */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <span>{cupom.usos_atuais}</span>
                                <span className="text-slate-400 font-normal">
                                  / {cupom.limite_usos ? cupom.limite_usos : '∞'} usos
                                </span>
                              </div>
                              {cupom.limite_usos && (
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${limiteAtingido ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (cupom.usos_atuais / cupom.limite_usos) * 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Visível na Área do Hóspede */}
                          <td className="py-3.5 px-4 text-center">
                            {cupom.visivel_hospedes ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <span className="material-symbols-outlined text-sm">visibility</span>
                                Público
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                <span className="material-symbols-outlined text-sm">visibility_off</span>
                                Privado
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(cupom)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                                cupom.status === 'Ativo'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                              title="Clique para alternar o status do cupom"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span>{cupom.status}</span>
                            </button>
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onNavigateToEditCupom(cupom)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Editar Cupom"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                onClick={() => setCupomParaExcluir(cupom)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Excluir Cupom"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODO MOBILE: CARDS RESPONSIVOS ESTILO VOUCHER */}
            <div className="block md:hidden space-y-3.5">
              {cuponsFiltrados.map((cupom) => {
                const expirado = isExpirado(cupom.data_expiracao);

                return (
                  <div
                    key={cupom.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3 relative overflow-hidden"
                  >
                    {/* Faixa decorativa lateral de voucher */}
                    <div
                      className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                        cupom.status === 'Ativo' ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    />

                    <div className="flex items-start justify-between gap-2 pl-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm tracking-wide text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                            {cupom.codigo}
                          </span>
                          <button
                            onClick={() => copyToClipboard(cupom.codigo)}
                            className="text-slate-400 hover:text-emerald-700 transition p-1 rounded cursor-pointer"
                            title="Copiar Código"
                          >
                            <span className="material-symbols-outlined text-base">content_copy</span>
                          </button>
                        </div>
                        {cupom.descricao && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {cupom.descricao}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cupom)}
                        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          cupom.status === 'Ativo'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{cupom.status}</span>
                      </button>
                    </div>

                    {/* Destaque de Desconto */}
                    <div className="pl-2 flex items-center justify-between text-xs bg-emerald-50/70 border border-emerald-100 p-2.5 rounded-xl">
                      <span className="text-slate-600 font-medium">Benefício:</span>
                      <span className="font-black text-emerald-800 text-sm">
                        {cupom.tipo_desconto === 'porcentagem'
                          ? `${cupom.valor_desconto}% de Desconto`
                          : `R$ ${cupom.valor_desconto.toFixed(2).replace('.', ',')} OFF`}
                      </span>
                    </div>

                    {/* Detalhes de Mínimo e Validade */}
                    <div className="pl-2 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-2 text-slate-500">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Valor Mínimo</span>
                        <span className="font-semibold text-slate-700">
                          {cupom.valor_minimo_reserva && cupom.valor_minimo_reserva > 0
                            ? `R$ ${cupom.valor_minimo_reserva.toFixed(2).replace('.', ',')}`
                            : 'Sem mínimo'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Expiração</span>
                        <span className={`font-semibold ${expirado ? 'text-rose-600' : 'text-slate-700'}`}>
                          {formatarDataBR(cupom.data_expiracao)}
                          {expirado && ' (Expirado)'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Utilizações</span>
                        <span className="font-semibold text-slate-700">
                          {cupom.usos_atuais} / {cupom.limite_usos || '∞'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Área do Hóspede</span>
                        <span className={`font-semibold ${cupom.visivel_hospedes ? 'text-amber-700' : 'text-slate-500'}`}>
                          {cupom.visivel_hospedes ? 'Visível' : 'Oculto'}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação Mobile */}
                    <div className="pl-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => onNavigateToEditCupom(cupom)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => setCupomParaExcluir(cupom)}
                        className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default ListagemCupons;
