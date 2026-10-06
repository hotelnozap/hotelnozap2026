import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import MapaQuartos, { Room } from './components/MapaQuartos';
import CadastroQuarto, { EditingQuartoData } from './components/CadastroQuarto';
import ListagemItens from './components/ListagemItens';
import CadastroItem from './components/CadastroItem';
import ListagemCategorias from './components/ListagemCategorias';
import CadastroCategoriaitensquarto from './components/CadastroCategoriaitensquarto';
import ListagemHospedes from './components/ListagemHospedes';
import CadastroHospede from './components/CadastroHospede';
import { ListagemCupons } from './components/ListagemCupons';
import { CadastroCupom } from './components/CadastroCupom';
import { CupomDesconto } from './services/cuponsService';
import ListagemProdutos from './components/ListagemProdutos';
import { CadastroProduto } from './components/CadastroProduto';
import CategoriasProdutos from './components/CategoriasProdutos';
import EstoqueProdutos from './components/EstoqueProdutos';
import CadastroMovimentacaoEstoque from './components/CadastroMovimentacaoEstoque';
import CadastroCategoriaProduto from './components/CadastroCategoriaProduto';
import ListagemReservas from './components/ListagemReservas';
import CadastroReserva from './components/CadastroReserva';
import ListagemTiposQuartos from './components/ListagemTiposQuartos';
import CadastroTipoQuarto from './components/CadastroTipoQuarto';
import ControleCaixa from './components/ControleCaixa';
import ListagemContasPagar from './components/ListagemContasPagar';
import CategoriasContasPagar from './components/CategoriasContasPagar';
import CadastroCategoriaContaPagar from './components/CadastroCategoriaContaPagar';
import CadastroContaPagar from './components/CadastroContaPagar';
import ListagemContasReceber from './components/ListagemContasReceber';
import CategoriasContasReceber from './components/CategoriasContasReceber';
import CadastroCategoriaContaReceber from './components/CadastroCategoriaContaReceber';
import CadastroContaReceber from './components/CadastroContaReceber';
import ConexoesWhatsapp from './components/ConexoesWhatsapp';
import AdminConexoesWhatsapp from './components/AdminConexoesWhatsapp';
import { evolutionApiService } from './services/evolutionApiService';
import ListagemParceiros, { Partner } from './components/ListagemParceiros';
import CadastroParceiro from './components/CadastroParceiro';
import CadastroHoteis, { Hotel, INITIAL_HOTEIS } from './components/CadastroHoteis';
import { FormHotel } from './components/FormHotel';
import ListagemCategoriasHotel from './components/ListagemCategoriasHotel';
import CadastroCategoriaHotel from './components/CadastroCategoriaHotel';
import { GestaoCreditosSaaS } from './components/GestaoCreditosSaaS';
import { TelaPlanoExpirado } from './components/TelaPlanoExpirado';
import { creditosService } from './services/creditosService';
import { ConfiguracoesMercadoPago } from './components/ConfiguracoesMercadoPago';
import { ConfiguracoesHotel } from './components/ConfiguracoesHotel';
import RelatoriosHotel from './components/RelatoriosHotel';
import Tutoriais from './components/Tutoriais';
import ListagemUsuarios, { Usuario } from './components/ListagemUsuarios';
import FormUsuario from './components/FormUsuario';
import ListagemTiposUsuarios from './components/ListagemTiposUsuarios';
import FormTipoUsuario from './components/FormTipoUsuario';
import { TipoUsuarioDB } from './services/supabaseService';
import Login from './components/Login';
import CatalogoHoteis, { PublicHotel } from './components/CatalogoHoteis';
import PaginaHotel, { QuartoCadastrado, slugify } from './components/PaginaHotel';
import { DetalhesQuarto } from './components/DetalhesQuarto';
import CadastroDestaquesQuarto from './components/CadastroDestaquesQuarto';
import NotificationSystem from './components/NotificationSystem';
import ListagemPlanos, { Plano } from './components/ListagemPlanos';
import CadastroPlano from './components/CadastroPlano';
import AreaHospede from './components/AreaHospede';
import { HotelSelector } from './components/HotelSelector';
import { CategoriaQuartoData, CategoriaHotelData, RoomItemData, RoomTypeData, currentHotelService, hoteisService, parceirosService, planosService, HotelAtivo, reservasService, usuariosService } from './services/supabaseService';
import { AdminMasterDashboard } from './components/AdminMasterDashboard';
import { LandingPage } from './components/LandingPage';
import { PaginaEmConstrucao } from './components/PaginaEmConstrucao';
import ReceitaRepasses from './components/ReceitaRepasses';
import { ParametrosSistema } from './components/ParametrosSistema';
import LpNovoHotel from './components/LpNovoHotel';
import LpAssinar from './components/LpAssinar';
import PainelCamareira from './components/PainelCamareira';
import CardapioHotel from './components/CardapioHotel';
import { GestaoPedidosCardapio } from './components/GestaoPedidosCardapio';
import { PaginaInstitucional } from './components/PaginaInstitucional';
import { ListagemStatusQuartos } from './components/ListagemStatusQuartos';
import { LogsSistema } from './components/LogsSistema';
import { NotificacoesPushAdmin } from './components/NotificacoesPushAdmin';
import { LandingPageParceiros } from './components/LandingPageParceiros';
import { CheckoutParceiro } from './components/CheckoutParceiro';
import { PortalParceiro } from './components/PortalParceiro';
import { supabase } from './lib/supabase';
import { whatsappAutoResponderService } from './services/whatsappAutoResponderService';

const checkIsAssinarUrl = (pathname: string, search: string, hash: string): boolean => {
  const parts = (pathname || '').toLowerCase().replace(/\\/g, '/').split('/').filter(Boolean);
  const hashClean = (hash || '').toLowerCase().replace(/^#\/?/, '');
  const hashParts = hashClean.split('?')[0].split('/').filter(Boolean);

  // A rota /parceiros pura é a Landing Page institucional de Franqueados (não o checkout)
  if (parts[0] === 'parceiros' && parts.length === 1) return false;
  if (hashParts[0] === 'parceiros' && hashParts.length === 1) return false;
  
  const isAssinarPath = 
    parts[0] === 'assinar' || 
    (parts[0] === 'parceiros' && parts[1] === 'assinar') ||
    hashParts[0] === 'assinar' ||
    (hashParts[0] === 'parceiros' && hashParts[1] === 'assinar');

  if (isAssinarPath) return true;

  try {
    const sParams = new URLSearchParams(search || '');
    const hasSearchRef = sParams.has('ref') || sParams.has('cupom') || sParams.has('coupon');
    if (hasSearchRef && (parts[0] === 'assinar' || (parts[0] === 'parceiros' && parts[1] === 'assinar'))) return true;

    if (hash && hash.includes('?')) {
      const hParams = new URLSearchParams(hash.split('?')[1]);
      const hasHashRef = hParams.has('ref') || hParams.has('cupom') || hParams.has('coupon');
      if (hasHashRef && (hashParts[0] === 'assinar' || (hashParts[0] === 'parceiros' && hashParts[1] === 'assinar'))) return true;
    }
  } catch { /* ignore */ }

  return false;
};

const isAppDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'app.hotelnozap.com.br' || host.startsWith('app.');
};

const isLpDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'lp.hotelnozap.com.br' || host.startsWith('lp.');
};

const isParceirosDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'parceiros.hotelnozap.com.br' || host.startsWith('parceiros.');
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      if (checkIsAssinarUrl(window.location.pathname, window.location.search, window.location.hash)) {
        if (typeof window !== 'undefined' && window.location.pathname === '/assinar') {
          window.history.replaceState({}, '', `/parceiros/assinar${window.location.search}${window.location.hash}`);
        }
        return 'assinar';
      }
      const parts = window.location.pathname.toLowerCase().split('/').filter(Boolean);

      // Redirecionamento client-side: /lp no domínio principal redireciona para lp.hotelnozap.com.br
      if (typeof window !== 'undefined') {
        const host = window.location.hostname.toLowerCase();
        const isMainDomain = host === 'hotelnozap.com.br' || host === 'www.hotelnozap.com.br';
        if (isMainDomain && parts[0] === 'lp') {
          const rest = parts.slice(1).join('/');
          const targetUrl = `https://lp.hotelnozap.com.br${rest ? '/' + rest : ''}${window.location.search}${window.location.hash}`;
          window.location.replace(targetUrl);
          return 'landingpage';
        }

        // Redirecionamento client-side: /parceiros puro no domínio principal redireciona para parceiros.hotelnozap.com.br
        if (isMainDomain && parts[0] === 'parceiros' && parts[1] !== 'assinar') {
          const rest = parts.slice(1).join('/');
          const targetUrl = `https://parceiros.hotelnozap.com.br${rest ? '/' + rest : ''}${window.location.search}${window.location.hash}`;
          window.location.replace(targetUrl);
          return 'landingpage-parceiros';
        }
      }

      if (parts[0] === 'privacidade') return 'privacidade';
      if (parts[0] === 'termos') return 'termos';
      if (parts[0] === 'empresa' || parts[0] === 'informacoes-empresa') return 'informacoes-empresa';
      if (parts[0] === 'quem-somos' || parts[0] === 'quemsomos') return 'quem-somos';
      if (parts[0] === 'fale-conosco' || parts[0] === 'faleconosco' || parts[0] === 'contato') return 'fale-conosco';
      if (parts[0] === 'camareira') return 'camareira';
      if (parts[0] === 'lpnovohotel' || (parts[0] === 'lp' && parts[1] === 'lpnovohotel')) return 'lp-novo-hotel';
      if (parts[0] === 'lp' || parts[0] === 'landingpage') return 'landingpage';
      if (parts[0] === 'checkout' || (parts[0] === 'parceiros' && parts[1] === 'checkout') || (parts[0] === 'parceiro' && parts[1] === 'checkout')) return 'checkout-parceiro';
      if (parts[0] === 'parceiros' && parts[1] !== 'assinar') return 'landingpage-parceiros';
      if (parts[0] === 'parceiro' || parts[0] === 'franquia') return 'landingpage-parceiros';
      if (parts[0] === 'assinar' || (parts[0] === 'parceiros' && parts[1] === 'assinar')) {
        if (typeof window !== 'undefined' && window.location.pathname === '/assinar') {
          window.history.replaceState({}, '', `/parceiros/assinar${window.location.search}${window.location.hash}`);
        }
        return 'assinar';
      }
      if (parts[0] === 'minhaconta') {
        const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
        const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
        const roleLower = savedRole.toLowerCase();
        if (roleLower.includes('hospede') || roleLower.includes('hóspede') || !savedRole) {
          return 'minhaconta';
        }
        return (savedRole && savedEmail) ? 'perfil' : 'minhaconta';
      }
      // Rota raiz /:
      if (parts.length === 0) {
        if (isParceirosDomain()) {
          return 'landingpage-parceiros';
        }
        if (isLpDomain()) {
          return 'landingpage';
        }
        if (isAppDomain()) {
          const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
          const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
          if (savedRole && savedEmail) {
            const roleLower = savedRole.toLowerCase();
            if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) return 'portal-parceiro';
            if (roleLower.includes('camareira') || roleLower.includes('governanca')) return 'camareira';
            const isAdm = roleLower.includes('admin') || roleLower.includes('super');
            return isAdm ? 'admin-dashboard' : 'dashboard';
          }
          return 'login';
        }
        return 'catalogo-hoteis';
      }
      if (parts[0] === 'hoteis') {
        if (parts[1] === 'cardapio') return 'cardapio-hotel';
        return parts.length >= 2 ? 'pagina-hotel' : 'catalogo-hoteis';
      }
      if (parts[0] === 'hotel') return parts.length >= 3 ? 'detalhes-quarto' : 'pagina-hotel';
      // /paineladmin → login (ou dashboard se já autenticado, ou /minhaconta se for hóspede, ou /camareira se for camareira)
      if (parts[0] === 'paineladmin') {
        const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
        const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
        if (savedRole && savedEmail) {
          const roleLower = savedRole.toLowerCase();
          if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) {
            return 'portal-parceiro';
          }
          if (roleLower.includes('hospede') || roleLower.includes('hóspede')) {
            window.history.replaceState({}, '', '/minhaconta');
            return 'minhaconta';
          }
          if (roleLower.includes('camareira') || roleLower.includes('governanca')) {
            window.history.replaceState({}, '', '/camareira');
            return 'camareira';
          }
          const isAdm = savedRole.toLowerCase().includes('admin') || savedRole.toLowerCase().includes('super');
          return isAdm ? 'admin-dashboard' : 'dashboard';
        }
        return 'login';
      }
    } catch { /* ignore */ }
    try {
      const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
      const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
      if (savedRole && savedEmail) {
        const roleLower = savedRole.toLowerCase();
        if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) return 'portal-parceiro';
        if (roleLower.includes('camareira') || roleLower.includes('governanca')) return 'camareira';
        const isAdm = roleLower.includes('admin') || roleLower.includes('super');
        return isAdm ? 'admin-dashboard' : 'dashboard';
      }
    } catch { /* ignore */ }
    return 'login';
  });
  const [restoringSession, setRestoringSession] = useState<boolean>(true);
  const [selectedHotelForPage, setSelectedHotelForPage] = useState<PublicHotel | null>(null);
  const [selectedQuartoForPage, setSelectedQuartoForPage] = useState<QuartoCadastrado | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      if (checkIsAssinarUrl(window.location.pathname, window.location.search, window.location.hash)) {
        if (typeof window !== 'undefined' && window.location.pathname === '/assinar') {
          window.history.replaceState({}, '', `/parceiros/assinar${window.location.search}${window.location.hash}`);
        }
        setActiveTab('assinar');
        return;
      }
      const parts = window.location.pathname.toLowerCase().split('/').filter(Boolean);
      if (parts[0] === 'privacidade') {
        setActiveTab('privacidade');
      } else if (parts[0] === 'termos') {
        setActiveTab('termos');
      } else if (parts[0] === 'empresa' || parts[0] === 'informacoes-empresa') {
        setActiveTab('informacoes-empresa');
      } else if (parts[0] === 'quem-somos' || parts[0] === 'quemsomos') {
        setActiveTab('quem-somos');
      } else if (parts[0] === 'fale-conosco' || parts[0] === 'faleconosco' || parts[0] === 'contato') {
        setActiveTab('fale-conosco');
      } else if (parts[0] === 'camareira') {
        setActiveTab('camareira');
      } else if (parts[0] === 'lp' && parts[1] === 'lpnovohotel') {
        setActiveTab('lp-novo-hotel');
      } else if (parts[0] === 'lp' || parts[0] === 'landingpage') {
        setActiveTab('landingpage');
      } else if (parts[0] === 'checkout' || (parts[0] === 'parceiros' && parts[1] === 'checkout') || (parts[0] === 'parceiro' && parts[1] === 'checkout')) {
        setActiveTab('checkout-parceiro');
      } else if (parts[0] === 'parceiros' && parts[1] !== 'assinar') {
        setActiveTab('landingpage-parceiros');
      } else if (parts[0] === 'parceiro' || parts[0] === 'franquia') {
        setActiveTab('landingpage-parceiros');
      } else if (parts[0] === 'assinar' || (parts[0] === 'parceiros' && parts[1] === 'assinar')) {
        if (typeof window !== 'undefined' && window.location.pathname === '/assinar') {
          window.history.replaceState({}, '', `/parceiros/assinar${window.location.search}${window.location.hash}`);
        }
        setActiveTab('assinar');
      } else if (parts[0] === 'paineladmin') {
        const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
        const roleLower = savedRole.toLowerCase();
        if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) {
          setActiveTab('portal-parceiro');
        } else if (roleLower.includes('hospede') || roleLower.includes('hóspede')) {
          window.history.replaceState({}, '', '/minhaconta');
          setActiveTab('minhaconta');
        } else {
          setActiveTab('login');
        }
      } else if (parts[0] === 'minhaconta') {
        const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
        const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
        const roleLower = savedRole.toLowerCase();
        if (roleLower.includes('hospede') || roleLower.includes('hóspede') || !savedRole) {
          setActiveTab('minhaconta');
        } else {
          setActiveTab((savedRole && savedEmail) ? 'perfil' : 'minhaconta');
        }
      } else if (parts.length === 0) {
        if (isParceirosDomain()) {
          setActiveTab('landingpage-parceiros');
        } else if (isLpDomain()) {
          setActiveTab('landingpage');
        } else if (isAppDomain()) {
          const savedRole = localStorage.getItem('hotelnozap_user_role') || '';
          const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
          if (savedRole && savedEmail) {
            const roleLower = savedRole.toLowerCase();
            if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) {
              setActiveTab('portal-parceiro');
            } else if (roleLower.includes('camareira') || roleLower.includes('governanca')) {
              setActiveTab('camareira');
            } else {
              const isAdm = roleLower.includes('admin') || roleLower.includes('super');
              setActiveTab(isAdm ? 'admin-dashboard' : 'dashboard');
            }
          } else {
            setActiveTab('login');
          }
        } else {
          setActiveTab('catalogo-hoteis');
        }
      } else if (parts[0] === 'hoteis') {
        if (parts[1] === 'cardapio') {
          setActiveTab('cardapio-hotel');
        } else if (parts.length >= 2) {
          setActiveTab('pagina-hotel');
        } else {
          setActiveTab('catalogo-hoteis');
        }
      } else if (parts[0] === 'hotel') {
        if (parts.length >= 2 && Boolean(parts[2])) {
          setActiveTab('detalhes-quarto');
        } else {
          setActiveTab('pagina-hotel');
        }
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // ── Atualização Dinâmica do Título da Aba do Navegador ──
  useEffect(() => {
    switch (activeTab) {
      case 'catalogo-hoteis':
        document.title = 'Sistema de Gestão Hoteleira';
        break;
      case 'login':
        document.title = 'Painel Administrativo';
        break;
      case 'minhaconta':
      case 'perfil':
      case 'historico-pedidos-hospede':
      case 'minhas-reservas-hospede':
      case 'area-hospede':
        document.title = 'Minha Conta';
        break;
      case 'camareira':
        document.title = 'Minha Conta';
        break;
      case 'quem-somos':
        document.title = 'Quem Somos';
        break;
      case 'fale-conosco':
        document.title = 'Fale Conosco';
        break;
      case 'privacidade':
        document.title = 'Política de Privacidade';
        break;
      case 'termos':
        document.title = 'Termos de Uso';
        break;
      case 'informacoes-empresa':
        document.title = 'Informações da Empresa';
        break;
      case 'landingpage':
        document.title = 'Hotel no Zap - Sistema de Gestão Hoteleira';
        break;
      case 'landingpage-parceiros':
        document.title = 'Hotel no Zap - Franquia e Licenciamento';
        break;
      case 'checkout-parceiro':
        document.title = 'Checkout Oficial - Franquia Hotel no Zap';
        break;
      case 'portal-parceiro':
        document.title = 'Portal do Parceiro - Hotel no Zap';
        break;
      case 'lp-novo-hotel':
        document.title = 'Cadastre seu Hotel';
        break;
      case 'assinar':
        document.title = 'Planos e Assinatura';
        break;
      case 'pagina-hotel':
      case 'detalhes-quarto':
        // PaginaHotel e DetalhesQuarto definem seus próprios títulos com o nome do hotel
        break;
      default:
        // Qualquer aba da área administrativa (dashboard, hoteis, parceiros, etc.)
        document.title = 'Painel Administrativo';
        break;
    }
  }, [activeTab]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProdutosSubmenuOpen, setIsProdutosSubmenuOpen] = useState(false);
  const [isConfigSubmenuOpen, setIsConfigSubmenuOpen] = useState(false);
  const [isAdminConfigSubmenuOpen, setIsAdminConfigSubmenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [partnerToEdit, setPartnerToEdit] = useState<Partner | null>(null);
  const [preselectedPartner, setPreselectedPartner] = useState<Partner | null>(null);
  const [hotelToEdit, setHotelToEdit] = useState<Hotel | null>(null);
  const [userToEdit, setUserToEdit] = useState<Usuario | null>(null);
  const [tipoUsuarioToEdit, setTipoUsuarioToEdit] = useState<TipoUsuarioDB | null>(null);
  const [categoriaToEdit, setCategoriaToEdit] = useState<CategoriaQuartoData | null>(null);
  const [categoriaHotelToEdit, setCategoriaHotelToEdit] = useState<CategoriaHotelData | null>(null);
  const [itemToEdit, setItemToEdit] = useState<RoomItemData | null>(null);
  const [tipoQuartoToEdit, setTipoQuartoToEdit] = useState<RoomTypeData | null>(null);
  const [planToEdit, setPlanToEdit] = useState<Plano | null>(null);
  const [quartoToEdit, setQuartoToEdit] = useState<EditingQuartoData | null>(null);
  const [cupomToEdit, setCupomToEdit] = useState<CupomDesconto | null>(null);
  const [activeHotel, setActiveHotel] = useState<HotelAtivo>(() => currentHotelService.getCurrentHotel());
  const [globalWhatsappCount, setGlobalWhatsappCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('hotelnozap_admin_wa_count');
      return saved ? parseInt(saved, 10) : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    whatsappAutoResponderService.start();
    return () => {
      whatsappAutoResponderService.stop();
    };
  }, []);

  useEffect(() => {
    evolutionApiService.fetchInstances().then((list) => {
      if (list && Array.isArray(list)) {
        setGlobalWhatsappCount(list.length);
        localStorage.setItem('hotelnozap_admin_wa_count', String(list.length));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const syncActiveHotel = async () => {
      try {
        const current = currentHotelService.getCurrentHotel();
        const dbHoteis = await hoteisService.getHoteis();
        if (dbHoteis && dbHoteis.length > 0) {
          const matched = dbHoteis.find(h => h.id === current.id) || dbHoteis[0];
          if (matched) {
            const freshActive: HotelAtivo = {
              id: matched.id,
              name: matched.name,
              category: matched.category,
              cityUf: matched.cityUf,
              cnpj: matched.cnpj,
              status: matched.status,
              imageUrl: matched.imageUrl,
              plan: matched.plan,
              managerName: matched.managerName,
              managerEmail: matched.managerEmail,
              managerPhone: matched.managerPhone,
              managerCpf: matched.managerCpf,
              loginEmail: matched.loginEmail,
              whatsapp: matched.whatsapp,
              notes: (matched as any).notes || (matched as any).observacoes,
              isImportedFromGoogle: (matched as any).isImportedFromGoogle
            };
            currentHotelService.setCurrentHotel(freshActive);
            setActiveHotel(freshActive);
            return;
          }
        }
        setActiveHotel(current);
      } catch {
        setActiveHotel(currentHotelService.getCurrentHotel());
      }
    };

    syncActiveHotel();

    const handleHotelChanged = (e: any) => {
      const nextH = e.detail || currentHotelService.getCurrentHotel();
      setActiveHotel(prev => {
        if (prev?.id === nextH?.id && prev?.name === nextH?.name) {
          return prev;
        }
        return nextH;
      });
    };

    const handleCreditosChanged = () => {
      syncActiveHotel();
    };

    window.addEventListener('hotel_changed', handleHotelChanged);
    window.addEventListener('hotel_novo_hotel', syncActiveHotel);
    window.addEventListener('hotel_creditos_changed', handleCreditosChanged);

    return () => {
      window.removeEventListener('hotel_changed', handleHotelChanged);
      window.removeEventListener('hotel_novo_hotel', syncActiveHotel);
      window.removeEventListener('hotel_creditos_changed', handleCreditosChanged);
    };
  }, []);

  const hotelNomeFantasia = activeHotel?.name || 'Hotel no Zap';
  const hotelSubtitle = activeHotel?.cityUf 
    ? activeHotel.cityUf 
    : (hotelNomeFantasia.toLowerCase() === 'hotel no zap' ? 'Hotel Ativo' : 'Hotel no Zap');

  const [currentUserRole, setCurrentUserRole] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('hotelnozap_user_role');
      if (saved) return saved;
    } catch { /* ignore */ }
    return '';
  });

  useEffect(() => {
    const handleRoleChanged = (e: any) => {
      if (e.detail) {
        setCurrentUserRole(e.detail);
      } else {
        const saved = localStorage.getItem('hotelnozap_user_role');
        if (saved) setCurrentUserRole(saved);
      }
    };
    window.addEventListener('user_role_changed', handleRoleChanged);
    return () => window.removeEventListener('user_role_changed', handleRoleChanged);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch { /* ignore */ }
    try {
      localStorage.removeItem('hotelnozap_user_role');
      localStorage.removeItem('hotelnozap_user_email');
      localStorage.removeItem('hotelnozap_user_name');
      localStorage.removeItem('hotelnozap_hotel_atual');
      localStorage.removeItem('hotelnozap_last_authenticated_at');
    } catch { /* ignore */ }
    setCurrentUserRole('');
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    window.history.pushState({}, '', isAppDomain() ? '/' : '/paineladmin');
    setActiveTab('login');
  };

  // ================================================================
  //  MANTÉM SESSÃO APÓS F5 / HOT RELOAD / NOVAS ABAS
  //  1. Restaura sessão do Supabase Auth no boot do SPA
  //  2. Restaura os dados complementares (perfil nome/role) do DB
  //  3. Ouve mudanças de sessão globalmente (refresh / logout remoto)
  //  4. Só vai para o Login quando NÃO houver sessão em lugar nenhum
  // ================================================================
  useEffect(() => {
    let disposed = false;

    const restaurarDadosUsuario = async (authUser: any) => {
      const authEmail = (authUser?.email || '').trim().toLowerCase();
      if (!authEmail) return;
      try {
        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('id, nome, email, perfil, status, cargo, hotel_id, url_avatar')
          .ilike('email', authEmail)
          .maybeSingle();
        let role = (dbUser?.perfil || 'Hotel').trim();
        if (!role || role.toLowerCase() === 'hotel') {
          try {
            const { data: pData } = await supabase
              .from('parceiros')
              .select('id')
              .ilike('email', authEmail)
              .maybeSingle();
            if (pData) {
              role = 'Parceiro';
            }
          } catch {}
        }
        const name = (dbUser?.nome || authEmail.split('@')[0] || 'Usuário').trim();
        localStorage.setItem('hotelnozap_user_role', role);
        localStorage.setItem('hotelnozap_user_email', authEmail);
        localStorage.setItem('hotelnozap_user_name', name);
        if (dbUser?.cargo) localStorage.setItem('hotelnozap_user_cargo', dbUser.cargo);
        localStorage.setItem('hotelnozap_last_authenticated_at', new Date().toISOString());
        usuariosService.registrarUltimoAcesso(authEmail);
        if (!disposed) {
          setCurrentUserRole(role);
          window.dispatchEvent(new CustomEvent('user_role_changed', { detail: role }));
        }

        // Se o usuário possui um hotel_id vinculado, sincroniza imediatamente com este hotel
        if (dbUser?.hotel_id) {
          const { data: hotelData } = await supabase
            .from('hoteis')
            .select('*')
            .eq('id', dbUser.hotel_id)
            .maybeSingle();
          if (hotelData && !disposed) {
            const freshActive: HotelAtivo = {
              id: hotelData.id,
              name: hotelData.nome || hotelData.name || 'Hotel',
              category: hotelData.categoria || hotelData.category || 'Hotel',
              cityUf: hotelData.cidade_uf || hotelData.cityUf || `${hotelData.cidade || ''} - ${hotelData.uf || ''}`.trim(),
              cnpj: hotelData.cnpj,
              status: hotelData.status,
              imageUrl: hotelData.url_imagem || hotelData.imageUrl
            };
            currentHotelService.setCurrentHotel(freshActive);
            setActiveHotel(freshActive);
            localStorage.setItem('hotelnozap_hotel_atual', JSON.stringify({ id: hotelData.id, name: freshActive.name }));
          }
        }
      } catch (err) {
        console.warn('Erro ao restaurar dados do usuário:', err);
      }
    };

    const definirAbaInicialAutenticada = () => {
      if (disposed) return;
      const role = localStorage.getItem('hotelnozap_user_role') || '';
      const email = localStorage.getItem('hotelnozap_user_email') || '';
      if (!role || !email) return;
      const roleLower = role.toLowerCase();

      // Checa se a URL atual já é uma página pública (hotel, catálogo, cardápio, quartos, landing page, etc.)
      const currentParts = window.location.pathname.toLowerCase().split('/').filter(Boolean);
      const isPublicOrHotelRoute =
        currentParts[0] === 'hoteis' ||
        currentParts[0] === 'hotel' ||
        currentParts[0] === 'catalogo-hoteis' ||
        currentParts[0] === 'cardapio' ||
        currentParts[0] === 'lp' ||
        currentParts[0] === 'assinar' ||
        (currentParts[0] === 'parceiros' && currentParts[1] === 'assinar') ||
        currentParts[0] === 'privacidade' ||
        currentParts[0] === 'termos' ||
        currentParts[0] === 'empresa' ||
        currentParts[0] === 'informacoes-empresa' ||
        currentParts[0] === 'quem-somos' ||
        currentParts[0] === 'quemsomos' ||
        currentParts[0] === 'fale-conosco' ||
        currentParts[0] === 'faleconosco' ||
        currentParts[0] === 'contato';

      if (roleLower.includes('hospede') || roleLower.includes('hóspede')) {
        // Se o hóspede estiver navegando em uma página de hotel ou rota pública, NÃO sobrescrever a rota!
        if (isPublicOrHotelRoute) {
          return;
        }
        window.history.replaceState({}, '', '/minhaconta');
        setActiveTab('minhaconta');
        return;
      }
      if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) {
        if (isPublicOrHotelRoute) return;
        setActiveTab('portal-parceiro');
        return;
      }
      if (roleLower.includes('camareira') || roleLower.includes('governanca')) {
        if (isPublicOrHotelRoute) return;
        window.history.replaceState({}, '', '/camareira');
        setActiveTab('camareira');
        return;
      }
      const isAdm = roleLower.includes('admin') ||
                    roleLower.includes('super') ||
                    roleLower.includes('master');
      setActiveTab(prev => {
        if (prev === 'login') return isAdm ? 'admin-dashboard' : 'dashboard';
        return prev;
      });
    };

    const boot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await restaurarDadosUsuario(session.user);
          definirAbaInicialAutenticada();
        } else {
          const savedRole  = localStorage.getItem('hotelnozap_user_role')  || '';
          const savedEmail = localStorage.getItem('hotelnozap_user_email') || '';
          const lastAuth   = localStorage.getItem('hotelnozap_last_authenticated_at') || '';
          let menosDe24h = false;
          try {
            if (lastAuth) {
              const diffMs = Date.now() - new Date(lastAuth).getTime();
              menosDe24h = diffMs < 24 * 60 * 60 * 1000;
            }
          } catch { /* ignore */ }
          if (savedRole && savedEmail && menosDe24h) {
            usuariosService.registrarUltimoAcesso(savedEmail);
            setCurrentUserRole(savedRole);
            window.dispatchEvent(new CustomEvent('user_role_changed', { detail: savedRole }));
            definirAbaInicialAutenticada();
          } else {
            setActiveTab(prev => {
              if (isAppDomain() && (prev === 'catalogo-hoteis' || !prev)) {
                return 'login';
              }
              return (prev === 'login' || prev === 'landingpage' || prev === 'landingpage-parceiros' || prev === 'portal-parceiro' || prev === 'checkout-parceiro' || prev === 'assinar' || prev === 'lp-novo-hotel' || prev === 'minhaconta' || prev === 'catalogo-hoteis' || prev === 'pagina-hotel' || prev === 'detalhes-quarto') ? prev : 'login';
            });
          }
        }
      } catch (bootErr) {
        console.warn('Erro ao restaurar sessão no boot:', bootErr);
      } finally {
        if (!disposed) setRestoringSession(false);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem('hotelnozap_user_role');
          localStorage.removeItem('hotelnozap_user_email');
          localStorage.removeItem('hotelnozap_user_name');
          localStorage.removeItem('hotelnozap_hotel_atual');
          localStorage.removeItem('hotelnozap_last_authenticated_at');
        } catch { /* ignore */ }
        if (!disposed) {
          setCurrentUserRole('');
          setActiveTab('login');
        }
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          restaurarDadosUsuario(session.user).then(definirAbaInicialAutenticada);
        }
      }
    });

    boot();

    return () => {
      disposed = true;
      try { listener?.subscription.unsubscribe(); } catch { /* ignore */ }
    };
  }, []);

  const isHotelUser = currentUserRole.toLowerCase().includes('hotel') || 
    (!currentUserRole.toLowerCase().includes('admin') && 
     !currentUserRole.toLowerCase().includes('super') && 
     !currentUserRole.toLowerCase().includes('administrador') &&
     !currentUserRole.toLowerCase().includes('parceiro') &&
     !currentUserRole.toLowerCase().includes('franqueado') &&
     !currentUserRole.toLowerCase().includes('camareira') &&
     !currentUserRole.toLowerCase().includes('hospede'));



  // Contagens consolidadas para a Sidebar do Super Admin Master
  const [adminCounts, setAdminCounts] = useState({
    hoteis: 0,
    parceiros: 0,
    planos: 0
  });

  useEffect(() => {
    if (isHotelUser) return;
    let isMounted = true;
    const loadAdminCounts = async () => {
      try {
        const [hList, pList, plList] = await Promise.all([
          hoteisService.getHoteis().catch(() => []),
          parceirosService.getParceiros().catch(() => []),
          planosService.getPlanos().catch(() => [])
        ]);
        if (isMounted) {
          setAdminCounts({
            hoteis: Array.isArray(hList) ? hList.length : 0,
            parceiros: Array.isArray(pList) ? pList.length : 0,
            planos: Array.isArray(plList) ? plList.length : 0
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar contagens administrativas:', err);
      }
    };
    loadAdminCounts();

    const handleUpdate = () => loadAdminCounts();
    window.addEventListener('hotel_novo_hotel', handleUpdate);
    window.addEventListener('hotel_modificado', handleUpdate);
    window.addEventListener('hotel_deletado', handleUpdate);
    window.addEventListener('hotel_novo_parceiro', handleUpdate);
    window.addEventListener('hotel_parceiro_modificado', handleUpdate);
    window.addEventListener('hotel_parceiro_deletado', handleUpdate);

    return () => { 
      isMounted = false; 
      window.removeEventListener('hotel_novo_hotel', handleUpdate);
      window.removeEventListener('hotel_modificado', handleUpdate);
      window.removeEventListener('hotel_deletado', handleUpdate);
      window.removeEventListener('hotel_novo_parceiro', handleUpdate);
      window.removeEventListener('hotel_parceiro_modificado', handleUpdate);
      window.removeEventListener('hotel_parceiro_deletado', handleUpdate);
    };
  }, [isHotelUser, activeTab]);

  const mainContentRef = useRef<HTMLDivElement>(null);
  const userMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [currentDateTime, setCurrentDateTime] = useState<string>(() => {
    const now = new Date();
    const dia = now.getDate();
    const mes = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
    const horas = String(now.getHours()).padStart(2, '0');
    const minutos = String(now.getMinutes()).padStart(2, '0');
    return `${dia} de ${mesCap}, ${horas}:${minutos}`;
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dia = now.getDate();
      const mes = now.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
      const horas = String(now.getHours()).padStart(2, '0');
      const minutos = String(now.getMinutes()).padStart(2, '0');
      setCurrentDateTime(`${dia} de ${mesCap}, ${horas}:${minutos}`);
    };
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleUserMenuEnter = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
      userMenuTimeoutRef.current = null;
    }
    setIsUserMenuOpen(true);
  };

  const handleUserMenuLeave = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
    }
    userMenuTimeoutRef.current = setTimeout(() => {
      setIsUserMenuOpen(false);
    }, 300);
  };

  // Fechar menu de usuário ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isUserMenuOpen]);

  // Rolagem automática para o topo ao alternar qualquer aba / tela
  useEffect(() => {
    window.scrollTo(0, 0);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Proteção de abas: Administrador não acessa abas operacionais de hotel e Hotel não acessa abas administrativas
  useEffect(() => {
    if (isHotelUser) {
      const adminOnlyTabs = [
        'admin-dashboard', 'parceiros', 'cadastro-parceiro', 'planos', 
        'cadastro-plano', 'admin-conexoes', 'admin-financeiro', 
        'admin-config', 'status-quartos', 'logs-sistema', 'admin-notificacoes'
      ];
      if (adminOnlyTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    } else {
      // Para o administrador não há vínculo operacional com nenhum hotel
      const hotelOnlyTabs = [
        'mapa', 'cadastro-quarto', 'itens-quartos', 'cadastro-item', 
        'categorias-quartos', 'cadastro-categoria', 'tipos-quartos', 
        'cadastro-tipo-quarto', 'produto', 'produto-categorias', 
        'produto-estoque', 'pedidos-cardapio', 'cadastro-produto', 'cadastro-categoria-produto', 
        'cadastro-movimentacao-estoque', 'caixa', 'contas-pagar', 
        'contas-receber', 'categorias-contas-pagar', 'categorias-contas-receber', 
        'cadastro-conta-pagar', 'cadastro-conta-receber', 
        'cadastro-categoria-conta-pagar', 'cadastro-categoria-conta-receber', 
        'conexao', 'reservas', 'cadastro-reserva', 'hospedes', 'cadastro-hospede',
        'cupons', 'cadastro-cupom'
      ];
      if (hotelOnlyTabs.includes(activeTab)) {
        setActiveTab('admin-dashboard');
      }
    }
  }, [isHotelUser, activeTab]);

  // Função para obter o link público do hotel logado na rota /hoteis/nomedohotel
  const getLoggedHotelUrl = () => {
    const current = currentHotelService.getCurrentHotel();
    if (current?.link) {
      if (current.link.startsWith('http://') || current.link.startsWith('https://')) {
        return current.link;
      }
      if (current.link.startsWith('/hoteis/')) {
        return current.link;
      }
    }
    const nameToUse = (current?.name && current.name.toLowerCase() !== 'hotel master')
      ? current.name
      : (hotelNomeFantasia && hotelNomeFantasia.toLowerCase() !== 'hotel master' ? hotelNomeFantasia : '');

    if (nameToUse) {
      return `/hoteis/${slugify(nameToUse)}`;
    }
    return '/hoteis/nomedohotel';
  };

  // Menus distintos: Administrador tem menus globais SaaS, Usuário de Hotel tem menus operacionais
  const menuItems = !isHotelUser ? [
    { id: 'admin-dashboard', label: 'Área Administrativa', icon: 'admin_panel_settings' },
    { id: 'cadastro-hoteis', label: 'Hotéis & Pousadas', icon: 'domain' },
    { id: 'categorias-hoteis', label: 'Categorias de Hotéis', icon: 'category' },
    { id: 'status-quartos', label: 'Status dos Quartos', icon: 'room_preferences' },
    { id: 'parceiros', label: 'Parceiros', icon: 'handshake' },
    { id: 'planos', label: 'Planos & Preços', icon: 'sell' },
    { id: 'creditos-saas', label: 'Controle de Planos & Créditos', icon: 'fact_check' },
    { id: 'usuarios', label: 'Usuários do Sistema', icon: 'manage_accounts' },
    { id: 'admin-conexoes', label: 'Conexões WhatsApp', icon: 'sync_alt' },
    { id: 'admin-notificacoes', label: 'Notificações Push', icon: 'campaign' },
    { id: 'admin-financeiro', label: 'Receita & Repasses', icon: 'payments' },
    { id: 'admin-config', label: 'Parâmetros do Sistema', icon: 'settings_suggest' },
    { id: 'logs-sistema', label: 'Logs do Sistema', icon: 'manage_search' },
    { id: 'catalogo-hoteis', label: 'Catálogo Público', icon: 'travel_explore' },
    { id: 'relatorios', label: 'Relatórios', icon: 'assessment' },
    { id: 'tutoriais', label: 'Tutoriais', icon: 'school' },
  ] : [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'reservas', label: 'Reservas', icon: 'book_online' },
    { id: 'catalogo-hoteis', label: 'Catálogo Público', icon: 'travel_explore' },
    { id: 'mapa', label: 'Mapa dos Quartos', icon: 'calendar_view_month' },
    { id: 'camareira', label: 'Governança & Camareiras', icon: 'cleaning_services' },
    { id: 'hospedes', label: 'Hóspedes', icon: 'group' },
    { id: 'cupons', label: 'Cupom de Desconto', icon: 'confirmation_number' },
    { id: 'usuarios', label: 'Usuários da Equipe', icon: 'manage_accounts' },
    { id: 'produto', label: 'Cadastro de Produtos', icon: 'inventory_2' },
    { id: 'caixa', label: 'Controle de Caixa', icon: 'account_balance_wallet' },
    { id: 'conexao', label: 'Conexão WhatsApp', icon: 'sync' },
    { id: 'config', label: 'Configurações', icon: 'settings' },
    { id: 'relatorios', label: 'Relatórios', icon: 'assessment' },
    { id: 'tutoriais', label: 'Tutoriais', icon: 'school' },
  ];

  const pathParts = window.location.pathname
    .toLowerCase()
    .replace(/\\/g, '/')
    .split('/')
    .map(p => p.trim())
    .filter(Boolean);

  // ── Rota: /assinar?ref=CODIGO — Cadastro de Parceiro (Standalone) ──
  const isAssinarRoute = activeTab === 'assinar' || checkIsAssinarUrl(window.location.pathname, window.location.search, window.location.hash);

  if (isAssinarRoute) {
    return (
      <LpAssinar
        onNavigateToLP={() => {
          if (isLpDomain()) {
            window.history.pushState({}, '', '/');
            setActiveTab('landingpage');
          } else if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://lp.hotelnozap.com.br';
          } else {
            window.history.pushState({}, '', '/lp');
            setActiveTab('landingpage');
          }
        }}
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
      />
    );
  }

  // ── Rotas Institucionais do Hotel no Zap: /privacidade, /termos, /empresa, /quem-somos, /fale-conosco ──
  if (activeTab === 'privacidade' || pathParts[0] === 'privacidade') {
    return <PaginaInstitucional tipo="privacidade" />;
  }

  if (activeTab === 'termos' || pathParts[0] === 'termos') {
    return <PaginaInstitucional tipo="termos" />;
  }

  if (activeTab === 'informacoes-empresa' || pathParts[0] === 'empresa' || pathParts[0] === 'informacoes-empresa') {
    return <PaginaInstitucional tipo="empresa" />;
  }

  if (activeTab === 'quem-somos' || pathParts[0] === 'quem-somos' || pathParts[0] === 'quemsomos') {
    return <PaginaInstitucional tipo="quem-somos" />;
  }

  if (activeTab === 'fale-conosco' || pathParts[0] === 'fale-conosco' || pathParts[0] === 'faleconosco' || pathParts[0] === 'contato') {
    return <PaginaInstitucional tipo="fale-conosco" />;
  }

  // ── Rota: /lpnovohotel ou /lp/lpnovohotel — Formulário de Cadastro de Hotel (Standalone) ──
  const isLpNovoHotelRoute = activeTab === 'lp-novo-hotel' ||
    pathParts[0] === 'lpnovohotel' ||
    (pathParts[0] === 'lp' && pathParts[1] === 'lpnovohotel');

  if (isLpNovoHotelRoute) {
    return (
      <LpNovoHotel
        onNavigateToLP={() => {
          if (isLpDomain()) {
            window.history.pushState({}, '', '/');
          } else {
            window.history.pushState({}, '', '/lp');
          }
          setActiveTab('landingpage');
        }}
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
      />
    );
  }

  const isLandingPageRoute = activeTab === 'landingpage' ||
    (isLpDomain() && pathParts[0] !== 'lpnovohotel') ||
    (pathParts[0] === 'lp' && pathParts[1] !== 'lpnovohotel');

  if (isLandingPageRoute) {
    return (
      <LandingPage
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
        onNavigateToSystem={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('dashboard');
          }
        }}
        onNavigateToNovoHotel={() => {
          if (isLpDomain()) {
            window.history.pushState({}, '', '/lpnovohotel');
          } else {
            window.history.pushState({}, '', '/lp/lpnovohotel');
          }
          setActiveTab('lp-novo-hotel');
        }}
      />
    );
  }

  // ── Rota: Checkout de Franquia/Parceiro — R$ 197/ano ──
  const isParceirosCheckoutRoute = activeTab === 'checkout-parceiro' ||
    pathParts[0] === 'checkout' ||
    (pathParts[0] === 'parceiros' && pathParts[1] === 'checkout') ||
    (pathParts[0] === 'parceiro' && pathParts[1] === 'checkout');

  if (isParceirosCheckoutRoute) {
    return (
      <CheckoutParceiro
        onNavigateBack={() => {
          if (isParceirosDomain()) {
            window.history.pushState({}, '', '/');
          } else {
            window.history.pushState({}, '', '/parceiros');
          }
          setActiveTab('landingpage-parceiros');
        }}
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
        onNavigateToDashboard={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            setActiveTab('portal-parceiro');
          }
        }}
      />
    );
  }

  // ── Rota: /parceiros ou subdomínio parceiros.hotelnozap.com.br — Landing Page de Franqueados/Parceiros ──
  const isParceirosLandingRoute = activeTab === 'landingpage-parceiros' ||
    (isParceirosDomain() && pathParts[0] !== 'assinar' && pathParts[0] !== 'checkout') ||
    (pathParts[0] === 'parceiros' && pathParts[1] !== 'assinar' && pathParts[1] !== 'checkout') ||
    (pathParts[0] === 'parceiro' && pathParts[1] !== 'checkout') ||
    pathParts[0] === 'franquia';

  if (isParceirosLandingRoute) {
    return (
      <LandingPageParceiros
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
        onNavigateToHome={() => {
          if (isParceirosDomain()) {
            window.location.href = 'https://hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/');
            setActiveTab('catalogo-hoteis');
          }
        }}
        onNavigateToCheckout={() => {
          if (isParceirosDomain()) {
            window.history.pushState({}, '', '/checkout');
          } else {
            window.history.pushState({}, '', '/parceiros/checkout');
          }
          setActiveTab('checkout-parceiro');
        }}
      />
    );
  }

  const isRoomRoute = activeTab === 'detalhes-quarto' || (pathParts[0] === 'hotel' && pathParts.length >= 3);

  if (isRoomRoute) {
    return (
      <DetalhesQuarto 
        hotel={selectedHotelForPage}
        quarto={selectedQuartoForPage}
        onNavigateToHotel={() => {
          const hSlug = selectedHotelForPage ? slugify(selectedHotelForPage.name) : (pathParts[1] || 'hotel');
          window.history.pushState({}, '', `/hotel/${hSlug}`);
          setActiveTab('pagina-hotel');
        }}
        onNavigateToCatalog={() => {
          window.history.pushState({}, '', '/hoteis');
          setActiveTab('catalogo-hoteis');
        }}
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
        onNavigateToMinhaConta={() => {
          window.history.pushState({}, '', '/minhaconta');
          setActiveTab('minhaconta');
        }}
      />
    );
  }

  // ── Rota: /hoteis/cardapio/:slug — Cardápio Digital do Hotel (Standalone para Hóspedes) ──
  const isCardapioRoute = activeTab === 'cardapio-hotel' ||
    (pathParts[0] === 'hoteis' && pathParts[1] === 'cardapio');

  if (isCardapioRoute) {
    const cardapioSlug = pathParts[1] === 'cardapio' ? (pathParts[2] || '') : (pathParts[0] === 'cardapio' ? pathParts[1] || '' : '');
    return (
      <CardapioHotel
        hotelSlug={cardapioSlug}
        onNavigateHome={() => {
          window.history.pushState({}, '', '/');
          setActiveTab('catalogo-hoteis');
        }}
      />
    );
  }

  const isHotelRoute = activeTab === 'pagina-hotel' || 
                       pathParts[0] === 'hotel' || 
                       (pathParts[0] === 'hoteis' && pathParts[1] !== 'cardapio' && pathParts.length >= 2);

  if (isHotelRoute) {
    const hotelSlug = pathParts.length >= 2 ? pathParts[1] : '';
    return (
      <PaginaHotel 
        hotel={selectedHotelForPage}
        hotelSlug={hotelSlug}
        onNavigateBack={() => {
          window.history.pushState({}, '', '/hoteis');
          setActiveTab('catalogo-hoteis');
        }}
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
        onNavigateToRoom={(quarto) => {
          setSelectedQuartoForPage(quarto);
          setActiveTab('detalhes-quarto');
        }}
      />
    );
  }

  if (activeTab === 'catalogo-hoteis' || (!isAppDomain() && !isLpDomain() && !isParceirosDomain() && (pathParts.length === 0 || (pathParts[0] === 'hoteis' && pathParts.length <= 1)))) {
    return (
      <CatalogoHoteis 
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', '/paineladmin');
            setActiveTab('login');
          }
        }}
        onNavigateToHotel={(hotel) => {
          setSelectedHotelForPage(hotel);
          setActiveTab('pagina-hotel');
        }}
      />
    );
  }

  const isHospedeUser = (currentUserRole || '').toLowerCase().includes('hospede') || (currentUserRole || '').toLowerCase().includes('hóspede');

  // Proteção: não redirecionar para /minhaconta se estiver em rotas públicas ou de hotéis
  const isPublicOrHotelPath = 
    pathParts[0] === 'hoteis' || 
    pathParts[0] === 'hotel' || 
    pathParts[0] === 'catalogo-hoteis' || 
    pathParts[0] === 'cardapio' ||
    pathParts[0] === 'lp' ||
    pathParts[0] === 'assinar' ||
    (pathParts[0] === 'parceiros' && pathParts[1] === 'assinar') ||
    activeTab === 'pagina-hotel' ||
    activeTab === 'catalogo-hoteis' ||
    activeTab === 'detalhes-quarto' ||
    activeTab === 'cardapio-hotel';

  if (!isPublicOrHotelPath && (activeTab === 'minhaconta' || pathParts[0] === 'minhaconta' || isHospedeUser)) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/minhaconta') {
      window.history.replaceState({}, '', '/minhaconta');
    }
    return (
      <AreaHospede
        userRole={currentUserRole || 'hospede'}
        userName={localStorage.getItem('hotelnozap_user_name') || 'Hóspede'}
        userEmail={localStorage.getItem('hotelnozap_user_email') || ''}
        onNavigateToHotel={(hotelSlugOrUrl: string, codigoCupom?: string) => {
          const cleanSlug = hotelSlugOrUrl.replace(/^\/(hotel|hoteis)\/?/, '').split('?')[0];
          const query = codigoCupom ? `?cupom=${encodeURIComponent(codigoCupom)}` : '';
          const targetUrl = `/hoteis/${cleanSlug}${query}`;
          window.history.pushState({}, '', targetUrl);
          setActiveTab('pagina-hotel');
        }}
        onNavigateToSystem={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', isAppDomain() ? '/' : '/paineladmin');
            setActiveTab('dashboard');
          }
        }}
        onNavigateToLogin={() => {
          if (!isAppDomain() && typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
            window.location.href = 'https://app.hotelnozap.com.br/';
          } else {
            window.history.pushState({}, '', isAppDomain() ? '/' : '/paineladmin');
            setActiveTab('login');
          }
        }}
        onLogout={async () => {
          try {
            await supabase.auth.signOut();
          } catch { /* ignore */ }
          try {
            localStorage.removeItem('hotelnozap_user_role');
            localStorage.removeItem('hotelnozap_user_email');
            localStorage.removeItem('hotelnozap_user_name');
            localStorage.removeItem('hotelnozap_current_user');
            localStorage.removeItem('hotelnozap_sb_session');
            localStorage.removeItem('hotelnozap_hotel_atual');
            localStorage.removeItem('hotelnozap_last_authenticated_at');
            sessionStorage.clear();
          } catch { /* ignore */ }
          setCurrentUserRole('');
          
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const defaultProd = import.meta.env?.VITE_APP_BASE_URL || 'https://app.hotelnozap.com.br/';
          const targetHome = isLocalhost ? `${window.location.protocol}//${window.location.host}/` : (window.location.origin || defaultProd);
          window.location.href = targetHome;
        }}
      />
    );
  }

  if (restoringSession) {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-gradient-to-br from-[#003400] to-black flex flex-col items-center justify-center z-[100] select-none">
        <div className="w-16 h-16 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin mb-6" />
        <h2 className="text-white text-2xl font-black tracking-widest mb-1">HOTEL NO ZAP</h2>
        <p className="text-emerald-400 text-sm font-semibold tracking-wide">Restaurando sua sessão...</p>
      </div>
    );
  }

  if (activeTab === 'login') {
    return (
      <Login 
        onLoginSuccess={(userData) => {
          if (userData?.role) {
            setCurrentUserRole(userData.role);
          }
          const roleLower = (userData?.role || '').toLowerCase();
          if (roleLower.includes('parceiro') || roleLower.includes('franqueado')) {
            setActiveTab('portal-parceiro');
            return;
          }
          if (roleLower.includes('hospede') || roleLower.includes('hóspede')) {
            window.history.pushState({}, '', '/minhaconta');
            setActiveTab('minhaconta');
            return;
          }
          if (roleLower.includes('camareira') || roleLower.includes('governanca')) {
            window.history.pushState({}, '', '/camareira');
            setActiveTab('camareira');
            return;
          }
          const isAdm = roleLower.includes('admin') || roleLower.includes('super');
          setActiveTab(isAdm ? 'admin-dashboard' : 'dashboard');
        }}
      />
    );
  }

  // ── Rota Dedicada: /camareira ou aba 'camareira' — Painel de Governança ──
  const roleLower = (currentUserRole || localStorage.getItem('hotelnozap_user_role') || '').toLowerCase();
  const isCamareiraUser = roleLower.includes('camareira') || roleLower.includes('governanca');
  const isAdminUser = roleLower.includes('admin') || roleLower.includes('super') || roleLower.includes('master') || roleLower.includes('administrador') || roleLower.includes('hotel') || roleLower.includes('gerente');
  const isCamareiraAuthorized = isCamareiraUser || isAdminUser;

  const isCamareiraRoute = activeTab === 'camareira' || pathParts[0] === 'camareira';

  if (isCamareiraRoute) {
    if (!isCamareiraAuthorized) {
      const userLogged = Boolean(localStorage.getItem('hotelnozap_user_email'));
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl max-w-md w-full text-center border border-slate-700 space-y-4 shadow-2xl animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">block</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Acesso Recusado</h2>
              <p className="text-xs text-rose-300 font-semibold mt-1">Permissão Restrita à Governança</p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Somente usuários do tipo <strong className="text-emerald-400">Camareira</strong> podem acessar esta tela.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {userLogged && (
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, '', isAppDomain() ? '/' : '/paineladmin');
                    setActiveTab('dashboard');
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Voltar ao Meu Painel
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await handleLogout();
                  window.history.pushState({}, '', isAppDomain() ? '/' : '/paineladmin');
                  setActiveTab('login');
                }}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
              >
                Sair / Outra Conta
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (typeof window !== 'undefined' && window.location.pathname !== '/camareira') {
      window.history.replaceState({}, '', '/camareira');
    }

    return (
      <PainelCamareira
        currentUserRole={currentUserRole}
        activeHotel={activeHotel}
        onNavigateBack={isAdminUser ? () => {
          window.history.pushState({}, '', isAppDomain() ? '/' : '/paineladmin');
          setActiveTab(isHotelUser ? 'dashboard' : 'admin-dashboard');
        } : undefined}
        onLogout={() => handleLogout()}
      />
    );
  }

  // ── Portal do Franqueado / Parceiro (Acesso pelo Login Padrão de Acordo com Perfil) ──
  const isParceiroUser = roleLower.includes('parceiro') || roleLower.includes('franqueado');
  const isParceiroAuthorized = isParceiroUser || isAdminUser;

  const isParceiroRoute = activeTab === 'portal-parceiro';

  if (isParceiroRoute) {
    if (!isParceiroAuthorized) {
      const userLogged = Boolean(localStorage.getItem('hotelnozap_user_email'));
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl max-w-md w-full text-center border border-slate-700 space-y-4 shadow-2xl animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Acesso Restrito ao Franqueado</h2>
              <p className="text-xs text-emerald-300 font-semibold mt-1">Área Exclusiva para Franqueados e Parceiros</p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {userLogged 
                ? 'Seu perfil atual não possui autorização de Franqueado/Parceiro. Acesse com uma conta de parceiro credenciado.' 
                : 'Esta área é exclusiva para parceiros credenciados Hotel no Zap. Por favor, realize o login com sua conta.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {userLogged && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(isCamareiraUser ? 'camareira' : (isHotelUser ? 'dashboard' : 'admin-dashboard'));
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Meu Painel
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await handleLogout();
                  setActiveTab('login');
                }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
              >
                {userLogged ? 'Trocar de Conta' : 'Fazer Login'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <PortalParceiro
        onLogout={async () => {
          await handleLogout();
          setActiveTab('login');
        }}
        onNavigateHome={() => {
          setActiveTab('catalogo-hoteis');
        }}
      />
    );
  }

  // ── Bloqueio Inteligente: Hotel com Plano / Créditos / Dias Bônus Expirados ──
  const isUserAuthenticated = Boolean(
    currentUserRole || 
    localStorage.getItem('hotelnozap_user_email')
  );

  const isMasterDefault = Boolean(
    !activeHotel ||
    activeHotel.id === 'default' ||
    activeHotel.id === '11111111-1111-1111-1111-111111111111' ||
    activeHotel.name?.toLowerCase() === 'hotel master'
  );

  const hotelCreditInfo = (isUserAuthenticated && isHotelUser && activeHotel && !isMasterDefault)
    ? creditosService.calcularInfoCreditos(activeHotel)
    : null;

  const isHotelExpired = Boolean(
    hotelCreditInfo &&
    (hotelCreditInfo.status === 'expirado' || activeHotel?.status === 'inativo' || activeHotel?.status === 'bloqueado')
  );

  if (isHotelExpired && hotelCreditInfo) {
    return (
      <TelaPlanoExpirado
        hotel={activeHotel}
        infoCredito={hotelCreditInfo}
        onPlanSubscribed={async () => {
          try {
            const dbHoteis = await hoteisService.getHoteis();
            if (dbHoteis && dbHoteis.length > 0) {
              const matched = dbHoteis.find(h => h.id === activeHotel.id);
              if (matched) {
                const freshActive: HotelAtivo = {
                  id: matched.id,
                  name: matched.name,
                  category: matched.category,
                  cityUf: matched.cityUf,
                  cnpj: matched.cnpj,
                  status: matched.status,
                  imageUrl: matched.imageUrl,
                  plan: matched.plan,
                  managerName: matched.managerName,
                  managerEmail: matched.managerEmail,
                  managerPhone: matched.managerPhone,
                  managerCpf: matched.managerCpf,
                  loginEmail: matched.loginEmail,
                  whatsapp: matched.whatsapp,
                  notes: (matched as any).notes || (matched as any).observacoes,
                  isImportedFromGoogle: (matched as any).isImportedFromGoogle
                };
                currentHotelService.setCurrentHotel(freshActive);
                setActiveHotel(freshActive);
              }
            }
          } catch { /* ignore */ }
          setActiveTab('dashboard');
        }}
        onLogout={() => handleLogout()}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#f8f9ff]">
      
      {/* MOBILE TOP NAVIGATION HEADER */}
      <header 
        className="sticky top-0 z-40 flex justify-between items-center w-full px-4 h-16 border-b border-[#c6c6cd]/40 shadow-sm lg:hidden shrink-0"
        style={{ background: 'linear-gradient(to right, rgb(0, 52, 0), rgb(0, 0, 0))' }}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsProdutosSubmenuOpen(false);
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }}
            aria-label="Menu"
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-white text-2xl">
              {isMobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
          {!isHotelUser ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-700/40 border border-emerald-500/50 flex items-center justify-center text-[#FDB116] shadow-sm shrink-0">
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider text-white uppercase leading-none">HOTEL NO ZAP</span>
                <span className="text-[10px] font-bold text-emerald-300 leading-tight">Admin Master</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate max-w-[150px]">{hotelNomeFantasia}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <NotificationSystem isMobile={true} onNavigateTab={(tab) => setActiveTab(tab)} />
          
          <div 
            className="relative ml-2 user-menu-container"
            onMouseEnter={handleUserMenuEnter}
            onMouseLeave={handleUserMenuLeave}
          >
            <button 
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              onMouseEnter={handleUserMenuEnter}
              className="w-8 h-8 rounded-full bg-[#131b2e] border border-[#c6c6cd]/40 overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xs text-white cursor-pointer shadow-xs"
            >
              A
            </button>

            {/* MENU SUSPENSO MOBILE (PERFIL, AJUDA E SAIR) */}
            {isUserMenuOpen && (
              <div 
                onMouseEnter={handleUserMenuEnter}
                onMouseLeave={handleUserMenuLeave}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-4 before:left-0 before:w-full before:h-4 before:content-['']"
              >
                <div className="p-2.5 border-b border-slate-100 bg-slate-50/50 rounded-xl mb-1">
                  <div className="font-extrabold text-slate-900 text-xs truncate">
                    {(() => { try { return localStorage.getItem('hotelnozap_user_name') || 'Usuário'; } catch { return 'Usuário'; } })() + ' (' + currentUserRole + ')'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {(() => { try { return localStorage.getItem('hotelnozap_user_email') || ''; } catch { return ''; } })()}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[9px] font-semibold text-slate-500">Tipo:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newRole = isHotelUser ? 'Administrador' : 'Hotel';
                        setCurrentUserRole(newRole);
                        localStorage.setItem('hotelnozap_user_role', newRole);
                        window.dispatchEvent(new CustomEvent('user_role_changed', { detail: newRole }));
                      }}
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 transition-colors cursor-pointer"
                    >
                      Mudar para {isHotelUser ? 'Admin' : 'Hotel'}
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5">
                  {!isHotelUser && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('admin-dashboard');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left cursor-pointer border border-emerald-200/60 mb-1"
                    >
                      <span className="material-symbols-outlined text-base text-emerald-700">admin_panel_settings</span>
                      <span>Área Administrativa Master</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('perfil');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-emerald-700">account_circle</span>
                    <span>Meu Perfil (Minha Conta)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      alert('Central de Suporte & Documentação Hotel no Zap');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-blue-600">help_outline</span>
                    <span>Ajuda</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    type="button"
                    onClick={() => handleLogout()}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base text-red-600">logout</span>
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER OVERLAY & MENU (1:1 com a imagem anexada) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex lg:hidden">
          {/* Backdrop escurecido */}
          <div 
            onClick={() => {
              setIsProdutosSubmenuOpen(false);
              setIsMobileMenuOpen(false);
            }}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          ></div>

          {/* Drawer Sidebar */}
          <aside 
            className="relative w-[285px] h-full flex flex-col shadow-xl z-10"
            style={{ background: 'linear-gradient(180deg, #003400 0%, #000000 100%)' }}
          >
            {/* Drawer Header com Botão de Recolher */}
            <div className="py-4 px-4 border-b border-white/10 shrink-0 flex items-center justify-between">
              {!isHotelUser ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold shadow-md shrink-0">
                    <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-base text-white leading-tight tracking-wide">
                      HOTEL NO ZAP
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider w-fit mt-0.5">
                      Super Admin Master
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#131b2e] flex items-center justify-center text-white shadow-md shrink-0">
                    <span className="material-symbols-outlined text-xl">hotel</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-base text-white leading-tight truncate" title={hotelNomeFantasia}>
                      {hotelNomeFantasia}
                    </span>
                    <span className="text-xs font-semibold text-[#6cf8bb] tracking-wider uppercase truncate">
                      {hotelSubtitle}
                    </span>
                  </div>
                </div>
              )}
              <button 
                onClick={() => {
                  setIsProdutosSubmenuOpen(false);
                  setIsMobileMenuOpen(false);
                }}
                aria-label="Recolher Menu"
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
                title="Recolher Menu"
              >
                <span className="material-symbols-outlined text-2xl">menu_open</span>
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 min-h-0 py-4 overflow-y-auto no-scrollbar">
              {!isHotelUser ? (
                <div className="flex flex-col gap-1 px-3 text-sm">
                  <div className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
                    Visão Geral
                  </div>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('admin-dashboard'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'admin-dashboard'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'admin-dashboard' ? 'text-emerald-400' : ''}`}>dashboard</span>
                    <span>Dashboard</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('cadastro-hoteis'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'cadastro-hoteis' || activeTab === 'cadastro-novo-hotel'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'cadastro-hoteis' || activeTab === 'cadastro-novo-hotel' ? 'text-emerald-400' : ''}`}>domain</span>
                    <span>Hotéis &amp; Pousadas</span>
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                      {adminCounts.hoteis}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('categorias-hoteis'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'categorias-hoteis' || activeTab === 'cadastro-categoria-hotel'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'categorias-hoteis' || activeTab === 'cadastro-categoria-hotel' ? 'text-emerald-400' : ''}`}>category</span>
                    <span>Categorias de Hotéis</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('status-quartos'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'status-quartos'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'status-quartos' ? 'text-emerald-400' : ''}`}>room_preferences</span>
                    <span>Status dos Quartos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('parceiros'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'parceiros' || activeTab === 'cadastro-parceiro'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'parceiros' || activeTab === 'cadastro-parceiro' ? 'text-emerald-400' : ''}`}>handshake</span>
                    <span>Parceiros</span>
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                      {adminCounts.parceiros}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('planos'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'planos' || activeTab === 'cadastro-plano'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'planos' || activeTab === 'cadastro-plano' ? 'text-emerald-400' : ''}`}>loyalty</span>
                    <span>Planos &amp; Assinaturas</span>
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                      {adminCounts.planos}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('creditos-saas'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'creditos-saas'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'creditos-saas' ? 'text-emerald-400' : ''}`}>fact_check</span>
                    <span>Controle de Planos &amp; Créditos</span>
                    <span className="ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                      Gestão
                    </span>
                  </button>

                  <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
                    Infraestrutura &amp; SaaS
                  </div>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('admin-conexoes'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'admin-conexoes'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'admin-conexoes' ? 'text-emerald-400' : ''}`}>sync_alt</span>
                    <span>Conexões WhatsApp</span>
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                      {globalWhatsappCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('admin-notificacoes'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'admin-notificacoes'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'admin-notificacoes' ? 'text-emerald-400' : ''}`}>campaign</span>
                    <span>Notificações Push</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                      OneSignal
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('admin-financeiro'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'admin-financeiro'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'admin-financeiro' ? 'text-emerald-400' : ''}`}>payments</span>
                    <span>Receita &amp; Repasses</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('usuarios'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'usuarios' || activeTab === 'cadastro-usuario'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'usuarios' || activeTab === 'cadastro-usuario' ? 'text-emerald-400' : ''}`}>manage_accounts</span>
                    <span>Usuários Administrativos</span>
                  </button>

                  {/* Menu Configurações com Submenu Mercado Pago e Parâmetros */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsAdminConfigSubmenuOpen(!isAdminConfigSubmenuOpen)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                        activeTab === 'admin-config' || activeTab === 'config-mercado-pago'
                          ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                          : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined ${(activeTab === 'admin-config' || activeTab === 'config-mercado-pago') ? 'text-emerald-400' : ''}`}>
                          settings
                        </span>
                        <span>Configurações</span>
                      </div>
                      <span className="material-symbols-outlined text-lg transition-transform duration-200">
                        {isAdminConfigSubmenuOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>

                    {isAdminConfigSubmenuOpen && (
                      <div className="ml-4 pl-3 border-l border-white/10 flex flex-col gap-1 py-1">
                        <button
                          type="button"
                          onClick={() => { setActiveTab('admin-config'); setIsMobileMenuOpen(false); }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
                            activeTab === 'admin-config'
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                              : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">settings_suggest</span>
                          <span>Parâmetros do Sistema</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setActiveTab('config-mercado-pago'); setIsMobileMenuOpen(false); }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
                            activeTab === 'config-mercado-pago'
                              ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                              : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">payments</span>
                          <span>Mercado Pago</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('logs-sistema'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                      activeTab === 'logs-sistema'
                        ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`material-symbols-outlined ${activeTab === 'logs-sistema' ? 'text-emerald-400' : ''}`}>manage_search</span>
                    <span>Logs do Sistema</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1 px-2">
                  {menuItems.map((item) => {
                    const isProdutoMenu = item.id === 'produto';
                    const isConfigMenu = item.id === 'config';
                    const isActive = activeTab === item.id || 
                                     (isProdutoMenu && (activeTab === 'produto-categorias' || activeTab === 'produto-estoque' || activeTab === 'pedidos-cardapio')) ||
                                     (isConfigMenu && (activeTab === 'config' || activeTab === 'config-hotel' || activeTab === 'config-mercado-pago'));

                    return (
                      <div key={item.id} className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => {
                            if (item.id === 'catalogo-hoteis') {
                              const url = getLoggedHotelUrl();
                              window.open(url, '_blank');
                              setIsMobileMenuOpen(false);
                              return;
                            }
                            if (isProdutoMenu) {
                              setIsProdutosSubmenuOpen(!isProdutosSubmenuOpen);
                              setIsConfigSubmenuOpen(false);
                              return;
                            }
                            if (isConfigMenu) {
                              setIsConfigSubmenuOpen(!isConfigSubmenuOpen);
                              setIsProdutosSubmenuOpen(false);
                              return;
                            }
                            setActiveTab(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer ${
                            isActive
                              ? 'bg-[#10B981] text-white font-semibold shadow-md'
                              : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-xl">
                              {item.icon}
                            </span>
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>

                          {item.id === 'catalogo-hoteis' && (
                            <span className="material-symbols-outlined text-base text-white/60">
                              open_in_new
                            </span>
                          )}

                          {(isProdutoMenu || isConfigMenu) && (
                            <span className="material-symbols-outlined text-lg transition-transform duration-200">
                              {(isProdutoMenu ? isProdutosSubmenuOpen : isConfigSubmenuOpen) ? 'expand_less' : 'expand_more'}
                            </span>
                          )}
                        </button>

                        {/* SUBMENU PRODUTOS MOBILE */}
                        {isProdutoMenu && isProdutosSubmenuOpen && (
                          <div className="flex flex-col gap-1 pl-10 pr-2 py-1">
                            <button
                              onClick={() => {
                                setActiveTab('pedidos-cardapio');
                                setIsProdutosSubmenuOpen(false);
                                setIsMobileMenuOpen(false);
                              }}
                              className={
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left w-full cursor-pointer " +
                                (activeTab === 'pedidos-cardapio'
                                  ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white')
                              }
                            >
                              <span className="material-symbols-outlined text-base">receipt_long</span>
                              <span>Pedidos do Cardápio</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveTab('produto-categorias');
                                setIsProdutosSubmenuOpen(false);
                                setIsMobileMenuOpen(false);
                              }}
                              className={
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left w-full cursor-pointer " +
                                (activeTab === 'produto-categorias'
                                  ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white')
                              }
                            >
                              <span className="material-symbols-outlined text-base">category</span>
                              <span>Categorias</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveTab('produto-estoque');
                                setIsProdutosSubmenuOpen(false);
                                setIsMobileMenuOpen(false);
                              }}
                              className={
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left w-full cursor-pointer " +
                                (activeTab === 'produto-estoque'
                                  ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white')
                              }
                            >
                              <span className="material-symbols-outlined text-base">inventory</span>
                              <span>Estoque</span>
                            </button>
                          </div>
                        )}

                        {/* SUBMENU CONFIGURAÇÕES MOBILE */}
                        {isConfigMenu && isConfigSubmenuOpen && (
                          <div className="flex flex-col gap-1 pl-10 pr-2 py-1">
                            <button
                              onClick={() => {
                                setActiveTab('config-hotel');
                                setIsConfigSubmenuOpen(false);
                                setIsMobileMenuOpen(false);
                              }}
                              className={
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left w-full cursor-pointer " +
                                (activeTab === 'config-hotel' || activeTab === 'config'
                                  ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white')
                              }
                            >
                              <span className="material-symbols-outlined text-base">tune</span>
                              <span>Geral, Horários & LGPD</span>
                            </button>

                            <button
                              onClick={() => {
                                setActiveTab('config-mercado-pago');
                                setIsConfigSubmenuOpen(false);
                                setIsMobileMenuOpen(false);
                              }}
                              className={
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left w-full cursor-pointer " +
                                (activeTab === 'config-mercado-pago'
                                  ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                                  : 'text-white/80 hover:bg-white/10 hover:text-white')
                              }
                            >
                              <span className="material-symbols-outlined text-base">payments</span>
                              <span>Mercado Pago</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </nav>

            {/* Drawer Footer / Logout */}
            <div className="p-4 border-t border-white/10 shrink-0 bg-[#000000]">
              {!isHotelUser ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
                      <span className="material-symbols-outlined text-base">shield_person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {(() => { try { return localStorage.getItem('hotelnozap_user_name') || 'Usuário'; } catch { return 'Usuário'; } })() + ' (Você)'}
                      </p>
                      <p className="text-[10px] text-emerald-300/80 truncate font-mono">
                        {(() => { try { return localStorage.getItem('hotelnozap_user_email') || ''; } catch { return ''; } })()}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleLogout()}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-red-500/20 text-white transition-colors text-xs font-medium cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">logout</span>
                    <span>Sair da Conta Master</span>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleLogout()}
                  className="flex items-center gap-4 w-full px-4 py-3 rounded-lg hover:bg-red-500/10 transition-colors text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined">logout</span>
                  <span className="text-sm font-medium">Sair</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP FIXED SIDEBAR */}
      {!isHotelUser ? (
        <aside 
          className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-72 z-40 text-white overflow-hidden justify-between border-r border-emerald-950/40"
          style={{ background: 'linear-gradient(180deg, #003400 0%, #000000 100%)' }}
        >
          <div className="overflow-y-auto no-scrollbar">
            {/* Top Brand */}
            <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-extrabold text-xl shadow-inner">
                <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-wider text-white">HOTEL NO ZAP</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                  Super Admin Master
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-1.5 text-sm">
              <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
                Visão Geral
              </div>

              <button 
                type="button"
                onClick={() => setActiveTab('admin-dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'admin-dashboard'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'admin-dashboard' ? 'text-emerald-400' : ''}`}>dashboard</span>
                <span>Dashboard</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('cadastro-hoteis')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'cadastro-hoteis' || activeTab === 'cadastro-novo-hotel'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'cadastro-hoteis' || activeTab === 'cadastro-novo-hotel' ? 'text-emerald-400' : ''}`}>domain</span>
                <span>Hotéis &amp; Pousadas</span>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                  {adminCounts.hoteis}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('categorias-hoteis')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'categorias-hoteis' || activeTab === 'cadastro-categoria-hotel'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'categorias-hoteis' || activeTab === 'cadastro-categoria-hotel' ? 'text-emerald-400' : ''}`}>category</span>
                <span>Categorias de Hotéis</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('status-quartos')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'status-quartos'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'status-quartos' ? 'text-emerald-400' : ''}`}>room_preferences</span>
                <span>Status dos Quartos</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('parceiros')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'parceiros' || activeTab === 'cadastro-parceiro'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'parceiros' || activeTab === 'cadastro-parceiro' ? 'text-emerald-400' : ''}`}>handshake</span>
                <span>Parceiros</span>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                  {adminCounts.parceiros}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('planos')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'planos' || activeTab === 'cadastro-plano'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'planos' || activeTab === 'cadastro-plano' ? 'text-emerald-400' : ''}`}>loyalty</span>
                <span>Planos &amp; Assinaturas</span>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300">
                  {adminCounts.planos}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('creditos-saas')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'creditos-saas'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'creditos-saas' ? 'text-emerald-400' : ''}`}>fact_check</span>
                <span>Controle de Planos &amp; Créditos</span>
                <span className="ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                  Gestão
                </span>
              </button>

              <div className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70">
                Infraestrutura &amp; SaaS
              </div>

              <button 
                type="button"
                onClick={() => setActiveTab('admin-conexoes')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'admin-conexoes'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'admin-conexoes' ? 'text-emerald-400' : ''}`}>sync_alt</span>
                <span>Conexões WhatsApp</span>
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                  {globalWhatsappCount}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('admin-notificacoes')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'admin-notificacoes'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'admin-notificacoes' ? 'text-emerald-400' : ''}`}>campaign</span>
                <span>Notificações Push</span>
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                  OneSignal
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('admin-financeiro')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'admin-financeiro'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'admin-financeiro' ? 'text-emerald-400' : ''}`}>payments</span>
                <span>Receita &amp; Repasses</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveTab('usuarios')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'usuarios' || activeTab === 'cadastro-usuario'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'usuarios' || activeTab === 'cadastro-usuario' ? 'text-emerald-400' : ''}`}>manage_accounts</span>
                <span>Usuários Administrativos</span>
              </button>

              {/* Menu Configurações com Submenu Mercado Pago e Parâmetros */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAdminConfigSubmenuOpen(!isAdminConfigSubmenuOpen)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                    activeTab === 'admin-config' || activeTab === 'config-mercado-pago'
                      ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${(activeTab === 'admin-config' || activeTab === 'config-mercado-pago') ? 'text-emerald-400' : ''}`}>
                      settings
                    </span>
                    <span>Configurações</span>
                  </div>
                  <span className="material-symbols-outlined text-lg transition-transform duration-200">
                    {isAdminConfigSubmenuOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {isAdminConfigSubmenuOpen && (
                  <div className="ml-4 pl-3 border-l border-white/10 flex flex-col gap-1 py-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('admin-config')}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
                        activeTab === 'admin-config'
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">settings_suggest</span>
                      <span>Parâmetros do Sistema</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('config-mercado-pago')}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
                        activeTab === 'config-mercado-pago'
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">payments</span>
                      <span>Mercado Pago</span>
                    </button>
                  </div>
                )}
              </div>

              <button 
                type="button"
                onClick={() => setActiveTab('logs-sistema')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                  activeTab === 'logs-sistema'
                    ? 'bg-white/10 text-white font-medium border-l-4 border-emerald-400'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`material-symbols-outlined ${activeTab === 'logs-sistema' ? 'text-emerald-400' : ''}`}>manage_search</span>
                <span>Logs do Sistema</span>
              </button>
            </nav>
          </div>

          {/* Bottom User Section */}
          <div className="p-4 border-t border-white/10 space-y-3 shrink-0">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold text-sm shrink-0">
                <span className="material-symbols-outlined text-lg">shield_person</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {(() => { try { return localStorage.getItem('hotelnozap_user_name') || 'Usuário'; } catch { return 'Usuário'; } })() + ' (Você)'}
                </p>
                <p className="text-[11px] text-emerald-300/80 truncate font-mono">
                  {(() => { try { return localStorage.getItem('hotelnozap_user_email') || ''; } catch { return ''; } })()}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => handleLogout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/90 hover:text-white hover:bg-red-500/20 text-sm font-medium transition-colors text-left cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
              <span>Sair da Conta Master</span>
            </button>
          </div>
        </aside>
      ) : (
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[280px] p-4 gap-1.5 z-40 bg-gradient-to-b from-[#003400] to-[#000000] text-white overflow-hidden">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-4 px-4 py-2 mt-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#131b2e] flex items-center justify-center text-white shadow-md shrink-0">
              <span className="material-symbols-outlined text-2xl">hotel</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-black text-white tracking-tight leading-tight truncate" title={hotelNomeFantasia}>
                {hotelNomeFantasia}
              </h1>
              <span className="text-xs font-semibold text-[#6cf8bb] tracking-wider uppercase truncate">
                {hotelSubtitle}
              </span>
            </div>
          </div>

          {/* Menu Navigation */}
          <nav className="flex-1 min-h-0 flex flex-col gap-1 overflow-y-auto no-scrollbar pb-2">
            {menuItems.map((item) => {
              const isProdutoMenu = item.id === 'produto';
              const isConfigMenu = item.id === 'config';
              const isActive = activeTab === item.id || 
                               (isProdutoMenu && (activeTab === 'produto-categorias' || activeTab === 'produto-estoque' || activeTab === 'pedidos-cardapio')) ||
                               (isConfigMenu && (activeTab === 'config' || activeTab === 'config-hotel' || activeTab === 'config-mercado-pago'));

              return (
                <div key={item.id} className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => {
                      if (item.id === 'catalogo-hoteis') {
                        const url = getLoggedHotelUrl();
                        window.open(url, '_blank');
                        return;
                      }
                      if (isProdutoMenu) {
                        setIsProdutosSubmenuOpen(!isProdutosSubmenuOpen);
                        setIsConfigSubmenuOpen(false);
                        setActiveTab('produto');
                      } else if (isConfigMenu) {
                        setIsConfigSubmenuOpen(!isConfigSubmenuOpen);
                        setIsProdutosSubmenuOpen(false);
                        setActiveTab('config-mercado-pago');
                      } else {
                        setIsProdutosSubmenuOpen(false);
                        setIsConfigSubmenuOpen(false);
                        setActiveTab(item.id);
                      }
                    }}
                    className={
                      "flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-left cursor-pointer " +
                      (isActive 
                        ? 'bg-[#6cf8bb]/20 text-[#6cf8bb] font-bold' 
                        : 'text-white hover:bg-white/10')
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className={"material-symbols-outlined " + (isActive ? 'icon-fill' : '')}>
                        {item.icon}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>

                    {item.id === 'catalogo-hoteis' && (
                      <span className="material-symbols-outlined text-sm text-white/50 hover:text-white transition-colors" title="Abrir em nova aba">
                        open_in_new
                      </span>
                    )}

                    {(isProdutoMenu || isConfigMenu) && (
                      <span className="material-symbols-outlined text-lg transition-transform duration-200">
                        {(isProdutoMenu ? isProdutosSubmenuOpen : isConfigSubmenuOpen) ? 'expand_less' : 'expand_more'}
                      </span>
                    )}
                  </button>

                  {/* SUBMENU PRODUTOS DESKTOP */}
                  {isProdutoMenu && isProdutosSubmenuOpen && (
                    <div className="flex flex-col gap-1 pl-9 pr-2 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      <button
                        onClick={() => {
                          setActiveTab('pedidos-cardapio');
                          setIsProdutosSubmenuOpen(false);
                        }}
                        className={
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer " +
                          (activeTab === 'pedidos-cardapio'
                            ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                            : 'text-white/80 hover:bg-white/10 hover:text-white')
                        }
                      >
                        <span className="material-symbols-outlined text-base">receipt_long</span>
                        <span>Pedidos do Cardápio</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('produto-categorias');
                          setIsProdutosSubmenuOpen(false);
                        }}
                        className={
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer " +
                          (activeTab === 'produto-categorias'
                            ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                            : 'text-white/80 hover:bg-white/10 hover:text-white')
                        }
                      >
                        <span className="material-symbols-outlined text-base">category</span>
                        <span>Categorias</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('produto-estoque');
                          setIsProdutosSubmenuOpen(false);
                        }}
                        className={
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer " +
                          (activeTab === 'produto-estoque'
                            ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                            : 'text-white/80 hover:bg-white/10 hover:text-white')
                        }
                      >
                        <span className="material-symbols-outlined text-base">inventory</span>
                        <span>Estoque</span>
                      </button>
                    </div>
                  )}

                  {/* SUBMENU CONFIGURAÇÕES DESKTOP */}
                  {isConfigMenu && isConfigSubmenuOpen && (
                    <div className="flex flex-col gap-1 pl-9 pr-2 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      <button
                        onClick={() => {
                          setActiveTab('config-hotel');
                          setIsConfigSubmenuOpen(false);
                        }}
                        className={
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer " +
                          (activeTab === 'config-hotel' || activeTab === 'config'
                            ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                            : 'text-white/80 hover:bg-white/10 hover:text-white')
                        }
                      >
                        <span className="material-symbols-outlined text-base">tune</span>
                        <span>Geral, Horários & LGPD</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('config-mercado-pago');
                          setIsConfigSubmenuOpen(false);
                        }}
                        className={
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer " +
                          (activeTab === 'config-mercado-pago'
                            ? 'bg-[#6cf8bb]/30 text-[#6cf8bb]'
                            : 'text-white/80 hover:bg-white/10 hover:text-white')
                        }
                      >
                        <span className="material-symbols-outlined text-base">payments</span>
                        <span>Mercado Pago</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Account & Logout */}
          <div className="px-4 py-2 mt-auto border-t border-white/10 shrink-0 bg-[#000000]">
            <button 
              onClick={() => handleLogout()}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-lg transition-all text-white w-full cursor-pointer text-sm font-medium"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>Sair</span>
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 flex flex-col ${!isHotelUser ? 'lg:ml-72' : 'lg:ml-[280px]'} h-full overflow-hidden bg-[#f8f9ff]`}>
        
        {/* DESKTOP TOP HEADER */}
        {isHotelUser && (
          <header className="hidden lg:flex items-center justify-between w-full px-6 sm:px-8 lg:px-10 bg-[#f8f9ff] h-16 border-b border-[#c6c6cd]/40 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#45464d]">Olá,</span>
              <span className="font-semibold text-[#0b1c30]">Everaldo Souza</span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <span className="text-[#45464d] hidden sm:inline mr-2">{currentDateTime}</span>
              <div className="flex items-center gap-2">
                <NotificationSystem isMobile={false} onNavigateTab={(tab) => setActiveTab(tab)} />
                <div className="w-px h-6 bg-[#c6c6cd]/50 mx-1"></div>
                <div 
                  className="relative user-menu-container"
                  onMouseEnter={handleUserMenuEnter}
                  onMouseLeave={handleUserMenuLeave}
                >
                  <button 
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    onMouseEnter={handleUserMenuEnter}
                    className="flex items-center gap-2 hover:bg-[#eff4ff] p-1 rounded-full transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#003400] flex items-center justify-center text-emerald-400 font-bold text-xs shadow-xs border border-emerald-500/30">
                      ES
                    </div>
                  </button>

                  {/* MENU SUSPENSO DESKTOP (PERFIL, AJUDA E SAIR) */}
                  {isUserMenuOpen && (
                    <div 
                      onMouseEnter={handleUserMenuEnter}
                      onMouseLeave={handleUserMenuLeave}
                      className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 before:absolute before:-top-4 before:left-0 before:w-full before:h-4 before:content-['']"
                    >
                      {/* Cabeçalho do Perfil */}
                      <div className="p-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 rounded-xl mb-1">
                        <div className="w-10 h-10 rounded-full bg-[#003400] flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0 border border-emerald-500/30">
                          ES
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-sm truncate">
                            {(() => { try { return localStorage.getItem('hotelnozap_user_name') || 'Usuário'; } catch { return 'Usuário'; } })()}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {(() => { try { return localStorage.getItem('hotelnozap_user_email') || ''; } catch { return ''; } })()}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                              isHotelUser ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {currentUserRole}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const newRole = isHotelUser ? 'Administrador' : 'Hotel';
                                setCurrentUserRole(newRole);
                                localStorage.setItem('hotelnozap_user_role', newRole);
                                window.dispatchEvent(new CustomEvent('user_role_changed', { detail: newRole }));
                              }}
                              className="text-[9px] font-semibold text-slate-600 hover:text-emerald-800 underline cursor-pointer"
                              title="Alternar perfil para testes de permissão"
                            >
                              Mudar para {isHotelUser ? 'Admin' : 'Hotel'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Lista de Opções */}
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('perfil');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg text-emerald-700">account_circle</span>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">Meu Perfil (Minha Conta)</span>
                            <span className="text-[10px] text-slate-400 font-normal">Dados cadastrais e da conta</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            alert('Central de Suporte & Documentação Hotel no Zap');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg text-blue-600">help_outline</span>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">Ajuda</span>
                            <span className="text-[10px] text-slate-400 font-normal">Suporte e documentação</span>
                          </div>
                        </button>

                        <div className="border-t border-slate-100 my-1"></div>

                        <button
                          type="button"
                          onClick={() => handleLogout()}
                          className="w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg text-red-600">logout</span>
                          <span>Sair</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* VIEW ROUTER */}
        <div className="flex-1 overflow-y-auto" ref={mainContentRef}>
          {activeTab === 'admin-dashboard' && !isHotelUser && (
            <AdminMasterDashboard
              hideSidebar={true}
              adminName={(() => { try { return localStorage.getItem('hotelnozap_user_name') || 'Administrador'; } catch { return 'Administrador'; } })()}
              adminEmail={(() => { try { return localStorage.getItem('hotelnozap_user_email') || ''; } catch { return ''; } })()}
              onNavigateToHotelDashboard={(hotel) => {
                const freshActive: HotelAtivo = {
                  id: hotel.id,
                  name: hotel.name,
                  category: hotel.category,
                  cityUf: hotel.cityUf,
                  cnpj: hotel.cnpj,
                  status: hotel.status,
                  imageUrl: hotel.imageUrl
                };
                currentHotelService.setCurrentHotel(freshActive);
                setActiveHotel(freshActive);
                setActiveTab('dashboard');
              }}
              onNavigateToEditHotel={(hotel) => {
                setHotelToEdit(hotel);
                setActiveTab('cadastro-novo-hotel');
              }}
              onNavigateToCreateHotel={() => {
                setHotelToEdit(null);
                setActiveTab('cadastro-novo-hotel');
              }}
              onNavigateToHoteisList={() => {
                setActiveTab('cadastro-hoteis');
              }}
              onNavigateToParceiros={() => {
                setActiveTab('parceiros');
              }}
              onNavigateToPlanos={() => {
                setActiveTab('planos');
              }}
              onNavigateToCreditos={() => {
                setActiveTab('creditos-saas');
              }}
              onNavigateToUsuarios={() => {
                setActiveTab('usuarios');
              }}
              onNavigateToWhatsApp={() => {
                setActiveTab('admin-conexoes');
              }}
              onNavigateToCaixa={() => {
                setActiveTab('admin-financeiro');
              }}
              onNavigateToConfig={() => {
                setActiveTab('admin-config');
              }}
              onNavigateToMercadoPago={() => {
                setActiveTab('config-mercado-pago');
              }}
              onNavigateToLogs={() => {
                setActiveTab('logs-sistema');
              }}
              onLogout={() => handleLogout()}
            />
          )}
          {activeTab === 'dashboard' && <Dashboard onNavigateTab={(tab) => setActiveTab(tab)} />}
          {activeTab === 'mapa' && isHotelUser && (
            <MapaQuartos 
              currentUserRole={currentUserRole}
              onNavigateToDashboard={() => setActiveTab('dashboard')} 
              onNavigateToCadastroQuarto={() => {
                setQuartoToEdit(null);
                setActiveTab('cadastro-quarto');
              }}
              onEditQuarto={(room) => {
                const r = room as any;
                const cat = r.category || r.categoria || r.items?.categoria || r.items?.category || '';
                const tip = r.type || r.tipo || r.tipoQuarto || r.items?.tipoQuarto || r.items?.type || '';
                setQuartoToEdit({
                  id: room.id,
                  number: room.number,
                  name: room.name,
                  category: cat,
                  floor: room.floor,
                  capacity: room.capacity,
                  dailyPrice: room.dailyPrice,
                  active: room.active,
                  status: room.status,
                  photos: r.photos,
                  notes: r.notes,
                  items: r.items,
                  beds: r.beds,
                  type: tip,
                  comodidades: r.comodidades || r.items?.comodidades,
                });
                setActiveTab('cadastro-quarto');
              }}
              onNavigateToItens={() => setActiveTab('itens-quartos')}
              onNavigateToCategorias={() => setActiveTab('categorias-quartos')}
              onNavigateToTiposQuarto={() => setActiveTab('tipos-quartos')}
              onNavigateToDestaques={() => setActiveTab('destaques-quarto')}
            />
          )}
          {activeTab === 'cadastro-quarto' && (
            <CadastroQuarto 
              onBack={() => {
                setQuartoToEdit(null);
                setActiveTab('mapa');
              }} 
              editingQuarto={quartoToEdit}
              onClearEditingQuarto={() => setQuartoToEdit(null)}
            />
          )}
          {activeTab === 'destaques-quarto' && (
            <CadastroDestaquesQuarto
              onBack={() => setActiveTab('mapa')}
            />
          )}
          {activeTab === 'itens-quartos' && (
            <ListagemItens 
              onBack={() => setActiveTab('mapa')} 
              onNavigateToCadastroItem={() => setActiveTab('cadastro-item')}
            />
          )}
          {activeTab === 'cadastro-item' && (
            <CadastroItem 
              onBack={() => setActiveTab('itens-quartos')} 
              onSaveSuccess={() => setActiveTab('itens-quartos')}
            />
          )}
          {activeTab === 'categorias-quartos' && (
            <ListagemCategorias 
              onBack={() => setActiveTab('mapa')} 
              onNavigateToNovaCategoria={() => {
                setCategoriaToEdit(null);
                setActiveTab('cadastro-categoria');
              }}
              onNavigateToEdit={(cat) => {
                setCategoriaToEdit(cat);
                setActiveTab('cadastro-categoria');
              }}
            />
          )}
          {activeTab === 'cadastro-categoria' && (
            <CadastroCategoriaitensquarto 
              categoriaToEdit={categoriaToEdit}
              onBack={() => {
                setCategoriaToEdit(null);
                setActiveTab('categorias-quartos');
              }} 
              onSaveSuccess={() => {
                setCategoriaToEdit(null);
                setActiveTab('categorias-quartos');
              }}
            />
          )}
          {activeTab === 'hospedes' && (
            <ListagemHospedes 
              onNavigateToDashboard={() => setActiveTab('dashboard')} 
              onNavigateToNovoHospede={() => setActiveTab('cadastro-hospede')}
            />
          )}
          {activeTab === 'cadastro-hospede' && (
            <CadastroHospede 
              onBack={() => setActiveTab('hospedes')} 
              onSaveSuccess={() => setActiveTab('hospedes')}
            />
          )}
          {activeTab === 'cupons' && (
            <ListagemCupons 
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onNavigateToNovoCupom={() => {
                setCupomToEdit(null);
                setActiveTab('cadastro-cupom');
              }}
              onNavigateToEditCupom={(c) => {
                setCupomToEdit(c);
                setActiveTab('cadastro-cupom');
              }}
            />
          )}
          {activeTab === 'cadastro-cupom' && (
            <CadastroCupom 
              cupomToEdit={cupomToEdit}
              onBack={() => setActiveTab('cupons')}
              onSaveSuccess={() => setActiveTab('cupons')}
            />
          )}
          {activeTab === 'produto' && (
            <ListagemProdutos 
              onNavigateToDashboard={() => setActiveTab('dashboard')} 
              onNavigateToNovoProduto={() => setActiveTab('cadastro-produto')}
              onNavigateToNovaCategoria={() => setActiveTab('produto-categorias')}
              onNavigateToPedidosCardapio={() => setActiveTab('pedidos-cardapio')}
            />
          )}
          {activeTab === 'pedidos-cardapio' && (
            <GestaoPedidosCardapio
              hotelId={activeHotel?.id}
              hotelNome={activeHotel?.name}
              currentUser={{ role: currentUserRole, email: (typeof localStorage !== 'undefined' ? localStorage.getItem('hotelnozap_user_email') || '' : '') }}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === 'produto-categorias' && (
            <CategoriasProdutos 
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onNavigateToNovaCategoria={() => setActiveTab('cadastro-categoria-produto')}
              onNavigateToNovoProduto={() => setActiveTab('cadastro-produto')}
            />
          )}
          {activeTab === 'produto-estoque' && (
            <EstoqueProdutos 
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onNavigateToNovaMovimentacao={() => setActiveTab('cadastro-movimentacao-estoque')}
            />
          )}
          {activeTab === 'cadastro-movimentacao-estoque' && (
            <CadastroMovimentacaoEstoque 
              onBack={() => setActiveTab('produto-estoque')}
              onSaveSuccess={() => setActiveTab('produto-estoque')}
              onNavigateToNovoProduto={() => setActiveTab('cadastro-produto')}
            />
          )}
          {activeTab === 'cadastro-produto' && (
            <CadastroProduto 
              onBack={() => setActiveTab('produto')} 
              onSaveSuccess={() => setActiveTab('produto')}
            />
          )}
          {activeTab === 'cadastro-categoria-produto' && (
            <CadastroCategoriaProduto 
              onBack={() => setActiveTab('produto-categorias')} 
              onSaveSuccess={() => setActiveTab('produto-categorias')}
            />
          )}
          {activeTab === 'reservas' && (
            <ListagemReservas 
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onNavigateToNovaReserva={() => setActiveTab('cadastro-reserva')}
            />
          )}
          {activeTab === 'cadastro-reserva' && (
            <CadastroReserva 
              onBack={() => setActiveTab('reservas')}
              onSaveSuccess={() => setActiveTab('reservas')}
            />
          )}
          {activeTab === 'tipos-quartos' && (
            <ListagemTiposQuartos 
              onBack={() => setActiveTab('mapa')} 
              onNavigateToNovoTipo={() => setActiveTab('cadastro-tipo-quarto')}
            />
          )}
          {activeTab === 'cadastro-tipo-quarto' && (
            <CadastroTipoQuarto 
              onBack={() => setActiveTab('tipos-quartos')}
              onSaveSuccess={() => setActiveTab('tipos-quartos')}
            />
          )}
          {(activeTab === 'caixa' || activeTab === 'controle-caixa') && (
            <ControleCaixa 
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onNavigateToContasPagar={() => setActiveTab('contas-pagar')}
              onNavigateToContasReceber={() => setActiveTab('contas-receber')}
            />
          )}
          {activeTab === 'contas-pagar' && (
            <ListagemContasPagar 
              onBack={() => setActiveTab('caixa')}
              onNavigateToCreate={() => setActiveTab('cadastro-conta-pagar')}
              onNavigateToCategorias={() => setActiveTab('categorias-contas-pagar')}
            />
          )}
          {activeTab === 'categorias-contas-pagar' && (
            <CategoriasContasPagar 
              onBack={() => setActiveTab('contas-pagar')}
              onNavigateToNovaCategoria={() => setActiveTab('cadastro-categoria-conta-pagar')}
            />
          )}
          {activeTab === 'cadastro-categoria-conta-pagar' && (
            <CadastroCategoriaContaPagar 
              onBack={() => setActiveTab('categorias-contas-pagar')}
              onSaveSuccess={() => setActiveTab('categorias-contas-pagar')}
            />
          )}
          {activeTab === 'cadastro-conta-pagar' && (
            <CadastroContaPagar 
              onBack={() => setActiveTab('contas-pagar')}
              onSaveSuccess={() => setActiveTab('contas-pagar')}
            />
          )}
          {activeTab === 'contas-receber' && (
            <ListagemContasReceber 
              onBack={() => setActiveTab('caixa')}
              onNavigateToCreate={() => setActiveTab('cadastro-conta-receber')}
              onNavigateToCategorias={() => setActiveTab('categorias-contas-receber')}
            />
          )}
          {activeTab === 'categorias-contas-receber' && (
            <CategoriasContasReceber 
              onBack={() => setActiveTab('contas-receber')}
              onNavigateToNovaCategoria={() => setActiveTab('cadastro-categoria-conta-receber')}
            />
          )}
          {activeTab === 'cadastro-categoria-conta-receber' && (
            <CadastroCategoriaContaReceber 
              onBack={() => setActiveTab('categorias-contas-receber')}
              onSaveSuccess={() => setActiveTab('categorias-contas-receber')}
            />
          )}
          {activeTab === 'cadastro-conta-receber' && (
            <CadastroContaReceber 
              onBack={() => setActiveTab('contas-receber')}
              onSaveSuccess={() => setActiveTab('contas-receber')}
            />
          )}
          {(activeTab === 'conexao' || activeTab === 'conexoes-whatsapp') && (
            <ConexoesWhatsapp 
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onNavigateToUpgrade={() => setActiveTab(isHotelUser ? 'assinar' : 'planos')}
            />
          )}
          {activeTab === 'parceiros' && !isHotelUser && (
            <ListagemParceiros 
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
              onNavigateToCreate={() => {
                setPartnerToEdit(null);
                setActiveTab('cadastro-parceiro');
              }}
              onNavigateToEdit={(partner) => {
                setPartnerToEdit(partner);
                setActiveTab('cadastro-parceiro');
              }}
              onNavigateToCreateHotelWithPartner={(partner) => {
                setPreselectedPartner(partner);
                setHotelToEdit(null);
                setActiveTab('cadastro-novo-hotel');
              }}
            />
          )}
          {activeTab === 'cadastro-parceiro' && !isHotelUser && (
            <CadastroParceiro 
              partnerToEdit={partnerToEdit}
              onBack={() => setActiveTab('parceiros')}
              onSaveSuccess={() => setActiveTab('parceiros')}
            />
          )}
          {activeTab === 'cadastro-hoteis' && (
            <CadastroHoteis 
              onBackToDashboard={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
              onNavigateToCategories={() => setActiveTab('categorias-hoteis')}
              onNavigateToCreate={() => {
                setHotelToEdit(null);
                setPreselectedPartner(null);
                setActiveTab('cadastro-novo-hotel');
              }}
              onNavigateToEdit={(hotel) => {
                setHotelToEdit(hotel);
                setPreselectedPartner(null);
                setActiveTab('cadastro-novo-hotel');
              }}
              onNavigateToHotelDashboard={(hotel) => {
                const freshActive: HotelAtivo = {
                  id: hotel.id,
                  name: hotel.name,
                  category: hotel.category,
                  cityUf: hotel.cityUf,
                  cnpj: hotel.cnpj,
                  status: hotel.status,
                  imageUrl: hotel.imageUrl
                };
                currentHotelService.setCurrentHotel(freshActive);
                setActiveHotel(freshActive);
                setActiveTab('dashboard');
              }}
            />
          )}
          {activeTab === 'categorias-hoteis' && (
            <ListagemCategoriasHotel
              onBackToHoteis={() => setActiveTab('cadastro-hoteis')}
              onNavigateToCreate={() => {
                setCategoriaHotelToEdit(null);
                setActiveTab('cadastro-categoria-hotel');
              }}
              onNavigateToEdit={(cat) => {
                setCategoriaHotelToEdit(cat);
                setActiveTab('cadastro-categoria-hotel');
              }}
            />
          )}
          {activeTab === 'cadastro-categoria-hotel' && (
            <CadastroCategoriaHotel
              categoriaToEdit={categoriaHotelToEdit}
              onBack={() => {
                setCategoriaHotelToEdit(null);
                setActiveTab('categorias-hoteis');
              }}
              onSaveSuccess={() => {
                setCategoriaHotelToEdit(null);
                setActiveTab('categorias-hoteis');
              }}
            />
          )}
          {activeTab === 'status-quartos' && (
            <ListagemStatusQuartos
              onBackToDashboard={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
              currentUserRole={currentUserRole || localStorage.getItem('hotelnozap_user_role') || ''}
              isHotelUser={isHotelUser}
            />
          )}
          {activeTab === 'cadastro-novo-hotel' && (
            <FormHotel 
              key={hotelToEdit ? hotelToEdit.id : 'novo-hotel'}
              hotelToEdit={hotelToEdit}
              preselectedPartner={preselectedPartner}
              isAdmin={!isHotelUser}
              userRole={currentUserRole}
              onBack={() => {
                setPreselectedPartner(null);
                setHotelToEdit(null);
                setActiveTab('cadastro-hoteis');
              }}
              onSaveSuccess={() => {
                setPreselectedPartner(null);
                setHotelToEdit(null);
                setActiveTab('cadastro-hoteis');
              }}
            />
          )}
          {(activeTab === 'config' || activeTab === 'config-hotel') && (
            <ConfiguracoesHotel 
              initialTab="horarios"
              onBackToDashboard={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
            />
          )}
          {activeTab === 'config-mercado-pago' && !isHotelUser && (
            <ConfiguracoesMercadoPago 
              isAdmin={true}
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
            />
          )}
          {activeTab === 'config-mercado-pago' && isHotelUser && (
            <ConfiguracoesMercadoPago 
              isAdmin={false}
              hotelId={activeHotel?.id}
              hotelNome={activeHotel?.name}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}
          {activeTab === 'planos' && !isHotelUser && (
            <ListagemPlanos 
              onNavigateToDashboard={() => setActiveTab('admin-dashboard')}
              onNavigateToCreate={() => {
                setPlanToEdit(null);
                setActiveTab('cadastro-plano');
              }}
              onNavigateToEdit={(plan) => {
                setPlanToEdit(plan);
                setActiveTab('cadastro-plano');
              }}
            />
          )}
          {activeTab === 'cadastro-plano' && !isHotelUser && (
            <CadastroPlano 
              planToEdit={planToEdit}
              onBack={() => {
                setPlanToEdit(null);
                setActiveTab('planos');
              }}
              onSaveSuccess={() => {
                setPlanToEdit(null);
                setActiveTab('planos');
              }}
            />
          )}
          {activeTab === 'creditos-saas' && !isHotelUser && (
            <GestaoCreditosSaaS 
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
              onNavigateToHotel={(hotel) => {
                currentHotelService.setCurrentHotel({
                  id: hotel.id,
                  name: hotel.name,
                  category: hotel.category,
                  cnpj: hotel.cnpj,
                  cityUf: hotel.cityUf,
                  status: hotel.status as any,
                  imageUrl: hotel.imageUrl
                });
                setActiveTab('dashboard');
              }}
            />
          )}
          {activeTab === 'admin-conexoes' && !isHotelUser && (
            <AdminConexoesWhatsapp
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
              onNavigateToHotel={(hotelId) => {
                const targetHotel = (INITIAL_HOTEIS || []).find((h) => h.id === hotelId);
                if (targetHotel) {
                  currentHotelService.setCurrentHotel({
                    id: targetHotel.id,
                    name: targetHotel.name,
                    category: targetHotel.category,
                    cnpj: targetHotel.cnpj,
                    cityUf: targetHotel.cityUf,
                    status: targetHotel.status as any,
                    imageUrl: targetHotel.imageUrl
                  });
                  setActiveTab('dashboard');
                }
              }}
            />
          )}
          {activeTab === 'admin-financeiro' && !isHotelUser && (
            <ReceitaRepasses
              onNavigateToDashboard={() => setActiveTab('admin-dashboard')}
              adminEmail={localStorage.getItem('hotelnozap_user_email') || 'master@hotelnozap.com.br'}
              adminName={localStorage.getItem('hotelnozap_user_name') || 'Super Admin Master'}
            />
          )}
          {activeTab === 'admin-config' && !isHotelUser && (
            <ParametrosSistema
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
            />
          )}
          {activeTab === 'logs-sistema' && !isHotelUser && (
            <LogsSistema
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
            />
          )}
          {activeTab === 'admin-notificacoes' && !isHotelUser && (
            <NotificacoesPushAdmin
              onBackToDashboard={() => setActiveTab('admin-dashboard')}
            />
          )}

          {activeTab === 'relatorios' && (
            <RelatoriosHotel 
              activeHotel={activeHotel}
              onBackToDashboard={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
            />
          )}

          {activeTab === 'tutoriais' && (
            <Tutoriais 
              onBackToDashboard={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
            />
          )}
          {(activeTab === 'perfil' || activeTab === 'minhaconta') && (
            <FormHotel 
              isProfileView={true}
              isAdmin={!isHotelUser}
              userRole={currentUserRole}
              onBack={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
              onSaveSuccess={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
            />
          )}
          {activeTab === 'usuarios' && (
            <ListagemUsuarios 
              isHotelScope={isHotelUser}
              hotelId={activeHotel?.id}
              onNavigateToDashboard={() => setActiveTab(!isHotelUser ? 'admin-dashboard' : 'dashboard')}
              onNavigateToCreate={() => {
                setUserToEdit(null);
                setActiveTab('cadastro-usuario');
              }}
              onNavigateToEdit={(user) => {
                setUserToEdit(user);
                setActiveTab('cadastro-usuario');
              }}
              onNavigateToTiposUsuarios={() => {
                setActiveTab('tipos-usuarios');
              }}
            />
          )}
          {activeTab === 'cadastro-usuario' && (
            <FormUsuario 
              userToEdit={userToEdit}
              isHotelScope={isHotelUser}
              hotelId={activeHotel?.id}
              onBack={() => setActiveTab('usuarios')}
              onSaveSuccess={() => setActiveTab('usuarios')}
            />
          )}
          {activeTab === 'tipos-usuarios' && (
            <ListagemTiposUsuarios 
              onBack={() => setActiveTab('usuarios')}
              onNavigateToNovoTipo={() => {
                setTipoUsuarioToEdit(null);
                setActiveTab('cadastro-tipo-usuario');
              }}
              onNavigateToEditTipo={(tipo) => {
                setTipoUsuarioToEdit(tipo);
                setActiveTab('cadastro-tipo-usuario');
              }}
            />
          )}
          {activeTab === 'cadastro-tipo-usuario' && (
            <FormTipoUsuario 
              tipoUsuarioToEdit={tipoUsuarioToEdit}
              onBack={() => {
                setTipoUsuarioToEdit(null);
                setActiveTab('tipos-usuarios');
              }}
              onSaveSuccess={() => {
                setTipoUsuarioToEdit(null);
                setActiveTab('tipos-usuarios');
              }}
            />
          )}
          {activeTab !== 'dashboard' && activeTab !== 'admin-dashboard' && activeTab !== 'admin-conexoes' && activeTab !== 'admin-notificacoes' && activeTab !== 'admin-financeiro' && activeTab !== 'admin-config' && activeTab !== 'logs-sistema' && activeTab !== 'mapa' && activeTab !== 'cadastro-quarto' && activeTab !== 'destaques-quarto' && activeTab !== 'itens-quartos' && activeTab !== 'cadastro-item' && activeTab !== 'categorias-quartos' && activeTab !== 'cadastro-categoria' && activeTab !== 'hospedes' && activeTab !== 'cadastro-hospede' && activeTab !== 'cupons' && activeTab !== 'cadastro-cupom' && activeTab !== 'cadastro-hoteis' && activeTab !== 'cadastro-novo-hotel' && activeTab !== 'categorias-hoteis' && activeTab !== 'cadastro-categoria-hotel' && activeTab !== 'status-quartos' && activeTab !== 'produto' && activeTab !== 'produto-categorias' && activeTab !== 'produto-estoque' && activeTab !== 'pedidos-cardapio' && activeTab !== 'cadastro-movimentacao-estoque' && activeTab !== 'cadastro-produto' && activeTab !== 'cadastro-categoria-produto' && activeTab !== 'reservas' && activeTab !== 'cadastro-reserva' && activeTab !== 'tipos-quartos' && activeTab !== 'cadastro-tipo-quarto' && activeTab !== 'caixa' && activeTab !== 'controle-caixa' && activeTab !== 'contas-pagar' && activeTab !== 'categorias-contas-pagar' && activeTab !== 'cadastro-categoria-conta-pagar' && activeTab !== 'cadastro-conta-pagar' && activeTab !== 'contas-receber' && activeTab !== 'categorias-contas-receber' && activeTab !== 'cadastro-categoria-conta-receber' && activeTab !== 'cadastro-conta-receber' && activeTab !== 'conexao' && activeTab !== 'conexoes-whatsapp' && activeTab !== 'parceiros' && activeTab !== 'cadastro-parceiro' && activeTab !== 'config-mercado-pago' && activeTab !== 'config' && activeTab !== 'config-hotel' && activeTab !== 'planos' && activeTab !== 'cadastro-plano' && activeTab !== 'creditos-saas' && activeTab !== 'relatorios' && activeTab !== 'tutoriais' && activeTab !== 'perfil' && activeTab !== 'minhaconta' && activeTab !== 'usuarios' && activeTab !== 'cadastro-usuario' && activeTab !== 'tipos-usuarios' && activeTab !== 'cadastro-tipo-usuario' && (
            <div className="p-8 text-center text-[#45464d]">
              <h2 className="text-xl font-bold text-[#0b1c30] mb-2">Tela em construção</h2>
              <p className="text-sm">Envie a imagem/especificação desta tela para darmos início ao desenvolvimento.</p>
            </div>
          )}
        </div>
      </main>

      {/* MOBILE STICKY BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-[#c6c6cd]/40 px-2 py-2 flex justify-around items-center z-40 lg:hidden shadow-[0_-2px_8px_-2px_rgba(19,27,46,0.1)]">
        {!isHotelUser ? (
          <>
            <button 
              onClick={() => setActiveTab('admin-dashboard')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'admin-dashboard' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-xl " + (activeTab === 'admin-dashboard' ? 'icon-fill' : '')}>admin_panel_settings</span>
              <span className="text-[10px]">Admin</span>
            </button>

            <button 
              onClick={() => setActiveTab('cadastro-hoteis')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'cadastro-hoteis' || activeTab === 'cadastro-novo-hotel' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-xl " + (activeTab === 'cadastro-hoteis' || activeTab === 'cadastro-novo-hotel' ? 'icon-fill' : '')}>domain</span>
              <span className="text-[10px]">Hotéis</span>
            </button>

            <button 
              onClick={() => setActiveTab('parceiros')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'parceiros' || activeTab === 'cadastro-parceiro' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-xl " + (activeTab === 'parceiros' || activeTab === 'cadastro-parceiro' ? 'icon-fill' : '')}>handshake</span>
              <span className="text-[10px]">Parceiros</span>
            </button>

            <button 
              onClick={() => setActiveTab('planos')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'planos' || activeTab === 'cadastro-plano' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-xl " + (activeTab === 'planos' || activeTab === 'cadastro-plano' ? 'icon-fill' : '')}>sell</span>
              <span className="text-[10px]">Planos</span>
            </button>

            <button 
              onClick={() => setActiveTab('usuarios')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'usuarios' || activeTab === 'cadastro-usuario' || activeTab === 'tipos-usuarios' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-xl " + (activeTab === 'usuarios' || activeTab === 'cadastro-usuario' || activeTab === 'tipos-usuarios' ? 'icon-fill' : '')}>manage_accounts</span>
              <span className="text-[10px]">Usuários</span>
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'dashboard' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-2xl " + (activeTab === 'dashboard' ? 'icon-fill' : '')}>dashboard</span>
              <span className="text-[11px]">Dashboard</span>
            </button>

            <button 
              onClick={() => setActiveTab('mapa')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'mapa' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-2xl " + (activeTab === 'mapa' ? 'icon-fill' : '')}>grid_view</span>
              <span className="text-[11px]">Mapa</span>
            </button>

            <button 
              onClick={() => setActiveTab('reservas')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'reservas' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-2xl " + (activeTab === 'reservas' ? 'icon-fill' : '')}>calendar_month</span>
              <span className="text-[11px]">Reservas</span>
            </button>

            <button 
              onClick={() => setActiveTab('caixa')}
              className={
                "flex flex-col items-center gap-0.5 flex-1 transition-colors " +
                (activeTab === 'caixa' ? 'text-[#006c49] font-bold' : 'text-[#45464d] hover:text-[#0b1c30]')
              }
            >
              <span className={"material-symbols-outlined text-2xl " + (activeTab === 'caixa' ? 'icon-fill' : '')}>account_balance_wallet</span>
              <span className="text-[11px]">Financeiro</span>
            </button>
          </>
        )}
      </nav>

    </div>
  );
};

export default App;
