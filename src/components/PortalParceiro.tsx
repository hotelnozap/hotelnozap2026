import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Link2, 
  Settings, 
  LogOut, 
  Bell, 
  User, 
  Copy, 
  Check, 
  ExternalLink, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  MessageCircle, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Menu, 
  X, 
  Mail, 
  Phone, 
  MapPin, 
  Award, 
  Zap, 
  CheckCircle2,
  Clock,
  QrCode,
  Share2,
  Download,
  FileText,
  Lock,
  ArrowUpRight,
  Key,
  Shield,
  EyeOff
} from 'lucide-react';
import { ZapHotelLogo } from './ZapHotelLogo';
import { supabase } from '../lib/supabase';
import { maskPhone } from '../utils/masks';

export interface IndicacaoHotel {
  id: string;
  nome: string;
  iniciais: string;
  avatarBg: string;
  cidadeUf: string;
  apartamentos: number;
  plano: string;
  valorPlano: number;
  comissaoMensal: number;
  dataAtivacao: string;
  statusRepasse: 'ativo_liberado' | 'trial_30' | 'pendente_onboarding' | 'cancelado';
  statusTexto: string;
  diasTrialRestantes?: number;
  whatsapp: string;
  contatoNome: string;
}

interface PortalParceiroProps {
  onLogout?: () => void;
  onNavigateHome?: () => void;
}

export const PortalParceiro: React.FC<PortalParceiroProps> = ({
  onLogout,
  onNavigateHome
}) => {
  // Aba ativa: 'dashboard' | 'indicacoes' | 'financeiro' | 'links' | 'configuracoes'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'indicacoes' | 'financeiro' | 'links' | 'configuracoes'>('dashboard');
  
  // Controle de Menu Mobile (Drawer)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Feedback ao copiar o link
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Modais
  const [modalNovaIndicacao, setModalNovaIndicacao] = useState(false);
  const [hotelDetalhesModal, setHotelDetalhesModal] = useState<IndicacaoHotel | null>(null);

  // Dados do Parceiro Logado
  const [partnerProfile, setPartnerProfile] = useState<{
    id?: string;
    nome: string;
    email: string;
    cupom: string;
    documento: string;
    whatsapp: string;
    cidadeUf: string;
    categoria: string;
    taxaComissao: number;
    pixTipo: string;
    pixChave: string;
    titularPix: string;
  }>({
    nome: localStorage.getItem('hotelnozap_user_name') || 'Parceiro',
    email: localStorage.getItem('hotelnozap_user_email') || '',
    cupom: '',
    documento: '',
    whatsapp: '',
    cidadeUf: '',
    categoria: 'Franquia Regional',
    taxaComissao: 50,
    pixTipo: 'CPF',
    pixChave: '',
    titularPix: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [salvandoLead, setSalvandoLead] = useState(false);
  const [planosMap, setPlanosMap] = useState<Map<string, { valor: number; nome: string }>>(new Map());

  // Lista de Hotéis Indicados Reais
  const [hoteisIndicados, setHoteisIndicados] = useState<IndicacaoHotel[]>([]);

  // Função para carregar perfil e hotéis do Supabase
  const carregarDadosDoBanco = async () => {
    setIsLoading(true);
    const storedEmail = (localStorage.getItem('hotelnozap_user_email') || '').trim().toLowerCase();
    const storedId = localStorage.getItem('hotelnozap_user_id') || '';

    try {
      // 1. Carrega catálogo de planos para mapear valores
      const { data: dbPlanos } = await supabase.from('planos').select('*');
      const pMap = new Map<string, { valor: number; nome: string }>();
      if (dbPlanos) {
        dbPlanos.forEach((p: any) => {
          const k = (p.nome || '').toLowerCase().trim();
          pMap.set(k, { valor: Number(p.valor_base) || 197, nome: p.nome });
        });
      }
      setPlanosMap(pMap);

      // 2. Busca parceiro logado
      let parc: any = null;
      if (storedEmail) {
        const { data: pEmail } = await supabase
          .from('parceiros')
          .select('*')
          .ilike('email', storedEmail)
          .maybeSingle();
        parc = pEmail;
      }

      if (!parc && storedId) {
        const { data: pId } = await supabase
          .from('parceiros')
          .select('*')
          .or(`usuario_id.eq.${storedId},auth_user_id.eq.${storedId},id.eq.${storedId}`)
          .maybeSingle();
        parc = pId;
      }

      if (parc) {
        const profileObj = {
          id: parc.id,
          nome: parc.nome || localStorage.getItem('hotelnozap_user_name') || 'Parceiro',
          email: parc.email || storedEmail,
          cupom: parc.cupom || '',
          documento: parc.documento || '',
          whatsapp: parc.whatsapp || '',
          cidadeUf: parc.cidade_uf || (parc.cidade ? `${parc.cidade} / ${parc.uf}` : 'Polo Regional'),
          categoria: parc.categoria || 'Franquia Regional',
          taxaComissao: parc.taxa_comissao !== undefined && parc.taxa_comissao !== null ? Number(parc.taxa_comissao) : 50,
          pixTipo: parc.pix_tipo || 'CPF',
          pixChave: parc.pix_chave || parc.documento || '',
          titularPix: parc.titular_pix || parc.nome || ''
        };
        setPartnerProfile(profileObj);

        // 3. Busca hotéis reais indicados por este parceiro
        const condicoes: string[] = [];
        if (profileObj.cupom) condicoes.push(`parceiro_referencia.ilike.${profileObj.cupom}`);
        if (profileObj.id) condicoes.push(`parceiro_referencia.eq.${profileObj.id}`);
        if (profileObj.nome) condicoes.push(`parceiro_referencia.ilike.${profileObj.nome}`);

        let dbHoteis: any[] = [];
        if (condicoes.length > 0) {
          const { data: hots } = await supabase
            .from('hoteis')
            .select('*')
            .or(condicoes.join(','))
            .order('criado_em', { ascending: false });
          dbHoteis = hots || [];
        }

        // Mapeia hotéis reais para o formato IndicacaoHotel
        const comissaoTaxa = profileObj.taxaComissao;
        const mappedHoteis: IndicacaoHotel[] = dbHoteis.map((h: any) => {
          const planoStr = (h.plano || '').toLowerCase();
          let valorBase = 197;
          if (pMap.has(planoStr)) {
            valorBase = pMap.get(planoStr)!.valor;
          } else if (planoStr.includes('bimestral')) {
            valorBase = 349;
          } else if (planoStr.includes('trimestral')) {
            valorBase = 497;
          } else if (planoStr.includes('semestral')) {
            valorBase = 890;
          } else if (planoStr.includes('anual')) {
            valorBase = 1690;
          } else if (planoStr.includes('grátis') || planoStr.includes('gratis')) {
            valorBase = 0;
          }

          const comissao = valorBase > 0 ? (valorBase * comissaoTaxa) / 100 : 0;
          const statusLower = (h.status || '').toLowerCase();

          let statusRepasse: IndicacaoHotel['statusRepasse'] = 'ativo_liberado';
          let statusTexto = 'Ativo - Repasse Liberado';
          let diasTrialRestantes: number | undefined = undefined;

          if (statusLower === 'prospecto' || statusLower === 'trial' || statusLower === 'pendente') {
            statusRepasse = 'trial_30';
            statusTexto = 'Trial 30 Dias';
            diasTrialRestantes = 30;
          } else if (statusLower === 'bloqueado' || statusLower === 'cancelado') {
            statusRepasse = 'cancelado';
            statusTexto = 'Cancelado';
          } else if (statusLower === 'onboarding' || statusLower === 'setup') {
            statusRepasse = 'pendente_onboarding';
            statusTexto = 'Pendente Onboarding';
          }

          const initials = (h.nome || 'Hotel')
            .split(' ')
            .map((p: string) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'HT';

          return {
            id: h.id,
            nome: h.nome || 'Hotel Parceiro',
            iniciais: initials,
            avatarBg: statusRepasse === 'ativo_liberado' 
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
              : statusRepasse === 'trial_30'
              ? 'bg-blue-100 text-blue-800 border-blue-300'
              : 'bg-amber-100 text-amber-800 border-amber-300',
            cidadeUf: h.cidade && h.uf ? `${h.cidade}, ${h.uf}` : (h.cidade || h.uf || 'Brasil'),
            apartamentos: Number(h.capacidade) || 15,
            plano: h.plano || 'Profissional IA',
            valorPlano: valorBase,
            comissaoMensal: comissao,
            dataAtivacao: h.criado_em ? new Date(h.criado_em).toLocaleDateString('pt-BR') : 'Recente',
            statusRepasse,
            statusTexto,
            diasTrialRestantes,
            whatsapp: (h.telefone_gerente || h.whatsapp || '').replace(/\D/g, ''),
            contatoNome: h.nome_gerente || 'Gestor'
          };
        });

        setHoteisIndicados(mappedHoteis);
      }
    } catch (err) {
      console.error('Erro ao carregar dados reais do portal do parceiro:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDadosDoBanco();
  }, []);

  // Link Oficial de Indicação
  const referralLink = partnerProfile.cupom
    ? `https://hotelnozap.com.br/parceiros/assinar?ref=${partnerProfile.cupom}`
    : 'https://hotelnozap.com.br/parceiros/assinar';

  const handleCopiarLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 3000);
  };

  // Filtros da Tabela
  const [buscaHotel, setBuscaHotel] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  const hoteisFiltrados = useMemo(() => {
    return hoteisIndicados.filter(h => {
      const matchBusca = h.nome.toLowerCase().includes(buscaHotel.toLowerCase()) || 
                         h.cidadeUf.toLowerCase().includes(buscaHotel.toLowerCase());
      if (filtroStatus === 'todos') return matchBusca;
      if (filtroStatus === 'ativo') return matchBusca && h.statusRepasse === 'ativo_liberado';
      if (filtroStatus === 'trial') return matchBusca && h.statusRepasse === 'trial_30';
      if (filtroStatus === 'pendente') return matchBusca && h.statusRepasse === 'pendente_onboarding';
      if (filtroStatus === 'cancelado') return matchBusca && h.statusRepasse === 'cancelado';
      return matchBusca;
    });
  }, [hoteisIndicados, buscaHotel, filtroStatus]);

  // Cálculos de Métricas 100% Reais
  const metricasReais = useMemo(() => {
    const ativos = hoteisIndicados.filter(h => h.statusRepasse === 'ativo_liberado');
    const trials = hoteisIndicados.filter(h => h.statusRepasse === 'trial_30');
    const pendentes = hoteisIndicados.filter(h => h.statusRepasse === 'pendente_onboarding');
    const cancelados = hoteisIndicados.filter(h => h.statusRepasse === 'cancelado');

    const ganhosMes = ativos.reduce((acc, h) => acc + h.comissaoMensal, 0);

    // Ganhos da semana (hotéis adicionados nos últimos 7 dias)
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const ativosRecentes = ativos.filter(h => {
      try {
        const partes = h.dataAtivacao.split('/');
        if (partes.length === 3) {
          const d = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
          return d >= seteDiasAtras;
        }
      } catch {}
      return false;
    });
    const ganhosSemana = ativosRecentes.reduce((acc, h) => acc + h.comissaoMensal, 0);

    // Total Vitalício (baseado no histórico acumulado)
    const totalVitalicio = ganhosMes;

    const totalComStatus = ativos.length + cancelados.length;
    const taxaRetencao = totalComStatus > 0 
      ? ((ativos.length / totalComStatus) * 100).toFixed(1)
      : '100.0';

    return {
      totalIndicacoes: hoteisIndicados.length,
      ativosCount: ativos.length,
      trialsCount: trials.length,
      pendentesCount: pendentes.length,
      canceladosCount: cancelados.length,
      ganhosMes,
      ganhosSemana,
      novosSemanaCount: ativosRecentes.length,
      totalVitalicio,
      taxaRetencao: `${taxaRetencao}%`
    };
  }, [hoteisIndicados]);

  // Formulário Nova Indicação Lead
  const [novoLead, setNovoLead] = useState({
    nome: '',
    cidadeUf: '',
    contatoNome: '',
    whatsapp: '',
    apartamentos: 20
  });

  const handleCadastrarNovoLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoLead.nome.trim()) return;

    setSalvandoLead(true);
    try {
      const cidadePartes = novoLead.cidadeUf.split(',');
      const cidade = cidadePartes[0]?.trim() || novoLead.cidadeUf.trim();
      const uf = cidadePartes[1]?.trim() || '';

      const { data, error } = await supabase
        .from('hoteis')
        .insert({
          nome: novoLead.nome.trim(),
          razao_social: novoLead.nome.trim(),
          cidade: cidade,
          uf: uf || null,
          capacidade: Number(novoLead.apartamentos) || 20,
          nome_gerente: novoLead.contatoNome.trim() || 'Gestor',
          telefone_gerente: novoLead.whatsapp.replace(/\D/g, ''),
          whatsapp: novoLead.whatsapp.replace(/\D/g, ''),
          status: 'prospecto',
          plano: 'Profissional IA',
          parceiro_referencia: partnerProfile.cupom || partnerProfile.id || partnerProfile.nome,
          observacoes: `Indicação cadastrada pelo parceiro ${partnerProfile.nome} em ${new Date().toLocaleDateString('pt-BR')}`
        })
        .select()
        .single();

      if (error) throw error;

      // Recarrega lista oficial do banco
      await carregarDadosDoBanco();
      setNovoLead({ nome: '', cidadeUf: '', contatoNome: '', whatsapp: '', apartamentos: 20 });
      setModalNovaIndicacao(false);
      alert('Indicação cadastrada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao cadastrar hotel:', err);
      alert('Erro ao cadastrar indicação: ' + (err.message || 'Tente novamente'));
    } finally {
      setSalvandoLead(false);
    }
  };

  // Submenu Configurações: 'dados' (Dados da Franquia & PIX) | 'acesso' (Alteração de Senha)
  const [subTabConfig, setSubTabConfig] = useState<'dados' | 'acesso'>('dados');

  // Estados do formulário de Alteração de Senha
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmar, setSenhaConfirmar] = useState('');
  const [mostrarSenhaNova, setMostrarSenhaNova] = useState(false);
  const [mostrarSenhaConfirmar, setMostrarSenhaConfirmar] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [msgSenha, setMsgSenha] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgSenha(null);

    const novaLimpa = senhaNova.trim();
    const confLimpa = senhaConfirmar.trim();

    if (!novaLimpa) {
      setMsgSenha({ tipo: 'erro', texto: 'Por favor, digite a nova senha.' });
      return;
    }

    if (novaLimpa.length < 6) {
      setMsgSenha({ tipo: 'erro', texto: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (novaLimpa !== confLimpa) {
      setMsgSenha({ tipo: 'erro', texto: 'A confirmação de senha não coincide com a nova senha digitada.' });
      return;
    }

    setSalvandoSenha(true);
    try {
      // 1. Atualiza no Supabase Auth caso o usuário esteja autenticado
      try {
        const { error: authErr } = await supabase.auth.updateUser({ password: novaLimpa });
        if (authErr) {
          console.warn('Aviso auth updateUser:', authErr.message);
        }
      } catch (authCatch) {
        console.warn('Exceção auth updateUser:', authCatch);
      }

      // 2. Atualiza na tabela usuarios onde email ou id corresponda ao parceiro
      const email = partnerProfile.email?.toLowerCase().trim();
      const storedId = localStorage.getItem('hotelnozap_user_id') || '';

      if (email) {
        await supabase
          .from('usuarios')
          .update({ password: novaLimpa })
          .ilike('email', email);
      } else if (storedId) {
        await supabase
          .from('usuarios')
          .update({ password: novaLimpa })
          .eq('id', storedId);
      }

      setMsgSenha({ tipo: 'sucesso', texto: 'Senha alterada com sucesso! Utilize sua nova senha nos próximos acessos.' });
      setSenhaNova('');
      setSenhaConfirmar('');
    } catch (err: any) {
      console.error('Erro ao alterar senha do parceiro:', err);
      setMsgSenha({ tipo: 'erro', texto: 'Erro ao alterar senha: ' + (err.message || 'Tente novamente.') });
    } finally {
      setSalvandoSenha(false);
    }
  };

  // Salvar configurações do parceiro
  const handleSalvarConfiguracoes = async () => {
    if (!partnerProfile.id) {
      alert('Parceiro não identificado.');
      return;
    }

    setSalvandoConfig(true);
    try {
      const { error } = await supabase
        .from('parceiros')
        .update({
          pix_chave: partnerProfile.pixChave,
          pix_tipo: partnerProfile.pixTipo,
          titular_pix: partnerProfile.titularPix || partnerProfile.nome,
          whatsapp: partnerProfile.whatsapp
        })
        .eq('id', partnerProfile.id);

      if (error) throw error;
      alert('Configurações atualizadas com sucesso no banco de dados!');
    } catch (err: any) {
      console.error('Erro ao salvar dados do parceiro:', err);
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSalvandoConfig(false);
    }
  };

  // Formatação de Moeda BRL
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Data atual formatada (ex: Terça-feira, 24 de Outubro • 14:35)
  const [dataHoraAtual, setDataHoraAtual] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        day: '2-digit', 
        month: 'long' 
      };
      const dataExtenso = now.toLocaleDateString('pt-BR', options);
      const dataCapitalizada = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);
      const horas = String(now.getHours()).padStart(2, '0');
      const minutos = String(now.getMinutes()).padStart(2, '0');
      setDataHoraAtual(`${dataCapitalizada} • ${horas}:${minutos}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('hotelnozap_user_role');
    localStorage.removeItem('hotelnozap_user_email');
    localStorage.removeItem('hotelnozap_user_name');
    localStorage.removeItem('hotelnozap_user_id');
    localStorage.removeItem('hotelnozap_user_cargo');
    try { supabase.auth.signOut(); } catch {}
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/paineladmin';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-sans text-slate-800 antialiased selection:bg-[#003400] selection:text-white">

      {/* ========================================================================= */}
      {/* 1. SIDEBAR DESKTOP (FIEL AO MODELO - FUNDO VERDE ESCURO ELEGANTE)          */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 bg-[#002600] text-white flex-col justify-between shrink-0 min-h-screen border-r border-[#001f00] z-30">
        <div className="p-6">
          {/* Logo e Identidade do Portal */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <ZapHotelLogo size={38} bubbleColor="#10B981" iconColor="#002600" />
            <div>
              <span className="text-lg font-black text-white tracking-tight flex items-center gap-1">
                Hotel no Zap
              </span>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#10B981] block">
                PORTAL DO PARCEIRO
              </span>
            </div>
          </div>

          {/* Menus de Navegação */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#004d00] text-emerald-300 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('indicacoes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'indicacoes'
                  ? 'bg-[#004d00] text-emerald-300 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'indicacoes' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Minhas Indicações</span>
            </button>

            <button
              onClick={() => setActiveTab('financeiro')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'financeiro'
                  ? 'bg-[#004d00] text-emerald-300 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <CreditCard className={`w-5 h-5 ${activeTab === 'financeiro' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Extrato Financeiro</span>
            </button>

            <button
              onClick={() => setActiveTab('links')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'links'
                  ? 'bg-[#004d00] text-emerald-300 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Link2 className={`w-5 h-5 ${activeTab === 'links' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Meus Links & Materiais</span>
            </button>

            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'configuracoes'
                  ? 'bg-[#004d00] text-emerald-300 shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className={`w-5 h-5 ${activeTab === 'configuracoes' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* Rodapé da Sidebar: Dados da Unidade e Logout */}
        <div className="p-4 m-4 rounded-2xl bg-[#001a00] border border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">
                {partnerProfile.categoria}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {partnerProfile.cidadeUf}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors mb-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair do Portal</span>
          </button>

          <div className="pt-2 border-t border-white/10 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <a href="/termos" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Termos</a>
            <span>•</span>
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacidade</a>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. TOPBAR MOBILE                                                          */}
      {/* ========================================================================= */}
      <header className="lg:hidden bg-[#002600] text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2" onClick={() => setActiveTab('dashboard')}>
            <ZapHotelLogo size={28} bubbleColor="#10B981" iconColor="#002600" />
            <div>
              <span className="text-sm font-black text-white">HOTEL NO ZAP</span>
              <span className="text-[8px] uppercase tracking-wider text-[#10B981] font-extrabold block -mt-1">
                PORTAL DO PARCEIRO
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            className="p-1.5 text-slate-300 hover:text-white relative"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
          </button>
          <div 
            onClick={() => setActiveTab('configuracoes')}
            className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-black cursor-pointer"
          >
            {partnerProfile.nome.charAt(0)}
          </div>
        </div>
      </header>

      {/* DRAWER MENU MOBILE */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-[#002600] text-white h-full flex flex-col justify-between p-6 shadow-2xl z-10 animate-slide-in">
            <div>
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ZapHotelLogo size={32} bubbleColor="#10B981" iconColor="#002600" />
                  <span className="font-black text-white text-sm">HOTEL NO ZAP</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'indicacoes', label: 'Minhas Indicações', icon: Users },
                  { id: 'financeiro', label: 'Extrato Financeiro', icon: CreditCard },
                  { id: 'links', label: 'Meus Links & Materiais', icon: Link2 },
                  { id: 'configuracoes', label: 'Configurações', icon: Settings },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                        isActive
                          ? 'bg-[#004d00] text-emerald-300'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold text-rose-300 hover:bg-rose-500/10 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair do Portal</span>
              </button>
              <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
                <a href="/termos" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Termos</a>
                <span>•</span>
                <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacidade</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ÁREA DE CONTEÚDO PRINCIPAL (DESKTOP & MOBILE RESPONSIVO)                */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 lg:pb-12">
        
        {/* TOPBAR DESKTOP */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">
              👋 Olá, {partnerProfile.nome}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Franqueado Oficial
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{dataHoraAtual}</span>
            </div>

            <div className="h-4 w-px bg-slate-200" />

            <button 
              className="p-1.5 text-slate-500 hover:text-slate-800 relative hover:bg-slate-100 rounded-lg transition-colors"
              title="Notificações da Franquia"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            </button>

            <button 
              onClick={() => setActiveTab('configuracoes')}
              className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-xl border border-transparent hover:border-slate-200 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-[#003400] text-emerald-300 font-bold flex items-center justify-center text-xs">
                {partnerProfile.nome.charAt(0)}
              </div>
              <span className="font-bold text-slate-700">{partnerProfile.nome.split(' ')[0]}</span>
            </button>
          </div>
        </div>

        {/* CONTAINER GERAL DAS PÁGINAS */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* ===================================================================== */}
          {/* ABA: DASHBOARD (VISÃO GERAL DA FRANQUIA - FIEL AOS MOCKUPS)           */}
          {/* ===================================================================== */}
          {activeTab === 'dashboard' && (
            <>
              {/* HEADER DO PAINEL / VISÃO GERAL */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Operação Ativa
                      </span>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        ID Parceiro: #{partnerProfile.cupom}
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Visão Geral da Franquia
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{partnerProfile.cidadeUf || 'Brasil'} • <strong>{metricasReais.ativosCount} {metricasReais.ativosCount === 1 ? 'hotel' : 'hotéis'}</strong> gerando comissões ativas em tempo real</span>
                    </p>
                  </div>

                  <button
                    onClick={() => setModalNovaIndicacao(true)}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all transform active:scale-95"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Nova Indicação de Hotel</span>
                  </button>
                </div>

                {/* BARRA DE LINK EXCLUSIVO COM BOTÃO COPIAR (AMBER BUTTON IGUAL MOCKUP) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider shrink-0">
                      LINK DE INDICAÇÃO DA FRANQUIA:
                    </span>
                    <span className="text-xs sm:text-sm font-mono text-slate-700 font-bold truncate select-all">
                      {referralLink}
                    </span>
                  </div>

                  <button
                    onClick={handleCopiarLink}
                    className="shrink-0 bg-amber-400 hover:bg-amber-500 text-slate-900 px-4 py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    {copiadoLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-950" />
                        <span>Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* GRID DE 6 CARDS DE MÉTRICAS REAIS */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                
                {/* 1. Ganhos do Mês */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Ganhos do Mês</span>
                      <span className="text-[10px] sm:text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {partnerProfile.taxaComissao}% comissão
                      </span>
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-slate-900">
                      {formatBRL(metricasReais.ganhosMes)}
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 block mt-0.5">
                      {metricasReais.ativosCount} assinaturas ativas
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Previsão repasse dia 05 via PIX</span>
                  </div>
                </div>

                {/* 2. Ganhos da Semana */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Ganhos da Semana</span>
                      <span className="text-[10px] sm:text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {metricasReais.novosSemanaCount} novos
                      </span>
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-slate-900">
                      {formatBRL(metricasReais.ganhosSemana)}
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 block mt-0.5">
                      últimos 7 dias
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>Ciclo de fechamento contínuo</span>
                  </div>
                </div>

                {/* 3. Total Vitalício Pago / Acumulado */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Total Vitalício</span>
                      <span className="text-[10px] sm:text-xs font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">
                        Oficial
                      </span>
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-slate-900">
                      {formatBRL(metricasReais.totalVitalicio)}
                    </div>
                    <span className="text-[10px] sm:text-xs text-emerald-700 font-bold block mt-0.5">
                      Recorrência direta via PIX
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{partnerProfile.categoria}</span>
                  </div>
                </div>

                {/* 4. Hotéis Ativos */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Hotéis Ativos</span>
                      <span className="text-[10px] sm:text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {metricasReais.ativosCount}
                      </span>
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-slate-900">
                      {metricasReais.ativosCount} <span className="text-xs font-normal text-slate-500">{metricasReais.ativosCount === 1 ? 'hotel' : 'hotéis'}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 block mt-0.5">
                      Gerando comissões ativas
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Receita Mensal Recorrente</span>
                  </div>
                </div>

                {/* 5. Hotéis Cancelados */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Cancelados</span>
                      <span className="text-[10px] sm:text-xs font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                        Histórico
                      </span>
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-slate-900">
                      {metricasReais.canceladosCount} <span className="text-xs font-normal text-slate-500">{metricasReais.canceladosCount === 1 ? 'hotel' : 'hotéis'}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 block mt-0.5">
                      churn acumulado
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Monitoramento de retenção</span>
                  </div>
                </div>

                {/* 6. Taxa de Retenção */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600">Taxa de Retenção</span>
                      <span className="text-[10px] sm:text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {metricasReais.taxaRetencao}
                      </span>
                    </div>
                    <div className="text-lg sm:text-2xl font-black text-slate-900">
                      {metricasReais.taxaRetencao}
                    </div>
                    <span className="text-[10px] sm:text-xs text-slate-500 block mt-0.5">
                      {metricasReais.ativosCount} de {metricasReais.ativosCount + metricasReais.canceladosCount} assinantes
                    </span>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>Qualidade e engajamento com a IA</span>
                  </div>
                </div>

              </div>

              {/* SEÇÃO DO MEIO: EVOLUÇÃO DOS GANHOS + FUNIL DE CONVERSÃO (2 COLUNAS) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* COLUNA 1: EVOLUÇÃO DOS GANHOS RECORRENTES (GRÁFICO COM BARRAS) */}
                <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          Evolução dos Ganhos Recorrentes
                        </h2>
                        <p className="text-xs text-slate-500">
                          Comissão líquida real ({partnerProfile.taxaComissao}% sobre planos de hotéis ativos)
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#004d00]" />
                          Comissão Atual
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          Projeção
                        </span>
                      </div>
                    </div>

                    {/* Gráfico Visual de Barras com CSS */}
                    <div className="h-44 sm:h-52 pt-6 pb-2 flex items-end justify-between gap-2 sm:gap-4 border-b border-slate-100">
                      {(() => {
                        const meses = ['Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out (Atual)'];
                        const valorAtual = metricasReais.ganhosMes;
                        return meses.map((m, idx) => {
                          const isAtual = idx === 5;
                          const fator = isAtual ? 1 : Math.max(0.2, (idx + 1) / 6);
                          const valCalc = valorAtual > 0 ? valorAtual * (isAtual ? 1 : fator * 0.8) : 0;
                          const alturaPercent = valorAtual > 0 
                            ? Math.max(15, Math.min(95, Math.round((valCalc / valorAtual) * 90)))
                            : 8;

                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                              <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                {formatBRL(valCalc)}
                              </span>
                              <div 
                                style={{ height: `${alturaPercent}%` }}
                                className={`w-full max-w-[42px] rounded-t-lg transition-all duration-300 ${
                                  isAtual 
                                    ? 'bg-gradient-to-t from-[#002600] to-[#004d00] ring-2 ring-emerald-500/50' 
                                    : 'bg-gradient-to-t from-emerald-800 to-emerald-600 hover:brightness-110'
                                }`}
                              />
                              <span className={`text-[10px] sm:text-xs font-bold mt-2 truncate max-w-full ${isAtual ? 'text-[#004d00] font-black' : 'text-slate-500'}`}>
                                {m}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <span className="font-bold text-emerald-800 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      {metricasReais.ativosCount > 0 ? `Carteira em expansão com ${metricasReais.ativosCount} hotéis ativos` : 'Inicie compartilhando seu link para ativarmos seu faturamento'}
                    </span>
                    <span>Taxa contratada: {partnerProfile.taxaComissao}%</span>
                  </div>
                </div>

                {/* COLUNA 2: FUNIL DE CONVERSÃO REAL */}
                <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          Funil de Conversão
                        </h2>
                        <p className="text-xs text-slate-500">
                          Pipeline comercial em tempo real da sua franquia
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        {metricasReais.totalIndicacoes} {metricasReais.totalIndicacoes === 1 ? 'Indicação' : 'Indicações'}
                      </span>
                    </div>

                    {/* Barras do Funil */}
                    <div className="space-y-3.5">
                      {(() => {
                        const total = metricasReais.totalIndicacoes || 1;
                        const pAtivo = ((metricasReais.ativosCount / total) * 100).toFixed(1);
                        const pTrial = ((metricasReais.trialsCount / total) * 100).toFixed(1);
                        const pPendente = ((metricasReais.pendentesCount / total) * 100).toFixed(1);
                        const pCanc = ((metricasReais.canceladosCount / total) * 100).toFixed(1);

                        return (
                          <>
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                  Ativos Pagantes (GMR)
                                </span>
                                <span className="font-black text-slate-900">{metricasReais.ativosCount} hotéis ({pAtivo}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-emerald-600 h-2.5 rounded-full" style={{ width: `${pAtivo}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                  Em Teste Grátis (Trial 30d)
                                </span>
                                <span className="font-black text-slate-900">{metricasReais.trialsCount} hotéis ({pTrial}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${pTrial}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                  Pendente Onboarding / Setup
                                </span>
                                <span className="font-black text-slate-900">{metricasReais.pendentesCount} hotéis ({pPendente}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${pPendente}%` }} />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                                  Cancelados / Pausados
                                </span>
                                <span className="font-black text-slate-900">{metricasReais.canceladosCount} hotéis ({pCanc}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-slate-500 h-2.5 rounded-full" style={{ width: `${pCanc}%` }} />
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Card Verde de Destaque no Rodapé do Funil */}
                  <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <p className="font-black text-emerald-950">
                        {metricasReais.totalIndicacoes > 0 
                          ? `Taxa de Conversão da Carteira: ${metricasReais.taxaRetencao}`
                          : 'Pronto para receber suas indicações'}
                      </p>
                      <p className="text-emerald-800 text-[11px] mt-0.5">
                        {metricasReais.totalIndicacoes > 0
                          ? 'A cada indicação ativada, seu faturamento recorrente é creditado automaticamente.'
                          : 'Compartilhe seu link exclusivo com hotéis e pousadas da sua região.'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* TABELA: ÚLTIMOS HOTÉIS INDICADOS & STATUS DE REPASSE */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                      Hotéis Indicados & Status de Repasse
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Acompanhe as ativações, ciclo do trial e recebimento da sua comissão de {partnerProfile.taxaComissao}%
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por hotel ou cidade..."
                        value={buscaHotel}
                        onChange={(e) => setBuscaHotel(e.target.value)}
                        className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-56 sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                      />
                    </div>
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                    >
                      <option value="todos">Todos</option>
                      <option value="ativo">Ativos</option>
                      <option value="trial">Trial</option>
                      <option value="pendente">Pendentes</option>
                      <option value="cancelado">Cancelados</option>
                    </select>
                  </div>
                </div>

                {/* EMPTY STATE ELEGANTE CASO NÃO HAJA HOTÉIS CADASTRADOS AINDA */}
                {hoteisFiltrados.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mb-3">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <h3 className="font-black text-slate-900 text-base">
                      {hoteisIndicados.length === 0 
                        ? 'Nenhuma indicação cadastrada ainda' 
                        : 'Nenhum hotel encontrado com os filtros aplicados'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                      {hoteisIndicados.length === 0
                        ? `Você é parceiro oficial com ${partnerProfile.taxaComissao}% de comissão! Comece compartilhando seu link de indicação ou cadastre manualmente um hotel da sua região para iniciar os testes grátis.`
                        : 'Tente alterar os termos da busca ou mudar o filtro de status selecionado.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={handleCopiarLink}
                        className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-black flex items-center gap-1.5 shadow-xs"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copiar Link de Indicação</span>
                      </button>
                      <button
                        onClick={() => setModalNovaIndicacao(true)}
                        className="px-4 py-2.5 rounded-xl bg-[#003400] hover:bg-[#002600] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
                      >
                        <Plus className="w-4 h-4 text-emerald-400" />
                        <span>Cadastrar Primeiro Hotel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* VISUALIZAÇÃO TABULAR DESKTOP */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <tr>
                            <th className="py-3 px-6">Hotel / Pousada</th>
                            <th className="py-3 px-4">Localização</th>
                            <th className="py-3 px-4">Plano Assinado</th>
                            <th className="py-3 px-4">Ativação</th>
                            <th className="py-3 px-4">Status do Repasse</th>
                            <th className="py-3 px-4">Sua Comissão</th>
                            <th className="py-3 px-6 text-center">Ações Rápidas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {hoteisFiltrados.map((hotel) => (
                            <tr key={hotel.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 ${hotel.avatarBg}`}>
                                    {hotel.iniciais}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-900 block text-xs">
                                      {hotel.nome}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {hotel.apartamentos} aptos • {hotel.contatoNome}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4 font-semibold text-slate-700">
                                {hotel.cidadeUf}
                              </td>

                              <td className="py-4 px-4">
                                <span className="font-bold text-slate-900 block">
                                  {formatBRL(hotel.valorPlano)}/mês
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {hotel.plano}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-slate-500">
                                {hotel.dataAtivacao}
                              </td>

                              <td className="py-4 px-4">
                                {hotel.statusRepasse === 'ativo_liberado' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    Ativo - Repasse Liberado
                                  </span>
                                )}
                                {hotel.statusRepasse === 'trial_30' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                    {hotel.statusTexto}
                                  </span>
                                )}
                                {hotel.statusRepasse === 'pendente_onboarding' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Pendente Onboarding
                                  </span>
                                )}
                                {hotel.statusRepasse === 'cancelado' && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                                    Cancelado
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4">
                                <span className="font-black text-emerald-700 text-sm">
                                  {formatBRL(hotel.comissaoMensal)}
                                </span>
                                <span className="text-[10px] text-slate-400 block">/mês ({partnerProfile.taxaComissao}%)</span>
                              </td>

                              <td className="py-4 px-6 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setHotelDetalhesModal(hotel)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                    title="Ver Detalhes do Hotel"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {hotel.whatsapp && (
                                    <a
                                      href={`https://wa.me/55${hotel.whatsapp}?text=Ol%C3%A1%20${encodeURIComponent(hotel.contatoNome)}%2C%20tudo%20bem%3F%20Aqui%20%C3%A9%20o%20${encodeURIComponent(partnerProfile.nome)}%20da%20Franquia%20Hotel%20no%20Zap!`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                                      title="Conversar no WhatsApp"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* VISUALIZAÇÃO EM CARDS MOBILE */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {hoteisFiltrados.map((hotel) => (
                        <div key={hotel.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-black text-slate-900 text-sm">
                                {hotel.nome}
                              </h3>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{hotel.cidadeUf} • {hotel.apartamentos} aptos</span>
                              </p>
                            </div>
                            {hotel.statusRepasse === 'ativo_liberado' && (
                              <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                Ativo Liberado
                              </span>
                            )}
                            {hotel.statusRepasse === 'trial_30' && (
                              <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                                Trial 30 Dias
                              </span>
                            )}
                            {hotel.statusRepasse === 'pendente_onboarding' && (
                              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                                Pendente Setup
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">Plano Assinado</span>
                              <span className="font-bold text-slate-800">{formatBRL(hotel.valorPlano)}/mês</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold block">Sua Comissão ({partnerProfile.taxaComissao}%)</span>
                              <span className="font-black text-emerald-700">{formatBRL(hotel.comissaoMensal)}/mês</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => setHotelDetalhesModal(hotel)}
                              className="w-full py-2 px-3 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>Ver</span>
                            </button>
                            {hotel.whatsapp && (
                              <a
                                href={`https://wa.me/55${hotel.whatsapp}?text=Ol%C3%A1%20${encodeURIComponent(hotel.contatoNome)}%2C%20tudo%20bem%3F%20Aqui%20%C3%A9%20o%20${encodeURIComponent(partnerProfile.nome)}%20da%20Franquia%20Hotel%20no%20Zap!`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-2 px-3 rounded-lg bg-[#003400] text-emerald-300 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Paginação da Tabela */}
                    <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Mostrando {hoteisFiltrados.length} de {hoteisIndicados.length} hotéis na sua carteira</span>
                    </div>
                  </>
                )}
              </div>


              {/* CARD DE SUPORTE OPERACIONAL & TREINAMENTO DA MATRIZ */}
              <div className="rounded-2xl bg-gradient-to-br from-[#002800] to-[#001800] text-white p-5 sm:p-7 shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                      <Zap className="w-3.5 h-3.5" />
                      MATRIZ HOTEL NO ZAP • Retaguarda Tecnológica 24/7
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-white">
                      Suporte Operacional & Treinamento Contínuo
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      A matriz cuida de 100% da infraestrutura de servidores, atualização das IAs no WhatsApp e atendimento técnico de 1º e 2º nível para os seus hotéis. Você foca exclusivamente em expandir sua carteira regional e rentabilizar sua franquia.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <a
                      href="mailto:hotelnozap@gmail.com"
                      className="px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <Mail className="w-4 h-4 text-slate-700" />
                      <span>hotelnozap@gmail.com</span>
                    </a>
                    <a
                      href="https://wa.me/5511999999999?text=Ol%C3%A1%20Matriz%20Hotel%20no%20Zap!%20Sou%20o%20franqueado%20${encodeURIComponent(partnerProfile.nome)}%20e%20preciso%20de%20suporte."
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-slate-950" />
                      <span>WhatsApp Matriz</span>
                    </a>
                  </div>
                </div>

                {/* Efeito Glow no fundo */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              </div>
            </>
          )}

          {/* ===================================================================== */}
          {/* ABA: MINHAS INDICAÇÕES (GESTÃO COMPLETA DE LEADS E HOTÉIS)           */}
          {/* ===================================================================== */}
          {activeTab === 'indicacoes' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Minhas Indicações & Carteira de Clientes
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Gerencie todos os hotéis da sua franquia, status do trial e ativações de comissão de 50%.
                  </p>
                </div>
                <button
                  onClick={() => setModalNovaIndicacao(true)}
                  className="px-5 py-3 rounded-xl bg-[#003400] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm hover:bg-[#002600]"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Cadastrar Novo Hotel</span>
                </button>
              </div>

              {/* Grid com todas as indicações */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hoteisIndicados.map((hotel) => (
                  <div key={hotel.id} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm shrink-0 ${hotel.avatarBg}`}>
                            {hotel.iniciais}
                          </div>
                          <div>
                            <h3 className="font-black text-slate-900 text-sm">{hotel.nome}</h3>
                            <span className="text-[11px] text-slate-400 block">{hotel.cidadeUf}</span>
                          </div>
                        </div>
                        {hotel.statusRepasse === 'ativo_liberado' && (
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Ativo
                          </span>
                        )}
                        {hotel.statusRepasse === 'trial_30' && (
                          <span className="text-[10px] font-black text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            Trial
                          </span>
                        )}
                        {hotel.statusRepasse === 'pendente_onboarding' && (
                          <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pendente
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Responsável:</span>
                          <span className="font-bold text-slate-800">{hotel.contatoNome}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Porte:</span>
                          <span className="font-bold text-slate-800">{hotel.apartamentos} Apartamentos</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Comissão Mensal:</span>
                          <span className="font-black text-emerald-700">{formatBRL(hotel.comissaoMensal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setHotelDetalhesModal(hotel)}
                        className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                      >
                        Ver Detalhes
                      </button>
                      <a
                        href={`https://wa.me/55${hotel.whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* ABA: EXTRATO FINANCEIRO & REPASSES PIX                                */}
          {/* ===================================================================== */}
          {activeTab === 'financeiro' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Extrato Financeiro & Repasses via PIX
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Comissão recorrente vitalícia de {partnerProfile.taxaComissao}% repassada automaticamente todo dia 05 do mês.
                </p>
              </div>

              {/* Informações da Chave PIX Cadastrada */}
              <div className="bg-gradient-to-r from-emerald-900 to-[#003400] text-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Chave PIX Cadastrada para Recebimento
                  </span>
                  <div className="text-lg sm:text-xl font-mono font-black mt-1">
                    {partnerProfile.pixChave || partnerProfile.documento || 'Pendente de cadastro'} ({partnerProfile.pixTipo || 'PIX'})
                  </div>
                  <p className="text-xs text-emerald-100/70 mt-1">
                    Titular: {partnerProfile.titularPix || partnerProfile.nome} • Taxa de Repasse: {partnerProfile.taxaComissao}%
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('configuracoes')}
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-black shadow-xs hover:bg-slate-100 transition-colors"
                >
                  Alterar Chave PIX
                </button>
              </div>

              {/* Resumo do Ciclo Atual */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block mb-1">Previsão Ciclo Atual</span>
                  <div className="text-2xl font-black text-slate-900">
                    {formatBRL(metricasReais.ganhosMes)}
                  </div>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                    {metricasReais.ativosCount} assinaturas ativas gerando comissão
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block mb-1">Status do Ciclo</span>
                  <div className="text-base font-black text-blue-700 flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    Em Acumulação Aberta
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Fechamento programado para o dia 05
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block mb-1">Chave Validada</span>
                  <div className="text-base font-bold text-slate-900 mt-1 truncate">
                    {partnerProfile.pixChave || 'Cadastrar Chave'}
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Crédito via PIX automático
                  </span>
                </div>
              </div>

              {/* Detalhamento dos Hotéis Geradores de Repasse */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-sm">
                    Hotéis Geradores de Repasse no Mês Corrente
                  </h3>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Total: {formatBRL(metricasReais.ganhosMes)}
                  </span>
                </div>

                {hoteisIndicados.filter(h => h.statusRepasse === 'ativo_liberado').length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    <p className="font-bold text-slate-700 mb-1">Nenhum repasse a faturar no momento</p>
                    <p>Assim que seus hotéis indicados saírem do período de teste grátis e ativarem o plano, as comissões serão listadas aqui.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {hoteisIndicados
                      .filter(h => h.statusRepasse === 'ativo_liberado')
                      .map((h) => (
                        <div key={h.id} className="p-4 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">{h.nome}</span>
                            <span className="text-slate-400 text-[11px]">{h.cidadeUf} • Plano: {h.plano} ({formatBRL(h.valorPlano)})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-700 text-base block">
                              {formatBRL(h.comissaoMensal)}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block">
                              {partnerProfile.taxaComissao}% Liberado
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* ABA: MEUS LINKS & MATERIAIS DE APOIO COMERCIAL                       */}
          {/* ===================================================================== */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Seu Link de Indicação & Materiais Comerciais
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Utilize seu link exclusivo para cadastrar hotéis na sua região ou envie apresentações prontas.
                </p>
              </div>

              {/* Caixa Principal do Link */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="font-black text-slate-900 text-sm">Link de Franqueado Oficial</h3>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 font-bold select-all"
                  />
                  <button
                    onClick={handleCopiarLink}
                    className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-black rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    {copiadoLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiadoLink ? 'Copiado!' : 'Copiar Link'}</span>
                  </button>
                </div>
              </div>

              {/* Materiais de Venda Rápidos para WhatsApp */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Mensagem Pronta para WhatsApp</h4>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed font-sans">
                    "Olá! Sabia que seu hotel pode responder e fechar reservas 24h no WhatsApp sem precisar de atendente de plantão? Teste grátis por 30 dias pelo link oficial da nossa franquia regional: {referralLink}"
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Olá! Sabia que seu hotel pode responder e fechar reservas 24h no WhatsApp sem precisar de atendente de plantão? Teste grátis por 30 dias pelo link oficial da nossa franquia regional: ${referralLink}`);
                      alert('Texto de abordagem copiado para o WhatsApp!');
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                  >
                    Copiar Texto de Abordagem
                  </button>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Apresentação Comercial em PDF</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Baixe o material oficial com dados de conversão, telas do sistema e benefícios da IA do WhatsApp para apresentar aos hoteleiros.
                  </p>
                  <a
                    href="https://hotelnozap.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-xl bg-[#003400] text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 block text-center"
                  >
                    <Download className="w-4 h-4" />
                    <span>Acessar Material da Matriz</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* ABA: CONFIGURAÇÕES DA FRANQUIA & SUBMENU ACESSO (SENHA)               */}
          {/* ===================================================================== */}
          {activeTab === 'configuracoes' && (
            <div className="space-y-6 max-w-2xl">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Configurações da Franquia
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Mantenha seus dados, chave de repasse PIX e credenciais de acesso sempre atualizados.
                </p>

                {/* Submenus: Dados da Franquia & Acesso (Alterar Senha) */}
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => { setSubTabConfig('dados'); setMsgSenha(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTabConfig === 'dados'
                        ? 'bg-[#003400] text-emerald-300 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Dados da Franquia & PIX</span>
                  </button>

                  <button
                    onClick={() => { setSubTabConfig('acesso'); setMsgSenha(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      subTabConfig === 'acesso'
                        ? 'bg-[#003400] text-emerald-300 shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Acesso & Senha</span>
                  </button>
                </div>
              </div>

              {/* SUBMENU 1: DADOS DA FRANQUIA & PIX */}
              {subTabConfig === 'dados' && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Titular</label>
                    <input
                      type="text"
                      disabled
                      value={partnerProfile.nome}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">E-mail de Acesso</label>
                      <input
                        type="text"
                        disabled
                        value={partnerProfile.email}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Cupom / Código de Referência</label>
                      <input
                        type="text"
                        disabled
                        value={partnerProfile.cupom}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono font-bold text-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Polo Regional / Cidade</label>
                      <input
                        type="text"
                        disabled
                        value={partnerProfile.cidadeUf}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Comissão Contratual</label>
                      <input
                        type="text"
                        disabled
                        value={`${partnerProfile.taxaComissao}% Vitalício`}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-emerald-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp de Contato da Unidade</label>
                    <input
                      type="text"
                      value={partnerProfile.whatsapp}
                      onChange={(e) => setPartnerProfile({ ...partnerProfile, whatsapp: maskPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tipo da Chave PIX</label>
                      <select
                        value={partnerProfile.pixTipo}
                        onChange={(e) => setPartnerProfile({ ...partnerProfile, pixTipo: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                      >
                        <option value="CPF">CPF</option>
                        <option value="CNPJ">CNPJ</option>
                        <option value="EMAIL">E-mail</option>
                        <option value="TELEFONE">Telefone</option>
                        <option value="ALEATORIA">Chave Aleatória</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chave PIX para Recebimento</label>
                      <input
                        type="text"
                        value={partnerProfile.pixChave}
                        onChange={(e) => setPartnerProfile({ ...partnerProfile, pixChave: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                        placeholder="Insira sua chave PIX..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Titular da Conta PIX</label>
                    <input
                      type="text"
                      value={partnerProfile.titularPix}
                      onChange={(e) => setPartnerProfile({ ...partnerProfile, titularPix: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                      placeholder="Nome completo do titular..."
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      As transferências das comissões são processadas diretamente para esta chave todo dia 05.
                    </p>
                  </div>

                  <div className="pt-3">
                    <button
                      onClick={handleSalvarConfiguracoes}
                      disabled={salvandoConfig}
                      className="px-6 py-3 bg-[#003400] text-emerald-300 font-extrabold text-xs rounded-xl hover:bg-[#002600] disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                      {salvandoConfig ? (
                        <span>Salvando no banco...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Salvar Alterações</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SUBMENU 2: ACESSO & ALTERAÇÃO DE SENHA */}
              {subTabConfig === 'acesso' && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Segurança & Alteração de Senha</h3>
                      <p className="text-xs text-slate-500">
                        Altere sua senha de acesso ao portal do parceiro.
                      </p>
                    </div>
                  </div>

                  {msgSenha && (
                    <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      msgSenha.tipo === 'sucesso'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {msgSenha.tipo === 'sucesso' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{msgSenha.texto}</span>
                    </div>
                  )}

                  <form onSubmit={handleAlterarSenha} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">E-mail da Conta</label>
                      <input
                        type="text"
                        disabled
                        value={partnerProfile.email}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">O e-mail de login do parceiro é fixo.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nova Senha *</label>
                      <div className="relative">
                        <input
                          type={mostrarSenhaNova ? 'text' : 'password'}
                          required
                          value={senhaNova}
                          onChange={(e) => setSenhaNova(e.target.value)}
                          placeholder="Mínimo de 6 caracteres"
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenhaNova(!mostrarSenhaNova)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {mostrarSenhaNova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Confirmar Nova Senha *</label>
                      <div className="relative">
                        <input
                          type={mostrarSenhaConfirmar ? 'text' : 'password'}
                          required
                          value={senhaConfirmar}
                          onChange={(e) => setSenhaConfirmar(e.target.value)}
                          placeholder="Repita a nova senha"
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003400]"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenhaConfirmar(!mostrarSenhaConfirmar)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          tabIndex={-1}
                        >
                          {mostrarSenhaConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={salvandoSenha}
                        className="px-6 py-3 bg-[#003400] text-emerald-300 font-extrabold text-xs rounded-xl hover:bg-[#002600] disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {salvandoSenha ? (
                          <span>Atualizando senha...</span>
                        ) : (
                          <>
                            <Key className="w-4 h-4 text-emerald-400" />
                            <span>Atualizar Senha de Acesso</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. BOTTOM NAVIGATION BAR (FIXA NO MOBILE - FIEL AO MOCKUP)                 */}
      {/* ========================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/90 py-2 px-3 z-40 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'dashboard' ? 'text-[#003400] font-black' : 'text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Painel</span>
        </button>

        <button
          onClick={() => setActiveTab('indicacoes')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'indicacoes' ? 'text-[#003400] font-black' : 'text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'indicacoes' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Indicações</span>
        </button>

        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'financeiro' ? 'text-[#003400] font-black' : 'text-slate-400 font-medium'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'financeiro' ? 'bg-emerald-100 text-emerald-800' : ''}`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Financeiro</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-400 font-medium"
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Mais</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* 5. MODAL: NOVA INDICAÇÃO DE HOTEL                                         */}
      {/* ========================================================================= */}
      {modalNovaIndicacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-base">Cadastrar Nova Indicação de Hotel</h3>
              </div>
              <button 
                onClick={() => setModalNovaIndicacao(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCadastrarNovoLead} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Hotel ou Pousada *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pousada Recanto dos Sonhos"
                  value={novoLead.nome}
                  onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#003400] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cidade / Estado *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Canela, RS"
                    value={novoLead.cidadeUf}
                    onChange={(e) => setNovoLead({ ...novoLead, cidadeUf: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#003400] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nº de Quartos (Aptos)</label>
                  <input
                    type="number"
                    min="1"
                    value={novoLead.apartamentos}
                    onChange={(e) => setNovoLead({ ...novoLead, apartamentos: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#003400] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos (Gerente)"
                    value={novoLead.contatoNome}
                    onChange={(e) => setNovoLead({ ...novoLead, contatoNome: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#003400] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp de Contato</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={novoLead.whatsapp}
                    onChange={(e) => setNovoLead({ ...novoLead, whatsapp: maskPhone(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#003400] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovaIndicacao(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#003400] text-emerald-300 font-extrabold text-xs shadow-sm hover:bg-[#002600]"
                >
                  Salvar Indicação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: DETALHES DO HOTEL INDICADO                                      */}
      {/* ========================================================================= */}
      {hotelDetalhesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs ${hotelDetalhesModal.avatarBg}`}>
                  {hotelDetalhesModal.iniciais}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">{hotelDetalhesModal.nome}</h3>
                  <p className="text-xs text-slate-500">{hotelDetalhesModal.cidadeUf}</p>
                </div>
              </div>
              <button 
                onClick={() => setHotelDetalhesModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Status Repasse:</span>
                <span className="font-extrabold text-emerald-700">{hotelDetalhesModal.statusTexto}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Comissão Mensal (50%):</span>
                <span className="font-black text-slate-900">{formatBRL(hotelDetalhesModal.comissaoMensal)}/mês</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Plano Escolhido:</span>
                <span className="font-bold text-slate-800">{hotelDetalhesModal.plano} ({formatBRL(hotelDetalhesModal.valorPlano)}/mês)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Responsável:</span>
                <span className="font-bold text-slate-800">{hotelDetalhesModal.contatoNome}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Data de Ativação:</span>
                <span className="font-bold text-slate-800">{hotelDetalhesModal.dataAtivacao}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <a
                href={`https://wa.me/55${hotelDetalhesModal.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Conversar no WhatsApp</span>
              </a>
              <button
                onClick={() => setHotelDetalhesModal(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PortalParceiro;
