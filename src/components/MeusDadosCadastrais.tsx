import React, { useState, useEffect } from 'react';
import { maskPhone } from '../utils/masks';
import { hospedesService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

export interface MeusDadosCadastraisProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  onNavigateBack?: () => void;
  onNavigateToLogin?: () => void;
}

interface Acompanhante {
  id: string;
  nome: string;
  parentesco: string;
  documento: string;
  iniciais: string;
  avatarColor: string;
}

interface Endereco {
  id: string;
  tipo: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
}

export const MeusDadosCadastrais: React.FC<MeusDadosCadastraisProps> = ({
  userRole = 'hospede',
  userName = 'Hóspede',
  userEmail = '',
  onNavigateBack,
  onNavigateToLogin,
}) => {
  // Controle de Abas Internas da Tela
  const [activeTab, setActiveTab] = useState<'dados-pessoais' | 'enderecos' | 'preferencias' | 'acompanhantes' | 'lgpd'>('dados-pessoais');

  // Mensagem Toast de Sucesso
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modais de Alteração
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAddCompanionModalOpen, setIsAddCompanionModalOpen] = useState(false);
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);

  // Estados dos Dados Cadastrais
  const [formData, setFormData] = useState({
    nomeCompleto: userName,
    nomeSocial: userName,
    cpf: '',
    dataNascimento: '1990-01-01',
    genero: 'Masculino',
    nacionalidade: 'Brasileira',
    whatsapp: '',
    email: userEmail,
    telefoneSecundario: '',
    contatoEmergencia: '',
    cep: '78720-750',
    logradouro: 'Rua João Paulo II',
    numero: '891',
    complemento: '',
    bairro: 'Jardim Sumaré',
    cidade: 'Rondonópolis',
    estado: 'Mato Grosso (MT)',
    pais: 'Brasil',
  });

  useEffect(() => {
    const carregarDadosReais = async () => {
      try {
        const p = await hospedesService.getPerfilHospedeLogado(userEmail || userName);
        if (p) {
          setFormData({
            nomeCompleto: p.nome || userName,
            nomeSocial: p.nome || userName,
            cpf: p.cpf || '',
            dataNascimento: '1990-01-01',
            genero: 'Masculino',
            nacionalidade: 'Brasileira',
            whatsapp: p.telefone || '',
            email: p.email || userEmail,
            telefoneSecundario: '',
            contatoEmergencia: '',
            cep: p.cep || '78720-750',
            logradouro: p.logradouro || 'Rua João Paulo II',
            numero: p.numero || '891',
            complemento: p.complemento || '',
            bairro: p.bairro || 'Jardim Sumaré',
            cidade: p.cidade || 'Rondonópolis',
            estado: p.uf ? `${p.cidade} (${p.uf})` : 'Mato Grosso (MT)',
            pais: 'Brasil',
          });
          setEnderecos([
            {
              id: '1',
              tipo: 'Residencial (Principal)',
              cep: p.cep || '78720-750',
              logradouro: p.logradouro || 'Rua João Paulo II',
              numero: p.numero || '891',
              complemento: p.complemento || '',
              bairro: p.bairro || 'Jardim Sumaré',
              cidade: p.cidade || 'Rondonópolis',
              uf: p.uf || 'MT',
              pais: 'Brasil',
            }
          ]);
        }
      } catch (err) {
        console.error('Erro ao carregar dados reais do hóspede:', err);
      }
    };
    carregarDadosReais();
  }, [userEmail, userName]);

  // Preferências de Hospedagem
  const [preferencias, setPreferencias] = useState({
    cama: 'King Size preferencial',
    andar: 'Andar alto (Vista Mar)',
    travesseiros: '2x Viscoelástico Macio',
    restricao: 'Sem restrições',
  });

  // Lista de Acompanhantes Frequentes
  const [acompanhantes, setAcompanhantes] = useState<Acompanhante[]>([]);

  // Lista de Endereços
  const [enderecos, setEnderecos] = useState<Endereco[]>([
    {
      id: '1',
      tipo: 'Residencial (Principal)',
      cep: '78720-750',
      logradouro: 'Rua João Paulo II',
      numero: '891',
      complemento: '',
      bairro: 'Jardim Sumaré',
      cidade: 'Rondonópolis',
      uf: 'MT',
      pais: 'Brasil',
    },
  ]);

  // Novo Acompanhante Form State
  const [newCompanion, setNewCompanion] = useState({ nome: '', parentesco: '', documento: '' });
  // Novo Endereço Form State
  const [newAddress, setNewAddress] = useState({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'MT' });
  // Passwords Form State
  const [passwords, setPasswords] = useState({ atual: '', nova: '', confirma: '' });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const ok = await hospedesService.updatePerfilHospedeLogado({
        nome: formData.nomeCompleto || formData.nomeSocial,
        cpf: formData.cpf,
        telefone: formData.whatsapp,
        email: formData.email,
        cep: formData.cep,
        logradouro: formData.logradouro,
        numero: formData.numero,
        bairro: formData.bairro,
        cidade: formData.cidade,
        uf: formData.estado?.slice(-3, -1) || 'MT',
      });
      if (ok) {
        showToast('Dados cadastrais salvos e sincronizados com sucesso no Supabase!');
      } else {
        showToast('Erro ao salvar dados no Supabase.');
      }
    } catch {
      showToast('Erro ao salvar dados.');
    }
  };

  const handleAddCompanionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanion.nome) return;
    const item: Acompanhante = {
      id: String(Date.now()),
      nome: newCompanion.nome,
      parentesco: newCompanion.parentesco || 'Família',
      documento: newCompanion.documento || 'Documento Anexado',
      iniciais: newCompanion.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      avatarColor: 'bg-emerald-100 text-emerald-800',
    };
    setAcompanhantes([...acompanhantes, item]);
    setNewCompanion({ nome: '', parentesco: '', documento: '' });
    setIsAddCompanionModalOpen(false);
    showToast(`Acompanhante ${item.nome} adicionado com sucesso!`);
  };

  const handleAddAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.logradouro) return;
    const end: Endereco = {
      id: String(Date.now()),
      tipo: 'Adicional',
      cep: newAddress.cep || '00000-000',
      logradouro: newAddress.logradouro,
      numero: newAddress.numero || 'S/N',
      complemento: newAddress.complemento,
      bairro: newAddress.bairro,
      cidade: newAddress.cidade,
      uf: newAddress.uf,
      pais: 'Brasil',
    };
    setEnderecos([...enderecos, end]);
    setNewAddress({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: 'PE' });
    setIsAddAddressModalOpen(false);
    showToast('Novo endereço cadastrado com sucesso!');
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.nova !== passwords.confirma) {
      alert('A nova senha e a confirmação não coincidem.');
      return;
    }
    setPasswords({ atual: '', nova: '', confirma: '' });
    setIsPasswordModalOpen(false);
    showToast('Sua senha foi alterada com sucesso!');
  };

  return (
    <div className="bg-[#f8f9ff] text-slate-800 antialiased min-h-screen font-sans">
      {/* TOAST SYSTEM NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#003400] text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER MOBILE (Dispositivos móveis / < lg)                                */}
      {/* ========================================================================= */}
      <header className="lg:hidden w-full bg-gradient-to-r from-[#003400] to-[#000000] text-white px-4 py-3 sticky top-0 z-40 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button onClick={onNavigateBack} className="p-1 rounded-lg hover:bg-white/10 text-white active:scale-95 transition">
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block leading-tight">Portal do Hóspede</span>
            <h1 className="text-sm font-extrabold tracking-wider leading-none text-white">HOTEL NO ZAP</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => showToast('Notificações atualizadas')} className="relative p-1.5 rounded-full hover:bg-white/10 text-white active:scale-95 transition">
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-emerald-800 border border-emerald-400/50 flex items-center justify-center font-bold text-xs text-white">
            CT
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER (DESKTOP & MOBILE WRAPPER) */}
      <main className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 lg:space-y-8 pb-28 lg:pb-12">
        
        {/* TOPO / NAVEGAÇÃO E TÍTULO DA TELA */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <button
              onClick={onNavigateBack}
              className="inline-flex items-center gap-2 text-xs md:text-sm font-semibold text-[#003400] hover:text-emerald-700 transition-colors mb-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Voltar para Minha Conta
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Meus Dados Cadastrais</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-[#003400] border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Hóspede VIP
              </span>
            </div>
            <p className="text-slate-500 text-xs md:text-sm mt-1">Gerencie suas informações pessoais, contatos, preferências de hospedagem e documentos fiscais.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-xs md:text-sm hover:bg-slate-50 transition shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg text-slate-500">lock_reset</span>
              Alterar Senha
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#003400] text-white font-semibold text-xs md:text-sm hover:bg-[#002800] transition shadow-sm shadow-emerald-950/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Salvar Alterações
            </button>
          </div>
        </div>

        {/* INDICADORES / RESUMO RÁPIDO DO PERFIL (KPIS - GRID RESPONSIVA) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {/* Card 1: Perfil */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center gap-3 md:gap-4 col-span-2 md:col-span-1">
            <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-tr from-[#003400] to-emerald-600 text-white font-bold text-lg md:text-xl flex items-center justify-center shadow-md flex-shrink-0">
              {(formData.nomeSocial || formData.nomeCompleto || 'HP').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'HP'}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[10px] md:text-xs">verified</span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] md:text-xs font-bold text-emerald-800 uppercase tracking-wider">Hóspede Principal</div>
              <div className="font-bold text-slate-900 text-sm md:text-base truncate">{formData.nomeSocial}</div>
              <div className="text-slate-500 text-xs truncate">{formData.email}</div>
            </div>
          </div>

          {/* Card 2: Cadastro / Documento */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Status do Cadastro</span>
              <div className="text-sm md:text-xl font-extrabold text-emerald-700 mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-600 text-base md:text-xl">check_circle</span>
                Completo (100%)
              </div>
              <span className="text-[10px] md:text-xs text-slate-400">CPF {formData.cpf}</span>
            </div>
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg md:text-2xl">badge</span>
            </div>
          </div>

          {/* Card 3: Fidelidade */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Programa Fidelidade</span>
              <div className="text-base md:text-2xl font-black text-purple-700 mt-1">2.450 <span className="text-xs font-semibold">pts</span></div>
              <span className="text-[10px] md:text-xs font-medium text-purple-600">Nível Ouro VIP</span>
            </div>
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg md:text-2xl">military_tech</span>
            </div>
          </div>

          {/* Card 4: Estadias */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider">Histórico de Viagens</span>
              <div className="text-base md:text-2xl font-black text-slate-900 mt-1">12 <span className="text-xs font-normal text-slate-500">reservas</span></div>
              <span className="text-[10px] md:text-xs text-emerald-700 font-semibold">4 estadias este ano</span>
            </div>
            <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg md:text-2xl">hotel</span>
            </div>
          </div>
        </div>

        {/* ABAS / FILTROS DE SEÇÃO DA TELA */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('dados-pessoais')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'dados-pessoais' ? 'bg-[#003400] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-lg">person</span>
            Dados Pessoais
          </button>

          <button
            onClick={() => setActiveTab('enderecos')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'enderecos' ? 'bg-[#003400] text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-lg">pin_drop</span>
            Endereços Salvos
          </button>

          <button
            onClick={() => setActiveTab('preferencias')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'preferencias' ? 'bg-[#003400] text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-lg">favorite</span>
            Preferências de Estadia
          </button>

          <button
            onClick={() => setActiveTab('acompanhantes')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'acompanhantes' ? 'bg-[#003400] text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-lg">group</span>
            Acompanhantes Frequentes
          </button>

          <button
            onClick={() => setActiveTab('lgpd')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'lgpd' ? 'bg-[#003400] text-white font-bold shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-lg">shield</span>
            Segurança & Privacidade
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL DIVIDIDO EM COLUNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* COLUNA PRINCIPAL (2/3 NO DESKTOP): FORMULÁRIO DETALHADO */}
          <div className="lg:col-span-2 space-y-6">

            {/* 1. INFORMACÕES PESSOAIS & DOCUMENTAÇÃO */}
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center font-bold text-xs md:text-sm">1</div>
                  <h2 className="text-sm md:text-base font-bold text-slate-900">Informações Pessoais & Documentação</h2>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline">Campos protegidos por criptografia</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Nome Completo</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">badge</span>
                    <input
                      type="text"
                      value={formData.nomeCompleto}
                      onChange={(e) => setFormData({ ...formData, nomeCompleto: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Nome Social / Como prefere ser chamado(a)</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">sentiment_satisfied</span>
                    <input
                      type="text"
                      value={formData.nomeSocial}
                      onChange={(e) => setFormData({ ...formData, nomeSocial: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">CPF / Documento Oficial</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">credit_card</span>
                    <input
                      type="text"
                      value={formData.cpf}
                      readOnly
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-600 cursor-not-allowed"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Validado no Check-in Oficial</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Data de Nascimento</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">calendar_today</span>
                    <input
                      type="date"
                      value={formData.dataNascimento}
                      onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Gênero</label>
                  <select
                    value={formData.genero}
                    onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  >
                    <option value="Feminino">Feminino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Não-binário">Não-binário</option>
                    <option value="Prefiro não informar">Prefiro não informar</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Nacionalidade</label>
                  <input
                    type="text"
                    value={formData.nacionalidade}
                    onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
              </div>
            </div>

            {/* 2. CANAIS DE CONTATO & WHATSAPP */}
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center font-bold text-xs md:text-sm">2</div>
                  <h2 className="text-sm md:text-base font-bold text-slate-900">Canais de Contato & WhatsApp</h2>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="material-symbols-outlined text-sm">chat</span> WhatsApp Conectado
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">WhatsApp Principal (Notificações de Estadia)</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-emerald-600 text-lg">chat</span>
                    <input
                      type="text"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: maskPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-emerald-700 mt-1 block">Recebe chave virtual, vouchers e cardápio</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">E-mail Cadastrado</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">mail</span>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Utilizado para login e faturas fiscais</span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Telefone Secundário / Recados</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">call</span>
                    <input
                      type="text"
                      value={formData.telefoneSecundario}
                      onChange={(e) => setFormData({ ...formData, telefoneSecundario: maskPhone(e.target.value) })}
                      placeholder="(00) 0000-0000"
                      maxLength={15}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Contato de Emergência</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">emergency</span>
                    <input
                      type="text"
                      value={formData.contatoEmergencia}
                      onChange={(e) => setFormData({ ...formData, contatoEmergencia: maskPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. ENDEREÇO RESIDENCIAL & COBRANÇA */}
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 text-[#003400] flex items-center justify-center font-bold text-xs md:text-sm">3</div>
                  <h2 className="text-sm md:text-base font-bold text-slate-900">Endereço Residencial & Cobrança</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddAddressModalOpen(true)}
                  className="text-xs font-semibold text-[#003400] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">add_location_alt</span> Adicionar outro endereço
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs md:text-sm">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">CEP</label>
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1.5">Logradouro / Avenida</label>
                  <input
                    type="text"
                    value={formData.logradouro}
                    onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Número</label>
                  <input
                    type="text"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Complemento</label>
                  <input
                    type="text"
                    value={formData.complemento}
                    onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Bairro</label>
                  <input
                    type="text"
                    value={formData.bairro}
                    onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Cidade</label>
                  <input
                    type="text"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">Estado</label>
                  <input
                    type="text"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1.5">País</label>
                  <input
                    type="text"
                    value={formData.pais}
                    onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:border-[#003400] focus:ring-1 focus:ring-[#003400] bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA LATERAL (1/3 NO DESKTOP): PREFERÊNCIAS, ACOMPANHANTES & LGPD */}
          <div className="space-y-6">
            
            {/* CARTÃO DE PREFERÊNCIAS DE HOSPEDAGEM */}
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003400]">hotel</span>
                  <h3 className="font-bold text-slate-900 text-sm">Preferências de Hospedagem</h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Tipo de Cama</span>
                    <span className="text-slate-500">{preferencias.cama}</span>
                  </div>
                  <button onClick={() => showToast('Editando preferência de cama')} className="p-1 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Andar Preferido</span>
                    <span className="text-slate-500">{preferencias.andar}</span>
                  </div>
                  <button onClick={() => showToast('Editando preferência de andar')} className="p-1 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Travesseiros</span>
                    <span className="text-slate-500">{preferencias.travesseiros}</span>
                  </div>
                  <button onClick={() => showToast('Editando preferência de travesseiros')} className="p-1 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Restrição Alimentar</span>
                    <span className="text-slate-500">{preferencias.restricao}</span>
                  </div>
                  <button onClick={() => showToast('Editando restrição alimentar')} className="p-1 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CARTÃO DE ACOMPANHANTES FREQUENTES */}
            <div className="bg-white rounded-2xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#003400]">group</span>
                  <h3 className="font-bold text-slate-900 text-sm">Acompanhantes Frequentes</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCompanionModalOpen(true)}
                  className="text-xs font-semibold text-[#003400] hover:underline cursor-pointer"
                >
                  + Adicionar
                </button>
              </div>

              <div className="space-y-2.5">
                {acompanhantes.map((ac) => (
                  <div key={ac.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center ${ac.avatarColor}`}>
                        {ac.iniciais}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{ac.nome}</div>
                        <div className="text-[11px] text-slate-500">{ac.parentesco} • {ac.documento}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => showToast(`Editando acompanhante ${ac.nome}`)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* CARTÃO DE SEGURANÇA & PRIVACIDADE (LGPD) */}
            <div className="bg-emerald-950 text-white rounded-2xl p-5 md:p-6 shadow-sm space-y-4 border border-emerald-900">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <span className="material-symbols-outlined text-xl">security</span>
                <h3 className="font-bold text-sm text-white">Privacidade & Dados (LGPD)</h3>
              </div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Seus dados são armazenados com segurança de ponta a ponta e utilizados exclusivamente para faturamento e personalização da sua estadia na rede Hotel no Zap.
              </p>
              <div className="pt-2 flex items-center justify-between border-t border-emerald-900/60 text-xs">
                <span className="text-emerald-300 font-medium">Exportar Relatório LGPD</span>
                <button
                  type="button"
                  onClick={() => showToast('Relatório completo de dados LGPD baixado em PDF!')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-900 text-emerald-200 font-semibold hover:bg-emerald-800 transition cursor-pointer"
                >
                  Baixar PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE RODAPÉ COM AÇÕES DE SALVAMENTO E CANCELAMENTO */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined text-emerald-600 text-base">sync_saved_locally</span>
            Última atualização cadastral realizada em 24/02/2026 às 10:45.
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onNavigateBack}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs md:text-sm hover:bg-slate-50 transition cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-[#003400] text-white font-semibold text-xs md:text-sm hover:bg-[#002800] transition shadow-md shadow-emerald-950/20 cursor-pointer"
            >
              Salvar Dados Cadastrais
            </button>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* BARRA DE NAVEGAÇÃO INFERIOR FIXA MOBILE (5 ABAS PADRÃO PORTAL DO HÓSPEDE) */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 z-50 flex justify-around items-center shadow-lg">
        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-xl">hotel</span>
          <span className="text-[10px] font-medium">Estadia</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-xl">calendar_month</span>
          <span className="text-[10px] font-medium">Reservas</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-xl">room_service</span>
          <span className="text-[10px] font-medium">Pedidos</span>
        </button>

        <button onClick={onNavigateBack} className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-xl">receipt_long</span>
          <span className="text-[10px] font-medium">Consumo</span>
        </button>

        <button onClick={() => setActiveTab('dados-pessoais')} className="flex flex-col items-center gap-0.5 text-[#003400] font-bold">
          <span className="material-symbols-outlined text-xl text-[#003400]">account_circle</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* MODAL DE ALTERAÇÃO DE SENHA                                               */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setIsPasswordModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">lock_reset</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Alterar Senha de Acesso</h3>
                <p className="text-xs text-slate-500">Crie uma nova senha segura para sua conta</p>
              </div>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Senha Atual</label>
                <input
                  type="password"
                  value={passwords.atual}
                  onChange={(e) => setPasswords({ ...passwords, atual: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={passwords.nova}
                  onChange={(e) => setPasswords({ ...passwords, nova: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={passwords.confirma}
                  onChange={(e) => setPasswords({ ...passwords, confirma: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#003400] text-white font-bold">
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE NOVO ACOMPANHANTE                                               */}
      {/* ========================================================================= */}
      {isAddCompanionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setIsAddCompanionModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">group_add</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Novo Acompanhante</h3>
                <p className="text-xs text-slate-500">Cadastre familiares para check-in rápido</p>
              </div>
            </div>

            <form onSubmit={handleAddCompanionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={newCompanion.nome}
                  onChange={(e) => setNewCompanion({ ...newCompanion, nome: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Parentesco / Relação</label>
                <input
                  type="text"
                  placeholder="Ex: Cônjuge, Filho, Amigo"
                  value={newCompanion.parentesco}
                  onChange={(e) => setNewCompanion({ ...newCompanion, parentesco: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">CPF ou Documento</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={newCompanion.documento}
                  onChange={(e) => setNewCompanion({ ...newCompanion, documento: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAddCompanionModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#003400] text-white font-bold">
                  Cadastrar Acompanhante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE NOVO ENDEREÇO                                                    */}
      {/* ========================================================================= */}
      {isAddAddressModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <button onClick={() => setIsAddAddressModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">add_location</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Novo Endereço</h3>
                <p className="text-xs text-slate-500">Adicione um novo endereço residencial ou de faturamento</p>
              </div>
            </div>

            <form onSubmit={handleAddAddressSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CEP</label>
                  <input
                    type="text"
                    value={newAddress.cep}
                    onChange={(e) => setNewAddress({ ...newAddress, cep: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Logradouro / Rua</label>
                  <input
                    type="text"
                    value={newAddress.logradouro}
                    onChange={(e) => setNewAddress({ ...newAddress, logradouro: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={newAddress.numero}
                    onChange={(e) => setNewAddress({ ...newAddress, numero: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Complemento</label>
                  <input
                    type="text"
                    value={newAddress.complemento}
                    onChange={(e) => setNewAddress({ ...newAddress, complemento: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    value={newAddress.bairro}
                    onChange={(e) => setNewAddress({ ...newAddress, bairro: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cidade / UF</label>
                  <input
                    type="text"
                    value={newAddress.cidade}
                    onChange={(e) => setNewAddress({ ...newAddress, cidade: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsAddAddressModalOpen(false)} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600">
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-[#003400] text-white font-bold">
                  Salvar Endereço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeusDadosCadastrais;
