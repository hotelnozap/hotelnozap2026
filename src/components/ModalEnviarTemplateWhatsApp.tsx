import React, { useState, useEffect } from 'react';
import {
  templateMensagemService,
  TemplateType,
  TemplateTags
} from '../services/templateMensagemService';
import { maskPhone } from '../utils/masks';

export interface ModalEnviarTemplateWhatsAppProps {
  isOpen: boolean;
  onClose: () => void;
  hotelId?: string;
  hotelName?: string;
  hospedeNome: string;
  hospedeTelefone: string;
  quartoNome?: string;
  quartoTipo?: string;
  checkIn?: string;
  checkOut?: string;
  valorTotal?: string;
  defaultTemplate?: TemplateType;
  onSuccess?: (msg: string) => void;
}

export const ModalEnviarTemplateWhatsApp: React.FC<ModalEnviarTemplateWhatsAppProps> = ({
  isOpen,
  onClose,
  hotelId,
  hotelName,
  hospedeNome,
  hospedeTelefone,
  quartoNome,
  quartoTipo,
  checkIn,
  checkOut,
  valorTotal,
  defaultTemplate = 'confirmacao',
  onSuccess
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(defaultTemplate);
  const [mensagem, setMensagem] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [instanciaStatus, setInstanciaStatus] = useState<{
    instanceName: string | null;
    isOnline: boolean;
    checking: boolean;
  }>({
    instanceName: null,
    isOnline: false,
    checking: true
  });
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Tags da reserva
  const tags: TemplateTags = {
    nome_hospede: hospedeNome || 'Hóspede',
    nome_hotel: hotelName || 'Hotel no Zap',
    link_hotel: templateMensagemService.getHotelPublicLink(hotelId),
    numero_quarto: quartoNome || 'Suíte',
    tipo_quarto: quartoTipo || 'Acomodação',
    checkin: checkIn || '',
    checkout: checkOut || '',
    valor_total: valorTotal || 'R$ 0,00'
  };

  // Carregar status da conexão do hotel na Evolution API
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setFeedback(null);
    setInstanciaStatus((prev) => ({ ...prev, checking: true }));

    templateMensagemService.getInstanciaConectadaDoHotel(hotelId).then((res) => {
      if (isMounted) {
        setInstanciaStatus({
          instanceName: res.instanceName,
          isOnline: res.isOnline,
          checking: false
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, hotelId]);

  // Atualizar mensagem quando o template selecionado mudar
  useEffect(() => {
    if (isOpen) {
      const rendered = templateMensagemService.renderTemplate(selectedTemplate, tags, hotelId);
      setMensagem(rendered);
    }
  }, [selectedTemplate, isOpen, hospedeNome, quartoNome, checkIn, checkOut, valorTotal, hotelId]);

  if (!isOpen) return null;

  // Enviar diretamente via Evolution API
  const handleEnviarEvolution = async () => {
    if (!hospedeTelefone || !mensagem.trim() || enviando) return;

    setEnviando(true);
    setFeedback(null);

    try {
      const res = await templateMensagemService.enviarMensagemWhatsApp(
        hotelId,
        hospedeTelefone,
        mensagem
      );

      if (res.success) {
        setFeedback({
          tipo: 'sucesso',
          texto: `Mensagem enviada com sucesso para o WhatsApp de ${hospedeNome} via ${res.instanceName}!`
        });
        if (onSuccess) {
          onSuccess(`Mensagem enviada para ${hospedeNome} via WhatsApp oficial!`);
        }
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setFeedback({
          tipo: 'erro',
          texto: res.error || 'Não foi possível enviar a mensagem pela Evolution API.'
        });
      }
    } catch (err: any) {
      setFeedback({
        tipo: 'erro',
        texto: err?.message || 'Erro inesperado ao disparar mensagem.'
      });
    } finally {
      setEnviando(false);
    }
  };

  // Abrir no WhatsApp Web
  const handleAbrirWhatsAppWeb = () => {
    const link = templateMensagemService.gerarLinkWhatsAppWeb(hospedeTelefone, mensagem);
    window.open(link, '_blank');
    if (onSuccess) {
      onSuccess(`Conversa aberta no WhatsApp Web para ${hospedeNome}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header Verde Escuro */}
        <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">chat</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Enviar Mensagem WhatsApp</h3>
              <p className="text-[11px] text-emerald-200">
                Templates integrados à Evolution API • {hotelName || 'Hotel no Zap'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Status da Conexão Evolution API */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  instanciaStatus.checking
                    ? 'bg-slate-400 animate-pulse'
                    : instanciaStatus.isOnline
                    ? 'bg-emerald-600 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-slate-700 truncate font-semibold">
                {instanciaStatus.checking
                  ? 'Verificando conexão da Evolution API...'
                  : instanciaStatus.isOnline
                  ? `WhatsApp Oficial Conectado: ${instanciaStatus.instanceName}`
                  : 'Nenhuma conexão WhatsApp ativa no momento (use o WhatsApp Web)'}
              </span>
            </div>
            {instanciaStatus.isOnline && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-black text-[10px] uppercase shrink-0">
                Online
              </span>
            )}
          </div>

          {/* Dados do Destinatário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-emerald-50/50 border border-emerald-200/70 rounded-2xl text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Hóspede</span>
              <strong className="text-slate-900 text-sm font-black">{hospedeNome}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Telefone / WhatsApp</span>
              <strong className="text-emerald-900 text-sm font-mono font-bold">
                {maskPhone(hospedeTelefone)}
              </strong>
            </div>
          </div>

          {/* Seleção do Template */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Escolha o Template de Mensagem:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'confirmacao', label: 'Confirmação de Reserva', icon: 'check_circle' },
                { id: 'lembrete_checkin', label: 'Lembrete Check-in (24h)', icon: 'alarm' },
                { id: 'boas_vindas', label: 'Boas-Vindas & Contato', icon: 'waving_hand' },
                { id: 'checkout', label: 'Pós Check-out & Avaliação', icon: 'star' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id as any)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    selectedTemplate === t.id
                      ? 'bg-[#003400] text-white border-[#003400] shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base shrink-0">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor da Mensagem */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Conteúdo da Mensagem:
              </label>
              <button
                type="button"
                onClick={() => {
                  const rendered = templateMensagemService.renderTemplate(selectedTemplate, tags, hotelId);
                  setMensagem(rendered);
                }}
                className="text-[11px] text-emerald-800 hover:underline font-bold cursor-pointer"
              >
                Restaurar Padrão
              </button>
            </div>
            <textarea
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="w-full p-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#003400]/20 focus:border-[#003400] font-sans leading-relaxed focus:outline-none"
              placeholder="Digite a mensagem..."
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Você pode editar o texto acima antes de disparar.
            </span>
          </div>

          {/* Feedback de Envio */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                feedback.tipo === 'sucesso'
                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                  : 'bg-red-100 text-red-950 border border-red-300'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {feedback.tipo === 'sucesso' ? 'check_circle' : 'error'}
              </span>
              <span>{feedback.texto}</span>
            </div>
          )}
        </div>

        {/* Footer com Botões de Envio */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Botão WhatsApp Web */}
            <button
              type="button"
              onClick={handleAbrirWhatsAppWeb}
              disabled={enviando}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-[#1fba58] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              title="Abrir a mensagem preenchida no WhatsApp Web"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              <span>WhatsApp Web</span>
            </button>

            {/* Botão Enviar Evolution API */}
            <button
              type="button"
              onClick={handleEnviarEvolution}
              disabled={enviando || !instanciaStatus.isOnline}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap ${
                instanciaStatus.isOnline
                  ? 'bg-[#003400] hover:bg-[#002500] text-white disabled:opacity-50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title={
                instanciaStatus.isOnline
                  ? 'Disparar diretamente pela Evolution API'
                  : 'Requer uma instância de WhatsApp conectada no hotel'
              }
            >
              {enviando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base text-emerald-300">send</span>
                  <span>Enviar pelo Evolution API</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalEnviarTemplateWhatsApp;
