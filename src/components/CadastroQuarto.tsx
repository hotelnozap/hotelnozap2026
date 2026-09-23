import React, { useState, useEffect } from 'react';
import {
  quartosService,
  tiposQuartosService,
  RoomTypeData,
  categoriasQuartosService,
  CategoriaQuartoData,
  destaquesQuartoService,
  DestaqueQuarto,
  cleanIconClass,
  ComodidadeCategoria,
  comodidadesService,
  currentHotelService,
  hoteisService,
  resolveHotelDbId,
} from '../services/supabaseService';
import { uploadImageToStorage, uploadVideoToStorage, BUCKET_NAME } from '../services/storageService';

export interface EditingQuartoData {
  id: string;
  number: string;
  name?: string;
  category: string;
  floor: string;
  capacity?: number;
  dailyPrice?: number;
  active?: boolean;
  status?: string;
  photos?: string[];
  videoUrl?: string;
  video?: string;
  notes?: string;
  items?: Record<string, any>;
  beds?: number;
  type?: string;
  comodidades?: ComodidadeCategoria[];
}

export interface CadastroQuartoProps {
  onBack: () => void;
  onSave?: (roomData: any) => void;
  editingQuarto?: EditingQuartoData | null;
  onClearEditingQuarto?: () => void;
}

const CATEGORY_ICON_OPTIONS: { icon: string; label: string }[] = [
  { icon: 'spa', label: 'Spa & Banho' },
  { icon: 'bathtub', label: 'Banheira' },
  { icon: 'shower', label: 'Chuveiro' },
  { icon: 'soap', label: 'Amenities' },
  { icon: 'bed', label: 'Cama' },
  { icon: 'king_bed', label: 'Cama King' },
  { icon: 'single_bed', label: 'Cama Solteiro' },
  { icon: 'tv', label: 'Smart TV' },
  { icon: 'wifi', label: 'Wi-Fi' },
  { icon: 'ac_unit', label: 'Ar Condicionado' },
  { icon: 'coffee', label: 'Cafeteira' },
  { icon: 'local_bar', label: 'Frigobar' },
  { icon: 'kitchen', label: 'Cozinha' },
  { icon: 'restaurant', label: 'Restaurante' },
  { icon: 'free_breakfast', label: 'Café da Manhã' },
  { icon: 'pool', label: 'Piscina' },
  { icon: 'waves', label: 'Vista Mar' },
  { icon: 'balcony', label: 'Varanda' },
  { icon: 'park', label: 'Jardim' },
  { icon: 'fireplace', label: 'Lareira' },
  { icon: 'pets', label: 'Pet Friendly' },
  { icon: 'lock', label: 'Cofre' },
  { icon: 'iron', label: 'Ferro de Passar' },
  { icon: 'room_service', label: 'Serviço Quarto' },
  { icon: 'cleaning_services', label: 'Limpeza' },
  { icon: 'fitness_center', label: 'Academia' },
  { icon: 'local_parking', label: 'Estacionamento' },
  { icon: 'elevator', label: 'Elevador' },
  { icon: 'check_circle', label: 'Incluso' },
  { icon: 'star', label: 'Premium' },
  { icon: 'category', label: 'Geral' },
  { icon: 'verified', label: 'Garantido' },
  { icon: 'work', label: 'Mesa Trabalho' },
  { icon: 'curtains', label: 'Cortinas' },
  { icon: 'deck', label: 'Deck / Sol' },
  { icon: 'hot_tub', label: 'Ofurô / Hidro' },
];

export const CadastroQuarto: React.FC<CadastroQuartoProps> = ({ onBack, onSave, editingQuarto, onClearEditingQuarto }) => {
  const isEditMode = !!editingQuarto;
  const [openIconPickerCatIdx, setOpenIconPickerCatIdx] = useState<number | null>(null);
  const [iconSearchTerm, setIconSearchTerm] = useState('');
  const [statusAtivo, setStatusAtivo] = useState(true);
  const [fotos, setFotos] = useState<string[]>([]);
  const [nomeQuarto, setNomeQuarto] = useState('');
  const [numero, setNumero] = useState('');
  const [andar, setAndar] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipoQuarto, setTipoQuarto] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [quantidadeCamas, setQuantidadeCamas] = useState('');
  const [valorDiaria, setValorDiaria] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [tiposQuartosList, setTiposQuartosList] = useState<RoomTypeData[]>([]);
  const [categoriasQuartosList, setCategoriasQuartosList] = useState<CategoriaQuartoData[]>([]);

  useEffect(() => {
    const loadTipos = () => {
      tiposQuartosService.getTiposQuartos().then(data => {
        setTiposQuartosList(data || []);
      });
    };
    loadTipos();
    window.addEventListener('hotel_novo_tipo_quarto', loadTipos);
    return () => {
      window.removeEventListener('hotel_novo_tipo_quarto', loadTipos);
    };
  }, []);

  useEffect(() => {
    const loadCategorias = () => {
      categoriasQuartosService.getCategorias().then(data => {
        setCategoriasQuartosList(data || []);
      });
    };
    loadCategorias();
    window.addEventListener('hotel_nova_categoria_quarto', loadCategorias);
    return () => {
      window.removeEventListener('hotel_nova_categoria_quarto', loadCategorias);
    };
  }, []);

  // Sincronizar categoria quando a lista carregar, combinando maiúsculas/minúsculas
  useEffect(() => {
    if (!categoria || categoriasQuartosList.length === 0) return;
    const match = categoriasQuartosList.find(c => c.name.trim().toLowerCase() === categoria.trim().toLowerCase());
    if (match && match.name !== categoria) {
      setCategoria(match.name);
    }
  }, [categoriasQuartosList, categoria]);

  // Sincronizar tipo de quarto quando a lista carregar, combinando maiúsculas/minúsculas
  useEffect(() => {
    if (!tipoQuarto || tiposQuartosList.length === 0) return;
    const match = tiposQuartosList.find(t => t.name.trim().toLowerCase() === tipoQuarto.trim().toLowerCase());
    if (match && match.name !== tipoQuarto) {
      setTipoQuarto(match.name);
    }
  }, [tiposQuartosList, tipoQuarto]);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const MAX_FOTOS = 5;
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');

  // VÍDEO DO QUARTO (Bucket 'hotelnozap/quartos/videos')
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgressText, setVideoUploadProgressText] = useState('');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showVideoUrlInput, setShowVideoUrlInput] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const [isVideoPreviewModalOpen, setIsVideoPreviewModalOpen] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // DESTAQUES DA ACOMODAÇÃO
  const [destaquesList, setDestaquesList] = useState<DestaqueQuarto[]>([]);
  const [quartoDestaquesIds, setQuartoDestaquesIds] = useState<string[]>([]);
  const [isNovoDestaqueModalOpen, setIsNovoDestaqueModalOpen] = useState(false);
  const [destaqueFormIcon, setDestaqueFormIcon] = useState('bed');
  const [destaqueFormIconColor, setDestaqueFormIconColor] = useState('#6d28d9');
  const [destaqueFormIconClass, setDestaqueFormIconClass] = useState('');
  const [destaqueFormTitle, setDestaqueFormTitle] = useState('');
  const [destaqueFormSubtitle, setDestaqueFormSubtitle] = useState('');
  const [destaqueFormOrder, setDestaqueFormOrder] = useState<number>(1);
  const [destaqueFormStatus, setDestaqueFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [isDestaqueIconPickerOpen, setIsDestaqueIconPickerOpen] = useState(false);
  const [destaqueIconSearch, setDestaqueIconSearch] = useState('');
  const [isSavingDestaque, setIsSavingDestaque] = useState(false);
  const [destaqueToast, setDestaqueToast] = useState<string | null>(null);

  const handleOpenNovoDestaqueModal = () => {
    setDestaqueFormIcon('bed');
    setDestaqueFormIconColor('#6d28d9');
    setDestaqueFormIconClass('');
    setDestaqueFormTitle('');
    setDestaqueFormSubtitle('');
    setDestaqueFormOrder(destaquesList.length + 1);
    setDestaqueFormStatus('ativo');
    setIsDestaqueIconPickerOpen(false);
    setDestaqueIconSearch('');
    setIsNovoDestaqueModalOpen(true);
  };

  const handleSaveNovoDestaque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destaqueFormTitle.trim()) {
      alert('Por favor, informe o título do destaque.');
      return;
    }
    setIsSavingDestaque(true);
    try {
      const cleanClass = cleanIconClass(destaqueFormIconClass);
      const success = await destaquesQuartoService.createDestaque({
        icon: destaqueFormIcon,
        iconColor: destaqueFormIconColor,
        iconClass: cleanClass,
        title: destaqueFormTitle.trim(),
        subtitle: destaqueFormSubtitle.trim(),
        order: Number(destaqueFormOrder) || destaquesList.length + 1,
        status: destaqueFormStatus,
      });

      if (success) {
        const updated = await destaquesQuartoService.getDestaques();
        setDestaquesList(updated || []);

        const newlyCreated = updated?.find(d => d.title.trim().toLowerCase() === destaqueFormTitle.trim().toLowerCase())
          || updated?.[updated.length - 1];
        if (newlyCreated) {
          setQuartoDestaquesIds(prev => prev.includes(newlyCreated.id) ? prev : [...prev, newlyCreated.id]);
        }

        setIsNovoDestaqueModalOpen(false);
        setDestaqueToast(`Destaque "${destaqueFormTitle.trim()}" criado e vinculado ao quarto!`);
        setTimeout(() => setDestaqueToast(null), 3500);
      } else {
        alert('Não foi possível cadastrar o destaque.');
      }
    } catch (err) {
      console.error('Erro ao cadastrar destaque do quarto:', err);
      alert('Ocorreu um erro ao salvar o destaque.');
    } finally {
      setIsSavingDestaque(false);
    }
  };

  useEffect(() => {
    const loadDestaques = async () => {
      const data = await destaquesQuartoService.getDestaques();
      setDestaquesList(data || []);
    };
    loadDestaques();
    const handleNewDestaque = () => loadDestaques();
    const handleUpdatedDestaque = () => loadDestaques();
    window.addEventListener('hotel_novo_destaque_quarto', handleNewDestaque);
    window.addEventListener('hotel_quarto_destaques_atualizado', handleUpdatedDestaque);
    return () => {
      window.removeEventListener('hotel_novo_destaque_quarto', handleNewDestaque);
      window.removeEventListener('hotel_quarto_destaques_atualizado', handleUpdatedDestaque);
    };
  }, []);

  // COMODIDADES & CONFORTO INCLUSOS (NÍVEL QUARTO)
  const [comodidadesCategorias, setComodidadesCategorias] = useState<ComodidadeCategoria[]>(() => {
    if (editingQuarto?.comodidades && Array.isArray(editingQuarto.comodidades) && editingQuarto.comodidades.length > 0) {
      return editingQuarto.comodidades;
    }
    if (editingQuarto?.items?.comodidades && Array.isArray(editingQuarto.items.comodidades) && editingQuarto.items.comodidades.length > 0) {
      return editingQuarto.items.comodidades;
    }
    return comodidadesService.getSeedPadrao();
  });

  const handleAddCategoria = () => {
    setComodidadesCategorias(prev => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        nome: '',
        icon: 'category',
        iconClass: '',
        iconColor: '#006c49',
        order: prev.length + 1,
        status: 'ativo',
        itens: [{ texto: '', order: 1 }],
      },
    ]);
  };
  const handleRemoveCategoria = (idx: number) => {
    setComodidadesCategorias(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order: i + 1 })));
  };
  const handleChangeCategoria = (idx: number, field: keyof ComodidadeCategoria, value: any) => {
    setComodidadesCategorias(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };
  const handleAddItem = (catIdx: number) => {
    setComodidadesCategorias(prev => prev.map((c, i) => i === catIdx
      ? { ...c, itens: [...c.itens, { texto: '', order: c.itens.length + 1 }] }
      : c));
  };
  const handleRemoveItem = (catIdx: number, itemIdx: number) => {
    setComodidadesCategorias(prev => prev.map((c, i) => i === catIdx
      ? { ...c, itens: c.itens.filter((_, k) => k !== itemIdx).map((it, z) => ({ ...it, order: z + 1 })) }
      : c));
  };
  const handleChangeItem = (catIdx: number, itemIdx: number, texto: string) => {
    setComodidadesCategorias(prev => prev.map((c, i) => i === catIdx
      ? { ...c, itens: c.itens.map((it, k) => k === itemIdx ? { ...it, texto } : it) }
      : c));
  };

  useEffect(() => {
    if (!editingQuarto) return;
    setStatusAtivo(editingQuarto.active !== undefined ? editingQuarto.active : true);
    setFotos(editingQuarto.photos || []);
    setNomeQuarto(editingQuarto.name || '');
    setNumero(editingQuarto.number || '');
    setAndar(editingQuarto.floor || '');
    const rawCat = editingQuarto.category || (editingQuarto as any).categoria || editingQuarto.items?.categoria || editingQuarto.items?.category || '';
    const rawTipo = editingQuarto.type || (editingQuarto as any).tipo || (editingQuarto as any).tipoQuarto || editingQuarto.items?.tipoQuarto || editingQuarto.items?.type || '';

    const matchedCat = categoriasQuartosList.find(c => c.name.trim().toLowerCase() === rawCat.trim().toLowerCase());
    setCategoria(matchedCat ? matchedCat.name : rawCat);

    const matchedTipo = tiposQuartosList.find(t => t.name.trim().toLowerCase() === rawTipo.trim().toLowerCase());
    setTipoQuarto(matchedTipo ? matchedTipo.name : rawTipo);
    setCapacidade(String(editingQuarto.capacity || ''));
    setQuantidadeCamas(String(editingQuarto.beds || ''));
    setValorDiaria(String(editingQuarto.dailyPrice || ''));
    setObservacoes(editingQuarto.notes || '');
    if (editingQuarto.comodidades && Array.isArray(editingQuarto.comodidades) && editingQuarto.comodidades.length > 0) {
      setComodidadesCategorias(editingQuarto.comodidades);
    } else if (editingQuarto.items?.comodidades && Array.isArray(editingQuarto.items.comodidades) && editingQuarto.items.comodidades.length > 0) {
      setComodidadesCategorias(editingQuarto.items.comodidades);
    } else {
      setComodidadesCategorias(comodidadesService.getSeedPadrao());
    }
    const rawVideo = editingQuarto.videoUrl || (editingQuarto as any).video || (editingQuarto as any).video_url || editingQuarto.items?.videoUrl || editingQuarto.items?.video || '';
    setVideoUrl(rawVideo);

    const loadEditingDestaques = async () => {
      try {
        const ds = await destaquesQuartoService.getDestaquesDoQuarto(editingQuarto.id);
        setQuartoDestaquesIds(ds.map(d => d.id));
      } catch (_) {
        setQuartoDestaquesIds([]);
      }
    };
    loadEditingDestaques();
  }, [editingQuarto]);

  const handleToggleDestaqueSelection = (destaqueId: string) => {
    setQuartoDestaquesIds((prev) =>
      prev.includes(destaqueId)
        ? prev.filter((id) => id !== destaqueId)
        : [...prev, destaqueId]
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const remainingSlots = MAX_FOTOS - fotos.length;

      if (remainingSlots <= 0) {
        setPhotoError('Limite máximo de 5 fotos atingido.');
        if (e.target) e.target.value = '';
        return;
      }

      if (selectedFiles.length > remainingSlots) {
        setPhotoError(`Limite de 5 fotos: apenas as primeiras ${remainingSlots} foto(s) foram adicionadas.`);
      } else {
        setPhotoError(null);
      }

      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      setUploadingPhotos(true);
      
      const newUrls: string[] = [];
      let hadStorageError = false;

      for (let i = 0; i < filesToAdd.length; i++) {
        const file = filesToAdd[i];
        setUploadProgressText(`Enviando foto ${i + 1} de ${filesToAdd.length} para o bucket '${BUCKET_NAME}'...`);
        try {
          const uploadedUrl = await uploadImageToStorage(file, 'quartos');
          if (uploadedUrl) {
            newUrls.push(uploadedUrl);
          } else {
            hadStorageError = true;
            const b64 = await fileToBase64(file);
            newUrls.push(b64);
          }
        } catch (err) {
          console.warn('Erro ao processar imagem:', err);
          hadStorageError = true;
          const b64 = await fileToBase64(file);
          newUrls.push(b64);
        }
      }

      setFotos(prev => [...prev, ...newUrls]);
      setUploadingPhotos(false);
      setUploadProgressText('');

      if (hadStorageError) {
        setPhotoError(`Aviso: O upload direto no bucket '${BUCKET_NAME}' falhou no Supabase (verifique as Políticas de INSERT/SELECT do bucket). A imagem foi salva no formato inline para não quebrar.`);
      }

      if (e.target) e.target.value = '';
    }
  };

  const handleAddPhotoByUrl = () => {
    if (!customPhotoUrl.trim()) return;
    if (fotos.length >= MAX_FOTOS) {
      setPhotoError('Limite máximo de 5 fotos atingido.');
      return;
    }
    setFotos(prev => [...prev, customPhotoUrl.trim()]);
    setCustomPhotoUrl('');
    setShowUrlInput(false);
    setPhotoError(null);
  };

  const handleOpenLocalFilePicker = () => {
    if (fotos.length >= MAX_FOTOS) {
      setPhotoError('Limite máximo de 5 fotos atingido. Remova uma foto para adicionar outra.');
      return;
    }
    setPhotoError(null);
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = (index: number) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
    setPhotoError(null);
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setVideoError(null);
      setUploadingVideo(true);
      setVideoUploadProgressText(`Enviando vídeo "${file.name}" para o Supabase (bucket ${BUCKET_NAME}/quartos/videos)...`);
      try {
        const uploadedUrl = await uploadVideoToStorage(file, 'quartos/videos');
        if (uploadedUrl) {
          setVideoUrl(uploadedUrl);
        } else {
          setVideoError(`Erro ao enviar vídeo para o bucket '${BUCKET_NAME}'. Verifique a conexão ou tente novamente.`);
        }
      } catch (err: any) {
        console.error('Erro no upload do vídeo:', err);
        setVideoError(`Erro no upload do vídeo: ${err?.message || 'Falha ao processar arquivo'}`);
      } finally {
        setUploadingVideo(false);
        setVideoUploadProgressText('');
        if (e.target) e.target.value = '';
      }
    }
  };

  const handleAddVideoByUrl = () => {
    if (!customVideoUrl.trim()) return;
    setVideoUrl(customVideoUrl.trim());
    setCustomVideoUrl('');
    setShowVideoUrlInput(false);
    setVideoError(null);
  };

  const handleRemoveVideo = () => {
    setVideoUrl('');
    setVideoError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultNumber = isEditMode ? editingQuarto!.number : '401';
    const roomData = {
      id: isEditMode ? editingQuarto!.id : Date.now().toString(),
      number: numero || defaultNumber,
      name: nomeQuarto || `Quarto ${numero || defaultNumber}`,
      category: categoria || 'Standard',
      floor: andar || '1º Andar',
      type: tipoQuarto || 'Casal',
      capacity: Number(capacidade) || 2,
      beds: Number(quantidadeCamas) || 1,
      dailyPrice: Number(valorDiaria) || 180,
      active: statusAtivo,
      videoUrl: videoUrl,
      video: videoUrl,
      items: {
        categoria: categoria || 'Standard',
        category: categoria || 'Standard',
        tipoQuarto: tipoQuarto || 'Casal',
        type: tipoQuarto || 'Casal',
        comodidades: comodidadesCategorias,
        videoUrl: videoUrl,
        video: videoUrl,
      },
      comodidades: comodidadesCategorias,
      notes: observacoes,
      observacoes: observacoes,
      photos: fotos,
      status: isEditMode ? (editingQuarto!.status || 'livre') : 'livre',
    };

    const quartoFinalId = roomData.id;

    try {
      if (isEditMode) {
        const ok = await quartosService.updateQuarto(quartoFinalId, {
          number: roomData.number,
          name: roomData.name,
          category: roomData.category,
          floor: roomData.floor,
          capacity: roomData.capacity,
          dailyPrice: roomData.dailyPrice,
          notes: roomData.notes,
          photos: roomData.photos,
          fotoCapa: roomData.photos?.[0] || '',
          active: roomData.active,
          beds: roomData.beds,
          type: roomData.type,
          items: roomData.items,
          comodidades: comodidadesCategorias,
          videoUrl: roomData.videoUrl,
          video: roomData.video,
        });
        if (!ok) {
          console.warn('updateQuarto retornou false');
        }
      } else {
        const ok = await quartosService.createQuarto({
          number: roomData.number,
          name: roomData.name,
          category: roomData.category,
          floor: roomData.floor,
          capacity: roomData.capacity,
          dailyPrice: roomData.dailyPrice,
          status: 'livre',
          notes: roomData.notes,
          photos: roomData.photos,
          fotoCapa: roomData.photos?.[0] || '',
          active: roomData.active,
          beds: roomData.beds,
          type: roomData.type,
          items: roomData.items,
          comodidades: comodidadesCategorias,
          videoUrl: roomData.videoUrl,
          video: roomData.video,
        });
        if (!ok) {
          console.warn('createQuarto retornou false; usando ID local para vínculo de destaques');
        }
      }
    } catch (err) {
      console.warn(isEditMode ? 'Erro ao atualizar quarto no Supabase:' : 'Erro ao criar quarto no Supabase:', err);
    }

    // Se o quarto possui foto real e o hotel atual ainda está com imagem Unsplash/vazia, atualiza a capa do hotel no banco
    const firstRealPhoto = roomData.photos?.find((p: string) => p && !p.startsWith('blob:') && !p.includes('unsplash.com'));
    if (firstRealPhoto) {
      try {
        const curHotel = currentHotelService.getCurrentHotel();
        if (curHotel?.id) {
          const dbHotels = await hoteisService.getHoteis();
          const thisHotel = dbHotels.find(h => h.id === curHotel.id || h.id === resolveHotelDbId(curHotel.id));
          if (thisHotel && (!thisHotel.imageUrl || thisHotel.imageUrl.includes('unsplash.com'))) {
            await hoteisService.updateHotel(thisHotel.id, { imageUrl: firstRealPhoto });
          }
        }
      } catch { /* ignore */ }
    }

    if (quartoDestaquesIds.length > 0) {
      try {
        await destaquesQuartoService.setDestaquesDoQuarto(quartoFinalId, quartoDestaquesIds);
      } catch (err) {
        console.warn('Erro ao vincular destaques ao quarto:', err);
      }
    }

    if (onSave) {
      onSave({ ...roomData, id: quartoFinalId, destaquesIds: quartoDestaquesIds });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(isEditMode ? 'hotel_quarto_modificado' : 'hotel_novo_quarto'));
    }

    setSavedSuccess(true);
    setTimeout(() => {
      onBack();
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 font-['Inter']">
      
      {/* CARD MAIN CONTAINER */}
      <div className="w-full max-w-4xl mx-auto bg-white rounded-xl border border-[#c6c6cd]/60 shadow-sm flex flex-col overflow-hidden">
        
        {/* HEADER SECTION WITHIN CARD */}
        <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-[#c6c6cd]/40 flex flex-col gap-4 bg-[#f8f9ff]">
          <button 
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#006c49] hover:text-[#00714d] transition-colors w-max cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span>Voltar para o Mapa dos Quartos</span>
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0b1c30] tracking-tight">
                {isEditMode ? `Editar Quarto ${editingQuarto?.number || ''}` : 'Cadastro de Novo Quarto'}
              </h1>
              <p className="text-xs sm:text-sm text-[#45464d] mt-1">
                {isEditMode
                  ? 'Atualize as informações do quarto e clique em Salvar Alterações.'
                  : 'Preencha os dados abaixo para registrar uma nova acomodação.'}
              </p>
            </div>
            
            {/* STATUS SWITCH */}
            <label className="flex items-center cursor-pointer gap-3 bg-[#eff4ff] px-4 py-2 rounded-lg border border-[#c6c6cd]/50 self-start sm:self-auto shrink-0">
              <span className="text-xs sm:text-sm font-semibold text-[#0b1c30]">Status Ativo</span>
              <div className="relative">
                <input 
                  type="checkbox"
                  checked={statusAtivo}
                  onChange={(e) => setStatusAtivo(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-[#565e74] rounded-full peer peer-checked:bg-[#006c49] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
              </div>
            </label>
          </div>
        </div>

        {/* SUCCESS NOTIFICATION */}
        {savedSuccess && (
          <div className="m-6 p-4 bg-[#d1fae5] border border-emerald-300 rounded-xl text-black font-bold text-sm flex items-center gap-2.5 animate-in fade-in">
            <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
            <span className="text-black font-bold">
              {isEditMode ? 'Quarto atualizado com sucesso! Redirecionando...' : 'Quarto cadastrado com sucesso! Redirecionando...'}
            </span>
          </div>
        )}

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-8 flex flex-col gap-6 sm:gap-8 bg-white">
          
          {/* MEDIA UPLOAD AREA (PHOTOS & VIDEO) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30]">
                  Galeria de Mídias (Fotos e Vídeo da Acomodação)
                </label>
                <p className="text-[11px] text-[#45464d]">
                  Adicione fotos e até 1 vídeo tour da acomodação. Arquivos são organizados automaticamente no bucket Supabase (<code className="font-mono text-[#006c49]">hotelnozap/quartos/videos</code>).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  videoUrl
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  Vídeo: {videoUrl ? '1/1' : '0/1'}
                </span>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  fotos.length >= MAX_FOTOS 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-[#eff4ff] text-[#006c49] border border-[#c6c6cd]/50'
                }`}>
                  Fotos: {fotos.length} / {MAX_FOTOS}
                </span>
              </div>
            </div>

            {/* Barra de Progresso do Upload de Fotos */}
            {uploadingPhotos && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 border-2 border-[#006c49] border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold">{uploadProgressText || `Salvando fotos no bucket '${BUCKET_NAME}' do Supabase...`}</span>
              </div>
            )}

            {/* Barra de Progresso do Upload de Vídeo */}
            {uploadingVideo && (
              <div className="mb-3 p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-bold">{videoUploadProgressText || `Salvando vídeo no bucket '${BUCKET_NAME}' (quartos/videos)...`}</span>
              </div>
            )}

            {photoError && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-base text-amber-600">warning</span>
                <span>{photoError}</span>
              </div>
            )}

            {videoError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg text-xs flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-base text-rose-600">error</span>
                <span>{videoError}</span>
              </div>
            )}
            
            {/* Hidden Native File Inputs */}
            <input 
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              disabled={uploadingPhotos}
              onChange={handleFileSelect}
              className="hidden"
            />
            <input 
              type="file"
              ref={videoInputRef}
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              disabled={uploadingVideo}
              onChange={handleVideoSelect}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-4">
              
              {/* SLOT VÍDEO DO QUARTO */}
              {videoUrl ? (
                <div className="w-36 h-28 sm:w-40 sm:h-32 rounded-xl border-2 border-purple-400 bg-slate-900 overflow-hidden relative group shadow-sm shrink-0">
                  <video
                    src={videoUrl}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-95 transition-opacity"
                    muted
                    preload="metadata"
                  />
                  <button
                    type="button"
                    onClick={() => setIsVideoPreviewModalOpen(true)}
                    className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-purple-600/90 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 cursor-pointer"
                    title="Assistir prévia do vídeo"
                  >
                    <span className="material-symbols-outlined text-2xl">play_arrow</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleRemoveVideo}
                    disabled={uploadingVideo}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer hover:bg-white z-10"
                    title="Remover vídeo"
                  >
                    <span className="material-symbols-outlined text-base text-[#ba1a1a]">delete</span>
                  </button>
                  <span className="absolute bottom-1 left-1 bg-purple-950/90 border border-purple-400/40 text-purple-200 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 pointer-events-none">
                    <span className="material-symbols-outlined text-[11px]">videocam</span>
                    Vídeo Tour
                  </span>
                </div>
              ) : (
                <>
                  <div 
                    onClick={uploadingVideo ? undefined : () => videoInputRef.current?.click()}
                    className={`w-28 h-28 sm:w-32 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-xl bg-purple-50/40 hover:bg-purple-50/80 cursor-pointer transition-colors group ${
                      uploadingVideo ? 'opacity-50 cursor-wait' : ''
                    }`}
                    title="Fazer upload de 1 vídeo do quarto para o bucket Supabase"
                  >
                    <span className="material-symbols-outlined text-purple-600 group-hover:scale-110 transition-transform mb-1 text-2xl">
                      {uploadingVideo ? 'hourglass_top' : 'video_call'}
                    </span>
                    <span className="text-xs text-purple-900 text-center font-bold px-2">
                      {uploadingVideo ? 'Enviando...' : '+ Vídeo Quarto'}
                    </span>
                    <span className="text-[9px] text-purple-700 font-bold mt-0.5">Bucket Supabase</span>
                  </div>

                  {!showVideoUrlInput && (
                    <button
                      type="button"
                      onClick={() => setShowVideoUrlInput(true)}
                      disabled={uploadingVideo}
                      className="w-28 h-28 sm:w-32 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-xl bg-purple-50/20 hover:bg-purple-50/60 cursor-pointer transition-colors"
                      title="Inserir link direto de vídeo"
                    >
                      <span className="material-symbols-outlined text-purple-600 text-2xl mb-1">link</span>
                      <span className="text-xs text-purple-800 font-semibold text-center px-2">Link Vídeo URL</span>
                    </button>
                  )}
                </>
              )}

              {/* Input para Colar URL Direta de Vídeo */}
              {showVideoUrlInput && !videoUrl && (
                <div className="w-full max-w-sm p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex flex-col gap-2">
                  <span className="text-xs font-bold text-purple-900">Link direto do vídeo (MP4 ou URL):</span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/tour-quarto.mp4"
                      value={customVideoUrl}
                      onChange={(e) => setCustomVideoUrl(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-xs focus:outline-none focus:border-purple-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddVideoByUrl}
                      className="px-3 py-1.5 bg-purple-700 text-white text-xs font-bold rounded-lg hover:bg-purple-800"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVideoUrlInput(false)}
                      className="px-2 text-purple-700 text-xs hover:text-purple-900"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Box de Foto (Arquivo do computador) */}
              {fotos.length < MAX_FOTOS ? (
                <div 
                  onClick={uploadingPhotos ? undefined : handleOpenLocalFilePicker}
                  className={`w-28 h-28 sm:w-32 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-[#c6c6cd] rounded-xl bg-[#f8f9ff] hover:bg-[#eff4ff] cursor-pointer transition-colors group ${
                    uploadingPhotos ? 'opacity-50 cursor-wait' : ''
                  }`}
                >
                  <span className="material-symbols-outlined text-[#76777d] group-hover:text-[#006c49] transition-colors mb-1 text-2xl">
                    {uploadingPhotos ? 'hourglass_top' : 'add_a_photo'}
                  </span>
                  <span className="text-xs text-[#45464d] text-center font-medium px-2">
                    {uploadingPhotos ? 'Enviando...' : 'Adicionar Foto'}
                  </span>
                  <span className="text-[9px] text-[#006c49] font-bold mt-0.5">Bucket Supabase</span>
                </div>
              ) : (
                <div 
                  className="w-28 h-28 sm:w-32 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 opacity-60 cursor-not-allowed"
                  title="Limite máximo de 5 fotos atingido"
                >
                  <span className="material-symbols-outlined text-gray-400 mb-1 text-2xl">check_circle</span>
                  <span className="text-[11px] text-gray-500 text-center font-semibold px-2">Limite 5 fotos</span>
                </div>
              )}

              {/* Botão para Inserir por Link URL de Foto */}
              {fotos.length < MAX_FOTOS && !showUrlInput && (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(true)}
                  disabled={uploadingPhotos}
                  className="w-28 h-28 sm:w-32 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed border-[#006c49]/40 hover:border-[#006c49] rounded-xl bg-emerald-50/40 hover:bg-emerald-50/80 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[#006c49] text-2xl mb-1">link</span>
                  <span className="text-xs text-[#006c49] font-semibold text-center px-2">Colar Link Foto</span>
                </button>
              )}

              {/* Input para Colar URL Direta de Foto */}
              {showUrlInput && (
                <div className="w-full max-w-sm p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-700">Link direto da imagem:</span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/foto.jpg"
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#006c49]"
                    />
                    <button
                      type="button"
                      onClick={handleAddPhotoByUrl}
                      className="px-3 py-1.5 bg-[#003400] text-white text-xs font-bold rounded-lg hover:bg-[#002500]"
                    >
                      Adicionar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      className="px-2 text-slate-500 text-xs hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Gallery Previews */}
              {fotos.map((url, idx) => (
                <div key={idx} className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl border border-[#c6c6cd]/50 overflow-hidden relative group bg-slate-100">
                  <img
                    src={url}
                    alt={`Foto Quarto ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&auto=format&fit=crop&q=80';
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    disabled={uploadingPhotos}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-xs cursor-pointer hover:bg-white"
                  >
                    <span className="material-symbols-outlined text-base text-[#ba1a1a]">delete</span>
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {idx === 0 ? 'Capa' : `Foto ${idx + 1}`}
                  </span>
                </div>
              ))}

            </div>
          </div>

          {/* GRID FIELDS (2 COLS DESKTOP, 1 COL MOBILE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 sm:gap-y-5">
            
            {/* Nome & Numero */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Nome do Quarto</label>
              <input 
                type="text"
                placeholder="Ex: Suíte Presidencial"
                value={nomeQuarto}
                onChange={(e) => setNomeQuarto(e.target.value)}
                className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Número *</label>
              <input 
                type="text"
                required
                placeholder="Ex: 401"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50"
              />
            </div>

            {/* Andar & Categoria */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Andar *</label>
              <input 
                type="text"
                required
                placeholder="Ex: 1º Andar"
                value={andar}
                onChange={(e) => setAndar(e.target.value)}
                className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Categoria *</label>
              <div className="relative">
                <select 
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full h-10 px-3 appearance-none bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                >
                  <option value="">Selecione a categoria</option>
                  {/* Se a categoria atual não coincide exatamente com nenhuma opção carregada, injeta para não ficar em branco */}
                  {categoria && !categoriasQuartosList.some(c => c.name.trim().toLowerCase() === categoria.trim().toLowerCase()) && (
                    <option value={categoria}>{categoria}</option>
                  )}
                  {categoriasQuartosList
                    .filter(c => c.status === 'ativo')
                    .sort((a, b) => a.ordenacao - b.ordenacao)
                    .map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))
                  }
                  {categoriasQuartosList.length === 0 && (
                    <>
                      <option value="Standard">Standard</option>
                      <option value="Luxo">Luxo</option>
                      <option value="Suíte">Suíte</option>
                      <option value="Premium">Premium</option>
                    </>
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#45464d]">expand_more</span>
              </div>
            </div>

            {/* Tipo & Capacidade */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Tipo de Quarto</label>
              <div className="relative">
                <select 
                  value={tipoQuarto}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    setTipoQuarto(selectedVal);
                    const matched = tiposQuartosList.find(t => t.name.trim().toLowerCase() === selectedVal.trim().toLowerCase());
                    if (matched && matched.capacity) {
                      setCapacidade(String(matched.capacity));
                    }
                  }}
                  className="w-full h-10 px-3 appearance-none bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49]"
                >
                  <option value="">Selecione o tipo</option>
                  {/* Se o tipo atual não coincide exatamente com nenhuma opção carregada, injeta para não ficar em branco */}
                  {tipoQuarto && !tiposQuartosList.some(t => t.name.trim().toLowerCase() === tipoQuarto.trim().toLowerCase()) && (
                    <option value={tipoQuarto}>{tipoQuarto}</option>
                  )}
                  {tiposQuartosList.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                  {tiposQuartosList.length === 0 && (
                    <>
                      <option value="Casal">Casal</option>
                      <option value="Solteiro">Solteiro</option>
                      <option value="Duplo">Duplo</option>
                      <option value="Triplo">Triplo</option>
                      <option value="Família">Família</option>
                    </>
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#45464d]">expand_more</span>
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Capacidade (Pessoas)</label>
              <input 
                type="number"
                placeholder="Ex: 2"
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
                className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50"
              />
            </div>

            {/* Camas & Valor */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Quantidade de Camas</label>
              <input 
                type="number"
                placeholder="Ex: 1"
                value={quantidadeCamas}
                onChange={(e) => setQuantidadeCamas(e.target.value)}
                className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Valor da Diária (R$)</label>
              <input 
                type="text"
                placeholder="0,00"
                value={valorDiaria}
                onChange={(e) => setValorDiaria(e.target.value)}
                className="w-full h-10 px-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50"
              />
            </div>

          </div>



          {/* DESTAQUES DA ACOMODAÇÃO */}
          <div className="bg-[#f8f9ff] p-4 sm:p-5 rounded-xl border border-[#c6c6cd]/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#0b1c30] uppercase tracking-wide">
                  Destaques da Acomodação
                </label>
                <span className="text-[10px] sm:text-xs text-[#45464d] font-normal normal-case block mt-0.5">
                  Itens que aparecem no topo da página de detalhes do quarto para os hóspedes.
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenNovoDestaqueModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-xs font-bold shadow-xs shrink-0 cursor-pointer transition-all active:scale-95 self-start sm:self-auto"
                title="Cadastrar novo destaque agora sem sair da tela"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Novo Destaque</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 max-h-64 overflow-y-auto pr-1">
              {destaquesList.filter(d => d.status === 'ativo').length === 0 && (
                <div className="col-span-full text-center text-xs text-[#45464d] py-4 italic bg-white rounded-lg border border-dashed border-slate-300">
                  Nenhum destaque cadastrado. Acesse o Mapa de Quartos → "Gerenciar Destaques" para criar.
                </div>
              )}
              {destaquesList
                .filter(d => d.status === 'ativo')
                .sort((a, b) => a.order - b.order)
                .map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 cursor-pointer group bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 hover:border-orange-300 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={quartoDestaquesIds.includes(d.id)}
                      onChange={() => handleToggleDestaqueSelection(d.id)}
                      className="w-4 h-4 text-[#ea580c] bg-white border-[#c6c6cd] rounded focus:ring-[#ea580c] shrink-0"
                    />
                    {cleanIconClass(d.iconClass) ? (
                      <i
                        className={cleanIconClass(d.iconClass)}
                        style={{ color: d.iconColor || '#6d28d9', fontSize: '1.25rem', lineHeight: 1 }}
                      />
                    ) : (
                      <span
                        className="material-symbols-outlined text-xl shrink-0"
                        style={{ color: d.iconColor || '#6d28d9' }}
                      >
                        {d.icon}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#0b1c30] truncate group-hover:text-[#ea580c]">
                        {d.title}
                      </p>
                      <p className="text-[10px] sm:text-xs text-[#45464d] truncate leading-tight">
                        {d.subtitle}
                      </p>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          {/* COMODIDADES & CONFORTO INCLUSOS (NÍVEL QUARTO) */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">list_alt</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Comodidades & Conforto Inclusos</h2>
                  <p className="text-xs text-slate-500">Cadastre as categorias e itens inclusos neste quarto — aparecem na página de detalhes do quarto para os hóspedes.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddCategoria}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003400] hover:bg-[#002500] text-white text-xs font-bold shadow-xs shrink-0 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Nova Categoria</span>
                </button>
              </div>
            </div>

            {comodidadesCategorias.length === 0 && (
              <div className="p-6 border border-dashed border-slate-300 rounded-2xl bg-slate-50/50 text-center">
                <p className="text-xs text-slate-500 mb-2">Nenhuma categoria de comodidade cadastrada neste quarto.</p>
                <button
                  type="button"
                  onClick={handleAddCategoria}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003400] text-white text-xs font-bold hover:bg-[#002500] cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Cadastrar Categoria</span>
                </button>
              </div>
            )}

            <div className="space-y-4">
              {comodidadesCategorias.map((cat, catIdx) => (
                <div key={`cat-${catIdx}-${cat.id || cat.nome}`} className="border border-slate-200 rounded-2xl p-4 md:p-5 bg-slate-50/40 space-y-4">
                  
                  {/* Cabeçalho da Categoria */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-12 sm:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ordem</label>
                      <input
                        type="number"
                        min={1}
                        value={cat.order}
                        onChange={(e) => handleChangeCategoria(catIdx, 'order', Number(e.target.value) || 1)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-slate-800 bg-white font-bold text-center"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nome da Categoria</label>
                      <input
                        type="text"
                        value={cat.nome}
                        onChange={(e) => handleChangeCategoria(catIdx, 'nome', e.target.value)}
                        placeholder="Ex: Banho & Bem-Estar Privativo"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>

                    {/* Seletor Visual de Ícone Material (conforme Destaques) */}
                    <div className="col-span-12 sm:col-span-4 space-y-1 relative">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Ícone da Categoria *</span>
                        <span className="text-[9px] font-normal text-slate-400 lowercase">clique para escolher</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenIconPickerCatIdx(openIconPickerCatIdx === catIdx ? null : catIdx);
                          setIconSearchTerm('');
                        }}
                        className="w-full h-10 px-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2 hover:border-[#003400] transition-colors cursor-pointer text-left shadow-2xs"
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border border-slate-100 shadow-2xs"
                          style={{ backgroundColor: `${cat.iconColor || '#006c49'}18` }}
                        >
                          {cleanIconClass(cat.iconClass) ? (
                            <i
                              className={cleanIconClass(cat.iconClass)}
                              style={{ color: cat.iconColor || '#006c49', fontSize: '1.1rem' }}
                            />
                          ) : (
                            <span
                              className="material-symbols-outlined text-lg shrink-0"
                              style={{ color: cat.iconColor || '#006c49' }}
                            >
                              {cat.icon || 'category'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-800 flex-1 truncate font-medium">
                          {cat.icon || 'category'}
                        </span>
                        <span className="material-symbols-outlined text-slate-400 text-base">
                          {openIconPickerCatIdx === catIdx ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {/* Dropdown Popover do Seletor de Ícones */}
                      {openIconPickerCatIdx === catIdx && (
                        <div className="absolute left-0 top-full mt-1.5 z-40 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 animate-in fade-in">
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-800">Escolha o Ícone</span>
                            <button
                              type="button"
                              onClick={() => setOpenIconPickerCatIdx(null)}
                              className="w-6 h-6 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </div>

                          {/* Busca Rápida de Ícones */}
                          <div className="mb-2">
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                search
                              </span>
                              <input
                                type="text"
                                value={iconSearchTerm}
                                onChange={(e) => setIconSearchTerm(e.target.value)}
                                placeholder="Filtrar (banho, cama, wifi, tv, café)..."
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#003400]"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Grade de Ícones Selecionáveis */}
                          <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-0.5">
                            {CATEGORY_ICON_OPTIONS
                              .filter(ic => {
                                if (!iconSearchTerm.trim()) return true;
                                const q = iconSearchTerm.toLowerCase();
                                return ic.icon.toLowerCase().includes(q) || ic.label.toLowerCase().includes(q);
                              })
                              .map((ic) => (
                                <button
                                  key={ic.icon}
                                  type="button"
                                  onClick={() => {
                                    handleChangeCategoria(catIdx, 'icon', ic.icon);
                                    setOpenIconPickerCatIdx(null);
                                  }}
                                  className={`aspect-square rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                    cat.icon === ic.icon
                                      ? 'bg-emerald-100 ring-2 ring-[#003400] scale-105'
                                      : 'hover:bg-slate-100 text-slate-600'
                                  }`}
                                  title={ic.label}
                                >
                                  <span
                                    className="material-symbols-outlined text-lg"
                                    style={{ color: cat.iconColor || '#006c49' }}
                                  >
                                    {ic.icon}
                                  </span>
                                </button>
                              ))}
                          </div>

                          {/* Digitação manual livre */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 shrink-0">Outro:</span>
                            <input
                              type="text"
                              value={cat.icon}
                              onChange={(e) => handleChangeCategoria(catIdx, 'icon', e.target.value)}
                              placeholder="Nome do Material Icon"
                              className="flex-1 px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#003400]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="col-span-12 sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cor</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={cat.iconColor || '#006c49'}
                          onChange={(e) => handleChangeCategoria(catIdx, 'iconColor', e.target.value)}
                          className="w-10 h-10 rounded-lg border border-slate-200 bg-white cursor-pointer p-0.5 shrink-0"
                        />
                        <input
                          type="text"
                          value={cat.iconColor || '#006c49'}
                          onChange={(e) => handleChangeCategoria(catIdx, 'iconColor', e.target.value)}
                          className="w-full h-10 px-2 rounded-lg border border-slate-200 text-[11px] font-mono uppercase bg-white focus:outline-none focus:border-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Linha Opcional Classe CSS e Botão Remover */}
                  <div className="grid grid-cols-12 gap-3 items-end pt-1">
                    <div className="col-span-12 sm:col-span-8 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Classe CSS do Ícone <span className="text-slate-400 font-normal lowercase">(opcional: FontAwesome, RemixIcon, etc.)</span>
                        </label>
                        {cat.iconClass && (
                          <button
                            type="button"
                            onClick={() => handleChangeCategoria(catIdx, 'iconClass', '')}
                            className="text-[10px] text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            Limpar classe
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={cat.iconClass || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.includes('<') || val.includes('class=')) {
                            handleChangeCategoria(catIdx, 'iconClass', cleanIconClass(val));
                          } else {
                            handleChangeCategoria(catIdx, 'iconClass', val);
                          }
                        }}
                        onBlur={() => {
                          if (cat.iconClass) {
                            handleChangeCategoria(catIdx, 'iconClass', cleanIconClass(cat.iconClass));
                          }
                        }}
                        placeholder="Ex: fa-solid fa-spa, ri-hotel-bed-line ou cole a tag <i class='...'>"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:border-slate-800 bg-white"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveCategoria(catIdx)}
                        className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Remover Categoria
                      </button>
                    </div>
                  </div>

                  {/* Itens da Categoria */}
                  <div className="pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Itens Inclusos nesta Categoria</span>
                      <button
                        type="button"
                        onClick={() => handleAddItem(catIdx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#003400] hover:bg-[#002500] text-white text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Novo Item
                      </button>
                    </div>

                    <div className="space-y-2">
                      {cat.itens.length === 0 && (
                        <p className="text-[11px] text-slate-400 italic py-1">Nenhum item adicionado nesta categoria.</p>
                      )}
                      {cat.itens.map((item, itemIdx) => (
                        <div key={`item-${catIdx}-${itemIdx}`} className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                          </div>
                          <span className="w-6 text-center text-[10px] text-slate-400 font-mono font-bold">{itemIdx + 1}</span>
                          <input
                            type="text"
                            value={item.texto}
                            onChange={(e) => handleChangeItem(catIdx, itemIdx, e.target.value)}
                            placeholder="Ex: Banheira de hidromassagem com iluminação LED"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(catIdx, itemIdx)}
                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
                            title="Remover item"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* OBSERVATIONS TEXTAREA */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-[#0b1c30] mb-1.5">Observações</label>
            <textarea 
              rows={3}
              placeholder="Insira detalhes adicionais sobre o quarto, vista, posição solar, etc."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full p-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-lg text-sm text-[#0b1c30] focus:outline-none focus:border-[#006c49] focus:ring-1 focus:ring-[#006c49] placeholder-[#45464d]/50 resize-y"
            ></textarea>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="pt-4 border-t border-[#c6c6cd]/40 flex justify-end gap-3 sm:gap-4">
            <button 
              type="button"
              onClick={onBack}
              className="px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#45464d] bg-transparent border border-[#c6c6cd] hover:bg-[#eff4ff] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={uploadingPhotos}
              className={`px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-colors shadow-sm cursor-pointer flex items-center gap-2 ${
                uploadingPhotos ? 'bg-slate-500 cursor-not-allowed' : 'bg-[#000000] hover:bg-[#0b1c30]'
              }`}
            >
              {uploadingPhotos && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              <span>{uploadingPhotos ? 'Aguarde o envio das fotos...' : (isEditMode ? 'Salvar Alterações' : 'Cadastrar Quarto')}</span>
            </button>
          </div>

        </form>

      </div>

      {/* TOAST DE FEEDBACK DE NOVO DESTAQUE */}
      {destaqueToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#d1fae5] border border-emerald-300 text-black font-bold px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-[#003400] text-xl">check_circle</span>
          <span className="text-sm text-black font-bold">{destaqueToast}</span>
        </div>
      )}

      {/* MODAL: CADASTRAR NOVO DESTAQUE DIRETO DO QUARTO */}
      {isNovoDestaqueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header Modal */}
            <div className="bg-[#003400] text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#B9CC01]">
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    Cadastrar Novo Destaque
                  </h3>
                  <p className="text-xs text-emerald-200/80">
                    O destaque será salvo e vinculado automaticamente a este quarto.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNovoDestaqueModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveNovoDestaque} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Linha 1: Ícone, Cor e Ordem */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Seletor de Ícone Material */}
                <div className="sm:col-span-5 relative">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ícone Material *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDestaqueIconPickerOpen(!isDestaqueIconPickerOpen);
                      setDestaqueIconSearch('');
                    }}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2.5 hover:border-[#003400] transition-colors cursor-pointer"
                  >
                    <span
                      className="material-symbols-outlined text-xl shrink-0"
                      style={{ color: destaqueFormIconColor || '#6d28d9' }}
                    >
                      {destaqueFormIcon}
                    </span>
                    <span className="text-xs font-mono text-slate-800 flex-1 text-left truncate">
                      {destaqueFormIcon}
                    </span>
                    <span className="material-symbols-outlined text-base text-slate-400">
                      {isDestaqueIconPickerOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {isDestaqueIconPickerOpen && (
                    <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl p-2.5 max-h-60 overflow-y-auto animate-in fade-in">
                      <div className="mb-2">
                        <input
                          type="text"
                          value={destaqueIconSearch}
                          onChange={(e) => setDestaqueIconSearch(e.target.value)}
                          placeholder="Buscar ícone..."
                          className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#003400]"
                          autoFocus
                        />
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {CATEGORY_ICON_OPTIONS
                          .filter(ic => {
                            if (!destaqueIconSearch.trim()) return true;
                            const q = destaqueIconSearch.toLowerCase();
                            return ic.icon.toLowerCase().includes(q) || ic.label.toLowerCase().includes(q);
                          })
                          .map((ic) => (
                            <button
                              key={ic.icon}
                              type="button"
                              onClick={() => {
                                setDestaqueFormIcon(ic.icon);
                                setIsDestaqueIconPickerOpen(false);
                              }}
                              className={`aspect-square rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                destaqueFormIcon === ic.icon
                                  ? 'bg-emerald-100 ring-2 ring-[#003400] scale-105'
                                  : 'hover:bg-slate-100 text-slate-600'
                              }`}
                              title={ic.label}
                            >
                              <span
                                className="material-symbols-outlined text-lg"
                                style={{ color: destaqueFormIconColor || '#6d28d9' }}
                              >
                                {ic.icon}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Cor do Ícone */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cor do Ícone</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={destaqueFormIconColor || '#6d28d9'}
                      onChange={(e) => setDestaqueFormIconColor(e.target.value)}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white cursor-pointer p-1 shrink-0"
                    />
                    <input
                      type="text"
                      value={destaqueFormIconColor || '#6d28d9'}
                      onChange={(e) => setDestaqueFormIconColor(e.target.value)}
                      placeholder="#6d28d9"
                      className="flex-1 h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                    />
                  </div>
                </div>

                {/* Ordem */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    min="1"
                    value={destaqueFormOrder}
                    onChange={(e) => setDestaqueFormOrder(Number(e.target.value) || 1)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                  />
                </div>
              </div>

              {/* Classe CSS Opcional */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Classe CSS do Ícone <span className="text-slate-400 font-normal">(Opcional: FontAwesome, RemixIcon, etc.)</span>
                  </label>
                  {destaqueFormIconClass && (
                    <button
                      type="button"
                      onClick={() => setDestaqueFormIconClass('')}
                      className="text-[10px] text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Limpar classe
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={destaqueFormIconClass}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.includes('<') || val.includes('class=')) {
                      setDestaqueFormIconClass(cleanIconClass(val));
                    } else {
                      setDestaqueFormIconClass(val);
                    }
                  }}
                  onBlur={() => setDestaqueFormIconClass(cleanIconClass(destaqueFormIconClass))}
                  placeholder="Ex: fa-regular fa-chess-rook ou ri-hotel-bed-line"
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                />
              </div>

              {/* Título e Subtítulo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título do Destaque *</label>
                  <input
                    type="text"
                    required
                    value={destaqueFormTitle}
                    onChange={(e) => setDestaqueFormTitle(e.target.value)}
                    placeholder="Ex: Cama King Size, Ar Split"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subtítulo / Detalhe</label>
                  <input
                    type="text"
                    value={destaqueFormSubtitle}
                    onChange={(e) => setDestaqueFormSubtitle(e.target.value)}
                    placeholder="Ex: Lençóis 400 fios, Inverter silencioso"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status de Exibição</label>
                <select
                  value={destaqueFormStatus}
                  onChange={(e) => setDestaqueFormStatus(e.target.value as any)}
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]/20 cursor-pointer"
                >
                  <option value="ativo">Ativo (Exibido nas páginas dos quartos)</option>
                  <option value="inativo">Inativo (Oculto no catálogo)</option>
                </select>
              </div>

              {/* PRÉVIA DO CARD AO VIVO */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Prévia em Tempo Real (como o hóspede verá)
                </label>
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-2xs">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/60 shadow-2xs"
                    style={{ backgroundColor: `${destaqueFormIconColor || '#6d28d9'}15` }}
                  >
                    {cleanIconClass(destaqueFormIconClass) ? (
                      <i
                        className={cleanIconClass(destaqueFormIconClass)}
                        style={{ color: destaqueFormIconColor || '#6d28d9', fontSize: '1.5rem' }}
                      />
                    ) : (
                      <span
                        className="material-symbols-outlined text-3xl"
                        style={{ color: destaqueFormIconColor || '#6d28d9' }}
                      >
                        {destaqueFormIcon || 'bed'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {destaqueFormTitle || 'Título do Destaque'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {destaqueFormSubtitle || 'Subtítulo explicativo'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">
                    #{destaqueFormOrder}
                  </span>
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNovoDestaqueModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDestaque}
                  className="px-5 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002500] text-white font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {isSavingDestaque && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{isSavingDestaque ? 'Salvando...' : 'Cadastrar Destaque'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DE VÍDEO DO QUARTO */}
      {isVideoPreviewModalOpen && videoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsVideoPreviewModalOpen(false)}
        >
          <div 
            className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">videocam</span>
                <span className="font-bold text-sm">Tour em Vídeo da Acomodação</span>
              </div>
              <button
                type="button"
                onClick={() => setIsVideoPreviewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center">
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full max-h-[70vh] rounded-xl object-contain bg-black"
              >
                Seu navegador não suporta reprodução de vídeo.
              </video>
            </div>
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-md">Bucket Supabase: hotelnozap / quartos / videos</span>
              <button
                type="button"
                onClick={() => setIsVideoPreviewModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold cursor-pointer transition-colors"
              >
                Fechar Prévia
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CadastroQuarto;
