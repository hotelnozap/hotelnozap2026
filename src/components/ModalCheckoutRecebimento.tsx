import React, { useState, useMemo, useEffect } from 'react';
import { Reserva } from './ListagemReservas';
import { caixaService } from '../services/caixaService';
import { reservasService, currentHotelService } from '../services/supabaseService';
import { templateMensagemService } from '../services/templateMensagemService';

export interface ModalCheckoutRecebimentoProps {
  isOpen: boolean;
  onClose: () => void;
  reserva: Reserva | null;
  onSuccess: (reservaId: string, valorTotal: number, metodo: string) => void;
}

export const ModalCheckoutRecebimento: React.FC<ModalCheckoutRecebimentoProps> = ({
  isOpen,
  onClose,
  reserva,
  onSuccess,
}) => {
  if (!isOpen || !reserva) return null;

  // Valor base da diária/estadia
  const valorBaseDiarias = useMemo(() => {
    if (!reserva.valorTotal) return 0;
    const num = parseFloat(
      reserva.valorTotal.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
    );
    return isNaN(num) ? 0 : num;
  }, [reserva.valorTotal]);

  // Estados Financeiros
  const [valorConsumoExtra, setValorConsumoExtra] = useState<string>('');
  const [descConsumo, setDescConsumo] = useState<string>('');
  const [valorDesconto, setValorDesconto] = useState<string>('');
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'Dinheiro' | 'Débito' | 'Crédito'>('PIX');
  const [valorDinheiroRecebido, setValorDinheiroRecebido] = useState<string>('');
  const [numParcelasCartao, setNumParcelasCartao] = useState<number>(1);
  const [observacoes, setObservacoes] = useState<string>('');
  const [processando, setProcessando] = useState<boolean>(false);
  const [sucessoCheckout, setSucessoCheckout] = useState<boolean>(false);
  const [resumoFinal, setResumoFinal] = useState<{ total: number; metodo: string; troco: number } | null>(null);

  // Resetar ao abrir com nova reserva
  useEffect(() => {
    setValorConsumoExtra('');
    setDescConsumo('');
    setValorDesconto('');
    setMetodoPagamento('PIX');
    setValorDinheiroRecebido('');
    setNumParcelasCartao(1);
    setObservacoes('');
    setProcessando(false);
    setSucessoCheckout(false);
    setResumoFinal(null);
  }, [reserva?.id]);

  // Cálculos dinâmicos
  const consumoNum = parseFloat(valorConsumoExtra.replace(',', '.')) || 0;
  const descontoNum = parseFloat(valorDesconto.replace(',', '.')) || 0;
  const totalReceber = Math.max(0, valorBaseDiarias + consumoNum - descontoNum);

  const dinheiroRecebidoNum = parseFloat(valorDinheiroRecebido.replace(',', '.')) || 0;
  const trocoCalculado = metodoPagamento === 'Dinheiro' && dinheiroRecebidoNum > totalReceber
    ? dinheiroRecebidoNum - totalReceber
    : 0;

  // Botões de consumo rápido (Frigobar / Itens comuns)
  const adicionarConsumoRapido = (valor: number, item: string) => {
    const atual = parseFloat(valorConsumoExtra.replace(',', '.')) || 0;
    const novo = (atual + valor).toFixed(2);
    setValorConsumoExtra(novo);
    setDescConsumo(prev => prev ? `${prev}, ${item}` : item);
  };

  const handleConfirmarCheckoutRecebimento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processando || !reserva) return;

    if (metodoPagamento === 'Dinheiro' && dinheiroRecebidoNum > 0 && dinheiroRecebidoNum < totalReceber) {
      alert('O valor em dinheiro informado é menor do que o total da estadia.');
      return;
    }

    setProcessando(true);
    try {
      // 1. Lança no Caixa obrigatoriamente
      if (totalReceber > 0) {
        caixaService.registrarRecebimentoCheckout({
          reservaId: reserva.id,
          reservaNumber: reserva.reservaNumber,
          hospedeNome: reserva.hospedeNome,
          quartoNumero: reserva.quartoNome.replace(/\D/g, '') || reserva.quartoNome,
          valorDiarias: valorBaseDiarias,
          valorConsumo: consumoNum > 0 ? consumoNum : undefined,
          valorDesconto: descontoNum > 0 ? descontoNum : undefined,
          valorTotal: totalReceber,
          metodo: metodoPagamento,
          operador: localStorage.getItem('hotelnozap_user_name') || 'Recepção',
          observacoes: observacoes || descConsumo,
          hotelId: reserva.hotel_id
        });
      }

      // 2. Conclui a reserva no banco de dados e altera quarto para 'limpeza'
      await reservasService.realizarCheckout(reserva.id, { isAutomatico: false });

      setResumoFinal({
        total: totalReceber,
        metodo: metodoPagamento,
        troco: trocoCalculado
      });
      setSucessoCheckout(true);
      onSuccess(reserva.id, totalReceber, metodoPagamento);
    } catch (err) {
      console.error('Erro ao processar checkout no caixa:', err);
      alert('Ocorreu um erro ao processar o check-out. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  };

  const openWhatsAppRecibo = async () => {
    if (!reserva || !resumoFinal) return;
    const rawPhone = reserva.hospedeTelefone ? reserva.hospedeTelefone.replace(/\D/g, '') : '';
    const formattedPhone = rawPhone.startsWith('55') ? rawPhone : (rawPhone ? `55${rawPhone}` : '');

    const activeHotel = currentHotelService.getCurrentHotel();
    const renderedCheckout = templateMensagemService.renderTemplate('checkout', {
      nome_hospede: reserva.hospedeNome,
      nome_hotel: activeHotel.name,
      numero_quarto: reserva.quartoNome,
      tipo_quarto: reserva.quartoTipo,
      checkin: reserva.checkIn,
      checkout: reserva.checkOut,
      valor_total: `R$ ${resumoFinal.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    });

    const mensagem =
      `${renderedCheckout}\n\n` +
      `🏨 *Acomodação:* ${reserva.quartoNome} (${reserva.quartoTipo})\n` +
      `📅 *Período:* ${reserva.checkIn} a ${reserva.checkOut} (${reserva.noites} noites)\n` +
      `💳 *Valor Pago:* R$ ${resumoFinal.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${resumoFinal.metodo})\n` +
      (consumoNum > 0 ? `🍾 *Consumo Frigobar:* R$ ${consumoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` : '') +
      `⭐ *Pontos Fidelidade:* +10 pontos acumulados!\n\n` +
      `Agradecemos pela sua preferência e esperamos recebê-lo novamente em breve!`;

    // Tenta envio direto pela Evolution API se houver instância conectada
    try {
      const res = await templateMensagemService.enviarMensagemWhatsApp(
        reserva.hotel_id || activeHotel.id,
        formattedPhone,
        mensagem
      );
      if (res.success) {
        alert(`Mensagem e recibo de check-out enviados com sucesso via WhatsApp oficial (${res.instanceName})!`);
        return;
      }
    } catch {}

    // Fallback: Abre no WhatsApp Web
    if (formattedPhone) {
      window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(mensagem)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* HEADER ESCURO COM IDENTIDADE #003400 */}
        <div className="bg-[#003400] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <span className="material-symbols-outlined text-2xl">point_of_sale</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black leading-tight">Recebimento & Check-out</h2>
                <span className="bg-[#B9CC01] text-[#003400] font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Caixa Sincronizado
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 font-mono mt-0.5">
                {reserva.reservaNumber} • {reserva.quartoNome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <span className="material-symbols-outlined text-base font-bold">close</span>
          </button>
        </div>

        {/* TELA DE SUCESSO / COMPROVANTE */}
        {sucessoCheckout && resumoFinal ? (
          <div className="p-6 sm:p-8 space-y-6 text-center overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#006c49] flex items-center justify-center mx-auto shadow-md">
              <span className="material-symbols-outlined text-4xl font-bold">check_circle</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Check-out Concluído com Sucesso!
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                O pagamento foi registrado e o quarto já foi enviado para higienização.
              </p>
            </div>

            {/* CARD DE RESUMO DO RECEBIMENTO */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 text-left space-y-3 max-w-md mx-auto">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Hóspede:</span>
                <span className="font-bold text-slate-900">{reserva.hospedeNome}</span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Acomodação:</span>
                <span className="font-bold text-slate-900">{reserva.quartoNome}</span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Forma de Pagamento:</span>
                <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                  {resumoFinal.metodo}
                </span>
              </div>
              {resumoFinal.troco > 0 && (
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 text-xs text-amber-900 bg-amber-50 p-2 rounded-lg font-bold">
                  <span>Troco Devolvido:</span>
                  <span>R$ {resumoFinal.troco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-sm font-extrabold text-slate-900">
                <span>Total Recebido no Caixa:</span>
                <span className="text-lg font-black text-emerald-700">
                  R$ {resumoFinal.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* AVISOS DE LIMPEZA E FIDELIDADE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto text-left text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-900">
                <span className="material-symbols-outlined text-amber-600 text-xl shrink-0">cleaning_services</span>
                <div>
                  <span className="font-bold block">Quarto em Limpeza</span>
                  <span className="text-[11px] text-amber-700">Equipe de governança notificada.</span>
                </div>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2.5 text-purple-900">
                <span className="material-symbols-outlined text-purple-600 text-xl shrink-0">workspace_premium</span>
                <div>
                  <span className="font-bold block">+10 Pts Fidelidade</span>
                  <span className="text-[11px] text-purple-700">Creditados na conta do hóspede.</span>
                </div>
              </div>
            </div>

            {/* BOTÕES DE AÇÃO PÓS CHECKOUT */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={openWhatsAppRecibo}
                className="w-full sm:w-auto px-6 py-3.5 bg-[#10B981] hover:bg-emerald-600 active:scale-95 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">chat</span>
                <span>Enviar Recibo no WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* FORMULÁRIO DE CHECKOUT E RECEBIMENTO */
          <form onSubmit={handleConfirmarCheckoutRecebimento} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
            
            {/* CARD DO HÓSPEDE E PERÍODO */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#003400] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {reserva.hospedeIniciais}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight">{reserva.hospedeNome}</h4>
                  <p className="text-xs text-slate-500">{reserva.quartoNome} • {reserva.quartoTipo}</p>
                </div>
              </div>
              <div className="text-left sm:text-right text-xs">
                <span className="text-slate-400 block text-[11px]">Período da Estadia</span>
                <span className="font-semibold text-slate-800">{reserva.checkIn} a {reserva.checkOut} ({reserva.noites}d)</span>
              </div>
            </div>

            {/* DISCRIMINAÇÃO DE VALORES (DIÁRIAS + CONSUMO + DESCONTO) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-700">receipt_long</span>
                  Composição da Conta
                </label>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                {/* Linha 1: Diárias */}
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-600 font-medium">
                    Diárias da Hospedagem ({reserva.noites} noites):
                  </span>
                  <span className="font-bold text-slate-900">
                    R$ {valorBaseDiarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Linha 2: Consumo Extra / Frigobar */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-base text-amber-600">kitchen</span>
                      Consumo Frigobar / Extras (+):
                    </span>
                    <div className="w-32">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={valorConsumoExtra}
                          onChange={(e) => setValorConsumoExtra(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Atalhos rápidos de frigobar */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Atalhos:</span>
                    <button
                      type="button"
                      onClick={() => adicionarConsumoRapido(6.00, '1x Água')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      + Água (R$ 6)
                    </button>
                    <button
                      type="button"
                      onClick={() => adicionarConsumoRapido(10.00, '1x Refri')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      + Refri (R$ 10)
                    </button>
                    <button
                      type="button"
                      onClick={() => adicionarConsumoRapido(15.00, '1x Cerveja')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      + Cerveja (R$ 15)
                    </button>
                    <button
                      type="button"
                      onClick={() => adicionarConsumoRapido(25.00, 'Petiscos')}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition-all cursor-pointer"
                    >
                      + Snack (R$ 25)
                    </button>
                  </div>
                </div>

                {/* Linha 3: Desconto */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-slate-500 font-medium">Desconto / Cortesia (-):</span>
                  <div className="w-32">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={valorDesconto}
                        onChange={(e) => setValorDesconto(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-right outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* TOTAL FINAL DESTACADO */}
                <div className="pt-3 border-t-2 border-dashed border-slate-200 flex items-center justify-between bg-emerald-50/60 -mx-4 -mb-4 p-4 rounded-b-2xl">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Total a Receber</span>
                    <span className="text-[10px] text-slate-500">Valor líquido para lançamento</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700">
                    R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* SELEÇÃO DE FORMA DE PAGAMENTO (DESKTOP & MOBILE FRIENDLY) */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-emerald-700">payments</span>
                Forma de Pagamento
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {/* Opção 1: PIX */}
                <button
                  type="button"
                  onClick={() => setMetodoPagamento('PIX')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    metodoPagamento === 'PIX'
                      ? 'bg-emerald-50 border-emerald-600 text-[#006c49] font-black shadow-xs ring-2 ring-emerald-600/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">qr_code_2</span>
                  <span className="text-xs">PIX</span>
                </button>

                {/* Opção 2: Dinheiro */}
                <button
                  type="button"
                  onClick={() => setMetodoPagamento('Dinheiro')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    metodoPagamento === 'Dinheiro'
                      ? 'bg-emerald-50 border-emerald-600 text-[#006c49] font-black shadow-xs ring-2 ring-emerald-600/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">payments</span>
                  <span className="text-xs">Dinheiro</span>
                </button>

                {/* Opção 3: Cartão de Crédito */}
                <button
                  type="button"
                  onClick={() => setMetodoPagamento('Crédito')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    metodoPagamento === 'Crédito'
                      ? 'bg-emerald-50 border-emerald-600 text-[#006c49] font-black shadow-xs ring-2 ring-emerald-600/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">credit_score</span>
                  <span className="text-xs">C. Crédito</span>
                </button>

                {/* Opção 4: Cartão de Débito */}
                <button
                  type="button"
                  onClick={() => setMetodoPagamento('Débito')}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    metodoPagamento === 'Débito'
                      ? 'bg-emerald-50 border-emerald-600 text-[#006c49] font-black shadow-xs ring-2 ring-emerald-600/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">credit_card</span>
                  <span className="text-xs">C. Débito</span>
                </button>
              </div>

              {/* DETALHES ESPECÍFICOS CONFORME MÉTODO ESCOLHIDO */}
              {metodoPagamento === 'Dinheiro' && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-amber-900">
                      Valor em Dinheiro Entregue pelo Hóspede:
                    </label>
                    <div className="relative w-full sm:w-40">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={totalReceber}
                        placeholder={totalReceber.toFixed(2)}
                        value={valorDinheiroRecebido}
                        onChange={(e) => setValorDinheiroRecebido(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-right outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  {trocoCalculado > 0 && (
                    <div className="pt-2 border-t border-amber-200 flex items-center justify-between text-xs font-black text-amber-950">
                      <span>Troco a Devolver ao Hóspede:</span>
                      <span className="text-sm text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs">
                        R$ {trocoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {metodoPagamento === 'Crédito' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs animate-in fade-in duration-200">
                  <span className="text-slate-600 font-medium">Parcelamento na Maquininha:</span>
                  <select
                    value={numParcelasCartao}
                    onChange={(e) => setNumParcelasCartao(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-800 outline-none"
                  >
                    <option value={1}>À vista (1x de R$ {totalReceber.toFixed(2)})</option>
                    <option value={2}>2x de R$ {(totalReceber / 2).toFixed(2)}</option>
                    <option value={3}>3x de R$ {(totalReceber / 3).toFixed(2)}</option>
                    <option value={4}>4x de R$ {(totalReceber / 4).toFixed(2)}</option>
                    <option value={6}>6x de R$ {(totalReceber / 6).toFixed(2)}</option>
                  </select>
                </div>
              )}

              {metodoPagamento === 'PIX' && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-lg">verified</span>
                    <span className="text-emerald-950 font-medium">
                      Chave PIX do Hotel pronta para recebimento instantâneo.
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    0% Taxa
                  </span>
                </div>
              )}
            </div>


            {/* BOTÕES DE AÇÃO INFERIORES */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={processando}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={processando}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {processando ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    <span>Processando Check-out...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg text-[#B9CC01]">check_circle</span>
                    <span>Confirmar Recebimento & Check-out</span>
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
