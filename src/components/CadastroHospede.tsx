import React, { useState, useRef, useMemo } from 'react';
import {
  maskCpf,
  maskCnpj,
  maskCep,
  maskPhone,
  isValidCpf,
  isValidCnpj,
  getCpfValidationStatus,
  getCnpjValidationStatus
} from '../utils/masks';
import { fetchAddressByCep } from '../utils/viacep';
import { hospedesService } from '../services/supabaseService';

export interface CadastroHospedeProps {
  onBack: () => void;
  onSaveSuccess?: () => void;
}

export const CadastroHospede: React.FC<CadastroHospedeProps> = ({ onBack, onSaveSuccess }) => {
  const [personType, setPersonType] = useState<'fisica' | 'juridica'>('fisica');
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  
  // Photo upload state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [rg, setRg] = useState('');

  // Validação em tempo real de CPF / CNPJ
  const docValidation = useMemo(() => {
    if (personType === 'fisica') {
      return getCpfValidationStatus(cpfCnpj);
    }
    return getCnpjValidationStatus(cpfCnpj);
  }, [cpfCnpj, personType]);
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('Brasileiro');

  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');

  // ViaCEP integration state
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const handleSearchViaCep = async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      setCepError(null);
      const data = await fetchAddressByCep(clean);
      setIsLoadingCep(false);
      if (data) {
        if (data.logradouro) setAddress(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setStateUf(data.uf);
        if (data.complemento && !complement) setComplement(data.complemento);
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

  const [notes, setNotes] = useState('');

  const [accessEmail, setAccessEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSaved, setIsSaved] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, informe o Nome Completo.');
      return;
    }

    if (personType === 'fisica') {
      if (cpfCnpj.trim() && !isValidCpf(cpfCnpj)) {
        alert('O CPF do hóspede é inválido ou falso! Digite um CPF autêntico da Receita Federal.');
        return;
      }
    } else {
      if (cpfCnpj.trim() && !isValidCnpj(cpfCnpj)) {
        alert('O CNPJ informado é inválido! Por favor, verifique os dígitos.');
        return;
      }
    }

    if (password && password !== confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }

    const finalEmail = accessEmail.trim() || email.trim() || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@hospede.com.br`;
    const cityStateStr = city ? `${city}${stateUf ? '/' + stateUf : ''}` : 'Não informada';

    const result = await hospedesService.createHospedeFull({
      nome: name,
      email: finalEmail,
      cpf_passaporte: cpfCnpj,
      telefone: phone,
      cidade_uf: cityStateStr,
      status: status,
      senha: password || 'Hospede123!',
      observacoes: notes,
      cep: cep,
      logradouro: address,
      bairro: neighborhood,
      numero: number
    });

    if (result.success) {
      setIsSaved(true);
      setTimeout(() => {
        if (onSaveSuccess) {
          onSaveSuccess();
        } else {
          onBack();
        }
      }, 600);
    } else {
      alert('Erro ao salvar hóspede no sistema. Verifique se o e-mail ou dados já estão cadastrados.');
    }
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-5xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12">
      
      {/* HIDDEN LOCAL FILE INPUT */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* HEADER & VOLTAR LINK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Novo Cadastro</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Preencha os dados do hóspede para controle de check-in e reservas.</p>
        </div>

        <button 
          onClick={onBack}
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#006c49] hover:text-[#003400] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>Voltar para Listagem</span>
        </button>
      </div>

      {/* TOAST DE SUCESSO */}
      {isSaved && (
        <div className="p-4 bg-[#d1fae5] border border-emerald-300 rounded-xl text-black font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
          <span className="material-symbols-outlined text-[#003400]">check_circle</span>
          <span className="text-black font-bold">Hóspede cadastrado com sucesso! Redirecionando...</span>
        </div>
      )}

      {/* FORMULÁRIO PRINCIPAL */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* TIPO DE CADASTRO E STATUS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* TIPO DE PESSOA */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 block">Tipo de Cadastro</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 w-full justify-center">
              <button 
                type="button"
                onClick={() => setPersonType('fisica')}
                className={
                  "px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex-1 text-center cursor-pointer " +
                  (personType === 'fisica' ? 'bg-[#003400] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900')
                }
              >
                Pessoa Física
              </button>
              <button 
                type="button"
                onClick={() => setPersonType('juridica')}
                className={
                  "px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex-1 text-center cursor-pointer " +
                  (personType === 'juridica' ? 'bg-[#003400] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900')
                }
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>

          {/* STATUS DO HÓSPEDE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-0.5">Status do Hóspede</span>
              <span className="text-xs text-slate-500">Defina a situação atual do cadastro</span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={status === 'ativo'}
                onChange={(e) => setStatus(e.target.checked ? 'ativo' : 'inativo')}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003400]"></div>
              <span className={"ml-3 text-xs font-bold " + (status === 'ativo' ? 'text-[#006c49]' : 'text-slate-500')}>
                {status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </label>
          </div>

        </div>

        {/* FOTO DO PERFIL */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex items-center gap-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-slate-400 transition-colors group relative overflow-hidden shrink-0"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Foto do Hóspede" className="w-full h-full object-cover" />
            ) : (
              <>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-700 text-2xl sm:text-3xl">add_a_photo</span>
                <span className="text-[10px] font-semibold text-slate-400 group-hover:text-slate-700 mt-1">Upload</span>
              </>
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">Foto do Perfil</h3>
            <p className="text-xs text-slate-500 mt-0.5">Selecione uma foto direto do computador (Recomendado: 500x500px JPG/PNG).</p>
          </div>
        </div>

        {/* INFORMAÇÕES PESSOAIS */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#006c49]">badge</span>
            <span>Informações Pessoais</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs sm:text-sm">
            <div className="col-span-1 md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="nome">
                {personType === 'fisica' ? 'Nome Completo *' : 'Razão Social *'}
              </label>
              <input 
                type="text" 
                id="nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={personType === 'fisica' ? 'Ex: João da Silva' : 'Ex: Empresa XYZ Ltda'}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-bold text-slate-700" htmlFor="cpfCnpj">
                  {personType === 'fisica' ? 'CPF *' : 'CNPJ *'}
                </label>
                {docValidation.isComplete && (
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${
                    docValidation.isValid ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {docValidation.isValid ? 'verified' : 'cancel'}
                    </span>
                    {docValidation.isValid 
                      ? (personType === 'fisica' ? 'CPF Válido' : 'CNPJ Válido') 
                      : (personType === 'fisica' ? 'CPF Inválido' : 'CNPJ Inválido')}
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  id="cpfCnpj"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(personType === 'fisica' ? maskCpf(e.target.value) : maskCnpj(e.target.value))}
                  placeholder={personType === 'fisica' ? '000.000.000-00' : '00.000.000/0001-00'}
                  maxLength={personType === 'fisica' ? 14 : 18}
                  className={`w-full border rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none transition-all font-mono ${
                    docValidation.isComplete
                      ? docValidation.isValid
                        ? 'bg-emerald-50/20 border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600'
                        : 'bg-rose-50/30 border-rose-400 focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-rose-950'
                      : 'bg-slate-50 border-slate-200 focus:ring-1 focus:ring-[#003400] focus:border-[#003400]'
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
                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-xs">warning</span>
                  {personType === 'fisica' 
                    ? 'Este CPF é falso ou inválido. Digite um CPF autêntico da Receita Federal.' 
                    : 'Este CNPJ é inválido. Verifique os dígitos digitados.'}
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="rg">RG / Inscrição Estadual</label>
              <input 
                type="text" 
                id="rg"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                placeholder="00.000.000-0"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="birthDate">Data de Nascimento</label>
              <input 
                type="date" 
                id="birthDate"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="gender">Sexo</label>
              <select 
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              >
                <option value="">Selecione...</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="nationality">Nacionalidade</label>
              <input 
                type="text" 
                id="nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Ex: Brasileiro"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>
          </div>
        </div>

        {/* CONTATO */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#006c49]">contact_phone</span>
            <span>Contato</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm">
            <div className="col-span-1 md:col-span-1">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="phone">Telefone / WhatsApp *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">chat</span>
                </span>
                <input 
                  type="text" 
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="email">E-mail</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">mail</span>
                </span>
                <input 
                  type="email" 
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#006c49]">location_on</span>
            <span>Endereço</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 text-xs sm:text-sm">
            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 mb-1.5 flex items-center justify-between" htmlFor="cep">
                <span>CEP</span>
                {isLoadingCep && (
                  <span className="text-xs text-[#006c49] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    Buscando...
                  </span>
                )}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  id="cep"
                  value={cep}
                  onChange={handleCepChange}
                  onBlur={() => handleSearchViaCep(cep)}
                  placeholder="00000-000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
                />
              </div>
              {cepError && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">{cepError}</p>
              )}
            </div>

            <div className="md:col-span-7">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="address">Endereço</label>
              <input 
                type="text" 
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, Avenida, etc."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="number">Número</label>
              <input 
                type="text" 
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Ex: 123"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="complement">Complemento</label>
              <input 
                type="text" 
                id="complement"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                placeholder="Apto, Sala, Bloco"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="neighborhood">Bairro</label>
              <input 
                type="text" 
                id="neighborhood"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="city">Cidade</label>
              <input 
                type="text" 
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cidade"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="stateUf">Estado</label>
              <select 
                id="stateUf"
                value={stateUf}
                onChange={(e) => setStateUf(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
              >
                <option value="">UF</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#006c49]">edit_note</span>
            <span>Observações</span>
          </h3>
          <textarea 
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferências, alergias, ou outras informações relevantes..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400] resize-none"
          />
        </div>

        {/* ACESSO AO SISTEMA */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="material-symbols-outlined text-[#006c49]">lock</span>
            <span>Acesso ao Sistema</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="accessEmail">E-mail de Acesso</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">mail</span>
                </span>
                <input 
                  type="email" 
                  id="accessEmail"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  placeholder="email@acesso.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="password">Senha</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5" htmlFor="confirmPassword">Repetir Senha</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#003400] focus:border-[#003400]"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DE AÇÕES */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4">
          <button 
            type="button" 
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button 
            type="submit" 
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002200] text-white font-semibold text-sm transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            <span>Salvar Cadastro</span>
          </button>
        </div>

      </form>

    </div>
  );
};

export default CadastroHospede;
