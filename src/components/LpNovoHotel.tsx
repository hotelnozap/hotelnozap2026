import React, { useState, useEffect, useRef, useMemo } from 'react';
import { maskCnpj, maskPhone, maskCep, maskCpf, isValidCpf, isValidCnpj, getCpfValidationStatus, getCnpjValidationStatus } from '../utils/masks';
import { fetchAddressByCep } from '../utils/viacep';
import { hoteisService, planosService, usuariosService } from '../services/supabaseService';
import { supabase } from '../lib/supabase';

interface LpNovoHotelProps {
  onNavigateToLP?: () => void;
  onNavigateToLogin?: () => void;
}

const STEPS = [
  { id: 1, icon: 'storefront',   label: 'Dados do Hotel' },
  { id: 2, icon: 'stars',        label: 'Plano'          },
  { id: 3, icon: 'location_on',  label: 'Endereco'       },
  { id: 4, icon: 'person',       label: 'Responsavel'    },
  { id: 5, icon: 'lock',         label: 'Acesso'         },
  { id: 6, icon: 'check_circle', label: 'Concluido'      },
];

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const CATEGORIAS = ['Pousada Boutique / Charme','Hotel Economico / Budget','Hotel de Negocios','Resort Spa','Hotel Fazenda','Hotel de Praia','Hostel / Albergue','Apart Hotel / Flat','Eco Pousada','Hotel de Montanha'];

const LpNovoHotel: React.FC<LpNovoHotelProps> = ({ onNavigateToLP, onNavigateToLogin }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

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
      );
      setPlanos(active);
      setLoadingPlanos(false);
    }).catch(() => setLoadingPlanos(false));
  }, []);

  // Step 1: dados do hotel
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [categoria, setCategoria] = useState('Pousada Boutique / Charme');
  const [capacidade, setCapacidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [site, setSite] = useState('');
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
  const PARCEIRO_PADRAO = 'HOTELNOZAP - Hotel no Zap (Parceiro Padrao)';

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setErrorMsg('');
  }, [step]);

  const validateStep = (): string | null => {
    if (step === 1) {
      if (!nomeFantasia.trim()) return 'Informe o Nome Fantasia do hotel.';
      if (!cnpj.trim() || !isValidCnpj(cnpj)) return 'Informe um CNPJ valido.';
      if (!capacidade || Number(capacidade) < 1) return 'Informe a quantidade de quartos/unidades.';
      if (!whatsapp.trim() || whatsapp.replace(/\D/g,'').length < 10) return 'Informe o WhatsApp do hotel.';
    }
    if (step === 2) {
      if (!planoSelecionado) return 'Selecione um plano para continuar.';
    }
    if (step === 3) {
      if (!cep.trim() || cep.replace(/\D/g,'').length < 8) return 'Informe o CEP.';
      if (!logradouro.trim()) return 'Informe o logradouro.';
      if (!numero.trim()) return 'Informe o numero.';
      if (!bairro.trim()) return 'Informe o bairro.';
      if (!cidade.trim()) return 'Informe a cidade.';
    }
    if (step === 4) {
      if (!nomeResponsavel.trim()) return 'Informe o nome do responsavel.';
      if (!emailResponsavel.trim() || !emailResponsavel.includes('@')) return 'Informe um e-mail valido.';
      if (!whatsappResponsavel.trim() || whatsappResponsavel.replace(/\D/g,'').length < 10) return 'Informe o WhatsApp do responsavel.';
      if (cpfResponsavel.trim() && !isValidCpf(cpfResponsavel)) return 'CPF invalido.';
    }
    if (step === 5) {
      if (!loginEmail.trim() || !loginEmail.includes('@')) return 'Informe um e-mail de acesso valido.';
      if (!senha || senha.length < 6) return 'A senha deve ter no minimo 6 caracteres.';
      if (senha !== confirmSenha) return 'As senhas nao coincidem.';
      if (!aceitaTermos) return 'Aceite os Termos de Uso para continuar.';
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setErrorMsg(err); return; }
    setStep(s => s + 1);
  };

  const goToPainelAdmin = () => {
    window.history.pushState({}, '', '/paineladmin');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    let hotelCriadoId: string | null = null;
    try {
      const cityUf = cidade && uf ? cidade + ' / ' + uf : cidade || '';
      const hotelRes = await hoteisService.createHotel({
        name: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim() || nomeFantasia.trim(),
        cnpj: cnpj.trim(),
        category: categoria,
        capacity: Number(capacidade) || 0,
        whatsappInstances: 0,
        managerPhone: whatsapp.trim(),
        whatsapp: whatsapp.replace(/\D/g,''),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        tiktok: tiktok.trim(),
        link: site.trim(),
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
        notes: 'Cadastro via /lp/lpnovohotel em ' + new Date().toLocaleDateString('pt-BR') + '. Parceiro: HOTELNOZAP.',
      } as any);

      if (!hotelRes.success) {
        setErrorMsg(
          'Não foi possível concluir o cadastro do hotel. ' +
          (hotelRes.error || 'Tente novamente ou entre em contato via WhatsApp.')
        );
        return;
      }
      hotelCriadoId = hotelRes.id;

      // 2. Criar o Usuário do Hotel na tabela `usuarios` e registrar no Supabase Auth com a senha real.
      //    adminMode = false: deixa o novo usuário logado automaticamente (pois é signup público).
      if (loginEmail.trim()) {
        const userRes = await usuariosService.createUsuario({
          name: nomeResponsavel.trim() || nomeFantasia.trim(),
          email: loginEmail.trim().toLowerCase(),
          cargo: cargoResponsavel || 'Proprietário',
          perfil: 'Administrador',
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
          console.error('Usuário/Auth falhou. Realizando rollback do hotel id=', hotelCriadoId);
          if (hotelCriadoId) {
            try { await hoteisService.deleteHotel(hotelCriadoId); } catch (rb) { console.warn('Rollback do hotel falhou:', rb); }
          }
          // Garante que não fiquemos logados com um Auth parcial
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
        // Sem e-mail de login para criar usuário: nesse cenário NÃO apaga o hotel
        setStep(6);
        return;
      }

      setStep(6);
    } catch (err: any) {
      // ROLLBACK de último recurso
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans" ref={topRef}>
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button onClick={onNavigateToLP} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl bg-[#003400] group-hover:bg-emerald-700 flex items-center justify-center shadow">
              <span className="material-symbols-outlined text-white text-lg">hotel</span>
            </div>
            <div className="leading-tight">
              <p className="text-gray-900 font-black text-sm">Hotel no Zap</p>
              <p className="text-emerald-600 text-[10px] font-semibold">Sistema SaaS Hoteleiro</p>
            </div>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <span className="material-symbols-outlined text-emerald-600 text-sm">shield_lock</span>
            Cadastro seguro SSL
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-emerald-600 font-bold">Etapa {Math.min(step,5)} de 5</span>
          </div>
          <button onClick={onNavigateToLogin} className="text-xs text-gray-400 hover:text-gray-800 underline cursor-pointer">
            Ja tenho conta
          </button>
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

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
              <p className="text-gray-500 text-sm">Preencha todas as informacoes da sua propriedade hoteleira.</p>

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
                  <input type="text" value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Ex: Pousada Recanto dos Corais" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Razao Social</label>
                  <input type="text" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Ex: Recanto dos Corais Ltda" className={iCls} />
                </div>
                <div>
                  <label className={'flex items-center justify-between ' + lCls}>
                    <span>CNPJ *</span>
                    {cnpjValidation.isComplete && (
                      <span className={'text-[11px] font-bold flex items-center gap-0.5 ' + (cnpjValidation.isValid ? 'text-emerald-600' : 'text-red-500')}>
                        <span className="material-symbols-outlined text-xs">{cnpjValidation.isValid ? 'verified' : 'cancel'}</span>
                        {cnpjValidation.isValid ? 'CNPJ Valido' : 'CNPJ Invalido'}
                      </span>
                    )}
                  </label>
                  <input type="text" value={cnpj} onChange={e => setCnpj(maskCnpj(e.target.value))} placeholder="00.000.000/0001-00" maxLength={18} className={iCls + ' font-mono ' + (cnpjValidation.isComplete ? cnpjValidation.isValid ? 'border-emerald-400' : 'border-red-400' : '')} />
                </div>
                <div>
                  <label className={lCls}>Categoria *</label>
                  <select value={categoria} onChange={e => setCategoria(e.target.value)} className={iCls + ' cursor-pointer'}>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lCls}>Nr de Quartos / Unidades *</label>
                  <input type="number" min="1" value={capacidade} onChange={e => setCapacidade(e.target.value)} placeholder="Ex: 25" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>WhatsApp do Hotel *</label>
                  <input type="tel" value={whatsapp} onChange={e => setWhatsapp(maskPhone(e.target.value))} placeholder="(81) 98765-4321" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Telefone Fixo</label>
                  <input type="tel" value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(81) 3322-1100" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Site / URL</label>
                  <input type="url" value={site} onChange={e => setSite(e.target.value)} placeholder="https://seupousada.com.br" className={iCls} />
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
              {loadingPlanos ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Carregando planos...
                </div>
              ) : planos.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">Planos nao disponiveis no momento. Entre em contato.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {planos.map(p => (
                    <button key={p.id} type="button" onClick={() => setPlanoSelecionado(p.name)}
                      className={'relative text-left px-5 py-5 rounded-2xl border-2 transition-all cursor-pointer ' + (planoSelecionado === p.name ? 'border-emerald-500 bg-emerald-50 shadow-md' : 'border-gray-200 bg-white hover:border-emerald-300')}>
                      {p.isFeatured && <span className="absolute -top-2.5 right-3 bg-emerald-500 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">Mais Popular</span>}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-black text-gray-900 text-sm">{p.name}</p>
                        <div className={'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ' + (planoSelecionado === p.name ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white')}>
                          {planoSelecionado === p.name && <span className="material-symbols-outlined text-white text-xs">check</span>}
                        </div>
                      </div>
                      <p className="text-gray-500 text-xs mb-2 line-clamp-2">{p.description || 'Solucao completa para gestao hoteleira via WhatsApp.'}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-emerald-700 text-xl">{Number(p.basePrice).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                        <span className="text-xs text-gray-400">/credito</span>
                      </div>
                      {p.roomLimit && <p className="text-[11px] text-gray-400 mt-1">Ate {p.roomLimit} quartos</p>}
                    </button>
                  ))}
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
                    <input type="text" value={cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" maxLength={9} className={iCls + ' font-mono'} />
                    {isLoadingCep && <span className="absolute right-3 top-2.5 material-symbols-outlined animate-spin text-emerald-500 text-base">progress_activity</span>}
                  </div>
                  {cepError && <p className="text-[11px] text-amber-600 mt-1">{cepError}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className={lCls}>Logradouro (Rua / Av.) *</label>
                  <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} placeholder="Ex: Rua das Flores" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Numero *</label>
                  <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Complemento</label>
                  <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Sala, Bloco..." className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Bairro *</label>
                  <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro" className={iCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={lCls}>Cidade *</label>
                  <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Maceio" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>Estado *</label>
                  <select value={uf} onChange={e => setUf(e.target.value)} className={iCls + ' cursor-pointer'}>
                    {UFS.map(u => <option key={u}>{u}</option>)}
                  </select>
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
                  <input type="text" value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)} placeholder="Ex: Marcos Andrade" className={iCls} />
                </div>
                <div>
                  <label className={'flex items-center justify-between ' + lCls}>
                    <span>CPF (opcional)</span>
                    {cpfValidation.isComplete && <span className={'text-[11px] font-bold flex items-center gap-0.5 ' + (cpfValidation.isValid ? 'text-emerald-600' : 'text-red-500')}><span className="material-symbols-outlined text-xs">{cpfValidation.isValid ? 'verified' : 'cancel'}</span>{cpfValidation.isValid ? 'Valido' : 'Invalido'}</span>}
                  </label>
                  <input type="text" value={cpfResponsavel} onChange={e => setCpfResponsavel(maskCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} className={iCls + ' font-mono ' + (cpfValidation.isComplete ? cpfValidation.isValid ? 'border-emerald-400' : 'border-red-400' : '')} />
                </div>
                <div>
                  <label className={lCls}>Cargo / Funcao</label>
                  <select value={cargoResponsavel} onChange={e => setCargoResponsavel(e.target.value)} className={iCls + ' cursor-pointer'}>
                    {['Proprietario','Diretor Geral','Gerente Geral','Socio-Administrador','Gestor de TI','Responsavel Financeiro'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lCls}>E-mail *</label>
                  <input type="email" value={emailResponsavel} onChange={e => setEmailResponsavel(e.target.value)} placeholder="contato@seupousada.com.br" className={iCls} />
                </div>
                <div>
                  <label className={lCls}>WhatsApp Pessoal *</label>
                  <input type="tel" value={whatsappResponsavel} onChange={e => setWhatsappResponsavel(maskPhone(e.target.value))} placeholder="(81) 99999-8888" className={iCls} />
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
                  <label className={lCls}>E-mail de Acesso *</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="seu@email.com" className={iCls} />
                  <p className="text-[11px] text-gray-400 mt-1">Sera usado para fazer login no sistema.</p>
                </div>
                <div>
                  <label className={lCls}>Senha de Acesso *</label>
                  <div className="relative">
                    <input type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Minimo 6 caracteres" className={iCls + ' pr-11'} />
                    <button type="button" onClick={() => setShowSenha(s => !s)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"><span className="material-symbols-outlined text-base">{showSenha ? 'visibility_off' : 'visibility'}</span></button>
                  </div>
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
                  <input type={showSenha ? 'text' : 'password'} value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} placeholder="Repita a senha" className={iCls + (confirmSenha && senha !== confirmSenha ? ' border-red-400' : confirmSenha && senha === confirmSenha ? ' border-emerald-400' : '')} />
                  {confirmSenha && senha !== confirmSenha && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-xs">cancel</span>Senhas nao coincidem</p>}
                </div>

                {/* Parceiro READONLY */}
                <div>
                  <label className={lCls}>Parceiro / Indicador</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center"><span className="material-symbols-outlined text-gray-400 text-base">lock</span></span>
                    <input type="text" readOnly value={PARCEIRO_PADRAO} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 bg-gray-100 cursor-not-allowed font-medium" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Parceiro vinculado automaticamente. Nao e possivel alterar.</p>
                </div>

                {/* Resumo */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Resumo do Cadastro</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {[['Hotel',nomeFantasia],['Plano',planoSelecionado],['Localizacao',cidade&&uf?cidade+'/'+uf:''],['Responsavel',nomeResponsavel],['Quartos',capacidade],['Parceiro','HOTELNOZAP']].map(([k,v])=>(
                      <div key={k}><span className="text-gray-400">{k}: </span><span className="font-semibold text-gray-800">{v||'nao informado'}</span></div>
                    ))}
                  </div>
                </div>

                {/* Termos */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div onClick={() => setAceitaTermos(t => !t)} className={'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ' + (aceitaTermos ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white group-hover:border-emerald-400')}>
                    {aceitaTermos && <span className="material-symbols-outlined text-white text-sm">check</span>}
                  </div>
                  <span className="text-xs text-gray-600 leading-relaxed">
                    Li e aceito os <a href="#" className="text-emerald-600 font-semibold underline">Termos de Uso</a> e a <a href="#" className="text-emerald-600 font-semibold underline">Politica de Privacidade</a> do Hotel no Zap.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 6 - Sucesso */}
          {step === 6 && (
            <div className="px-6 pt-12 pb-14 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
                <div className="relative w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-emerald-600 text-4xl">check_circle</span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Cadastro enviado! 🎉</h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
                  O cadastro de <strong className="text-gray-800">{nomeFantasia}</strong> foi recebido com sucesso. Nossa equipe ira verificar e ativar seu acesso em ate <strong>24 horas uteis</strong>.
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-left space-y-3 max-w-md mx-auto">
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Proximos Passos</p>
                {[
                  {icon:'email', text:'Confira o e-mail ' + loginEmail + ' para confirmacao.'},
                  {icon:'support_agent', text:'Nossa equipe entrara em contato via WhatsApp.'},
                  {icon:'login', text:'Apos ativacao, acesse com seu e-mail e senha.'},
                  {icon:'rocket_launch', text:'Comece a receber reservas via WhatsApp!'},
                ].map((item,i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-emerald-800">
                    <span className="material-symbols-outlined text-emerald-600 text-base mt-0.5 shrink-0">{item.icon}</span>
                    <span className="leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={'https://wa.me/5581999999999?text=Ola!%20Cadastrei%20o%20hotel%20' + encodeURIComponent(nomeFantasia) + '%20no%20Hotel%20no%20Zap!'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#1fba58] text-white font-bold text-sm rounded-xl transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-base">chat</span>Falar no WhatsApp
                </a>
                <button onClick={goToPainelAdmin} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#003400] hover:bg-[#004d00] text-white font-bold text-sm rounded-xl transition-colors cursor-pointer">
                  <span className="material-symbols-outlined text-base">login</span>Acessar o Painel Admin
                </button>
              </div>
            </div>
          )}

          {/* Footer nav */}
          {step < 6 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
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
                <button type="button" onClick={() => { const err = validateStep(); if (err) { setErrorMsg(err); return; } handleSubmit(); }} disabled={isSubmitting} className="inline-flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm">
                  {isSubmitting ? <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Enviando...</> : <><span className="material-symbols-outlined text-base">rocket_launch</span>Finalizar Cadastro</>}
                </button>
              )}
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
      <footer className="border-t border-gray-200 py-5 text-center text-gray-400 text-xs bg-white">
        <p>Copyright {new Date().getFullYear()} Hotel no Zap - Sistema SaaS Hoteleiro - Todos os direitos reservados</p>
      </footer>
    </div>
  );
};

export default LpNovoHotel;
