import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  quartosService, 
  reservasService, 
  destaquesQuartoService, 
  DestaqueQuarto, 
  cleanIconClass, 
  currentHotelService,
  statusQuartosService,
  StatusQuartoData,
  INITIAL_STATUS_QUARTOS
} from '../services/supabaseService';
import { ModalCheckinEntrada } from './ModalCheckinEntrada';
import { Reserva } from './ListagemReservas';

export interface Room {
  id: string;
  number: string;
  name?: string;
  category: string;
  status: string; // Dinâmico com base nos status cadastrados pelo admin
  floor: string;
  guestName?: string;
  capacity?: number;
  dailyPrice?: number;
  amenities?: string[];
  active?: boolean;
  type?: string;
  categoria?: string;
  tipoQuarto?: string;
  photos?: string[];
  notes?: string;
  items?: Record<string, any>;
  beds?: number;
  comodidades?: any[];
  motivo_bloqueio?: string;
}

export interface RoomItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: 'Ativo' | 'Em Manutenção' | 'Inativo';
  notes?: string;
}

export interface MapaQuartosProps {
  currentUserRole?: string;
  onNavigateToDashboard?: () => void;
  onNavigateToCadastroQuarto?: () => void;
  onNavigateToItens?: () => void;
  onNavigateToCategorias?: () => void;
  onNavigateToTiposQuarto?: () => void;
  onNavigateToDestaques?: () => void;
  onEditQuarto?: (room: Room) => void;
}

const INITIAL_ROOMS: Room[] = [];
const INITIAL_ITEMS: RoomItem[] = [];

export const MapaQuartos: React.FC<MapaQuartosProps> = ({ 
  currentUserRole,
  onNavigateToDashboard, 
  onNavigateToCadastroQuarto,
  onNavigateToItens,
  onNavigateToCategorias,
  onNavigateToTiposQuarto,
  onNavigateToDestaques,
  onEditQuarto,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<RoomItem[]>([]);
  const [availableStatus, setAvailableStatus] = useState<StatusQuartoData[]>(INITIAL_STATUS_QUARTOS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const userRole = (currentUserRole || localStorage.getItem('hotelnozap_user_role') || localStorage.getItem('hotelnozap_user_cargo') || '').toLowerCase();

  // Helper para obter detalhes visuais completos do status do quarto (cores, ícone e nome cadastrado pelo admin)
  const getStatusInfo = useCallback((statusSlug?: string) => {
    const slugLower = (statusSlug || 'livre').toLowerCase().trim();
    const found = availableStatus.find(s => s.slug === slugLower);
    if (found) return found;
    const isLivre = slugLower === 'livre';
    const isLimpeza = slugLower === 'limpeza';
    const isManutencao = slugLower === 'manutencao' || slugLower === 'interditado';
    return {
      id: `temp_${slugLower}`,
      slug: slugLower,
      nome: slugLower.charAt(0).toUpperCase() + slugLower.slice(1),
      descricao: '',
      icone: isLivre ? 'check_circle' : isLimpeza ? 'cleaning_services' : isManutencao ? 'build' : 'bed',
      cor_fundo: isLivre ? '#ECFDF5' : isLimpeza ? '#FFFBEB' : '#F3F4F6',
      cor_texto: isLivre ? '#065F46' : isLimpeza ? '#92400E' : '#374151',
      cor_borda: isLivre ? '#A7F3D0' : isLimpeza ? '#FDE68A' : '#E5E7EB',
      permite_ocupacao: isLivre,
      padrao_sistema: isLivre || isLimpeza || isManutencao || slugLower === 'ocupado',
      notifica_camareira: isLimpeza,
      exige_motivo: isManutencao,
      status: 'ativo' as const,
      ordem: 99
    };
  }, [availableStatus]);

  // Carrega status cadastrados pelo admin
  const loadStatus = useCallback(() => {
    statusQuartosService.getStatusQuartos(false).then(list => {
      if (list && list.length > 0) {
        setAvailableStatus(list);
      }
    });
  }, []);

  // Regra de Permissões:
  // - Quem pode marcar para LIMPEZA: Hóspede, Hotel, Recepcionista, Camareira.
  // - Quem pode marcar como LIMPO (livre): SOMENTE Camareira e Hotel (Admin/Gerente/Super Admin).
  const isCamareira = userRole.includes('camareira') || userRole.includes('governan');
  const isHotel = userRole.includes('hotel') || userRole.includes('admin') || userRole.includes('gerent') || userRole.includes('super') || userRole === '';
  const canMarkAsClean = isCamareira || isHotel;

  useEffect(() => {
    let isMounted = true;
    const fetchRooms = () => {
      quartosService.getQuartos().then(data => {
        if (isMounted) {
          setRooms(data || []);
        }
      });
    };
    fetchRooms();
    loadStatus();

    const unsubscribeStatusQuartos = statusQuartosService.subscribeStatusQuartos ? statusQuartosService.subscribeStatusQuartos((list) => {
      if (list && list.length > 0) {
        setAvailableStatus(list);
      }
    }) : () => {};

    window.addEventListener('hotel_changed', fetchRooms);
    window.addEventListener('hotel_status_quartos_atualizado', loadStatus);
    window.addEventListener('hotel_novo_quarto', fetchRooms);
    window.addEventListener('hotel_quarto_modificado', fetchRooms);
    window.addEventListener('hotel_nova_reserva', fetchRooms);
    window.addEventListener('hotel_reserva_modificada', fetchRooms);

    // Manipulador em tempo real para atualizações de status do quarto
    const handleStatusEvent = (e: any) => {
      const detail = e.detail;
      if (detail && (detail.numero || detail.quartoId)) {
        const cleanNum = String(detail.numero || '').replace(/\D/g, '');
        const targetId = detail.quartoId;
        const newStatus = detail.status || 'limpeza';
        setRooms(prev => prev.map(r => {
          const rNum = String(r.number || '').replace(/\D/g, '');
          if ((cleanNum && rNum === cleanNum) || (targetId && r.id === targetId)) {
            return { ...r, status: newStatus as any };
          }
          return r;
        }));
      }
      fetchRooms();
    };
    window.addEventListener('hotel_quarto_atualizado', handleStatusEvent);

    // Manipulador quando nova solicitação do hóspede for registrada
    const handleNovaSolicitacao = (e: any) => {
      const detail = e.detail;
      if (detail && detail.quartoNumero) {
        const item = (detail.itemNome || '').toLowerCase();
        const cat = (detail.categoria || '').toLowerCase();
        const obs = (detail.observacoes || '').toLowerCase();
        if (
          item.includes('limpeza') || 
          cat.includes('limpeza') || 
          obs.includes('limpeza') || 
          item.includes('camareira') ||
          item.includes('faxina') ||
          (cat.includes('governança') && item.includes('limp'))
        ) {
          const cleanNum = String(detail.quartoNumero).replace(/\D/g, '');
          setRooms(prev => prev.map(r => {
            const rNum = String(r.number || '').replace(/\D/g, '');
            if (rNum === cleanNum) {
              return { ...r, status: 'limpeza' };
            }
            return r;
          }));
          quartosService.solicitarLimpezaQuarto(detail.quartoNumero);
        }
      }
      fetchRooms();
    };
    window.addEventListener('hotel_nova_solicitacao', handleNovaSolicitacao);

    // BroadcastChannel multi-abas
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hotel_notifications_channel');
      bc.onmessage = (event) => {
        if (
          event.data?.type === 'QUARTO_STATUS_ALTERADO' ||
          event.data?.type === 'CHECKOUT_REALIZADO' ||
          event.data?.type === 'NOVA_SOLICITACAO_HOSPEDE'
        ) {
          if (event.data?.data?.numero || event.data?.data?.quartoNumero) {
            const num = String(event.data.data.numero || event.data.data.quartoNumero).replace(/\D/g, '');
            const status = event.data.data.status || 'limpeza';
            setRooms(prev => prev.map(r => {
              const rNum = String(r.number || '').replace(/\D/g, '');
              if (rNum === num) {
                return { ...r, status: status as any };
              }
              return r;
            }));
          }
          fetchRooms();
        }
      };
    } catch (bcErr) {}

    // StorageEvent para sincronização entre abas
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'hotel_quarto_status_trigger' || event.key === 'hotel_nova_solicitacao_trigger') {
        fetchRooms();
      }
    };
    const unsubscribeReservas = reservasService.subscribeReservas(() => {
      fetchRooms();
    });

    // Inscrição em tempo real com atualização otimista imediata na tela do hotel
    const unsubscribeQuartos = quartosService.subscribeQuartos
      ? quartosService.subscribeQuartos((detail) => {
          if (detail && (detail.numero || detail.quartoId)) {
            const cleanNum = String(detail.numero || '').replace(/\D/g, '');
            const targetId = detail.quartoId;
            const newStatus = detail.status || 'limpeza';
            setRooms(prev => prev.map(r => {
              const rNum = String(r.number || '').replace(/\D/g, '');
              if ((cleanNum && rNum === cleanNum) || (targetId && r.id === targetId)) {
                return {
                  ...r,
                  status: newStatus as any,
                  guestName: detail.hospede_atual !== undefined ? (detail.hospede_atual || '') : r.guestName
                };
              }
              return r;
            }));
          }
          fetchRooms();
        })
      : () => {};

    // Sincronização ao focar ou reativar aba do navegador
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchRooms();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    // Heartbeat periódico leve de 7s para garantir sync ininterrupto
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchRooms();
      }
    }, 7000);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(heartbeatInterval);
      window.removeEventListener('hotel_changed', fetchRooms);
      window.removeEventListener('hotel_novo_quarto', fetchRooms);
      window.removeEventListener('hotel_quarto_modificado', fetchRooms);
      window.removeEventListener('hotel_quarto_atualizado', handleStatusEvent);
      window.removeEventListener('hotel_nova_solicitacao', handleNovaSolicitacao);
      window.removeEventListener('hotel_nova_reserva', fetchRooms);
      window.removeEventListener('hotel_reserva_modificada', fetchRooms);
      window.removeEventListener('hotel_status_quartos_atualizado', loadStatus);
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try { bc.close(); } catch {}
      }
      unsubscribeStatusQuartos();
      unsubscribeReservas();
      unsubscribeQuartos();
    };
  }, []);

  const resetRoomForm = () => {
    setNewRoomNumber('');
    setNewRoomName('');
    setNewRoomCategory('STANDARD');
    setNewRoomFloor('1º Andar');
    setNewRoomPrice('180');
    setNewRoomCapacity('2');
    setNewRoomPhotos([]);
    setModalPhotoError(null);
    setIsEditMode(false);
    setEditingRoomId(null);
    setNewRoomDestaques([]);
  };

  const handleOpenNovoQuarto = () => {
    const activeHotel = currentHotelService.getCurrentHotel();
    const planLower = (activeHotel?.plan || '').toLowerCase();
    const isFreePlan = planLower.includes('gratis') || planLower.includes('grátis') || planLower.includes('free') || planLower.includes('maps');
    const capacityLimit = activeHotel?.capacity !== undefined && activeHotel?.capacity !== null ? activeHotel.capacity : (isFreePlan ? 0 : 9999);

    if (capacityLimit === 0 || isFreePlan) {
      alert(
        `Plano sem direito a cadastro de quartos!\n\nSeu hotel (${activeHotel?.name || 'Hotel'}) está no plano "${activeHotel?.plan || 'Grátis'}", que não inclui franquia para cadastro de quartos (limite: 0).\n\nPara cadastrar e gerenciar acomodações no sistema, faça o upgrade do seu plano.`
      );
      return;
    }

    if (rooms.length >= capacityLimit) {
      alert(
        `Limite de quartos atingido!\n\nSeu hotel atingiu o limite de ${capacityLimit} quarto(s) definido pelo seu plano ("${activeHotel?.plan}").\n\nPara cadastrar quartos adicionais, faça o upgrade do seu plano.`
      );
      return;
    }

    resetRoomForm();
    if (onNavigateToCadastroQuarto) {
      onNavigateToCadastroQuarto();
    } else {
      setIsNovoQuartoOpen(true);
    }
  };

  const handleOpenEditRoom = (room: Room) => {
    onEditQuarto?.(room);
  };

  const handleAskDeleteRoom = (room: Room) => {
    setRoomToDelete(room);
    setIsDeleteQuartoModalOpen(true);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    const idToDelete = roomToDelete.id;
    const numberToDelete = roomToDelete.number;
    setRooms(rooms.filter(r => r.id !== idToDelete));
    setIsDeleteQuartoModalOpen(false);
    setRoomToDelete(null);
    try {
      await quartosService.deleteQuarto(idToDelete);
      window.dispatchEvent(new CustomEvent('hotel_quarto_deletado', { detail: { numero: numberToDelete } }));
      window.dispatchEvent(new CustomEvent('hotel_novo_quarto'));
    } catch (err) {
      console.error('Erro ao excluir quarto:', err);
    }
  };

  const handleOpenGerenciarDestaques = () => {
    onNavigateToDestaques?.();
  };

  const handleToggleDestaqueSelection = (destaqueId: string) => {
    setNewRoomDestaques(prev =>
      prev.includes(destaqueId)
        ? prev.filter(id => id !== destaqueId)
        : [...prev, destaqueId]
    );
  };

  const handleOpenCadastrarItens = () => {
    if (onNavigateToItens) {
      onNavigateToItens();
    } else {
      setIsCadastrarItemOpen(true);
    }
  };

  const handleOpenCategorias = () => {
    if (onNavigateToCategorias) {
      onNavigateToCategorias();
    } else {
      setIsCategoriasModalOpen(true);
    }
  };

  const handleOpenTiposQuarto = () => {
    if (onNavigateToTiposQuarto) {
      onNavigateToTiposQuarto();
    } else {
      setIsTiposQuartoModalOpen(true);
    }
  };

  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [filterFloor, setFilterFloor] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isNovoQuartoOpen, setIsNovoQuartoOpen] = useState(false);
  const [isCadastrarItemOpen, setIsCadastrarItemOpen] = useState(false);
  const [isCategoriasModalOpen, setIsCategoriasModalOpen] = useState(false);
  const [categoriesList, setCategoriesList] = useState<string[]>(['STANDARD', 'LUXO', 'SUÍTE', 'PREFERENCIAL']);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  
  const [isTiposQuartoModalOpen, setIsTiposQuartoModalOpen] = useState(false);
  const [tiposQuartoList, setTiposQuartoList] = useState<string[]>([
    'Standard Solteiro',
    'Casal Standard',
    'Luxo Duplo',
    'Suíte Master',
    'Chalé Vista Mar',
    'Suíte Presidencial'
  ]);
  const [newTipoQuartoInput, setNewTipoQuartoInput] = useState('');

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkinModalReserva, setCheckinModalReserva] = useState<Reserva | null>(null);

  const handleOpenRoomModal = (room: Room) => {
    loadStatus();
    setSelectedRoom(room);
  };

  const handleStartCheckinForRoom = async (room: Room) => {
    const stInfo = getStatusInfo(room.status);
    if (!stInfo.permite_ocupacao && room.status !== 'ocupado') {
      showToast(`⚠️ Check-in bloqueado: O status "${stInfo.nome}" não permite ocupação de hóspedes. Altere para um status liberado.`);
      return;
    }

    try {
      const allRes = await reservasService.getReservas();
      const cleanNum = String(room.number || '').trim();
      const match = (allRes || []).find((r: any) => 
        (r.quarto_id === room.id || String(r.numero_quarto || '').trim() === cleanNum) && 
        r.status === 'Confirmada'
      );
      if (match) {
        setCheckinModalReserva(match);
      } else {
        const todayIso = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        setCheckinModalReserva({
          id: 'chk_' + Date.now(),
          reservaNumber: 'RES-' + Math.floor(100000 + Math.random() * 900000),
          hospedeNome: room.guestName || '',
          hospedeEmail: '',
          hospedeTelefone: '',
          hospedeIniciais: (room.guestName || 'HP').substring(0, 2).toUpperCase(),
          quartoNome: room.name || `Quarto ${room.number}`,
          quartoTipo: room.category || 'Standard',
          quarto_id: room.id,
          numero_quarto: room.number,
          checkIn: todayIso,
          checkOut: tomorrow,
          noites: 1,
          dataCriacao: new Date().toLocaleDateString('pt-BR'),
          valorTotal: `R$ ${room.dailyPrice || 180},00`,
          status: 'Confirmada'
        });
      }
      setSelectedRoom(null);
    } catch (err) {
      console.error('Erro ao iniciar check-in do quarto:', err);
    }
  };

  // Delete Confirmation Modal
  const [isDeleteQuartoModalOpen, setIsDeleteQuartoModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Edit mode tracking
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  // New Room Form State
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState<'STANDARD' | 'LUXO' | 'SUÍTE' | 'PREFERENCIAL'>('STANDARD');
  const [newRoomFloor, setNewRoomFloor] = useState('1º Andar');
  const [newRoomPrice, setNewRoomPrice] = useState('180');
  const [newRoomCapacity, setNewRoomCapacity] = useState('2');
  const [newRoomPhotos, setNewRoomPhotos] = useState<string[]>([]);
  const MAX_ROOM_PHOTOS = 5;
  const [modalPhotoError, setModalPhotoError] = useState<string | null>(null);
  const [newRoomDestaques, setNewRoomDestaques] = useState<string[]>([]);

  const [destaquesList, setDestaquesList] = useState<DestaqueQuarto[]>([]);

  useEffect(() => {
    let mounted = true;
    const carregarDestaques = async () => {
      try {
        const data = await destaquesQuartoService.getDestaques();
        if (mounted) setDestaquesList(data || []);
      } catch {}
    };
    carregarDestaques();
    window.addEventListener('hotel_novo_destaque_quarto', carregarDestaques);
    window.addEventListener('hotel_quarto_destaques_atualizado', carregarDestaques);
    return () => {
      mounted = false;
      window.removeEventListener('hotel_novo_destaque_quarto', carregarDestaques);
      window.removeEventListener('hotel_quarto_destaques_atualizado', carregarDestaques);
    };
  }, []);

  const modalFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleModalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const remainingSlots = MAX_ROOM_PHOTOS - newRoomPhotos.length;

      if (remainingSlots <= 0) {
        setModalPhotoError('Limite máximo de 5 fotos atingido.');
        if (e.target) e.target.value = '';
        return;
      }

      if (selectedFiles.length > remainingSlots) {
        setModalPhotoError(`Limite de 5 fotos: apenas as primeiras ${remainingSlots} foto(s) foram adicionadas.`);
      } else {
        setModalPhotoError(null);
      }

      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      const newUrls = filesToAdd.map(file => URL.createObjectURL(file));
      setNewRoomPhotos(prev => [...prev, ...newUrls]);

      if (e.target) e.target.value = '';
    }
  };

  // New Item Form State
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Eletrônicos');
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemNotes, setNewItemNotes] = useState('');

  // KPI Calculations
  const livreCount = rooms.filter(r => r.status === 'livre').length;
  const ocupadoCount = rooms.filter(r => r.status === 'ocupado').length;
  const limpezaCount = rooms.filter(r => r.status === 'limpeza').length;
  const manutencaoCount = rooms.filter(r => r.status === 'manutencao').length;

  // Filter Logic
  const filteredRooms = rooms.filter((room) => {
    if (filterStatus !== 'todos' && room.status !== filterStatus) return false;
    if (filterCategory !== 'todos' && room.category !== filterCategory) return false;
    if (filterFloor !== 'todos' && room.floor !== filterFloor) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const numMatch = room.number.toLowerCase().includes(q);
      const guestMatch = room.guestName ? room.guestName.toLowerCase().includes(q) : false;
      const catMatch = room.category.toLowerCase().includes(q);
      return numMatch || guestMatch || catMatch;
    }
    return true;
  });

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber) return;

    const roomPayload = {
      number: newRoomNumber,
      name: newRoomName || `Quarto ${newRoomNumber}`,
      category: newRoomCategory,
      floor: newRoomFloor,
      status: 'livre',
      capacity: Number(newRoomCapacity) || 2,
      dailyPrice: Number(newRoomPrice) || 180,
      photos: newRoomPhotos,
      fotoCapa: newRoomPhotos[0] || '',
      active: true,
    };

    let quartoFinalId: string = '';

    if (isEditMode && editingRoomId) {
      quartoFinalId = editingRoomId;
      setRooms(rooms.map(r => (
        r.id === editingRoomId
          ? { ...r, ...roomPayload, status: r.status }
          : r
      )));
      try {
        await quartosService.updateQuarto(editingRoomId, {
          ...roomPayload,
          status: rooms.find(r => r.id === editingRoomId)?.status || 'livre',
        });
        window.dispatchEvent(new CustomEvent('hotel_quarto_modificado', { detail: { id: editingRoomId } }));
        window.dispatchEvent(new CustomEvent('hotel_novo_quarto'));
      } catch (err) {
        console.error('Erro ao atualizar quarto:', err);
      }
    } else {
      quartoFinalId = Date.now().toString();
      const newRoom: Room = {
        id: quartoFinalId,
        ...roomPayload,
      } as Room;
      setRooms([newRoom, ...rooms]);
      try {
        await quartosService.createQuarto(roomPayload);
        window.dispatchEvent(new CustomEvent('hotel_novo_quarto'));
      } catch (err) {
        console.error('Erro ao criar quarto:', err);
      }
    }

    try {
      await destaquesQuartoService.setDestaquesDoQuarto(quartoFinalId, newRoomDestaques);
    } catch (err) {
      console.warn('Erro ao salvar vínculo de destaques do quarto:', err);
    }

    resetRoomForm();
    setIsNovoQuartoOpen(false);
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    const newItem: RoomItem = {
      id: Date.now().toString(),
      name: newItemName,
      category: newItemCategory,
      quantity: Number(newItemQuantity) || 1,
      status: 'Ativo',
      notes: newItemNotes,
    };
    setItems([newItem, ...items]);
    setNewItemName('');
    setNewItemNotes('');
    setIsCadastrarItemOpen(false);
  };

  const handleUpdateStatus = async (roomId: string, newStatus: string, newGuestName?: string, explicitMotivo?: string) => {
    // Regra 1: Somente usuários do tipo Camareira ou Hotel podem marcar como limpo ('livre')
    if (newStatus === 'livre' && !canMarkAsClean) {
      showToast('⚠️ Permissão restrita: Somente usuários do tipo Camareira e Hotel podem marcar o quarto como limpo após a higienização.');
      return;
    }

    const targetRoom = rooms.find(r => r.id === roomId);
    const stInfo = getStatusInfo(newStatus);

    // Regra 2: Exige justificativa/motivo do operador ao aplicar status se configurado no status
    let finalMotivo = explicitMotivo !== undefined ? explicitMotivo : targetRoom?.motivo_bloqueio;
    if (stInfo.exige_motivo && explicitMotivo === undefined) {
      const resp = prompt(`Informe a justificativa / motivo para colocar o Quarto ${targetRoom?.number || ''} em "${stInfo.nome}":`, targetRoom?.motivo_bloqueio || '');
      if (resp === null) {
        // Operador cancelou a alteração de status
        return;
      }
      finalMotivo = resp.trim();
    } else if (newStatus === 'livre') {
      finalMotivo = undefined; // Quarto limpo e liberado, encerra qualquer motivo anterior
    }

    const updatedGuestName = newStatus === 'ocupado' ? (newGuestName || 'Hóspede') : undefined;

    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          status: newStatus,
          guestName: updatedGuestName,
          motivo_bloqueio: finalMotivo
        };
      }
      return r;
    }));
    if (selectedRoom && selectedRoom.id === roomId) {
      setSelectedRoom({
        ...selectedRoom,
        status: newStatus,
        guestName: updatedGuestName,
        motivo_bloqueio: finalMotivo
      });
    }

    try {
      await quartosService.updateQuarto(roomId, {
        status: newStatus,
        hospede_atual: updatedGuestName,
        number: targetRoom?.number,
        notes: finalMotivo || targetRoom?.notes
      });
      if (newStatus === 'limpeza' || stInfo.notifica_camareira) {
        if (targetRoom?.number) {
          quartosService.solicitarLimpezaQuarto(targetRoom.number);
        }
        showToast(`🧹 Quarto ${targetRoom?.number || ''} em "${stInfo.nome}" (equipe de governança notificada).`);
      } else if (newStatus === 'livre') {
        showToast(`✨ Quarto ${targetRoom?.number || ''} marcado como limpo e liberado.`);
      } else {
        showToast(`Quarto ${targetRoom?.number || ''} alterado para status "${stInfo.nome}".`);
      }
    } catch (err) {
      console.warn('Erro ao atualizar status do quarto:', err);
    }
  };

  // Obter informações detalhadas de governança/higienização para a gestão do hotel
  const getHousekeepingDetails = (room: Room) => {
    const hk = (room as any).items?.housekeeping;
    let histRecord: any = null;
    try {
      const hId = currentHotelService.getCurrentHotel().id;
      const raw = localStorage.getItem(`hotelnozap_historico_limpeza_${hId}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          histRecord = list.find((h: any) => h.quartoId === room.id || h.numero === room.number);
        }
      }
    } catch {}

    const ultima = hk?.ultima_higienizacao || (histRecord ? {
      limpo_por: histRecord.limpoPor,
      horario_inicio: histRecord.horarioInicio,
      horario_conclusao: histRecord.horarioConclusao,
      data_conclusao: histRecord.dataConclusao,
      tempo_gasto_minutos: histRecord.tempoGastoMinutos,
      servicos_realizados: histRecord.servicosRealizados,
      observacoes: histRecord.observacoes
    } : null);

    return {
      camareiraAtual: hk?.camareira_nome || null,
      inicioLimpeza: hk?.inicio_limpeza || null,
      ultimaHigienizacao: ultima
    };
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-5 pb-24 lg:pb-12 relative">
      {/* Toast de Notificação e Permissões */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-amber-400 text-lg">info</span>
          <span>{toastMessage}</span>
        </div>
      )}
      
      {/* TOP TITLE HEADER */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0b1c30] tracking-tight">Mapa de Quartos</h1>
          <p className="text-sm text-[#45464d] mt-0.5">Visão geral e status das acomodações.</p>
        </div>
        
        {/* DESKTOP ACTION BUTTONS */}
        <div className="hidden sm:flex gap-2.5 w-full sm:w-auto">
          <button 
            onClick={handleOpenCategorias}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer text-xs sm:text-sm font-semibold shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">category</span>
            <span>Categorias</span>
          </button>

          <button 
            onClick={handleOpenTiposQuarto}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer text-xs sm:text-sm font-semibold shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">meeting_room</span>
            <span>Tipo do Quarto</span>
          </button>

          <button 
            onClick={handleOpenCadastrarItens}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#d3e4fe] hover:bg-[#c6c6cd]/40 text-[#0b1c30] border border-[#c6c6cd] rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer text-xs sm:text-sm font-semibold shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">inventory_2</span>
            <span>Cadastrar Itens</span>
          </button>

          <button 
            onClick={handleOpenGerenciarDestaques}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer text-xs sm:text-sm font-semibold shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">grade</span>
            <span>Gerenciar Destaques</span>
          </button>
          
          <button 
            onClick={handleOpenNovoQuarto}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#000000] hover:bg-[#0b1c30] text-white rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer text-xs sm:text-sm font-semibold shadow-sm"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Novo Quarto</span>
          </button>
        </div>
      </header>

      {/* MOBILE ACTION BUTTONS GRID */}
      <div className="grid grid-cols-2 gap-2 sm:hidden w-full">
        {/* Linha 1: Novo Quarto (Full width) */}
        <button 
          onClick={handleOpenNovoQuarto}
          className="col-span-2 w-full py-2.5 px-3 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Novo Quarto</span>
        </button>

        {/* Linha 2: Categorias e Tipo do Quarto */}
        <button 
          onClick={handleOpenCategorias}
          className="w-full py-2.5 px-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">category</span>
          <span>Categorias</span>
        </button>

        <button 
          onClick={handleOpenTiposQuarto}
          className="w-full py-2.5 px-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">meeting_room</span>
          <span>Tipo do Quarto</span>
        </button>

        {/* Linha 3: Cadastrar Itens e Exportar */}
        <button 
          onClick={handleOpenCadastrarItens}
          className="w-full py-2.5 px-3 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">inventory_2</span>
          <span>Cadastrar Itens</span>
        </button>

        <button 
          onClick={() => alert('Exportando lista de quartos em formato Excel...')}
          className="w-full py-2.5 px-3 bg-[#FDB116] hover:bg-[#eab308] text-[#0b1c30] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">file_download</span>
          <span>Exportar</span>
        </button>

        {/* Linha 4: Gerenciar Destaques (Full width) */}
        <button 
          onClick={handleOpenGerenciarDestaques}
          className="col-span-2 w-full py-2.5 px-3 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">grade</span>
          <span>Gerenciar Destaques da Acomodação</span>
        </button>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por número ou hóspede..." 
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="hidden sm:flex items-center gap-2">
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-xs"
          >
            <option value="todos">Todas Categorias</option>
            <option value="STANDARD">Standard</option>
            <option value="LUXO">Luxo</option>
            <option value="SUÍTE">Suíte</option>
          </select>

          <select 
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:border-emerald-500 shadow-xs"
          >
            <option value="todos">Todos os Andares</option>
            <option value="Térreo">Térreo</option>
            <option value="1º Andar">1º Andar</option>
            <option value="2º Andar">2º Andar</option>
            <option value="3º Andar">3º Andar</option>
          </select>

          {(filterStatus !== 'todos' || filterCategory !== 'todos' || filterFloor !== 'todos' || searchQuery) && (
            <button 
              onClick={() => {
                setFilterStatus('todos');
                setFilterCategory('todos');
                setFilterFloor('todos');
                setSearchQuery('');
              }}
              className="px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">filter_alt_off</span>
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* Mobile Filter Button */}
        <button 
          onClick={() => {
            const nextCat = filterCategory === 'todos' ? 'STANDARD' : filterCategory === 'STANDARD' ? 'LUXO' : filterCategory === 'LUXO' ? 'SUÍTE' : 'todos';
            setFilterCategory(nextCat);
          }}
          className="sm:hidden flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
        >
          <span className="material-symbols-outlined text-base text-slate-600">filter_list</span>
          <span>Filtros</span>
        </button>
      </div>

      {/* KPI STATUS CARDS (DINÂMICOS CONFORME CADASTRADO PELO ADMIN) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 w-full">
        {availableStatus.filter(s => s.status === 'ativo').map((st) => {
          const count = rooms.filter(r => (r.status || 'livre').toLowerCase() === st.slug).length;
          const isSelected = filterStatus === st.slug;

          return (
            <div 
              key={st.slug}
              onClick={() => setFilterStatus(isSelected ? 'todos' : st.slug)}
              style={{
                backgroundColor: st.cor_fundo,
                borderColor: isSelected ? st.cor_texto : st.cor_borda
              }}
              className={
                "border rounded-xl p-3 sm:p-3.5 flex flex-col justify-between shadow-xs relative overflow-hidden cursor-pointer transition-all active:scale-[0.98] " +
                (isSelected ? 'ring-2 shadow-sm' : 'hover:opacity-90')
              }
            >
              <div className="flex items-center justify-between gap-1">
                <span 
                  style={{ color: st.cor_texto }}
                  className="text-xs font-bold uppercase tracking-wider truncate"
                >
                  {st.nome}
                </span>
                <span 
                  style={{ color: st.cor_texto }}
                  className="material-symbols-outlined text-lg sm:text-xl shrink-0"
                >
                  {st.icone}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span 
                  style={{ color: st.cor_texto }}
                  className="text-xl sm:text-2xl font-black"
                >
                  {count}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {count === 1 ? '1 quarto' : `${count} quartos`}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* MOBILE LIST VIEW (Visible on mobile/tablet md:hidden) */}
      <section className="space-y-3 md:hidden">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-[#0b1c30]">Todos os Quartos ({filteredRooms.length})</h2>
          <span className="text-xs text-[#45464d] font-medium">Ordenado por número</span>
        </div>

        {filteredRooms.map((room) => {
          const stInfo = getStatusInfo(room.status);
          let statusText = stInfo.nome;
          let details = `${room.capacity ? room.capacity + ' Pessoas' : 'Standard'} • ${room.floor}`;

          if (room.status === 'ocupado') {
            details = room.guestName ? `Hóspede: ${room.guestName}` : 'Hóspede Ativo';
          } else if (room.status === 'limpeza') {
            const hk = (room as any).items?.housekeeping;
            if (hk?.camareira_nome) {
              statusText = `Limpeza: ${hk.camareira_nome}`;
              details = `Em limpeza por ${hk.camareira_nome}`;
            } else {
              details = 'Aguardando camareira';
            }
          }

          return (
            <div 
              key={room.id}
              onClick={() => handleOpenRoomModal(room)}
              className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div 
                  style={{
                    backgroundColor: stInfo.cor_fundo,
                    color: stInfo.cor_texto,
                    borderColor: stInfo.cor_borda
                  }}
                  className="w-11 h-11 rounded-lg border flex items-center justify-center font-bold text-base shadow-2xs"
                >
                  {room.number}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{room.category}</h3>
                  <p className="text-xs text-slate-500">{details}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span 
                  style={{
                    backgroundColor: stInfo.cor_fundo,
                    color: stInfo.cor_texto,
                    borderColor: stInfo.cor_borda
                  }}
                  className="px-2.5 py-1 rounded-full font-bold text-xs shrink-0 border flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">{stInfo.icone}</span>
                  <span>{statusText}</span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditRoom(room);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                    title="Editar quarto"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAskDeleteRoom(room);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                    title="Excluir quarto"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* DESKTOP GRID VIEW (Visible on md:grid >= 768px) */}
      <main className="hidden md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredRooms.map((room) => {
          const stInfo = getStatusInfo(room.status);
          let statusLabel = stInfo.nome;
          let iconName = stInfo.icone;

          if (room.status === 'limpeza') {
            const hk = (room as any).items?.housekeeping;
            if (hk?.camareira_nome) {
              statusLabel = `Limpeza: ${hk.camareira_nome}`;
            } else {
              statusLabel = 'Aguardando Limpeza';
            }
          }

          return (
            <article 
              key={room.id}
              onClick={() => handleOpenRoomModal(room)}
              className="bg-white border border-[#c6c6cd]/50 rounded-xl p-4 flex flex-col justify-between min-h-[140px] shadow-xs hover:shadow-md transition-all cursor-pointer relative overflow-hidden group hover:border-[#006c49]/40"
            >
              <div 
                style={{ backgroundColor: stInfo.cor_texto }}
                className="absolute top-0 left-0 w-full h-1"
              />

              <div className="flex justify-between items-start pt-1">
                <div>
                  <h2 className="text-2xl font-extrabold text-[#0b1c30] tracking-tight">{room.number}</h2>
                  <p className="text-xs font-semibold text-[#45464d] tracking-wider uppercase mt-0.5">{room.category}</p>
                </div>
                <div 
                  style={{
                    backgroundColor: stInfo.cor_fundo,
                    color: stInfo.cor_texto,
                    borderColor: stInfo.cor_borda
                  }}
                  className="px-2 py-0.5 rounded text-xs font-bold border flex items-center gap-1 shadow-2xs"
                >
                  <span className="material-symbols-outlined text-xs">{iconName}</span>
                  <span>{statusLabel}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-end text-[#45464d]">
                {room.status === 'ocupado' && room.guestName ? (
                  <div className="flex items-center gap-1 truncate max-w-[120px]">
                    <span className="material-symbols-outlined text-[#ba1a1a] text-base">person</span>
                    <span className="text-xs font-semibold text-[#ba1a1a] truncate">{room.guestName}</span>
                  </div>
                ) : room.status === 'limpeza' && (room as any).items?.housekeeping?.camareira_nome ? (
                  <div className="flex items-center gap-1 truncate max-w-[140px] text-amber-800" title={`Em limpeza por ${(room as any).items.housekeeping.camareira_nome}`}>
                    <span className="material-symbols-outlined text-amber-700 text-base">person</span>
                    <span className="text-xs font-semibold truncate">{(room as any).items.housekeeping.camareira_nome}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditRoom(room);
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-xs"
                      title="Editar quarto"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAskDeleteRoom(room);
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer shadow-xs"
                      title="Excluir quarto"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                )}

                <span 
                  style={{ color: stInfo.cor_texto }}
                  className="material-symbols-outlined text-xl shrink-0"
                >
                  {iconName}
                </span>
              </div>
            </article>
          );
        })}
      </main>

      {/* NO ROOMS FOUND STATE */}
      {filteredRooms.length === 0 && (
        <div className="py-12 text-center text-[#45464d] bg-white rounded-xl border border-dashed border-[#c6c6cd]">
          <span className="material-symbols-outlined text-4xl text-[#45464d]/60 mb-2">search_off</span>
          <p className="font-semibold text-[#0b1c30]">Nenhum quarto encontrado</p>
          <p className="text-xs text-[#45464d] mt-1">Tente ajustar os filtros ou o termo de busca.</p>
        </div>
      )}

      {/* MODAL: NOVO QUARTO */}
      {isNovoQuartoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-[#c6c6cd] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="px-6 py-4 border-b border-[#c6c6cd]/40 flex justify-between items-center bg-[#f8f9ff]">
              <div>
                <h3 className="text-xl font-bold text-[#0b1c30]">
                  {isEditMode ? `Editar Quarto ${newRoomNumber || ''}` : 'Cadastro de Novo Quarto'}
                </h3>
                <p className="text-xs text-[#45464d]">
                  {isEditMode ? 'Atualize as informações do quarto e clique em Salvar.' : 'Preencha os dados abaixo para registrar uma nova acomodação.'}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsNovoQuartoOpen(false);
                  resetRoomForm();
                }}
                className="p-1 rounded-lg text-[#45464d] hover:bg-[#c6c6cd]/30 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="p-6 overflow-y-auto flex flex-col gap-5">
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[#0b1c30] uppercase">Fotos do Quarto (Máximo 5)</label>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    newRoomPhotos.length >= MAX_ROOM_PHOTOS 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                      : 'bg-[#eff4ff] text-[#006c49] border border-[#c6c6cd]/50'
                  }`}>
                    {newRoomPhotos.length} / {MAX_ROOM_PHOTOS}
                  </span>
                </div>

                {modalPhotoError && (
                  <div className="mb-2 p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-1.5 animate-in fade-in">
                    <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
                    <span>{modalPhotoError}</span>
                  </div>
                )}
                
                <input 
                  type="file"
                  ref={modalFileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleModalFileSelect}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-3">
                  {newRoomPhotos.length < MAX_ROOM_PHOTOS ? (
                    <div 
                      onClick={() => modalFileInputRef.current?.click()}
                      className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-[#c6c6cd] rounded-xl bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors group"
                    >
                      <span className="material-symbols-outlined text-[#45464d] group-hover:text-[#006c49] mb-1">add_a_photo</span>
                      <span className="text-[10px] text-[#45464d] font-medium text-center px-1">Adicionar Foto</span>
                    </div>
                  ) : (
                    <div 
                      className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 opacity-60 cursor-not-allowed"
                      title="Limite máximo de 5 fotos atingido"
                    >
                      <span className="material-symbols-outlined text-gray-400 mb-1 text-xl">check_circle</span>
                      <span className="text-[9px] text-gray-500 font-semibold text-center px-1">Limite (5/5)</span>
                    </div>
                  )}

                  {newRoomPhotos.map((url, idx) => (
                    <div key={idx} className="w-24 h-24 rounded-xl border border-[#c6c6cd]/50 overflow-hidden relative group">
                      <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setNewRoomPhotos(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-white"
                      >
                        <span className="material-symbols-outlined text-xs text-[#ba1a1a]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Número do Quarto *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: 401"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:border-[#006c49]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Nome / Identificação</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Suíte Presidencial"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:border-[#006c49]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Categoria *</label>
                  <select 
                    value={newRoomCategory}
                    onChange={(e) => setNewRoomCategory(e.target.value as any)}
                    className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:border-[#006c49]"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="LUXO">Luxo</option>
                    <option value="SUÍTE">Suíte</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Andar *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: 1º Andar"
                    value={newRoomFloor}
                    onChange={(e) => setNewRoomFloor(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] placeholder-[#45464d]/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Valor da Diária (R$) *</label>
                  <input 
                    type="number" 
                    value={newRoomPrice}
                    onChange={(e) => setNewRoomPrice(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:border-[#006c49]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Capacidade (Pessoas)</label>
                  <input 
                    type="number" 
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                    className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm focus:outline-none focus:border-[#006c49]"
                  />
                </div>
              </div>

              {/* DESTAQUES DA ACOMODAÇÃO */}
              <div className="bg-[#f8f9ff] p-4 rounded-xl border border-[#c6c6cd]/50">
                <label className="block text-xs font-bold text-[#0b1c30] mb-3 uppercase tracking-wide">
                  Destaques da Acomodação
                  <span className="text-[10px] text-[#45464d] font-normal normal-case ml-2">
                    (itens que aparecem no topo da página de detalhes do quarto)
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  {destaquesList.filter(d => d.status === 'ativo').length === 0 && (
                    <div className="col-span-full text-center text-xs text-[#45464d] py-3 italic">
                      Nenhum destaque cadastrado. Clique em "Gerenciar Destaques" para criar.
                    </div>
                  )}
                  {destaquesList.filter(d => d.status === 'ativo').sort((a, b) => a.order - b.order).map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer group bg-white p-2.5 rounded-lg border border-slate-200 hover:border-orange-300 transition-colors">
                      <input
                        type="checkbox"
                        checked={newRoomDestaques.includes(d.id)}
                        onChange={() => handleToggleDestaqueSelection(d.id)}
                        className="w-4 h-4 text-[#ea580c] bg-white border-[#c6c6cd] rounded focus:ring-[#ea580c]"
                      />
                      {cleanIconClass(d.iconClass) ? (
                        <i
                          className={cleanIconClass(d.iconClass)}
                          style={{ color: d.iconColor || '#6d28d9', fontSize: '1.125rem', lineHeight: 1 }}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-lg shrink-0" style={{ color: d.iconColor || '#6d28d9' }}>{d.icon}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#0b1c30] truncate group-hover:text-[#ea580c]">{d.title}</p>
                        <p className="text-[10px] text-[#45464d] truncate leading-tight">{d.subtitle}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#c6c6cd]/40 mt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsNovoQuartoOpen(false);
                    resetRoomForm();
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#45464d] hover:bg-[#c6c6cd]/20 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#000000] text-white hover:bg-[#0b1c30] transition-colors shadow-sm cursor-pointer"
                >
                  {isEditMode ? 'Salvar Alterações' : 'Salvar Quarto'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR ITENS */}
      {isCadastrarItemOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-xl border border-[#c6c6cd] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="px-6 py-4 border-b border-[#c6c6cd]/40 flex justify-between items-center bg-[#f8f9ff]">
              <div>
                <h3 className="text-xl font-bold text-[#0b1c30]">Cadastro de Itens / Comodidades</h3>
                <p className="text-xs text-[#45464d]">Registre itens disponíveis nos quartos do hotel.</p>
              </div>
              <button 
                onClick={() => setIsCadastrarItemOpen(false)}
                className="p-1 rounded-lg text-[#45464d] hover:bg-[#c6c6cd]/30 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <form onSubmit={handleAddItem} className="flex flex-col gap-4 bg-[#f8f9ff] p-4 rounded-xl border border-[#c6c6cd]/40">
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Novo Item</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Nome do Item *</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Smart TV 55''"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-[#c6c6cd] rounded-lg text-xs focus:outline-none focus:border-[#006c49]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Categoria</label>
                    <select 
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-[#c6c6cd] rounded-lg text-xs focus:outline-none focus:border-[#006c49]"
                    >
                      <option value="Eletrônicos">Eletrônicos</option>
                      <option value="Eletrodoméstico">Eletrodoméstico</option>
                      <option value="Móveis">Móveis</option>
                      <option value="Acessórios">Acessórios</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <div className="w-1/3">
                    <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Quantidade</label>
                    <input 
                      type="number"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-[#c6c6cd] rounded-lg text-xs focus:outline-none focus:border-[#006c49]"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="mt-5 px-4 py-2 bg-[#006c49] text-white font-semibold text-xs rounded-lg hover:bg-[#00714d] transition-colors shadow-xs cursor-pointer"
                  >
                    Adicionar Item
                  </button>
                </div>
              </form>

              <div>
                <h4 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider mb-2">Itens Cadastrados ({items.length})</h4>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-[#c6c6cd]/40 rounded-lg text-xs">
                      <div>
                        <p className="font-bold text-[#0b1c30]">{item.name}</p>
                        <p className="text-[#45464d] text-[11px]">{item.category} • Qtd: {item.quantity}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#6cf8bb]/20 text-[#00714d] font-semibold text-[10px]">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-6 py-3 border-t border-[#c6c6cd]/40 flex justify-end bg-[#f8f9ff]">
              <button 
                onClick={() => setIsCadastrarItemOpen(false)}
                className="px-4 py-2 bg-[#000000] text-white font-semibold text-xs rounded-lg hover:bg-[#0b1c30] cursor-pointer"
              >
                Concluir
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO QUARTO / ALTERAR STATUS */}
      {selectedRoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col my-auto">
            {/* Header Escuro Padrão #003400 */}
            <div className="px-5 py-4 flex items-center justify-between bg-[#003400] text-white shadow-md">
              <div>
                <span className="text-xs text-emerald-300 font-mono uppercase tracking-wider block">{selectedRoom.category} • {selectedRoom.floor}</span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">Quarto {selectedRoom.number}</h3>
              </div>
              <button 
                onClick={() => setSelectedRoom(null)}
                type="button"
                aria-label="Fechar Modal"
                className="bg-[#b91c1c] text-white hover:bg-red-800 transition-colors p-1.5 rounded-xl shrink-0 flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              
              <div className="grid grid-cols-2 gap-4 bg-[#f8f9ff] p-4 rounded-xl border border-[#c6c6cd]/40 text-xs">
                <div>
                  <span className="text-[#45464d] block mb-0.5">Valor Diária</span>
                  <span className="font-bold text-[#0b1c30] text-sm">R$ {selectedRoom.dailyPrice || 180},00</span>
                </div>
                <div>
                  <span className="text-[#45464d] block mb-0.5">Capacidade</span>
                  <span className="font-bold text-[#0b1c30] text-sm">{selectedRoom.capacity || 2} Pessoas</span>
                </div>
                {selectedRoom.status === 'ocupado' && selectedRoom.guestName && (
                  <div className="col-span-2 pt-2 border-t border-[#c6c6cd]/40">
                    <span className="text-[#45464d] block mb-0.5">Hóspede Atual</span>
                    <span className="font-bold text-[#ba1a1a] text-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">person</span>
                      {selectedRoom.guestName}
                    </span>
                  </div>
                )}
              </div>

              {/* SEÇÃO GOVERNANÇA & HIGIENIZAÇÃO (GESTÃO DO HOTEL) */}
              {(() => {
                const hkInfo = getHousekeepingDetails(selectedRoom);
                return (
                  <div className="bg-[#f0fdf4] p-4 rounded-xl border border-emerald-200 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-emerald-700 text-base">cleaning_services</span>
                        Governança &amp; Higienização
                      </span>
                      {selectedRoom.status === 'limpeza' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {hkInfo.camareiraAtual ? 'Em Andamento' : 'Aguardando Camareira'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Liberado / Limpo
                        </span>
                      )}
                    </div>

                    {selectedRoom.status === 'limpeza' ? (
                      <div className="space-y-1.5 text-slate-700 bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">Camareira Responsável:</span>
                          <span className="font-bold text-slate-900">
                            {hkInfo.camareiraAtual || 'Disponível para qualquer camareira'}
                          </span>
                        </div>
                        {hkInfo.inicioLimpeza && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Iniciado às:</span>
                            <span className="font-semibold text-slate-800">
                              {new Date(hkInfo.inicioLimpeza).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (há {Math.max(1, Math.round((Date.now() - new Date(hkInfo.inicioLimpeza).getTime()) / 60000))} min)
                            </span>
                          </div>
                        )}
                        {!hkInfo.camareiraAtual && (
                          <p className="text-[11px] text-amber-800 font-medium">
                            🔔 Quarto notificado para todas as camareiras da equipe do hotel.
                          </p>
                        )}
                      </div>
                    ) : hkInfo.ultimaHigienizacao ? (
                      <div className="space-y-2 bg-white/80 p-3 rounded-lg border border-emerald-100">
                        <div className="flex items-center justify-between text-slate-800">
                          <span className="text-slate-500 font-medium">Quem limpou:</span>
                          <span className="font-bold text-emerald-900 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-emerald-600">person</span>
                            {hkInfo.ultimaHigienizacao.limpo_por || 'Camareira'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-800">
                          <span className="text-slate-500 font-medium">Tempo de limpeza:</span>
                          <span className="font-bold text-slate-900">
                            ⏱️ {hkInfo.ultimaHigienizacao.tempo_gasto_minutos || 25} minutos
                            {hkInfo.ultimaHigienizacao.horario_inicio && ` (${hkInfo.ultimaHigienizacao.horario_inicio} às ${hkInfo.ultimaHigienizacao.horario_conclusao})`}
                          </span>
                        </div>
                        {hkInfo.ultimaHigienizacao.servicos_realizados && hkInfo.ultimaHigienizacao.servicos_realizados.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              O que foi feito de limpeza:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {hkInfo.ultimaHigienizacao.servicos_realizados.map((serv: string, sIdx: number) => (
                                <span key={sIdx} className="text-[10px] bg-emerald-100/90 text-emerald-900 font-semibold px-2 py-0.5 rounded-md border border-emerald-200">
                                  ✓ {serv}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {hkInfo.ultimaHigienizacao.observacoes && (
                          <div className="text-[11px] text-slate-600 italic bg-amber-50/70 p-2 rounded border border-amber-200/60 mt-1">
                            &quot;<strong>Observação da Camareira:</strong> {hkInfo.ultimaHigienizacao.observacoes}&quot;
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic bg-white/70 p-2 rounded border border-emerald-100">
                        Quarto higienizado e pronto para hospedagem. Histórico detalhado será atualizado nas próximas liberações.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* ALERTA DE MOTIVO / JUSTIFICATIVA REGISTRADA NO STATUS */}
              {selectedRoom.motivo_bloqueio && (
                <div className="bg-amber-50/90 border border-amber-200 p-3 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                  <span className="material-symbols-outlined text-amber-700 text-lg shrink-0 mt-0.5">report_problem</span>
                  <div className="flex-1">
                    <span className="font-bold block text-slate-900">Justificativa / Motivo do Status:</span>
                    <span className="text-[11px] text-amber-900 leading-tight block mt-0.5">
                      &quot;{selectedRoom.motivo_bloqueio}&quot;
                    </span>
                  </div>
                </div>
              )}

              {/* SEÇÃO CHECK-IN SEGUNDO A REGRA DO STATUS (permite_ocupacao) */}
              <div>
                {(() => {
                  const currentSt = getStatusInfo(selectedRoom.status);
                  if (selectedRoom.status === 'ocupado') {
                    return null;
                  }
                  if (currentSt.permite_ocupacao) {
                    return (
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={() => handleStartCheckinForRoom(selectedRoom)}
                          className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                          title="Realizar Check-in com FNRH, Chave e Pagamento"
                        >
                          <span className="material-symbols-outlined text-lg">login</span>
                          <span>Realizar Check-in (Entrada de Hóspede)</span>
                        </button>
                      </div>
                    );
                  }
                  // Regra de Status: Não permite ocupação / check-in
                  return (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shadow-xs">
                      <div className="flex items-start sm:items-center gap-2">
                        <span className="material-symbols-outlined text-amber-700 text-xl shrink-0 mt-0.5 sm:mt-0">do_not_disturb_on</span>
                        <div>
                          <span className="font-bold block text-slate-900">Check-in Indisponível (Quarto {currentSt.nome})</span>
                          <span className="text-[11px] text-amber-800 leading-tight block">
                            A regra deste status bloqueia a entrada de hóspedes. Altere para um status liberado (ex: Livre).
                          </span>
                        </div>
                      </div>
                      {canMarkAsClean && selectedRoom.status === 'limpeza' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(selectedRoom.id, 'livre')}
                          className="shrink-0 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Liberar Quarto</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                      Alterar Status do Quarto
                    </label>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {availableStatus.filter(s => s.status === 'ativo').length} cadastrados
                    </span>
                  </div>
                  {!canMarkAsClean && (
                    <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-amber-600">lock</span>
                      <span>Marcar limpo: Camareira/Hotel</span>
                    </span>
                  )}
                </div>

                {/* GRID COM TODOS OS STATUS CADASTRADOS PELO ADMIN */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableStatus.filter(s => s.status === 'ativo').map((st) => {
                    const isSelected = (selectedRoom.status || 'livre').toLowerCase() === st.slug;
                    const isLivre = st.slug === 'livre';
                    const isOcupado = st.slug === 'ocupado';

                    return (
                      <button
                        key={st.slug}
                        type="button"
                        onClick={() => {
                          if (isLivre) {
                            if (!canMarkAsClean && selectedRoom.status !== 'livre') {
                              showToast('⚠️ Permissão restrita: Somente usuários do tipo Camareira ou Hotel podem marcar o quarto como limpo após a higienização.');
                              return;
                            }
                            handleUpdateStatus(selectedRoom.id, 'livre');
                          } else if (isOcupado) {
                            if (selectedRoom.status !== 'ocupado') {
                              handleStartCheckinForRoom(selectedRoom);
                            } else {
                              const name = prompt('Atualizar Nome do Hóspede:', selectedRoom.guestName || '');
                              if (name !== null) {
                                handleUpdateStatus(selectedRoom.id, 'ocupado', name);
                              }
                            }
                          } else {
                            handleUpdateStatus(selectedRoom.id, st.slug);
                          }
                        }}
                        style={isSelected ? {
                          backgroundColor: st.cor_fundo,
                          color: st.cor_texto,
                          borderColor: st.cor_borda || st.cor_texto
                        } : {
                          borderLeftColor: st.cor_texto,
                          borderLeftWidth: '3.5px'
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
                          isSelected
                            ? 'shadow-xs ring-2 ring-emerald-600/30 font-extrabold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        } ${!canMarkAsClean && isLivre && selectedRoom.status !== 'livre' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={st.descricao ? `${st.nome} - ${st.descricao}` : st.nome}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="material-symbols-outlined text-base shrink-0" style={{ color: isSelected ? st.cor_texto : undefined }}>
                            {st.icone}
                          </span>
                          <span className="truncate">{st.nome}</span>
                        </div>
                        {isSelected ? (
                          <span className="material-symbols-outlined text-xs shrink-0 font-bold" style={{ color: st.cor_texto }}>check</span>
                        ) : !st.permite_ocupacao ? (
                          <span className="material-symbols-outlined text-[13px] text-slate-400 shrink-0" title="Bloqueia Entrada/Check-in">block</span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Permite Check-in"></span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="px-6 py-3 border-t border-[#c6c6cd]/40 flex justify-end bg-[#f8f9ff]">
              <button 
                onClick={() => setSelectedRoom(null)}
                className="px-5 py-2 bg-[#b91c1c] hover:bg-red-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Fechar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE QUARTO */}
      {isDeleteQuartoModalOpen && roomToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-red-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 flex items-center gap-4 border-b border-red-100 bg-red-50/70">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-red-900 leading-tight">Excluir Quarto?</h3>
                <p className="text-xs text-red-800 mt-0.5">
                  Quarto <span className="font-mono font-semibold">{roomToDelete.number}</span> • {roomToDelete.category}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-[#45464d] leading-relaxed">
                Tem certeza que deseja excluir permanentemente este quarto?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-red-600 shrink-0 mt-0.5">warning</span>
                <div>
                  <p className="font-semibold">Esta ação não pode ser desfeita.</p>
                  <p className="mt-0.5 opacity-90">
                    Todas as configurações, histórico de status e dados cadastrais do quarto serão removidos. Quartos ocupados ou com reservas ativas não são recomendados para exclusão.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#c6c6cd]/40 flex justify-end gap-3 bg-[#f8f9ff]">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteQuartoModalOpen(false);
                  setRoomToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-[#45464d] hover:bg-[#c6c6cd]/20 transition-colors cursor-pointer border border-[#c6c6cd]/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoom}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-[#b91c1c] hover:bg-red-800 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Excluir Quarto</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GERENCIAR CATEGORIAS */}
      {isCategoriasModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">category</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Categorias de Quartos</h3>
                  <p className="text-xs text-slate-500">Gerencie as categorias de acomodação</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCategoriasModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              
              {/* Nova Categoria Form */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Adicionar Nova Categoria
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder="Ex: PRESIDENCIAL, CHALÊ..."
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent uppercase"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newCategoryInput.trim()) {
                        const upper = newCategoryInput.trim().toUpperCase();
                        if (!categoriesList.includes(upper)) {
                          setCategoriesList([...categoriesList, upper]);
                        }
                        setNewCategoryInput('');
                      }
                    }}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Lista de Categorias Atuais */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Categorias Cadastradas ({categoriesList.length})
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {categoriesList.map((cat) => (
                    <div key={cat} className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-900">
                      <span>{cat}</span>
                      {categoriesList.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setCategoriesList(categoriesList.filter(c => c !== cat))}
                          className="text-purple-400 hover:text-purple-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setIsCategoriasModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Concluir
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL GERENCIAR TIPOS DO QUARTO */}
      {isTiposQuartoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-violet-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">meeting_room</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Tipos de Quartos</h3>
                  <p className="text-xs text-slate-500">Gerencie os tipos e modelos de acomodação</p>
                </div>
              </div>
              <button 
                onClick={() => setIsTiposQuartoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              
              {/* Novo Tipo Form */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Adicionar Novo Tipo de Quarto
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newTipoQuartoInput}
                    onChange={(e) => setNewTipoQuartoInput(e.target.value)}
                    placeholder="Ex: SUÍTE MASTER, CHALÊ FAMÍLIA..."
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent capitalize"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newTipoQuartoInput.trim()) {
                        const val = newTipoQuartoInput.trim();
                        if (!tiposQuartoList.includes(val)) {
                          setTiposQuartoList([...tiposQuartoList, val]);
                        }
                        setNewTipoQuartoInput('');
                      }
                    }}
                    className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>

              {/* Lista de Tipos Atuais */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Tipos Cadastrados ({tiposQuartoList.length})
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {tiposQuartoList.map((tipo) => (
                    <div key={tipo} className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg text-xs font-bold text-violet-900">
                      <span>{tipo}</span>
                      {tiposQuartoList.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setTiposQuartoList(tiposQuartoList.filter(t => t !== tipo))}
                          className="text-violet-400 hover:text-violet-700 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsTiposQuartoModalOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Concluir
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CHECK-IN / ENTRADA DO HÓSPEDE (FNRH, CHAVE & DIÁRIA) */}
      <ModalCheckinEntrada
        isOpen={!!checkinModalReserva}
        reserva={checkinModalReserva}
        onClose={() => setCheckinModalReserva(null)}
        onSuccess={() => {
          quartosService.getQuartos().then(data => setRooms(data || []));
          setCheckinModalReserva(null);
        }}
      />
    </div>
  );
};

export default MapaQuartos;
