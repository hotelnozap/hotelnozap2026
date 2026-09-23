import React, { useState, useRef, useMemo } from 'react';
import { Usuario } from './ListagemUsuarios';
import { fetchAddressByCep } from '../utils/viacep';
import { maskCep, maskCpf, maskPhone, isValidCpf, getCpfValidationStatus } from '../utils/masks';
import { usuariosService, currentHotelService } from '../services/supabaseService';
import { uploadImageToStorage } from '../services/storageService';
import { supabase } from '../lib/supabase';

export interface FormUsuarioProps {
  userToEdit?: Usuario | null;
  isHotelScope?: boolean;
  hotelId?: string;
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const FormUsuario: React.FC<FormUsuarioProps> = ({
  userToEdit,
  isHotelScope = false,
  hotelId,
  onBack,
  onSaveSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States do formulário
  const [isActive, setIsActive] = useState<boolean>(userToEdit ? userToEdit.status === 'ativo' : true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(userToEdit?.avatarUrl || null);

  const [name, setName] = useState(userToEdit?.name || '');
  const [cargo, setCargo] = useState(userToEdit?.cargo || '');
  const [department, setDepartment] = useState('recepcao');
  
  const [whatsapp, setWhatsapp] = useState(userToEdit?.phone || '');
  const [cpf, setCpf] = useState(userToEdit?.cpf ? maskCpf(userToEdit.cpf) : '');

  // Validação em tempo real do CPF
  const cpfValidation = useMemo(() => getCpfValidationStatus(cpf), [cpf]);
  const [ramal, setRamal] = useState('');

  const [email, setEmail] = useState(userToEdit?.email || '');
  const DEFAULT_PROFILE_HOTEL: Usuario['perfil'] = 'Hotel';
  const FORBIDDEN_PROFILES_HOTEL = ['Super Admin', 'Administrador', 'Parceiro'] as const;
  const resolveInitialProfile = (): Usuario['perfil'] => {
    if (userToEdit?.perfil) {
      if (userToEdit.perfil === 'Gerente') return 'Hotel';
      if (isHotelScope && (FORBIDDEN_PROFILES_HOTEL as readonly string[]).includes(userToEdit.perfil)) {
        return DEFAULT_PROFILE_HOTEL;
      }
      return userToEdit.perfil;
    }
    return isHotelScope ? DEFAULT_PROFILE_HOTEL : 'Recepção';
  };
  const [perfil, setPerfil] = useState<Usuario['perfil']>(resolveInitialProfile());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Endereço (ViaCEP)
  const [cep, setCep] = useState(userToEdit?.cep || '');
  const [street, setStreet] = useState(userToEdit?.street || '');
  const [neighborhood, setNeighborhood] = useState(userToEdit?.neighborhood || '');
  const [city, setCity] = useState(userToEdit?.city || '');
  const [uf, setUf] = useState(userToEdit?.uf || '');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handler para apagar placeholder automaticamente ao clicar no campo (onFocus)
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
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setUf(data.uf.toUpperCase());
      } else {
        setCepError('CEP não encontrado na base do ViaCEP.');
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setCep(masked);
    setCepError(null);
    if (masked.replace(/\D/g, '').length === 8) {
      handleSearchViaCep(masked);
    }
  };

  // Foto de Perfil Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const tempUrl = URL.createObjectURL(file);
      setPhotoPreview(tempUrl);
      showToast('Enviando foto para o bucket hotelnozap...');

      const uploadedUrl = await uploadImageToStorage(file, 'usuarios');
      if (uploadedUrl) {
        setPhotoPreview(uploadedUrl);
        showToast('Foto salva no bucket hotelnozap!');
      } else {
        showToast('Foto selecionada com sucesso (local)!');
      }
    }
  };

  // Envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Por favor, preencha o Nome Completo e o E-mail.');
      return;
    }

    if (cpf.trim()) {
      if (!isValidCpf(cpf)) {
        showToast('O CPF do colaborador é falso ou inválido. Digite um CPF autêntico da Receita Federal.');
        return;
      }
    }

    if (!userToEdit) {
      if (!password.trim()) {
        showToast('Por favor, informe a Senha de Acesso para o novo usuário.');
        return;
      }
      if (password !== confirmPassword) {
        showToast('As senhas digitadas não coincidem.');
        return;
      }
      if (password.length < 6) {
        showToast('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
    } else {
      if (password.trim() || confirmPassword.trim()) {
        if (password !== confirmPassword) {
          showToast('As senhas digitadas não coincidem.');
          return;
        }
        if (password.length < 6) {
          showToast('A nova senha deve ter no mínimo 6 caracteres.');
          return;
        }
      }
    }

    const getInitials = (n: string) => {
      const parts = n.trim().split(' ');
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      return n.substring(0, 2).toUpperCase();
    };

    // Todo usuário do tipo gerente tem perfil de acesso Hotel
    const finalPerfil: Usuario['perfil'] = 
      (perfil === 'Gerente' || cargo.toLowerCase().includes('gerente')) 
        ? 'Hotel' 
        : perfil;

    // R11: validação frontend adicional para origem Hotel
    if (isHotelScope) {
      if ((FORBIDDEN_PROFILES_HOTEL as readonly string[]).includes(finalPerfil)) {
        showToast('Perfil proibido para este nível de acesso. Escolha outro perfil.');
        return;
      }
    }
    const getScopeHotelId = (): string | null => {
      if (!isHotelScope) return null;
      if (hotelId) return hotelId;
      try {
        const cur = currentHotelService.getCurrentHotel();
        if (cur?.id) return cur.id;
        const saved = localStorage.getItem('hotelnozap_hotel_atual');
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        return (parsed?.id as string) || null;
      } catch {
        return null;
      }
    };

    if (userToEdit) {
      await usuariosService.updateUsuario(userToEdit.id, {
        name,
        email,
        cargo,
        perfil: finalPerfil,
        phone: whatsapp,
        status: isActive ? 'ativo' : 'inativo',
        initials: getInitials(name),
        avatarUrl: photoPreview || undefined,
        cep,
        street,
        neighborhood,
        city,
        uf
      });

      // Se o usuário digitou uma nova senha válida em modo edição, atualiza a credencial
      if (password.trim() && password.length >= 6 && password === confirmPassword) {
        try {
          const { data: sData } = await supabase.auth.getSession();
          if (sData?.session?.user?.email?.toLowerCase() === email.trim().toLowerCase()) {
            await supabase.auth.updateUser({ password: password.trim() });
          }
          await supabase.from('usuarios')
            .update({ password: password.trim() })
            .eq('id', userToEdit.id);
        } catch (pwErr) {
          console.warn('Erro ao atualizar senha do usuário:', pwErr);
        }
      }
      // Se senhas deixadas em branco: mantém a senha atual 100% inalterada!
    } else {
      const scopeHotelId = getScopeHotelId();
      const createRes = await usuariosService.createUsuario({
        name,
        email,
        cargo: cargo || 'Gerente Geral',
        perfil: finalPerfil,
        phone: whatsapp || '',
        lastAccess: 'Novo usuário',
        status: isActive ? 'ativo' : 'inativo',
        initials: getInitials(name),
        avatarUrl: photoPreview || undefined,
        cep,
        street,
        neighborhood,
        city,
        uf,
        ...(scopeHotelId ? { hotel_id: scopeHotelId } : {})
      }, password, { adminMode: true });
      if (!createRes.success) {
        showToast(createRes.error || 'Erro ao cadastrar usuário. Verifique os dados e tente novamente.');
        return;
      }
    }


    showToast(`Usuário "${name}" ${userToEdit ? 'atualizado' : 'cadastrado'} com sucesso!`);
    setTimeout(() => {
      if (onSaveSuccess) onSaveSuccess();
    }, 1200);
  };

  return (
    <div className="bg-[#f8f9ff] min-h-screen text-slate-800 font-sans antialiased p-4 md:p-8 pb-28 md:pb-12 max-w-4xl mx-auto">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-[#003400] text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 font-semibold text-sm border border-emerald-700">
            <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* LINK DE VOLTAR */}
      <div className="mb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-[#003400] hover:underline cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>{isHotelScope ? 'Voltar para Usuários da Equipe' : 'Voltar para Usuários do Sistema'}</span>
        </button>
      </div>

      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {userToEdit ? 'Editar Usuário' : 'Cadastro de Novo Usuário'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Defina credenciais, nível de permissão de acesso e dados de contato do colaborador
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            type="button"
            onClick={onBack}
            className="px-4 md:px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white font-semibold text-xs md:text-sm hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="user-form"
            className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-lg bg-[#003400] hover:bg-[#002400] text-white font-bold text-xs md:text-sm transition shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Salvar Usuário</span>
          </button>
        </div>
      </div>

      {/* FORMULÁRIO PRINCIPAL */}
      <form id="user-form" onSubmit={handleSubmit} className="mt-6 space-y-6">

        {/* SEÇÃO 1: PERFIL E STATUS DA CONTA */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#003400]">account_circle</span>
              <h2 className="text-sm md:text-base font-semibold text-slate-900">Perfil e Status da Conta</h2>
            </div>
            {/* Switch Ativo / Inativo */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => setIsActive(!isActive)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              <span className="ml-3 text-xs md:text-sm font-semibold text-[#003400]">
                {isActive ? 'Usuário Ativo' : 'Usuário Inativo'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Upload de Foto */}
            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-[#003400]/40 transition bg-slate-50/50">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden mb-3 group cursor-pointer"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-slate-400 text-4xl group-hover:scale-110 transition">person</span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003400] bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>Selecionar Foto</span>
              </button>
              <p className="text-[11px] text-slate-400 mt-1.5">PNG, JPG até 3MB</p>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* Campos de Nome e Cargo */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Ex: Carlos Alberto Ramos"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Cargo / Função <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cargo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCargo(val);
                      if (val.toLowerCase().includes('gerente')) {
                        setPerfil('Hotel');
                      }
                    }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="Ex: Gerente Geral, Recepcionista"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Departamento / Setor
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] cursor-pointer"
                  >
                    <option value="administracao">Administração & Gerência</option>
                    <option value="recepcao">Recepção & Reservas</option>
                    <option value="financeiro">Financeiro & Caixa</option>
                    <option value="governanca">Governança & Camareiras</option>
                    <option value="manutencao">Manutenção & Operações</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: CONTATO E IDENTIFICAÇÃO */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
            <span className="material-symbols-outlined text-[#003400]">contact_phone</span>
            <h2 className="text-sm md:text-base font-semibold text-slate-900">Contato & Identificação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                WhatsApp / Celular <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">chat</span>
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="(00) 00000-0000"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  CPF do Colaborador
                </label>
                {cpfValidation.isComplete && (
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${
                    cpfValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {cpfValidation.isValid ? 'verified' : 'cancel'}
                    </span>
                    {cpfValidation.isValid ? 'CPF Autêntico' : 'CPF Inválido'}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">badge</span>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={`w-full pl-9 pr-8 py-2.5 border rounded-lg text-sm transition-all font-mono ${
                    cpfValidation.isComplete
                      ? cpfValidation.isValid
                        ? 'bg-emerald-50/20 border-emerald-500 text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                        : 'bg-rose-50/30 border-rose-400 text-rose-950 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]'
                  }`}
                />
                {cpfValidation.isComplete && (
                  <span className={`absolute right-3 top-2.5 material-symbols-outlined text-lg pointer-events-none ${
                    cpfValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {cpfValidation.isValid ? 'check_circle' : 'error'}
                  </span>
                )}
              </div>
              {cpfValidation.isComplete && !cpfValidation.isValid && (
                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  Este CPF é falso ou inválido. Digite um CPF autêntico da Receita Federal.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Telefone Fixo / Ramal
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">call</span>
                <input
                  type="text"
                  value={ramal}
                  onChange={(e) => setRamal(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Ramal 104"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: CREDENCIAIS DE ACESSO E PERMISSÕES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
            <span className="material-symbols-outlined text-[#003400]">lock</span>
            <h2 className="text-sm md:text-base font-semibold text-slate-900">Acesso ao Sistema & Permissões</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                E-mail de Login <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  autoComplete="off"
                  placeholder="usuario@hotelmaster.com.br"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Perfil de Permissão <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">admin_panel_settings</span>
                <select
                  required
                  value={perfil === 'Gerente' ? 'Hotel' : perfil}
                  onChange={(e) => setPerfil(e.target.value as Usuario['perfil'])}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] cursor-pointer"
                >
                  {!isHotelScope && (
                    <>
                      <option value="Super Admin">Super Admin (Acesso Master SaaS)</option>
                      <option value="Administrador">Administrador (Acesso Total Geral)</option>
                      <option value="Parceiro">Parceiro (Afiliado/Indicador)</option>
                    </>
                  )}
                  <option value="Hotel">Gerente & Gestão Geral do Hotel</option>
                  <option value="Recepção">Recepção (Reservas, Hóspedes e Quartos)</option>
                  <option value="Financeiro">Financeiro (Caixa, Despesas e Vendas)</option>
                  <option value="Governança">Governança (Limpeza e Status dos Quartos)</option>
                  <option value="Camareira">Camareira (Limpeza, Checklists e Ocorrências)</option>
                  <option value="Hóspede">Hóspede (Acesso restrito Portal do Hóspede)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Campos de Senha com Olhinho */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Senha de Acesso {!userToEdit && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">key</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!userToEdit}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  autoComplete="new-password"
                  placeholder={userToEdit ? 'Deixe em branco para manter a mesma senha' : 'Mínimo 6 caracteres'}
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {userToEdit && (
                <p className="text-[11px] text-slate-500 font-normal mt-1">
                  Deixe em branco para manter a mesma senha atual.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirmar Senha {!userToEdit && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">lock_reset</span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required={!userToEdit || Boolean(password.trim())}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  autoComplete="new-password"
                  placeholder={userToEdit ? 'Deixe em branco para manter' : 'Repita a senha digitada'}
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Banner de Segurança */}
          <div className="mt-4 p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-700 text-[20px] mt-0.5">verified_user</span>
            <div className="text-xs text-emerald-900">
              <span className="font-semibold">Segurança & Autenticação:</span> O usuário receberá confirmação de cadastro e poderá autenticar-se tanto pelo sistema web quanto no painel de gestão do hotel.
            </div>
          </div>
        </div>

        {/* SEÇÃO 4: ENDEREÇO RESIDENCIAL (ViaCEP) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
            <span className="material-symbols-outlined text-[#003400]">home_pin</span>
            <h2 className="text-sm md:text-base font-semibold text-slate-900">Endereço Residencial (Opcional - Busca ViaCEP)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">CEP</label>
              <div className="relative">
                <input
                  type="text"
                  value={cep}
                  onChange={handleCepChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="00000-000"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
                {isLoadingCep && (
                  <span className="material-symbols-outlined text-emerald-600 text-sm absolute right-3 top-1/2 -translate-y-1/2 animate-spin">sync</span>
                )}
              </div>
              {cepError && <span className="text-[10px] text-red-600 font-semibold">{cepError}</span>}
            </div>

            <div className="md:col-span-8 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Logradouro / Endereço</label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="Rua, Avenida, Número, Complemento"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-5 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Bairro</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="Bairro"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-5 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Cidade</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="Cidade"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">UF</label>
              <input
                type="text"
                value={uf}
                onChange={(e) => setUf(e.target.value.toUpperCase())}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="UF"
                maxLength={2}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] uppercase"
              />
            </div>
          </div>
        </div>

        {/* BARRA DE AÇÕES INFERIOR */}
        <div className="flex items-center justify-between pt-4 pb-12">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white font-medium text-sm hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#003400] hover:bg-[#002400] text-white font-medium text-sm transition shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Salvar Usuário</span>
            </button>
          </div>
        </div>

      </form>
    </div>
  );
};

export default FormUsuario;
