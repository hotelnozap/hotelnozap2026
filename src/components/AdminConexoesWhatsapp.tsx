import React, { useState, useEffect, useMemo } from 'react';
import { maskPhone } from '../utils/masks';
import {
  evolutionApiService,
  EvolutionApiInstance,
  QrCodeResponse,
  InstanceMetadata
} from '../services/evolutionApiService';
import { hoteisService, planosService } from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';

export interface AdminWhatsappInstance {
  id: string;
  code: string;
  name: string;
  instanceName: string;
  phone: string;
  department: string;
  status: 'conectado' | 'desconectado' | 'aguardando';
  battery: string;
  device: string;
  lastActivity: string;
  messagesSentToday: number;
  profilePicUrl?: string | null;
  token?: string;
  hotelId?: string | null;
  hotelName?: string | null;
  hotelCityUf?: string | null;
  hotelPlan?: string | null;
  evolutionData?: EvolutionApiInstance;
}

export interface AdminConexoesWhatsappProps {
  onBackToDashboard: () => void;
  onNavigateToHotel?: (hotelId: string) => void;
}

export const AdminConexoesWhatsapp: React.FC<AdminConexoesWhatsappProps> = ({
  onBackToDashboard,
  onNavigateToHotel
}) => {
  const [instances, setInstances] = useState<AdminWhatsappInstance[]>([]);
  const [hoteis, setHoteis] = useState<Hotel[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [atualizandoStatus, setAtualizandoStatus] = useState<boolean>(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [hotelFilter, setHotelFilter] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Latência e Health check
  const [serverStatus, setServerStatus] = useState<{
    online: boolean;
    latencyMs: number;
    tested: boolean;
    checking: boolean;
  }>({
    online: true,
    latencyMs: 0,
    tested: false,
    checking: false
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // Modais
  const [qrModalInstance, setQrModalInstance] = useState<AdminWhatsappInstance | null>(null);
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<QrCodeResponse | null>(null);
  const [qrConnectedSuccess, setQrConnectedSuccess] = useState<boolean>(false);
  const [tempoRestanteQr, setTempoRestanteQr] = useState<number>(45);

  const [isNovaConexaoOpen, setIsNovaConexaoOpen] = useState(false);
  const [criandoInstancia, setCriandoInstancia] = useState(false);
  const [vincularModalInstance, setVincularModalInstance] = useState<AdminWhatsappInstance | null>(null);
  const [novoVinculoHotelId, setNovoVinculoHotelId] = useState<string>('');
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);

  const [deleteConfirmInstance, setDeleteConfirmInstance] = useState<AdminWhatsappInstance | null>(null);
  const [excluindoInstancia, setExcluindoInstancia] = useState(false);

  // Form States para Nova Conexão Admin
  const [novoHotelId, setNovoHotelId] = useState<string>('');
  const [novoNome, setNovoNome] = useState('');
  const [novoDept, setNovoDept] = useState('Recepção & Check-in');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [ignorarLimitePlano, setIgnorarLimitePlano] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Carregar dados de Hotéis e Planos
  const carregarHoteisEPlanos = async () => {
    try {
      const [dbHoteis, dbPlanos] = await Promise.all([
        hoteisService.getHoteis(),
        planosService.getPlanos()
      ]);
      setHoteis(dbHoteis || []);
      setPlanos(dbPlanos || []);
    } catch (e) {
      console.warn('Erro ao carregar dados de hotéis e planos:', e);
    }
  };

  // Mapear dados da Evolution API cruzando com Metadados e Cadastro de Hotéis
  const mapEvolutionAdmin = (
    evoList: EvolutionApiInstance[],
    allMeta: Record<string, InstanceMetadata>,
    hoteisList: Hotel[]
  ): AdminWhatsappInstance[] => {
    return evoList.map((evo) => {
      const meta = allMeta[evo.name];

      // Tentar associar o hotel:
      // 1. Pelo metadado salvo (hotelId)
      // 2. Pelo prefixo do nome da instância (ex: hot001_...)
      // 3. Pelo campo instanceName do cadastro de hotéis no Supabase
      let associatedHotel: Hotel | undefined = undefined;

      if (meta?.hotelId) {
        associatedHotel = hoteisList.find((h) => h.id === meta.hotelId);
      }

      if (!associatedHotel) {
        // Tenta achar por prefixo: h_hot001_ ou hot001_
        associatedHotel = hoteisList.find((h) => {
          const cleanId = h.id.toLowerCase().replace(/[^a-z0-9]/g, '');
          const prefix1 = `h_${cleanId}_`;
          const prefix2 = `${cleanId}_`;
          return (
            evo.name.toLowerCase().startsWith(prefix1) ||
            evo.name.toLowerCase().startsWith(prefix2) ||
            (h.instanceName && h.instanceName.toLowerCase() === evo.name.toLowerCase())
          );
        });
      }

      let st: 'conectado' | 'desconectado' | 'aguardando' = 'aguardando';
      if (evo.connectionStatus === 'open') st = 'conectado';
      else if (evo.connectionStatus === 'close') st = 'desconectado';
      else st = 'aguardando';

      let displayPhone = 'Aguardando pareamento';
      if (evo.ownerJid) {
        const cleanNum = evo.ownerJid.split('@')[0];
        displayPhone = maskPhone(cleanNum);
      } else if (meta?.phone) {
        displayPhone = maskPhone(meta.phone);
      }

      const shortId = (evo.id || evo.name).replace(/\D/g, '').slice(-3) || '1';

      return {
        id: evo.id || evo.name,
        code: `WZ${shortId.padStart(2, '0')}`,
        name: meta?.displayName || evo.profileName || evo.name,
        instanceName: evo.name,
        phone: displayPhone,
        department: meta?.department || 'Recepção / Geral',
        status: st,
        battery: st === 'conectado' ? '100%' : 'Desconhecido',
        device: evo.clientName || 'WhatsApp Baileys',
        lastActivity: evo.updatedAt
          ? new Date(evo.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : 'Recente',
        messagesSentToday: evo._count?.Message || 0,
        profilePicUrl: evo.profilePicUrl,
        token: evo.token,
        hotelId: associatedHotel?.id || meta?.hotelId || null,
        hotelName: associatedHotel?.name || (meta?.hotelId ? `Hotel #${meta.hotelId}` : null),
        hotelCityUf: associatedHotel?.cityUf || null,
        hotelPlan: associatedHotel?.plan || null,
        evolutionData: evo
      };
    });
  };

  // Carregar todas as instâncias da Evolution API
  const carregarTodasInstancias = async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    else setAtualizandoStatus(true);

    try {
      const [evoList, dbHoteis] = await Promise.all([
        evolutionApiService.fetchInstances(),
        hoteis.length > 0 ? Promise.resolve(hoteis) : hoteisService.getHoteis()
      ]);

      if (hoteis.length === 0 && dbHoteis) {
        setHoteis(dbHoteis);
      }

      const allMeta = evolutionApiService.getAllLocalMetadata();
      const mapped = mapEvolutionAdmin(evoList, allMeta, dbHoteis || hoteis);
      setInstances(mapped);

      if (silencioso) {
        showToast('Instâncias e status sincronizados com a Evolution API!');
      }
    } catch (err) {
      console.error('Erro ao buscar instâncias globais da Evolution API:', err);
      showToast('Falha na comunicação com o servidor Evolution API.');
    } finally {
      setCarregando(false);
      setAtualizandoStatus(false);
    }
  };

  // Testar ping no servidor
  const handleTestarPing = async () => {
    setServerStatus((prev) => ({ ...prev, checking: true }));
    try {
      const res = await evolutionApiService.pingServer();
      setServerStatus({
        online: res.online,
        latencyMs: res.latencyMs,
        tested: true,
        checking: false
      });
      if (res.online) {
        showToast(`Servidor Evolution API Online! Latência: ${res.latencyMs}ms`);
      } else {
        alert(`Servidor Evolution API indisponível: ${res.error || 'Erro de conexão'}`);
      }
    } catch {
      setServerStatus((prev) => ({ ...prev, online: false, checking: false, tested: true }));
    }
  };

  useEffect(() => {
    carregarHoteisEPlanos().then(() => {
      carregarTodasInstancias();
    });
    handleTestarPing();
  }, []);

  // Modal QR Code
  const handleAbrirQrCodeModal = async (inst: AdminWhatsappInstance) => {
    setQrModalInstance(inst);
    setQrCodeData(null);
    setQrConnectedSuccess(false);
    setQrLoading(true);
    setTempoRestanteQr(45);

    try {
      const res = await evolutionApiService.connectInstance(inst.instanceName);
      if (res.state === 'open') {
        setQrConnectedSuccess(true);
        setQrLoading(false);
        carregarTodasInstancias(true);
        return;
      }
      if (res.qrcode) {
        setQrCodeData(res.qrcode);
      }
    } catch (err) {
      console.error('Erro ao conectar instância admin:', err);
      showToast('Erro ao solicitar QR Code ao servidor.');
    } finally {
      setQrLoading(false);
    }
  };

  // Polling QR Code
  useEffect(() => {
    if (!qrModalInstance || qrConnectedSuccess) return;

    const intervalState = setInterval(async () => {
      try {
        const state = await evolutionApiService.getConnectionState(qrModalInstance.instanceName);
        if (state === 'open') {
          setQrConnectedSuccess(true);
          carregarTodasInstancias(true);
          showToast(`🎉 Instância "${qrModalInstance.name}" conectada com sucesso!`);
        }
      } catch {}
    }, 3500);

    const intervalTimer = setInterval(() => {
      setTempoRestanteQr((prev) => {
        if (prev <= 1) {
          evolutionApiService.connectInstance(qrModalInstance.instanceName).then((res) => {
            if (res.qrcode) setQrCodeData(res.qrcode);
            if (res.state === 'open') {
              setQrConnectedSuccess(true);
              carregarTodasInstancias(true);
            }
          });
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(intervalState);
      clearInterval(intervalTimer);
    };
  }, [qrModalInstance, qrConnectedSuccess]);

  // Criar Nova Instância via Painel Admin
  const handleSaveNovaConexaoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim() || criandoInstancia) return;

    // Verificar se hotel foi selecionado
    const selectedHotel = hoteis.find((h) => h.id === novoHotelId);

    // Se for associada a um hotel e não estiver no modo ignorar limite, checa a regra do plano
    if (selectedHotel && !ignorarLimitePlano) {
      const countHotel = instances.filter((i) => i.hotelId === selectedHotel.id).length;
      let maxInst = 1;
      if (selectedHotel.whatsappInstances && Number(selectedHotel.whatsappInstances) > 0) {
        maxInst = Number(selectedHotel.whatsappInstances);
      } else {
        const pLower = (selectedHotel.plan || '').toLowerCase();
        if (pLower.includes('12 credito') || pLower.includes('anual') || pLower.includes('enterprise')) maxInst = 5;
        else if (pLower.includes('6 credito') || pLower.includes('semestral')) maxInst = 4;
        else if (pLower.includes('3 credito') || pLower.includes('trimestral') || pLower.includes('ouro')) maxInst = 3;
        else if (pLower.includes('2 credito') || pLower.includes('bimestral') || pLower.includes('professional')) maxInst = 2;
        else maxInst = 1;
      }

      if (countHotel >= maxInst) {
        const confirmarBypass = window.confirm(
          `Atenção Super Admin:\n\nO hotel "${selectedHotel.name}" já atingiu o limite do plano "${selectedHotel.plan}" (${countHotel}/${maxInst} instâncias).\n\nDeseja ignorar o limite do plano e criar esta conexão adicional mesmo assim?`
        );
        if (!confirmarBypass) return;
      }
    }

    setCriandoInstancia(true);
    try {
      const cleanHotelPrefix = selectedHotel
        ? selectedHotel.id.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8)
        : 'master';

      const cleanSlug = novoNome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 15);

      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const finalInstanceName = `${cleanHotelPrefix}_${cleanSlug || 'wa'}_${uniqueSuffix}`;

      const res = await evolutionApiService.createInstance(finalInstanceName, {
        qrcode: true,
        number: novoTelefone || undefined
      });

      if (!res.success) {
        alert(res.error || 'Erro ao criar instância na Evolution API.');
        setCriandoInstancia(false);
        return;
      }

      // Salva metadados
      const targetHotelId = selectedHotel ? selectedHotel.id : 'global';
      const newMeta: InstanceMetadata = {
        instanceName: finalInstanceName,
        displayName: novoNome.trim(),
        department: novoDept,
        hotelId: targetHotelId,
        phone: novoTelefone || undefined,
        createdAt: new Date().toISOString()
      };
      evolutionApiService.saveLocalMetadata(targetHotelId, newMeta);

      if (selectedHotel) {
        try {
          await hoteisService.updateHotel(selectedHotel.id, { instanceName: finalInstanceName });
        } catch {}
      }

      setIsNovaConexaoOpen(false);
      setNovoNome('');
      setNovoTelefone('');
      setNovoHotelId('');
      setNovoDept('Recepção & Check-in');
      setIgnorarLimitePlano(false);

      showToast(`Instância "${newMeta.displayName}" criada com sucesso no servidor!`);
      await carregarTodasInstancias(true);

      const novaUi: AdminWhatsappInstance = {
        id: finalInstanceName,
        code: `WZ${uniqueSuffix.slice(-2)}`,
        name: newMeta.displayName,
        instanceName: finalInstanceName,
        phone: novoTelefone ? maskPhone(novoTelefone) : 'Aguardando pareamento',
        department: newMeta.department,
        status: 'aguardando',
        battery: 'Desconhecido',
        device: 'WhatsApp Baileys',
        lastActivity: 'Agora',
        messagesSentToday: 0,
        hotelId: selectedHotel?.id || null,
        hotelName: selectedHotel?.name || 'Instância Global',
        hotelCityUf: selectedHotel?.cityUf || null,
        hotelPlan: selectedHotel?.plan || null
      };

      if (res.qrcode) {
        setQrModalInstance(novaUi);
        setQrCodeData(res.qrcode);
        setQrConnectedSuccess(false);
        setQrLoading(false);
        setTempoRestanteQr(45);
      } else {
        handleAbrirQrCodeModal(novaUi);
      }
    } catch (err: any) {
      console.error('Erro ao criar instância pelo admin:', err);
      alert('Erro inesperado ao criar instância.');
    } finally {
      setCriandoInstancia(false);
    }
  };

  // Salvar Vínculo de Hotel a uma Instância Existente
  const handleSalvarVinculoHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vincularModalInstance || salvandoVinculo) return;

    setSalvandoVinculo(true);
    try {
      const selectedHotel = hoteis.find((h) => h.id === novoVinculoHotelId);
      const targetHotelId = selectedHotel ? selectedHotel.id : 'global';

      const meta: InstanceMetadata = {
        instanceName: vincularModalInstance.instanceName,
        displayName: vincularModalInstance.name,
        department: vincularModalInstance.department,
        hotelId: targetHotelId,
        phone: vincularModalInstance.phone !== 'Aguardando pareamento' ? vincularModalInstance.phone : undefined,
        createdAt: new Date().toISOString()
      };

      evolutionApiService.saveLocalMetadata(targetHotelId, meta);

      if (selectedHotel) {
        try {
          await hoteisService.updateHotel(selectedHotel.id, { instanceName: vincularModalInstance.instanceName });
        } catch {}
      }

      showToast(`Instância "${vincularModalInstance.name}" vinculada com sucesso!`);
      setVincularModalInstance(null);
      setNovoVinculoHotelId('');
      await carregarTodasInstancias(true);
    } catch (err) {
      console.error('Erro ao vincular instância a hotel:', err);
      showToast('Erro ao salvar vínculo.');
    } finally {
      setSalvandoVinculo(false);
    }
  };

  // Confirmar Exclusão de Instância
  const handleConfirmDelete = async () => {
    if (!deleteConfirmInstance || excluindoInstancia) return;
    setExcluindoInstancia(true);

    try {
      const res = await evolutionApiService.deleteInstance(deleteConfirmInstance.instanceName);
      if (res.success) {
        evolutionApiService.removeLocalMetadata(
          deleteConfirmInstance.hotelId || 'global',
          deleteConfirmInstance.instanceName
        );
        showToast(`Instância "${deleteConfirmInstance.name}" excluída da Evolution API.`);
        setDeleteConfirmInstance(null);
        await carregarTodasInstancias(true);
      } else {
        alert(res.message || 'Erro ao excluir instância na Evolution API.');
      }
    } catch (err) {
      console.error('Erro ao excluir instância:', err);
      showToast('Erro ao excluir instância.');
    } finally {
      setExcluindoInstancia(false);
    }
  };

  // Filtragem
  const filteredInstances = useMemo(() => {
    return instances.filter((inst) => {
      const matchesSearch =
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.instanceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inst.hotelName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'conectado' && inst.status === 'conectado') ||
        (statusFilter === 'desconectado' && inst.status === 'desconectado') ||
        (statusFilter === 'aguardando' && inst.status === 'aguardando');

      const matchesHotel =
        hotelFilter === 'todos' ||
        (hotelFilter === 'sem-hotel' && !inst.hotelId) ||
        inst.hotelId === hotelFilter;

      return matchesSearch && matchesStatus && matchesHotel;
    });
  }, [instances, searchQuery, statusFilter, hotelFilter]);

  // Métricas
  const totalInstances = instances.length;
  const connectedCount = instances.filter((i) => i.status === 'conectado').length;
  const waitingCount = instances.filter((i) => i.status === 'aguardando').length;
  const hoteisComConexao = useMemo(() => {
    const ids = new Set(instances.map((i) => i.hotelId).filter(Boolean));
    return ids.size;
  }, [instances]);

  return (
    <div className="p-4 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto flex flex-col gap-6 pb-24 lg:pb-12 font-sans">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#d1fae5] border border-emerald-300 text-black px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm">
            <span className="material-symbols-outlined text-emerald-800 text-xl">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* CABEÇALHO & BREADCRUMB */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
              Infraestrutura & Mensageria SaaS
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Evolution API v2.3.0
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="material-symbols-outlined text-3xl text-emerald-700">sync_alt</span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              Conexões WhatsApp Globais
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Painel consolidado para monitoramento de instâncias Baileys/Evolution API, gateways de WhatsApp e tráfego de todos os hotéis da plataforma.
          </p>
        </div>

        {/* BOTÕES DE AÇÃO SUPERIORES */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>Voltar à Área Administrativa</span>
          </button>

          <a
            href="https://painelevolution.hotelnozap.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-200 shadow-2xs"
            title="Abrir o painel da Evolution API em nova aba"
          >
            <span className="material-symbols-outlined text-lg text-emerald-700">open_in_new</span>
            <span>Painel Evolution</span>
          </a>

          <button
            type="button"
            onClick={() => carregarTodasInstancias(true)}
            disabled={atualizandoStatus || carregando}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-200 shadow-2xs disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-lg ${atualizandoStatus ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{atualizandoStatus ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNovaConexaoOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#003400] hover:bg-[#002500] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-xs transition cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            <span>Nova Conexão Global</span>
          </button>
        </div>
      </div>

      {/* CARD DO GATEWAY EVOLUTION API */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Gateway Ativo
              </span>
              <span className="text-xs text-slate-400">Servidor Central Baileys</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white font-mono">
                https://painelevolution.hotelnozap.com.br
              </h2>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  serverStatus.online
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                  }`}
                />
                {serverStatus.online
                  ? serverStatus.tested
                    ? `Online (${serverStatus.latencyMs}ms)`
                    : 'Online'
                  : 'Indisponível'}
              </span>
            </div>

            {/* API Key Box */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-slate-400 font-semibold">Global API Key:</span>
              <code className="text-xs bg-black/40 px-2.5 py-1 rounded-lg text-emerald-300 font-mono border border-white/10">
                {showApiKey
                  ? 'wtwHLYfFxI9n1zDR8zFFqNq8kVaWqdD2oLpcjVmXBm'
                  : 'wtwHLYfFxI9n1z••••••••••••••••••••••••••••'}
              </code>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                {showApiKey ? 'Ocultar' : 'Revelar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('wtwHLYfFxI9n1zDR8zFFqNq8kVaWqdD2oLpcjVmXBm');
                  showToast('Chave copiada para a área de transferência!');
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline cursor-pointer ml-1"
              >
                Copiar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleTestarPing}
              disabled={serverStatus.checking}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-white/10"
            >
              <span
                className={`material-symbols-outlined text-base ${
                  serverStatus.checking ? 'animate-spin' : ''
                }`}
              >
                speed
              </span>
              <span>{serverStatus.checking ? 'Testando Ping...' : 'Testar Conexão'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* BENTO GRID DE MÉTRICAS GLOBAIS (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Instâncias no Servidor */}
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Instâncias no Servidor
            </p>
            <h3 className="text-2xl font-black text-emerald-950 mt-1">{totalInstances}</h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              {carregando ? 'Carregando da API...' : 'Total de instâncias Baileys'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">dns</span>
          </div>
        </div>

        {/* Card 2: Conectadas / Online */}
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              Online / Pareadas
            </p>
            <h3 className="text-2xl font-black text-blue-950 mt-1">{connectedCount}</h3>
            <p className="text-xs text-blue-700 mt-0.5">
              {connectedCount > 0 ? 'Transmitindo mensagens ativamente' : 'Nenhuma conexão pareada'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">wifi</span>
          </div>
        </div>

        {/* Card 3: Aguardando QR Code */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Aguardando QR Code
            </p>
            <h3 className="text-2xl font-black text-amber-950 mt-1">{waitingCount}</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              {waitingCount > 0 ? 'Pendentes de escaneamento' : 'Zero pendências'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">qr_code_2</span>
          </div>
        </div>

        {/* Card 4: Hotéis Atendidos */}
        <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Hotéis com Conexão
            </p>
            <h3 className="text-2xl font-black text-purple-950 mt-1">{hoteisComConexao}</h3>
            <p className="text-xs text-purple-700 mt-0.5">
              De {hoteis.length} hotéis cadastrados
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-700 shrink-0">
            <span className="material-symbols-outlined text-2xl">hotel</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS, BUSCA E MODO DE VISUALIZAÇÃO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por instância, hotel, telefone, setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
            />
          </div>

          {/* Filtro por Hotel */}
          <div className="min-w-[180px]">
            <select
              value={hotelFilter}
              onChange={(e) => setHotelFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 cursor-pointer"
            >
              <option value="todos">Todos os Hotéis ({instances.length})</option>
              <option value="sem-hotel">Sem Hotel Vinculado (Global)</option>
              {hoteis.map((h) => {
                const count = instances.filter((i) => i.hotelId === h.id).length;
                return (
                  <option key={h.id} value={h.id}>
                    {h.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filtro por Status */}
          <div className="min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="conectado">Online / Conectado</option>
              <option value="aguardando">Aguardando QR Code</option>
              <option value="desconectado">Desconectado</option>
            </select>
          </div>
        </div>

        {/* Alternador de Visualização */}
        <div className="flex items-center gap-1 self-end md:self-auto shrink-0 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span className="hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">table_rows</span>
            <span className="hidden sm:inline">Tabela</span>
          </button>
        </div>
      </div>

      {/* LISTAGEM DE INSTÂNCIAS GLOBAIS */}
      {carregando ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-700">Carregando instâncias da Evolution API...</p>
        </div>
      ) : filteredInstances.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200 shadow-xs text-center p-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <span className="material-symbols-outlined text-3xl">sync_problem</span>
          </div>
          <h3 className="text-lg font-black text-slate-800">Nenhuma instância encontrada</h3>
          <p className="text-xs text-slate-500 max-w-md">
            {searchQuery || statusFilter !== 'todos' || hotelFilter !== 'todos'
              ? 'Tente ajustar os filtros de busca ou selecionar outro hotel.'
              : 'Não há nenhuma instância criada no servidor Evolution API. Clique em "Nova Conexão Global" para criar a primeira.'}
          </p>
          <button
            type="button"
            onClick={() => setIsNovaConexaoOpen(true)}
            className="mt-2 px-4 py-2 bg-[#003400] hover:bg-[#002500] text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            + Criar Nova Conexão
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISUALIZAÇÃO EM GRADE DE CARDS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInstances.map((inst) => {
            const isOnline = inst.status === 'conectado';
            const isWaiting = inst.status === 'aguardando';

            return (
              <div
                key={inst.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden"
              >
                {/* Header do Card com Hotel e Status */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Badge do Hotel */}
                    <div className="flex-1 min-w-0">
                      {inst.hotelName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-emerald-700 text-base shrink-0">
                            hotel
                          </span>
                          <span className="text-xs font-black text-slate-900 truncate">
                            {inst.hotelName}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          <span className="material-symbols-outlined text-xs">help</span>
                          Sem hotel vinculado
                        </span>
                      )}
                      {inst.hotelCityUf && (
                        <span className="text-[11px] text-slate-400 block truncate">
                          {inst.hotelCityUf} • Plano {inst.hotelPlan || 'Padrão'}
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 ${
                        isOnline
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : isWaiting
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-red-100 text-red-900 border border-red-300'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isOnline ? 'bg-emerald-600 animate-pulse' : isWaiting ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      />
                      {isOnline ? 'Online' : isWaiting ? 'Aguardando QR' : 'Desconectado'}
                    </span>
                  </div>

                  {/* Nome da Instância e Setor */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-900 truncate">{inst.name}</span>
                      <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                        {inst.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Setor: <strong>{inst.department}</strong></span>
                      <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px]" title={inst.instanceName}>
                        {inst.instanceName}
                      </span>
                    </div>
                  </div>

                  {/* Informações de Telefone e Mensagens */}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">WhatsApp Conectado</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{inst.phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Mensagens Registradas</span>
                      <span className="text-xs font-bold text-emerald-800 font-mono">
                        {inst.messagesSentToday.toLocaleString('pt-BR')} msg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações Administrativas */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Botão Conectar / QR Code */}
                    <button
                      type="button"
                      onClick={() => handleAbrirQrCodeModal(inst)}
                      className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition cursor-pointer border border-emerald-200"
                      title="Ver / Escanear QR Code"
                    >
                      <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
                    </button>

                    {/* Botão Vincular Hotel */}
                    <button
                      type="button"
                      onClick={() => {
                        setVincularModalInstance(inst);
                        setNovoVinculoHotelId(inst.hotelId || '');
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Vincular ou Trocar Hotel desta Instância"
                    >
                      <span className="material-symbols-outlined text-lg">link</span>
                    </button>

                    {/* Botão Reiniciar */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await evolutionApiService.restartInstance(inst.instanceName);
                          showToast(`Instância "${inst.name}" reiniciada com sucesso.`);
                          carregarTodasInstancias(true);
                        } catch {
                          showToast('Falha ao reiniciar.');
                        }
                      }}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      title="Reiniciar Sessão"
                    >
                      <span className="material-symbols-outlined text-lg">refresh</span>
                    </button>

                    {/* Botão Desconectar (se conectado) */}
                    {isOnline && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Deseja desconectar o WhatsApp da instância "${inst.name}"?`)) {
                            try {
                              await evolutionApiService.logoutInstance(inst.instanceName);
                              showToast(`Instância "${inst.name}" desconectada.`);
                              carregarTodasInstancias(true);
                            } catch {
                              showToast('Erro ao desconectar.');
                            }
                          }
                        }}
                        className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 transition cursor-pointer"
                        title="Desconectar WhatsApp"
                      >
                        <span className="material-symbols-outlined text-lg">power_settings_new</span>
                      </button>
                    )}
                  </div>

                  {/* Botão Excluir */}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmInstance(inst)}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
                    title="Excluir Instância do Servidor"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISUALIZAÇÃO EM TABELA EXECUTIVA */
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Hotel / Origem</th>
                  <th className="py-3.5 px-4">Instância (API)</th>
                  <th className="py-3.5 px-4">Setor</th>
                  <th className="py-3.5 px-4">Telefone Pareado</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Mensagens</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInstances.map((inst) => {
                  const isOnline = inst.status === 'conectado';
                  const isWaiting = inst.status === 'aguardando';

                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Hotel */}
                      <td className="py-3.5 px-4">
                        {inst.hotelName ? (
                          <div>
                            <span className="font-extrabold text-slate-900 block">{inst.hotelName}</span>
                            <span className="text-[11px] text-slate-400">
                              {inst.hotelCityUf || 'Brasil'} • {inst.hotelPlan || 'Plano Padrão'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            Sem hotel vinculado
                          </span>
                        )}
                      </td>

                      {/* Instância */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 block">{inst.name}</span>
                        <code className="text-[11px] text-slate-400 font-mono">{inst.instanceName}</code>
                      </td>

                      {/* Setor */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{inst.department}</td>

                      {/* Telefone */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{inst.phone}</td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                            isOnline
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : isWaiting
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-red-100 text-red-900 border border-red-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-600 animate-pulse' : isWaiting ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                          />
                          {isOnline ? 'Online' : isWaiting ? 'Aguardando' : 'Off'}
                        </span>
                      </td>

                      {/* Mensagens */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-800">
                        {inst.messagesSentToday.toLocaleString('pt-BR')}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleAbrirQrCodeModal(inst)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition cursor-pointer"
                            title="QR Code"
                          >
                            <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVincularModalInstance(inst);
                              setNovoVinculoHotelId(inst.hotelId || '');
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            title="Vincular Hotel"
                          >
                            <span className="material-symbols-outlined text-base">link</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmInstance(inst)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer"
                            title="Excluir Instância"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL QR CODE DINÂMICO */}
      {qrModalInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-emerald-400">qr_code_scanner</span>
                <div>
                  <h3 className="font-bold text-base leading-tight">Pareamento WhatsApp</h3>
                  <p className="text-[11px] text-emerald-200">{qrModalInstance.name} ({qrModalInstance.instanceName})</p>
                </div>
              </div>
              <button
                onClick={() => setQrModalInstance(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex flex-col items-center text-center space-y-4">
              {qrConnectedSuccess ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center animate-bounce">
                    <span className="material-symbols-outlined text-4xl">check</span>
                  </div>
                  <h4 className="font-black text-lg text-slate-800">WhatsApp Conectado!</h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    O dispositivo foi pareado com sucesso no servidor Evolution API.
                  </p>
                  <button
                    onClick={() => {
                      setQrModalInstance(null);
                      carregarTodasInstancias(true);
                    }}
                    className="px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    Fechar e Continuar
                  </button>
                </div>
              ) : qrLoading ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
                  <p className="text-xs font-bold text-slate-700">
                    Gerando QR Code oficial na Evolution API...
                  </p>
                </div>
              ) : qrCodeData?.base64 ? (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Abra o WhatsApp no celular &gt; <strong>Aparelhos conectados</strong> &gt;{' '}
                    <strong>Conectar um aparelho</strong> e aponte a câmera:
                  </p>

                  <div className="w-64 h-64 bg-white p-3 border-2 border-emerald-500 rounded-2xl shadow-lg flex items-center justify-center relative">
                    <img
                      src={
                        qrCodeData.base64.startsWith('data:')
                          ? qrCodeData.base64
                          : `data:image/png;base64,${qrCodeData.base64}`
                      }
                      alt="QR Code WhatsApp Evolution"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {qrCodeData.pairingCode && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl w-full text-center">
                      <span className="text-[11px] text-slate-500 block">Código de pareamento:</span>
                      <strong className="text-base font-mono tracking-widest text-emerald-800">
                        {qrCodeData.pairingCode}
                      </strong>
                    </div>
                  )}

                  <div className="text-xs font-semibold text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">timer</span>
                    <span>Atualizando automaticamente em {tempoRestanteQr}s</span>
                  </div>
                </>
              ) : (
                <div className="py-8 space-y-3">
                  <span className="material-symbols-outlined text-4xl text-amber-500">info</span>
                  <p className="text-xs font-bold text-slate-700">
                    Esta instância já pode estar conectada ou inicializando.
                  </p>
                  <button
                    onClick={() => handleAbrirQrCodeModal(qrModalInstance)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Tentar Gerar QR Code Novamente
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleAbrirQrCodeModal(qrModalInstance)}
                disabled={qrLoading}
                className="text-xs font-bold text-[#003400] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                <span>Recarregar</span>
              </button>

              <button
                type="button"
                onClick={() => setQrModalInstance(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CONEXÃO GLOBAL / ADMIN */}
      {isNovaConexaoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-emerald-400">add_circle</span>
                <h3 className="font-bold text-base">Cadastrar Nova Conexão Global</h3>
              </div>
              <button
                onClick={() => setIsNovaConexaoOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNovaConexaoAdmin} className="p-6 space-y-4">
              {/* Seleção do Hotel */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Vincular ao Hotel *
                </label>
                <select
                  value={novoHotelId}
                  onChange={(e) => setNovoHotelId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 bg-white"
                >
                  <option value="">Instância Global da Plataforma (Sem hotel)</option>
                  {hoteis.map((h) => {
                    const count = instances.filter((i) => i.hotelId === h.id).length;
                    return (
                      <option key={h.id} value={h.id}>
                        {h.name} ({count} conexões ativas • {h.plan})
                      </option>
                    );
                  })}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  O nome da instância na Evolution API receberá o prefixo único do hotel.
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome da Conexão / Identificador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Recepção, Reservas, Suporte Master..."
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Departamento / Setor *
                </label>
                <select
                  value={novoDept}
                  onChange={(e) => setNovoDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 bg-white"
                >
                  <option value="Recepção & Check-in">Recepção & Check-in</option>
                  <option value="Central de Reservas">Central de Reservas</option>
                  <option value="Suporte Master Plataforma">Suporte Master Plataforma</option>
                  <option value="Disparos & Notificações">Disparos & Notificações</option>
                  <option value="Camareiras & Governança">Camareiras & Governança</option>
                  <option value="Financeiro / Cobrança">Financeiro / Cobrança</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Número de Referência WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(maskPhone(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#003400]/30"
                />
              </div>

              {/* Checkbox de Override Administrativo */}
              {novoHotelId && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    id="chkIgnorar"
                    checked={ignorarLimitePlano}
                    onChange={(e) => setIgnorarLimitePlano(e.target.checked)}
                    className="mt-0.5 cursor-pointer accent-[#003400]"
                  />
                  <label htmlFor="chkIgnorar" className="text-amber-950 font-semibold cursor-pointer">
                    Autorizar liberação extraordinária (Permitir ultrapassar o limite padrão do plano deste hotel)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNovaConexaoOpen(false)}
                  disabled={criandoInstancia}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criandoInstancia}
                  className="px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {criandoInstancia ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Criando no Servidor...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check</span>
                      <span>Criar Instância & Gerar QR Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VINCULAR HOTEL A INSTÂNCIA EXISTENTE */}
      {vincularModalInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#003400] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-emerald-400">link</span>
                <div>
                  <h3 className="font-bold text-base leading-tight">Vincular a um Hotel</h3>
                  <p className="text-[11px] text-emerald-200">Instância: {vincularModalInstance.instanceName}</p>
                </div>
              </div>
              <button
                onClick={() => setVincularModalInstance(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarVinculoHotel} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Selecione qual hotel cadastrado é o proprietário desta conexão do WhatsApp:
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hotel de Destino
                </label>
                <select
                  value={novoVinculoHotelId}
                  onChange={(e) => setNovoVinculoHotelId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#003400]/30 bg-white"
                >
                  <option value="">Manter Global (Sem hotel vinculado)</option>
                  {hoteis.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.cityUf || 'Sem cidade'} • {h.plan})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVincularModalInstance(null)}
                  disabled={salvandoVinculo}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoVinculo}
                  className="px-6 py-2.5 bg-[#003400] hover:bg-[#002500] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-2"
                >
                  {salvandoVinculo ? 'Salvando...' : 'Salvar Vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmInstance && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">delete_forever</span>
              </div>
              <h3 className="font-extrabold text-lg text-slate-900">Excluir Instância do Servidor?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Você está prestes a remover permanentemente a instância{' '}
                <strong className="text-slate-900 font-mono">{deleteConfirmInstance.instanceName}</strong> do
                servidor Evolution API.
                {deleteConfirmInstance.hotelName && (
                  <>
                    <br />
                    Vinculada ao: <strong>{deleteConfirmInstance.hotelName}</strong>
                  </>
                )}
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmInstance(null)}
                disabled={excluindoInstancia}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={excluindoInstancia}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-2"
              >
                {excluindoInstancia ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConexoesWhatsapp;
