import React, { useState, useEffect, useMemo } from 'react';
import { HotelAtivo, reservasService, quartosService, hospedesService } from '../services/supabaseService';
import { Reserva } from './ListagemReservas';
import { caixaService, CaixaMovimentacao } from '../services/caixaService';
import { GuestData } from './ListagemHospedes';
import { maskCpfCnpj, maskPhone } from '../utils/masks';

export interface RelatoriosHotelProps {
  activeHotel: HotelAtivo;
  onBackToDashboard?: () => void;
}

type TipoRelatorio = 'ocupacao' | 'reservas' | 'financeiro' | 'fnrh' | 'consumo';
type PeriodoFiltro = 'hoje' | 'ontem' | '7dias' | 'mes' | '30dias' | 'personalizado';

const parseValor = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const formatLocalYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const normalizeDateToYmd = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().split('T')[0].split(' ')[0];
  // Formato brasileiro DD/MM/AAAA (ex: "22/09/2026")
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const parts = clean.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  // Formato ISO AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // Tentar parse nativo
  try {
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return formatLocalYmd(parsed);
    }
  } catch {}
  return clean;
};

export const RelatoriosHotel: React.FC<RelatoriosHotelProps> = ({ activeHotel, onBackToDashboard }) => {
  // Estado dos Filtros
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorio>('ocupacao');
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return formatLocalYmd(d);
  });
  const [dataFim, setDataFim] = useState<string>(() => formatLocalYmd(new Date()));
  const [filtroStatusReserva, setFiltroStatusReserva] = useState<string>('todos');

  // Dados Carregados
  const [carregando, setCarregando] = useState<boolean>(true);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [quartos, setQuartos] = useState<any[]>([]);
  const [transacoes, setTransacoes] = useState<CaixaMovimentacao[]>([]);
  const [hospedes, setHospedes] = useState<GuestData[]>([]);
  const [pedidosServico, setPedidosServico] = useState<any[]>([]);

  // Operador atual
  const operadorNome = useMemo(() => {
    try {
      return localStorage.getItem('hotelnozap_user_name') || 'Recepção / Gerência';
    } catch {
      return 'Recepção / Gerência';
    }
  }, []);

  // Data/hora atual de geração
  const dataHoraEmissao = useMemo(() => {
    const agora = new Date();
    return {
      data: agora.toLocaleDateString('pt-BR'),
      hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: agora.getTime()
    };
  }, [tipoRelatorio, periodo, dataInicio, dataFim]);

  // Carregar dados de todas as fontes operacionais do hotel
  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [resList, qList, hList] = await Promise.all([
        reservasService.getReservas(activeHotel?.id),
        quartosService.getQuartos(activeHotel?.id),
        hospedesService.getHospedes(activeHotel?.id)
      ]);

      setReservas(resList || []);
      setQuartos(qList || []);
      setHospedes(hList || []);

      // Transações do caixa (agrega todas as movimentações registradas)
      const trans = caixaService.getMovimentacoes(activeHotel?.id);
      setTransacoes(trans || []);

      // Pedidos de recepção salvos
      try {
        const rawPedidos = localStorage.getItem('hotel_notificacoes_pedidos');
        if (rawPedidos) {
          const list = JSON.parse(rawPedidos);
          if (Array.isArray(list)) setPedidosServico(list);
        }
      } catch {}
    } catch (err) {
      console.warn('Erro ao carregar dados para relatórios:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [activeHotel?.id]);

  // Sincroniza em tempo real caso novos lançamentos de caixa ocorram
  useEffect(() => {
    const handleCaixaAtualizado = () => {
      const trans = caixaService.getMovimentacoes(activeHotel?.id);
      setTransacoes(trans || []);
    };

    window.addEventListener('hotel_caixa_atualizado', handleCaixaAtualizado);
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes('caixa')) {
        handleCaixaAtualizado();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('hotel_caixa_atualizado', handleCaixaAtualizado);
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeHotel?.id]);

  // Recarrega movimentações sempre que o usuário selecionar a aba Financeiro & Caixa
  useEffect(() => {
    if (tipoRelatorio === 'financeiro') {
      const trans = caixaService.getMovimentacoes(activeHotel?.id);
      setTransacoes(trans || []);
    }
  }, [tipoRelatorio, activeHotel?.id]);

  // Ajusta intervalo de datas com base no atalho de período
  const handleMudarPeriodo = (p: PeriodoFiltro) => {
    setPeriodo(p);
    const hoje = new Date();
    const hojeStr = formatLocalYmd(hoje);

    if (p === 'hoje') {
      setDataInicio(hojeStr);
      setDataFim(hojeStr);
    } else if (p === 'ontem') {
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);
      const ontemStr = formatLocalYmd(ontem);
      setDataInicio(ontemStr);
      setDataFim(ontemStr);
    } else if (p === '7dias') {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      setDataInicio(formatLocalYmd(seteDiasAtras));
      setDataFim(hojeStr);
    } else if (p === 'mes') {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      setDataInicio(formatLocalYmd(primeiroDia));
      setDataFim(hojeStr);
    } else if (p === '30dias') {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      setDataInicio(formatLocalYmd(trintaDiasAtras));
      setDataFim(hojeStr);
    }
  };

  // Helper de filtragem por data que converte com precisão DD/MM/AAAA para YYYY-MM-DD
  const isDentroDoPeriodo = (dataIsoOuStr?: string | null) => {
    if (!dataIsoOuStr) return true;
    const ymd = normalizeDateToYmd(dataIsoOuStr);
    if (!ymd) return true;
    if (dataInicio && ymd < dataInicio) return false;
    if (dataFim && ymd > dataFim) return false;
    return true;
  };

  // 1. DADOS DE OCUPAÇÃO & MAPA DE QUARTOS
  const dadosOcupacao = useMemo(() => {
    const total = quartos.length || 1;
    const ocupados = quartos.filter(q => (q.status || '').toLowerCase() === 'ocupado').length;
    const disponiveis = quartos.filter(q => (q.status || '').toLowerCase() === 'disponivel' || !q.status).length;
    const limpeza = quartos.filter(q => (q.status || '').toLowerCase() === 'limpeza').length;
    const manutencao = quartos.filter(q => (q.status || '').toLowerCase() === 'manutencao').length;
    const taxaOcupacao = total > 0 ? Math.round((ocupados / total) * 100) : 0;

    return {
      total,
      ocupados,
      disponiveis,
      limpeza,
      manutencao,
      taxaOcupacao,
      lista: quartos
    };
  }, [quartos]);

  // 2. DADOS DE RESERVAS NO PERÍODO
  const dadosReservasFiltradas = useMemo(() => {
    return reservas.filter(r => {
      // Filtro de data (considera data_checkin ou criado_em)
      const dataRef = r.checkIn || (r.criado_em ? r.criado_em.split('T')[0] : '');
      if (!isDentroDoPeriodo(dataRef)) return false;

      // Filtro de status
      if (filtroStatusReserva !== 'todos') {
        const st = (r.status || '').toLowerCase();
        if (filtroStatusReserva === 'confirmadas' && !st.includes('confirm')) return false;
        if (filtroStatusReserva === 'hospedado' && !st.includes('hosped')) return false;
        if (filtroStatusReserva === 'concluida' && !st.includes('concl')) return false;
        if (filtroStatusReserva === 'cancelada' && !st.includes('canc')) return false;
      }

      return true;
    });
  }, [reservas, dataInicio, dataFim, filtroStatusReserva]);

  const totaisReservas = useMemo(() => {
    let faturamento = 0;
    let checkins = 0;
    let checkouts = 0;

    dadosReservasFiltradas.forEach(r => {
      faturamento += parseValor(r.valor_total || r.valorTotal);
      const st = (r.status || '').toLowerCase();
      if (st.includes('hosped')) checkins++;
      if (st.includes('concl')) checkouts++;
    });

    return {
      quantidade: dadosReservasFiltradas.length,
      faturamento,
      checkins,
      checkouts
    };
  }, [dadosReservasFiltradas]);

  // 3. DADOS FINANCEIROS & FLUXO DE CAIXA
  const dadosFinanceirosFiltrados = useMemo(() => {
    return transacoes.filter(t => {
      if (!isDentroDoPeriodo(t.date)) return false;
      return true;
    });
  }, [transacoes, dataInicio, dataFim]);

  const totaisFinanceiros = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let pix = 0;
    let dinheiro = 0;
    let cartao = 0;

    dadosFinanceirosFiltrados.forEach(t => {
      const val = Number(t.amount || 0);
      if (t.type === 'entrada') {
        entradas += val;
        if (t.method === 'PIX') pix += val;
        else if (t.method === 'Dinheiro') dinheiro += val;
        else cartao += val;
      } else {
        saidas += val;
      }
    });

    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
      pix,
      dinheiro,
      cartao,
      totalTransacoes: dadosFinanceirosFiltrados.length
    };
  }, [dadosFinanceirosFiltrados]);

  // 4. DADOS DE HÓSPEDES & FNRH
  const dadosHospedesFiltrados = useMemo(() => {
    return hospedes.filter(h => {
      return true; // Lista completa dos hóspedes registrados do hotel
    });
  }, [hospedes]);

  // 5. DADOS DE CONSUMO / PEDIDOS DE SERVIÇO
  const dadosConsumoFiltrados = useMemo(() => {
    return pedidosServico.filter(p => {
      if (!isDentroDoPeriodo(p.data || p.horario)) return false;
      return true;
    });
  }, [pedidosServico, dataInicio, dataFim]);

  // Ação de Impressão Nativa (Abre o diálogo de impressão do navegador já timbrado)
  const handleImprimir = () => {
    window.print();
  };

  // Ação de Exportação CSV
  const handleExportarCsv = () => {
    let csvContent = '\uFEFF'; // BOM UTF-8 para o Excel abrir com acentos corretos
    const hotelNome = activeHotel.name || 'Hotel';

    if (tipoRelatorio === 'ocupacao') {
      csvContent += `RELATORIO DE OCUPACAO E MAPA DE QUARTOS - ${hotelNome}\n`;
      csvContent += `Emitido em: ${dataHoraEmissao.data} as ${dataHoraEmissao.hora}\n\n`;
      csvContent += 'Quarto;Tipo/Categoria;Status;Hospede Atual;Diaria (R$)\n';
      dadosOcupacao.lista.forEach(q => {
        csvContent += `"${q.number || q.numero}";"${q.type || q.tipo || 'Standard'}";"${q.status || 'Disponível'}";"${q.guestName || '-'}";"${Number(q.price || q.diaria || 0).toFixed(2)}"\n`;
      });
    } else if (tipoRelatorio === 'reservas') {
      csvContent += `RELATORIO DE RESERVAS E HOSPEDAGENS - ${hotelNome}\n`;
      csvContent += `Periodo: ${dataInicio} a ${dataFim}\n`;
      csvContent += `Emitido em: ${dataHoraEmissao.data} as ${dataHoraEmissao.hora}\n\n`;
      csvContent += 'Reserva;Hospede;Quarto;Check-in;Check-out;Diarias;Valor Total (R$);Status;Forma Pagamento\n';
      dadosReservasFiltradas.forEach(r => {
        csvContent += `"${r.reservaNumber}";"${r.hospedeNome}";"${r.quartoNome}";"${r.checkIn}";"${r.checkOut}";"${r.noites}";"${parseValor(r.valor_total || r.valorTotal).toFixed(2)}";"${r.status}";"${r.formaPagamento}"\n`;
      });
    } else if (tipoRelatorio === 'financeiro') {
      csvContent += `RELATORIO FINANCEIRO E FLUXO DE CAIXA - ${hotelNome}\n`;
      csvContent += `Periodo: ${dataInicio} a ${dataFim}\n`;
      csvContent += `Emitido em: ${dataHoraEmissao.data} as ${dataHoraEmissao.hora}\n\n`;
      csvContent += 'Data/Hora;Descricao;Categoria;Quarto;Metodo;Tipo;Valor (R$)\n';
      dadosFinanceirosFiltrados.forEach(t => {
        csvContent += `"${t.date} ${t.time}";"${t.description}";"${t.category}";"${t.quartoNumero || '-'}";"${t.method}";"${t.type === 'entrada' ? 'Entrada' : 'Saída'}";"${Number(t.amount || 0).toFixed(2)}"\n`;
      });
    } else if (tipoRelatorio === 'fnrh') {
      csvContent += `FICHA NACIONAL DE REGISTRO DE HOSPEDES (FNRH) - ${hotelNome}\n`;
      csvContent += `Emitido em: ${dataHoraEmissao.data} as ${dataHoraEmissao.hora}\n\n`;
      csvContent += 'Nome do Hospede;CPF/Documento;Telefone/WhatsApp;Cidade/UF;Placa Veiculo;Status\n';
      dadosHospedesFiltrados.forEach(h => {
        csvContent += `"${h.name}";"${h.cpfCnpj}";"${h.phone}";"${h.cidadeOrigem || '-'}";"${h.placaVeiculo || '-'}";"${h.status}"\n`;
      });
    } else if (tipoRelatorio === 'consumo') {
      csvContent += `RELATORIO DE PEDIDOS E CONSUMO DE HOSPEDES - ${hotelNome}\n`;
      csvContent += `Periodo: ${dataInicio} a ${dataFim}\n`;
      csvContent += `Emitido em: ${dataHoraEmissao.data} as ${dataHoraEmissao.hora}\n\n`;
      csvContent += 'Quarto;Hospede;Item/Descricao;Categoria;Horario;Status\n';
      dadosConsumoFiltrados.forEach(p => {
        csvContent += `"${p.quartoNumero || '-'}";"${p.hospedeNome || 'Hóspede'}";"${p.itemNome || '-'}";"${p.categoria || 'Geral'}";"${p.horario || '-'}";"${p.read ? 'Atendido' : 'Pendente'}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `relatorio_${tipoRelatorio}_${activeHotel.name || 'hotel'}_${dataInicio}_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Título e descrição do relatório ativo
  const infoRelatorio = useMemo(() => {
    switch (tipoRelatorio) {
      case 'ocupacao':
        return {
          titulo: 'Relatório de Ocupação & Mapa de Hospedagem',
          descricao: 'Situação em tempo real de acomodações, ocupação atual, quartos em limpeza e manutenção.',
          icone: 'calendar_view_month'
        };
      case 'reservas':
        return {
          titulo: 'Relatório Gerencial de Reservas & Estadias',
          descricao: 'Controle detalhado de chegadas (check-ins), partidas (check-outs), diárias e faturamento de hospedagem.',
          icone: 'book_online'
        };
      case 'financeiro':
        return {
          titulo: 'Relatório Financeiro & Fechamento de Caixa',
          descricao: 'Entradas, saídas, receitas por forma de pagamento (PIX, Cartão, Dinheiro) e saldo operacional.',
          icone: 'payments'
        };
      case 'fnrh':
        return {
          titulo: 'FNRH - Ficha Nacional de Registro de Hóspedes',
          descricao: 'Histórico cadastral com documentos (CPF), cidades de origem, telefones e veículos dos hóspedes.',
          icone: 'badge'
        };
      case 'consumo':
        return {
          titulo: 'Relatório de Consumo & Pedidos dos Quartos',
          descricao: 'Movimentação de frigobar, solicitações à recepção e consumos extras realizados pelos hóspedes.',
          icone: 'room_service'
        };
    }
  }, [tipoRelatorio]);

  return (
    <div className="space-y-6">
      
      {/* ESTILOS DE IMPRESSÃO DEDICADOS (OCULTAM SIDEBAR, BOTÕES E TORNAM O RELATÓRIO TIMBRADO PERFEITO NO PAPEL A4) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Oculta tudo que não faz parte do relatório impresso */
          nav, aside, header, footer, button, .no-print, .action-bar, .app-sidebar, .mobile-nav {
            display: none !important;
          }
          /* Remove margens e scrollbars desnecessárias */
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-timbre {
            display: block !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            padding: 6px 8px !important;
            font-size: 9pt !important;
          }
        }
      `}</style>

      {/* PAINEL DE CONTROLE / FILTROS SUPERIORES (OCULTO NA IMPRESSÃO) */}
      <div className="no-print bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#003400] text-white flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-2xl">assessment</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Central de Relatórios & Impressão
                </h1>
                <p className="text-xs text-slate-500">
                  Emissão de relatórios timbrados oficiais para <strong className="text-emerald-900">{activeHotel.name || 'Hotel Morada da Lua'}</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportarCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 border border-slate-200"
              title="Exportar dados para planilha Excel (.csv)"
            >
              <span className="material-symbols-outlined text-base text-emerald-700">file_download</span>
              <span>Exportar Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handleImprimir}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#003400] hover:bg-[#002500] text-white rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer shadow-xs active:scale-95"
              title="Imprimir relatório timbrado (Ctrl + P)"
            >
              <span className="material-symbols-outlined text-lg text-emerald-400">print</span>
              <span>Imprimir Relatório Timbrado</span>
            </button>
          </div>
        </div>

        {/* SELETOR DE RELATÓRIO (TABS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          {[
            { id: 'ocupacao' as TipoRelatorio, label: 'Ocupação & Quartos', icon: 'calendar_view_month' },
            { id: 'reservas' as TipoRelatorio, label: 'Reservas & Estadias', icon: 'book_online' },
            { id: 'financeiro' as TipoRelatorio, label: 'Financeiro & Caixa', icon: 'payments' },
            { id: 'fnrh' as TipoRelatorio, label: 'FNRH / Hóspedes', icon: 'badge' },
            { id: 'consumo' as TipoRelatorio, label: 'Consumo & Pedidos', icon: 'room_service' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTipoRelatorio(tab.id)}
              className={`flex items-center gap-2 p-3 rounded-2xl text-xs font-extrabold transition cursor-pointer border ${
                tipoRelatorio === tab.id
                  ? 'bg-[#003400] text-white border-[#003400] shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-slate-100'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${tipoRelatorio === tab.id ? 'text-emerald-400' : 'text-slate-500'}`}>
                {tab.icon}
              </span>
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* BARRA DE FILTROS DE DATA E STATUS */}
        {tipoRelatorio !== 'ocupacao' && tipoRelatorio !== 'fnrh' && (
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-600 mr-1">Período:</span>
              {[
                { id: 'hoje', label: 'Hoje' },
                { id: 'ontem', label: 'Ontem' },
                { id: '7dias', label: '7 Dias' },
                { id: 'mes', label: 'Este Mês' },
                { id: '30dias', label: '30 Dias' },
                { id: 'personalizado', label: 'Personalizado' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleMudarPeriodo(p.id as PeriodoFiltro)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    periodo === p.id
                      ? 'bg-white text-[#003400] shadow-2xs border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">De:</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPeriodo('personalizado');
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-mono"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-[11px]">Até:</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPeriodo('personalizado');
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-mono"
                />
              </div>

              {tipoRelatorio === 'reservas' && (
                <select
                  value={filtroStatusReserva}
                  onChange={(e) => setFiltroStatusReserva(e.target.value)}
                  className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-bold"
                >
                  <option value="todos">Status: Todos</option>
                  <option value="confirmadas">Confirmadas</option>
                  <option value="hospedado">Hospedados (Check-in)</option>
                  <option value="concluida">Concluídas (Check-out)</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CORPO DO RELATÓRIO TIMBRADO OFICIAL (VISÍVEL NA TELA E IMPRESSO)           */}
      {/* ========================================================================= */}
      <div className="print-full-width bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-6">
        
        {/* CABEÇALHO TIMBRADO OFICIAL DO HOTEL */}
        <div className="border-b-2 border-emerald-950 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            {/* Brasão e Identificação do Hotel */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#003400] text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-sm border border-emerald-800 shrink-0">
                {activeHotel.name ? activeHotel.name.charAt(0).toUpperCase() : 'H'}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block">
                  HOTELARIA & GESTÃO DE HOSPEDAGEM
                </span>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {activeHotel.name || 'Hotel Morada da Lua'}
                </h2>
                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {activeHotel.cnpj && <span><strong>CNPJ:</strong> {maskCpfCnpj(activeHotel.cnpj)}</span>}
                  {activeHotel.cityUf && <span>• <strong>Localização:</strong> {activeHotel.cityUf}</span>}
                  {activeHotel.whatsapp && <span>• <strong>WhatsApp:</strong> {maskPhone(activeHotel.whatsapp)}</span>}
                </div>
              </div>
            </div>

            {/* Caixa de Autenticidade & Emissão */}
            <div className="text-right sm:border-l sm:border-slate-200 sm:pl-5 space-y-1">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                Documento Oficial
              </span>
              <div className="text-xs text-slate-700">
                <div><strong>Emissão:</strong> {dataHoraEmissao.data} às {dataHoraEmissao.hora}</div>
                <div><strong>Operador:</strong> {operadorNome}</div>
                <div className="text-[10px] text-slate-400 font-mono">HNZ-REL-{dataHoraEmissao.timestamp.toString().slice(-6)}</div>
              </div>
            </div>
          </div>

          {/* Faixa Título do Relatório Específico */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-800 text-xl">{infoRelatorio.icone}</span>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wide">
                {infoRelatorio.titulo}
              </h3>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {tipoRelatorio === 'ocupacao' || tipoRelatorio === 'fnrh' ? (
                <span>Posição Operacional Consolidada</span>
              ) : (
                <span>Período de Apuração: <strong>{new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARDS DE RESUMO & KPIS DO RELATÓRIO ATIVO                                 */}
        {/* ========================================================================= */}
        {tipoRelatorio === 'ocupacao' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 page-break-inside-avoid">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Total Quartos</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{dadosOcupacao.total}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Ocupados</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900">{dadosOcupacao.ocupados}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-700 uppercase block">Disponíveis</span>
              <span className="text-xl sm:text-2xl font-black text-blue-900">{dadosOcupacao.disponiveis}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-700 uppercase block">Em Limpeza</span>
              <span className="text-xl sm:text-2xl font-black text-amber-900">{dadosOcupacao.limpeza}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200">
              <span className="text-[11px] font-bold text-red-700 uppercase block">Manutenção</span>
              <span className="text-xl sm:text-2xl font-black text-red-900">{dadosOcupacao.manutencao}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#003400] text-white border border-[#003400]">
              <span className="text-[11px] font-bold text-emerald-300 uppercase block">Taxa Ocupação</span>
              <span className="text-xl sm:text-2xl font-black text-white">{dadosOcupacao.taxaOcupacao}%</span>
            </div>
          </div>
        )}

        {tipoRelatorio === 'reservas' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 page-break-inside-avoid">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Reservas no Período</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{totaisReservas.quantidade}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Faturamento Total</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900">
                R$ {totaisReservas.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-700 uppercase block">Hospedados Ativos</span>
              <span className="text-xl sm:text-2xl font-black text-blue-900">{totaisReservas.checkins}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
              <span className="text-[11px] font-bold text-purple-700 uppercase block">Check-outs Realizados</span>
              <span className="text-xl sm:text-2xl font-black text-purple-900">{totaisReservas.checkouts}</span>
            </div>
          </div>
        )}

        {tipoRelatorio === 'financeiro' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 page-break-inside-avoid">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Total Recebido (Entradas)</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900">
                R$ {totaisFinanceiros.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200">
              <span className="text-[11px] font-bold text-red-700 uppercase block">Total Saídas / Sangrias</span>
              <span className="text-xl sm:text-2xl font-black text-red-900">
                R$ {totaisFinanceiros.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#003400] text-white border border-[#003400]">
              <span className="text-[11px] font-bold text-emerald-300 uppercase block">Saldo Operacional Líquido</span>
              <span className="text-xl sm:text-2xl font-black text-white">
                R$ {totaisFinanceiros.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Recebido em PIX</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                R$ {totaisFinanceiros.pix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {tipoRelatorio === 'fnrh' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 page-break-inside-avoid">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Total de Hóspedes Cadastrados</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{dadosHospedesFiltrados.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Hóspedes Ativos</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900">
                {dadosHospedesFiltrados.filter(h => h.status === 'ativo').length}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] font-bold text-blue-700 uppercase block">Veículos no Estacionamento</span>
              <span className="text-xl sm:text-2xl font-black text-blue-900">
                {dadosHospedesFiltrados.filter(h => h.placaVeiculo && h.placaVeiculo.trim().length > 3).length}
              </span>
            </div>
          </div>
        )}

        {tipoRelatorio === 'consumo' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 page-break-inside-avoid">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Total de Pedidos e Solicitações</span>
              <span className="text-xl sm:text-2xl font-black text-slate-900">{dadosConsumoFiltrados.length}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Pedidos Atendidos</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-900">
                {dadosConsumoFiltrados.filter(p => p.read).length}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-700 uppercase block">Solicitações Pendentes</span>
              <span className="text-xl sm:text-2xl font-black text-amber-900">
                {dadosConsumoFiltrados.filter(p => !p.read).length}
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TABELAS DE DADOS TIMBRADAS                                                */}
        {/* ========================================================================= */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl page-break-inside-avoid">
          {carregando ? (
            <div className="p-12 text-center text-slate-400">
              <span className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-sm font-semibold">Carregando dados do relatório...</p>
            </div>
          ) : (
            <>
              {/* TABELA 1: OCUPAÇÃO */}
              {tipoRelatorio === 'ocupacao' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#003400] text-white border-b border-emerald-950 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Quarto</th>
                      <th className="p-3">Tipo / Categoria</th>
                      <th className="p-3">Diária Padrão</th>
                      <th className="p-3">Status Atual</th>
                      <th className="p-3">Hóspede Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dadosOcupacao.lista.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400">Nenhum quarto cadastrado no hotel.</td>
                      </tr>
                    ) : (
                      dadosOcupacao.lista.map((q, idx) => {
                        const st = (q.status || 'disponivel').toLowerCase();
                        let badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                        let stLabel = 'Disponível';
                        if (st === 'ocupado') {
                          badgeColor = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                          stLabel = 'Ocupado';
                        } else if (st === 'limpeza') {
                          badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
                          stLabel = 'Em Limpeza';
                        } else if (st === 'manutencao') {
                          badgeColor = 'bg-red-100 text-red-900 border-red-300';
                          stLabel = 'Manutenção';
                        }

                        return (
                          <tr key={q.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="p-3 font-extrabold text-slate-900">
                              Quarto {q.number || q.numero}
                            </td>
                            <td className="p-3 text-slate-600 font-medium">{q.type || q.tipo || 'Acomodação Padrão'}</td>
                            <td className="p-3 text-slate-900 font-mono font-bold">
                              R$ {Number(q.price || q.diaria || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${badgeColor}`}>
                                {stLabel}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700 font-medium">
                              {q.guestName || (st === 'ocupado' ? 'Hóspede Registrado' : '-')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {/* TABELA 2: RESERVAS */}
              {tipoRelatorio === 'reservas' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#003400] text-white border-b border-emerald-950 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Código</th>
                      <th className="p-3">Hóspede</th>
                      <th className="p-3">Quarto</th>
                      <th className="p-3">Entrada (Check-in)</th>
                      <th className="p-3">Saída (Check-out)</th>
                      <th className="p-3 text-center">Diárias</th>
                      <th className="p-3">Valor Total</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dadosReservasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400">Nenhuma reserva encontrada para o período selecionado.</td>
                      </tr>
                    ) : (
                      dadosReservasFiltradas.map((r, idx) => (
                        <tr key={r.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-3 font-mono font-bold text-slate-900">{r.reservaNumber}</td>
                          <td className="p-3 font-bold text-slate-800">{r.hospedeNome}</td>
                          <td className="p-3 text-slate-600">{r.quartoNome}</td>
                          <td className="p-3 text-slate-700 font-mono">
                            {r.checkIn ? new Date(r.checkIn + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-3 text-slate-700 font-mono">
                            {r.checkOut ? new Date(r.checkOut + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">{r.noites}</td>
                          <td className="p-3 font-mono font-black text-emerald-900">
                            R$ {parseValor(r.valor_total || r.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-200">
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {dadosReservasFiltradas.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={6} className="p-3 text-right uppercase text-[11px]">Total Faturado no Período:</td>
                        <td colSpan={2} className="p-3 font-black text-sm text-emerald-950 font-mono">
                          R$ {totaisReservas.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}

              {/* TABELA 3: FINANCEIRO */}
              {tipoRelatorio === 'financeiro' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#003400] text-white border-b border-emerald-950 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Data/Hora</th>
                      <th className="p-3">Descrição da Movimentação</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Forma de Pagamento</th>
                      <th className="p-3">Operador</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dadosFinanceirosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">Nenhuma movimentação de caixa registrada no período.</td>
                      </tr>
                    ) : (
                      dadosFinanceirosFiltrados.map((t, idx) => (
                        <tr key={t.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{t.date} {t.time}</td>
                          <td className="p-3 font-bold text-slate-800">{t.description}</td>
                          <td className="p-3 text-slate-600">{t.category}</td>
                          <td className="p-3 font-medium text-slate-700">{t.method}</td>
                          <td className="p-3 text-slate-500">{t.operator || 'Recepção'}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              t.type === 'entrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {t.type === 'entrada' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-mono font-black ${
                            t.type === 'entrada' ? 'text-emerald-900' : 'text-red-700'
                          }`}>
                            {t.type === 'saida' ? '-' : '+'} R$ {Number(t.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {dadosFinanceirosFiltrados.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={6} className="p-3 text-right uppercase text-[11px]">Saldo Líquido no Período:</td>
                        <td className={`p-3 text-right font-black text-sm font-mono ${
                          totaisFinanceiros.saldo >= 0 ? 'text-emerald-950' : 'text-red-700'
                        }`}>
                          R$ {totaisFinanceiros.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}

              {/* TABELA 4: FNRH / HÓSPEDES */}
              {tipoRelatorio === 'fnrh' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#003400] text-white border-b border-emerald-950 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Nome Completo do Hóspede</th>
                      <th className="p-3">CPF / Documento</th>
                      <th className="p-3">Telefone / WhatsApp</th>
                      <th className="p-3">Cidade / UF de Origem</th>
                      <th className="p-3">Placa do Veículo</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dadosHospedesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">Nenhum registro de hóspede encontrado.</td>
                      </tr>
                    ) : (
                      dadosHospedesFiltrados.map((h, idx) => (
                        <tr key={h.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-3 font-bold text-slate-900">{h.name}</td>
                          <td className="p-3 font-mono text-slate-700">{maskCpfCnpj(h.cpfCnpj)}</td>
                          <td className="p-3 font-mono text-slate-700">{maskPhone(h.phone)}</td>
                          <td className="p-3 text-slate-600">{h.cidadeOrigem || '-'}</td>
                          <td className="p-3 font-mono font-bold text-slate-800 uppercase">{h.placaVeiculo || '-'}</td>
                          <td className="p-3">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-200">
                              {h.status || 'Ativo'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TABELA 5: CONSUMO / PEDIDOS */}
              {tipoRelatorio === 'consumo' && (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#003400] text-white border-b border-emerald-950 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Quarto</th>
                      <th className="p-3">Hóspede</th>
                      <th className="p-3">Item Solicitado / Descrição</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Data / Horário</th>
                      <th className="p-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {dadosConsumoFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">Nenhum consumo ou solicitação registrada para o período selecionado.</td>
                      </tr>
                    ) : (
                      dadosConsumoFiltrados.map((p, idx) => (
                        <tr key={p.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-3 font-extrabold text-slate-900">Quarto {p.quartoNumero || '101'}</td>
                          <td className="p-3 font-bold text-slate-800">{p.hospedeNome || 'Hóspede'}</td>
                          <td className="p-3 text-slate-700 font-medium">{p.itemNome || p.descricao}</td>
                          <td className="p-3 text-slate-600">{p.categoria || 'Serviço'}</td>
                          <td className="p-3 font-mono text-slate-500">{p.horario || 'Hoje'}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.read ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.read ? 'Atendido' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RODAPÉ TIMBRADO OFICIAL COM LINHAS DE ASSINATURA E AUTENTICIDADE          */}
        {/* ========================================================================= */}
        <div className="pt-8 border-t border-slate-300 space-y-6 page-break-inside-avoid">
          <p className="text-[11px] text-slate-500 italic text-center leading-relaxed">
            Certifico para os devidos fins que as informações consolidadas neste relatório foram extraídas fielmente
            da base de dados operacional do <strong>{activeHotel.name || 'Hotel'}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-8 pt-6 max-w-xl mx-auto text-center">
            <div className="space-y-1">
              <div className="border-t border-slate-700 w-full pt-1.5" />
              <span className="text-xs font-bold text-slate-900 block">{operadorNome}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Responsável pela Recepção</span>
            </div>
            <div className="space-y-1">
              <div className="border-t border-slate-700 w-full pt-1.5" />
              <span className="text-xs font-bold text-slate-900 block">Gerência Geral</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">{activeHotel.name || 'Hotel Morada da Lua'}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 font-mono pt-4 border-t border-slate-100">
            <span>Sistema Hotel no Zap • Gestão Hoteleira em Nuvem</span>
            <span>Relatório timbrado gerado em {dataHoraEmissao.data} às {dataHoraEmissao.hora}</span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default RelatoriosHotel;
