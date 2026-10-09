import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { hoteisService, usuariosService, resolveHotelDbId } from '../services/supabaseService';
import { creditosService } from '../services/creditosService';
import { maskCnpj, maskPhone, isValidCnpj } from '../utils/masks';

export interface ModalReivindicarHotelProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: {
    id: string;
    name: string;
    city?: string;
    uf?: string;
    whatsappPhone?: string;
    notes?: string;
    cnpj?: string;
  };
  onSuccess?: (updatedHotel: any, user: any) => void;
}

export const ModalReivindicarHotel: React.FC<ModalReivindicarHotelProps> = ({
  isOpen,
  onClose,
  hotel,
  onSuccess
}) => {
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [cargoResponsavel, setCargoResponsavel] = useState('Proprietário');
  const [whatsapp, setWhatsapp] = useState(hotel.whatsappPhone ? maskPhone(hotel.whatsappPhone) : '');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  if (!isOpen) return null;

  const handleCnpjChange = (val: string) => {
    setCnpj(maskCnpj(val));
  };

  const handlePhoneChange = (val: string) => {
    setWhatsapp(maskPhone(val));
  };

  const validate = () => {
    if (!nomeResponsavel.trim() || nomeResponsavel.trim().length < 3) {
      return 'Informe o nome completo do responsável.';
    }
    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return 'Informe um número de WhatsApp válido com DDD.';
    }
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (!cleanCnpj || !isValidCnpj(cnpj)) {
      return 'Informe um CNPJ válido da empresa/hotel.';
    }
    if (!loginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      return 'Informe um e-mail válido para acessar o painel.';
    }
    if (!senha || senha.length < 6) {
      return 'A senha deve conter no mínimo 6 caracteres.';
    }
    if (senha !== confirmSenha) {
      return 'A confirmação de senha não coincide com a senha digitada.';
    }
    if (!aceitouTermos) {
      return 'É necessário declarar que é o proprietário ou representante legal do hotel e aceitar os termos.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setErrorMsg('');

    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }

    setIsLoading(true);

    try {
      const cleanEmail = loginEmail.trim().toLowerCase();
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const cleanPhone = whatsapp.replace(/\D/g, '');
      const targetHotelId = resolveHotelDbId(hotel.id);

      // 1. Verificar se o e-mail de login já está em uso na base
      const { data: existingUser } = await supabase
        .from('usuarios')
        .select('id, email')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingUser) {
        setErrorMsg('Este e-mail já está cadastrado no sistema. Utilize outro e-mail ou faça login com sua conta existente.');
        setIsLoading(false);
        return;
      }

      // 2. Verificar se o CNPJ já está vinculado a outro hotel diferente
      const { data: existingCnpjHotel } = await supabase
        .from('hoteis')
        .select('id, nome, cnpj')
        .neq('id', targetHotelId)
        .eq('cnpj', cnpj)
        .maybeSingle();

      if (existingCnpjHotel) {
        setErrorMsg(`Este CNPJ já está cadastrado para o hotel "${existingCnpjHotel.nome}". Caso seja o mesmo grupo, entre em contato com nosso suporte.`);
        setIsLoading(false);
        return;
      }

      // 3. Atualizar o cadastro do hotel existente
      const updatedNotes = `${hotel.notes || ''} | [REIVINDICADO] Reivindicado pelo proprietário ${nomeResponsavel.trim()} (${cleanEmail}) em ${new Date().toLocaleDateString('pt-BR')}`;
      
      const updateResult = await hoteisService.updateHotel(targetHotelId, {
        razaoSocial: razaoSocial.trim() || hotel.name,
        cnpj: cnpj,
        managerName: nomeResponsavel.trim(),
        managerPhone: cleanPhone,
        managerEmail: cleanEmail,
        managerRole: cargoResponsavel,
        loginEmail: cleanEmail,
        plan: 'Professional',
        status: 'ativo',
        notes: updatedNotes
      });

      if (!updateResult) {
        throw new Error('Falha ao atualizar os dados do hotel no banco de dados.');
      }

      // 4. Criar o Usuário do Hotel no Supabase Auth e na tabela usuarios
      const userRes = await usuariosService.createUsuario(
        {
          name: nomeResponsavel.trim(),
          email: cleanEmail,
          cargo: cargoResponsavel || 'Proprietário',
          perfil: 'Hotel',
          phone: cleanPhone,
          status: 'ativo',
          hotel_id: targetHotelId,
          hotel_nome: hotel.name,
          initials: (nomeResponsavel.trim() || 'HT')
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase(),
          lastAccess: 'Primeiro acesso após reivindicação'
        } as any,
        senha,
        { adminMode: false }
      );

      if (!userRes.success) {
        throw new Error(userRes.error || 'Não foi possível criar as credenciais de acesso.');
      }

      // 5. Ativar período de degustação gratuito (30 dias)
      const dataExpiracao = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      creditosService.saveCreditoHotel(
        targetHotelId,
        1,
        dataExpiracao,
        true,
        new Date().toISOString()
      );

      // 6. Salvar sessão do usuário no localStorage
      try {
        localStorage.setItem('hotelnozap_user_role', 'Hotel');
        localStorage.setItem('hotelnozap_user_email', cleanEmail);
        localStorage.setItem('hotelnozap_user_name', nomeResponsavel.trim());
        localStorage.setItem('hotelnozap_current_hotel_id', targetHotelId);
      } catch {
        /* ignore */
      }

      setIsSuccess(true);
      if (onSuccess) {
        onSuccess({ ...hotel, cnpj, razaoSocial }, userRes.user);
      }

    } catch (err: any) {
      console.error('Erro na reivindicação do hotel:', err);
      setErrorMsg(err?.message || 'Ocorreu um erro ao processar a reivindicação. Tente novamente ou chame nosso suporte.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    // Redireciona para a raiz autenticada (Dashboard)
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-r from-emerald-900 via-[#003400] to-emerald-950 text-white p-5 sm:p-6 relative shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wide">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Reivindicação Oficial
            </span>
            <span className="text-emerald-300 text-xs">• Acesso Imediato</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Assuma o controle de {hotel.name}
          </h2>
          <p className="text-emerald-100/80 text-xs sm:text-sm mt-1">
            {hotel.city && hotel.uf ? `${hotel.city} - ${hotel.uf}` : 'Localização cadastrada'} • Preencha os dados abaixo para ativar o painel oficial e o robô de WhatsApp do seu estabelecimento.
          </p>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {isSuccess ? (
            /* TELA DE SUCESSO */
            <div className="py-8 text-center space-y-5">
              <div className="w-20 h-20 bg-emerald-100 text-[#006c49] rounded-full flex items-center justify-center mx-auto shadow-inner animate-in zoom-in duration-300">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-2xl font-extrabold text-slate-900">
                  Perfil Reivindicado com Sucesso!
                </h3>
                <p className="text-sm text-slate-600">
                  Parabéns, <strong>{nomeResponsavel}</strong>! O estabelecimento <strong>{hotel.name}</strong> agora está oficialmente sob sua gestão no Hotel no Zap.
                </p>
              </div>

              {/* CARD RESUMO */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-left max-w-md mx-auto text-xs space-y-2 text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">E-mail de Acesso:</span>
                  <strong className="text-slate-900">{loginEmail}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Período de Degustação:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">30 Dias Gratuitos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Robô WhatsApp:</span>
                  <span className="font-bold text-emerald-800">Pronto para conectar</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#003400] hover:bg-[#002500] text-white font-extrabold text-sm rounded-xl shadow-lg transition active:scale-95 cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">dashboard</span>
                  <span>Entrar no Painel do Hotel Agora</span>
                </button>
              </div>
            </div>
          ) : (
            /* FORMULÁRIO DE REIVINDICAÇÃO */
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* BANNER BENEFÍCIOS */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-2xl shrink-0 mt-0.5">workspace_premium</span>
                <div className="text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">
                    O que acontece ao reivindicar seu hotel?
                  </p>
                  <p>
                    Seu hotel ganha acesso imediato a <strong>30 dias de degustação gratuita</strong> com robô de WhatsApp para reservas automáticas 24h, mapa de quartos, cardápio digital e gestão de hóspedes.
                  </p>
                </div>
              </div>

              {/* SEÇÃO 1: RESPONSÁVEL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="material-symbols-outlined text-base text-[#006c49]">person</span>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    1. Dados do Responsável / Proprietário
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={nomeResponsavel}
                      onChange={e => setNomeResponsavel(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cargo / Função *
                    </label>
                    <select
                      value={cargoResponsavel}
                      onChange={e => setCargoResponsavel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 cursor-pointer"
                    >
                      <option value="Proprietário">Proprietário / Dono</option>
                      <option value="Sócio">Sócio / Administrador</option>
                      <option value="Gerente Geral">Gerente Geral</option>
                      <option value="Recepção">Recepção / Atendimento</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Pessoal / Contato Direto *
                    </label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={e => handlePhoneChange(e.target.value)}
                      placeholder="(99) 99999-9999"
                      maxLength={15}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: DADOS OFICIAIS DO HOTEL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="material-symbols-outlined text-base text-[#006c49]">domain</span>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    2. Dados Oficiais da Empresa
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CNPJ Oficial do Hotel *
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={e => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Razão Social (Opcional)
                    </label>
                    <input
                      type="text"
                      value={razaoSocial}
                      onChange={e => setRazaoSocial(e.target.value)}
                      placeholder={hotel.name}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: CREDENCIAIS DE LOGIN */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="material-symbols-outlined text-base text-[#006c49]">lock</span>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    3. Credenciais de Acesso ao Painel
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      E-mail de Login *
                    </label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="seuemail@hotel.com.br"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Este será seu usuário para fazer login no sistema e no aplicativo.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Senha de Acesso * (mínimo 6 dígitos)
                    </label>
                    <div className="relative">
                      <input
                        type={showSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenha(!showSenha)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">
                          {showSenha ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirmar Senha *
                    </label>
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={confirmSenha}
                      onChange={e => setConfirmSenha(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* TERMOS */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={aceitouTermos}
                    onChange={e => setAceitouTermos(e.target.checked)}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>
                    Declaro sob as penas da lei que sou <strong>proprietário, gerente ou representante autorizado</strong> do estabelecimento <strong>{hotel.name}</strong> e concordo com os Termos de Uso e Política de Privacidade do Hotel no Zap.
                  </span>
                </label>
                {hasAttemptedSubmit && !aceitouTermos && (
                  <p className="text-[11px] text-red-500 font-medium mt-1">
                    Você precisa aceitar os termos para concluir.
                  </p>
                )}
              </div>

              {/* FOOTER ACTIONS */}
              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-xs sm:text-sm font-bold shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      <span>Ativando Perfil...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">verified</span>
                      <span>Concluir Reivindicação & Ativar Painel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default ModalReivindicarHotel;
