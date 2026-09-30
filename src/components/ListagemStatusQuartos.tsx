import React, { useState, useEffect, useMemo } from 'react';
import { statusQuartosService, StatusQuartoData } from '../services/supabaseService';

export interface ListagemStatusQuartosProps {
  onBackToDashboard: () => void;
  currentUserRole?: string;
  isHotelUser?: boolean;
}

// Paleta de temas rápidos para facilitar a escolha de cores harmoniosas pelo admin
const PRESET_COLOR_THEMES = [
  { label: 'Verde (Livre/Disponível)', bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', icon: 'check_circle' },
  { label: 'Vermelho (Ocupado)', bg: '#FEF2F2', text: '#991B1B', border: '#FECDD3', icon: 'lock' },
  { label: 'Âmbar (Limpeza)', bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', icon: 'cleaning_services' },
  { label: 'Azul (Manutenção)', bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', icon: 'build' },
  { label: 'Roxo (Reservado)', bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE', icon: 'bookmark' },
  { label: 'Cinza (Interditado)', bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', icon: 'block' },
  { label: 'Laranja (Vistoria)', bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA', icon: 'fact_check' },
  { label: 'Rosa (Check-out)', bg: '#FDF2F8', text: '#9D174D', border: '#FBCFE8', icon: 'logout' },
  { label: 'Ciano (VIP/Especial)', bg: '#ECFEFF', text: '#155E75', border: '#A5F3FC', icon: 'star' },
  { label: 'Índigo (Em Reforma)', bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE', icon: 'handyman' }
];

const ICONS_SUGESTOES = [
  { id: 'bed', label: 'Cama' },
  { id: 'king_bed', label: 'Cama King' },
  { id: 'check_circle', label: 'Check' },
  { id: 'lock', label: 'Cadeado' },
  { id: 'cleaning_services', label: 'Vassoura' },
  { id: 'build', label: 'Ferramenta' },
  { id: 'block', label: 'Bloqueio' },
  { id: 'bookmark', label: 'Reserva' },
  { id: 'fact_check', label: 'Vistoria' },
  { id: 'warning', label: 'Alerta' },
  { id: 'star', label: 'Estrela' },
  { id: 'handyman', label: 'Reforma' },
  { id: 'logout', label: 'Saída' },
  { id: 'timer', label: 'Relógio' },
  { id: 'priority_high', label: 'Prioridade' },
  { id: 'verified', label: 'Verificado' }
];

export const ListagemStatusQuartos: React.FC<ListagemStatusQuartosProps> = ({
  onBackToDashboard,
  currentUserRole,
  isHotelUser
}) => {
  const [statusList, setStatusList] = useState<StatusQuartoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados do Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusQuartoData | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formIcone, setFormIcone] = useState('bed');
  const [formCorFundo, setFormCorFundo] = useState('#ECFDF5');
  const [formCorTexto, setFormCorTexto] = useState('#065F46');
  const [formCorBorda, setFormCorBorda] = useState('#A7F3D0');
  const [formPermiteOcupacao, setFormPermiteOcupacao] = useState(true);
  const [formNotificaCamareira, setFormNotificaCamareira] = useState(false);
  const [formExigeMotivo, setFormExigeMotivo] = useState(false);
  const [formStatus, setFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [formOrdem, setFormOrdem] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Confirmação de exclusão
  const [statusToDelete, setStatusToDelete] = useState<StatusQuartoData | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await statusQuartosService.getStatusQuartos(false);
      setStatusList(data || []);
    } catch {
      setStatusList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('hotel_status_quartos_atualizado', handleUpdate);
    return () => {
      window.removeEventListener('hotel_status_quartos_atualizado', handleUpdate);
    };
  }, []);

  // Verificação de permissão: somente administradores do sistema têm acesso
  const roleLower = (currentUserRole || localStorage.getItem('hotelnozap_user_role') || '').toLowerCase();
  const isAdmin = !isHotelUser || roleLower.includes('admin') || roleLower.includes('super');

  if (!isAdmin) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen p-6 md:p-12 flex items-center justify-center">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <span className="material-symbols-outlined text-3xl">lock</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Administrador</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            O cadastro e configuração dos status dos quartos é uma função exclusiva do Administrador Master do sistema SaaS.
          </p>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="w-full py-2.5 px-4 bg-[#003400] hover:bg-[#002400] text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingStatus(null);
    setFormNome('');
    setFormSlug('');
    setFormDescricao('');
    setFormIcone('bed');
    setFormCorFundo('#F5F3FF');
    setFormCorTexto('#5B21B6');
    setFormCorBorda('#DDD6FE');
    setFormPermiteOcupacao(false);
    setFormNotificaCamareira(false);
    setFormExigeMotivo(false);
    setFormStatus('ativo');
    setFormOrdem(statusList.length + 1);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: StatusQuartoData) => {
    setEditingStatus(st);
    setFormNome(st.nome);
    setFormSlug(st.slug);
    setFormDescricao(st.descricao || '');
    setFormIcone(st.icone);
    setFormCorFundo(st.cor_fundo);
    setFormCorTexto(st.cor_texto);
    setFormCorBorda(st.cor_borda);
    setFormPermiteOcupacao(Boolean(st.permite_ocupacao));
    setFormNotificaCamareira(Boolean(st.notifica_camareira));
    setFormExigeMotivo(Boolean(st.exige_motivo));
    setFormStatus(st.status);
    setFormOrdem(st.ordem);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: typeof PRESET_COLOR_THEMES[0]) => {
    setFormCorFundo(preset.bg);
    setFormCorTexto(preset.text);
    setFormCorBorda(preset.border);
    setFormIcone(preset.icon);
  };

  const handleNomeChange = (val: string) => {
    setFormNome(val);
    if (!editingStatus) {
      // Auto-gerar slug simples a partir do nome
      const autoSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      setFormSlug(autoSlug);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      setFormError('Informe o nome do status.');
      return;
    }
    if (!formSlug.trim()) {
      setFormError('Informe o código identificador (slug) do status.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingStatus) {
        const res = await statusQuartosService.updateStatusQuarto(editingStatus.id, {
          nome: formNome,
          slug: editingStatus.padrao_sistema ? editingStatus.slug : formSlug,
          descricao: formDescricao,
          icone: formIcone,
          cor_fundo: formCorFundo,
          cor_texto: formCorTexto,
          cor_borda: formCorBorda,
          permite_ocupacao: formPermiteOcupacao,
          notifica_camareira: formNotificaCamareira,
          exige_motivo: formExigeMotivo,
          status: formStatus,
          ordem: formOrdem
        });

        if (res.success) {
          showToast(`Status "${formNome}" atualizado com sucesso!`);
          setIsModalOpen(false);
          loadData();
        } else {
          setFormError(res.error || 'Erro ao atualizar status.');
        }
      } else {
        const res = await statusQuartosService.createStatusQuarto({
          nome: formNome,
          slug: formSlug,
          descricao: formDescricao,
          icone: formIcone,
          cor_fundo: formCorFundo,
          cor_texto: formCorTexto,
          cor_borda: formCorBorda,
          permite_ocupacao: formPermiteOcupacao,
          notifica_camareira: formNotificaCamareira,
          exige_motivo: formExigeMotivo,
          padrao_sistema: false,
          status: formStatus,
          ordem: formOrdem
        });

        if (res.success) {
          showToast(`Novo status "${formNome}" cadastrado e disponível nos mapas dos hotéis!`);
          setIsModalOpen(false);
          loadData();
        } else {
          setFormError(res.error || 'Erro ao criar status.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Falha ao salvar status.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!statusToDelete) return;
    try {
      const res = await statusQuartosService.deleteStatusQuarto(statusToDelete.id);
      if (res.success) {
        showToast(`Status "${statusToDelete.nome}" removido.`);
        setStatusToDelete(null);
        loadData();
      } else {
        showToast(res.error || 'Erro ao excluir status.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Falha ao excluir status.');
    }
  };

  const handleToggleStatus = async (st: StatusQuartoData) => {
    const nextStatus = st.status === 'ativo' ? 'inativo' : 'ativo';
    const res = await statusQuartosService.updateStatusQuarto(st.id, { status: nextStatus });
    if (res.success) {
      showToast(`Status "${st.nome}" ${nextStatus === 'ativo' ? 'ativado' : 'desativado'}.`);
      loadData();
    }
  };

  // KPIs
  const totalStatus = statusList.length;
  const ativosCount = statusList.filter(s => s.status === 'ativo').length;
  const inativosCount = statusList.filter(s => s.status === 'inativo').length;
  const padraoCount = statusList.filter(s => s.padrao_sistema).length;

  // Filtragem
  const filteredStatus = useMemo(() => {
    return statusList.filter(st => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        st.nome.toLowerCase().includes(q) ||
        st.slug.toLowerCase().includes(q) ||
        (st.descricao && st.descricao.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'todos' || st.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [statusList, searchQuery, statusFilter]);

  return (
    <div className="bg-[#f8f9ff] min-h-screen p-4 md:p-8 text-slate-800 space-y-6">

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* TOPBAR / CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#003400] transition-colors cursor-pointer mb-2"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar para a Área Administrativa</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">room_preferences</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Cadastro de Status dos Quartos</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                  Somente Admin
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Cadastre e personalize os status que aparecem nos mapas de quartos de todos os hotéis.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] active:scale-98 text-xs sm:text-sm font-bold text-white shadow-xs transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Novo Status de Quarto</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* KPI SECTION (4 CARDS)                                     */}
      {/* ========================================================= */}
      <section aria-label="Indicadores de Status" className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Status</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <span className="material-symbols-outlined text-xl">format_list_bulleted</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalStatus}</span>
            <p className="text-xs text-slate-400 font-medium mt-0.5">cadastrados no sistema</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Ativos no Mapa</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-xl">check_circle</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">{ativosCount}</span>
            <p className="text-xs text-emerald-700 font-medium mt-0.5">visíveis para os hotéis</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Padrão Sistema</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-xl">verified</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-blue-700">{padraoCount}</span>
            <p className="text-xs text-blue-600 font-medium mt-0.5">essenciais protegidos</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Personalizados</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <span className="material-symbols-outlined text-xl">auto_fix_high</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-purple-700">{totalStatus - padraoCount}</span>
            <p className="text-xs text-purple-600 font-medium mt-0.5">criados pelo admin</p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BARRA DE FILTROS E BUSCA                                 */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, slug ou descrição..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase hidden sm:inline">Situação:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-initial ${
                statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({totalStatus})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ativo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-initial ${
                statusFilter === 'ativo' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({ativosCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inativo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex-1 sm:flex-initial ${
                statusFilter === 'inativo' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inativos ({inativosCount})
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* GRID DE STATUS DOS QUARTOS                                */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin text-emerald-600 mb-2">refresh</span>
          <p className="text-sm font-semibold">Carregando status cadastrados...</p>
        </div>
      ) : filteredStatus.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">search_off</span>
          </div>
          <h3 className="font-bold text-base text-slate-800">Nenhum status encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Não encontramos nenhum status de quarto com os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStatus.map((st) => (
            <div
              key={st.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative group"
            >
              {/* Topo do Card: Badge Preview Real + Ações */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  {/* Badge de visualização no mapa */}
                  <div
                    style={{
                      backgroundColor: st.cor_fundo,
                      color: st.cor_texto,
                      borderColor: st.cor_borda
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-base">{st.icone}</span>
                    <span>{st.nome}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {st.padrao_sistema && (
                      <span
                        title="Status padrão essencial do sistema SaaS"
                        className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md"
                      >
                        Padrão
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        st.status === 'ativo'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {st.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-bold text-slate-900">{st.nome}</h3>
                    <code className="text-[11px] font-mono font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      slug: {st.slug}
                    </code>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {st.descricao || 'Sem descrição cadastrada.'}
                  </p>
                </div>
              </div>

              {/* Informações Operacionais e Preview do Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] font-medium text-slate-400">Permite Check-in:</span>
                  <span className={`font-bold flex items-center gap-1 ${st.permite_ocupacao ? 'text-emerald-700' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-xs">
                      {st.permite_ocupacao ? 'check' : 'close'}
                    </span>
                    <span>{st.permite_ocupacao ? 'Sim (Disponível)' : 'Não (Bloqueado)'}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] font-medium text-slate-400">Notifica Governança:</span>
                  <span className={`font-bold flex items-center gap-1 ${st.notifica_camareira ? 'text-amber-700' : 'text-slate-400'}`}>
                    <span className="material-symbols-outlined text-xs">
                      {st.notifica_camareira ? 'cleaning_services' : 'remove'}
                    </span>
                    <span>{st.notifica_camareira ? 'Sim (Avisa Camareiras)' : 'Não'}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] font-medium text-slate-400">Exige Justificativa:</span>
                  <span className={`font-bold flex items-center gap-1 ${st.exige_motivo ? 'text-blue-700' : 'text-slate-400'}`}>
                    <span className="material-symbols-outlined text-xs">
                      {st.exige_motivo ? 'help_outline' : 'remove'}
                    </span>
                    <span>{st.exige_motivo ? 'Sim (Obrigatória)' : 'Opcional'}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-[11px] font-medium text-slate-400">Ordem no Mapa:</span>
                  <span className="font-bold text-slate-800 font-mono">#{st.ordem}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-medium text-slate-400">Cores Hex:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: st.cor_fundo }} title={`Fundo: ${st.cor_fundo}`} />
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: st.cor_texto }} title={`Texto: ${st.cor_texto}`} />
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: st.cor_borda }} title={`Borda: ${st.cor_borda}`} />
                  </div>
                </div>
              </div>

              {/* Rodapé do Card com Ações */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(st)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    st.status === 'ativo'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {st.status === 'ativo' ? 'Desativar' : 'Ativar no Mapa'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(st)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    title="Editar status"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>

                  {!st.padrao_sistema && (
                    <button
                      type="button"
                      onClick={() => setStatusToDelete(st)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                      title="Excluir status"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CADASTRO / EDIÇÃO DE STATUS DO QUARTO             */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                  {editingStatus ? 'Editar Status' : 'Novo Status do Quarto'}
                </span>
                <h3 className="text-lg sm:text-xl font-black">
                  {editingStatus ? `Editar: ${editingStatus.nome}` : 'Cadastrar Status para o Mapa'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Formulário com Scroll */}
            <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">error</span>
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              {/* SIMULADOR / LIVE PREVIEW EM TEMPO REAL */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  👁️ Pré-visualização no Mapa dos Hotéis (Tempo Real):
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    style={{
                      backgroundColor: formCorFundo,
                      color: formCorTexto,
                      borderColor: formCorBorda
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-xs"
                  >
                    <span className="material-symbols-outlined text-base">{formIcone}</span>
                    <span>{formNome || 'Nome do Status'}</span>
                  </div>

                  {/* Simulação de Card de Quarto */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
                    <span className="font-black text-slate-800 text-sm">Quarto 101</span>
                    <span
                      style={{
                        backgroundColor: formCorFundo,
                        color: formCorTexto,
                        borderColor: formCorBorda
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold border"
                    >
                      {formNome || 'Status'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Temas Rápidos Predefinidos */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  🎨 Paleta Rápida (Clique para aplicar cores e ícone):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {PRESET_COLOR_THEMES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="p-1.5 rounded-lg border text-left flex items-center gap-1.5 hover:shadow-xs transition cursor-pointer truncate"
                      style={{ backgroundColor: preset.bg, color: preset.text, borderColor: preset.border }}
                      title={preset.label}
                    >
                      <span className="material-symbols-outlined text-sm">{preset.icon}</span>
                      <span className="text-[10px] font-bold truncate">{preset.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Campos Principais: Nome e Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nome do Status *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => handleNomeChange(e.target.value)}
                    placeholder="Ex: Interditado, Reservado, Aguardando Vistoria..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Código Identificador (Slug) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingStatus?.padrao_sistema}
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                    placeholder="Ex: interditado, reservado, vistoria..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 disabled:opacity-60"
                  />
                  {editingStatus?.padrao_sistema && (
                    <span className="text-[10px] text-blue-600 font-medium block mt-0.5">
                      Slug protegido para status padrão do sistema.
                    </span>
                  )}
                </div>
              </div>

              {/* Seletor de Cores Personalizadas */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  🖌️ Cores Customizadas (Hexadecimal):
                </label>
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Cor de Fundo:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={formCorFundo}
                        onChange={(e) => setFormCorFundo(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formCorFundo}
                        onChange={(e) => setFormCorFundo(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Cor do Texto:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={formCorTexto}
                        onChange={(e) => setFormCorTexto(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formCorTexto}
                        onChange={(e) => setFormCorTexto(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-1">Cor da Borda:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={formCorBorda}
                        onChange={(e) => setFormCorBorda(e.target.value)}
                        className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formCorBorda}
                        onChange={(e) => setFormCorBorda(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seletor de Ícones Comuns */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Ícone Material Symbols:
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 border border-slate-200 shrink-0">
                    <span className="material-symbols-outlined text-xl">{formIcone}</span>
                  </div>
                  <input
                    type="text"
                    value={formIcone}
                    onChange={(e) => setFormIcone(e.target.value.trim().toLowerCase())}
                    placeholder="Nome do ícone (ex: bed, lock, block...)"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ICONS_SUGESTOES.map((ic) => (
                    <button
                      key={ic.id}
                      type="button"
                      onClick={() => setFormIcone(ic.id)}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                        formIcone === ic.id ? 'bg-[#003400] text-white border-[#003400]' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">{ic.id}</span>
                      <span>{ic.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Descrição / Objetivo do Status:
                </label>
                <textarea
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Ex: Quarto bloqueado para manutenção preventiva ou vistoria da governança..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>

              {/* REGRAS OPERACIONAIS DO STATUS */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                  ⚙️ Regras Operacionais do Status:
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-start gap-2.5 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition">
                    <input
                      type="checkbox"
                      checked={formPermiteOcupacao}
                      onChange={(e) => setFormPermiteOcupacao(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">Permite Check-in</span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        {formPermiteOcupacao ? 'Hóspedes podem entrar' : 'Bloqueia novos check-ins'}
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition">
                    <input
                      type="checkbox"
                      checked={formNotificaCamareira}
                      onChange={(e) => setFormNotificaCamareira(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">Avisar Governança</span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Notifica camareiras ao ativar
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition">
                    <input
                      type="checkbox"
                      checked={formExigeMotivo}
                      onChange={(e) => setFormExigeMotivo(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">Exigir Justificativa</span>
                      <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                        Pede motivo ao operador
                      </span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Situação no Sistema:
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as 'ativo' | 'inativo')}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value="ativo">Ativo (Exibir nos Mapas)</option>
                      <option value="inativo">Inativo (Ocultar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Ordem de Exibição no Mapa:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={formOrdem}
                      onChange={(e) => setFormOrdem(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#003400] hover:bg-[#002600] active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{isSaving ? 'Salvando...' : editingStatus ? 'Salvar Alterações' : 'Cadastrar Status'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFIRMAR EXCLUSÃO DE STATUS                       */}
      {/* ========================================================= */}
      {statusToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 border border-red-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Excluir Status do Quarto?</h3>
                <p className="text-xs text-slate-500">
                  Você está prestes a remover o status &quot;{statusToDelete.nome}&quot;.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-red-50 p-3 rounded-xl border border-red-100">
              ⚠️ Caso existam quartos configurados com este status no mapa, eles manterão o status registrado até que sejam alterados.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
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

export default ListagemStatusQuartos;
