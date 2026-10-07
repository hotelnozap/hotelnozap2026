import React, { useState, useEffect, useRef, useMemo } from 'react';
import { maskCnpj, maskPhone, maskCep, maskCpf, isValidCpf, isValidCnpj, getCpfValidationStatus, getCnpjValidationStatus } from '../utils/masks';
import { fetchAddressByCep } from '../utils/viacep';
import { hoteisService, planosService, usuariosService, parceirosService, categoriasHoteisService, CategoriaHotelData } from '../services/supabaseService';
import { supabase } from '../lib/supabase';
import { getAppLoginUrl } from '../utils/partnerUrl';
import { generateUniqueHotelUrl, formatHotelUrl, isHotelUrlAvailable, checkHotelUrlAvailabilityInSupabase } from '../utils/hotelUrl';
import { CheckoutPlanoStep } from './CheckoutPlanoStep';
import { generateMockHotelData, findPlanoTesteName } from '../utils/mockHotelData';
import { useHotelSecurityCheck, SecurityFieldBadge } from '../hooks/useHotelSecurityCheck';

interface LpAssinarProps {
  onNavigateToLP?: () => void;
  onNavigateToLogin?: () => void;
}

const STEPS = [
  { id: 1, icon: 'storefront',   label: 'Dados do Hotel' },
  { id: 2, icon: 'stars',        label: 'Plano'          },
  { id: 3, icon: 'location_on',  label: 'Endereco'       },
  { id: 4, icon: 'person',       label: 'Responsavel'    },
  { id: 5, icon: 'lock',         label: 'Acesso'         },
  { id: 6, icon: 'payments',     label: 'Pagamento & Ativação' },
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const LpAssinar: React.FC<LpAssinarProps> = ({ onNavigateToLP, onNavigateToLogin }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasAttemptedNext, setHasAttemptedNext] = useState(false);
  const [createdHotelId, setCreatedHotelId] = useState('');
  const topRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Planos
  const [planos, setPlanos] = useState<any[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  useEffect(() => {
    planosService.getPlanos().then(data => {
      const active = (data || []).filter((p: any) =>
        p.status !== 'Inativo' &&
        !p.name?.toLowerCase().includes('maps') &&
        !p.name?.toLowerCase().includes('legado') &&
        Number(p.basePrice) > 0
      ).sort((a: any, b: any) => {
        const ordA = Number(String(a.order || a.ordem || '').replace(/\D/g, '')) || 0;
        const ordB = Number(String(b.order || b.ordem || '').replace(/\D/g, '')) || 0;
        return ordA - ordB;
      });
      setPlanos(active);
      setLoadingPlanos(false);

      // Pré-selecionar plano se vier na URL (?plano=...) ou o padrão em destaque
      try {
        const params = new URLSearchParams(window.location.search);
        let urlPlan = params.get('plano') || params.get('plan');
        if (!urlPlan && window.location.hash && window.location.hash.includes('?')) {
          const hParams = new URLSearchParams(window.location.hash.split('?')[1]);
          urlPlan = hParams.get('plano') || hParams.get('plan');
        }

        if (urlPlan) {
          const cleanSearch = urlPlan.trim().toLowerCase();
          const match = active.find((p: any) => 
            p.name.toLowerCase().includes(cleanSearch) || 
            cleanSearch.includes(p.name.toLowerCase())
          );
          if (match) {
            setPlanoSelecionado(match.name);
            return;
          }
        }
        
        // Se nenhum na URL, seleciona o plano em destaque ou o primeiro
        const featured = active.find((p: any) => p.isFeatured) || active[0];
        if (featured) {
          setPlanoSelecionado(featured.name);
        }
      } catch { /* ignore */ }
    }).catch(() => setLoadingPlanos(false));
  }, []);

  // Lista de hotéis para garantia de unicidade de URL
  const [existingHoteis, setExistingHoteis] = useState<any[]>([]);
  useEffect(() => {
    hoteisService.getHoteis().then(data => {
      if (Array.isArray(data)) setExistingHoteis(data);
    }).catch(() => {});
  }, []);

  // Categorias de Hotéis dinâmicas (banco + fallback local instantâneo)
  const [categoriasList, setCategoriasList] = useState<CategoriaHotelData[]>(() =>
    categoriasHoteisService.getLocalCategorias().filter(c => c.status === 'ativo')
  );
  useEffect(() => {
    let isMounted = true;
    categoriasHoteisService.getCategorias().then(data => {
      if (isMounted && Array.isArray(data) && data.length > 0) {
        setCategoriasList(data.filter(c => c.status === 'ativo'));
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Step 1: dados do hotel
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [categoria, setCategoria] = useState(() => {
    const list = categoriasHoteisService.getLocalCategorias().filter(c => c.status === 'ativo');
    return list[0]?.name || 'Pousada';
  });
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [urlHotel, setUrlHotel] = useState('');
  const [isUrlManuallyEdited, setIsUrlManuallyEdited] = useState(false);
  const [isUrlAvailable, setIsUrlAvailable] = useState<boolean | null>(null);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);


  const handleUrlChange = async (val: string) => {
    setIsUrlManuallyEdited(true);
    setUrlHotel(val);
    if (!val.trim()) {
      setIsUrlAvailable(null);
      return;
    }
    setIsCheckingUrl(true);
    const localAvail = isHotelUrlAvailable(val, existingHoteis);
    if (localAvail) {
      const dbAvail = await checkHotelUrlAvailabilityInSupabase(val);
      setIsUrlAvailable(dbAvail);
    } else {
      setIsUrlAvailable(false);
    }
    setIsCheckingUrl(false);
  };

  const handleRegenerateUrl = () => {
    setIsUrlManuallyEdited(false);
    if (nomeFantasia.trim()) {
      const generated = generateUniqueHotelUrl(nomeFantasia, existingHoteis);
      setUrlHotel(generated);
      setIsUrlAvailable(true);
    }
  };

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const cnpjValidation = useMemo(() => getCnpjValidationStatus(cnpj), [cnpj]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Step 2: plano
  const [planoSelecionado, setPlanoSelecionado] = useState('');
  const selectedPlanoObj = useMemo(() => {
    return planos.find(p => p.name === planoSelecionado) || null;
  }, [planos, planoSelecionado]);

  // Step 3: endereco
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('PE');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const handleCepChange = async (v: string) => {
    const masked = maskCep(v);
    setCep(masked);
    setCepError(null);
    if (masked.replace(/\D/g,'').length === 8) {
      setIsLoadingCep(true);
      const data = await fetchAddressByCep(masked.replace(/\D/g,''));
      setIsLoadingCep(false);
      if (data && !data.erro) {
        if (data.logradouro) setLogradouro(data.logradouro);
        if (data.bairro) setBairro(data.bairro);
        if (data.localidade) setCidade(data.localidade);
        if (data.uf) setUf(data.uf.toUpperCase());
      } else {
        setCepError('CEP nao encontrado. Preencha o endereco manualmente.');
      }
    }
  };

  // Step 4: responsavel
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [cpfResponsavel, setCpfResponsavel] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');
  const [whatsappResponsavel, setWhatsappResponsavel] = useState('');
  const [cargoResponsavel, setCargoResponsavel] = useState('Proprietario');
  const cpfValidation = useMemo(() => getCpfValidationStatus(cpfResponsavel), [cpfResponsavel]);

  // Step 5: acesso
  const [loginEmail, setLoginEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [aceitaTermos, setAceitaTermos] = useState(false);
  // Ler ref da URL (suporta ?ref=, ?cupom=, ?coupon= e parâmetros via hash)
  const refCode = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const val = params.get('ref') || params.get('cupom') || params.get('coupon');
      if (val) return val.trim().toUpperCase();

      if (window.location.hash && window.location.hash.includes('?')) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const hVal = hashParams.get('ref') || hashParams.get('cupom') || hashParams.get('coupon');
        if (hVal) return hVal.trim().toUpperCase();
      }
      return 'HOTELNOZAP';
    } catch {
      return 'HOTELNOZAP';
    }
  }, []);

  const [partnerInfo, setPartnerInfo] = useState<{ name: string; coupon: string } | null>(null);

  useEffect(() => {
    if (!refCode || refCode === 'HOTELNOZAP') return;
    parceirosService.getParceiros().then(partners => {
      const found = (partners || []).find(p => 
        (p.coupon || '').trim().toUpperCase() === refCode.toUpperCase() ||
        (p.name || '').trim().toUpperCase() === refCode.toUpperCase() ||
        String(p.id) === refCode
      );
      if (found) {
        setPartnerInfo({ name: found.name, coupon: found.coupon || refCode });
      }
    }).catch(() => {});
  }, [refCode]);

  const partnerLabel = useMemo(() => {
    if (!refCode || refCode === 'HOTELNOZAP') {
      return 'HOTELNOZAP — Hotel no Zap (Padrão)';
    }
    if (partnerInfo?.name) {
      return `${partnerInfo.name} (${refCode}) — Parceiro Indicador`;
    }
    return `${refCode} — Parceiro Indicador`;
  }, [refCode, partnerInfo]);

  // Modo de Teste Rápido (disparado ao digitar hotel01)
  const [testNotice, setTestNotice] = useState<string | null>(null);

  const applyTestMockData = () => {
    const mock = generateMockHotelData();
    setNomeFantasia(mock.nomeFantasia);
    setRazaoSocial(mock.razaoSocial);
    setCnpj(mock.cnpj);
    if (categoriasList.length > 0) {
      setCategoria(categoriasList[0].name);
    }
    setTelefone(mock.telefone);
    setWhatsapp(mock.whatsapp);
    setInstagram(mock.instagram);
    setFacebook(mock.facebook);
    setTiktok(mock.tiktok);

    const generated = generateUniqueHotelUrl(mock.nomeFantasia, existingHoteis);
    setUrlHotel(generated);
    setIsUrlAvailable(true);

    // Selecionar Plano Teste R$ 1,00
    const testPlan = findPlanoTesteName(planos);
    setPlanoSelecionado(testPlan);

    // Endereço
    setCep(mock.cep);
    setLogradouro(mock.logradouro);
    setNumero(mock.numero);
    setComplemento(mock.complemento);
    setBairro(mock.bairro);
    setCidade(mock.cidade);
    setUf(mock.uf);

    // Responsável
    setNomeResponsavel(mock.nomeResponsavel);
    setCpfResponsavel(mock.cpfResponsavel);
    setEmailResponsavel(mock.emailResponsavel);
    setWhatsappResponsavel(mock.whatsappResponsavel);
    setCargoResponsavel(mock.cargoResponsavel);

    // Acesso
    setLoginEmail(mock.loginEmail);
    setSenha(mock.senha);
    setConfirmSenha(mock.confirmSenha);
    setAceitaTermos(true);
    setErrorMsg('');

    setTestNotice(`Todos os campos foram preenchidos com CNPJ válido (${mock.cnpj}), CPF válido (${mock.cpfResponsavel}), login (${mock.loginEmail}) e o "${testPlan}" (R$ 1,00) foi selecionado.`);
  };

  useEffect(() => {
    if (testNotice && planos.length > 0) {
      const pTeste = findPlanoTesteName(planos);
      if (pTeste && planoSelecionado !== pTeste) {
        setPlanoSelecionado(pTeste);
      }
    }
  }, [testNotice, planos, planoSelecionado]);

  const handleNomeFantasiaChange = (val: string) => {
    if (val.trim().toLowerCase() === 'hotel01') {
      applyTestMockData();
      return;
    }
    setNomeFantasia(val);
    if (!isUrlManuallyEdited) {
      if (val.trim()) {
        const generated = generateUniqueHotelUrl(val, existingHoteis);
        setUrlHotel(generated);
        setIsUrlAvailable(true);
      } else {
        setUrlHotel('');
        setIsUrlAvailable(null);
      }
    }
  };

  const handleRazaoSocialChange = (val: string) => {
    if (val.trim().toLowerCase() === 'hotel01') {
      applyTestMockData();
      return;
    }
    setRazaoSocial(val);
  };

  const handleCnpjChange = (val: string) => {
    if (val.trim().toLowerCase() === 'hotel01') {
      applyTestMockData();
      return;
    }
    setCnpj(maskCnpj(val));
  };

  // Regra de Segurança: Verificação em tempo real de CNPJ, CPF e E-mail de Acesso
  const {
    cnpjCheck,
    cpfCheck,
    emailCheck,
    validateFinalStep
  } = useHotelSecurityCheck({
    cnpj,
    cpf: cpfResponsavel,
    email: loginEmail
  });

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setErrorMsg('');
    setHasAttemptedNext(false);
  }, [step]);

  const validateStep = (targetStep: number = step): string | null => {
    if (targetStep === 1) {
      if (!nomeFantasia.trim() || nomeFantasia.trim().length < 2) {
        return 'Informe o Nome Fantasia do hotel (mínimo 2 caracteres).';
      }
      if (!cnpj.trim() || !isValidCnpj(cnpj)) {
        return 'Informe um CNPJ válido e completo para o hotel.';
      }
      if (cnpjCheck.exists) {
        return cnpjCheck.message || 'O CNPJ informado já está cadastrado no sistema.';
      }
      if (!categoria.trim()) {
        return 'Selecione a categoria do hotel.';
      }
      if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10) {
        return 'Informe o WhatsApp do hotel com DDD (mínimo 10 dígitos).';
      }
      if (!urlHotel.trim()) {
        return 'A URL personalizada do hotel é obrigatória.';
      }
      if (!urlHotel.startsWith('https://hotelnozap.com.br/hoteis/') || urlHotel.trim().length <= 'https://hotelnozap.com.br/hoteis/'.length) {
        return 'A URL do hotel deve seguir o padrão: https://hotelnozap.com.br/hoteis/nomedohotel';
      }
      if (isCheckingUrl) {
        return 'Aguarde a verificação de disponibilidade da URL do hotel.';
      }
      if (isUrlAvailable === false) {
        return 'A URL informada já pertence a outro hotel. Altere-a ou clique em Auto para gerar uma URL única.';
      }
    }
    if (targetStep === 2) {
      if (!planoSelecionado) {
        return 'Selecione um plano de assinatura para continuar para a próxima etapa.';
      }
    }
    if (targetStep === 3) {
      if (!cep.trim() || cep.replace(/\D/g, '').length < 8) {
        return 'Informe um CEP válido com 8 dígitos.';
      }
      if (!logradouro.trim()) {
        return 'Informe o logradouro (Rua, Avenida, etc.).';
      }
      if (!numero.trim()) {
        return 'Informe o número do endereço (ou S/N).';
      }
      if (!bairro.trim()) {
        return 'Informe o bairro do endereço.';
      }
      if (!cidade.trim()) {
        return 'Informe a cidade.';
      }
      if (!uf.trim()) {
        return 'Selecione o estado (UF).';
      }
    }
    if (targetStep === 4) {
      if (!nomeResponsavel.trim() || nomeResponsavel.trim().length < 3) {
        return 'Informe o nome completo do responsável.';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailResponsavel.trim() || !emailRegex.test(emailResponsavel.trim())) {
        return 'Informe um e-mail válido para o responsável.';
      }
      if (!whatsappResponsavel.trim() || whatsappResponsavel.replace(/\D/g, '').length < 10) {
        return 'Informe o WhatsApp do responsável com DDD (mínimo 10 dígitos).';
      }
      if (cpfResponsavel.trim() && !isValidCpf(cpfResponsavel)) {
        return 'O CPF informado para o responsável é inválido.';
      }
      if (cpfCheck.exists) {
        return cpfCheck.message || 'O CPF informado já está cadastrado no sistema.';
      }
    }
    if (targetStep === 5) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!loginEmail.trim() || !emailRegex.test(loginEmail.trim())) {
        return 'Informe um e-mail de acesso válido para login.';
      }
      if (emailCheck.exists) {
        return emailCheck.message || 'O e-mail de acesso informado já está cadastrado no sistema.';
      }
      if (cnpjCheck.exists) {
        return cnpjCheck.message || 'O CNPJ informado já está cadastrado no sistema.';
      }
      if (cpfCheck.exists) {
        return cpfCheck.message || 'O CPF informado já está cadastrado no sistema.';
      }
      if (!senha || senha.length < 6) {
        return 'A senha de acesso deve ter no mínimo 6 caracteres.';
      }
      if (!confirmSenha) {
        return 'Confirme a senha de acesso.';
      }
      if (senha !== confirmSenha) {
        return 'As senhas não coincidem.';
      }
      if (!aceitaTermos) {
        return 'Você deve aceitar os Termos de Uso e a Política de Privacidade para continuar.';
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      setErrorMsg(err);
      setHasAttemptedNext(true);
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setHasAttemptedNext(false);
    setErrorMsg('');
    setStep(s => s + 1);
  };

  const goToPainelAdmin = () => {
    window.location.href = 'https://app.hotelnozap.com.br';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    // Validação de segurança final rigorosa (bloqueio de duplicidade de CNPJ, CPF e E-mail de Acesso)
    const secResult = await validateFinalStep();
    if (!secResult.allowed) {
      setErrorMsg(secResult.error || 'Não é permitido cadastrar hotel com dados já existentes no sistema.');
      setIsSubmitting(false);
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    let hotelCriadoId: string | null = null;
    try {
      const cityUf = cidade && uf ? cidade + ' / ' + uf : cidade || '';
      const calculatedCapacity = (selectedPlanoObj?.roomLimit !== undefined && selectedPlanoObj?.roomLimit !== null)
        ? Number(selectedPlanoObj.roomLimit)
        : 0;

      const finalUrl = urlHotel.trim() || generateUniqueHotelUrl(nomeFantasia.trim(), existingHoteis);

      const hotelRes = await hoteisService.createHotel({
        name: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim() || nomeFantasia.trim(),
        cnpj: cnpj.trim(),
        category: categoria,
        capacity: calculatedCapacity,
        whatsappInstances: 0,
        managerPhone: whatsapp.trim(),
        whatsapp: whatsapp.replace(/\D/g,''),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        tiktok: tiktok.trim(),
        link: finalUrl,
        plan: planoSelecionado,
        cep: cep.trim(),
        street: [logradouro.trim(), numero.trim(), complemento.trim()].filter(Boolean).join(', '),
        neighborhood: bairro.trim(),
        cityUf,
        city: cidade.trim(),
        uf: uf.toUpperCase(),
        managerName: nomeResponsavel.trim(),
        managerCpf: cpfResponsavel.trim(),
        managerEmail: emailResponsavel.trim(),
        managerRole: cargoResponsavel,
        loginEmail: loginEmail.trim(),
        status: 'prospecto',
        partnerRef: refCode,
        notes: 'Cadastro via link de parceiro (/parceiros/assinar?ref=' + refCode + ') em ' + new Date().toLocaleDateString('pt-BR') + '. Parceiro: ' + refCode,
      } as any);

      if (!hotelRes.success) {
        setErrorMsg(
          'Não foi possível concluir o cadastro do hotel. ' +
          (hotelRes.error || 'Tente novamente ou entre em contato via WhatsApp.')
        );
        return;
      }
      hotelCriadoId = hotelRes.id;
      setCreatedHotelId(hotelRes.id || '');

      // 2. Criar o Usuário do Hotel na tabela `usuarios` e registrar no Supabase Auth com a senha real.
      //    adminMode = false: deixa o novo usuário logado automaticamente (é signup público via link parceiro).
      if (loginEmail.trim()) {
        const userRes = await usuariosService.createUsuario({
          name: nomeResponsavel.trim() || nomeFantasia.trim(),
          email: loginEmail.trim().toLowerCase(),
          cargo: cargoResponsavel || 'Proprietário',
          perfil: 'Hotel',
          phone: whatsappResponsavel.replace(/\D/g, '') || whatsapp.replace(/\D/g, ''),
          status: 'ativo',
          lastAccess: 'Nunca acessou',
          initials: (nomeResponsavel.trim() || nomeFantasia.trim() || 'HT')
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase(),
          cep: cep.trim(),
          street: [logradouro.trim(), numero.trim(), complemento.trim()].filter(Boolean).join(', '),
          neighborhood: bairro.trim(),
          city: cidade.trim(),
          uf: uf.toUpperCase(),
          hotel_id: hotelCriadoId || undefined
        } as any, senha, { adminMode: false });

        if (!userRes.success) {
          // ROLLBACK: hotel foi criado mas usuário/Auth falhou → apaga hotel órfão
          console.error('Usuário/Auth falhou (link parceiro). Realizando rollback do hotel id=', hotelCriadoId);
          if (hotelCriadoId) {
            try { await hoteisService.deleteHotel(hotelCriadoId); } catch (rb) { console.warn('Rollback do hotel falhou:', rb); }
          }
          try {
            const { data: s } = await supabase.auth.getSession();
            if (s?.session?.user?.email?.toLowerCase() === loginEmail.trim().toLowerCase()) {
              await supabase.auth.signOut({ scope: 'local' });
            }
          } catch { /* ignore */ }
          setErrorMsg(
            'Cadastro parcialmente concluído, mas a criação da conta de acesso falhou. ' +
            'Seu registro de hotel foi desfeito automaticamente para evitar duplicidade. Motivo: ' +
            (userRes.error || 'Tente novamente.')
          );
          return;
        }
      } else {
        setStep(6);
        return;
      }

      setStep(6);
    } catch (err: any) {
      if (hotelCriadoId) {
        try { await hoteisService.deleteHotel(hotelCriadoId); } catch (rb) { console.warn('Rollback de último recurso falhou:', rb); }
      }
      setErrorMsg('Erro ao enviar cadastro. Tente novamente ou entre em contato via WhatsApp. Detalhe: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;
  const iCls = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-white transition-colors placeholder-gray-400';
  const lCls = 'block text-xs font-semibold text-gray-700 mb-1';

  // Validações visuais reativas para campos obrigatórios
  const isNomeFantasiaInvalid = hasAttemptedNext && (!nomeFantasia.trim() || nomeFantasia.trim().length < 2);
  const isCnpjInvalid = hasAttemptedNext && (!cnpj.trim() || !isValidCnpj(cnpj));
  const isCategoriaInvalid = hasAttemptedNext && !categoria.trim();
  const isWhatsappInvalid = hasAttemptedNext && (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 10);
  const isUrlInvalid = hasAttemptedNext && (
    !urlHotel.trim() ||
    !urlHotel.startsWith('https://hotelnozap.com.br/hoteis/') ||
    urlHotel.trim().length <= 'https://hotelnozap.com.br/hoteis/'.length ||
    isUrlAvailable === false
  );

  const isPlanoInvalid = hasAttemptedNext && !planoSelecionado;

  const isCepInvalid = hasAttemptedNext && (!cep.trim() || cep.replace(/\D/g, '').length < 8);
  const isLogradouroInvalid = hasAttemptedNext && !logradouro.trim();
  const isNumeroInvalid = hasAttemptedNext && !numero.trim();
  const isBairroInvalid = hasAttemptedNext && !bairro.trim();
  const isCidadeInvalid = hasAttemptedNext && !cidade.trim();
  const isUfInvalid = hasAttemptedNext && !uf.trim();

  const isNomeRespInvalid = hasAttemptedNext && (!nomeResponsavel.trim() || nomeResponsavel.trim().length < 3);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailRespInvalid = hasAttemptedNext && (!emailResponsavel.trim() || !emailRegex.test(emailResponsavel.trim()));
  const isWhatsappRespInvalid = hasAttemptedNext && (!whatsappResponsavel.trim() || whatsappResponsavel.replace(/\D/g, '').length < 10);
  const isCpfRespInvalid = hasAttemptedNext && cpfResponsavel.trim() !== '' && !isValidCpf(cpfResponsavel);

  const isLoginEmailInvalid = hasAttemptedNext && (!loginEmail.trim() || !emailRegex.test(loginEmail.trim()));
  const isSenhaInvalid = hasAttemptedNext && (!senha || senha.length < 6);
  const isConfirmSenhaInvalid = hasAttemptedNext && (!confirmSenha || senha !== confirmSenha);
  const isTermosInvalid = hasAttemptedNext && !aceitaTermos;

  const getInputCls = (isInvalid: boolean) =>
    iCls + (isInvalid ? ' border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-red-400/30' : '');

  return (
    <div className="min-h-screen bg-gray-50 font-sans" ref={topRef}>
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Marca */}
          <a href="/" className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0" title="Ir para a página inicial">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#003400] group-hover:bg-emerald-700 flex items-center justify-center shadow-xs transition-colors">
              <span className="material-symbols-outlined text-white text-base sm:text-lg">hotel</span>
            </div>
            <div className="leading-tight text-left">
              <p className="text-gray-900 font-black text-xs sm:text-sm tracking-tight">Hotel no Zap</p>
              <p className="text-emerald-700 text-[9px] sm:text-[10px] font-bold">Sistema SaaS Hoteleiro</p>
            </div>
          </a>

          {/* Desktop Central Badges (SSL + Etapa + Ref) */}
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
            <span className="material-symbols-outlined text-emerald-600 text-sm">shield_lock</span>
            <span className="font-medium">Cadastro seguro SSL</span>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              Etapa {Math.min(step, 5)} de 5
            </span>
            {refCode && (
              <span className="ml-1 font-mono text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                ref={refCode}
              </span>
            )}
          </div>

          {/* Right Action: Mobile Step + Link de Login */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile Step Badge */}
            <span className="md:hidden inline-flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Etapa {Math.min(step, 5)}/5
            </span>

            {/* Já tenho conta */}
            <button 
              onClick={onNavigateToLogin} 
              className="text-[11px] sm:text-xs font-bold text-slate-600 hover:text-emerald-800 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Já tenho conta
            </button>
          </div>
        </div>

        {/* Mobile Sub-strip: SSL Seguro + Parceiro */}
        <div className="md:hidden bg-slate-50 border-t border-slate-100 px-3 py-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
          <div className="flex items-center gap-1 text-emerald-700 font-semibold">
            <span className="material-symbols-outlined text-xs text-emerald-600">verified_user</span>
            <span>Ambiente Seguro SSL</span>
          </div>
          {refCode ? (
            <div className="font-mono text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
              ref={refCode}
            </div>
          ) : (
            <span className="text-slate-400">Ativação Imediata</span>
          )}
        </div>
      </div>

      {/* HERO */}
      {step < 6 && (
        <div className="bg-white border-b border-gray-100 pt-8 pb-6 px-4 text-center">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-4 py-1.5 rounded-full mb-3">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Sem taxa de adesao - Ative em minutos
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-1">
            Cadastre seu hotel no <span className="text-emerald-600">Hotel no Zap</span>
          </h1>
                    <p className="text-gray-500 text-sm max-w-lg mx-auto">Motor de reservas via WhatsApp, gestao completa e automacoes para hoteis, pousadas e resorts.</p>
          {refCode && refCode !== 'HOTELNOZAP' && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium">
              <span className="material-symbols-outlined text-sm text-emerald-600">handshake</span>
              Indicado pelo parceiro: <strong className="font-bold">{refCode}</strong>
            </div>
          )}
        </div>
      )}

      {/* STEPPER */}
      {step < 6 && (
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
          <div className="h-1.5 bg-gray-200 rounded-full mb-5 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{width: progress + '%'}} />
          </div>
          <div className="flex items-start justify-between gap-1">
            {STEPS.slice(0,5).map(s => (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                <div className={[
                  'w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300',
                  step > s.id ? 'bg-emerald-500 border-emerald-500 text-white'
                  : step === s.id ? 'bg-[#003400] border-[#003400] text-white scale-110 shadow-md'
                  : 'bg-white border-gray-300 text-gray-400'
                ].join(' ')}>
                  {step > s.id
                    ? <span className="material-symbols-outlined text-sm">check</span>
                    : <span className="material-symbols-outlined text-sm">{s.icon}</span>}
                </div>
                <span className={'text-[9px] font-bold hidden sm:block ' + (step >= s.id ? 'text-gray-800' : 'text-gray-400')}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORM CARD */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div ref={formCardRef} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Card header */}
          {step < 6 && (
            <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3 bg-gray-50">
              <div className="w-9 h-9 rounded-xl bg-[#003400] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-white text-lg">{STEPS[step-1].icon}</span>
              </div>
              <div className="flex-1">
                <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest">Etapa {step} de 5</p>
                <h2 className="text-gray-900 font-black text-base">{STEPS[step-1].label}</h2>
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-700 text-sm">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1 - Dados do Hotel */}
          {step === 1 && (
            <div className="px-6 pt-5 pb-8 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-sm">Preencha todas as informações da sua propriedade hoteleira.</p>
              </div>

              {/* Logo */}
              <div>
                <label className={lCls}>Logo / Foto do Hotel (opcional)</label>
                <div onClick={() => logoInputRef.current?.click()} className="flex items-center gap-4 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
                  {logoPreview ? (
                    <img src={logoPreview} alt="preview" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
                      <span className="material-symbols-outlined text-gray-400 group-hover:text-emerald-600 text-2xl">add_photo_alternate</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{logoPreview ? 'Trocar logo' : 'Clique para adicionar logo / foto da capa'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">PNG, JPG ou WEBP - Max. 5 MB</p>
                  </div>
                  {logoPreview && (
                    <button type="button" onClick={e => { e.stopPropagation(); setLogoPreview(null); }} className="ml-auto text-gray-400 hover:text-red-500">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={lCls}>Nome Fantasia *</label>
                  <input type="text" value={nomeFantasia} onChange={e => handleNomeFantasiaChange(e.target.value)} placeholder="Ex: Pousada Recanto dos Corais" className={getInputCls(isNomeFantasiaInvalid)} />
                  {isNomeFantasiaInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Nome Fantasia é obrigatório (mínimo 2 caracteres)</p>}
                </div>
                <div>
                  <label className={lCls}>Razao Social</label>
                  <input type="text" value={razaoSocial} onChange={e => handleRazaoSocialChange(e.target.value)} placeholder="Ex: Recanto dos Corais Ltda" className={iCls} />
                </div>
                <div>
                  <label className={'flex items-center justify-between ' + lCls}>
                    <span>CNPJ *</span>
                    <SecurityFieldBadge
                      check={cnpjCheck}
                      isValidFormat={cnpjValidation.isValid}
                      validLabel="Válido"
                      emptyText={cnpjValidation.isComplete && !cnpjValidation.isValid ? 'CNPJ Inválido' : undefined}
                    />
                  </label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={e => handleCnpjChange(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                    className={
                      getInputCls(isCnpjInvalid || cnpjCheck.exists) +
                      ' font-mono ' +
                      (cnpjCheck.exists
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                        : cnpjCheck.checked && cnpjValidation.isValid
                        ? 'border-emerald-500 focus:border-emerald-500'
                        : '')
                    }
                  />
                  {cnpjCheck.exists ? (
                    <p className="text-[11px] text-red-600 mt-1 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>
                      {cnpjCheck.message || 'Este CNPJ já está cadastrado no sistema.'}
                    </p>
                  ) : isCnpjInvalid ? (
                    <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>Informe um CNPJ válido e completo
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className={lCls}>Categoria *</label>
                  <select value={categoria} onChange={e => setCategoria(e.target.value)} className={getInputCls(isCategoriaInvalid) + ' cursor-pointer'}>
                    {categoriasList.map(c => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                    {categoria && !categoriasList.some(c => c.name === categoria) && (
                      <option value={categoria}>{categoria}</option>
                    )}
                  </select>
                  {isCategoriaInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Selecione a categoria do hotel</p>}
                </div>
                <div>
                  <label className={lCls}>WhatsApp do Hotel *</label>
                  <input type="tel" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} placeholder="(81) 98765-4321" className={getInputCls(isWhatsappInvalid)} />
                  {isWhatsappInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>WhatsApp com DDD é obrigatório (mínimo 10 dígitos)</p>}
                </div>
                <div>
                  <label className={lCls}>Telefone Fixo</label>
                  <input type="tel" value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(81) 3322-1100" className={iCls} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={lCls + ' mb-0'}>URL *</label>
                    <div className="flex items-center gap-2">
                      {isCheckingUrl ? (
                        <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                          Verificando...
                        </span>
                      ) : isUrlAvailable === true ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs">verified</span>
                          URL disponível
                        </span>
                      ) : isUrlAvailable === false ? (
                        <span className="text-[11px] font-bold text-red-500 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-xs">cancel</span>
                          URL já em uso
                        </span>
                      ) : null}
                      {isUrlManuallyEdited && (
                        <button
                          type="button"
                          onClick={handleRegenerateUrl}
                          className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={urlHotel}
                    onChange={e => handleUrlChange(e.target.value)}
                    placeholder="https://hotelnozap.com.br/hoteis/nomedohotel"
                    className={getInputCls(isUrlInvalid) + ' font-mono text-xs ' + (isUrlAvailable === false ? 'border-red-400 focus:border-red-500' : isUrlAvailable === true ? 'border-emerald-400' : '')}
                  />
                  {isUrlInvalid ? (
                    <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>
                      {isUrlAvailable === false ? 'Esta URL já pertence a outro hotel. Altere-a ou clique em Auto.' : 'URL do hotel é obrigatória (https://hotelnozap.com.br/hoteis/nomedohotel)'}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Ex: https://hotelnozap.com.br/hoteis/nomedohotel
                    </p>
                  )}
                </div>
              </div>

              {/* Redes sociais */}
              <div>
                <label className={lCls}>Redes Sociais (opcional)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-pink-500"><span className="material-symbols-outlined text-base">photo_camera</span></span>
                    <input type="text" value={instagram} onChange={e => setInstagram(e.target.value.replace('@',''))} placeholder="@instagram" className={iCls + ' pl-10'} />
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-blue-600"><span className="material-symbols-outlined text-base">thumb_up</span></span>
                    <input type="text" value={facebook} onChange={e => setFacebook(e.target.value.replace('@',''))} placeholder="@facebook" className={iCls + ' pl-10'} />
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-700"><span className="material-symbols-outlined text-base">music_video</span></span>
                    <input type="text" value={tiktok} onChange={e => setTiktok(e.target.value.replace('@',''))} placeholder="@tiktok" className={iCls + ' pl-10'} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 - Plano */}
          {step === 2 && (
            <div className="px-6 pt-5 pb-8 space-y-4">
              <p className="text-gray-500 text-sm">Escolha o plano ideal para o tamanho e necessidade do seu hotel.</p>
              {isPlanoInvalid && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-sm shrink-0">error</span>
                  <span>Por favor, selecione um dos planos abaixo para continuar.</span>
                </div>
              )}
              {loadingPlanos ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Carregando planos...
                </div>
              ) : planos.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">Planos nao disponiveis no momento. Entre em contato.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {planos.map(p => {
                    const isSelected = planoSelecionado === p.name;
                    const tagText = p.tag && p.tag.trim() ? p.tag.replace(/^★\s*/, '').trim() : (p.isFeatured ? 'Mais Escolhido' : undefined);
                    const periodText = p.pricePeriodText || (p.periodicity ? `/${p.periodicity.toLowerCase()}` : '/mês');
                    const rooms = p.roomLimit || 15;
                    const wa = p.whatsappConnections || 1;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlanoSelecionado(p.name)}
                        className={`relative text-left p-6 rounded-3xl border-2 transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-lg ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
                        }`}
                      >
                        {tagText && (
                          <div className={`absolute top-0 right-0 font-black text-[10px] uppercase px-3.5 py-1 rounded-bl-2xl tracking-wider shadow-xs ${
                            p.isFeatured ? 'bg-[#FDB116] text-[#0b1c30]' : 'bg-[#006c49] text-white'
                          }`}>
                            ★ {tagText}
                          </div>
                        )}

                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2 pr-12">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                                {p.categoryLabel || 'Pousadas & Hotéis'}
                              </span>
                              <h3 className="font-black text-slate-900 text-lg mt-1">{p.name}</h3>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                              isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                            </div>
                          </div>

                          <p className="text-slate-600 text-xs mb-4 min-h-[36px] font-medium leading-relaxed">
                            {p.description || 'Solução completa para gestão hoteleira via WhatsApp com inteligência artificial.'}
                          </p>

                          <div className="mb-4 pb-4 border-b border-slate-100">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="font-black text-slate-900 text-2xl sm:text-3xl">
                                {Number(p.basePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">{periodText}</span>
                            </div>
                          </div>

                          <ul className="space-y-2 text-xs text-slate-700 font-medium mb-2">
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-emerald-600 font-bold shrink-0">check_circle</span>
                              <span>Capacidade para até {rooms} quartos</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-emerald-600 font-bold shrink-0">check_circle</span>
                              <span>{wa > 1 ? `${wa} Conexões de WhatsApp simultâneas` : '1 Conexão de WhatsApp oficial'}</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-emerald-600 font-bold shrink-0">check_circle</span>
                              <span>Atendimento WhatsApp por IA 24/7</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-emerald-600 font-bold shrink-0">check_circle</span>
                              <span>Sem cobranças extras por mensagens</span>
                            </li>
                          </ul>
                        </div>

                        <div className={`mt-4 w-full py-2.5 rounded-xl text-center text-xs font-bold transition-all ${
                          isSelected ? 'bg-[#003400] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                        }`}>
                          {isSelected ? '✓ Plano Selecionado' : 'Selecionar Plano'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 - Endereco */}
          {step === 3 && (
            <div className="px-6 pt-5 pb-8 space-y-4">
              <p className="text-gray-500 text-sm">Localizacao da sua propriedade - o CEP preenche automaticamente.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={lCls}>CEP *</label>
                  <div className="relative">
                    <input type="text" value={cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} className={getInputCls(isCepInvalid) + ' font-mono'} />
                    {isLoadingCep && <span className="absolute right-3 top-2.5 material-symbols-outlined animate-spin text-emerald-500 text-base">progress_activity</span>}
                  </div>
                  {isCepInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>CEP de 8 dígitos é obrigatório</p>}
                  {cepError && !isCepInvalid && <p className="text-[11px] text-amber-600 mt-1">{cepError}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className={lCls}>Logradouro (Rua / Av.) *</label>
                  <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} placeholder="Ex: Rua das Flores" className={getInputCls(isLogradouroInvalid)} />
                  {isLogradouroInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Logradouro é obrigatório</p>}
                </div>
                <div>
                  <label className={lCls}>Numero *</label>
                  <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" className={getInputCls(isNumeroInvalid)} />
                  {isNumeroInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Número é obrigatório (ou S/N)</p>}
                </div>
                <div>
                  <label className={lCls}>Complemento</label>
                  <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Sala, Bloco..." className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Bairro *</label>
                  <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro" className={getInputCls(isBairroInvalid)} />
                  {isBairroInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Bairro é obrigatório</p>}
                </div>
                <div className="md:col-span-2">
                  <label className={lCls}>Cidade *</label>
                  <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Maceio" className={getInputCls(isCidadeInvalid)} />
                  {isCidadeInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Cidade é obrigatória</p>}
                </div>
                <div>
                  <label className={lCls}>Estado *</label>
                  <select value={uf} onChange={e => setUf(e.target.value)} className={getInputCls(isUfInvalid) + ' cursor-pointer'}>
                    <option value="">Selecione...</option>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {isUfInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Selecione o estado</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 - Responsavel */}
          {step === 4 && (
            <div className="px-6 pt-5 pb-8 space-y-4">
              <p className="text-gray-500 text-sm">Dados do proprietario ou gestor responsavel pelo contrato.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={lCls}>Nome Completo *</label>
                  <input type="text" value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)} placeholder="Ex: Marcos Andrade" className={getInputCls(isNomeRespInvalid)} />
                  {isNomeRespInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Nome completo é obrigatório (mínimo 3 caracteres)</p>}
                </div>
                <div>
                  <label className={'flex items-center justify-between ' + lCls}>
                    <span>CPF (opcional)</span>
                    <SecurityFieldBadge
                      check={cpfCheck}
                      isValidFormat={cpfValidation.isValid}
                      validLabel="Válido"
                      emptyText={cpfValidation.isComplete && !cpfValidation.isValid ? 'CPF Inválido' : undefined}
                    />
                  </label>
                  <input
                    type="text"
                    value={cpfResponsavel}
                    onChange={e => setCpfResponsavel(maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={
                      getInputCls(isCpfRespInvalid || cpfCheck.exists) +
                      ' font-mono ' +
                      (cpfCheck.exists
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                        : cpfCheck.checked && cpfValidation.isValid
                        ? 'border-emerald-500 focus:border-emerald-500'
                        : '')
                    }
                  />
                  {cpfCheck.exists ? (
                    <p className="text-[11px] text-red-600 mt-1 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>
                      {cpfCheck.message || 'Este CPF já está cadastrado no sistema.'}
                    </p>
                  ) : isCpfRespInvalid ? (
                    <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>CPF inválido
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className={lCls}>Cargo / Funcao</label>
                  <select value={cargoResponsavel} onChange={e => setCargoResponsavel(e.target.value)} className={iCls + ' cursor-pointer'}>
                    {['Proprietario','Diretor Geral','Gerente Geral','Socio-Administrador','Gestor de TI','Responsavel Financeiro'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lCls}>E-mail *</label>
                  <input type="email" value={emailResponsavel} onChange={e => setEmailResponsavel(e.target.value)} placeholder="contato@seupousada.com.br" className={getInputCls(isEmailRespInvalid)} />
                  {isEmailRespInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>Informe um e-mail válido para o responsável</p>}
                </div>
                <div>
                  <label className={lCls}>WhatsApp Pessoal *</label>
                  <input type="tel" value={whatsappResponsavel} onChange={e => setWhatsappResponsavel(maskPhone(e.target.value))} placeholder="(81) 99999-8888" className={getInputCls(isWhatsappRespInvalid)} />
                  {isWhatsappRespInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>WhatsApp pessoal com DDD é obrigatório</p>}
                </div>
              </div>
              <div className="flex gap-2.5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs">
                <span className="material-symbols-outlined text-base mt-0.5 shrink-0">info</span>
                Seus dados sao protegidos por criptografia SSL e usados apenas para contrato e notificacoes do sistema.
              </div>
            </div>
          )}

          {/* STEP 5 - Acesso */}
          {step === 5 && (
            <div className="px-6 pt-5 pb-8 space-y-4">
              <p className="text-gray-500 text-sm">Crie seu acesso ao painel de controle do Hotel no Zap.</p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={'flex items-center justify-between ' + lCls}>
                    <span>E-mail de Acesso *</span>
                    <SecurityFieldBadge
                      check={emailCheck}
                      isValidFormat={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())}
                      validLabel="Válido"
                    />
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className={
                      getInputCls(isLoginEmailInvalid || emailCheck.exists) +
                      (emailCheck.exists
                        ? ' border-red-500 focus:border-red-500 focus:ring-red-200'
                        : emailCheck.checked && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())
                        ? ' border-emerald-500 focus:border-emerald-500'
                        : '')
                    }
                  />
                  {emailCheck.exists ? (
                    <p className="text-[11px] text-red-600 mt-1 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>
                      {emailCheck.message || 'Este e-mail de acesso já está cadastrado no sistema.'}
                    </p>
                  ) : isLoginEmailInvalid ? (
                    <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>Informe um e-mail de acesso válido
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-1">Será usado para fazer login no sistema.</p>
                  )}
                </div>
                <div>
                  <label className={lCls}>Senha de Acesso *</label>
                  <div className="relative">
                    <input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Minimo 6 caracteres" className={getInputCls(isSenhaInvalid) + ' pr-11'} />
                    <button type="button" onClick={() => setShowSenha(s => !s)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"><span className="material-symbols-outlined text-base">{showSenha ? 'visibility_off' : 'visibility'}</span></button>
                  </div>
                  {isSenhaInvalid && <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1"><span className="material-symbols-outlined text-xs">error</span>A senha deve ter no mínimo 6 caracteres</p>}
                  {senha.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {[...Array(4)].map((_,i) => {
                        const s = senha.length < 6 ? 1 : senha.length < 8 ? 2 : senha.length < 10 ? 3 : 4;
                        return <div key={i} className={'h-1 flex-1 rounded-full transition-colors ' + (i < s ? (s===1?'bg-red-400':s===2?'bg-amber-400':s===3?'bg-blue-400':'bg-emerald-500') : 'bg-gray-200')} />;
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className={lCls}>Confirmar Senha *</label>
                  <input type={showSenha ? 'text' : 'password'} value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} placeholder="Repita a senha" className={getInputCls(isConfirmSenhaInvalid)} />
                  {isConfirmSenhaInvalid && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">cancel</span>
                      {!confirmSenha ? 'Confirme sua senha de acesso' : 'Senhas não coincidem'}
                    </p>
                  )}
                </div>

                {/* Parceiro READONLY */}
                <div>
                  <label className={lCls}>Parceiro / Indicador</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center"><span className="material-symbols-outlined text-gray-400 text-base">lock</span></span>
                    <input type="text" readOnly value={partnerLabel} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 bg-gray-100 cursor-not-allowed font-medium" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Parceiro vinculado automaticamente. Nao e possivel alterar.</p>
                </div>

                {/* Resumo */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Resumo do Cadastro</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {[['Hotel',nomeFantasia],['URL',urlHotel||formatHotelUrl(nomeFantasia)],['Plano',planoSelecionado],['Localizacao',cidade&&uf?cidade+'/'+uf:''],['Responsavel',nomeResponsavel],['Capacidade', selectedPlanoObj?.roomLimit ? `${selectedPlanoObj.roomLimit} quartos (Plano)` : 'Conforme o plano'],['Parceiro', refCode]].map(([k,v])=>(
                      <div key={k} className="col-span-1 truncate"><span className="text-gray-400">{k}: </span><span className="font-semibold text-gray-800" title={String(v)}>{v||'nao informado'}</span></div>
                    ))}
                  </div>
                </div>

                {/* Termos */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div onClick={() => setAceitaTermos(t => !t)} className={'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ' + (aceitaTermos ? 'bg-emerald-500 border-emerald-500' : isTermosInvalid ? 'border-red-500 bg-red-50 ring-2 ring-red-400/40' : 'border-gray-300 bg-white group-hover:border-emerald-400')}>
                      {aceitaTermos && <span className="material-symbols-outlined text-white text-sm">check</span>}
                    </div>
                    <span className="text-xs text-gray-600 leading-relaxed">
                      Li e aceito os <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-semibold underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-semibold underline">Política de Privacidade</a> do Hotel no Zap.
                    </span>
                  </label>
                  {isTermosInvalid && (
                    <p className="text-[11px] text-red-500 mt-1.5 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">error</span>
                      Você deve aceitar os Termos de Uso e Política de Privacidade para concluir.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 - Checkout Automático & Ativação de Conta */}
          {step === 6 && (
            <CheckoutPlanoStep
              hotelId={createdHotelId}
              hotelNome={nomeFantasia}
              loginEmail={loginEmail}
              nomeResponsavel={nomeResponsavel}
              cpfOuCnpj={cnpj || cpfResponsavel}
              whatsapp={whatsapp}
              plano={selectedPlanoObj}
              onGoToDashboard={goToPainelAdmin}
              onFalarWhatsApp={() => {
                window.open('https://wa.me/5566981585014?text=Ola!%20Cadastrei%20o%20hotel%20' + encodeURIComponent(nomeFantasia) + '%20no%20Hotel%20no%20Zap!%20Parceiro:%20' + encodeURIComponent(refCode), '_blank');
              }}
            />
          )}

          {/* Footer nav */}
          {step < 6 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
              {errorMsg && (
                <div className="w-full px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-semibold animate-in fade-in duration-200">
                  <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
                  <span className="flex-1">{errorMsg}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                {step > 1 ? (
                  <button type="button" onClick={() => setStep(s => s-1)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100 cursor-pointer">
                    <span className="material-symbols-outlined text-base">arrow_back</span>Voltar
                  </button>
                ) : (
                  <button type="button" onClick={onNavigateToLP} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 cursor-pointer">
                    <span className="material-symbols-outlined text-base">arrow_back</span>Ir para o site
                  </button>
                )}
                {step < 5 ? (
                  <button type="button" onClick={handleNext} className="inline-flex items-center gap-2 px-7 py-2.5 bg-[#003400] hover:bg-[#004800] text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm">
                    Proxima Etapa<span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => {
                    const err = validateStep();
                    if (err) {
                      setErrorMsg(err);
                      setHasAttemptedNext(true);
                      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      return;
                    }
                    handleSubmit();
                  }} disabled={isSubmitting} className="inline-flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm">
                    {isSubmitting ? <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Enviando...</> : <><span className="material-symbols-outlined text-base">rocket_launch</span>Finalizar Cadastro</>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Trust badges */}
        {step < 6 && (
          <div className="mt-6 flex flex-wrap justify-center gap-5 text-gray-400 text-xs font-medium">
            {[['lock','Dados Criptografados'],['verified_user','SSL Certificado'],['support_agent','Suporte em Portugues'],['cancel_schedule_send','Cancele quando quiser']].map(([icon,text]) => (
              <div key={text} className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-600 text-sm">{icon}</span>{text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-5 text-center text-gray-400 text-xs bg-white space-y-2">
        <p>Copyright {new Date().getFullYear()} Hotel no Zap - Sistema SaaS Hoteleiro - Todos os direitos reservados</p>
        <div className="flex items-center justify-center gap-3 font-medium text-slate-500">
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 transition-colors">Termos de Uso</a>
          <span>•</span>
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 transition-colors">Política de Privacidade</a>
          <span>•</span>
          <a href="/fale-conosco" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 transition-colors">Fale Conosco</a>
        </div>
      </footer>
    </div>
  );
};

export default LpAssinar;
