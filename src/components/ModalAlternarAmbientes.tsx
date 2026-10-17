import React from 'react';

export type TipoAmbiente = 'hotel' | 'parceiro' | 'hospede' | 'master' | 'catalogo';

export interface ModalAlternarAmbientesProps {
  isOpen: boolean;
  onClose: () => void;
  ambienteAtual?: TipoAmbiente;
  onSelecionarAmbiente: (ambiente: TipoAmbiente) => void;
  isAdmin?: boolean;
  isParceiro?: boolean;
  isHotel?: boolean;
  isHospede?: boolean;
  temCadastroHospede?: boolean;
  temCadastroParceiro?: boolean;
  temCadastroHotel?: boolean;
  temHotelDemo?: boolean;
  hotelDemoNome?: string;
  userEmail?: string;
  userName?: string;
  hotelNome?: string;
}

export const ModalAlternarAmbientes: React.FC<ModalAlternarAmbientesProps> = ({
  isOpen,
  onClose,
  ambienteAtual = 'hotel',
  onSelecionarAmbiente,
  isAdmin = false,
  isParceiro = false,
  isHotel = false,
  isHospede = false,
  temCadastroHospede = false,
  temCadastroParceiro = false,
  temCadastroHotel = false,
  temHotelDemo = false,
  hotelDemoNome = '',
  userEmail = '',
  userName = '',
  hotelNome = 'Hotel no Zap'
}) => {
  if (!isOpen) return null;

  const ambientes: Array<{
    id: TipoAmbiente;
    titulo: string;
    subtitulo: string;
    descricao: string;
    icone: string;
    badgeCor: string;
    iconeCor: string;
    bordaHover: string;
  }> = [];

  // 1. Painel do Hotel: Visível se for Hotel/Gerente, tiver cadastro de hotel, for Master Admin OU se tiver Hotel Demo
  const podeAcessarHotel = isAdmin || isHotel || temCadastroHotel;
  if (podeAcessarHotel) {
    ambientes.push({
      id: 'hotel',
      titulo: 'Painel do Hotel (Recepção & Gestão)',
      subtitulo: hotelNome || 'Operação do Estabelecimento',
      descricao: 'Mapa de ocupação, reservas, controle de caixa, pedidos do cardápio e conexões do WhatsApp.',
      icone: 'hotel',
      badgeCor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      iconeCor: 'bg-emerald-500/10 text-emerald-700',
      bordaHover: 'hover:border-emerald-500 hover:shadow-emerald-500/10'
    });
  } else if (temHotelDemo || isParceiro) {
    // Para franqueados/parceiros com Hotel Demo de Demonstração
    ambientes.push({
      id: 'hotel',
      titulo: 'Painel do Meu Hotel Demo (Demonstração)',
      subtitulo: hotelDemoNome || hotelNome || 'Pousada de Demonstração',
      descricao: 'Painel 100% liberado com reservas, quartos, mapa e cardápio para demonstrar aos seus futuros clientes.',
      icone: 'hotel',
      badgeCor: 'bg-amber-100 text-amber-900 border-amber-300',
      iconeCor: 'bg-amber-500/10 text-amber-700',
      bordaHover: 'hover:border-amber-500 hover:shadow-amber-500/10'
    });
  }

  // 2. Portal do Franqueado / Parceiro: Visível se for Parceiro, tiver cadastro de parceiro ou for Master Admin
  const podeAcessarParceiro = isAdmin || isParceiro || temCadastroParceiro;
  if (podeAcessarParceiro) {
    ambientes.push({
      id: 'parceiro',
      titulo: 'Portal do Franqueado / Parceiro',
      subtitulo: 'Gestão de Franquia & Comissões de 50%',
      descricao: 'Acompanhe seus hotéis indicados, comissões recorrentes, previsão de repasses PIX e link de afiliado.',
      icone: 'handshake',
      badgeCor: 'bg-blue-100 text-blue-900 border-blue-300',
      iconeCor: 'bg-blue-500/10 text-blue-700',
      bordaHover: 'hover:border-blue-500 hover:shadow-blue-500/10'
    });
  }

  // 3. Área do Hóspede: Visível se for Hóspede, Parceiro (duplo cadastro ou viajante), Hotel ou Master Admin
  const podeAcessarHospede = isAdmin || isHospede || temCadastroHospede || isParceiro;
  if (podeAcessarHospede) {
    ambientes.push({
      id: 'hospede',
      titulo: 'Área do Hóspede (Minha Conta)',
      subtitulo: 'Experiência do Viajante',
      descricao: 'Minhas reservas ativas, histórico de estadias, cardápio digital do quarto e cupons de desconto.',
      icone: 'luggage',
      badgeCor: 'bg-amber-100 text-amber-900 border-amber-300',
      iconeCor: 'bg-amber-500/10 text-amber-700',
      bordaHover: 'hover:border-amber-500 hover:shadow-amber-500/10'
    });
  }

  // 4. Painel Master Admin: SOMENTE E EXCLUSIVAMENTE para Super Administrador REAL
  if (isAdmin) {
    ambientes.push({
      id: 'master',
      titulo: 'Painel Master Admin',
      subtitulo: 'Super Administrador da Plataforma',
      descricao: 'Gestão global de todos os hotéis, parâmetros do sistema, planos SaaS e métricas gerais.',
      icone: 'shield_person',
      badgeCor: 'bg-purple-100 text-purple-900 border-purple-300',
      iconeCor: 'bg-purple-500/10 text-purple-700',
      bordaHover: 'hover:border-purple-500 hover:shadow-purple-500/10'
    });
  }

  // 5. Catálogo Público: Sempre visível para todos
  ambientes.push({
    id: 'catalogo',
    titulo: 'Catálogo Público & Reserva Online',
    subtitulo: 'Portal de Busca de Hotéis',
    descricao: 'Vitrine pública onde hóspedes buscam cidades, comparam quartos e iniciam reservas diretas.',
    icone: 'travel_explore',
    badgeCor: 'bg-teal-100 text-teal-900 border-teal-300',
    iconeCor: 'bg-teal-500/10 text-teal-700',
    bordaHover: 'hover:border-teal-500 hover:shadow-teal-500/10'
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabeçalho */}
        <div className="p-6 bg-gradient-to-r from-[#003400] via-[#002600] to-black text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <span className="material-symbols-outlined text-2xl font-black">sync_alt</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">Alternar Ambiente</h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Multitelas
                </span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Alterne entre suas visões de parceiro, gestão do hotel e hóspede com 1 clique.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Informações da Conta */}
        {(userName || userEmail) && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2 truncate">
              <span className="material-symbols-outlined text-base text-emerald-700">account_circle</span>
              <span className="font-bold text-slate-800">{userName || 'Usuário'}</span>
              {userEmail && <span className="text-slate-400 hidden sm:inline">({userEmail})</span>}
            </div>
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
              Sessão unificada ativa
            </span>
          </div>
        )}

        {/* Lista de Ambientes Disponíveis */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-3">
          {ambientes.map((amb) => {
            const isAtual = ambienteAtual === amb.id;
            return (
              <button
                key={amb.id}
                type="button"
                onClick={() => {
                  onSelecionarAmbiente(amb.id);
                  onClose();
                }}
                className={`w-full p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-4 cursor-pointer group ${
                  isAtual
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : `border-slate-200 bg-white ${amb.bordaHover} hover:bg-slate-50/50 hover:shadow-md`
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${amb.iconeCor}`}>
                  <span className="material-symbols-outlined text-2xl">{amb.icone}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-black text-slate-900 text-sm sm:text-base group-hover:text-emerald-800 transition-colors truncate">
                      {amb.titulo}
                    </span>
                    {isAtual ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shrink-0 shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Ambiente Atual
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-emerald-700 transition-colors text-xl">
                        chevron_right
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-500 block mb-1">
                    {amb.subtitulo}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {amb.descricao}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Rodapé com Dica */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-amber-500">lightbulb</span>
            <span>Você pode alternar entre as visões a qualquer momento sem deslogar.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
