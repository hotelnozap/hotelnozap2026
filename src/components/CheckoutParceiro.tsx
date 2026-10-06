import React, { useState, useEffect, useRef } from 'react';
import { ZapHotelLogo } from './ZapHotelLogo';
import { maskCpf, maskCnpj, maskCpfCnpj, maskPhone, isValidCpf, isValidCnpj, maskCep } from '../utils/masks';
import { fetchAddressByCep } from '../utils/viacep';
import { mercadopagoService, PixMasterResult } from '../services/mercadopagoService';
import { parceirosService, usuariosService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { generateValidCpf } from '../utils/mockHotelData';

interface CheckoutParceiroProps {
  onNavigateBack: () => void;
  onNavigateToLogin?: () => void;
  onNavigateToDashboard?: () => void;
}

export const CheckoutParceiro: React.FC<CheckoutParceiroProps> = ({
  onNavigateBack,
  onNavigateToLogin,
  onNavigateToDashboard
}) => {
  // Passos do Checkout: 'dados' | 'login' | 'pagamento' | 'sucesso'
  const [currentStep, setCurrentStep] = useState<'dados' | 'login' | 'pagamento' | 'sucesso'>('dados');

  // Dados Pessoais do Parceiro
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Verificação de Unicidade de Documento (CPF / CNPJ)
  const [verificandoDoc, setVerificandoDoc] = useState(false);
  const [docCheckStatus, setDocCheckStatus] = useState<{ checked: boolean; exists: boolean; message: string }>({
    checked: false,
    exists: false,
    message: ''
  });

  // Dados de Endereço do Parceiro (Integração ViaCEP)
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Dados de Acesso / Login do Parceiro
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Erros e Validação
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do Pagamento PIX (5 minutos = 300 segundos)
  const [pixResult, setPixResult] = useState<PixMasterResult | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isVerificando, setIsVerificando] = useState(false);
  const [msgVerificacao, setMsgVerificacao] = useState<{
    tipo: 'pendente' | 'erro' | 'sucesso';
    texto: string;
  } | null>(null);
  const [partnerCheckoutId, setPartnerCheckoutId] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutos
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Dados pós-aprovação
  const [partnerCode, setPartnerCode] = useState('');
  const [partnerLink, setPartnerLink] = useState('');
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Formatar tempo mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Análise de Força da Senha em Tempo Real
  const passwordAnalysis = React.useMemo(() => {
    const hasMinLength = senha.length >= 8;
    const hasUppercase = /[A-Z]/.test(senha);
    const hasLowercase = /[a-z]/.test(senha);
    const hasNumber = /[0-9]/.test(senha);
    const hasSpecial = /[^A-Za-z0-9]/.test(senha);

    const checks = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial];
    const score = checks.filter(Boolean).length;

    let label: 'Fraca' | 'Média' | 'Forte' = 'Fraca';
    let color = 'text-rose-600';
    let bgColor = 'bg-rose-500';

    if (!senha) {
      label = 'Fraca';
      color = 'text-slate-400';
      bgColor = 'bg-slate-200';
    } else if (score <= 2) {
      label = 'Fraca';
      color = 'text-rose-600';
      bgColor = 'bg-rose-500';
    } else if (score <= 4) {
      label = 'Média';
      color = 'text-amber-500';
      bgColor = 'bg-amber-500';
    } else {
      label = 'Forte';
      color = 'text-emerald-600';
      bgColor = 'bg-emerald-500';
    }

    return {
      score,
      label,
      color,
      bgColor,
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      isValid: score === 5
    };
  }, [senha]);

  // Integração com ViaCEP
  const handleSearchCep = async (rawCep: string) => {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length === 8) {
      setBuscandoCep(true);
      setCepError(null);
      try {
        const data = await fetchAddressByCep(clean);
        if (data && !data.erro) {
          if (data.logradouro) setLogradouro(data.logradouro);
          if (data.bairro) setBairro(data.bairro);
          if (data.localidade) setCidade(data.localidade);
          if (data.uf) setUf(data.uf.toUpperCase());
        } else {
          setCepError('CEP não encontrado. Preencha os campos manualmente.');
        }
      } catch (err) {
        setCepError('Erro ao consultar ViaCEP.');
      } finally {
        setBuscandoCep(false);
      }
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setCep(masked);
    setCepError(null);
    if (masked.replace(/\D/g, '').length === 8) {
      handleSearchCep(masked);
    }
  };

  // Gerar código de parceiro baseado no nome
  const generatePartnerCode = (nameStr: string): string => {
    const clean = nameStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const prefix = clean.slice(0, 6) || 'PARTNER';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `${prefix}${randomSuffix}`;
  };

  // Notificação de preenchimento rápido de teste
  const [quickFillNotice, setQuickFillNotice] = useState<string | null>(null);

  // Modo de Preenchimento Rápido (disparado ao digitar parceiro01 ou clicar no botão)
  const applyTestMockPartnerData = () => {
    const randNum = Math.floor(100 + Math.random() * 900);
    const validCpf = generateValidCpf();
    setNome(`Carlos Eduardo Parceiro ${randNum}`);
    setCpf(validCpf);
    setWhatsapp('(11) 98765-4321');
    setCep('01310-100');
    setLogradouro('Avenida Paulista');
    setNumero(String(1000 + randNum));
    setComplemento('Sala 502');
    setBairro('Bela Vista');
    setCidade('São Paulo');
    setUf('SP');
    setEmail(`parceiro.teste${randNum}@hotelnozap.com.br`);
    setSenha('Parceiro@2026!');
    setConfirmarSenha('Parceiro@2026!');
    setErrorMsg(null);
    setQuickFillNotice(`🚀 Modo Teste (parceiro01): Dados preenchidos com CPF válido (${validCpf}), endereço completo e senha forte!`);
    setTimeout(() => setQuickFillNotice(null), 6000);
  };

  // Validador de duplicidade de documento (CPF ou CNPJ) no banco de dados Supabase
  const verificarDocumentoExistente = async (docStr: string) => {
    const clean = docStr.replace(/\D/g, '');
    if (!clean) {
      return { exists: false, valid: false, message: '' };
    }

    if (clean.length === 11) {
      if (!isValidCpf(clean)) {
        return { exists: false, valid: false, message: 'CPF inválido.' };
      }
    } else if (clean.length === 14) {
      if (!isValidCnpj(clean)) {
        return { exists: false, valid: false, message: 'CNPJ inválido.' };
      }
    } else {
      return { exists: false, valid: false, message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
    }

    const masked = clean.length === 11 ? maskCpf(clean) : maskCnpj(clean);

    try {
      // 1. Verifica duplicidade na tabela parceiros
      const { data: pData } = await supabase
        .from('parceiros')
        .select('id, nome, documento')
        .or(`documento.eq.${clean},documento.eq.${masked}`)
        .limit(1);

      if (pData && pData.length > 0) {
        return {
          exists: true,
          valid: true,
          message: `Este ${clean.length === 11 ? 'CPF' : 'CNPJ'} já está cadastrado no sistema (Parceiro: ${pData[0].nome || 'Cadastrado'}). Não é permitido criar dois cadastros com o mesmo documento.`
        };
      }

      // 2. Verifica duplicidade na tabela usuarios
      const { data: uData } = await supabase
        .from('usuarios')
        .select('id, nome, cpf')
        .or(`cpf.eq.${clean},cpf.eq.${masked}`)
        .limit(1);

      if (uData && uData.length > 0) {
        return {
          exists: true,
          valid: true,
          message: `Este ${clean.length === 11 ? 'CPF' : 'CNPJ'} já possui cadastro de usuário no sistema (${uData[0].nome || 'Cadastrado'}). Não é permitido duplicar o documento.`
        };
      }

      return {
        exists: false,
        valid: true,
        message: `${clean.length === 11 ? 'CPF' : 'CNPJ'} disponível para cadastro.`
      };
    } catch (err) {
      console.warn('Erro ao verificar duplicidade de documento no banco:', err);
      return { exists: false, valid: true, message: '' };
    }
  };

  const checkDocUniquenessAsync = async (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length !== 11 && clean.length !== 14) {
      setDocCheckStatus({ checked: false, exists: false, message: '' });
      return;
    }

    setVerificandoDoc(true);
    const res = await verificarDocumentoExistente(val);
    setVerificandoDoc(false);
    setDocCheckStatus({ checked: true, exists: res.exists, message: res.message });
    if (res.exists) {
      setErrorMsg(res.message);
    } else if (errorMsg && (errorMsg.includes('CPF') || errorMsg.includes('CNPJ') || errorMsg.includes('documento'))) {
      setErrorMsg(null);
    }
  };

  const handleNomeChange = (val: string) => {
    if (val.trim().toLowerCase() === 'parceiro01') {
      applyTestMockPartnerData();
      return;
    }
    setNome(val);
  };

  const handleCpfChange = (val: string) => {
    if (val.trim().toLowerCase() === 'parceiro01') {
      applyTestMockPartnerData();
      return;
    }
    const masked = maskCpfCnpj(val);
    setCpf(masked);
    setDocCheckStatus({ checked: false, exists: false, message: '' });
    const clean = masked.replace(/\D/g, '');
    if (clean.length === 11 || clean.length === 14) {
      checkDocUniquenessAsync(masked);
    }
  };

  const handleWhatsappChange = (val: string) => {
    if (val.trim().toLowerCase() === 'parceiro01') {
      applyTestMockPartnerData();
      return;
    }
    setWhatsapp(maskPhone(val));
  };

  const handleEmailChange = (val: string) => {
    if (val.trim().toLowerCase() === 'parceiro01') {
      applyTestMockPartnerData();
      return;
    }
    setEmail(val);
  };

  const handleSenhaChange = (val: string) => {
    if (val.trim().toLowerCase() === 'parceiro01') {
      applyTestMockPartnerData();
      return;
    }
    setSenha(val);
  };

  // Etapa 1: Avançar dos Dados Pessoais & Endereço para a Etapa de Login
  const handleAvancarParaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validações de dados pessoais
    if (!nome.trim() || nome.trim().split(' ').length < 2) {
      setErrorMsg('Por favor, informe seu nome e sobrenome completos.');
      return;
    }
    const cleanDoc = cpf.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setErrorMsg('Por favor, informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }
    if (cleanDoc.length === 11 && !isValidCpf(cpf)) {
      setErrorMsg('Por favor, informe um CPF válido.');
      return;
    }
    if (cleanDoc.length === 14 && !isValidCnpj(cpf)) {
      setErrorMsg('Por favor, informe um CNPJ válido.');
      return;
    }

    // Regra de Integridade: Impedir duplicidade de CPF ou CNPJ no cadastro
    setVerificandoDoc(true);
    const docCheck = await verificarDocumentoExistente(cpf);
    setVerificandoDoc(false);
    setDocCheckStatus({ checked: true, exists: docCheck.exists, message: docCheck.message });

    if (docCheck.exists) {
      setErrorMsg(docCheck.message);
      return;
    }

    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Por favor, informe seu WhatsApp com DDD completo.');
      return;
    }

    // Validações de endereço (ViaCEP)
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setErrorMsg('Por favor, informe um CEP válido com 8 dígitos.');
      return;
    }
    if (!logradouro.trim()) {
      setErrorMsg('Por favor, informe a rua / logradouro do endereço.');
      return;
    }
    if (!numero.trim()) {
      setErrorMsg('Por favor, informe o número do endereço.');
      return;
    }
    if (!bairro.trim()) {
      setErrorMsg('Por favor, informe o bairro.');
      return;
    }
    if (!cidade.trim() || !uf.trim()) {
      setErrorMsg('Por favor, informe a cidade e estado (UF).');
      return;
    }

    // Avança para o Passo 2: Login e Senha
    setCurrentStep('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Etapa 2: Avançar do Login/Senha para a Etapa de Pagamento (PIX)
  const handleAvancarParaPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validações de E-mail
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Por favor, informe um endereço de e-mail válido para seu acesso.');
      return;
    }

    // Validações de Senha Segura
    if (!passwordAnalysis.isValid) {
      setErrorMsg('A senha precisa cumprir todos os requisitos de segurança (mínimo 8 caracteres, com maiúsculas, minúsculas, números e caracteres especiais).');
      return;
    }

    if (senha !== confirmarSenha) {
      setErrorMsg('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    // Verificação estrita de duplicidade de CPF ou CNPJ antes de avançar para pagamento
    setVerificandoDoc(true);
    const docCheck = await verificarDocumentoExistente(cpf);
    setVerificandoDoc(false);

    if (docCheck.exists) {
      setErrorMsg(docCheck.message);
      setDocCheckStatus({ checked: true, exists: true, message: docCheck.message });
      setCurrentStep('dados');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Verificação de e-mail já existente
    const cleanEmail = email.trim().toLowerCase();
    const { data: existingParc } = await supabase
      .from('parceiros')
      .select('id, nome, email')
      .ilike('email', cleanEmail)
      .limit(1);

    if (existingParc && existingParc.length > 0) {
      setErrorMsg('Este e-mail já está cadastrado para outro parceiro. Faça login para acessar sua conta ou informe outro e-mail.');
      return;
    }

    setIsSubmitting(true);
    setGerandoPix(true);
    setCurrentStep('pagamento');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const cleanDoc = cpf.replace(/\D/g, '');
      const refId = `parceiro_${cleanDoc}_${Date.now()}`;
      setPartnerCheckoutId(refId);

      // Cria a cobrança PIX oficial no Mercado Pago com valor padrão de teste de R$ 1,00 solicitado
      const res = await mercadopagoService.criarPagamentoPixMaster({
        hotelId: refId,
        hotelNome: `Franquia Hotel no Zap - ${nome.trim()}`,
        planoNome: 'Licença Anual Franqueado (Teste R$ 1,00)',
        valor: 1.00, // R$ 1,00 para validação imediata em ambiente de teste
        pagadorEmail: email.trim().toLowerCase(),
        pagadorNome: nome.trim(),
        pagadorDoc: cleanDoc
      });

      setPixResult(res);
      setTimeLeft(300); // 5 minutos de validade
    } catch (err: any) {
      console.warn('Erro ao gerar cobrança Pix do Parceiro:', err);
      // Fallback amigável com chave da matriz se o webhook falhar
      setPixResult({
        success: true,
        paymentId: `fallback_${Date.now()}`,
        status: 'pending',
        gateway: 'pix_chave',
        qrCode: 'hotelnozap@gmail.com'
      });
      setTimeLeft(300);
    } finally {
      setIsSubmitting(false);
      setGerandoPix(false);
    }
  };

  // Timer regressivo de 5 minutos
  useEffect(() => {
    if (currentStep !== 'pagamento' || isApproved) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStep, isApproved]);

  // Polling automático de status do pagamento no Mercado Pago
  useEffect(() => {
    if (currentStep !== 'pagamento' || isApproved || !pixResult?.paymentId) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Se for mock/fallback de chave manual, não faz polling na API
    if (pixResult.paymentId.startsWith('fallback_')) return;

    pollingRef.current = setInterval(async () => {
      try {
        const statusRes = await mercadopagoService.consultarPagamentoMaster(
          pixResult.paymentId,
          partnerCheckoutId,
          1.00
        );
        if (statusRes.approved || statusRes.status === 'approved') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          await liberarAcessoParceiro(true);
        }
      } catch (e) {
        // Silencioso para não poluir console
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentStep, isApproved, pixResult?.paymentId, partnerCheckoutId]);

  // Liberação do Acesso e Cadastro do Parceiro em cascata: Auth -> Usuários -> Parceiros
  // SEGURANÇA MÁXIMA: Exige confirmação prévia do gateway ou consulta em tempo real antes de prosseguir
  const liberarAcessoParceiro = async (confirmadoPorGateway: boolean = false) => {
    // Trava de segurança: se chamado sem a confirmação prévia, valida direto no Mercado Pago
    if (!confirmadoPorGateway) {
      if (!pixResult?.paymentId || pixResult.paymentId.startsWith('fallback_')) {
        setMsgVerificacao({
          tipo: 'pendente',
          texto: 'Aguardando compensação bancária do PIX. O acesso só será liberado após a confirmação do pagamento.'
        });
        return;
      }

      setIsVerificando(true);
      try {
        const checkRes = await mercadopagoService.consultarPagamentoMaster(
          pixResult.paymentId,
          partnerCheckoutId,
          1.00
        );
        if (!checkRes.approved && checkRes.status !== 'approved') {
          setMsgVerificacao({
            tipo: 'pendente',
            texto: 'Pagamento ainda não confirmado no Mercado Pago. O acesso só será liberado após o pagamento efetivo.'
          });
          setIsVerificando(false);
          return;
        }
      } catch (err) {
        setMsgVerificacao({
          tipo: 'erro',
          texto: 'Não foi possível validar o pagamento com o Mercado Pago. Tente novamente em alguns segundos.'
        });
        setIsVerificando(false);
        return;
      }
    }

    setIsVerificando(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = whatsapp.replace(/\D/g, '');
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanCep = cep.replace(/\D/g, '');
      const enderecoCompleto = `${logradouro.trim()}, ${numero.trim()}${complemento.trim() ? ` (${complemento.trim()})` : ''} - ${bairro.trim()}`;
      const localidadeFormatada = `${cidade.trim()} - ${uf.trim().toUpperCase()}`;
      const code = generatePartnerCode(nome);
      setPartnerCode(code);
      const referralUrl = `https://hotelnozap.com.br/parceiros/assinar?ref=${code}`;
      setPartnerLink(referralUrl);

      let authUserId: string | null = null;
      let usuarioId: string | null = null;
      let parceiroId: string | null = null;

      // =========================================================================
      // CASCATA ETAPA 1: CRIAÇÃO VIA API SERVERLESS (SERVICE ROLE ADMIN)
      // Cria no Supabase Auth + tabela `usuarios` (perfil: 'Parceiro') + `parceiros`
      // =========================================================================
      let ativadoComSucesso = false;
      try {
        const responseApi = await fetch('/api/ativar-parceiro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: nome.trim(),
            email: cleanEmail,
            whatsapp: cleanPhone,
            cpf: cleanCpf,
            cep: cleanCep,
            logradouro: logradouro.trim(),
            numero: numero.trim(),
            complemento: complemento.trim(),
            bairro: bairro.trim(),
            cidade: cidade.trim(),
            uf: uf.trim().toUpperCase(),
            senha: senha,
            cupom: code
          })
        });

        if (responseApi.ok) {
          const apiJson = await responseApi.json();
          if (apiJson.success) {
            ativadoComSucesso = true;
            authUserId = apiJson.authUserId || null;
            usuarioId = apiJson.usuarioId || null;
            parceiroId = apiJson.parceiroId || null;
            if (apiJson.cupom) {
              setPartnerCode(apiJson.cupom);
              setPartnerLink(`https://hotelnozap.com.br/parceiros/assinar?ref=${apiJson.cupom}`);
            }
          }
        }
      } catch (apiErr) {
        console.warn('API /api/ativar-parceiro offline ou indisponível, acionando fallback direto Supabase:', apiErr);
      }

      // =========================================================================
      // CASCATA ETAPA 2: FALLBACK DIRETO VIA CLIENTE SUPABASE (CASO A API FALHE)
      // =========================================================================
      if (!ativadoComSucesso) {
        // 2.1 Supabase Auth
        try {
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: senha,
            options: {
              data: {
                name: nome.trim(),
                nome: nome.trim(),
                perfil: 'Parceiro',
                whatsapp: cleanPhone,
                cpf: cleanCpf
              }
            }
          });

          if (authData?.user?.id) {
            authUserId = authData.user.id;
          } else if (authError) {
            console.warn('Supabase Auth SignUp aviso:', authError.message);
            const { data: authSignIn } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: senha
            }).catch(() => ({ data: null }));
            if (authSignIn?.user?.id) {
              authUserId = authSignIn.user.id;
            }
          }
        } catch (authErr) {
          console.warn('Exceção ao criar credenciais no Supabase Auth:', authErr);
        }

        // 2.2 Tabela `usuarios` (perfil 'Parceiro' e colunas correspondentes ao schema)
        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id, auth_user_id')
          .eq('email', cleanEmail)
          .maybeSingle();

        const userPayload: any = {
          nome: nome.trim(),
          email: cleanEmail,
          telefone: cleanPhone || '11999999999',
          cpf: cleanCpf,
          perfil: 'Parceiro',
          cargo: 'Parceiro Franqueado',
          status: 'ativo',
          auth_user_id: authUserId || existingUser?.auth_user_id || null,
          cep: cleanCep,
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          uf: uf.trim().toUpperCase()
        };

        if (!existingUser?.id) {
          const insertUserRes = await supabase
            .from('usuarios')
            .insert(userPayload)
            .select('id')
            .single();

          if (insertUserRes.error) {
            console.error('Erro ao inserir em usuarios via fallback:', insertUserRes.error);
          } else {
            usuarioId = insertUserRes.data?.id || null;
          }
        } else {
          usuarioId = existingUser.id;
          await supabase
            .from('usuarios')
            .update(userPayload)
            .eq('id', usuarioId);
        }

        // 2.3 Tabela `parceiros` com nome_contato, categoria, cidade_uf e chaves corretas
        const { data: existingParc } = await supabase
          .from('parceiros')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle();

        parceiroId = existingParc?.id || null;

        const partnerPayload: any = {
          nome: nome.trim(),
          nome_contato: nome.trim(),
          email: cleanEmail,
          whatsapp: cleanPhone || '11999999999',
          documento: cleanCpf,
          categoria: 'Franquia Regional',
          cidade_uf: `${cidade.trim() || 'São Paulo'} / ${uf.trim().toUpperCase() || 'SP'}`,
          cidade: cidade.trim(),
          uf: uf.trim().toUpperCase(),
          cep: cleanCep,
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cupom: code,
          taxa_comissao: 50,
          status: 'ativo',
          pix_tipo: cleanCpf.length === 14 ? 'CNPJ' : 'CPF',
          pix_chave: cleanCpf,
          titular_pix: nome.trim(),
          usuario_id: usuarioId,
          auth_user_id: authUserId
        };

        if (!parceiroId) {
          const insertParcRes = await supabase
            .from('parceiros')
            .insert(partnerPayload)
            .select('id')
            .single();

          if (insertParcRes.error) {
            console.error('Erro ao inserir em parceiros via fallback:', insertParcRes.error);
          } else if (insertParcRes.data) {
            parceiroId = insertParcRes.data.id;
          }
        } else {
          await supabase
            .from('parceiros')
            .update(partnerPayload)
            .eq('id', parceiroId);
        }
      }

      // =========================================================================
      // CASCATA ETAPA 3: GRAVAR SESSÃO LOCAL PARA ACESSO IMEDIATO
      // =========================================================================
      localStorage.setItem('hotelnozap_user_role', 'Parceiro');
      localStorage.setItem('hotelnozap_user_cargo', 'Parceiro Franqueado');
      localStorage.setItem('hotelnozap_user_email', cleanEmail);
      localStorage.setItem('hotelnozap_user_name', nome.trim());
      if (usuarioId) localStorage.setItem('hotelnozap_user_id', usuarioId);
      localStorage.setItem('hotelnozap_last_authenticated_at', new Date().toISOString());

      setIsApproved(true);
      setCurrentStep('sucesso');
    } catch (err: any) {
      console.error('Erro na cascata de criação do parceiro:', err);
      setErrorMsg('Ocorreu uma falha ao cadastrar seu acesso: ' + (err.message || 'Tente novamente.'));
      setMsgVerificacao({
        tipo: 'erro',
        texto: 'Ocorreu um erro ao ativar sua conta. Por favor, tente novamente ou contate o suporte.'
      });
      setIsApproved(false);
    } finally {
      setIsVerificando(false);
    }
  };

  // Consulta manual disparada pelo botão de contingência
  const handleVerificarPagamentoManual = async () => {
    if (isVerificando) return;
    setMsgVerificacao(null);

    if (!pixResult?.paymentId) {
      setMsgVerificacao({
        tipo: 'pendente',
        texto: 'Cobrança não identificada. Por favor, retorne e gere o código Pix novamente.'
      });
      return;
    }

    if (pixResult.paymentId.startsWith('fallback_')) {
      setMsgVerificacao({
        tipo: 'pendente',
        texto: 'Aguardando compensação bancária do PIX. Se você acabou de efetuar a transferência, aguarde alguns instantes e tente novamente.'
      });
      return;
    }

    setIsVerificando(true);
    try {
      const res = await mercadopagoService.consultarPagamentoMaster(
        pixResult.paymentId,
        partnerCheckoutId,
        1.00
      );

      if (res.approved || res.status === 'approved') {
        setMsgVerificacao({
          tipo: 'sucesso',
          texto: 'Pagamento aprovado com sucesso! Liberando acesso à plataforma...'
        });
        if (pollingRef.current) clearInterval(pollingRef.current);
        await liberarAcessoParceiro(true);
      } else if (res.rejected || res.status === 'rejected' || res.status === 'cancelled') {
        setMsgVerificacao({
          tipo: 'erro',
          texto: 'O Mercado Pago informou que este pagamento foi cancelado ou recusado. Por favor, gere uma nova cobrança PIX.'
        });
      } else {
        setMsgVerificacao({
          tipo: 'pendente',
          texto: `Pagamento ainda não aprovado (status: ${res.status || 'pendente'}). Se você já pagou no app do seu banco, aguarde alguns segundos até a compensação bancária e clique novamente.`
        });
      }
    } catch (e: any) {
      console.warn('Erro ao consultar Mercado Pago manualmente:', e);
      setMsgVerificacao({
        tipo: 'erro',
        texto: 'Não foi possível consultar o status do pagamento no momento. Tente novamente em alguns segundos.'
      });
    } finally {
      setIsVerificando(false);
    }
  };

  // Botão "Copiar Código Pix"
  const handleCopiarPix = () => {
    const chave = pixResult?.qrCode || 'hotelnozap@gmail.com';
    navigator.clipboard.writeText(chave).then(() => {
      setCopiadoPix(true);
      setTimeout(() => setCopiadoPix(false), 3000);
    });
  };

  // Botão "Copiar Link de Indicação"
  const handleCopiarLink = () => {
    if (!partnerLink) return;
    navigator.clipboard.writeText(partnerLink).then(() => {
      setCopiadoLink(true);
      setTimeout(() => setCopiadoLink(false), 3000);
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] font-sans antialiased flex flex-col justify-between selection:bg-[#FDB116] selection:text-[#1b1b1b]">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER ISOLADO (FOCUS MODE)                                        */}
      {/* ========================================================================= */}
      <header className="w-full bg-white border-b border-slate-200 shadow-xs py-4 px-4 sm:px-8 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          <button 
            onClick={onNavigateBack}
            className="flex items-center gap-2 text-slate-600 hover:text-[#003400] transition-colors cursor-pointer group text-xs sm:text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
              arrow_back
            </span>
            <span>Voltar</span>
          </button>

          <div className="flex items-center gap-2.5">
            <ZapHotelLogo size={34} />
            <div className="flex flex-col leading-none text-left">
              <span className="font-extrabold text-base text-[#0b1c30] tracking-tight">Hotel no Zap</span>
              <span className="text-[10px] text-[#006c49] font-bold uppercase tracking-wider mt-0.5">
                Checkout Seguro • Franquia Oficial
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">lock</span>
            <span>Ambiente Seguro 256-bit</span>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CONTEÚDO PRINCIPAL (DUAL COLUMN DESKTOP / SINGLE COLUMN MOBILE)         */}
      {/* ========================================================================= */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
        
        {/* Barra de Progresso Superior (4 Etapas) */}
        <div className="max-w-3xl mx-auto mb-8 sm:mb-12 px-2">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            
            {/* Step 1: Dados */}
            <div className={`relative z-10 flex flex-col items-center gap-1.5 ${currentStep === 'dados' ? 'text-[#003400]' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                currentStep === 'dados' 
                  ? 'bg-[#003400] text-white ring-4 ring-emerald-100' 
                  : (currentStep === 'login' || currentStep === 'pagamento' || currentStep === 'sucesso') 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-white text-slate-500 border border-slate-300'
              }`}>
                {(currentStep === 'login' || currentStep === 'pagamento' || currentStep === 'sucesso') ? (
                  <span className="material-symbols-outlined text-sm">check</span>
                ) : '1'}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold">1. Dados</span>
            </div>

            {/* Step 2: Acesso / Login */}
            <div className={`relative z-10 flex flex-col items-center gap-1.5 ${currentStep === 'login' ? 'text-[#003400]' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                currentStep === 'login' 
                  ? 'bg-[#003400] text-white ring-4 ring-emerald-100' 
                  : (currentStep === 'pagamento' || currentStep === 'sucesso')
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-500 border border-slate-300'
              }`}>
                {(currentStep === 'pagamento' || currentStep === 'sucesso') ? (
                  <span className="material-symbols-outlined text-sm">check</span>
                ) : '2'}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold">2. Criar Acesso</span>
            </div>

            {/* Step 3: Pagamento */}
            <div className={`relative z-10 flex flex-col items-center gap-1.5 ${currentStep === 'pagamento' ? 'text-[#003400]' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                currentStep === 'pagamento' 
                  ? 'bg-[#003400] text-white ring-4 ring-emerald-100' 
                  : currentStep === 'sucesso'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-500 border border-slate-300'
              }`}>
                {currentStep === 'sucesso' ? (
                  <span className="material-symbols-outlined text-sm">check</span>
                ) : '3'}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold">3. Pagamento</span>
            </div>

            {/* Step 4: Acesso Liberado */}
            <div className={`relative z-10 flex flex-col items-center gap-1.5 ${currentStep === 'sucesso' ? 'text-[#006c49]' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-xs ${
                currentStep === 'sucesso' 
                  ? 'bg-[#006c49] text-white ring-4 ring-emerald-100' 
                  : 'bg-white text-slate-500 border border-slate-300'
              }`}>
                4
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold">4. Liberado</span>
            </div>

          </div>
        </div>

        {/* Grid Dual Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ========================================================================= */}
          {/* COLUNA ESQUERDA: FORMULÁRIO / PIX / LIBERAÇÃO (7 colunas)                 */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 flex flex-col gap-6">

            {/* PASSO 1: DADOS DO FRANQUEADO E ENDEREÇO */}
            {currentStep === 'dados' && (
              <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">person_pin</span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#0b1c30]">Dados da Franquia</h2>
                    <p className="text-xs text-slate-500">Informe seus dados cadastrais e endereço para emitir a licença oficial.</p>
                  </div>
                </div>

                {quickFillNotice && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                    <span className="material-symbols-outlined text-base text-amber-600">check_circle</span>
                    <span>{quickFillNotice}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleAvancarParaLogin} className="flex flex-col gap-4 text-left">
                  
                  {/* Seção 1: Dados Pessoais com Botão de Teste Rápido */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">1. Dados Pessoais</span>
                    <button
                      type="button"
                      onClick={applyTestMockPartnerData}
                      title="Preencher automaticamente com dados de teste válidos (Código: parceiro01)"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-sm text-amber-600">bolt</span>
                      <span>Preenchimento Rápido (parceiro01)</span>
                    </button>
                  </div>

                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Eduardo de Oliveira (ou digite parceiro01)"
                      value={nome}
                      onChange={(e) => handleNomeChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* CPF ou CNPJ e WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>CPF ou CNPJ (para repasse) *</span>
                        {verificandoDoc && (
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 animate-pulse">
                            <span className="w-2.5 h-2.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            Verificando...
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        placeholder="000.000.000-00 ou CNPJ"
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        onBlur={() => checkDocUniquenessAsync(cpf)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                          docCheckStatus.checked && docCheckStatus.exists
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500'
                            : docCheckStatus.checked && !docCheckStatus.exists
                            ? 'border-emerald-400 bg-emerald-50/20 text-slate-900 focus:ring-emerald-600'
                            : 'border-slate-300 bg-white text-slate-900 focus:ring-[#003400]'
                        }`}
                      />
                      {docCheckStatus.checked && docCheckStatus.exists && (
                        <p className="mt-1.5 text-xs text-rose-600 font-semibold flex items-start gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1" />
                          <span>{docCheckStatus.message}</span>
                        </p>
                      )}
                      {docCheckStatus.checked && !docCheckStatus.exists && (
                        <p className="mt-1.5 text-xs text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{docCheckStatus.message}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">WhatsApp com DDD *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        placeholder="(00) 00000-0000"
                        value={whatsapp}
                        onChange={(e) => handleWhatsappChange(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Seção 2: Endereço do Parceiro com ViaCEP */}
                  <div className="pt-3 pb-1 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">2. Endereço da Franquia (ViaCEP)</span>
                    {buscandoCep && (
                      <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 animate-pulse">
                        <span className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        Buscando endereço...
                      </span>
                    )}
                  </div>

                  {/* CEP e Bairro */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>CEP *</span>
                        <span className="text-[10px] text-slate-400 font-normal">Preenchimento automático</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="00000-000"
                          value={cep}
                          onChange={handleCepChange}
                          onBlur={() => handleSearchCep(cep)}
                          className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all pr-10 ${
                            cepError ? 'border-red-300 bg-red-50/20' : 'border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSearchCep(cep)}
                          title="Buscar CEP no ViaCEP"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700 transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-lg">search</span>
                        </button>
                      </div>
                      {cepError && (
                        <span className="text-[11px] text-red-600 font-semibold mt-1 block">
                          {cepError}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Bairro *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Centro"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Logradouro (Rua/Avenida) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Rua / Logradouro *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Av. Brasil, Rua das Flores"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Número e Complemento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Número *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 1250 ou S/N"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Complemento (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: Sala 302, Bloco B, Apto 101"
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Cidade e UF */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Cidade *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: São Paulo"
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">UF (Estado) *</label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        placeholder="SP"
                        value={uf}
                        onChange={(e) => setUf(e.target.value.toUpperCase())}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all text-center"
                      />
                    </div>
                  </div>

                  {/* Botão de Prosseguir para Etapa 2 */}
                  <div className="pt-4 flex flex-col gap-2">
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] font-black text-sm sm:text-base shadow-lg shadow-[#FDB116]/25 transition-all duration-200 active:scale-95 cursor-pointer"
                    >
                      <span>Continuar para Criar Acesso</span>
                      <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    </button>
                    <span className="text-[11px] text-center text-slate-500 font-medium">
                      Passo 1 de 3: Seus dados estão seguros e criptografados.
                    </span>
                  </div>

                </form>
              </div>
            )}

            {/* PASSO 2: CRIAR ACESSO & SENHA SEGURA */}
            {currentStep === 'login' && (
              <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">key</span>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-[#0b1c30]">Criação de Acesso &amp; Login</h2>
                      <p className="text-xs text-slate-500">Defina suas credenciais oficiais para entrar no Painel de Franqueado.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={applyTestMockPartnerData}
                    title="Preencher automaticamente com dados de teste válidos (Código: parceiro01)"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-sm text-amber-600">bolt</span>
                    <span>Preenchimento Rápido (parceiro01)</span>
                  </button>
                </div>

                {quickFillNotice && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                    <span className="material-symbols-outlined text-base text-amber-600">check_circle</span>
                    <span>{quickFillNotice}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleAvancarParaPagamento} className="flex flex-col gap-4 text-left">
                  
                  {/* E-mail Principal */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">E-mail Principal para Login *</label>
                    <input
                      type="email"
                      required
                      placeholder="seuemail@exemplo.com (ou digite parceiro01)"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Este será o seu login oficial de acesso ao sistema do Hotel no Zap.</span>
                  </div>

                  {/* Senha de Acesso */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">Senha Segura *</label>
                      {senha && (
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                          passwordAnalysis.score <= 2 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : passwordAnalysis.score <= 4 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          Senha {passwordAnalysis.label}
                        </span>
                      )}
                    </div>
                    
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Crie sua senha segura"
                        value={senha}
                        onChange={(e) => handleSenhaChange(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>

                    {/* Indicador Visual de Força da Senha (3 Segmentos) */}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        senha ? (passwordAnalysis.score >= 1 ? passwordAnalysis.bgColor : 'bg-slate-200') : 'bg-slate-200'
                      }`} />
                      <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        senha ? (passwordAnalysis.score >= 3 ? passwordAnalysis.bgColor : 'bg-slate-200') : 'bg-slate-200'
                      }`} />
                      <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        senha ? (passwordAnalysis.score === 5 ? 'bg-emerald-500' : 'bg-slate-200') : 'bg-slate-200'
                      }`} />
                    </div>

                    {/* Requisitos de Senha Segura */}
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
                      <span className="text-[11px] font-bold text-slate-600">Requisitos para senha segura:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        
                        <div className={`flex items-center gap-1.5 ${passwordAnalysis.hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                          <span className={`material-symbols-outlined text-base ${passwordAnalysis.hasMinLength ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {passwordAnalysis.hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Mínimo de 8 caracteres</span>
                        </div>

                        <div className={`flex items-center gap-1.5 ${passwordAnalysis.hasUppercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                          <span className={`material-symbols-outlined text-base ${passwordAnalysis.hasUppercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {passwordAnalysis.hasUppercase ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Letra maiúscula (A-Z)</span>
                        </div>

                        <div className={`flex items-center gap-1.5 ${passwordAnalysis.hasLowercase ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                          <span className={`material-symbols-outlined text-base ${passwordAnalysis.hasLowercase ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {passwordAnalysis.hasLowercase ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Letra minúscula (a-z)</span>
                        </div>

                        <div className={`flex items-center gap-1.5 ${passwordAnalysis.hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                          <span className={`material-symbols-outlined text-base ${passwordAnalysis.hasNumber ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {passwordAnalysis.hasNumber ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Número (0-9)</span>
                        </div>

                        <div className={`flex items-center gap-1.5 ${passwordAnalysis.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-500'} sm:col-span-2`}>
                          <span className={`material-symbols-outlined text-base ${passwordAnalysis.hasSpecial ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {passwordAnalysis.hasSpecial ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span>Caractere especial (!@#$%*...)</span>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* Confirmação de Senha */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirmar Senha *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Repita sua senha exatamente igual"
                        value={confirmarSenha}
                        onChange={(e) => setConfirmarSenha(e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003400] focus:border-transparent transition-all pr-12 ${
                          confirmarSenha 
                            ? (senha === confirmarSenha ? 'border-emerald-300 bg-emerald-50/20' : 'border-rose-300 bg-rose-50/20') 
                            : 'border-slate-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {showConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>

                    {confirmarSenha && (
                      <span className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
                        senha === confirmarSenha ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        <span className="material-symbols-outlined text-sm">
                          {senha === confirmarSenha ? 'check' : 'close'}
                        </span>
                        <span>{senha === confirmarSenha ? 'As senhas coincidem perfeitamente' : 'As senhas não coincidem'}</span>
                      </span>
                    )}
                  </div>

                  {/* Botões de Ação */}
                  <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setCurrentStep('dados');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full sm:w-auto py-3.5 px-6 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm transition-all cursor-pointer"
                    >
                      ← Voltar para Dados
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex-1 inline-flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] font-black text-sm sm:text-base shadow-lg shadow-[#FDB116]/25 transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Gerando Pagamento...</span>
                        </>
                      ) : (
                        <>
                          <span>Continuar para Pagamento • R$ 1,00 (Modo Teste)</span>
                          <span className="material-symbols-outlined text-xl">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className="text-[11px] text-center text-slate-500 font-medium">
                    🧪 <strong>Modo Teste Ativo:</strong> Cobrança via PIX configurada em R$ 1,00 para validação imediata (Valor oficial R$ 197,00/ano).
                  </span>

                </form>
              </div>
            )}

            {/* PASSO 2: PAGAMENTO VIA PIX */}
            {currentStep === 'pagamento' && (
              <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-xl transition-all text-center flex flex-col items-center">
                
                <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#006c49] text-xl">qr_code_2</span>
                    <h3 className="font-bold text-sm sm:text-base text-[#0b1c30]">Pagamento via PIX Instantâneo</h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">timer</span>
                    <span>{formatTime(timeLeft)} (5 min)</span>
                  </div>
                </div>

                {gerandoPix ? (
                  <div className="py-12 flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-[#003400] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-bold text-slate-700">Gerando QR Code PIX com Mercado Pago...</span>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center gap-5">
                    
                    {/* QR Code Container */}
                    <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col items-center justify-center min-w-[224px] min-h-[224px]">
                      {(() => {
                        const base64Src = pixResult?.qrCodeBase64
                          ? (pixResult.qrCodeBase64.startsWith('data:')
                              ? pixResult.qrCodeBase64
                              : `data:image/png;base64,${pixResult.qrCodeBase64}`)
                          : null;
                        const fallbackUrl = pixResult?.qrCode
                          ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixResult.qrCode)}`
                          : (pixResult?.fallbackQrUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=hotelnozap%40gmail.com');

                        return (
                          <img 
                            src={base64Src || fallbackUrl} 
                            alt="QR Code PIX Mercado Pago" 
                            className="w-56 h-56 object-contain"
                            onError={(e) => {
                              // Se a imagem falhar, carrega imediatamente o fallback da URL do gerador
                              if (e.currentTarget.src !== fallbackUrl) {
                                e.currentTarget.src = fallbackUrl;
                              }
                            }}
                          />
                        );
                      })()}
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-slate-500 font-medium">Abra o app do seu banco e escaneie o código acima, ou use o Pix Copia e Cola:</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-[#003400]">R$ 1,00</span>
                        <span className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          🧪 Valor de Teste (Oficial: R$ 197,00)
                        </span>
                      </div>
                    </div>

                    {/* Copia e Cola Box */}
                    <div className="w-full flex flex-col gap-2">
                      <div className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono break-all line-clamp-2 select-all text-left">
                        {pixResult?.qrCode || 'hotelnozap@gmail.com'}
                      </div>
                      <button
                        onClick={handleCopiarPix}
                        className="w-full py-3.5 px-6 rounded-xl bg-[#003400] text-white hover:bg-[#004d00] font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {copiadoPix ? 'check_circle' : 'content_copy'}
                        </span>
                        <span>{copiadoPix ? 'Código Pix Copiado com Sucesso!' : 'Copiar Código Pix (Copia e Cola)'}</span>
                      </button>
                    </div>

                    {/* Status de Verificação Automática */}
                    <div className="mt-3 p-3.5 w-full rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2.5 text-xs text-emerald-800 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>Aguardando pagamento... A liberação ocorre automaticamente em segundos.</span>
                    </div>

                    {/* Feedback Visual da Consulta Manual */}
                    {msgVerificacao && (
                      <div className={`mt-3 p-3.5 w-full rounded-xl border text-xs font-semibold flex items-start gap-2.5 text-left transition-all ${
                        msgVerificacao.tipo === 'sucesso'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : msgVerificacao.tipo === 'erro'
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}>
                        <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
                          {msgVerificacao.tipo === 'sucesso' ? 'check_circle' : msgVerificacao.tipo === 'erro' ? 'error' : 'hourglass_top'}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold">
                            {msgVerificacao.tipo === 'sucesso' ? 'Pagamento Aprovado!' : msgVerificacao.tipo === 'erro' ? 'Atenção' : 'Aguardando Compensação'}
                          </p>
                          <p className="text-[11px] mt-0.5 leading-relaxed">{msgVerificacao.texto}</p>
                        </div>
                      </div>
                    )}

                    {/* Botão de Verificação Manual com Validação Estrita */}
                    <button
                      type="button"
                      onClick={handleVerificarPagamentoManual}
                      disabled={isVerificando}
                      className="mt-3 inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-[#006c49] transition-colors underline cursor-pointer disabled:opacity-60"
                    >
                      {isVerificando ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#006c49] border-t-transparent rounded-full animate-spin" />
                          <span>Consultando confirmação no Mercado Pago...</span>
                        </>
                      ) : (
                        <span>Já efetuei o pagamento e quero consultar confirmação agora</span>
                      )}
                    </button>

                  </div>
                )}

              </div>
            )}

            {/* PASSO 3: SUCESSO E ACESSO LIBERADO */}
            {currentStep === 'sucesso' && (
              <div className="rounded-3xl bg-white p-6 sm:p-10 border border-emerald-200 shadow-2xl transition-all text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/20">
                  <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>

                <div className="flex flex-col gap-1 max-w-lg">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#006c49]">Parabéns, Franqueado Oficial!</span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#0b1c30]">
                    Pagamento Confirmado &amp; Acesso Liberado!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Sua licença regional do Hotel no Zap está ativa. Você já pode divulgar seu link exclusivo e começar a cadastrar hotéis.
                  </p>
                </div>

                {/* Box do Link Exclusivo do Parceiro */}
                <div className="w-full bg-[#eff4ff] p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col gap-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#003400] flex items-center gap-1.5 uppercase tracking-wide">
                      <span className="material-symbols-outlined text-base">link</span>
                      Seu Link de Indicação Exclusivo
                    </span>
                    <span className="text-[10px] font-bold bg-[#003400] text-[#FDB116] px-2 py-0.5 rounded-full">
                      CÓDIGO: {partnerCode}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-300 text-xs font-mono text-slate-700 break-all select-all">
                    {partnerLink || `https://hotelnozap.com.br/parceiros/assinar?ref=${partnerCode}`}
                  </div>

                  <button
                    onClick={handleCopiarLink}
                    className="w-full py-3 px-4 rounded-xl bg-[#006c49] text-white hover:bg-[#005236] font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiadoLink ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiadoLink ? 'Link Copiado!' : 'Copiar Link de Divulgação'}</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    💡 Qualquer hotel que contratar através deste link será vinculado à sua conta com 50% de comissão recorrente vitalícia.
                  </span>
                </div>

                {/* Resumo de Acesso */}
                <div className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                  <div>
                    <span className="font-bold text-slate-800">Login Cadastrado:</span> {email}
                  </div>
                  <div className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Status: Ativo &amp; Homologado
                  </div>
                </div>

                {/* Botão de Acesso ao Painel */}
                <div className="w-full pt-2">
                  <button
                    onClick={() => {
                      if (onNavigateToDashboard) {
                        onNavigateToDashboard();
                      } else if (onNavigateToLogin) {
                        onNavigateToLogin();
                      } else {
                        window.location.href = 'https://app.hotelnozap.com.br/';
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-3 py-4 px-8 rounded-xl bg-[#FDB116] text-[#1b1b1b] hover:bg-[#e09c0f] font-black text-base shadow-xl shadow-[#FDB116]/25 transition-all duration-200 active:scale-95 cursor-pointer"
                  >
                    <span>Entrar no Meu Painel de Parceiro Agora</span>
                    <span className="material-symbols-outlined text-2xl">arrow_forward</span>
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* ========================================================================= */}
          {/* COLUNA DIREITA: RESUMO DO PEDIDO & BENEFÍCIOS (5 colunas)                 */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24">
            
            {/* Card Resumo do Pedido */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-200/90 shadow-xl flex flex-col gap-6 text-left">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Resumo da Assinatura</span>
                <span className="text-[11px] font-extrabold text-[#006c49] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  Franquia Oficial
                </span>
              </div>

              {/* Informação do Plano */}
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-[#0b1c30]">Licença Anual de Franqueado</h3>
                <p className="text-xs text-slate-500">Direito oficial de distribuição e revenda na sua região.</p>
                
                <div className="flex items-baseline gap-2 mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500">Valor Oficial:</span>
                  <span className="text-3xl font-black text-[#003400]">R$ 197,00</span>
                  <span className="text-xs text-slate-500 font-semibold">/ ano</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-bold mt-0.5">
                  ✓ Pagamento anual único (sem mensalidades fixas)
                </span>

                {/* Box de Notificação do Modo Teste */}
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">science</span>
                  <div className="leading-tight">
                    <strong className="block text-amber-950 mb-0.5">Cobrança de Teste Ativa: R$ 1,00</strong>
                    O PIX será emitido no valor simbólico de <strong>R$ 1,00</strong> para que você possa efetuar o pagamento e testar a liberação imediata.
                  </div>
                </div>
              </div>

              {/* Lista dos Benefícios Inclusos */}
              <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700">Tudo o que está incluso:</span>
                
                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[#006c49] text-base shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Páginas demonstrativas</strong> completas para apresentar aos hotéis</span>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[#006c49] text-base shrink-0 mt-0.5">check_circle</span>
                  <span><strong>Página de indicação exclusiva</strong> com seu código oficial</span>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[#006c49] text-base shrink-0 mt-0.5">check_circle</span>
                  <span><strong>100% Livre de royalties</strong>: sua comissão é líquida para você</span>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[#006c49] text-base shrink-0 mt-0.5">check_circle</span>
                  <span><strong>50% de comissão recorrente</strong> em todas as mensalidades</span>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <span className="material-symbols-outlined text-[#006c49] text-base shrink-0 mt-0.5">check_circle</span>
                  <span>Suporte e infraestrutura técnica 100% pela matriz</span>
                </div>
              </div>

              {/* Selos de Confiança */}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
                  <span>Garantia incondicional de 7 dias</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">support_agent</span>
                  <span>Suporte humanizado direto com o time da matriz</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </main>

      {/* ========================================================================= */}
      {/* 3. FOOTER DISCRETO                                                        */}
      {/* ========================================================================= */}
      <footer className="w-full py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Hotel no Zap © {new Date().getFullYear()} • Todos os direitos reservados.</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="material-symbols-outlined text-sm">security</span>
            Transação protegida por criptografia de ponta a ponta
          </span>
        </div>
      </footer>

    </div>
  );
};
