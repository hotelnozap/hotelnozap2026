import React, { useState, useEffect, useMemo } from 'react';
import { fetchAddressByCep } from '../utils/viacep';
import { maskCep, maskPhone } from '../utils/masks';
import { usuariosService, tiposUsuariosService, TipoUsuarioDB, currentHotelService } from '../services/supabaseService';
import FormTipoUsuario from './FormTipoUsuario';

export interface Usuario {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  cargo: string;
  perfil: 'Super Admin' | 'Administrador' | 'Hotel' | 'Parceiro' | 'Gerente' | 'Recepção' | 'Governança' | 'Financeiro' | 'Hóspede';
  phone: string;
  lastAccess: string;
  status: 'ativo' | 'inativo' | 'bloqueado';
  avatarUrl?: string;
  initials: string;
  cep?: string;
  street?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  hotelId?: string;
  createdAt?: string;
}

const INITIAL_USUARIOS: Usuario[] = [
  {
    id: 'admin-everaldo',
    name: 'Everaldo Souza',
    email: 'everaldozs@gmail.com',
    cargo: 'Administrador do Sistema',
    perfil: 'Administrador',
    phone: '(11) 99999-8888',
    lastAccess: new Date().toISOString(),
    status: 'ativo',
    initials: 'ES',
  }
];

export interface ListagemUsuariosProps {
  isHotelScope?: boolean;
  hotelId?: string;
  onNavigateToDashboard?: () => void;
  onNavigateToCreate?: () => void;
  onNavigateToEdit?: (user: Usuario) => void;
  onNavigateToTiposUsuarios?: () => void;
}

export const ListagemUsuarios: React.FC<ListagemUsuariosProps> = ({
  isHotelScope = false,
  hotelId,
  onNavigateToDashboard,
  onNavigateToCreate,
  onNavigateToEdit,
  onNavigateToTiposUsuarios
}) => {
  const [usuarios, setUsuarios] = useState<Usuario[]>(() => isHotelScope ? [] : INITIAL_USUARIOS);
  const [searchQuery, setSearchQuery] = useState('');
  const [perfilFilter, setPerfilFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'lista' | 'grade'>('lista');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Carregar dados reais do Supabase
  const loadUsuarios = async () => {
    const currentHotel = currentHotelService.getCurrentHotel();
    const effectiveHotelId = hotelId || currentHotel?.id;

    if (isHotelScope) {
      const dbUsuarios = await usuariosService.getUsuarios({
        scopeHotelId: effectiveHotelId,
        includeAdminGlobal: false
      });
      if (dbUsuarios && dbUsuarios.length > 0) {
        // Filtra estritamente apenas os usuários pertencentes ao hotel atual
        // e garante que administradores globais / super admin nunca apareçam na listagem do hotel
        const hotelUsers = dbUsuarios.filter(u => {
          const belongsToHotel = effectiveHotelId ? u.hotelId === effectiveHotelId : Boolean(u.hotelId);
          const isGlobalAdmin = u.perfil === 'Super Admin' ||
                                u.cargo?.toLowerCase().includes('super admin') ||
                                u.email.toLowerCase() === 'everaldozs@gmail.com' ||
                                !u.hotelId;
          return belongsToHotel && !isGlobalAdmin;
        });
        setUsuarios(hotelUsers);
      } else {
        setUsuarios([]);
      }
    } else {
      const dbUsuarios = await usuariosService.getUsuarios();
      if (dbUsuarios && dbUsuarios.length > 0) {
        const hasEveraldo = dbUsuarios.some(u => u.email.toLowerCase() === 'everaldozs@gmail.com');
        if (!hasEveraldo) {
          setUsuarios([INITIAL_USUARIOS[0], ...dbUsuarios]);
        } else {
          setUsuarios(dbUsuarios);
        }
      } else {
        setUsuarios([INITIAL_USUARIOS[0]]);
      }
    }
  };

  useEffect(() => {
    loadUsuarios();

    const handleUpdate = () => {
      loadUsuarios();
    };

    window.addEventListener('hotel_novo_usuario', handleUpdate);
    window.addEventListener('hotel_usuario_modificado', handleUpdate);
    window.addEventListener('hotel_usuario_deletado', handleUpdate);
    window.addEventListener('hotel_changed', handleUpdate);

    const unsubscribe = usuariosService.subscribeUsuarios 
      ? usuariosService.subscribeUsuarios(loadUsuarios) 
      : () => {};

    return () => {
      window.removeEventListener('hotel_novo_usuario', handleUpdate);
      window.removeEventListener('hotel_usuario_modificado', handleUpdate);
      window.removeEventListener('hotel_usuario_deletado', handleUpdate);
      window.removeEventListener('hotel_changed', handleUpdate);
      unsubscribe();
    };
  }, [isHotelScope, hotelId]);

  // Atualização periódica a cada 30 segundos para atualizar tempos relativos (Online agora, Há X min)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Modais State
  const [selectedUserView, setSelectedUserView] = useState<Usuario | null>(null);
  const [selectedUserEdit, setSelectedUserEdit] = useState<Usuario | null>(null);
  const [selectedUserDelete, setSelectedUserDelete] = useState<Usuario | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form Fields State (para criar / editar)
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCargo, setFormCargo] = useState('');
  const [formPerfil, setFormPerfil] = useState<Usuario['perfil']>('Recepção');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState<Usuario['status']>('ativo');
  const [formCep, setFormCep] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formUf, setFormUf] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Focus/Blur placeholder handler para apagar placeholder automaticamente ao clicar
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.dataset.placeholder = e.target.placeholder;
    e.target.placeholder = '';
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.dataset.placeholder) {
      e.target.placeholder = e.target.dataset.placeholder;
    }
  };

  // Integração ViaCEP
  const handleSearchViaCep = async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      setCepError(null);
      const data = await fetchAddressByCep(clean);
      setIsLoadingCep(false);
      if (data && !data.erro) {
        if (data.logradouro) setFormStreet(data.logradouro);
        if (data.bairro) setFormNeighborhood(data.bairro);
        if (data.localidade) setFormCity(data.localidade);
        if (data.uf) setFormUf(data.uf.toUpperCase());
      } else {
        setCepError('CEP não encontrado na base do ViaCEP.');
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setFormCep(masked);
    setCepError(null);
    if (masked.replace(/\D/g, '').length === 8) {
      handleSearchViaCep(masked);
    }
  };

  // Abrir Modal/Form de Edição
  const handleOpenEdit = (user: Usuario) => {
    if (onNavigateToEdit) {
      onNavigateToEdit(user);
    } else {
      setSelectedUserEdit(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormCargo(user.cargo);
      setFormPerfil(user.perfil);
      setFormPhone(user.phone);
      setFormStatus(user.status);
      setFormCep(user.cep || '');
      setFormStreet(user.street || '');
      setFormNeighborhood(user.neighborhood || '');
      setFormCity(user.city || '');
      setFormUf(user.uf || '');
    }
  };

  // Abrir Modal/Form de Criação
  const handleOpenCreate = () => {
    if (onNavigateToCreate) {
      onNavigateToCreate();
    } else {
      setSelectedUserEdit(null);
      setFormName('');
      setFormEmail('');
      setFormCargo('');
      setFormPerfil('Recepção');
      setFormPhone('');
      setFormStatus('ativo');
      setFormCep('');
      setFormStreet('');
      setFormNeighborhood('');
      setFormCity('');
      setFormUf('');
      setIsCreateModalOpen(true);
    }
  };

  // Salvar (Novo ou Edição)
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Por favor, informe Nome e E-mail.');
      return;
    }

    const getInitials = (name: string) => {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    if (selectedUserEdit) {
      setUsuarios(prev => prev.map(u => u.id === selectedUserEdit.id ? {
        ...u,
        name: formName,
        email: formEmail,
        cargo: formCargo,
        perfil: formPerfil,
        phone: formPhone,
        status: formStatus,
        initials: getInitials(formName),
        cep: formCep,
        street: formStreet,
        neighborhood: formNeighborhood,
        city: formCity,
        uf: formUf
      } : u));

      // Sincronizar com o Supabase
      usuariosService.updateUsuario(selectedUserEdit.id, {
        name: formName,
        email: formEmail,
        cargo: formCargo,
        perfil: formPerfil,
        phone: formPhone,
        status: formStatus,
        initials: getInitials(formName)
      });

      showToast(`Usuário "${formName}" atualizado com sucesso!`);
      setSelectedUserEdit(null);
    } else {
      const newUser: Usuario = {
        id: String(Date.now()),
        name: formName,
        email: formEmail,
        cargo: formCargo || 'Atendente',
        perfil: formPerfil,
        phone: formPhone || '(54) 99000-0000',
        lastAccess: 'Novo usuário',
        status: formStatus,
        initials: getInitials(formName),
        cep: formCep,
        street: formStreet,
        neighborhood: formNeighborhood,
        city: formCity,
        uf: formUf
      };

      setUsuarios(prev => [newUser, ...prev]);

      // Sincronizar com o Supabase
      usuariosService.createUsuario(newUser, undefined, { adminMode: true }).then(result => {
        if (result.success && result.user) {
          setUsuarios(prev => prev.map(u => u.id === newUser.id ? result.user! : u));
        }
      });

      showToast(`Novo usuário "${formName}" cadastrado com sucesso!`);
      setIsCreateModalOpen(false);
    }
  };

  // Identifica o primeiro usuário cadastrado com perfil 'Hotel' (conta raiz de acesso do hotel)
  const firstHotelUser = useMemo(() => {
    const hotelUsers = usuarios.filter(u => u.perfil === 'Hotel');
    if (hotelUsers.length === 0) return null;

    const sorted = [...hotelUsers].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });

    return sorted[0];
  }, [usuarios]);

  const isProtectedUser = (user: Usuario) => {
    // 1. Administrador Master Global
    if (
      user.email.toLowerCase() === 'everaldozs@gmail.com' ||
      user.id === 'admin-everaldo'
    ) {
      return true;
    }

    // 2. Primeiro usuário cadastrado de perfil 'Hotel' (conta raiz necessária para acessar o sistema)
    if (
      firstHotelUser && (
        user.id === firstHotelUser.id || 
        (user.email && user.email.toLowerCase() === firstHotelUser.email.toLowerCase())
      )
    ) {
      return true;
    }

    // 3. Regra de contingência para o escopo do hotel: se for o único perfil 'Hotel' ou único usuário cadastrado
    if (isHotelScope) {
      const hotelUsers = usuarios.filter(u => u.perfil === 'Hotel');
      if (user.perfil === 'Hotel' && hotelUsers.length <= 1) {
        return true;
      }
      if (usuarios.length <= 1) {
        return true;
      }
    }

    return false;
  };

  // Confirmar Exclusão
  const handleDeleteUser = () => {
    if (selectedUserDelete) {
      if (isProtectedUser(selectedUserDelete)) {
        showToast(
          selectedUserDelete.perfil === 'Hotel'
            ? 'O primeiro usuário com perfil Hotel não pode ser apagado, pois o sistema precisa deste usuário para acesso!'
            : 'Este usuário é o Administrador Master do sistema e está protegido contra exclusão!'
        );
        setSelectedUserDelete(null);
        return;
      }
      const idToDelete = selectedUserDelete.id;
      setUsuarios(prev => prev.filter(u => u.id !== idToDelete));
      usuariosService.deleteUsuario(idToDelete);
      showToast(`Usuário "${selectedUserDelete.name}" removido com sucesso.`);
      setSelectedUserDelete(null);
    }
  };

  // Exportar Relatório
  const handleExport = () => {
    showToast('Relatório de Usuários exportado em XLSX!');
  };

  // Filtragem
  const filteredUsers = usuarios.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.cargo.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPerfil = !perfilFilter || 
                          u.perfil === perfilFilter ||
                          (perfilFilter === 'Gerente' && (u.perfil === 'Hotel' || u.cargo?.toLowerCase().includes('gerente'))) ||
                          (perfilFilter === 'Hotel' && (u.perfil === 'Hotel' || u.perfil === 'Gerente' || u.cargo?.toLowerCase().includes('gerente')));
    const matchesStatus = !statusFilter || u.status === statusFilter;
    return matchesSearch && matchesPerfil && matchesStatus;
  });

  // Métricas KPI
  const totalUsers = usuarios.length;
  const activeUsers = usuarios.filter(u => u.status === 'ativo').length;
  const adminUsers = usuarios.filter(u => u.perfil === 'Administrador').length;
  const inactiveUsers = usuarios.filter(u => u.status === 'inativo' || u.status === 'bloqueado').length;

  // Paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Cores de Badge de Perfil
  const getPerfilBadge = (perfil: Usuario['perfil']) => {
    switch (perfil) {
      case 'Administrador':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold border border-indigo-200">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            Administrador
          </span>
        );
      case 'Recepção':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
            <span className="material-symbols-outlined text-[14px]">concierge</span>
            Recepção
          </span>
        );
      case 'Financeiro':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200">
            <span className="material-symbols-outlined text-[14px]">payments</span>
            Financeiro
          </span>
        );
      case 'Governança':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200">
            <span className="material-symbols-outlined text-[14px]">cleaning_services</span>
            Governança
          </span>
        );
      case 'Hotel':
      case 'Gerente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-200">
            <span className="material-symbols-outlined text-[14px]">manage_accounts</span>
            Gerente / Hotel
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
            {perfil}
          </span>
        );
    }
  };

  // Cores de Badge de Status
  const getStatusBadge = (status: Usuario['status']) => {
    switch (status) {
      case 'ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Ativo
          </span>
        );
      case 'inativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Inativo
          </span>
        );
      case 'bloqueado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            Bloqueado
          </span>
        );
    }
  };

  // Formatação em tempo real do Último Acesso com status Online
  const formatarUltimoAcesso = (lastAccessRaw: string | undefined | null, userEmail?: string, _createdAt?: string) => {
    const loggedEmail = (localStorage.getItem('hotelnozap_user_email') || '').trim().toLowerCase();
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const isCurrentUser = Boolean(loggedEmail && cleanEmail && loggedEmail === cleanEmail);

    // Se é o usuário logado agora na sessão ativa
    if (isCurrentUser) {
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Online agora</span>
        </span>
      );
    }

    // Verificar se existe timestamp mais recente no localStorage
    let effectiveDateStr = lastAccessRaw;
    if (cleanEmail) {
      try {
        const localTs = localStorage.getItem(`hotelnozap_ultimo_acesso_${cleanEmail}`);
        if (localTs) {
          if (!effectiveDateStr || new Date(localTs).getTime() > new Date(effectiveDateStr).getTime()) {
            effectiveDateStr = localTs;
          }
        }
      } catch { /* ignore */ }
    }

    if (!effectiveDateStr || effectiveDateStr.toLowerCase().includes('nunca')) {
      return (
        <span className="inline-flex items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined text-xs text-slate-400">schedule</span>
          <span>Nunca acessou</span>
        </span>
      );
    }

    const d = new Date(effectiveDateStr);
    if (isNaN(d.getTime())) {
      return (
        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
          <span className="material-symbols-outlined text-xs text-slate-400">history</span>
          <span>{effectiveDateStr}</span>
        </span>
      );
    }

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    // Menos de 5 minutos: Online agora
    if (diffMin < 5 && diffMin >= 0) {
      return (
        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Online agora</span>
        </span>
      );
    }

    // Menos de 60 minutos: Há X min
    if (diffMin < 60 && diffMin >= 5) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium bg-emerald-50/70 px-2 py-0.5 rounded-full border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Há {diffMin} min</span>
        </span>
      );
    }

    const horas = String(d.getHours()).padStart(2, '0');
    const minutos = String(d.getMinutes()).padStart(2, '0');

    // Mesmo dia: Hoje às HH:mm
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return (
        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
          <span className="material-symbols-outlined text-xs text-slate-400">today</span>
          <span>Hoje às {horas}:{minutos}</span>
        </span>
      );
    }

    // Ontem: Ontem às HH:mm
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return (
        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
          <span className="material-symbols-outlined text-xs text-slate-400">history</span>
          <span>Ontem às {horas}:{minutos}</span>
        </span>
      );
    }

    // Últimos 6 dias
    const diffDays = Math.floor(diffMs / (24 * 3600000));
    if (diffDays < 7 && diffDays >= 1) {
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const diaSemana = diasSemana[d.getDay()];
      return (
        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
          <span className="material-symbols-outlined text-xs text-slate-400">calendar_today</span>
          <span>{diaSemana} às {horas}:{minutos}</span>
        </span>
      );
    }

    // Mais de 7 dias: dd/MM/yyyy às HH:mm
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return (
      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
        <span className="material-symbols-outlined text-xs text-slate-400">calendar_month</span>
        <span>{dia}/{mes}/{ano} às {horas}:{minutos}</span>
      </span>
    );
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen text-slate-900 font-sans antialiased p-4 md:p-8 pb-28 md:pb-12 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-emerald-900 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-semibold text-sm border border-emerald-700">
            <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* TOPO: TÍTULO COM BOTOES DE AÇÃO */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isHotelScope ? 'Equipe & Usuários do Seu Hotel' : 'Usuários do Sistema'}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {isHotelScope
                ? 'Gerencie os colaboradores e acessos do seu hotel. Crie, edite e desative contas da sua equipe.'
                : 'Gerencie os acessos da equipe, níveis de permissão, cargos e status de autenticação.'}
            </p>
          </div>

          {/* BOTOES DE AÇÃO DESKTOP & TABLET */}
          <div className="hidden sm:flex flex-wrap items-center gap-2 sm:gap-3">
            {!isHotelScope && (
              <button
                type="button"
                onClick={() => onNavigateToTiposUsuarios?.()}
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] text-white font-bold text-xs md:text-sm shadow-sm transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                <span>Tipo de Usuários</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#fdb116] hover:bg-[#e5a013] active:scale-[0.98] text-[#2a1700] font-bold text-xs md:text-sm shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#003400] hover:bg-[#004d00] active:scale-[0.98] text-white font-bold text-xs md:text-sm shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>+ Novo Usuário</span>
            </button>
          </div>
        </div>

        {/* BOTOES DE AÇÃO MOBILE */}
        <div className={`${isHotelScope ? 'grid-cols-2' : 'grid-cols-3'} grid gap-2 sm:hidden w-full`}>
          {!isHotelScope && (
            <button
              type="button"
              onClick={() => onNavigateToTiposUsuarios?.()}
              className="py-2.5 px-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              <span className="truncate">Tipo Usuários</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExport}
            className="py-2.5 px-1.5 bg-[#fdb116] hover:bg-[#e5a013] text-[#2a1700] rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exportar</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="py-2.5 px-1.5 bg-[#003400] hover:bg-[#004d00] text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span className="truncate">+ Usuário</span>
          </button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS KPI (2x2 no mobile, 4 colunas no desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Total */}
        <div className="bg-[#eff6ff] rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs border border-blue-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-blue-700">Total de Usuários</span>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">group</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl md:text-3xl font-extrabold text-blue-950">{totalUsers}</span>
            <span className="text-xs md:text-sm font-semibold text-blue-700 ml-1.5">Usuários</span>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-blue-600">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span>+2 adicionados este mês</span>
            </div>
          </div>
        </div>

        {/* Card 2: Ativos */}
        <div className="bg-[#ecfdf5] rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs border border-emerald-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-700">Usuários Ativos</span>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">bolt</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl md:text-3xl font-extrabold text-emerald-950">{activeUsers}</span>
            <span className="text-xs md:text-sm font-semibold text-emerald-700 ml-1.5">Online/Ativos</span>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>83% da equipe</span>
            </div>
          </div>
        </div>

        {/* Card 3: Admins */}
        <div className="bg-[#faf5ff] rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs border border-purple-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-purple-700">Administração & Gestão</span>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">shield_person</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl md:text-3xl font-extrabold text-purple-950">{adminUsers}</span>
            <span className="text-xs md:text-sm font-semibold text-purple-700 ml-1.5">Perfis</span>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-purple-600">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>Acesso total ao hotel</span>
            </div>
          </div>
        </div>

        {/* Card 4: Inativos */}
        <div className="bg-[#fef2f2] rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xs border border-red-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-red-700">Bloqueados / Inativos</span>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">person_off</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl md:text-3xl font-extrabold text-red-950">{inactiveUsers}</span>
            <span className="text-xs md:text-sm font-semibold text-red-700 ml-1.5">Usuários</span>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-red-600">
              <span className="material-symbols-outlined text-sm">lock_clock</span>
              <span>Acesso revogado temporariamente</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE PESQUISA, FILTROS E MODO DE EXIBIÇÃO */}
      <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
          {/* Busca por Texto */}
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="Buscar por nome, e-mail ou cargo..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-xs md:text-sm border border-slate-200 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] transition-colors"
            />
          </div>

          {/* Filtro por Perfil */}
          <div className="relative w-full sm:w-48">
            <select
              value={perfilFilter}
              onChange={(e) => {
                setPerfilFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 rounded-xl text-xs md:text-sm border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-[#003400] cursor-pointer"
            >
              <option value="">Todos os Perfis</option>
              <option value="Administrador">Administrador</option>
              <option value="Hotel">Gerente / Hotel</option>
              <option value="Recepção">Recepção</option>
              <option value="Governança">Governança</option>
              <option value="Camareira">Camareira</option>
              <option value="Financeiro">Financeiro</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
          </div>

          {/* Filtro por Status */}
          <div className="relative w-full sm:w-40">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 rounded-xl text-xs md:text-sm border border-slate-200 text-slate-700 font-medium focus:outline-none focus:border-[#003400] cursor-pointer"
            >
              <option value="">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-lg">expand_more</span>
          </div>

          {/* Limpar Filtros */}
          {(searchQuery || perfilFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPerfilFilter('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors whitespace-nowrap cursor-pointer px-2 py-1"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Botão de Alternância Lista / Grade */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'lista'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
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
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span>Grade</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: TABELA DESKTOP OU CARDS MOBILE */}
      {viewMode === 'lista' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* TABELA DESKTOP (Exibida em telas lg e superiores) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">Usuário</th>
                  <th className="py-4 px-4">Cargo / Função</th>
                  <th className="py-4 px-4">Permissão / Perfil</th>
                  <th className="py-4 px-4">Contato / WhatsApp</th>
                  <th className="py-4 px-4">Último Acesso</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">search_off</span>
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#131b2e] text-white flex items-center justify-center font-extrabold text-xs shrink-0">
                              {user.initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-800">{user.cargo}</td>
                      <td className="py-4 px-4">{getPerfilBadge(user.perfil)}</td>
                      <td className="py-4 px-4">
                        <a
                          href={`https://wa.me/55${user.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 transition-colors font-medium text-xs"
                        >
                          <span className="material-symbols-outlined text-base text-emerald-600">chat</span>
                          <span>{user.phone}</span>
                        </a>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatarUltimoAcesso(user.lastAccess, user.email, user.createdAt)}
                      </td>
                      <td className="py-4 px-4 text-center">{getStatusBadge(user.status)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedUserView(user)}
                            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors cursor-pointer"
                            title="Ver detalhes"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition-colors cursor-pointer"
                            title="Editar usuário"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          {isProtectedUser(user) ? (
                            <span 
                              className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center cursor-not-allowed" 
                              title={user.perfil === 'Hotel' ? "Primeiro usuário com perfil Hotel protegido contra exclusão (necessário para acesso ao sistema)" : "Usuário Administrador Master protegido contra exclusão"}
                            >
                              <span className="material-symbols-outlined text-lg">lock</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedUserDelete(user)}
                              className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="Excluir usuário"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* CARDS MOBILE (Exibidos em telas menores que lg - 1:1 com a imagem anexada) */}
          <div className="lg:hidden p-3.5 space-y-3">
            {paginatedUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-xl">
                <span className="material-symbols-outlined text-4xl block mb-2 text-slate-300">search_off</span>
                Nenhum usuário encontrado.
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div key={user.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col gap-3">
                  {/* Top Header Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#131b2e] text-white flex items-center justify-center font-extrabold text-xs shrink-0">
                          {user.initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-900 text-sm block truncate">{user.name}</span>
                        <span className="text-xs text-slate-500 font-medium truncate block">{user.cargo}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {getPerfilBadge(user.perfil)}
                      {getStatusBadge(user.status)}
                    </div>
                  </div>

                  {/* Informações de Contato / Acesso */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-base text-slate-400 shrink-0">mail</span>
                      <span className="truncate text-slate-800 font-medium">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={`https://wa.me/55${user.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-emerald-700 font-semibold"
                      >
                        <span className="material-symbols-outlined text-base text-emerald-600">chat</span>
                        <span>{user.phone}</span>
                      </a>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                        {formatarUltimoAcesso(user.lastAccess, user.email, user.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação 3 colunas (Ver, Editar, Excluir) */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedUserView(user)}
                      className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">visibility</span>
                      <span>Ver</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(user)}
                      className="h-9 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white flex items-center justify-center gap-1 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      <span>Editar</span>
                    </button>
                    {isProtectedUser(user) ? (
                      <div 
                        className="h-9 px-3 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1 text-xs font-bold shrink-0 cursor-not-allowed"
                        title={user.perfil === 'Hotel' ? "Primeiro usuário com perfil Hotel protegido contra exclusão" : "Usuário protegido contra exclusão"}
                      >
                        <span className="material-symbols-outlined text-base">lock</span>
                        <span>Protegido</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedUserDelete(user)}
                        className="h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* RODAPÉ E PAGINAÇÃO */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs md:text-sm text-slate-500">
              Exibindo <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> de <span className="font-bold text-slate-900">{filteredUsers.length}</span> usuários cadastrados
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
                <span>Anterior</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#003400] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>Próximo</span>
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* MODO GRADE (CARDS DE GRID) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedUsers.map(user => (
            <div key={user.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#131b2e] text-white flex items-center justify-center font-extrabold text-sm">
                      {user.initials}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">{user.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{user.cargo}</p>
                  </div>
                </div>
                {getStatusBadge(user.status)}
              </div>

              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Perfil:</span>
                  {getPerfilBadge(user.perfil)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">WhatsApp:</span>
                  <span className="font-semibold text-emerald-700">{user.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Último Acesso:</span>
                  <div>{formatarUltimoAcesso(user.lastAccess, user.email, user.createdAt)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserView(user)}
                  className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">visibility</span>
                  <span>Ver</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(user)}
                  className="py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  <span>Editar</span>
                </button>
                {isProtectedUser(user) ? (
                  <div 
                    className="py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed"
                    title={user.perfil === 'Hotel' ? "Primeiro usuário com perfil Hotel protegido contra exclusão" : "Usuário protegido contra exclusão"}
                  >
                    <span className="material-symbols-outlined text-base">lock</span>
                    <span>Protegido</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedUserDelete(user)}
                    className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    <span>Excluir</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE USUÁRIO */}
      {(isCreateModalOpen || selectedUserEdit) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">
                    {selectedUserEdit ? 'manage_accounts' : 'person_add'}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
                    {selectedUserEdit ? 'Editar Usuário' : 'Novo Usuário do Sistema'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Preencha as permissões e dados cadastrais do membro da equipe.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setSelectedUserEdit(null);
                }}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="Ex: Carlos Alberto Ramos"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    E-mail de Acesso *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="carlos@hotelmaster.com.br"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Cargo / Função *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCargo}
                    onChange={(e) => setFormCargo(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="Ex: Recepcionista Líder"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Perfil / Permissão *
                  </label>
                  <select
                    value={formPerfil}
                    onChange={(e) => setFormPerfil(e.target.value as Usuario['perfil'])}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50 cursor-pointer"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Hotel">Gerente (Acesso Hotel)</option>
                    <option value="Recepção">Recepção</option>
                    <option value="Governança">Governança</option>
                    <option value="Camareira">Camareira</option>
                    <option value="Financeiro">Financeiro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    WhatsApp / Telefone *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(maskPhone(e.target.value))}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="(54) 99123-4567"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Status do Acesso *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as Usuario['status'])}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:border-[#003400] bg-slate-50/50 cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Seção Endereço com ViaCEP */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Endereço Residencial (Opcional - Busca ViaCEP)</h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">CEP</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formCep}
                        onChange={handleCepChange}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder="00000-000"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50/50"
                      />
                      {isLoadingCep && (
                        <span className="material-symbols-outlined text-emerald-600 text-sm absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin">sync</span>
                      )}
                    </div>
                    {cepError && <span className="text-[10px] text-red-600 font-semibold">{cepError}</span>}
                  </div>

                  <div className="md:col-span-8 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Logradouro</label>
                    <input
                      type="text"
                      value={formStreet}
                      onChange={(e) => setFormStreet(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="Rua / Avenida"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50/50"
                    />
                  </div>

                  <div className="md:col-span-5 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Bairro</label>
                    <input
                      type="text"
                      value={formNeighborhood}
                      onChange={(e) => setFormNeighborhood(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="Bairro"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50/50"
                    />
                  </div>

                  <div className="md:col-span-5 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">Cidade</label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="Cidade"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50/50"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">UF</label>
                    <input
                      type="text"
                      value={formUf}
                      onChange={(e) => setFormUf(e.target.value.toUpperCase())}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="UF"
                      maxLength={2}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#003400] bg-slate-50/50 uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setSelectedUserEdit(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#004d00] text-white text-xs font-bold cursor-pointer shadow-sm"
                >
                  {selectedUserEdit ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DETALHADA DO USUÁRIO (Padrão do Sistema) */}
      {selectedUserView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* MODAL HEADER (Padrão do Sistema: fundo #003400) */}
            <div className="bg-[#003400] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span className="material-symbols-outlined text-[#25D366] text-xl shrink-0">manage_accounts</span>
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">Detalhes do Usuário</h2>
                <span className="text-[11px] bg-emerald-950/80 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-800 shrink-0">
                  #{selectedUserView.id}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserView(null)}
                aria-label="Fechar Modal"
                className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* MODAL BODY (Scrollable) */}
            <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-4 text-slate-700 text-xs sm:text-sm">
              
              {/* CARD DE IDENTIDADE DO USUÁRIO */}
              <section className="p-4 bg-gradient-to-r from-emerald-50/80 via-indigo-50/40 to-slate-50 border border-emerald-100 rounded-2xl flex items-center gap-4 shadow-xs">
                {selectedUserView.avatarUrl ? (
                  <img src={selectedUserView.avatarUrl} alt={selectedUserView.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-emerald-500 shadow-sm shrink-0" />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#131b2e] text-white flex items-center justify-center font-black text-lg border-2 border-emerald-500 shadow-sm shrink-0">
                    {selectedUserView.initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug truncate">{selectedUserView.name}</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{selectedUserView.cargo}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {getPerfilBadge(selectedUserView.perfil)}
                    {getStatusBadge(selectedUserView.status)}
                  </div>
                </div>
              </section>

              {/* CONTATO & CREDENCIAIS */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold uppercase text-[11px] tracking-wider text-slate-500">
                  <span className="material-symbols-outlined text-base text-emerald-700">contact_phone</span>
                  <span>Contato & Credenciais de Acesso</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* E-mail */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">E-mail de Login</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 truncate">{selectedUserView.email}</span>
                  </div>

                  {/* WhatsApp */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">WhatsApp / Telefone</span>
                    <a
                      href={`https://wa.me/55${selectedUserView.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-emerald-700 hover:underline mt-1 inline-flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm text-emerald-600">chat</span>
                      <span>{selectedUserView.phone}</span>
                    </a>
                  </div>

                  {/* Cargo */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Cargo / Função</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 truncate">{selectedUserView.cargo}</span>
                  </div>

                  {/* Último Acesso */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Último Acesso</span>
                    <div className="mt-1">
                      {formatarUltimoAcesso(selectedUserView.lastAccess, selectedUserView.email, selectedUserView.createdAt)}
                    </div>
                  </div>
                </div>
              </section>

              {/* ENDEREÇO RESIDENCIAL (se houver) */}
              {selectedUserView.cep && (
                <section className="space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase text-[11px] tracking-wider text-slate-500">
                    <span className="material-symbols-outlined text-base text-emerald-700">home_pin</span>
                    <span>Endereço Residencial (ViaCEP)</span>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">CEP:</span>
                      <span className="font-bold text-slate-900">{selectedUserView.cep}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Logradouro:</span>
                      <span className="font-semibold text-slate-800">{selectedUserView.street || 'Não informado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Bairro / Cidade:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedUserView.neighborhood ? `${selectedUserView.neighborhood}, ` : ''}{selectedUserView.city || ''}/{selectedUserView.uf || ''}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedUserView(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={() => {
                  const user = selectedUserView;
                  setSelectedUserView(null);
                  handleOpenEdit(user);
                }}
                className="px-5 py-2 rounded-xl bg-[#003400] hover:bg-[#002400] text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span>Editar Usuário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {selectedUserDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Excluir Usuário?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tem certeza que deseja remover o acesso do usuário <strong className="text-slate-900">{selectedUserDelete.name}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserDelete(null)}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
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

export default ListagemUsuarios;
