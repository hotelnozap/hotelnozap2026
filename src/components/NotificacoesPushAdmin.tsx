import React, { useState, useEffect, useRef } from 'react';
import { pushNotificationService, PushNotificationHistoryItem } from '../services/pushNotificationService';
import { uploadImageToStorage } from '../services/storageService';

interface NotificacoesPushAdminProps {
  onBackToDashboard: () => void;
  currentUserRole?: string;
  isHotelUser?: boolean;
}

const TEMPLATE_SUGESTOES = [
  {
    titulo: '🔥 Ofertas Exclusivas no Hotel no Zap!',
    mensagem: 'Encontre pousadas e hotéis com tarifas especiais e reserve direto pelo WhatsApp.',
    url: 'https://hotelnozap.com.br'
  },
  {
    titulo: '🏨 Planejando o próximo final de semana?',
    mensagem: 'Confira as melhores acomodações disponíveis perto de você com confirmação imediata!',
    url: 'https://hotelnozap.com.br'
  },
  {
    titulo: '⭐ Reserve em 1 Minuto no WhatsApp',
    mensagem: 'Sem taxas extras e com atendimento humanizado. Veja as novidades do Hotel no Zap.',
    url: 'https://hotelnozap.com.br'
  }
];

export const NotificacoesPushAdmin: React.FC<NotificacoesPushAdminProps> = ({
  onBackToDashboard,
  currentUserRole,
  isHotelUser = false
}) => {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [url, setUrl] = useState('https://hotelnozap.com.br');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [segmento, setSegmento] = useState<'all' | 'active'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [historico, setHistorico] = useState<PushNotificationHistoryItem[]>([]);
  const [isConfirmingSend, setIsConfirmingSend] = useState(false);

  // Verificação estrita de privilégio administrativo
  const roleLower = (currentUserRole || localStorage.getItem('hotelnozap_user_role') || '').toLowerCase();
  const isAdmin = !isHotelUser && (roleLower.includes('admin') || roleLower.includes('super') || roleLower.includes('master'));

  const showToast = (tipo: 'sucesso' | 'erro', texto: string) => {
    setToast({ tipo, texto });
    setTimeout(() => setToast(null), 5000);
  };

  const loadHistory = () => {
    setHistorico(pushNotificationService.getHistory());
  };

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => loadHistory();
    window.addEventListener('hotel_push_history_updated', handleUpdate);
    return () => {
      window.removeEventListener('hotel_push_history_updated', handleUpdate);
    };
  }, []);

  const handleApplyTemplate = (tpl: typeof TEMPLATE_SUGESTOES[0]) => {
    setTitulo(tpl.titulo);
    setMensagem(tpl.mensagem);
    setUrl(tpl.url);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('erro', 'Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('erro', 'A imagem deve ter no máximo 5MB.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadedUrl = await uploadImageToStorage(file, 'notificacoes');
      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
        showToast('sucesso', 'Imagem enviada com sucesso!');
      } else {
        showToast('erro', 'Falha ao enviar imagem. Verifique sua conexão.');
      }
    } catch (err: any) {
      console.error('Erro no upload da imagem:', err);
      showToast('erro', 'Erro ao fazer upload da imagem.');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendNotification = async () => {
    if (!titulo.trim()) {
      showToast('erro', 'Informe o título da notificação.');
      return;
    }
    if (!mensagem.trim()) {
      showToast('erro', 'Informe a mensagem da notificação.');
      return;
    }

    setIsConfirmingSend(false);
    setIsSubmitting(true);

    try {
      const result = await pushNotificationService.sendNotification({
        title: titulo.trim(),
        message: mensagem.trim(),
        url: url.trim() || 'https://hotelnozap.com.br',
        imageUrl: imageUrl.trim() || undefined,
        segment: segmento
      });

      if (result.success) {
        showToast('sucesso', `Notificação enviada com sucesso! (${result.recipients ?? 0} destinatário(s) notificado(s)).`);
        setTitulo('');
        setMensagem('');
        setImageUrl('');
        loadHistory();
      } else {
        showToast('erro', result.error || 'Falha ao enviar notificação.');
      }
    } catch (err: any) {
      showToast('erro', err?.message || 'Erro inesperado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar o histórico de notificações locais?')) {
      pushNotificationService.clearHistory();
      loadHistory();
      showToast('sucesso', 'Histórico limpo com sucesso.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700">
          <span className="material-symbols-outlined text-4xl mb-2 text-red-500">lock</span>
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-sm mt-1">Apenas administradores do sistema SaaS têm permissão para acessar o painel de Notificações Push.</p>
          <button
            onClick={onBackToDashboard}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all animate-bounce ${
            toast.tipo === 'sucesso'
              ? 'bg-emerald-900/90 text-white border-emerald-500 backdrop-blur-md'
              : 'bg-red-900/90 text-white border-red-500 backdrop-blur-md'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.tipo === 'sucesso' ? 'check_circle' : 'error'}
          </span>
          <span>{toast.texto}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm"
            title="Voltar ao Painel"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Disparador de Notificações Push
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                OneSignal
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Envio instantâneo de alertas para celulares (Android/iOS) e navegadores dos hóspedes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://dashboard.onesignal.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Painel OneSignal
          </a>
        </div>
      </div>

      {/* Grid Principal: Formulário + Prévia */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna do Formulário (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card de Configuração e Disparo */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                <span className="material-symbols-outlined text-emerald-600">campaign</span>
                <span>Nova Campanha Push</span>
              </div>
              <span className="text-xs text-slate-400">Público: Web &amp; Mobile</span>
            </div>

            {/* Modelos Rápidos */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-amber-500">magic_button</span>
                Sugestões Rápidas de Mensagens:
              </label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_SUGESTOES.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/80 hover:border-emerald-300 text-xs text-slate-700 font-medium transition text-left cursor-pointer"
                  >
                    {tpl.titulo.slice(0, 30)}...
                  </button>
                ))}
              </div>
            </div>

            {/* Campo: Título */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  Título da Notificação <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">{titulo.length}/80</span>
              </div>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: 🔥 Oferta Especial de Final de Semana!"
                maxLength={80}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium text-slate-800 transition outline-none"
              />
            </div>

            {/* Campo: Mensagem */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700">
                  Mensagem / Conteúdo <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">{mensagem.length}/180</span>
              </div>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Ex: Encontre acomodações perfeitas na sua cidade e reserve pelo WhatsApp com os melhores preços."
                rows={3}
                maxLength={180}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium text-slate-800 transition outline-none resize-none"
              />
            </div>

            {/* Campo: Link de Destino */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-slate-400">link</span>
                Link de Destino ao Clicar
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hotelnozap.com.br"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium text-slate-800 transition outline-none font-mono"
              />
              <p className="text-[11px] text-slate-400">
                O usuário será direcionado para esta URL ao clicar na notificação.
              </p>
            </div>

            {/* Campo: Imagem / Banner com Upload Direto (Estilo Serasa) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-emerald-600">photo_library</span>
                  Banner / Imagem Grande (Estilo Serasa / Rich Push)
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Remover Imagem
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Cole o link ou clique ao lado para carregar foto"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium text-slate-800 transition outline-none"
                />

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isUploadingImage ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-emerald-600 rounded-full animate-spin" />
                      <span>Enviando foto...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">cloud_upload</span>
                      <span>Carregar do Celular/PC</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Esta foto aparecerá expandida na tela de bloqueio e na barra de notificações do Android.
              </p>
            </div>

            {/* Segmento de Destinatários */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Público Destinatário</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSegmento('all')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                    segmento === 'all'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <span className={`material-symbols-outlined text-lg ${segmento === 'all' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    public
                  </span>
                  <div>
                    <div className="text-xs font-bold">Todos os Inscritos</div>
                    <div className="text-[10px] text-slate-500 font-normal">Base completa de usuários</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSegmento('active')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center gap-3 ${
                    segmento === 'active'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <span className={`material-symbols-outlined text-lg ${segmento === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    bolt
                  </span>
                  <div>
                    <div className="text-xs font-bold">Inscritos Ativos</div>
                    <div className="text-[10px] text-slate-500 font-normal">Engajamento recente</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Botão de Envio */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingSend(true)}
                disabled={isSubmitting || !titulo.trim() || !mensagem.trim()}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Enviando pelo OneSignal...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">send</span>
                    <span>Disparar Notificação Push Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Coluna da Prévia ao Vivo + Info Técnica (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Prévia Visual da Notificação */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <span className="material-symbols-outlined text-emerald-600">devices</span>
                <span>Prévia em Tempo Real</span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Mockup Celular &amp; PC
              </span>
            </div>

            {/* Card fiel estilo Notificação Android (Estilo Serasa / Rich Push) */}
            <div className="bg-[#f2f4f7] rounded-3xl p-3.5 sm:p-4 shadow-md border border-slate-200/90 space-y-2.5">
              {/* Header do App Android */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <img
                    src="/icon-192.png"
                    alt="Hotel no Zap"
                    className="w-5 h-5 rounded-full object-cover border border-slate-300 shadow-2xs"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo.png';
                    }}
                  />
                  <span className="font-bold text-slate-800 text-xs">Hotel no Zap</span>
                  <span className="text-[11px] text-slate-400">• agora</span>
                  <span className="material-symbols-outlined text-[13px] text-slate-400">notifications</span>
                </div>
                <div className="w-5 h-5 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-500">
                  <span className="material-symbols-outlined text-sm">expand_less</span>
                </div>
              </div>

              {/* Título e Conteúdo da Notificação */}
              <div className="space-y-1 px-0.5">
                <p className="font-extrabold text-sm text-slate-900 leading-snug">
                  {titulo.trim() || 'Economize nas suas diárias 🏨'}
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {mensagem.trim() || 'Acomodações verificadas sem taxas e com confirmação em 1 minuto direto no WhatsApp.'}
                </p>
              </div>

              {/* Banner / Foto Grande (Igual Serasa / Inter) */}
              {imageUrl.trim() ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200/80 shadow-2xs aspect-video w-full bg-slate-100">
                  <img
                    src={imageUrl.trim()}
                    alt="Banner Notificação"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-300/80 bg-slate-50/60 p-4 text-center">
                  <span className="material-symbols-outlined text-2xl text-slate-400">image</span>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    Sem banner anexado (notificação simples).
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Ao adicionar uma imagem, ela aparecerá grande aqui igual à notificação da Serasa!
                  </p>
                </div>
              )}

              {/* Rodapé de Ação */}
              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate max-w-[200px]">
                  {url.trim() || 'hotelnozap.com.br'}
                </span>
                <span className="font-extrabold text-[#006c49] hover:underline cursor-pointer flex items-center gap-0.5">
                  <span>Abrir no App</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </span>
              </div>
            </div>

            {/* Dica Informativa */}
            <div className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-200/80 text-[11px] text-emerald-950 leading-relaxed">
              <strong>Como chega no celular?</strong> O cliente recebe na tela de bloqueio e na central do Android exatamente com essa imagem ampla, o ícone do Hotel no Zap e botão direto para o app!
            </div>
          </div>

          {/* Card com Detalhes da Conexão OneSignal */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Status da Conexão OneSignal
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">App ID:</span>
                <span className="font-mono font-semibold text-slate-800">40809032-1904-4b7c...</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Provedor:</span>
                <span className="font-semibold text-slate-800">OneSignal REST API v1</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Service Worker:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Ativo e Certificado
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Ambiente de Envio:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px]">
                  Produção / Serverless
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico Recente de Disparos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <span className="material-symbols-outlined text-slate-500">history</span>
            <span>Histórico Recente de Envios</span>
          </div>
          {historico.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs text-red-600 hover:text-red-700 font-semibold transition cursor-pointer"
            >
              Limpar Histórico
            </button>
          )}
        </div>

        {historico.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2">
            <span className="material-symbols-outlined text-3xl text-slate-300">notifications_off</span>
            <p className="text-sm font-medium">Nenhuma notificação foi disparada ainda por este painel.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {historico.map((item) => (
              <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <h4 className="font-bold text-sm text-slate-800 truncate">{item.title}</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {item.segment}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{item.message}</p>
                  <p className="text-[11px] text-slate-400">
                    Enviado por: {item.senderEmail} • {new Date(item.sentAt).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.status === 'sent' ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">done_all</span>
                      {item.recipients} entregue(s)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      Falha
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setTitulo(item.title);
                      setMensagem(item.message);
                      if (item.url) setUrl(item.url);
                      if (item.imageUrl) setImageUrl(item.imageUrl);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                    title="Copiar para Novo Disparo"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Disparo */}
      {isConfirmingSend && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">send</span>
              </div>
              <div>
                <h3 className="font-bold text-base">Confirmar Disparo Push</h3>
                <p className="text-xs text-slate-500">Esta ação enviará a notificação imediatamente.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
              <div>
                <strong className="text-slate-700">Título:</strong>
                <p className="text-slate-900 font-semibold">{titulo}</p>
              </div>
              <div>
                <strong className="text-slate-700">Mensagem:</strong>
                <p className="text-slate-600">{mensagem}</p>
              </div>
              <div>
                <strong className="text-slate-700">Público:</strong>
                <p className="text-slate-600">
                  {segmento === 'all' ? 'Todos os Inscritos' : 'Inscritos Ativos Recentes'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingSend(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendNotification}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Confirmar e Enviar</span>
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
