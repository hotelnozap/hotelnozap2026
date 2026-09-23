import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { reservasService, quartosService } from '../services/supabaseService';

// Helper para reproduzir som agradável de campainha/sino de recepção de hotel (Web Audio API nativo)
const playHotelChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Primeiro toque suave (880 Hz - Nota A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Segundo toque harmônico de sino de hotelaria (1174.66 Hz - Nota D6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.warn('Áudio de notificação bloqueado pelo navegador até primeira interação:', err);
  }
};

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'reserva' | 'pedido' | 'limpeza' | 'whatsapp' | 'atendimento';
  read: boolean;
  targetTab: string;
  metadata?: any;
}

interface NotificationSystemProps {
  onNavigateTab: (tabId: string) => void;
  isMobile?: boolean;
}

// Helpers de persistência de status de leitura de notificações no localStorage
const getReadNotificationIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('hotel_notificacoes_lidas_ids');
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
};

const saveReadNotificationIds = (set: Set<string>) => {
  try {
    localStorage.setItem('hotel_notificacoes_lidas_ids', JSON.stringify(Array.from(set)));
  } catch {}
};

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ onNavigateTab, isMobile = false }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'todas' | 'reserva' | 'pedido'>('todas');
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Fechar menu de notificações ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Carregar reservas existentes do Supabase e solicitações salvas na inicialização
  useEffect(() => {
    const loadInitialNotifications = async () => {
      try {
        const readIds = getReadNotificationIds();

        let initialSaved: NotificationItem[] = [];
        try {
          const rawSaved = localStorage.getItem('hotel_notificacoes_pedidos');
          if (rawSaved) {
            const list = JSON.parse(rawSaved);
            if (Array.isArray(list)) {
              initialSaved = list.map((solic: any) => {
                const isMensagem = solic.categoria === 'Mensagem Especial' || solic.tipo === 'whatsapp' || solic.origem === 'area_hospede_mensagem';
                const sId = solic.id || `solic-${solic.quartoNumero || '100'}-${(solic.itemNome || '').substring(0, 15)}-${solic.horario || ''}`;
                const isRead = solic.read === true || readIds.has(sId);
                return {
                  id: sId,
                  title: isMensagem ? `💬 Mensagem do Quarto ${solic.quartoNumero || '100'}!` : `🛎️ Solicitação: Quarto ${solic.quartoNumero || '100'}!`,
                  message: isMensagem ? `${solic.hospedeNome || 'Hóspede'}: "${solic.itemNome}"` : `${solic.hospedeNome || 'Hóspede'} solicitou "${solic.itemNome}"${solic.observacoes ? ` (${solic.observacoes})` : ''}`,
                  time: solic.horario || 'Hoje',
                  type: isMensagem ? 'whatsapp' : 'pedido',
                  read: isRead,
                  targetTab: 'reservas',
                };
              });
            }
          }
        } catch (sErr) {
          console.warn('Erro ao ler notificações salvas do storage:', sErr);
        }

        let initialAtendimentos: NotificationItem[] = [];
        try {
          const rawAtendimentos = localStorage.getItem('hotel_notificacoes_atendimentos');
          if (rawAtendimentos) {
            const list = JSON.parse(rawAtendimentos);
            if (Array.isArray(list)) {
              initialAtendimentos = list.map((at: any) => ({
                ...at,
                read: at.read === true || readIds.has(at.id)
              }));
            }
          }
        } catch (aErr) {
          console.warn('Erro ao ler notificações de atendimento do storage:', aErr);
        }

        const reservas = await reservasService.getReservas();
        let initialReservas: NotificationItem[] = [];
        if (reservas && reservas.length > 0) {
          initialReservas = reservas.map((r, idx) => {
            const rId = `res-db-${r.id}`;
            const isRead = readIds.has(rId) ? true : (idx > 2);
            return {
              id: rId,
              title: `Reserva ${r.reservaNumber} 🏨`,
              message: `${r.hospedeNome} reservou o ${r.quartoNome} (${r.checkIn} a ${r.checkOut}) - ${r.valorTotal}`,
              time: r.dataCriacao || 'Recente',
              type: 'reserva',
              read: isRead,
              targetTab: 'reservas'
            };
          });
        }

        // Mesclar garantindo que atendimentos e solicitações de hóspedes apareçam no topo
        const combined = [...initialAtendimentos, ...initialSaved];
        initialReservas.forEach(ir => {
          if (!combined.some(c => c.id === ir.id)) {
            combined.push(ir);
          }
        });

        setNotifications(combined);
      } catch (err) {
        console.warn('Erro ao carregar notificações iniciais do Supabase:', err);
      }
    };

    loadInitialNotifications();

    window.addEventListener('hotel_changed', loadInitialNotifications);
    return () => {
      window.removeEventListener('hotel_changed', loadInitialNotifications);
    };
  }, []);

  // Escutar eventos EM TEMPO REAL via CustomEvent, BroadcastChannel, LocalStorage e Supabase Realtime
  useEffect(() => {
    let channel: any = null;
    let bc: BroadcastChannel | null = null;

    // Processador unificado para nova solicitação ou mensagem vinda do hóspede
    const processarNovaSolicitacao = (detail: any) => {
      if (!detail) return;
      const quarto = detail.quartoNumero ? `Quarto ${detail.quartoNumero}` : 'Acomodação';
      const hospede = detail.hospedeNome || 'Hóspede';
      const item = detail.itemNome || 'Solicitação';
      const obs = detail.observacoes ? ` (${detail.observacoes})` : '';
      const isCardapio = detail.origem === 'cardapio' || detail.categoria === 'Cardápio / Frigobar';
      const isMensagem = detail.categoria === 'Mensagem Especial' || detail.tipo === 'whatsapp' || detail.origem === 'area_hospede_mensagem';
      const readIds = getReadNotificationIds();
      const notifId = detail.id || `solic-${detail.quartoNumero || '100'}-${(detail.itemNome || '').substring(0, 15)}-${Date.now()}`;

      const newNotif: NotificationItem = {
        id: notifId,
        title: isCardapio ? `🍔 Pedido Cardápio: ${quarto}!` : (isMensagem ? `💬 Mensagem do ${quarto}!` : `🛎️ Solicitação: ${quarto}!`),
        message: isMensagem ? `${hospede}: "${item}"` : `${hospede} solicitou: ${item}${obs}`,
        time: detail.horario || 'Agora mesmo',
        type: 'pedido',
        read: readIds.has(notifId),
        targetTab: isCardapio ? 'pedidos-cardapio' : 'reservas',
      };

      setNotifications(prev => {
        if (prev.some(n => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });

      // Se for solicitação de limpeza/governança, atualiza o status do quarto no Mapa de Quartos
      const itemLower = (detail.itemNome || '').toLowerCase();
      const catLower = (detail.categoria || '').toLowerCase();
      const obsLower = (detail.observacoes || '').toLowerCase();
      if (detail.quartoNumero && (
        itemLower.includes('limpeza') || 
        catLower.includes('limpeza') || 
        obsLower.includes('limpeza') || 
        itemLower.includes('camareira') ||
        itemLower.includes('faxina') ||
        (catLower.includes('governança') && itemLower.includes('limp'))
      )) {
        quartosService.solicitarLimpezaQuarto(detail.quartoNumero, detail.hotelId);
      }

      // Tocar som de recepção e disparar alerta na tela do hotel
      playHotelChime();
      setActiveToast(newNotif);
      setTimeout(() => setActiveToast(null), 8000);
    };

    // 1. Escuta evento CustomEvent local na mesma janela
    const handleLocalSolicitacao = (e: any) => {
      processarNovaSolicitacao(e.detail);
    };
    window.addEventListener('hotel_nova_solicitacao', handleLocalSolicitacao);

    // 2. Escuta BroadcastChannel para multi-abas em tempo real
    try {
      bc = new BroadcastChannel('hotel_notifications_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'NOVA_SOLICITACAO_HOSPEDE' && event.data?.data) {
          processarNovaSolicitacao(event.data.data);
        } else if (event.data?.type === 'NOVA_RESERVA_HOSPEDE' && event.data?.data) {
          handleLocalNovaReserva({ detail: event.data.data });
        } else if (event.data?.type === 'NOTIFICATION_READ' && event.data?.id) {
          const readId = event.data.id;
          setNotifications(prev => prev.map(n => n.id === readId ? { ...n, read: true } : n));
        } else if (event.data?.type === 'NOTIFICATIONS_ALL_READ') {
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel indisponível:', e);
    }

    // 3. Escuta StorageEvent do navegador (dispara em outras abas quando o hóspede solicita ou reserva)
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'hotel_nova_solicitacao_trigger' && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          processarNovaSolicitacao(payload);
        } catch (err) {}
      } else if (event.key === 'hotel_nova_reserva_trigger' && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue);
          handleLocalNovaReserva({ detail: payload });
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // 4. Handler para eventos locais de nova reserva
    const handleLocalNovaReserva = (e: any) => {
      const detail = e.detail || {};
      const nomeHospede = detail.nome_hospede || 'Hóspede Zap';
      const quartoNome = detail.quarto_nome || (detail.numero_quarto ? `Quarto ${detail.numero_quarto}` : 'Acomodação');
      const readIds = getReadNotificationIds();
      const resId = detail.id ? `res-db-${detail.id}` : `res-local-${Date.now()}`;

      const newNotif: NotificationItem = {
        id: resId,
        title: 'Nova Reserva em Tempo Real! 🏨',
        message: `${nomeHospede} acabou de reservar o ${quartoNome}.`,
        time: 'Agora mesmo',
        type: 'reserva',
        read: readIds.has(resId),
        targetTab: 'reservas',
      };

      setNotifications(prev => {
        if (prev.some(n => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      playHotelChime();
      setActiveToast(newNotif);
      setTimeout(() => setActiveToast(null), 6000);
    };

    window.addEventListener('hotel_nova_reserva', handleLocalNovaReserva);

    // 5. Escuta evento de notificação lida individual para sincronizar componentes mobile e desktop
    const handleNotificationReadEvent = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    };
    window.addEventListener('hotel_notification_read', handleNotificationReadEvent);

    const handleAllReadEvent = () => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };
    window.addEventListener('hotel_notifications_all_read', handleAllReadEvent);

    // 5.1 Escuta envio automático de boas-vindas / início de atendimento WhatsApp
    const handleAutoReplySent = (e: any) => {
      const detail = e.detail || {};
      const recipient = (detail.recipient || '').replace(/\D/g, '');
      if (!recipient) return;

      const notifId = `atendimento-${recipient}`;
      const readIds = getReadNotificationIds();

      const newNotif: NotificationItem = {
        id: notifId,
        title: 'Atendimento WhatsApp Iniciado! 💬',
        message: `Mensagem de boas-vindas enviada automaticamente para ${detail.nome ? detail.nome + ' (' + recipient + ')' : recipient}.`,
        time: 'Agora mesmo',
        type: 'atendimento',
        read: false,
        targetTab: 'conexao',
        metadata: {
          phone: recipient,
          nome: detail.nome
        }
      };

      // Garante que o ID não esteja no conjunto de lidas (sinal de alerta fica ativo)
      readIds.delete(notifId);
      saveReadNotificationIds(readIds);

      setNotifications(prev => {
        // Se já existe uma notificação não lida para este contato, não duplica
        const existing = prev.find(n => n.id === notifId);
        if (existing && !existing.read) {
          return prev;
        }

        const filtered = prev.filter(n => n.id !== notifId);
        const updatedList = [newNotif, ...filtered];

        // Persiste atendimentos no storage local para manter o alerta ativo mesmo se recarregar
        try {
          const atendimentos = updatedList.filter(n => n.type === 'atendimento');
          localStorage.setItem('hotel_notificacoes_atendimentos', JSON.stringify(atendimentos));
        } catch {}

        return updatedList;
      });

      // Tocar som suave de recepção
      playHotelChime();

      // Exibe toast flutuante apenas no desktop (evita toasts duplicados entre instâncias mobile/desktop)
      if (!isMobile) {
        setActiveToast(newNotif);
        setTimeout(() => setActiveToast(null), 8000);
      }
    };
    window.addEventListener('hotelnozap_auto_reply_sent', handleAutoReplySent);

    // 6. Handler Supabase Realtime
    try {
      console.log('🔄 Conectando canal em tempo real do Supabase para Notificações...');
      
      channel = supabase
        .channel('realtime_hotel_notifications')
        .on('broadcast', { event: 'solicitacao_hospede' }, (eventPayload: any) => {
          processarNovaSolicitacao(eventPayload.payload || eventPayload);
        })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'reservas' },
          (payload) => {
            const newNotif: NotificationItem = {
              id: `res-${payload.new?.id || Date.now()}`,
              title: 'Nova Reserva Registrada! 🏨',
              message: `${payload.new?.nome_hospede || 'Hóspede'} acabou de reservar o Quarto ${payload.new?.numero_quarto || '101'}.`,
              time: 'Agora mesmo',
              type: 'reserva',
              read: false,
              targetTab: 'reservas',
            };
            setNotifications(prev => {
              if (prev.some(n => n.id === newNotif.id || n.message.includes(newNotif.message))) return prev;
              return [newNotif, ...prev];
            });
            setActiveToast(newNotif);
            setTimeout(() => setActiveToast(null), 6000);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'reservas' },
          (payload) => {
            const status = payload.new?.status || 'Atualizada';
            const newNotif: NotificationItem = {
              id: `res-upd-${payload.new?.id || Date.now()}`,
              title: `Reserva ${status}! 📋`,
              message: `Reserva de ${payload.new?.nome_hospede || 'Hóspede'} (${payload.new?.numero_quarto ? `Quarto ${payload.new.numero_quarto}` : 'Acomodação'}) agora está: ${status}.`,
              time: 'Agora mesmo',
              type: 'reserva',
              read: false,
              targetTab: 'reservas',
            };
            setNotifications(prev => [newNotif, ...prev]);
            setActiveToast(newNotif);
            setTimeout(() => setActiveToast(null), 6000);
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'hospedes' },
          (payload) => {
            const newNotif: NotificationItem = {
              id: `hos-${payload.new?.id || Date.now()}`,
              title: 'Novo Hóspede Registrado! 👤',
              message: `${payload.new?.nome || 'Hóspede'} foi registrado no sistema (${payload.new?.cidade_uf || 'Cadastrado'}).`,
              time: 'Agora mesmo',
              type: 'reserva',
              read: false,
              targetTab: 'hospedes',
            };
            setNotifications(prev => [newNotif, ...prev]);
            setActiveToast(newNotif);
            setTimeout(() => setActiveToast(null), 6000);
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'produtos' },
          (payload) => {
            const newNotif: NotificationItem = {
              id: `prod-${payload.new?.id || Date.now()}`,
              title: 'Novo Pedido de Frigobar! 🛎️',
              message: `Consumo registrado: ${payload.new?.nome || 'Produto'} - R$ ${Number(payload.new?.preco || 0).toFixed(2)}`,
              time: 'Agora mesmo',
              type: 'pedido',
              read: false,
              targetTab: 'caixa',
            };
            setNotifications(prev => [newNotif, ...prev]);
            setActiveToast(newNotif);
            setTimeout(() => setActiveToast(null), 6000);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Conexão Realtime Supabase indisponível no navegador:', err);
    }

    return () => {
      window.removeEventListener('hotel_nova_solicitacao', handleLocalSolicitacao);
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
      window.removeEventListener('hotel_nova_reserva', handleLocalNovaReserva);
      window.removeEventListener('hotel_notification_read', handleNotificationReadEvent);
      window.removeEventListener('hotel_notifications_all_read', handleAllReadEvent);
      window.removeEventListener('hotelnozap_auto_reply_sent', handleAutoReplySent);
      if (channel) {
        try { supabase.removeChannel(channel); } catch (e) {}
      }
    };
  }, []);

  // Marca notificação individual como lida e decrementa o contador em -1
  const markAsRead = (itemId: string) => {
    // 1. Grava no storage persistente de IDs lidos
    const readIds = getReadNotificationIds();
    readIds.add(itemId);
    saveReadNotificationIds(readIds);

    // 2. Atualiza storage de hotel_notificacoes_pedidos e hotel_notificacoes_atendimentos
    try {
      const rawSaved = localStorage.getItem('hotel_notificacoes_pedidos');
      if (rawSaved) {
        const list = JSON.parse(rawSaved);
        if (Array.isArray(list)) {
          const updated = list.map((solic: any) => {
            const sId = solic.id || `solic-${solic.quartoNumero || '100'}-${(solic.itemNome || '').substring(0, 15)}-${solic.horario || ''}`;
            if (sId === itemId || solic.id === itemId) {
              return { ...solic, read: true };
            }
            return solic;
          });
          localStorage.setItem('hotel_notificacoes_pedidos', JSON.stringify(updated));
        }
      }

      const rawAtendimentos = localStorage.getItem('hotel_notificacoes_atendimentos');
      if (rawAtendimentos) {
        const list = JSON.parse(rawAtendimentos);
        if (Array.isArray(list)) {
          const updated = list.map((at: any) => at.id === itemId ? { ...at, read: true } : at);
          localStorage.setItem('hotel_notificacoes_atendimentos', JSON.stringify(updated));
        }
      }
    } catch {}

    // 3. Atualiza estado imediatamente (-1 no unreadCount em tempo real)
    setNotifications(prev => prev.map(n => n.id === itemId ? { ...n, read: true } : n));

    // 4. Notifica outras instâncias (mobile/desktop) e outras abas
    window.dispatchEvent(new CustomEvent('hotel_notification_read', { detail: { id: itemId } }));
    try {
      const bc = new BroadcastChannel('hotel_notifications_channel');
      bc.postMessage({ type: 'NOTIFICATION_READ', id: itemId });
      bc.close();
    } catch {}
  };

  // Marca todas as notificações como lidas
  const markAllAsRead = () => {
    const readIds = getReadNotificationIds();
    notifications.forEach(n => readIds.add(n.id));
    saveReadNotificationIds(readIds);

    try {
      const rawSaved = localStorage.getItem('hotel_notificacoes_pedidos');
      if (rawSaved) {
        const list = JSON.parse(rawSaved);
        if (Array.isArray(list)) {
          const updated = list.map((solic: any) => ({ ...solic, read: true }));
          localStorage.setItem('hotel_notificacoes_pedidos', JSON.stringify(updated));
        }
      }

      const rawAtendimentos = localStorage.getItem('hotel_notificacoes_atendimentos');
      if (rawAtendimentos) {
        const list = JSON.parse(rawAtendimentos);
        if (Array.isArray(list)) {
          const updated = list.map((at: any) => ({ ...at, read: true }));
          localStorage.setItem('hotel_notificacoes_atendimentos', JSON.stringify(updated));
        }
      }
    } catch {}

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    window.dispatchEvent(new CustomEvent('hotel_notifications_all_read'));
    try {
      const bc = new BroadcastChannel('hotel_notifications_channel');
      bc.postMessage({ type: 'NOTIFICATIONS_ALL_READ' });
      bc.close();
    } catch {}
  };

  // Ao clicar na notificação:
  // Marca imediatamente como lida (-1 no contador e retira alerta) e navega para a aba de destino
  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    setIsOpen(false);
    if (item.type === 'atendimento') {
      window.dispatchEvent(
        new CustomEvent('hotel_abrir_atendimentos_whatsapp', {
          detail: { phone: item.metadata?.phone }
        })
      );
    }
    onNavigateTab(item.targetTab);
  };

  // Navega diretamente para a aba e fecha o painel
  const handleNavigateToTab = (item: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(item.id);
    setIsOpen(false);
    if (item.type === 'atendimento') {
      window.dispatchEvent(
        new CustomEvent('hotel_abrir_atendimentos_whatsapp', {
          detail: { phone: item.metadata?.phone }
        })
      );
    }
    onNavigateTab(item.targetTab);
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'reserva') return n.type === 'reserva';
    if (activeFilter === 'pedido') return n.type === 'pedido' || n.type === 'limpeza' || n.type === 'whatsapp' || n.type === 'atendimento';
    return true;
  });

  return (
    <div ref={containerRef} className="relative">
      
      {/* BOTÃO DA SINETE DE NOTIFICAÇÃO */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir Notificações"
        className={
          isMobile
            ? "p-2 rounded-full hover:bg-white/10 transition-colors relative cursor-pointer flex items-center justify-center"
            : "w-10 h-10 rounded-full flex items-center justify-center text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer relative"
        }
      >
        <span className={`material-symbols-outlined ${isMobile ? 'text-white' : ''}`}>
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1 shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* PAINEL FLUTUANTE DE NOTIFICAÇÕES (DROPDOWN) */}
      {isOpen && (
        <div 
          className={`absolute ${isMobile ? 'right-0 top-12 w-[340px]' : 'right-0 top-12 w-[380px]'} bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans text-slate-800`}
        >
          {/* Cabeçalho do Painel */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/80">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
              <span className="material-symbols-outlined text-emerald-700 text-xl shrink-0 animate-bounce">notifications_active</span>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base whitespace-nowrap">Notificações</h3>
              {unreadCount > 0 && (
                <span className="whitespace-nowrap inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200/90 text-[11px] font-extrabold shrink-0 shadow-2xs">
                  {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="hidden sm:inline-block whitespace-nowrap text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer ml-1 shrink-0 transition-colors"
                  title="Marcar todas as notificações como lidas"
                >
                  Marcar como lida
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="sm:hidden whitespace-nowrap text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer shrink-0"
              >
                Marcar como lida
              </button>
            )}
          </div>

          {/* Abas de Filtro de Notificação */}
          <div className="flex border-b border-slate-100 bg-white p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveFilter('todas')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'todas' ? 'bg-[#003400] text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('reserva')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'reserva' ? 'bg-[#003400] text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Reservas
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('pedido')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'pedido' ? 'bg-[#003400] text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Pedidos
            </button>
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-1">notifications_off</span>
                <p className="text-xs font-medium">Nenhuma notificação nesta categoria.</p>
              </div>
            ) : (
              filteredNotifications.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative group ${
                    !item.read ? 'bg-emerald-50/40' : ''
                  }`}
                  title={!item.read ? "Clique para marcar como lida (-1)" : "Clique para acessar"}
                >
                  {/* Ícone por Tipo */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      item.type === 'reserva'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.type === 'pedido'
                        ? 'bg-amber-100 text-amber-700'
                        : item.type === 'limpeza'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {item.type === 'reserva'
                        ? 'book_online'
                        : item.type === 'pedido'
                        ? 'room_service'
                        : item.type === 'limpeza'
                        ? 'cleaning_services'
                        : 'chat'}
                    </span>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-xs truncate ${!item.read ? 'font-black text-slate-950' : 'font-bold text-slate-700'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">{item.time}</span>
                    </div>
                    <p className={`text-xs leading-snug line-clamp-2 ${!item.read ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                      {item.message}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleNavigateToTab(item, e)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                        title="Ir diretamente para a tela"
                      >
                        <span>Acessar</span>
                        <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                      </button>
                      {!item.read && (
                        <span className="text-[10px] font-semibold text-emerald-700/80">
                          Clique no card para marcar lida (-1)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Indicador de Lida/Não Lida */}
                  <div className="shrink-0 pt-1 flex flex-col items-center">
                    {!item.read ? (
                      <span 
                        className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse shadow-xs" 
                        title="Não lida (clique para ler)"
                      />
                    ) : (
                      <span 
                        className="material-symbols-outlined text-slate-300 text-sm" 
                        title="Lida"
                      >
                        done_all
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION FLUTUANTE EM TEMPO REAL */}
      {activeToast && !isMobile && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-bottom duration-300">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined">
              {activeToast.type === 'whatsapp' ? 'chat' : activeToast.type === 'pedido' ? 'room_service' : 'bolt'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-xs font-bold text-emerald-400">{activeToast.title}</h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Ao Vivo
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-1">{activeToast.message}</p>
            <button
              type="button"
              onClick={(e) => handleNavigateToTab(activeToast, e)}
              className="mt-2 text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Detalhes</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default NotificationSystem;
