import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ArrowDownRight, ArrowUpRight, PlusCircle, CheckCircle } from 'lucide-react';
import { caixaService, CaixaMovimentacao } from '../services/caixaService';

export const ControleCaixaMobile: React.FC = () => {
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>(() => caixaService.getMovimentacoes());

  useEffect(() => {
    const carregar = () => {
      setMovimentacoes(caixaService.getMovimentacoes());
    };

    // Sincroniza reservas concluídas com o caixa
    caixaService.sincronizarReservasConcluidasComCaixa().then(() => {
      carregar();
    });

    const handleReservaModificada = (e: any) => {
      const reserva = e?.detail;
      if (reserva && reserva.status && reserva.status.toLowerCase().includes('concl')) {
        caixaService.registrarReservaConcluida(reserva);
      }
      carregar();
    };

    window.addEventListener('hotel_caixa_atualizado', carregar);
    window.addEventListener('hotel_reserva_modificada', handleReservaModificada);
    window.addEventListener('storage', carregar);

    let bc: BroadcastChannel | null = null;
    let notifBc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_caixa_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'CAIXA_ATUALIZADO') {
          carregar();
        }
      };
    } catch {}

    try {
      notifBc = new BroadcastChannel('hotel_notifications_channel');
      notifBc.onmessage = (event) => {
        if (event.data?.type === 'CHECKOUT_REALIZADO' || event.data?.type === 'NOVA_RESERVA_HOSPEDE') {
          caixaService.sincronizarReservasConcluidasComCaixa().then(() => {
            carregar();
          });
        }
      };
    } catch {}

    return () => {
      window.removeEventListener('hotel_caixa_atualizado', carregar);
      window.removeEventListener('hotel_reserva_modificada', handleReservaModificada);
      window.removeEventListener('storage', carregar);
      if (bc) bc.close();
      if (notifBc) notifBc.close();
    };
  }, []);

  const totalEntradas = movimentacoes
    .filter((m) => m.type === 'entrada')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalSaidas = movimentacoes
    .filter((m) => m.type === 'saida')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const saldo = totalEntradas - totalSaidas;

  const ultimasMovimentacoes = [...movimentacoes].slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[390px] bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col justify-between min-h-[720px] font-sans text-slate-100 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Controle de Caixa</h2>
              <p className="text-[11px] text-slate-400">Caixa do Dia • Hotel no Zap</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
            <CheckCircle className="w-3 h-3" />
            <span>ABERTO</span>
          </span>
        </div>

        {/* Saldo Main Card */}
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Saldo Atual no Caixa</span>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center space-x-2.5 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Entradas</span>
                <span className="text-xs font-bold text-emerald-400">R$ {totalEntradas.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10">
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Saídas</span>
                <span className="text-xs font-bold text-rose-400">R$ {totalSaidas.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Button */}
        <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
          <PlusCircle className="w-5 h-5 stroke-[2.5]" />
          <span>Lançar Entrada / Saída</span>
        </button>

        {/* Recent Transactions */}
        <div className="space-y-3 flex-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Últimas Movimentações</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {ultimasMovimentacoes.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Nenhuma movimentação registrada.</p>
            ) : (
              ultimasMovimentacoes.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/80 rounded-xl">
                  <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
                    <div className={t.type === 'entrada' ? 'p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0' : 'p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0'}>
                      {t.type === 'entrada' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{t.description}</h4>
                      <span className="text-[10px] text-slate-500">{t.time} • {t.method}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${t.type === 'entrada' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.type === 'entrada' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
