import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Reserva } from './ListagemReservas';
import { caixaService } from '../services/caixaService';
import { reservasService, hospedesService } from '../services/supabaseService';
import { GuestData } from './ListagemHospedes';
import { maskCpfCnpj, maskPhone } from '../utils/masks';

export interface ModalCheckinEntradaProps {
  isOpen: boolean;
  onClose: () => void;
  reserva: Reserva | null;
  onSuccess: (reservaId: string, quartoNumero: string) => void;
}

// Som agradável de sino de recepção de hotel
const playReceptionBell = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.7);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.1);
    gain2.gain.setValueAtTime(0.4, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.9);
  } catch {}
};

// Converte data ISO ("YYYY-MM-DD") ou BR ("DD/MM/YYYY") para "YYYY-MM-DD"
const toIsoDate = (dateStr?: string): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return dateStr.split('T')[0];
};

// Formata ISO YYYY-MM-DD para DD/MM/YYYY
const formatBrDate = (isoStr?: string): string => {
  if (!isoStr) return '';
  const clean = isoStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

// Calcula diferença em dias (mínimo 1)
const calcNoites = (dIn: string, dOut: string): number => {
  if (!dIn || !dOut) return 1;
  const d1 = new Date(dIn);
  const d2 = new Date(dOut);
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
};

// Parse de valor monetário flexível
const parseValor = (val?: string | number): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = val.toString().replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export const ModalCheckinEntrada: React.FC<ModalCheckinEntradaProps> = ({
  isOpen,
  onClose,
  reserva,
  onSuccess,
}) => {
  if (!isOpen || !reserva) return null;

  // Estados de Datas e Ocupantes
  const [dataEntrada, setDataEntrada] = useState<string>(() => toIsoDate(reserva.checkIn));
  const [dataSaida, setDataSaida] = useState<string>(() => toIsoDate(reserva.checkOut));
  const [qtdAdultos, setQtdAdultos] = useState<number>(() => reserva.adultos ?? 1);
  const [qtdCriancas, setQtdCriancas] = useState<number>(() => reserva.criancas ?? 0);

  // Noites calculadas dinamicamente
  const noitesCalculadas = useMemo(() => calcNoites(dataEntrada, dataSaida), [dataEntrada, dataSaida]);

  // Valor total da hospedagem e valor unitário da diária
  const [valorTotalEstadia, setValorTotalEstadia] = useState<number>(() => parseValor(reserva.valorTotal));
  const [valorDiariaUnitario, setValorDiariaUnitario] = useState<number>(() => {
    const total = parseValor(reserva.valorTotal);
    const n = reserva.noites || 1;
    return n > 0 && total > 0 ? total / n : total;
  });

  // Estados FNRH (Ficha Nacional de Registro de Hóspedes)
  const [nomeHospede, setNomeHospede] = useState('');
  const [documentoCpf, setDocumentoCpf] = useState('');
  const [telefoneHospede, setTelefoneHospede] = useState('');
  const [cidadeOrigem, setCidadeOrigem] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');

  // Estados para puxar hóspedes já cadastrados na base de dados
  const [listaHospedesCadastrados, setListaHospedesCadastrados] = useState<GuestData[]>([]);
  const [carregandoHospedes, setCarregandoHospedes] = useState(false);
  const [termoBuscaHospede, setTermoBuscaHospede] = useState('');
  const [dropdownHospedesAberto, setDropdownHospedesAberto] = useState(false);
  const [hospedeSelecionadoId, setHospedeSelecionadoId] = useState<string | null>(null);
  const [hospedeSelecionadoBase, setHospedeSelecionadoBase] = useState<GuestData | null>(null);
  const buscaHospedeRef = useRef<HTMLDivElement>(null);

  // Estados da Acomodação e Chave
  const [numeroChave, setNumeroChave] = useState('');
  const [observacoesCheckin, setObservacoesCheckin] = useState('');

  // Decisão Financeira: Pagar Agora vs Pagar no Check-out
  const [momentoPagamento, setMomentoPagamento] = useState<'entrada' | 'checkout'>('entrada');
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'Dinheiro' | 'Débito' | 'Crédito'>('PIX');
  const [valorDinheiroRecebido, setValorDinheiroRecebido] = useState<string>('');

  // Estados de Controle
  const [processando, setProcessando] = useState(false);
  const [sucessoCheckin, setSucessoCheckin] = useState(false);
  const [resumoFinal, setResumoFinal] = useState<{
    quarto: string;
    hospede: string;
    pago: boolean;
    valor: number;
    metodo: string;
    chave: string;
    troco: number;
  } | null>(null);

  // Fechar dropdown de busca ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buscaHospedeRef.current && !buscaHospedeRef.current.contains(event.target as Node)) {
        setDropdownHospedesAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Carregar lista de hóspedes cadastrados no hotel
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const carregarHospedes = async () => {
      setCarregandoHospedes(true);
      try {
        const dados = await hospedesService.getHospedes(reserva?.hotel_id);
        if (isMounted && dados) {
          setListaHospedesCadastrados(dados);

          // Se a reserva já tiver hospedeNome, tenta encontrar na base e preencher campos vazios
          if (reserva.hospedeNome) {
            const match = dados.find(g => 
              g.id === reserva.hospede_id || 
              g.name.trim().toLowerCase() === reserva.hospedeNome.trim().toLowerCase()
            );
            if (match) {
              setHospedeSelecionadoBase(match);
              setHospedeSelecionadoId(match.id);
              if (match.cpfCnpj) setDocumentoCpf(prev => prev || maskCpfCnpj(match.cpfCnpj));
              if (match.phone) setTelefoneHospede(prev => prev || maskPhone(match.phone));
              if (match.cidadeOrigem || match.lastStay) setCidadeOrigem(prev => prev || match.cidadeOrigem || match.lastStay);
              if (match.placaVeiculo) setPlacaVeiculo(prev => prev || match.placaVeiculo!.toUpperCase());
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar hóspedes da base:', err);
      } finally {
        if (isMounted) setCarregandoHospedes(false);
      }
    };
    carregarHospedes();
    return () => {
      isMounted = false;
    };
  }, [isOpen, reserva?.id, reserva?.hotel_id]);

  // Filtro de busca de hóspedes por Nome, CPF ou Telefone
  const hospedesFiltrados = useMemo(() => {
    if (!termoBuscaHospede.trim()) {
      return listaHospedesCadastrados.slice(0, 8);
    }
    const clean = termoBuscaHospede.toLowerCase().trim();
    const cleanDigits = clean.replace(/\D/g, '');
    return listaHospedesCadastrados.filter((h) => {
      const nomeMatch = (h.name || '').toLowerCase().includes(clean);
      const emailMatch = (h.email || '').toLowerCase().includes(clean);
      const cpfDigits = (h.cpfCnpj || '').replace(/\D/g, '');
      const phoneDigits = (h.phone || '').replace(/\D/g, '');
      const cpfMatch = cleanDigits ? cpfDigits.includes(cleanDigits) : false;
      const phoneMatch = cleanDigits ? phoneDigits.includes(cleanDigits) : false;
      return nomeMatch || emailMatch || cpfMatch || phoneMatch;
    }).slice(0, 15);
  }, [listaHospedesCadastrados, termoBuscaHospede]);

  // Ao selecionar um hóspede da base, preenche os campos automaticamente
  const handleSelecionarHospede = (h: GuestData) => {
    setHospedeSelecionadoBase(h);
    setHospedeSelecionadoId(h.id);
    setNomeHospede(h.name);
    if (h.cpfCnpj) setDocumentoCpf(maskCpfCnpj(h.cpfCnpj));
    if (h.phone) setTelefoneHospede(maskPhone(h.phone));
    if (h.cidadeOrigem || h.lastStay) setCidadeOrigem(h.cidadeOrigem || h.lastStay);
    if (h.placaVeiculo) setPlacaVeiculo(h.placaVeiculo.toUpperCase());
    setTermoBuscaHospede(h.name);
    setDropdownHospedesAberto(false);
  };

  // Limpar vínculo com o hóspede da base
  const handleLimparHospedeVinculado = () => {
    setHospedeSelecionadoBase(null);
    setHospedeSelecionadoId(null);
    setTermoBuscaHospede('');
  };

  // Atualização inteligente de datas e recálculo de valor proporcional
  const handleAlterarDataEntrada = (novaData: string) => {
    setDataEntrada(novaData);
    const n = calcNoites(novaData, dataSaida);
    if (valorDiariaUnitario > 0) {
      setValorTotalEstadia(parseFloat((n * valorDiariaUnitario).toFixed(2)));
    }
  };

  const handleAlterarDataSaida = (novaData: string) => {
    setDataSaida(novaData);
    const n = calcNoites(dataEntrada, novaData);
    if (valorDiariaUnitario > 0) {
      setValorTotalEstadia(parseFloat((n * valorDiariaUnitario).toFixed(2)));
    }
  };

  // Inicializar formulário com os dados da reserva selecionada
  useEffect(() => {
    if (reserva) {
      setNomeHospede(reserva.hospedeNome || '');
      setTelefoneHospede(reserva.hospedeTelefone ? maskPhone(reserva.hospedeTelefone) : '');
      setDocumentoCpf('');
      setCidadeOrigem('');
      setPlacaVeiculo('');
      
      const qNum = reserva.numero_quarto || reserva.quartoNome.replace(/\D/g, '');
      setNumeroChave(qNum ? `Chave #${qNum}` : 'Chave Acomodação');
      setObservacoesCheckin('');
      setMomentoPagamento('entrada');
      setMetodoPagamento('PIX');
      setValorDinheiroRecebido('');
      setProcessando(false);
      setSucessoCheckin(false);
      setResumoFinal(null);
      setTermoBuscaHospede('');
      setDropdownHospedesAberto(false);
      setHospedeSelecionadoId(reserva.hospede_id || null);
      setHospedeSelecionadoBase(null);

      // Inicializar Datas, Ocupantes e Valores
      const initialIn = toIsoDate(reserva.checkIn);
      const initialOut = toIsoDate(reserva.checkOut);
      setDataEntrada(initialIn);
      setDataSaida(initialOut);
      setQtdAdultos(reserva.adultos ?? 1);
      setQtdCriancas(reserva.criancas ?? 0);

      const totalVal = parseValor(reserva.valorTotal);
      const n = calcNoites(initialIn, initialOut);
      setValorTotalEstadia(totalVal);
      setValorDiariaUnitario(n > 0 && totalVal > 0 ? totalVal / n : totalVal);
    }
  }, [reserva?.id]);

  // Troco em dinheiro se pago na entrada
  const dinheiroRecebidoNum = parseFloat(valorDinheiroRecebido.replace(',', '.')) || 0;
  const trocoCalculado = momentoPagamento === 'entrada' && metodoPagamento === 'Dinheiro' && dinheiroRecebidoNum > valorTotalEstadia
    ? dinheiroRecebidoNum - valorTotalEstadia
    : 0;

  const handleConfirmarCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processando || !reserva) return;

    if (!nomeHospede.trim()) {
      alert('Por favor, informe o nome do hóspede.');
      return;
    }

    if (momentoPagamento === 'entrada' && metodoPagamento === 'Dinheiro' && dinheiroRecebidoNum > 0 && dinheiroRecebidoNum < valorTotalEstadia) {
      alert('O valor em dinheiro informado é menor do que o total da hospedagem.');
      return;
    }

    setProcessando(true);
    try {
      const qNumero = reserva.numero_quarto || reserva.quartoNome.replace(/\D/g, '') || reserva.quartoNome;
      const operadorNome = localStorage.getItem('hotelnozap_user_name') || 'Recepção';

      // 1. Se pago na entrada, lança obrigatoriamente no Caixa do hotel
      if (momentoPagamento === 'entrada' && valorTotalEstadia > 0) {
        caixaService.registrarRecebimentoCheckin({
          reservaId: reserva.id,
          reservaNumber: reserva.reservaNumber,
          hospedeNome: nomeHospede,
          quartoNumero: qNumero,
          valorTotal: valorTotalEstadia,
          metodo: metodoPagamento,
          operador: operadorNome,
          observacoes: observacoesCheckin || undefined,
          hotelId: reserva.hotel_id
        });
      }

      // 2. Executa a virada inteligente de status para 'Hospedado' e quarto para 'ocupado'
      const resultado = await reservasService.realizarCheckin(reserva.id, {
        documento: documentoCpf,
        telefone: telefoneHospede,
        cidadeOrigem: cidadeOrigem,
        placaVeiculo: placaVeiculo,
        numeroChave: numeroChave,
        observacoes: observacoesCheckin,
        pagoAgora: momentoPagamento === 'entrada',
        metodoPagamento: metodoPagamento,
        valorPago: momentoPagamento === 'entrada' ? valorTotalEstadia : 0,
        operador: operadorNome,
        dataCheckin: dataEntrada,
        dataCheckout: dataSaida,
        noites: noitesCalculadas,
        adultos: qtdAdultos,
        criancas: qtdCriancas,
        valorTotal: valorTotalEstadia,
        nomeHospede: nomeHospede,
        hospedeId: hospedeSelecionadoId || undefined
      });

      if (!resultado.success) {
        alert(resultado.error || 'Erro ao registrar check-in no sistema.');
        setProcessando(false);
        return;
      }

      // 3. Toca som de campainha da recepção
      playReceptionBell();

      // 4. Salva resumo final para a tela de confirmação
      setResumoFinal({
        quarto: reserva.quartoNome,
        hospede: nomeHospede,
        pago: momentoPagamento === 'entrada',
        valor: valorTotalEstadia,
        metodo: metodoPagamento,
        chave: numeroChave,
        troco: trocoCalculado
      });

      setSucessoCheckin(true);
      onSuccess(reserva.id, qNumero);
    } catch (err: any) {
      console.error('Falha no processo de check-in:', err);
      alert('Ocorreu um erro ao processar o check-in. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col font-sans">
        
        {/* ========================================================================= */}
        {/* TELA DE SUCESSO DO CHECK-IN */}
        {/* ========================================================================= */}
        {sucessoCheckin && resumoFinal ? (
          <div className="p-6 sm:p-8 text-center space-y-5 overflow-y-auto">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-emerald-200 animate-in zoom-in-75 duration-300">
              <span className="material-symbols-outlined text-3xl sm:text-4xl">key</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Check-in Realizado com Sucesso!
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                O hóspede já está hospedado e o quarto foi vinculado como <strong>Ocupado</strong>.
              </p>
            </div>

            {/* CARD DE RESUMO */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 text-left space-y-3 max-w-md mx-auto">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Hóspede:</span>
                <span className="font-bold text-slate-900">{resumoFinal.hospede}</span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Acomodação:</span>
                <span className="font-bold text-slate-900">{resumoFinal.quarto}</span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Chave / Acesso:</span>
                <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                  {resumoFinal.chave || 'Entregue'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Pagamento da Estadia:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${resumoFinal.pago ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {resumoFinal.pago ? `Pago na Entrada (${resumoFinal.metodo})` : 'A pagar no Check-out'}
                </span>
              </div>
              {resumoFinal.pago && (
                <div className="flex items-center justify-between pt-1 text-sm font-extrabold text-slate-900">
                  <span>Lançado no Caixa:</span>
                  <span className="text-lg font-black text-emerald-700">
                    R$ {resumoFinal.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {resumoFinal.troco > 0 && (
                <div className="flex items-center justify-between pt-1 text-xs font-bold text-amber-900 bg-amber-50 p-2 rounded-lg">
                  <span>Troco Entregue:</span>
                  <span>R$ {resumoFinal.troco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* AVISO DO MAPA DE QUARTOS */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 max-w-md mx-auto text-left text-xs">
              <span className="material-symbols-outlined text-emerald-700 text-2xl shrink-0">check_circle</span>
              <div>
                <span className="font-bold block">Status do Quarto: OCUPADO</span>
                <span className="text-[11px] text-emerald-700">O quarto está sincronizado no Mapa dos Quartos em todas as telas.</span>
              </div>
            </div>

            {/* BOTÃO DE CONCLUSÃO */}
            <div className="pt-3 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 bg-[#003400] hover:bg-[#002500] active:scale-95 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">check</span>
                <span>Concluir e Voltar</span>
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* FORMULÁRIO PRINCIPAL DE CHECK-IN */
          /* ========================================================================= */
          <form onSubmit={handleConfirmarCheckin} className="flex flex-col h-full overflow-hidden">
            
            {/* CABEÇALHO DO MODAL */}
            <div className="px-5 py-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-xs">
                  <span className="material-symbols-outlined text-xl">login</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 leading-none">
                      Realizar Check-in
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                      {reserva.reservaNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Entrada do hóspede, ficha FNRH, entrega de chaves e recebimento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* CORPO DO FORMULÁRIO COM ROLAGEM */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
              
              {/* CARD DE IDENTIFICAÇÃO DA ESTADIA */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#003400] text-emerald-400 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                    {reserva.numero_quarto || reserva.quartoNome.replace(/\D/g, '') || 'Q'}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{reserva.quartoNome}</h3>
                    <p className="text-xs text-slate-600 font-medium">{reserva.quartoTipo}</p>
                  </div>
                </div>
                <div className="flex sm:flex-col sm:items-end justify-between text-xs border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/50">
                  <span className="text-[11px] text-slate-500">Período Selecionado</span>
                  <span className="font-extrabold text-slate-900">
                    {formatBrDate(dataEntrada)} a {formatBrDate(dataSaida)} ({noitesCalculadas} {noitesCalculadas === 1 ? 'diária' : 'diárias'})
                  </span>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    {qtdAdultos} {qtdAdultos === 1 ? 'adulto' : 'adultos'}
                    {qtdCriancas > 0 ? ` • ${qtdCriancas} ${qtdCriancas === 1 ? 'criança' : 'crianças'}` : ''}
                  </span>
                </div>
              </div>

              {/* SEÇÃO: PERÍODO DA HOSPEDAGEM & OCUPANTES */}
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-emerald-700">calendar_month</span>
                    Período da Estadia & Ocupantes
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">hotel</span>
                    {noitesCalculadas} {noitesCalculadas === 1 ? 'diária' : 'diárias'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Data de Entrada */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-emerald-600">login</span>
                      Data de Entrada *
                    </label>
                    <input
                      type="date"
                      required
                      value={dataEntrada}
                      onChange={(e) => handleAlterarDataEntrada(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  {/* Data de Saída */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-amber-600">logout</span>
                      Data de Saída *
                    </label>
                    <input
                      type="date"
                      required
                      min={dataEntrada}
                      value={dataSaida}
                      onChange={(e) => handleAlterarDataSaida(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  {/* Quantidade de Adultos / Pessoas */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-slate-600">person</span>
                      Adultos / Pessoas
                    </label>
                    <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQtdAdultos((prev) => Math.max(1, prev - 1))}
                        className="w-9 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 font-bold transition-colors cursor-pointer flex items-center justify-center text-sm"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-bold text-xs sm:text-sm text-slate-800">
                        {qtdAdultos}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQtdAdultos((prev) => Math.min(20, prev + 1))}
                        className="w-9 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 font-bold transition-colors cursor-pointer flex items-center justify-center text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Quantidade de Crianças */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-slate-600">child_care</span>
                      Crianças (0-12 anos)
                    </label>
                    <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQtdCriancas((prev) => Math.max(0, prev - 1))}
                        className="w-9 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 font-bold transition-colors cursor-pointer flex items-center justify-center text-sm"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-bold text-xs sm:text-sm text-slate-800">
                        {qtdCriancas}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQtdCriancas((prev) => Math.min(20, prev + 1))}
                        className="w-9 py-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 font-bold transition-colors cursor-pointer flex items-center justify-center text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Ajuste do Valor Total da Estadia */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="text-slate-500 text-[11px]">
                    Diária base: <strong className="text-slate-700">R$ {valorDiariaUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    {noitesCalculadas > 1 && ` × ${noitesCalculadas} diárias`}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-600">Total da Estadia:</label>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorTotalEstadia}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          setValorTotalEstadia(v);
                          if (noitesCalculadas > 0) {
                            setValorDiariaUnitario(v / noitesCalculadas);
                          }
                        }}
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs font-black text-right text-emerald-950 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 1: FICHA CADASTRAL / FNRH */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-emerald-700">badge</span>
                    Ficha do Hóspede (FNRH)
                  </label>

                  {hospedeSelecionadoBase ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-in fade-in">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      Hóspede da Base Selecionado
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">
                      {listaHospedesCadastrados.length > 0 ? `${listaHospedesCadastrados.length} hóspedes cadastrados` : 'Base de dados ativa'}
                    </span>
                  )}
                </div>

                {/* BARRA DE PUXAR HÓSPEDE CADASTRADO */}
                <div ref={buscaHospedeRef} className="p-3 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-slate-50 border border-emerald-200/90 rounded-2xl relative space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-emerald-700 text-base">person_search</span>
                      <span className="text-xs font-black text-slate-800">
                        Puxar Hóspede Cadastrado na Base de Dados
                      </span>
                    </div>

                    {hospedeSelecionadoBase && (
                      <button
                        type="button"
                        onClick={handleLimparHospedeVinculado}
                        className="text-[10px] font-extrabold text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-0.5 cursor-pointer"
                        title="Desvincular para preencher manualmente"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                        <span>Limpar seleção</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                      search
                    </span>
                    <input
                      type="text"
                      value={termoBuscaHospede}
                      onChange={(e) => {
                        setTermoBuscaHospede(e.target.value);
                        setDropdownHospedesAberto(true);
                      }}
                      onFocus={() => setDropdownHospedesAberto(true)}
                      placeholder="Pesquise por nome, CPF ou WhatsApp para puxar dados do hóspede..."
                      className="w-full pl-9 pr-24 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 placeholder:text-slate-400 shadow-xs"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {carregandoHospedes ? (
                        <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDropdownHospedesAberto((prev) => !prev)}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer flex items-center gap-0.5 shadow-xs"
                        >
                          <span>Puxar</span>
                          <span className="material-symbols-outlined text-xs">
                            {dropdownHospedesAberto ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Dropdown Flutuante de Seleção */}
                    {dropdownHospedesAberto && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                        {carregandoHospedes ? (
                          <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando base de hóspedes...</span>
                          </div>
                        ) : hospedesFiltrados.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Nenhum hóspede cadastrado encontrado com "{termoBuscaHospede}".
                          </div>
                        ) : (
                          hospedesFiltrados.map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => handleSelecionarHospede(h)}
                              className="w-full p-2.5 sm:p-3 text-left hover:bg-emerald-50 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                                  {h.initials || (h.name ? h.name.substring(0, 2).toUpperCase() : 'HP')}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-slate-900 truncate">
                                    {h.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                    {h.cpfCnpj && <span>CPF: {h.cpfCnpj}</span>}
                                    {h.phone && <span>Tel: {h.phone}</span>}
                                    {(h.cidadeOrigem || h.lastStay) && (
                                      <span>• {h.cidadeOrigem || h.lastStay}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 group-hover:bg-emerald-700 group-hover:text-white px-2 py-1 rounded-lg transition-colors shrink-0 flex items-center gap-0.5">
                                <span>Puxar Dados</span>
                                <span className="material-symbols-outlined text-xs">arrow_forward</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Nome Completo */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nome Completo do Hóspede *
                    </label>
                    <input
                      type="text"
                      required
                      value={nomeHospede}
                      onChange={(e) => setNomeHospede(e.target.value)}
                      placeholder="Nome do hóspede"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  {/* CPF / Documento */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      CPF / Documento / Passaporte
                    </label>
                    <input
                      type="text"
                      value={documentoCpf}
                      onChange={(e) => setDocumentoCpf(maskCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  {/* Telefone / WhatsApp */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={telefoneHospede}
                      onChange={(e) => setTelefoneHospede(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  {/* Cidade / UF de Origem */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Cidade / UF de Origem
                    </label>
                    <input
                      type="text"
                      value={cidadeOrigem}
                      onChange={(e) => setCidadeOrigem(e.target.value)}
                      placeholder="Ex: São Paulo - SP"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  {/* Placa do Veículo */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Placa do Veículo (Estacionamento)
                    </label>
                    <input
                      type="text"
                      value={placaVeiculo}
                      onChange={(e) => setPlacaVeiculo(e.target.value.toUpperCase())}
                      placeholder="Ex: ABC-1D23"
                      maxLength={10}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-mono uppercase border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: CHAVE & ACOMODAÇÃO */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-700">vpn_key</span>
                  Chave & Acomodação
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Chave / Cartão / Senha de Acesso
                    </label>
                    <input
                      type="text"
                      value={numeroChave}
                      onChange={(e) => setNumeroChave(e.target.value)}
                      placeholder="Ex: Chave #100 ou Senha 1234"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Observações de Entrada
                    </label>
                    <input
                      type="text"
                      value={observacoesCheckin}
                      onChange={(e) => setObservacoesCheckin(e.target.value)}
                      placeholder="Ex: Cama extra montada, voltagem 220V"
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: COBRANÇA DA ESTADIA */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-emerald-700">payments</span>
                    Pagamento da Hospedagem
                  </label>
                  <span className="text-sm font-black text-slate-900">
                    Total: R$ {valorTotalEstadia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Seletor de Momento do Pagamento */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setMomentoPagamento('entrada')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      momentoPagamento === 'entrada'
                        ? 'bg-[#003400] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">point_of_sale</span>
                    <span>Pagar Agora na Entrada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMomentoPagamento('checkout')}
                    className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      momentoPagamento === 'checkout'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">schedule</span>
                    <span>Pagar no Check-out</span>
                  </button>
                </div>

                {/* Opções quando escolhe pagar agora */}
                {momentoPagamento === 'entrada' ? (
                  <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl space-y-3">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Forma de Recebimento no Caixa:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['PIX', 'Dinheiro', 'Débito', 'Crédito'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMetodoPagamento(m)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                            metodoPagamento === m
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {m === 'PIX' ? 'qr_code_2' : m === 'Dinheiro' ? 'payments' : m === 'Débito' ? 'credit_card' : 'credit_score'}
                          </span>
                          <span>{m}</span>
                        </button>
                      ))}
                    </div>

                    {/* Campo especial para dinheiro e cálculo de troco */}
                    {metodoPagamento === 'Dinheiro' && (
                      <div className="pt-2 border-t border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <label className="font-bold text-slate-700">Valor Entregue pelo Hóspede:</label>
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min={valorTotalEstadia}
                              placeholder="0,00"
                              value={valorDinheiroRecebido}
                              onChange={(e) => setValorDinheiroRecebido(e.target.value)}
                              className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right outline-none bg-white"
                            />
                          </div>
                        </div>

                        {trocoCalculado > 0 && (
                          <div className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-950 font-bold text-xs flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base">savings</span>
                            <span>Troco a devolver: <strong>R$ {trocoCalculado.toFixed(2)}</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
                    <span className="material-symbols-outlined text-amber-600 text-xl shrink-0">info</span>
                    <div>
                      <span className="font-bold block">Cobrança pendente para a saída</span>
                      <span className="text-[11px] text-amber-800">O valor total de R$ {valorTotalEstadia.toFixed(2)} será exibido no modal de Check-out para recebimento final.</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* RODAPÉ E BOTÕES DE AÇÃO */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={processando}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={processando}
                className="px-6 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002500] active:scale-95 text-white text-xs sm:text-sm font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {processando ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processando Check-in...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">key</span>
                    <span>Confirmar Check-in & Ocupar Quarto</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

export default ModalCheckinEntrada;
