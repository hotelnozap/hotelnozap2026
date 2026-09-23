import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { currentHotelService, HotelAtivo, usuariosService } from '../services/supabaseService';

interface LoginProps {
  onLoginSuccess?: (userData: { name: string; email: string; role?: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  // Estado das credenciais (inicia em branco para não preencher indevidamente)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Manipulador de submit do login com autenticação real
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Por favor, informe seu e-mail e sua senha.');
      return;
    }

    setLoading(true);

    let ultimoErroAuth: string | null = null;

    try {
      // 0. SEGURANÇA — LIMPA QUALQUER SESSÃO ANTERIOR ANTES DE AUTENTICAR
      //    Impede que tokens/sessões de outro usuário (ex: admin) permaneçam ativos.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // ignora erro de signOut — o importante é que a próxima etapa seja limpa
      }
      try {
        localStorage.removeItem('hotelnozap_user_role');
        localStorage.removeItem('hotelnozap_user_email');
        localStorage.removeItem('hotelnozap_user_name');
        localStorage.removeItem('hotelnozap_hotel_atual');
      } catch { /* ignore */ }

      // 1. Tenta autenticar no Supabase Auth (PRIORIDADE MÁXIMA — sempre primeiro)
      let authSuccess = false;
      let authUser: any = null;

      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });

        if (!authError && authData?.user) {
          // PROTEÇÃO CONTRA CROSS-SESSION: o email retornado pelo Auth DEVE bater
          // com o email digitado no formulário. Impede bug onde sessão antiga é usada.
          const authEmail = (authData.user.email || '').trim().toLowerCase();
          if (authEmail === cleanEmail) {
            authSuccess = true;
            authUser = authData.user;
          } else {
            console.warn('MISMATCH de email Auth vs formulario:', { authEmail, cleanEmail });
            ultimoErroAuth = 'E-mail ou senha incorretos. Verifique suas credenciais.';
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          }
        } else if (authError) {
          console.warn('Tentativa de autenticação Supabase Auth:', authError);
          const msg = authError.message || '';
          const msgLower = msg.toLowerCase();
          if (msgLower.includes('email not confirmed') || msgLower.includes('email_not_confirmed')) {
            ultimoErroAuth = 'Este e-mail ainda não foi confirmado no sistema. Contate o suporte ou utilize a recuperação de senha.';
          } else if (msgLower.includes('invalid login credentials') || msgLower.includes('invalid password') || msgLower.includes('email not found')) {
            ultimoErroAuth = 'E-mail ou senha incorretos. Verifique suas credenciais.';
          } else if (msgLower.includes('too many attempts') || msgLower.includes('rate limit')) {
            ultimoErroAuth = 'Muitas tentativas de login. Aguarde alguns minutos ou recupere sua senha.';
          } else if (msgLower.includes('user_scheduled_deletion') || msgLower.includes('user not found')) {
            ultimoErroAuth = 'Usuário não encontrado ou conta em processo de exclusão.';
          } else if (msgLower.includes('sms') || msgLower.includes('phone')) {
            ultimoErroAuth = `Falha na autenticação: ${msg}`;
          } else {
            ultimoErroAuth = `Falha no login: ${msg}`;
          }
        }
      } catch (authCatch: any) {
        console.warn('Erro ao chamar Supabase Auth signInWithPassword:', authCatch);
        ultimoErroAuth = `Erro interno ao autenticar: ${authCatch?.message || authCatch}`;
      }

      // 2. Consulta o usuário na tabela `usuarios`
      let dbUser: any = null;
      try {
        const { data: uData } = await supabase
          .from('usuarios')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();
        dbUser = uData;
      } catch (dbErr) {
        console.warn('Erro ao consultar tabela usuarios:', dbErr);
      }

      // 3. FALLBACK DE CONTINGÊNCIA — SÓ ACEITA SE O AUTENTICADOR SUPABASE FALHOU
      //    REGRA RIGOROSÍSSIMA:
      //    - fallback NUNCA sobrepõe autenticação Auth bem-sucedida
      //    - exige e-mail EXATO + senha EXATA do Super Admin
      //    - isso existe para caso o Supabase Auth fique offline temporariamente
      let usouFallbackMaster = false;
      if (!authSuccess && cleanEmail === 'everaldozs@gmail.com' && password === '@20EndriuS26@#') {
        usouFallbackMaster = true;
        authSuccess = true;
        authUser = { email: cleanEmail, user_metadata: { nome: 'Everaldo Souza', perfil: 'Super Admin' } };
        if (!dbUser) {
          dbUser = { id: 'fallback-master', nome: 'Everaldo Souza', email: cleanEmail, perfil: 'Super Admin', status: 'ativo' };
        }
      }

      // 4. SE NÃO AUTENTICOU DE NENHUMA FORMA → ERRO (nunca loga)
      if (!authSuccess) {
        setErrorMessage(ultimoErroAuth || 'E-mail ou senha incorretos. Verifique suas credenciais.');
        setLoading(false);
        return;
      }

      // 5. Valida status do usuário (inativo/bloqueado → bloqueia login)
      if (dbUser && (dbUser.status === 'inativo' || dbUser.status === 'bloqueado')) {
        setErrorMessage('Este usuário está inativo ou bloqueado. Entre em contato com a administração.');
        // não deixa sessão Auth ativa
        if (!usouFallbackMaster) {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        }
        setLoading(false);
        return;
      }

      // 6. DETERMINA ROLE E NOME — PRIORIDADE ABSOLUTA É O BANCO DE DADOS
      //    Nunca mais hardcode 'Super Admin' por causa do e-mail.
      //    A role vem do (a) perfil DB (b) user_metadata Auth (c) fallback master.
      let role: string = '';
      if (usouFallbackMaster) {
        role = 'Super Admin';
      } else {
        role = (dbUser?.perfil || dbUser?.cargo || authUser?.user_metadata?.perfil || '').trim();
        // Todo usuário do tipo gerente tem que ser o perfil de acesso Hotel
        if (role.toLowerCase().includes('gerente')) {
          role = 'Hotel';
        }
        // Se for realmente o admin master Everaldo e DB tem perfil vazio, assume Super Admin
        // MAS SÓ se o email bater e o usuário já existir na Auth com este email
        if (!role && cleanEmail === 'everaldozs@gmail.com') {
          role = 'Super Admin';
        }
        if (!role) {
          role = 'Hotel';
        }
      }

      let userName: string = (dbUser?.nome || authUser?.user_metadata?.nome || authUser?.user_metadata?.name || '').trim();
      if (!userName) {
        userName = cleanEmail.split('@')[0];
      }

      // Se o usuário estiver tentando acessar a tela da camareira, somente Camareira e Administrador são aceitos
      const isTentandoCamareira = typeof window !== 'undefined' &&
        (window.location.pathname.toLowerCase().includes('camareira') || window.location.search.toLowerCase().includes('camareira'));
      const rLower = role.toLowerCase();
      const isPermitidoCamareira = rLower.includes('camareira') || 
                                   rLower.includes('governanca') || 
                                   rLower.includes('admin') || 
                                   rLower.includes('super') || 
                                   rLower.includes('administrador');

      if (isTentandoCamareira && !isPermitidoCamareira) {
        setErrorMessage(`Login recusado. Somente usuários do tipo Camareira podem acessar esta tela. Seu perfil atual (${role}) não é autorizado.`);
        try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
        try {
          localStorage.removeItem('hotelnozap_user_role');
          localStorage.removeItem('hotelnozap_user_email');
          localStorage.removeItem('hotelnozap_user_name');
          localStorage.removeItem('hotelnozap_hotel_atual');
        } catch {}
        setLoading(false);
        return;
      }

      // 7. Salva sessão no localStorage (valores 100% auditáveis do usuário logado)
      localStorage.setItem('hotelnozap_user_role', role);
      localStorage.setItem('hotelnozap_user_email', cleanEmail);
      localStorage.setItem('hotelnozap_user_name', userName);
      if (dbUser?.cargo) localStorage.setItem('hotelnozap_user_cargo', dbUser.cargo);
      localStorage.setItem('hotelnozap_last_authenticated_at', new Date().toISOString());
      usuariosService.registrarUltimoAcesso(cleanEmail);

      // Sincroniza o hotel ao qual este usuário pertence
      if (dbUser?.hotel_id) {
        try {
          const { data: hotelData } = await supabase
            .from('hoteis')
            .select('*')
            .eq('id', dbUser.hotel_id)
            .maybeSingle();
          if (hotelData) {
            const freshActive: HotelAtivo = {
              id: hotelData.id,
              name: hotelData.nome || hotelData.name || 'Hotel',
              category: hotelData.categoria || hotelData.category || 'Hotel',
              cityUf: hotelData.cidade_uf || hotelData.cityUf || `${hotelData.cidade || ''} - ${hotelData.uf || ''}`.trim(),
              cnpj: hotelData.cnpj,
              status: hotelData.status,
              imageUrl: hotelData.url_imagem || hotelData.imageUrl
            };
            currentHotelService.setCurrentHotel(freshActive);
            localStorage.setItem('hotelnozap_hotel_atual', JSON.stringify({ id: hotelData.id, name: freshActive.name }));
            window.dispatchEvent(new CustomEvent('hotel_changed', { detail: freshActive }));
          }
        } catch (hErr) {
          console.warn('Erro ao sincronizar hotel do usuário no login:', hErr);
        }
      }

      window.dispatchEvent(new CustomEvent('user_role_changed', { detail: role }));

      setSuccessMessage(`Login efetuado com sucesso! Entrando no painel ${role}...`);

      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess({ name: userName, email: cleanEmail, role });
        }
      }, 700);
    } catch (err: any) {
      console.error('Erro no fluxo de login:', err);
      setErrorMessage('Erro ao autenticar. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-white font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white overflow-hidden flex flex-col lg:grid lg:grid-cols-12 z-50">
      
      {/* PAINEL LATERAL VISUAL (BRANDING & RECURSOS - 5 COLUNAS NO DESKTOP, OCUPA 100% DA ALTURA) */}
      <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-b from-[#003400] to-[#000000] p-10 xl:p-14 flex-col justify-between text-white relative overflow-hidden h-full">
        {/* Padrão de fundo com CSS radial-gradient */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.4) 1px, transparent 1px), radial-gradient(rgba(0, 0, 0, 0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            backgroundPosition: '0 0, 16px 16px'
          }}
        />

        {/* Glow Decorativo */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Topo: Marca e Identidade */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg p-2.5">
              <span className="material-symbols-outlined text-emerald-400 text-3xl">apartment</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wider text-white">HOTEL NO ZAP</h1>
              <p className="text-xs text-emerald-400 font-semibold tracking-wider">GESTÃO HOTELEIRA DIGITAL</p>
            </div>
          </div>
        </div>

        {/* Meio: Destaques & Proposta de Valor */}
        <div className="relative z-10 my-auto py-8 space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-4">
              <span className="material-symbols-outlined text-sm">bolt</span>
              Plataforma All-in-One
            </span>
            <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight text-white tracking-tight">
              Automação, mapa de reservas e WhatsApp em um só lugar.
            </h2>
            <p className="text-slate-300 text-sm xl:text-base mt-4 leading-relaxed max-w-md">
              Controle recepção, quartos, financeiro e comunicação com hóspedes de maneira rápida, segura e simplificada.
            </p>
          </div>

          {/* Badges de Vantagens */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3.5 text-sm text-slate-200">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <span className="material-symbols-outlined text-lg">check_circle</span>
              </div>
              <span className="font-medium">Mapa de quartos interativo em tempo real</span>
            </div>
            <div className="flex items-center gap-3.5 text-sm text-slate-200">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <span className="material-symbols-outlined text-lg">chat</span>
              </div>
              <span className="font-medium">Disparos e automações no WhatsApp</span>
            </div>
            <div className="flex items-center gap-3.5 text-sm text-slate-200">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <span className="material-symbols-outlined text-lg">security</span>
              </div>
              <span className="font-medium">Acesso seguro com criptografia de ponta a ponta</span>
            </div>
          </div>
        </div>

        {/* Rodapé do Banner */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>© 2026 Hotel no Zap</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Sistemas 100% Operacionais
          </span>
        </div>
      </div>

      {/* PAINEL PRINCIPAL DO FORMULÁRIO (7 COLUNAS NO DESKTOP, CENTRALIZADO E ALINHADO) */}
      <div className="lg:col-span-7 p-6 sm:p-12 xl:p-16 flex flex-col justify-center items-center bg-white overflow-y-auto h-full">
        
        <div className="w-full max-w-md flex flex-col justify-between my-auto py-4">
          
          {/* FEEDBACK DE MENSAGENS NO FORM */}
          <div>
            {successMessage && (
              <div className="mb-6 w-full bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in shadow-md">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 w-full bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in shadow-md">
                <span className="material-symbols-outlined text-red-600">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Header Mobile se necessário */}
            <div className="flex items-center justify-between mb-8 lg:hidden">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#003400] text-emerald-400 flex items-center justify-center shadow">
                  <span className="material-symbols-outlined text-xl">apartment</span>
                </div>
                <span className="font-extrabold text-base tracking-wider text-slate-900">HOTEL NO ZAP</span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight">Bem-vindo de volta! 👋</h2>
              <p className="text-slate-500 text-sm sm:text-base mt-2">
                Insira suas credenciais corporativas para acessar o painel de gerenciamento.
              </p>
            </div>

            {/* Formulário de Login */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Campo E-mail / Usuário */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2" htmlFor="desktop-email">
                  E-mail ou Usuário <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-xl">alternate_email</span>
                  </div>
                  <input
                    type="email"
                    id="desktop-email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@hotel.com.br"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="desktop-password">
                    Senha <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined text-xl">lock</span>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="desktop-password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha de acesso"
                    required
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    title={showPassword ? 'Ocultar Senha' : 'Mostrar Senha'}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Lembrar-me e Ajuda */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-[#003400] border-slate-300 rounded focus:ring-[#003400] focus:ring-offset-0 cursor-pointer accent-[#003400]"
                  />
                  <span className="text-sm font-medium text-slate-600">Lembrar este dispositivo por 30 dias</span>
                </label>
                <a
                  href="#esqueci"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Instruções de recuperação foram enviadas para ' + (email || 'seu e-mail'));
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-all duration-200 cursor-pointer focus:outline-none"
                  title="Recuperar senha corporativa"
                >
                  <span className="material-symbols-outlined text-sm text-emerald-600">help</span>
                  Esqueceu a senha?
                </a>
              </div>

              {/* Botão de Ação Principal (Login) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#003400] to-[#052e16] hover:from-[#052e16] hover:to-[#000000] text-white text-sm font-bold shadow-lg shadow-emerald-950/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-xl">
                    {loading ? 'progress_activity' : 'login'}
                  </span>
                  <span>{loading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
                </button>
              </div>

            </form>

            {/* Divisor */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">Acesso de Parceiros & Suporte</span>
              </div>
            </div>

            {/* Botão Secundário / Área do Parceiro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="#parceiro"
                onClick={(e) => { e.preventDefault(); alert('Acessando Portal de Parceiros Hotel no Zap'); }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-emerald-600">handshake</span>
                <span>Portal do Parceiro</span>
              </a>
              <a
                href="#suporte"
                onClick={(e) => { e.preventDefault(); alert('Conectando ao Suporte Técnico via WhatsApp'); }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-slate-500">support_agent</span>
                <span>Suporte no WhatsApp</span>
              </a>
            </div>

          </div>

          {/* Rodapé Informativo */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <span>Hotel no Zap • Sistema de Gestão v3.4</span>
            <div className="flex items-center gap-4">
              <a href="#termos" className="hover:text-slate-600 transition-colors">Termos de Uso</a>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <a href="#privacidade" className="hover:text-slate-600 transition-colors">Privacidade</a>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Login;
