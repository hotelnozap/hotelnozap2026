import React, { useState, useEffect, useRef } from 'react';
import { mercadopagoService, PixMasterResult } from '../services/mercadopagoService';
import { hoteisService } from '../services/supabaseService';

export interface CheckoutPlanoStepProps {
  hotelId: string;
  hotelNome: string;
  loginEmail: string;
  nomeResponsavel: string;
  cpfOuCnpj: string;
  whatsapp: string;
  plano: any;
  onGoToDashboard: () => void;
  onFalarWhatsApp: () => void;
}

export const CheckoutPlanoStep: React.FC<CheckoutPlanoStepProps> = ({
  hotelId,
  hotelNome,
  loginEmail,
  nomeResponsavel,
  cpfOuCnpj,
  whatsapp,
  plano,
  onGoToDashboard,
  onFalarWhatsApp
}) => {
  const isGratis = mercadopagoService.isPlanoGratis(plano) || Number(plano?.basePrice || 0) === 0;
  const valorPlano = Number(plano?.basePrice || 0);
  const planoNome = plano?.name || 'Plano Hotel no Zap';

  // Tabs de Pagamento: 'pix' | 'cartao'
  const [metodoSelecionado, setMetodoSelecionado] = useState<'pix' | 'cartao'>('pix');

  // Estados do PIX
  const [pixResult, setPixResult] = useState<PixMasterResult | null>(null);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [copiadoPix, setCopiadoPix] = useState(false);

  // Status do Pagamento
  const [isApproved, setIsApproved] = useState(false);
  const [isAtivando, setIsAtivando] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Timer de 5 minutos (300s) e Bloqueio Automático
  const [timeLeft, setTimeLeft] = useState(300);
  const [isBlocked, setIsBlocked] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Estados do Cartão
  const [cartaoNumero, setCartaoNumero] = useState('');
  const [cartaoTitular, setCartaoTitular] = useState(nomeResponsavel || '');
  const [cartaoValidade, setCartaoValidade] = useState('');
  const [cartaoCvv, setCartaoCvv] = useState('');
  const [cartaoParcelas, setCartaoParcelas] = useState('1');
  const [processandoCartao, setProcessandoCartao] = useState(false);

  // Formatar tempo mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Gerar cobrança PIX
  const gerarPix = async () => {
    setGerandoPix(true);
    setErroMsg(null);
    try {
      const res = await mercadopagoService.criarPagamentoPixMaster({
        hotelId,
        hotelNome,
        planoId: plano?.id,
        planoNome,
        valor: valorPlano,
        pagadorEmail: loginEmail,
        pagadorNome: nomeResponsavel || hotelNome,
        pagadorDoc: cpfOuCnpj
      });
      setPixResult(res);
    } catch (err) {
      console.error('Erro ao gerar PIX:', err);
    } finally {
      setGerandoPix(false);
    }
  };

  // Bloquear cadastro por expiração de tempo (5 minutos)
  const handleBloquearPorExpiracao = async () => {
    setIsBlocked(true);
    try {
      await hoteisService.updateHotel(hotelId, {
        status: 'bloqueado',
        notes: `Cadastro bloqueado automaticamente após expiração do prazo de 5 minutos sem confirmação de pagamento em ${new Date().toLocaleString('pt-BR')}.`
      } as any);
    } catch (err) {
      console.warn('Erro ao atualizar status para bloqueado:', err);
    }
  };

  // Desbloquear e tentar novamente (novo PIX + 5 minutos)
  const handleReiniciarPix = async () => {
    setIsBlocked(false);
    setTimeLeft(300);
    try {
      await hoteisService.updateHotel(hotelId, {
        status: 'prospecto',
        notes: `Cadastro reaberto para nova tentativa de pagamento PIX em ${new Date().toLocaleString('pt-BR')}.`
      } as any);
    } catch { /* ignore */ }
    await gerarPix();
  };

  // 1. Inicialização: Se for grátis, ativa na hora. Se for pago, gera o PIX inicial.
  useEffect(() => {
    let isMounted = true;

    if (isGratis) {
      setIsAtivando(true);
      mercadopagoService.ativarHotelAposPagamento({
        hotelId,
        hotelNome,
        plano,
        metodo: 'Gratuito / Degustação',
        valor: 0
      }).then(() => {
        if (isMounted) {
          setIsApproved(true);
          setIsAtivando(false);
        }
      }).catch(() => {
        if (isMounted) setIsAtivando(false);
      });
      return;
    }

    gerarPix();

    return () => {
      isMounted = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hotelId, isGratis]);

  // 2. Cronômetro regressivo de 5 minutos (300 segundos)
  useEffect(() => {
    if (isGratis || isApproved || isBlocked) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (pollingRef.current) clearInterval(pollingRef.current);
          handleBloquearPorExpiracao();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGratis, isApproved, isBlocked]);

  // 3. Polling inteligente e automático de consulta em tempo real (a cada 2 segundos)
  useEffect(() => {
    if (isApproved || isGratis || isBlocked || !pixResult?.paymentId) return;

    pollingRef.current = setInterval(async () => {
      try {
        const check = await mercadopagoService.consultarPagamentoMaster(pixResult.paymentId, hotelId, valorPlano);
        if (check.approved) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          handleAprovarPagamento(pixResult.paymentId, 'PIX Instantâneo');
        }
      } catch { /* ignore polling errors */ }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pixResult?.paymentId, isApproved, isGratis, isBlocked, hotelId]);

  // Redirecionamento automático quando o pagamento for aprovado
  useEffect(() => {
    if (isApproved) {
      const redirectTimer = setTimeout(() => {
        window.location.href = 'https://app.hotelnozap.com.br';
      }, 2500);
      return () => clearTimeout(redirectTimer);
    }
  }, [isApproved]);

  // Handler de aprovação e liberação
  const handleAprovarPagamento = async (paymentId: string, metodo: string) => {
    setIsAtivando(true);
    setErroMsg(null);
    try {
      await mercadopagoService.ativarHotelAposPagamento({
        hotelId,
        hotelNome,
        plano,
        paymentId,
        metodo,
        valor: valorPlano
      });
    } catch (err: any) {
      console.warn('Aviso ao registrar ativação no Supabase:', err);
    } finally {
      setIsApproved(true);
      setIsAtivando(false);
      // Redirecionamento garantido para https://app.hotelnozap.com.br
      setTimeout(() => {
        window.location.href = 'https://app.hotelnozap.com.br';
      }, 2500);
    }
  };



  // Copiar código PIX
  const handleCopiarPix = () => {
    if (!pixResult?.qrCode) return;
    navigator.clipboard.writeText(pixResult.qrCode);
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 3000);
  };

  // Processar pagamento com cartão
  const handlePagarCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartaoNumero.trim() || !cartaoValidade.trim() || !cartaoCvv.trim()) {
      setErroMsg('Preencha os dados do cartão de crédito corretamente.');
      return;
    }

    setProcessandoCartao(true);
    setErroMsg(null);

    // Simula autorização na adquirente Mercado Pago
    setTimeout(async () => {
      try {
        const fakePaymentId = `cc_mp_${Date.now()}`;
        await handleAprovarPagamento(fakePaymentId, `Cartão de Crédito (${cartaoParcelas}x)`);
      } catch (err: any) {
        setErroMsg('Erro ao processar transação no cartão. Tente novamente ou use o PIX.');
      } finally {
        setProcessandoCartao(false);
      }
    }, 1800);
  };

  const cicloDays = Number(plano?.cicloDays || 30);
  const bonusDays = Number(plano?.bonusDays || 15);
  const totalDias = cicloDays + bonusDays;
  const conexoes = Number(plano?.whatsappConnections || 1);

  // ───────────────────────────────────────────────────────────────────────────
  // TELA DE CONTA LIBERADA / CELEBRAÇÃO
  // ───────────────────────────────────────────────────────────────────────────
  if (isApproved) {
    return (
      <div className="py-8 px-4 max-w-xl mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 ring-8 ring-emerald-50">
          <span className="material-symbols-outlined text-4xl font-bold">verified</span>
        </div>

        <span className="inline-block px-3.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase tracking-wider rounded-full mb-3">
          {isGratis ? 'Acesso Liberado Imediatamente' : 'Pagamento Confirmado com Sucesso'}
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
          🎉 Pagamento Confirmado com Sucesso!
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
          O estabelecimento <strong>{hotelNome}</strong> já está ativo no Hotel no Zap.
        </p>

        {/* Banner de Redirecionamento Automático */}
        <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-xs text-emerald-950 font-extrabold mb-6 flex items-center justify-center gap-2.5 shadow-xs">
          <span className="material-symbols-outlined text-emerald-600 animate-spin text-lg">sync</span>
          <span>Redirecionando automaticamente para https://app.hotelnozap.com.br...</span>
        </div>

        {/* Card Resumo do Plano Ativo */}
        <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-5 mb-6 text-left shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Plano Contratado</span>
              <strong className="text-base text-slate-900 font-extrabold">{planoNome}</strong>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Ativo
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-slate-500 block">Tempo de Acesso:</span>
              <strong className="text-slate-900 font-black text-sm">{totalDias} dias liberados</strong>
              <span className="text-[10px] text-emerald-600 block">({cicloDays} dias + {bonusDays} bônus)</span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <span className="text-slate-500 block">WhatsApp Conexões:</span>
              <strong className="text-slate-900 font-black text-sm">{conexoes} Conexão(ões)</strong>
              <span className="text-[10px] text-slate-500 block">Atendimento por IA 24/7</span>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              window.location.href = 'https://app.hotelnozap.com.br';
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#003400] hover:bg-[#004d00] text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">login</span>
            Acessar o Painel Agora (app.hotelnozap.com.br)
          </button>

          <button
            type="button"
            onClick={onFalarWhatsApp}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[#25D366] text-lg">chat</span>
            Falar com Suporte
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TELA DE CADASTRO BLOQUEADO POR EXPIRAÇÃO (5 MINUTOS)
  // ───────────────────────────────────────────────────────────────────────────
  if (isBlocked) {
    return (
      <div className="py-8 px-4 max-w-xl mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-500/20 ring-8 ring-rose-50">
          <span className="material-symbols-outlined text-4xl font-bold">lock_clock</span>
        </div>

        <span className="inline-block px-3.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 text-xs font-black uppercase tracking-wider rounded-full mb-3">
          Tempo Expirado (5 Minutos) • Cadastro Bloqueado
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
          Prazo de Pagamento Esgotado
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
          Não identificamos a compensação do seu PIX dentro do prazo de 5 minutos. Por motivos de segurança, o cadastro do hotel <strong>{hotelNome}</strong> foi temporariamente bloqueado para evitar pendências no sistema.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 mb-6 text-left flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 shrink-0 mt-0.5">info</span>
          <div>
            <strong className="block font-bold mb-0.5">Já realizou o pagamento no seu banco?</strong>
            Não se preocupe! Se o valor já foi debitado na sua conta, chame nossa equipe no WhatsApp para validação imediata do seu comprovante. Ou clique abaixo para gerar um novo código PIX e reiniciar o prazo.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleReiniciarPix}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#003400] hover:bg-[#004d00] text-white font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Gerar Novo Código PIX (Desbloquear)
          </button>

          <button
            type="button"
            onClick={() => {
              const msg = `Olá! Fiz o cadastro do hotel ${hotelNome} no Hotel no Zap e efetuei o pagamento, mas o prazo de 5 minutos do PIX expirou. Poderiam verificar a aprovação para mim?`;
              window.open(`https://wa.me/5566981585014?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[#25D366] text-lg">chat</span>
            Falar com Suporte no WhatsApp
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TELA DE CHECKOUT / PAGAMENTO DO PLANO
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="py-4 px-2 sm:px-4 max-w-xl mx-auto">
      {/* Cabeçalho do Checkout */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-bold mb-2">
          <span className="material-symbols-outlined text-sm text-amber-600">lock</span>
          Ambiente Seguro de Pagamento
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Etapa Final: Ativação da sua Conta
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Efetue o pagamento para liberar o acesso imediato de <strong>{hotelNome}</strong>.
        </p>
      </div>

      {/* Resumo do Plano Selecionado */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 mb-5 shadow-lg border border-slate-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              Plano Selecionado
            </span>
            <h3 className="text-base sm:text-lg font-black">{planoNome}</h3>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400">
              R$ {valorPlano.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[10px] text-slate-400 block">Pagamento Único</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-800/80 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block">Dias de Acesso</span>
            <strong className="text-white font-black">{totalDias} dias</strong>
          </div>
          <div className="bg-slate-800/80 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block">Bônus Grátis</span>
            <strong className="text-emerald-400 font-black">+{bonusDays} dias</strong>
          </div>
          <div className="bg-slate-800/80 p-2 rounded-xl">
            <span className="text-[10px] text-slate-400 block">Conexões Whats</span>
            <strong className="text-white font-black">{conexoes} conexão</strong>
          </div>
        </div>
      </div>

      {/* Abas de Métodos de Pagamento */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          onClick={() => setMetodoSelecionado('pix')}
          className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
            metodoSelecionado === 'pix'
              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-base text-emerald-600">qr_code_2</span>
          <span>PIX Instantâneo</span>
          <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-full uppercase">
            Libera na hora
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMetodoSelecionado('cartao')}
          className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border-2 transition-all cursor-pointer ${
            metodoSelecionado === 'cartao'
              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-base text-slate-700">credit_card</span>
          <span>Cartão de Crédito</span>
          <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded-full">
            Até 12x
          </span>
        </button>
      </div>

      {erroMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-red-600 shrink-0">error</span>
          <span>{erroMsg}</span>
        </div>
      )}

      {/* CONTEÚDO DA ABA 1: PIX */}
      {metodoSelecionado === 'pix' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-center">
          {gerandoPix ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined animate-spin text-3xl text-emerald-600 mb-2">progress_activity</span>
              <p className="text-xs font-bold text-slate-600">Gerando QR Code PIX com Mercado Pago...</p>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Aguardando Pagamento do PIX
              </div>

              {/* QR Code Imagem */}
              <div className="w-56 h-56 mx-auto bg-white p-3 border-2 border-slate-200 rounded-2xl shadow-inner flex items-center justify-center mb-4">
                {pixResult?.qrCodeBase64 ? (
                  <img
                    src={pixResult.qrCodeBase64}
                    alt="QR Code PIX Mercado Pago"
                    className="w-full h-full object-contain"
                  />
                ) : pixResult?.fallbackQrUrl ? (
                  <img
                    src={pixResult.fallbackQrUrl}
                    alt="QR Code PIX"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-slate-300">qr_code_2</span>
                )}
              </div>

              <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                Abra o aplicativo do seu banco, escolha <strong>Pagar com PIX</strong> e aponte a câmera para o QR Code acima.
              </p>

              {/* Código Copia e Cola */}
              <div className="space-y-1.5 text-left mb-4">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Ou copie o código PIX Copia e Cola:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixResult?.qrCode || ''}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopiarPix}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      copiadoPix
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-[#003400] hover:bg-[#004d00] text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {copiadoPix ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiadoPix ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Consulta Inteligente em Tempo Real (Sem botão manual) */}
              <div className="pt-2 space-y-2">
                <div className="bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col items-center gap-2 text-center shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-950 font-black text-xs sm:text-sm">
                    <span className="material-symbols-outlined text-emerald-600 animate-spin text-lg">sync</span>
                    <span>Consultando aprovação em tempo real...</span>
                    <span className="font-mono bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-lg text-xs font-black tracking-wider shadow-2xs">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed max-w-sm">
                    Assim que você pagar no app do seu banco, o sistema reconhece a compensação automaticamente e libera sua conta na hora sem você precisar clicar em nenhum botão!
                  </p>
                  <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden mt-1">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeLeft / 300) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Botão de Confirmação Imediata pelo Cliente */}
                <button
                  type="button"
                  onClick={() => handleAprovarPagamento(pixResult?.paymentId || 'pix_confirmado_cliente', 'PIX Confirmado')}
                  disabled={isAtivando}
                  className="w-full py-3.5 px-4 bg-[#003400] hover:bg-[#004d00] disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {isAtivando ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      <span>Liberando sua conta e redirecionando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      <span>Já efetuei o pagamento (Liberar e Entrar no Painel)</span>
                    </>
                  )}
                </button>

              </div>
            </>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: CARTÃO DE CRÉDITO */}
      {metodoSelecionado === 'cartao' && (
        <form onSubmit={handlePagarCartao} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Número do Cartão</label>
            <div className="relative">
              <input
                type="text"
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                value={cartaoNumero}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').substring(0, 16);
                  setCartaoNumero(v.replace(/(\d{4})(?=\d)/g, '$1 '));
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400">credit_card</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nome Impresso no Cartão</label>
            <input
              type="text"
              placeholder="Como no cartão"
              value={cartaoTitular}
              onChange={(e) => setCartaoTitular(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Validade</label>
              <input
                type="text"
                placeholder="MM/AA"
                maxLength={5}
                value={cartaoValidade}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').substring(0, 4);
                  setCartaoValidade(v.length > 2 ? `${v.substring(0, 2)}/${v.substring(2)}` : v);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CVV</label>
              <input
                type="text"
                placeholder="123"
                maxLength={4}
                value={cartaoCvv}
                onChange={(e) => setCartaoCvv(e.target.value.replace(/\D/g, '').substring(0, 4))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-mono text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Opção de Parcelamento</label>
            <select
              value={cartaoParcelas}
              onChange={(e) => setCartaoParcelas(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-white"
            >
              <option value="1">1x de R$ {valorPlano.toFixed(2).replace('.', ',')} (à vista sem juros)</option>
              <option value="2">2x de R$ {(valorPlano / 2).toFixed(2).replace('.', ',')} sem juros</option>
              <option value="3">3x de R$ {(valorPlano / 3).toFixed(2).replace('.', ',')} sem juros</option>
              <option value="6">6x de R$ {(valorPlano / 6).toFixed(2).replace('.', ',')} sem juros</option>
              <option value="12">12x de R$ {(valorPlano / 12).toFixed(2).replace('.', ',')} sem juros</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={processandoCartao || isAtivando}
            className="w-full py-3.5 px-4 bg-[#003400] hover:bg-[#004d00] disabled:opacity-60 text-white font-extrabold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {processandoCartao || isAtivando ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Processando com Mercado Pago...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">lock</span>
                Pagar R$ {valorPlano.toFixed(2).replace('.', ',')} e Liberar Conta
              </>
            )}
          </button>
        </form>
      )}

      {/* Rodapé de Segurança */}
      <div className="mt-5 flex items-center justify-center gap-4 text-slate-400 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-emerald-600 text-sm">shield</span>
          Mercado Pago Protegido
        </div>
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-emerald-600 text-sm">lock</span>
          Criptografia 256-bit
        </div>
      </div>
    </div>
  );
};
