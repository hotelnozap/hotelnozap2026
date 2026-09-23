import React, { useState, useRef, useMemo } from 'react';
import { Partner } from './ListagemParceiros';
import { parceirosService } from '../services/supabaseService';
import {
  maskCpf,
  maskCnpj,
  maskPhone,
  maskCpfCnpj,
  isValidCpf,
  isValidCnpj,
  getCpfValidationStatus,
  getCnpjValidationStatus
} from '../utils/masks';
import {
  getPartnerReferralLink,
  copyPartnerReferralLink,
  openPartnerReferralLink
} from '../utils/partnerUrl';

export interface CadastroParceiroProps {
  partnerToEdit?: Partner | null;
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroParceiro: React.FC<CadastroParceiroProps> = ({
  partnerToEdit,
  onBack,
  onSaveSuccess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialDoc = partnerToEdit?.document || '';
  const initialDigits = initialDoc.replace(/\D/g, '');
  const initialTipoPessoa = initialDigits.length > 11 ? 'juridica' : 'fisica';

  // States
  const [status, setStatus] = useState<'ativo' | 'pausado'>(partnerToEdit?.status === 'pausado' ? 'pausado' : 'ativo');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Section 2: Identificação
  const [tipoPessoa, setTipoPessoa] = useState<'fisica' | 'juridica'>(initialTipoPessoa);
  const [name, setName] = useState(partnerToEdit?.name || '');
  // Detecta se a categoria salva não é uma das pré-definidas (ou seja, é "Outro")
  const predefinedCategories = ['Consultor Hoteleiro', 'Influencer Hoteleiro', 'Consultoria de Expansão', 'Agência de Marketing Turístico', 'Associação Comercial / Rede Hoteleira', 'Criadores de Conteúdo'];
  const savedCategory = partnerToEdit?.category || 'Consultor Hoteleiro';
  const isOtherCategory = savedCategory !== '' && !predefinedCategories.includes(savedCategory);
  const [category, setCategory] = useState(isOtherCategory ? 'Outro' : savedCategory);
  const [otherCategory, setOtherCategory] = useState(isOtherCategory ? savedCategory : '');
  const [document, setDocument] = useState(
    initialDigits ? (initialTipoPessoa === 'fisica' ? maskCpf(initialDoc) : maskCnpj(initialDoc)) : ''
  );
  const [email, setEmail] = useState(partnerToEdit?.email || '');
  const [phone, setPhone] = useState(partnerToEdit?.phone ? maskPhone(partnerToEdit.phone) : '');

  // Section 3: Comissões
  const [coupon, setCoupon] = useState(partnerToEdit?.coupon || '');
  const [level, setLevel] = useState(partnerToEdit?.level || 'Nível Prata (10% por mensalidade de hotel)');
  const parseCommissionRate = (commission?: string, taxaComissao?: number) => {
    if (taxaComissao !== undefined && taxaComissao !== null) return String(taxaComissao);
    if (!commission) return '10';
    const num = parseFloat(commission.replace('%', '').replace('Recorrente', '').trim());
    if (isNaN(num)) return '10';
    return String(num);
  };
  const isHotelNoZapInitial = Boolean(
    (partnerToEdit?.name || '').toLowerCase().includes('hotel no zap') ||
    (partnerToEdit?.name || '').toLowerCase().includes('hotelnozap') ||
    (partnerToEdit?.coupon || '').toUpperCase() === 'HOTELNOZAP' ||
    partnerToEdit?.id === 'HOTELNOZAP'
  );
  const [commissionRate, setCommissionRate] = useState(
    isHotelNoZapInitial ? '0' : parseCommissionRate(partnerToEdit?.commission, partnerToEdit?.taxa_comissao)
  );
  const [recurrenceModel, setRecurrenceModel] = useState('Recorrente Vitalício (Enquanto o Hotel pagar)');

  // Section 4: Dados Financeiros
  const [pixType, setPixType] = useState(partnerToEdit?.pixType || 'E-mail');
  const [pixKey, setPixKey] = useState(partnerToEdit?.pixKey || partnerToEdit?.email || '');
  const [bankName, setBankName] = useState(partnerToEdit?.bankName || '');
  const [holderName, setHolderName] = useState(partnerToEdit?.holderName || partnerToEdit?.name || '');

  // Section 5: Senha
  const [accessEmail, setAccessEmail] = useState(partnerToEdit?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validação em tempo real do Documento (CPF / CNPJ)
  const docValidation = useMemo(() => {
    if (tipoPessoa === 'fisica') {
      return getCpfValidationStatus(document);
    }
    return getCnpjValidationStatus(document);
  }, [document, tipoPessoa]);

  // Identifica exclusivamente o parceiro oficial HOTELNOZAP para permitir taxa de comissão de 0%
  const isParceiroHotelNoZap = useMemo(() => {
    const cleanCoupon = (coupon || '').trim().toUpperCase();
    const cleanEditCoupon = (partnerToEdit?.coupon || '').trim().toUpperCase();
    const cleanName = (name || '').toLowerCase();
    const cleanEditName = (partnerToEdit?.name || '').toLowerCase();
    return (
      cleanCoupon === 'HOTELNOZAP' ||
      cleanEditCoupon === 'HOTELNOZAP' ||
      cleanName.includes('hotel no zap') ||
      cleanName.includes('hotelnozap') ||
      cleanEditName.includes('hotel no zap') ||
      cleanEditName.includes('hotelnozap') ||
      partnerToEdit?.id === 'HOTELNOZAP'
    );
  }, [coupon, partnerToEdit, name]);

  const handleTipoPessoaChange = (newTipo: 'fisica' | 'juridica') => {
    setTipoPessoa(newTipo);
    if (document) {
      const digits = document.replace(/\D/g, '');
      setDocument(newTipo === 'fisica' ? maskCpf(digits) : maskCnpj(digits));
    }
  };

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      showToast('Foto do parceiro selecionada com sucesso!');
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyPartnerReferralLink(coupon);
    if (ok) {
      showToast('Link exclusivo de indicação copiado com sucesso!');
    } else {
      showToast('Não foi possível copiar o link.');
    }
  };

  const handleOpenLink = () => {
    openPartnerReferralLink(coupon);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Por favor, informe o Nome Completo ou Razão Social.');
      return;
    }

    // Validação estrita de CPF/CNPJ em tempo real
    if (tipoPessoa === 'fisica') {
      if (!document.trim()) {
        showToast('Por favor, informe o CPF do parceiro.');
        return;
      }
      if (!isValidCpf(document)) {
        showToast('CPF inválido! Por favor, digite um CPF autêntico para evitar cadastros falsos.');
        return;
      }
    } else {
      if (!document.trim()) {
        showToast('Por favor, informe o CNPJ da empresa parceira.');
        return;
      }
      if (!isValidCnpj(document)) {
        showToast('CNPJ inválido! Por favor, digite um CNPJ autêntico.');
        return;
      }
    }

    // Validação da Taxa de Comissão (0% exclusivo para parceiro institucional HOTELNOZAP)
    const rateNum = parseFloat(commissionRate || '0');
    const minRate = isParceiroHotelNoZap ? 0 : 1;
    if (isNaN(rateNum) || rateNum < minRate || rateNum > 50) {
      showToast(isParceiroHotelNoZap
        ? 'A taxa de comissão deve estar entre 0% e 50%.'
        : 'A taxa de comissão deve estar entre 1% e 50% (a taxa de 0% é exclusiva para o parceiro oficial HOTELNOZAP).'
      );
      return;
    }

    if (!partnerToEdit) {
      if (!password.trim()) {
        showToast('Por favor, informe a senha de acesso para o parceiro.');
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

    // Validação da categoria "Outro"
    if (category === 'Outro' && !otherCategory.trim()) {
      showToast('Por favor, informe a categoria de atuação no campo "Outro".');
      return;
    }

    const finalCategory = category === 'Outro' ? otherCategory.trim() : category;

    const isHotelNoZapOfficial = isParceiroHotelNoZap;
    const finalRateNum = isHotelNoZapOfficial ? 0 : rateNum;

    const payloadPartner: Partial<Partner> = {
      name,
      category: finalCategory,
      document,
      phone,
      email,
      coupon,
      commission: isHotelNoZapOfficial ? '0% Recorrente' : `${finalRateNum}% Recorrente`,
      taxa_comissao: isHotelNoZapOfficial ? 0 : finalRateNum,
      level: isHotelNoZapOfficial ? 'Institucional' : level,
      status: status === 'pausado' ? 'pausado' : 'ativo',
      pixType,
      pixKey,
      bankName,
      holderName
    };

    if (partnerToEdit) {
      await parceirosService.updateParceiro(partnerToEdit.id, payloadPartner, password ? { password } : undefined);
    } else {
      const parceiroRes = await parceirosService.createParceiro(payloadPartner, { password });
      if (!parceiroRes.success) {
        showToast(parceiroRes.error || 'Erro ao cadastrar parceiro. Verifique os dados e tente novamente.');
        return;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_parceiro'));
    }

    showToast(`Parceiro "${name}" ${partnerToEdit ? 'atualizado' : 'cadastrado'} com sucesso!`);
    setTimeout(() => {
      if (onSaveSuccess) onSaveSuccess();
    }, 1200);
  };

  const generatedLink = useMemo(() => getPartnerReferralLink(coupon), [coupon]);

  return (
    <div className="bg-[#F8F9FA] min-h-screen p-4 md:p-10 text-slate-800 pb-28 md:pb-12 max-w-5xl mx-auto">
      
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-lg flex items-center gap-3 font-semibold text-sm">
            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* TOPO: LINK DE VOLTAR & CABEÇALHO */}
      <div className="mb-6 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-slate-600 hover:text-[#003400] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para a Listagem de Parceiros</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                {partnerToEdit ? 'Editar Parceiro' : 'Cadastro de Novo Parceiro'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Programa B2B SaaS
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Cadastre consultores, influencers e agências para divulgação do sistema SaaS Hotel no Zap.
            </p>
          </div>

          {/* Switch de Status */}
          <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs self-start sm:self-auto">
            <span className="text-xs font-medium text-slate-600">Status:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={status === 'ativo'}
                onChange={() => setStatus(status === 'ativo' ? 'pausado' : 'ativo')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#003400]"></div>
            </label>
            <span className={`text-xs font-bold ${status === 'ativo' ? 'text-emerald-700' : 'text-slate-500'}`}>
              {status === 'ativo' ? 'Ativo' : 'Pausado'}
            </span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* BLOCO 1: FOTO / LOGO DO PARCEIRO */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#003400]">add_a_photo</span>
              <span>Foto de Perfil ou Logotipo da Parceria</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Esta imagem será exibida nos relatórios de conversão, links de divulgação e no painel do parceiro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Preview Box */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl hover:border-[#003400] transition-colors cursor-pointer group">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition-transform overflow-hidden relative shadow-inner">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto parceiro" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-emerald-600">account_circle</span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-3">Pré-visualização</p>
              <span className="text-[11px] text-slate-400">JPG, PNG ou SVG até 5MB</span>
            </div>

            {/* Upload Dropzone */}
            <div className="md:col-span-2 flex flex-col justify-center border-2 border-dashed border-emerald-600/40 bg-emerald-50/20 rounded-xl p-5 text-center hover:bg-emerald-50/40 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-[#003400] mb-2">
                <span className="material-symbols-outlined text-2xl">cloud_upload</span>
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-slate-800">Carregar arquivo do computador</h3>
              <p className="text-xs text-slate-500 mt-1 mb-3">Arraste e solte o arquivo aqui ou clique no botão abaixo para explorar suas pastas</p>
              
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#003400] hover:bg-[#002500] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  <span>Selecionar do Computador</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden" 
                />

                {photoPreview && (
                  <button 
                    type="button" 
                    onClick={() => setPhotoPreview(null)}
                    className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors cursor-pointer"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BLOCO 2: IDENTIFICAÇÃO DO PARCEIRO */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#003400]">badge</span>
            <span>Identificação do Parceiro</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo de Pessoa */}
            <div className="md:col-span-3 flex items-center gap-6 pb-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-700">Tipo de Inscrição:</span>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input 
                  type="radio" 
                  name="tipo_pessoa" 
                  checked={tipoPessoa === 'fisica'}
                  onChange={() => handleTipoPessoaChange('fisica')}
                  className="accent-[#003400] w-4 h-4"
                />
                Pessoa Física (CPF / Profissional)
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input 
                  type="radio" 
                  name="tipo_pessoa" 
                  checked={tipoPessoa === 'juridica'}
                  onChange={() => handleTipoPessoaChange('juridica')}
                  className="accent-[#003400] w-4 h-4"
                />
                Pessoa Jurídica (CNPJ / Agência / Consultoria)
              </label>
            </div>

            {/* Nome Completo / Razão Social */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Nome Completo / Razão Social <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Rodrigo Carvalho ou Agência Viaje Tranquilo Ltda" 
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            {/* Categoria de Atuação */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Categoria de Atuação <span className="text-red-500">*</span>
              </label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] bg-white cursor-pointer"
              >
                <option value="Consultor Hoteleiro">Consultor Hoteleiro</option>
                <option value="Influencer Hoteleiro">Influencer Hoteleiro</option>
                <option value="Consultoria de Expansão">Consultoria de Expansão</option>
                <option value="Agência de Marketing Turístico">Agência de Marketing Turístico</option>
                <option value="Associação Comercial / Rede Hoteleira">Associação Comercial / Rede Hoteleira</option>
                <option value="Criadores de Conteúdo">Criadores de Conteúdo</option>
                <option value="Outro">Outro</option>
              </select>
              {/* Campo obrigatório quando "Outro" é selecionado */}
              {category === 'Outro' && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={otherCategory}
                    onChange={(e) => setOtherCategory(e.target.value)}
                    placeholder="Descreva a categoria de atuação *"
                    className={`w-full px-3.5 py-2.5 text-xs md:text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] transition-all ${
                      !otherCategory.trim() ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'
                    }`}
                  />
                  {!otherCategory.trim() && (
                    <p className="text-[11px] text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      Campo obrigatório — informe a categoria de atuação.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* CPF ou CNPJ com Validação em Tempo Real */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  {tipoPessoa === 'fisica' ? 'CPF *' : 'CNPJ *'}
                </label>
                {docValidation.isComplete && (
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${
                    docValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {docValidation.isValid ? 'verified' : 'cancel'}
                    </span>
                    {docValidation.isValid 
                      ? (tipoPessoa === 'fisica' ? 'CPF Válido' : 'CNPJ Válido') 
                      : (tipoPessoa === 'fisica' ? 'CPF Inválido' : 'CNPJ Inválido')}
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={document}
                  onChange={(e) => {
                    const formatted = tipoPessoa === 'fisica' ? maskCpf(e.target.value) : maskCnpj(e.target.value);
                    setDocument(formatted);
                  }}
                  placeholder={tipoPessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0001-00'} 
                  maxLength={tipoPessoa === 'fisica' ? 14 : 18}
                  className={`w-full px-3.5 py-2.5 text-xs md:text-sm border rounded-xl focus:outline-none transition-all font-mono ${
                    docValidation.isComplete
                      ? docValidation.isValid
                        ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600'
                        : 'border-rose-400 bg-rose-50/30 text-rose-950 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] text-slate-900'
                  }`}
                />
                {docValidation.isComplete && (
                  <span className={`absolute right-3.5 top-2.5 material-symbols-outlined text-lg pointer-events-none ${
                    docValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {docValidation.isValid ? 'check_circle' : 'error'}
                  </span>
                )}
              </div>
              {docValidation.isComplete && !docValidation.isValid && (
                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  {tipoPessoa === 'fisica' 
                    ? 'Este CPF é falso ou inválido. Digite um CPF autêntico da Receita Federal.' 
                    : 'Este CNPJ é inválido. Verifique os dígitos digitados.'}
                </p>
              )}
              {docValidation.isComplete && docValidation.isValid && (
                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-xs text-emerald-600">verified</span>
                  Documento validado e autêntico.
                </p>
              )}
              {!docValidation.isComplete && document.length > 0 && (
                <p className="text-[10px] text-slate-400 font-medium">
                  {docValidation.message}
                </p>
              )}
            </div>

            {/* E-mail Principal */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                E-mail Principal <span className="text-red-500">*</span>
              </label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="parceiro@exemplo.com.br" 
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            {/* Telefone / WhatsApp */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Telefone / WhatsApp <span className="text-red-500">*</span>
              </label>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 98765-4321" 
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 3: REGRAS DE COMISSÃO & LINK DE DIVULGAÇÃO */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#003400]">percent</span>
            <span>Regras de Comissionamento e Divulgação de Hotéis</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Taxa de Comissão — Dropdown */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Taxa de Comissão (%) <span className="text-red-500">*</span>
              </label>
              <select
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] bg-white cursor-pointer"
              >
                {isParceiroHotelNoZap && (
                  <option value="0">0% — Sem Comissão (Institucional / Direto)</option>
                )}
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="25">25%</option>
                <option value="30">30%</option>
                <option value="35">35%</option>
                <option value="40">40%</option>
                <option value="45">45%</option>
                <option value="50">50%</option>
                <option value="60">60%</option>
                <option value="70">70%</option>
                <option value="80">80%</option>
                <option value="90">90%</option>
                <option value="100">100%</option>
              </select>
              {isParceiroHotelNoZap && (
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  0% desbloqueado — parceiro oficial HOTELNOZAP.
                </span>
              )}
              {!isParceiroHotelNoZap && (
                <span className="text-[11px] text-slate-400">Comissão paga a cada mensalidade de hotel ativo.</span>
              )}
            </div>

            {/* Link Exclusivo Gerado */}
            <div className="md:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Link de Indicação Exclusivo</label>
                <span className="text-[11px] text-emerald-700 font-medium">Link direto para cadastro de novos hotéis</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink} 
                  className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-700 select-all focus:bg-white transition-colors"
                />
                <button 
                  type="button" 
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="Copiar Link"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  <span>Copiar</span>
                </button>
                <button 
                  type="button" 
                  onClick={handleOpenLink}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer shadow-2xs"
                  title="Abrir e testar o link em nova aba"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  <span>Abrir</span>
                </button>
              </div>
            </div>

            {/* Modelo de Recorrência */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Modelo de Recorrência</label>
              <select 
                value={recurrenceModel}
                onChange={(e) => setRecurrenceModel(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] bg-white cursor-pointer"
              >
                <option value="Recorrente Vitalício (Enquanto o Hotel pagar)">Recorrente Vitalício</option>
                <option value="Recorrente 12 Meses">Recorrente 12 Meses</option>
                <option value="Pagamento Único (Bounty de Adesão)">Pagamento Único (Bounty)</option>
              </select>
            </div>
          </div>
        </div>

        {/* BLOCO 4: DADOS BANCÁRIOS & PIX */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#003400]">payments</span>
            <span>Dados Bancários & Chave Pix para Repasses</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo de Chave Pix */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Tipo de Chave Pix *</label>
              <select 
                value={pixType}
                onChange={(e) => setPixType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] bg-white cursor-pointer"
              >
                <option value="E-mail">E-mail</option>
                <option value="CPF / CNPJ">CPF / CNPJ</option>
                <option value="Celular">Celular</option>
                <option value="Chave Aleatória (EVP)">Chave Aleatória (EVP)</option>
              </select>
            </div>

            {/* Chave Pix */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Chave Pix Cadastrada *</label>
              <input 
                type="text" 
                value={pixKey}
                onChange={(e) => {
                  if (pixType === 'CPF / CNPJ') {
                    setPixKey(maskCpfCnpj(e.target.value));
                  } else if (pixType === 'Celular') {
                    setPixKey(maskPhone(e.target.value));
                  } else {
                    setPixKey(e.target.value);
                  }
                }}
                placeholder={
                  pixType === 'CPF / CNPJ' ? '000.000.000-00 ou CNPJ' :
                  pixType === 'Celular' ? '(11) 98765-4321' :
                  'rodrigo.influencer@gmail.com'
                } 
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            {/* Banco */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Instituição Financeira / Banco</label>
              <input 
                type="text" 
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ex: Nu Pagamentos (0260) ou Itaú" 
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            {/* Titular da Conta */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Nome Completo do Favorecido / Titular</label>
              <input 
                type="text" 
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Nome igual ao cadastrado no banco" 
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>
          </div>
        </div>

        {/* BLOCO 5: SENHA DE ACESSO */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
          <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#003400]">lock</span>
            <span>Senha de Acesso</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">E-mail de Acesso *</label>
              <input 
                type="email" 
                value={accessEmail}
                onChange={(e) => setAccessEmail(e.target.value)}
                placeholder="parceiro@email.com"
                className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Senha {!partnerToEdit && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required={!partnerToEdit}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={partnerToEdit ? 'Deixe em branco para manter a mesma senha' : 'Mínimo 6 caracteres'}
                  className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {partnerToEdit && (
                <p className="text-[11px] text-slate-500 font-normal mt-1">
                  Deixe em branco para manter a mesma senha atual.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Repetir Senha {!partnerToEdit && <span className="text-rose-500">*</span>}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required={!partnerToEdit || Boolean(password.trim())}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={partnerToEdit ? 'Deixe em branco para manter' : 'Repita a senha digitada'}
                  className="w-full px-3.5 py-2.5 text-xs md:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400]"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DE AÇÕES (RESPONSIVO DESKTOP vs MOBILE) */}
        <div className="pt-2">
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button 
              type="button" 
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-sm font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              <span>Salvar Parceiro</span>
            </button>
          </div>

          {/* Mobile Actions Stack */}
          <div className="md:hidden space-y-2 pt-2">
            <button 
              type="submit" 
              className="w-full bg-[#003400] text-white hover:bg-[#002500] active:scale-[0.99] font-bold text-xs py-3 px-4 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              <span>Salvar Parceiro</span>
            </button>
            <button 
              type="button" 
              onClick={onBack}
              className="w-full bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.99] font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-200 transition-all cursor-pointer text-center"
            >
              Cancelar
            </button>
          </div>
        </div>

      </form>

    </div>
  );
};

export default CadastroParceiro;
