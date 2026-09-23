import React, { useState, useEffect, useMemo } from 'react';
import { tiposUsuariosService, TipoUsuarioDB, DEFAULT_TIPOS_USUARIOS } from '../services/supabaseService';

export interface ListagemTiposUsuariosProps {
  onBack?: () => void;
  onNavigateToNovoTipo?: () => void;
  onNavigateToEditTipo?: (tipo: TipoUsuarioDB) => void;
}

export const ListagemTiposUsuarios: React.FC<ListagemTiposUsuariosProps> = ({
  onBack,
  onNavigateToNovoTipo,
  onNavigateToEditTipo
}) => {
  const [tipos, setTipos] = useState<TipoUsuarioDB[]>(() => tiposUsuariosService.getLocalTipos());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tipoToDelete, setTipoToDelete] = useState<TipoUsuarioDB | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadTipos = async () => {
    try {
      const data = await tiposUsuariosService.getTiposUsuarios();
      if (data && data.length > 0) {
        setTipos(data);
      } else {
        setTipos(tiposUsuariosService.getLocalTipos());
      }
    } catch (err) {
      console.error('Erro ao buscar tipos de usuários:', err);
      setTipos(tiposUsuariosService.getLocalTipos());
    }
  };

  useEffect(() => {
    loadTipos();

    const handleNovoTipo = () => {
      loadTipos();
    };

    window.addEventListener('hotel_novo_tipo_usuario', handleNovoTipo);

    const unsubscribe = tiposUsuariosService.subscribeTiposUsuarios 
      ? tiposUsuariosService.subscribeTiposUsuarios(loadTipos) 
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_tipo_usuario', handleNovoTipo);
      unsubscribe();
    };
  }, []);

  // Filtered List
  const filteredTipos = useMemo(() => {
    return tipos.filter((t) => {
      const matchesSearch =
        t.tipo_usuario.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.observacao && t.observacao.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tipos, searchQuery, statusFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredTipos.length / itemsPerPage) || 1;
  const paginatedTipos = filteredTipos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // KPIs
  const totalTipos = tipos.length;
  const ativosCount = tipos.filter((t) => t.status === 'ativo').length;
  const inativosCount = tipos.filter((t) => t.status === 'inativo').length;

  const handleDeleteConfirm = async () => {
    if (!tipoToDelete) return;

    if (tipoToDelete.id) {
      await tiposUsuariosService.deleteTipoUsuario(tipoToDelete.id);
    }

    setTipos(tipos.filter((t) => t.id !== tipoToDelete.id && t.tipo_usuario !== tipoToDelete.tipo_usuario));
    setTipoToDelete(null);
    showToast('Tipo de usuário removido com sucesso!');
  };

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'ID,Tipo do Usuario,Ordenacao,Status,Observacao\n' +
      filteredTipos.map((t) => `"${t.id || ''}","${t.tipo_usuario}","${t.ordenacao}","${t.status}","${t.observacao || ''}"`).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'tipos_de_usuarios.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relatório de Tipos de Usuários exportado em CSV!');
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-emerald-900 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-semibold text-sm border border-emerald-700">
            <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Voltar Link se houver */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar para Usuários do Sistema</span>
          </button>
        </div>
      )}

      {/* HEADER DA TELA COM BOTOES DE AÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Tipos de Usuários & Níveis de Acesso
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gerencie os cargos, permissões, ordens de exibição e status de autenticação das equipes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#fdb116] hover:bg-[#e5a013] active:scale-[0.98] text-[#2a1700] font-bold text-xs md:text-sm shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span>Exportar</span>
          </button>
          
          {onNavigateToNovoTipo && (
            <button
              type="button"
              onClick={onNavigateToNovoTipo}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D00] hover:bg-[#003400] active:scale-[0.98] text-white font-bold text-xs md:text-sm shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Novo Tipo de Usuário</span>
            </button>
          )}
        </div>
      </div>

      {/* CARDS KPIS (BENTO GRID DESKTOP E MOBILE) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* KPI 1 - TOTAL DE TIPOS */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total de Perfis</span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-blue-950 mt-2">{totalTipos}</p>
          <span className="text-[11px] text-blue-600 font-semibold mt-1">Cargos configurados no sistema</span>
        </div>

        {/* KPI 2 - TIPOS ATIVOS */}
        <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Perfis Ativos</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-emerald-950 mt-2">{ativosCount}</p>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1">Disponíveis para vinculação</span>
        </div>

        {/* KPI 3 - TIPOS INATIVOS */}
        <div className="col-span-2 lg:col-span-1 bg-slate-100/70 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Perfis Inativos</span>
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">block</span>
            </div>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-slate-950 mt-2">{inativosCount}</p>
          <span className="text-[11px] text-slate-500 font-semibold mt-1">Bloqueados para novos usuários</span>
        </div>
      </div>

      {/* BARRA DE PESQUISA, FILTROS E ALTERNADOR DE MODO DE EXIBIÇÃO */}
      <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
          
          {/* CAMPO DE BUSCA */}
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por tipo do usuário ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>

          {/* FILTRO DE STATUS */}
          <div className="relative w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer appearance-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl">
              expand_more
            </span>
          </div>

          {/* BOTÃO LIMPAR FILTROS */}
          {(searchQuery || statusFilter !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('todos');
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors whitespace-nowrap cursor-pointer px-2 py-1"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* TOGGLE MODO LISTA / GRADE (DESKTOP E MOBILE) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'lista'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Visualização em Lista"
          >
            <span className="material-symbols-outlined text-base">format_list_bulleted</span>
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grade')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grade'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Visualização em Grade"
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span>Grade</span>
          </button>
        </div>
      </section>

      {/* CONTEÚDO PRINCIPAL: TABELA OU GRADE */}
      {viewMode === 'lista' ? (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* TABELA DESKTOP */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 w-16">Ordem</th>
                  <th className="py-4 px-4">Tipo do Usuário</th>
                  <th className="py-4 px-4">Observação / Descrição</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-800">
                {paginatedTipos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      Nenhum tipo de usuário encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedTipos.map((t) => (
                    <tr key={t.id || t.tipo_usuario} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-black text-slate-500">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          #{t.ordenacao}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-blue-600 text-lg">shield_person</span>
                          <span>{t.tipo_usuario}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-600 max-w-md">
                        <p className="line-clamp-2">{t.observacao || 'Sem observações cadastradas.'}</p>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          t.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <span>{t.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {onNavigateToEditTipo && (
                            <button
                              type="button"
                              onClick={() => onNavigateToEditTipo(t)}
                              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                              title="Editar"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              <span>Editar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setTipoToDelete(t)}
                            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* LISTA MOBILE */}
          <div className="md:hidden divide-y divide-slate-100">
            {paginatedTipos.map((t) => (
              <div key={t.id || t.tipo_usuario} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 font-extrabold text-[11px] flex items-center justify-center">
                      #{t.ordenacao}
                    </span>
                    <h3 className="font-extrabold text-slate-900 text-sm">{t.tipo_usuario}</h3>
                  </div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    t.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {t.observacao || 'Sem observação.'}
                </p>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  {onNavigateToEditTipo && (
                    <button
                      type="button"
                      onClick={() => onNavigateToEditTipo(t)}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      <span>Editar</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTipoToDelete(t)}
                    className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PAGINAÇÃO LISTA */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between text-xs sm:text-sm">
            <p className="text-slate-500 font-medium">
              Exibindo <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredTipos.length)}</strong> de <strong className="text-slate-800">{filteredTipos.length}</strong> tipos
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* MODO GRADE (CARDS - DESKTOP E MOBILE) */
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedTipos.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium">
                Nenhum tipo de usuário encontrado.
              </div>
            ) : (
              paginatedTipos.map((t) => (
                <div
                  key={t.id || t.tipo_usuario}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                          <span className="material-symbols-outlined text-xl">shield_person</span>
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug">{t.tipo_usuario}</h3>
                          <span className="text-[10px] font-bold text-slate-400">Ordem #{t.ordenacao}</span>
                        </div>
                      </div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {t.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal mb-3 line-clamp-3">
                      {t.observacao || 'Sem observação cadastrada.'}
                    </p>

                    {t.permissoes && t.permissoes.length > 0 && (
                      <div className="space-y-1 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Permissões</span>
                        <div className="flex flex-wrap gap-1">
                          {t.permissoes.map((p) => (
                            <span key={p} className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    {onNavigateToEditTipo && (
                      <button
                        type="button"
                        onClick={() => onNavigateToEditTipo(t)}
                        className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>Editar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTipoToDelete(t)}
                      className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* PAGINAÇÃO GRADE */}
          <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200 flex items-center justify-between text-xs sm:text-sm shadow-xs">
            <p className="text-slate-500 font-medium">
              Exibindo <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredTipos.length)}</strong> de <strong className="text-slate-800">{filteredTipos.length}</strong> tipos
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {tipoToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Excluir Tipo de Usuário?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tem certeza que deseja remover o perfil <strong className="text-slate-900">{tipoToDelete.tipo_usuario}</strong>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTipoToDelete(null)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-sm"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListagemTiposUsuarios;
