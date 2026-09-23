import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  hoteisService, 
  produtosService, 
  hospedesService, 
  reservasService,
  currentHotelService
} from '../services/supabaseService';
import { Hotel } from './CadastroHoteis';
import { 
  pedidosCardapioService, 
  PedidoCardapio, 
  PedidoCardapioItem 
} from '../services/pedidosCardapioService';
import { ProductData } from './ListagemProdutos';

export interface CardapioHotelProps {
  hotelSlug?: string;
  onNavigateHome?: () => void;
  onNavigateToLogin?: () => void;
}

export const CardapioHotel: React.FC<CardapioHotelProps> = ({
  hotelSlug,
  onNavigateHome,
  onNavigateToLogin
}) => {
  // Estado do Hotel
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loadingHotel, setLoadingHotel] = useState(true);

  // Produtos do Hotel
  const [produtos, setProdutos] = useState<ProductData[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todas');
  const [busca, setBusca] = useState<string>('');
  const [expandirTodos, setExpandirTodos] = useState<boolean>(false);

  // Carrinho de Compras
  const [carrinho, setCarrinho] = useState<Map<string, number>>(new Map());
  const [observacoesItens, setObservacoesItens] = useState<Map<string, string>>(new Map());
  const [isCarrinhoModalOpen, setIsCarrinhoModalOpen] = useState(false);

  // Modal de Detalhes / Adicionar Produto (Estilo ZapZap Delivery)
  const [produtoModal, setProdutoModal] = useState<ProductData | null>(null);
  const [modalQtd, setModalQtd] = useState<number>(1);
  const [modalObs, setModalObs] = useState<string>('');

  // Hóspede & Check-in (Sem parâmetros de mesa - identidade exclusiva por Quarto e Check-in)
  const [hospedeLogado, setHospedeLogado] = useState<any>(null);
  const [temCheckinValido, setTemCheckinValido] = useState<boolean>(false);
  const [dadosReservaAtiva, setDadosReservaAtiva] = useState<any>(null);

  // Modal de Identificação do Hóspede
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginTab, setLoginTab] = useState<'quarto' | 'credenciais'>('quarto');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginQuarto, setLoginQuarto] = useState('');
  const [loginCpfOuSobrenome, setLoginCpfOuSobrenome] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Visualização Atual: 'cardapio' | 'checkout' | 'sucesso' | 'meus_pedidos'
  const [viewState, setViewState] = useState<'cardapio' | 'checkout' | 'sucesso' | 'meus_pedidos'>('cardapio');
  const [ultimoPedidoCriado, setUltimoPedidoCriado] = useState<PedidoCardapio | null>(null);
  const [observacoesPedido, setObservacoesPedido] = useState<string>('');
  const [isSubmittingPedido, setIsSubmittingPedido] = useState(false);

  // Histórico de pedidos do hóspede
  const [meusPedidos, setMeusPedidos] = useState<PedidoCardapio[]>([]);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Carregar Hotel a partir do Slug da URL
  useEffect(() => {
    const carregarHotel = async () => {
      setLoadingHotel(true);
      try {
        const slugFromUrl = hotelSlug || 
          window.location.pathname.replace(/^\/hoteis\/cardapio\/?/i, '').split('/')[0] || '';
        const cleanSlug = slugFromUrl.toLowerCase().trim();

        const todosHoteis = await hoteisService.getHoteis();
        let encontrado = todosHoteis.find(h => {
          const sName = (h.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const sLink = (h.link || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cId = (h.id || '').toLowerCase();
          return sName === cleanSlug || sLink.includes(cleanSlug) || cId === cleanSlug;
        });

        if (!encontrado && todosHoteis.length > 0) {
          const currentH = currentHotelService.getCurrentHotel();
          encontrado = todosHoteis.find(h => h.id === currentH.id) || todosHoteis[0];
        }

        setHotel(encontrado || null);
      } catch (err) {
        console.error('Erro ao carregar hotel do cardápio:', err);
      } finally {
        setLoadingHotel(false);
      }
    };

    carregarHotel();
  }, [hotelSlug]);

  // 2. Carregar Produtos e Verificar Hóspede Logado
  useEffect(() => {
    if (!hotel) return;

    const carregarDados = async () => {
      setLoadingProdutos(true);
      try {
        const prods = await produtosService.getProdutos(hotel.id);
        setProdutos(prods || []);
        await verificarAutenticacaoHospede(hotel.id);
      } catch (err) {
        console.error('Erro ao carregar cardápio e autenticação:', err);
      } finally {
        setLoadingProdutos(false);
      }
    };

    carregarDados();
  }, [hotel]);

  // Função central para validar se o hóspede tem check-in ativo neste hotel
  const verificarAutenticacaoHospede = async (hotelId: string) => {
    try {
      const emailSalvo = localStorage.getItem('hotelnozap_user_email');
      const nomeSalvo = localStorage.getItem('hotelnozap_user_name');

      if (!emailSalvo && !nomeSalvo) {
        setHospedeLogado(null);
        setTemCheckinValido(false);
        setDadosReservaAtiva(null);
        return;
      }

      const perfil = await hospedesService.getPerfilHospedeLogado(emailSalvo || nomeSalvo || '');
      if (perfil) {
        setHospedeLogado(perfil);

        const reservas = await reservasService.getReservas(hotelId);
        const pEmail = (perfil.email || '').toLowerCase().trim();
        const pNome = (perfil.nome || '').toLowerCase().trim();
        const pCpf = (perfil.cpf || '').replace(/\D/g, '');

        const reservaAtiva = reservas.find((r: any) => {
          const rEmail = (r.email || r.observacoes || '').toLowerCase();
          const rNome = (r.nome_hospede || '').toLowerCase();
          const rCpf = (r.cpf || '').replace(/\D/g, '');
          const matchPessoa = 
            (pEmail && rEmail.includes(pEmail)) ||
            (pNome && rNome.includes(pNome)) ||
            (pCpf && rCpf === pCpf);

          const st = (r.status || '').toLowerCase();
          const isAtiva = 
            st === 'confirmada' || 
            st === 'hospedado' || 
            st === 'em andamento' || 
            st === 'em_andamento' || 
            st === 'ativo' ||
            st === 'check-in';

          return matchPessoa && isAtiva;
        });

        if (reservaAtiva) {
          setTemCheckinValido(true);
          setDadosReservaAtiva(reservaAtiva);
        } else if (perfil.temCheckinAtivo) {
          setTemCheckinValido(true);
          setDadosReservaAtiva({
            id: perfil.reservaCodigo || 'RES-ATUAL',
            quarto_numero: perfil.quartoNumero || '104',
            quarto_tipo: perfil.quartoTipo || 'Suíte Master',
            data_checkin: perfil.dataCheckin,
            data_checkout: perfil.dataCheckout
          });
        } else {
          setTemCheckinValido(false);
          setDadosReservaAtiva(null);
        }

        const pedidos = await pedidosCardapioService.getPedidosHospede(perfil.email || perfil.id, hotelId);
        setMeusPedidos(pedidos);
      }
    } catch (e) {
      console.warn('Erro ao verificar autenticação do hóspede:', e);
    }
  };

  // Categorias únicas dos produtos
  const categoriasDisponiveis = useMemo(() => {
    const setCat = new Set<string>();
    produtos.forEach(p => {
      if (p.category) setCat.add(p.category.trim());
    });
    return Array.from(setCat);
  }, [produtos]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchCat = categoriaSelecionada === 'todas' || 
        (p.category || '').toLowerCase() === categoriaSelecionada.toLowerCase();
      const matchBusca = !busca.trim() || 
        (p.name || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca && p.status !== 'inativo';
    });
  }, [produtos, categoriaSelecionada, busca]);

  // Manipulação de Carrinho
  const handleAlterarQuantidade = (produtoId: string, delta: number) => {
    setCarrinho(prev => {
      const novo = new Map(prev);
      const atual = novo.get(produtoId) || 0;
      const proximaQtd = atual + delta;
      if (proximaQtd <= 0) {
        novo.delete(produtoId);
      } else {
        novo.set(produtoId, proximaQtd);
      }
      return novo;
    });
  };

  // Abrir Modal de Produto estilo ZapZap Delivery
  const handleAbrirModalProduto = (prod: ProductData) => {
    const qtdAtual = carrinho.get(prod.id) || 1;
    const obsAtual = observacoesItens.get(prod.id) || '';
    setProdutoModal(prod);
    setModalQtd(qtdAtual > 0 ? qtdAtual : 1);
    setModalObs(obsAtual);
  };

  // Salvar item do Modal no Carrinho
  const handleSalvarItemModal = () => {
    if (!produtoModal) return;
    setCarrinho(prev => {
      const novo = new Map(prev);
      novo.set(produtoModal.id, modalQtd);
      return novo;
    });
    if (modalObs.trim()) {
      setObservacoesItens(prev => {
        const novo = new Map(prev);
        novo.set(produtoModal.id, modalObs.trim());
        return novo;
      });
    }
    showToast(`🛒 "${produtoModal.name}" adicionado ao pedido.`);
    setProdutoModal(null);
  };

  // Adicionar rápido ao carrinho
  const handleAdicionarItemDireto = (e: React.MouseEvent, prod: ProductData) => {
    e.stopPropagation();
    handleAlterarQuantidade(prod.id, 1);
    showToast(`🛒 "${prod.name}" adicionado ao pedido.`);
  };

  // Itens calculados do carrinho
  const itensCarrinho: PedidoCardapioItem[] = useMemo(() => {
    const lista: PedidoCardapioItem[] = [];
    carrinho.forEach((qtd, pId) => {
      const p = produtos.find(prod => prod.id === pId);
      if (p && qtd > 0) {
        lista.push({
          id: `item-${p.id}`,
          produtoId: p.id,
          nome: p.name,
          categoria: p.category || 'Geral',
          precoUnitario: p.price,
          quantidade: qtd,
          subtotal: p.price * qtd,
          foto: p.image,
          observacoes: observacoesItens.get(p.id)
        });
      }
    });
    return lista;
  }, [carrinho, produtos, observacoesItens]);

  const totalCarrinho = useMemo(() => {
    return itensCarrinho.reduce((acc, item) => acc + item.subtotal, 0);
  }, [itensCarrinho]);

  const totalItensCount = useMemo(() => {
    let count = 0;
    carrinho.forEach(q => count += q);
    return count;
  }, [carrinho]);

  // Iniciar Checkout Interno (sem taxas de entrega, sem km, sem bairro, sem mesa)
  const handleIniciarCheckout = () => {
    if (itensCarrinho.length === 0) {
      showToast('Seu carrinho está vazio. Escolha produtos para fazer um pedido.');
      return;
    }

    if (!hospedeLogado || !temCheckinValido) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsCarrinhoModalOpen(false);
    setViewState('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Login do Hóspede via Modal Inteligente
  const handleExecutarLoginHospede = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);

    try {
      if (loginTab === 'quarto') {
        if (!loginQuarto.trim() || !loginCpfOuSobrenome.trim()) {
          setLoginError('Por favor, informe o número do quarto e o CPF ou sobrenome do titular.');
          setIsAuthenticating(false);
          return;
        }

        const reservas = await reservasService.getReservas(hotel?.id);
        const cleanQuarto = loginQuarto.trim();
        const cleanTermo = loginCpfOuSobrenome.trim().toLowerCase();

        const reservaEncontrada = reservas.find((r: any) => {
          const matchQuarto = String(r.numero_quarto || r.quartoNome || '').trim().toLowerCase().includes(cleanQuarto);
          const rNome = (r.hospedeNome || r.nome_hospede || '').toLowerCase();
          const rCpf = (r.cpf || '').replace(/\D/g, '');
          const matchTermo = rNome.includes(cleanTermo) || rCpf.includes(cleanTermo);
          return matchQuarto && matchTermo;
        });

        if (reservaEncontrada) {
          localStorage.setItem('hotelnozap_user_email', (reservaEncontrada as any).hospedeEmail || (reservaEncontrada as any).email || `hospede.quarto${cleanQuarto}@hotelnozap.com.br`);
          localStorage.setItem('hotelnozap_user_name', (reservaEncontrada as any).hospedeNome || (reservaEncontrada as any).nome_hospede || `Hóspede Quarto ${cleanQuarto}`);
          localStorage.setItem('hotelnozap_user_role', 'hospede');

          await verificarAutenticacaoHospede(hotel?.id || '');
          setIsLoginModalOpen(false);
          showToast(`✅ Identificado com sucesso! Bem-vindo(a), Quarto ${cleanQuarto}.`);

          if (itensCarrinho.length > 0) {
            setViewState('checkout');
          }
        } else {
          setLoginError(`Não encontramos check-in ativo para o Quarto "${cleanQuarto}" com este titular no ${hotel?.name || 'hotel'}. Por favor, verifique os dados ou fale com a recepção.`);
        }
      } else {
        if (!loginEmail.trim()) {
          setLoginError('Informe seu e-mail cadastrado na reserva.');
          setIsAuthenticating(false);
          return;
        }

        localStorage.setItem('hotelnozap_user_email', loginEmail.trim().toLowerCase());
        localStorage.setItem('hotelnozap_user_role', 'hospede');

        await verificarAutenticacaoHospede(hotel?.id || '');
        setIsLoginModalOpen(false);
        showToast('✅ Login realizado com sucesso!');

        if (itensCarrinho.length > 0) {
          setViewState('checkout');
        }
      }
    } catch (err: any) {
      setLoginError(`Erro ao autenticar: ${err.message || err}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Finalizar e Registrar Pedido na Conta do Quarto
  const handleConfirmarPedidoFinal = async () => {
    if (!hotel || itensCarrinho.length === 0) return;

    if (!hospedeLogado || !temCheckinValido) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsSubmittingPedido(true);
    try {
      const quartoNum = dadosReservaAtiva?.numero_quarto || dadosReservaAtiva?.quarto_numero || '104';
      const quartoTp = dadosReservaAtiva?.quarto_tipo || 'Acomodação';

      const novoPedido = await pedidosCardapioService.criarPedido({
        hotelId: hotel.id,
        hotelNome: hotel.name,
        hospedeId: hospedeLogado.id || 'hospede-temp',
        hospedeNome: hospedeLogado.nome || 'Hóspede',
        hospedeEmail: hospedeLogado.email || '',
        hospedeCpf: hospedeLogado.cpf || '',
        hospedeTelefone: hospedeLogado.telefone || '',
        quartoNumero: quartoNum,
        quartoTipo: quartoTp,
        reservaId: dadosReservaAtiva?.id || '',
        itens: itensCarrinho,
        valorTotal: totalCarrinho,
        observacoesGerais: observacoesPedido.trim()
      });

      setUltimoPedidoCriado(novoPedido);
      setCarrinho(new Map());
      setObservacoesItens(new Map());
      setObservacoesPedido('');
      setViewState('sucesso');

      const pedidosAtualizados = await pedidosCardapioService.getPedidosHospede(hospedeLogado.email || hospedeLogado.id, hotel.id);
      setMeusPedidos(pedidosAtualizados);

      showToast(`🛎️ Pedido ${novoPedido.codigo} lançado na conta do seu quarto!`);
    } catch (err) {
      console.error('Erro ao finalizar pedido:', err);
      showToast('Não foi possível enviar seu pedido. Tente novamente ou fale com a recepção.');
    } finally {
      setIsSubmittingPedido(false);
    }
  };

  // Helper para imagem temática do produto caso não possua foto cadastrada
  const getProductImage = (prod: ProductData) => {
    if (prod.image && prod.image.trim() !== '') return prod.image;
    const c = (prod.category || '').toLowerCase();
    if (c.includes('bebida') || c.includes('drink') || c.includes('agua') || c.includes('suco') || c.includes('refrigerante')) {
      return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80';
    }
    if (c.includes('cafe') || c.includes('cha') || c.includes('lanche') || c.includes('smash') || c.includes('burger') || c.includes('hamburguer')) {
      return 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80';
    }
    if (c.includes('sobremesa') || c.includes('doce') || c.includes('shake') || c.includes('brownie')) {
      return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&auto=format&fit=crop&q=80';
    }
    if (c.includes('porcao') || c.includes('batata') || c.includes('fritas') || c.includes('petisco')) {
      return 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80';
    }
    if (c.includes('higiene') || c.includes('amenities')) {
      return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
  };

  // Renderizador de Card Individual de Produto (Inspirado no ZapZap Delivery com 5 cards por linha no desktop)
  const renderCardProduto = (prod: ProductData) => {
    const qtdNoCarrinho = carrinho.get(prod.id) || 0;
    const fotoUrl = getProductImage(prod);
    const esgotado = prod.stock !== undefined && prod.stock <= 0;

    return (
      <div 
        key={prod.id} 
        onClick={() => handleAbrirModalProduto(prod)}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-500/50 transition-all duration-200 flex flex-col justify-between overflow-hidden group cursor-pointer"
      >
        <div>
          {/* Foto do Produto */}
          <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
            <img 
              src={fotoUrl} 
              alt={prod.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {prod.category && (
              <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-black/60 backdrop-blur-md text-white border border-white/20">
                {prod.category}
              </span>
            )}
            {esgotado ? (
              <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white shadow-xs">
                Esgotado
              </span>
            ) : prod.stock !== undefined && prod.stock <= 5 ? (
              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                Últimas {prod.stock} un
              </span>
            ) : null}
          </div>

          {/* Informações */}
          <div className="p-3.5 space-y-1.5">
            <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-1" title={prod.name}>
              {prod.name}
            </h3>
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed h-8">
              {prod.description || 'Item selecionado para atendimento e serviço no seu quarto.'}
            </p>
          </div>
        </div>

        {/* Rodapé do Card: Preço e Controles */}
        <div className="p-3.5 pt-0 flex items-center justify-between gap-2 border-t border-slate-100/80 mt-2">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Preço</span>
            <span className="text-sm sm:text-base font-extrabold text-slate-900">
              R$ {prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Controles de Quantidade */}
          {esgotado ? (
            <span className="text-xs font-bold text-slate-400 italic">Indisponível</span>
          ) : qtdNoCarrinho > 0 ? (
            <div 
              className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-1 rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleAlterarQuantidade(prod.id, -1)}
                className="w-7 h-7 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center transition cursor-pointer shadow-2xs"
                title="Diminuir"
              >
                -
              </button>
              <span className="w-5 text-center text-xs font-black text-emerald-950">
                {qtdNoCarrinho}
              </span>
              <button
                type="button"
                onClick={() => handleAlterarQuantidade(prod.id, 1)}
                className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center justify-center transition cursor-pointer shadow-2xs"
                title="Aumentar"
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => handleAdicionarItemDireto(e, prod)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
              <span>Adicionar</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loadingHotel) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-slate-300 font-medium">Carregando cardápio oficial do hotel...</p>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
          <span className="material-symbols-outlined text-3xl">restaurant_menu</span>
        </div>
        <h2 className="text-2xl font-black">Cardápio Não Encontrado</h2>
        <p className="text-sm text-slate-400 max-w-md mt-2">
          Não localizamos o hotel correspondente a esta URL. Por favor, confira o link informado ou acesse a página inicial do hotel.
        </p>
        <button
          onClick={onNavigateHome || (() => window.location.href = '/')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
        >
          Voltar à Página Inicial
        </button>
      </div>
    );
  }

  const quartoAtivoNumero = dadosReservaAtiva?.numero_quarto || dadosReservaAtiva?.quarto_numero || '104';

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col antialiased selection:bg-emerald-600 selection:text-white pb-10">
      {/* Toast de Notificação */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-slate-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. HEADER DESKTOP (Estilo ZapZap Delivery: Logo + Busca + Ações + Quarto)   */}
      {/* ========================================================================= */}
      <header className="hidden md:block sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl 2xl:max-w-[1720px] mx-auto px-6 py-3 flex items-center justify-between gap-6">
          {/* Logo e Nome do Hotel */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onNavigateHome || (() => window.location.href = '/')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
              title="Voltar ao início"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>

            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-300 flex items-center justify-center font-black text-sm shrink-0 border border-emerald-900 shadow-xs">
              <span className="material-symbols-outlined text-xl">room_service</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 tracking-tight truncate">{hotel.name}</h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 tracking-wider">
                  Cardápio
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Aberto
                </span>
                <span>•</span>
                <span className="truncate">{hotel.cityUf || `${hotel.city} - ${hotel.uf}`}</span>
                <span>•</span>
                <span>Serviço de Quarto 24h</span>
              </div>
            </div>
          </div>

          {/* Campo Central de Busca (Estilo ZapZap: "O que você deseja hoje?") */}
          <div className="flex-1 max-w-md relative">
            <div className="relative flex items-center">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="O que você deseja hoje?"
                className="w-full py-2 pl-9 pr-12 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition"
              />
              <span className="material-symbols-outlined absolute left-2.5 text-base text-slate-400">
                search
              </span>
              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              ) : (
                <button 
                  type="button" 
                  className="absolute right-1.5 p-1 rounded-lg bg-emerald-700 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-emerald-800"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                </button>
              )}
            </div>
          </div>

          {/* Ações Desktop: Status Quarto, Carrinho e Pedidos */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Status Hóspede / Quarto */}
            {hospedeLogado && temCheckinValido ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <div className="text-right">
                  <span className="text-[11px] font-extrabold text-emerald-900 block leading-tight">
                    Quarto {quartoAtivoNumero}
                  </span>
                  <span className="text-[10px] text-emerald-700 truncate max-w-[100px] block font-medium">
                    {hospedeLogado.nome?.split(' ')[0]}
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-emerald-400">key</span>
                <span>Identificar Hóspede</span>
              </button>
            )}

            {/* Botão Carrinho com Badge e Preço Total */}
            <button
              type="button"
              onClick={() => setIsCarrinhoModalOpen(true)}
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold transition cursor-pointer"
              title="Ver Carrinho de Compras"
            >
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-lg text-emerald-700">shopping_cart</span>
                {totalItensCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold flex items-center justify-center animate-pulse">
                    {totalItensCount}
                  </span>
                )}
              </div>
              <span className="font-extrabold">
                R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </button>

            {/* Botão Meus Pedidos */}
            <button
              type="button"
              onClick={() => {
                if (!hospedeLogado) {
                  setIsLoginModalOpen(true);
                } else {
                  setViewState('meus_pedidos');
                }
              }}
              className={`p-2 rounded-xl border transition cursor-pointer relative ${
                viewState === 'meus_pedidos'
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
              title="Acompanhar Meus Pedidos"
            >
              <span className="material-symbols-outlined text-lg">receipt_long</span>
              {meusPedidos.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                  {meusPedidos.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de Categorias Desktop (Sticky logo abaixo do Header) */}
        {viewState === 'cardapio' && (
          <nav className="bg-white/90 backdrop-blur-md border-t border-slate-100 px-6 py-2 shadow-xs">
            <div className="max-w-7xl 2xl:max-w-[1720px] mx-auto flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setCategoriaSelecionada('todas');
                  setBusca('');
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  categoriaSelecionada === 'todas' && !busca
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos ({produtos.length})
              </button>
              {categoriasDisponiveis.map(cat => {
                const count = produtos.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase()).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoriaSelecionada(cat);
                      setBusca('');
                    }}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      categoriaSelecionada.toLowerCase() === cat.toLowerCase() && !busca
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HEADER MOBILE (Estilo ZapZap Delivery: Banner Imersivo + Info Bar)      */}
      {/* ========================================================================= */}
      <div className="md:hidden">
        {/* Banner com Foto de Capa do Hotel */}
        <div 
          className="relative min-h-[220px] bg-cover bg-center flex flex-col justify-between p-4"
          style={{
            backgroundImage: `url(${hotel.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop'})`
          }}
        >
          {/* Overlay Escuro com Gradiente */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/85"></div>

          {/* Topo do Banner: Ações Rápidas */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onNavigateHome || (() => window.location.href = '/')}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center border border-white/20"
                title="Voltar"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>

              <span className="inline-flex items-center gap-1.5 bg-emerald-600/90 backdrop-blur-md text-white px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                Aberto • 24h
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Carrinho Mobile */}
              <button
                type="button"
                onClick={() => setIsCarrinhoModalOpen(true)}
                className="relative w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center border border-white/20"
                title="Carrinho"
              >
                <span className="material-symbols-outlined text-lg">shopping_cart</span>
                {totalItensCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {totalItensCount}
                  </span>
                )}
              </button>

              {/* Hóspede / Pedidos Mobile */}
              <button
                type="button"
                onClick={() => {
                  if (!hospedeLogado) {
                    setIsLoginModalOpen(true);
                  } else {
                    setViewState('meus_pedidos');
                  }
                }}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center border border-white/20"
                title="Identificação e Pedidos"
              >
                <span className="material-symbols-outlined text-lg">
                  {hospedeLogado ? 'receipt_long' : 'key'}
                </span>
              </button>
            </div>
          </div>

          {/* Títulos do Banner */}
          <div className="relative z-10 text-center pt-4 pb-2 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">
              ✨ CARDÁPIO DIGITAL • SERVIÇO DE QUARTO ✨
            </span>
            <h1 className="text-xl font-black text-white leading-tight drop-shadow-md">
              {hotel.name}
            </h1>
            <p className="text-[11px] text-white/80 font-medium">
              {hotel.cityUf || `${hotel.city} - ${hotel.uf}`}
            </p>
          </div>
        </div>

        {/* Logo Flutuante Sobreposta */}
        <div className="relative -mt-8 flex justify-center z-20">
          <div className="w-16 h-16 rounded-2xl bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center text-emerald-900 bg-gradient-to-br from-emerald-50 to-emerald-100">
            <span className="material-symbols-outlined text-3xl text-emerald-800">room_service</span>
          </div>
        </div>

        {/* Info Row com Divisórias (Estilo ZapZap: Tempo de preparo | Destino Quarto | Avaliação) */}
        <div className="mx-4 mt-3 bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex items-center justify-around text-center">
          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-emerald-700">
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span className="text-xs font-black">20-40 min</span>
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">Preparo &amp; Entrega</span>
          </div>

          <div className="w-px h-7 bg-slate-200"></div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-emerald-700">
              <span className="material-symbols-outlined text-sm">hotel</span>
              <span className="text-xs font-black">
                {hospedeLogado && temCheckinValido ? `Quarto ${quartoAtivoNumero}` : 'No seu Quarto'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">Destino do Pedido</span>
          </div>

          <div className="w-px h-7 bg-slate-200"></div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              <span className="material-symbols-outlined text-sm">star</span>
              <span className="text-xs font-black text-slate-800">5.0</span>
            </div>
            <span className="text-[10px] text-slate-400 block font-medium">Avaliação</span>
          </div>
        </div>

        {/* Busca Mobile (Estilo ZapZap: "O que você deseja hoje?") */}
        {viewState === 'cardapio' && (
          <div className="mx-4 mt-3">
            <div className="relative flex items-center">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="O que você deseja hoje?"
                className="w-full py-2.5 pl-9 pr-10 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 shadow-2xs"
              />
              <span className="material-symbols-outlined absolute left-2.5 text-base text-slate-400">
                search
              </span>
              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="absolute right-3 text-slate-400 text-xs"
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  className="absolute right-1.5 w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-xs"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pílulas de Categorias Mobile (Scroll Horizontal) */}
        {viewState === 'cardapio' && (
          <div className="mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setCategoriaSelecionada('todas');
                setBusca('');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                categoriaSelecionada === 'todas' && !busca
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              Todos ({produtos.length})
            </button>
            {categoriasDisponiveis.map(cat => {
              const count = produtos.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase()).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoriaSelecionada(cat);
                    setBusca('');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    categoriaSelecionada.toLowerCase() === cat.toLowerCase() && !busca
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. VIEW 1: CATÁLOGO DO CARDÁPIO (5 Cards/Linha Desktop, Categorias)        */}
      {/* ========================================================================= */}
      {viewState === 'cardapio' && (
        <main className="flex-1 max-w-7xl 2xl:max-w-[1720px] w-full mx-auto px-4 sm:px-6 py-4 md:py-6 space-y-8">
          {/* Alerta Inteligente de Hóspede não identificado */}
          {!hospedeLogado && (
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">room_service</span>
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                    Serviço de Quarto Exclusivo
                  </h4>
                  <p className="text-[11px] text-emerald-700 leading-tight">
                    Você pode montar seu pedido livremente. Identificaremos o seu quarto ao finalizar para lançamento na sua estadia!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shrink-0 self-start sm:self-auto cursor-pointer shadow-2xs"
              >
                Identificar Meu Quarto
              </button>
            </div>
          )}

          {/* GRID DE PRODUTOS */}
          {loadingProdutos ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-medium">Carregando itens do cardápio...</p>
            </div>
          ) : (categoriaSelecionada === 'todas' && !busca) ? (
            /* MODO TODOS: 10 CARDS (2 LINHAS DE 5 NO DESKTOP) + SEÇÕES POR CATEGORIA */
            <div className="space-y-10">
              {/* 1. SEÇÃO TODOS OS PRODUTOS (Exibe 10 cards em 2 linhas de 5 no desktop com botão 'Ver todos') */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-lg">apps</span>
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Todos os Produtos
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Mostrando {expandirTodos ? produtos.length : Math.min(10, produtos.length)} de {produtos.length} produtos disponíveis
                      </p>
                    </div>
                  </div>

                  {produtos.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setExpandirTodos(!expandirTodos)}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl border border-emerald-200 transition cursor-pointer self-start sm:self-auto shadow-2xs"
                    >
                      <span>{expandirTodos ? 'Ver menos (10 itens em 2 linhas)' : `Ver todos (${produtos.length} itens)`}</span>
                      <span className="material-symbols-outlined text-sm">
                        {expandirTodos ? 'expand_less' : 'arrow_forward'}
                      </span>
                    </button>
                  )}
                </div>

                {produtos.length === 0 ? (
                  <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                    <p className="text-xs text-slate-500">Nenhum produto cadastrado no momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {(expandirTodos ? produtos : produtos.slice(0, 10)).map(prod => renderCardProduto(prod))}
                  </div>
                )}
              </section>

              {/* 2. SEÇÕES POR CATEGORIA CADASTRADA PELO HOTEL */}
              {categoriasDisponiveis.map(cat => {
                const produtosDaCategoria = produtos.filter(
                  p => (p.category || '').toLowerCase() === cat.toLowerCase() && p.status !== 'inativo'
                );
                if (produtosDaCategoria.length === 0) return null;

                return (
                  <section key={cat} className="space-y-4 pt-6 border-t border-slate-200/80">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                          {cat}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                          {produtosDaCategoria.length} {produtosDaCategoria.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCategoriaSelecionada(cat);
                          setBusca('');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        <span>Ver todos de {cat}</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {produtosDaCategoria.map(prod => renderCardProduto(prod))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            /* MODO FILTRADO: POR CATEGORIA SELECIONADA OU TERMO DE BUSCA */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      {busca ? `Resultados para "${busca}"` : categoriaSelecionada}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900">
                      {produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  {categoriaSelecionada !== 'todas' && !busca && (
                    <p className="text-xs text-slate-500 mt-0.5">Exibindo itens da categoria {categoriaSelecionada}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCategoriaSelecionada('todas');
                    setBusca('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 transition cursor-pointer self-start sm:self-auto shadow-2xs"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Voltar para Todos os Produtos</span>
                </button>
              </div>

              {produtosFiltrados.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
                  <span className="material-symbols-outlined text-4xl text-slate-300">no_meals</span>
                  <h3 className="text-base font-bold text-slate-800">Nenhum item encontrado</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Não encontramos produtos disponíveis para a categoria ou termo buscado. Tente selecionar outra categoria.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {produtosFiltrados.map(prod => renderCardProduto(prod))}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ========================================================================= */}
      {/* BARRA FLUTUANTE INFERIOR DO CARRINHO (Estilo ZapZap Delivery Mobile)       */}
      {/* ========================================================================= */}
      {itensCarrinho.length > 0 && viewState === 'cardapio' && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 animate-fadeIn">
          <div className="max-w-xl mx-auto bg-slate-950/95 backdrop-blur-md text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setIsCarrinhoModalOpen(true)}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs relative">
                <span className="material-symbols-outlined text-xl">shopping_bag</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {totalItensCount}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">Total do Pedido</span>
                <span className="text-base sm:text-lg font-black text-emerald-300">
                  R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCarrinhoModalOpen(true)}
                className="hidden sm:inline-block px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
              >
                Ver Itens
              </button>
              <button
                type="button"
                onClick={handleIniciarCheckout}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <span>Avançar para Quarto</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VIEW 2: CHECKOUT INTERNO (Sem taxas de entrega / km / bairros / mesa)   */}
      {/* ========================================================================= */}
      {viewState === 'checkout' && (
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          <button
            type="button"
            onClick={() => setViewState('cardapio')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Voltar ao Cardápio</span>
          </button>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
            <div>
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                Resumo da Acomodação &amp; Pedido
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
                Confirmar Lançamento no Quarto
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Revise os itens e confirme o pedido para preparo imediato e entrega direta no seu quarto.
              </p>
            </div>

            {/* DADOS DA HOSPEDAGEM & LOCAL DE ENTREGA */}
            <div className="bg-emerald-50/70 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs sm:text-sm">
                  <span className="material-symbols-outlined text-emerald-700">hotel</span>
                  <span>Hospedagem em Andamento</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                  Check-in Ativo
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Hóspede Titular</span>
                  <span className="font-bold text-slate-900">{hospedeLogado?.nome}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Local de Entrega</span>
                  <span className="font-extrabold text-emerald-800 text-sm">
                    Quarto {quartoAtivoNumero}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Hotel</span>
                  <span className="font-bold text-slate-900">{hotel.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Reserva</span>
                  <span className="font-mono text-slate-700">
                    {dadosReservaAtiva?.codigo || `#RES-${dadosReservaAtiva?.id?.substring(0, 6).toUpperCase() || 'ATIVA'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* RESUMO DOS ITENS PEDIDOS */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Itens Selecionados ({totalItensCount})
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                {itensCarrinho.map(item => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0">
                        {item.foto ? (
                          <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500">
                            <span className="material-symbols-outlined text-base">restaurant</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs block truncate">{item.nome}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {item.quantidade}x R$ {item.precoUnitario.toFixed(2)}
                        </span>
                        {item.observacoes && (
                          <span className="text-[10px] text-emerald-800 font-medium block italic">
                            Obs: {item.observacoes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                        R$ {item.subtotal.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAlterarQuantidade(item.produtoId, -item.quantidade)}
                        className="text-slate-400 hover:text-red-600 text-xs cursor-pointer p-1"
                        title="Remover item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* OBSERVAÇÕES PARA O QUARTO */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Observações de Entrega (Opcional)
              </label>
              <textarea
                rows={3}
                value={observacoesPedido}
                onChange={(e) => setObservacoesPedido(e.target.value)}
                placeholder="Ex: Favor trazer guardanapos extras, sem gelo no refrigerante, talheres descartáveis..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              />
            </div>

            {/* TOTAL E DETALHAMENTO FINANCEIRO (SEM TAXA DE ENTREGA / KM / BAIRROS) */}
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Subtotal dos Itens</span>
                <span className="font-bold text-slate-900">
                  R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span>Taxa de Entrega / Serviço</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">Serviço de Quarto</span>
                </span>
                <span className="font-bold text-emerald-700">
                  GRÁTIS
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-base sm:text-lg font-black text-slate-900">
                <span>Total a Lançar no Quarto</span>
                <span className="text-emerald-800 text-xl font-black">
                  R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                📌 <strong>Cobrança no Check-out:</strong> O valor total é lançado automaticamente na conta do <strong>Quarto {quartoAtivoNumero}</strong> e será quitado no encerramento da sua estadia. Pedidos confirmados entram imediatamente na linha de preparo.
              </p>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setViewState('cardapio')}
                className="w-full sm:w-1/3 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Continuar Escolhendo
              </button>
              <button
                type="button"
                disabled={isSubmittingPedido}
                onClick={handleConfirmarPedidoFinal}
                className="w-full sm:w-2/3 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span>{isSubmittingPedido ? 'Transmitindo Pedido...' : `Confirmar e Lançar no Quarto ${quartoAtivoNumero}`}</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 5. VIEW 3: TELA DE SUCESSO / CONFIRMAÇÃO DO PEDIDO                        */}
      {/* ========================================================================= */}
      {viewState === 'sucesso' && ultimoPedidoCriado && (
        <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10 flex flex-col items-center text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center border-4 border-emerald-200 shadow-xl animate-bounce">
            <span className="material-symbols-outlined text-4xl font-bold">room_service</span>
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Pedido Enviado com Sucesso!
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Código {ultimoPedidoCriado.codigo}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              O seu pedido foi recebido pela equipe do <strong>{hotel.name}</strong> e está em preparação para entrega no <strong>Quarto {ultimoPedidoCriado.quartoNumero}</strong>.
            </p>
          </div>

          {/* Card Detalhes */}
          <div className="w-full bg-white rounded-2xl p-5 border border-slate-200 text-left space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
              <span className="text-slate-400">Total Lançado:</span>
              <span className="font-extrabold text-slate-900 text-sm">
                R$ {ultimoPedidoCriado.valorTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
              <span className="text-slate-400">Destino de Entrega:</span>
              <span className="font-bold text-slate-800">Quarto {ultimoPedidoCriado.quartoNumero}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status Atual:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Em Preparo na Copa/Cozinha
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 text-[11px] text-slate-500 text-left border border-slate-200/70 w-full space-y-1">
            <span className="font-bold text-slate-700 block">🔒 Política de Serviço de Quarto:</span>
            <p>
              Por segurança operacional, pedidos confirmados não podem ser cancelados diretamente pelo hóspede. Caso necessite de qualquer alteração, favor contatar a recepção pelo WhatsApp ou interfone.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <button
              type="button"
              onClick={() => setViewState('meus_pedidos')}
              className="w-full sm:w-1/2 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-xs text-slate-800 transition cursor-pointer"
            >
              Acompanhar Meus Pedidos
            </button>
            <button
              type="button"
              onClick={() => setViewState('cardapio')}
              className="w-full sm:w-1/2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 font-bold text-xs text-white transition cursor-pointer"
            >
              Pedir Mais Itens
            </button>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* 6. VIEW 4: MEUS PEDIDOS DO HÓSPEDE (Histórico & Acompanhamento)           */}
      {/* ========================================================================= */}
      {viewState === 'meus_pedidos' && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewState('cardapio')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Voltar ao Cardápio</span>
            </button>

            <button
              type="button"
              onClick={() => hotel.whatsapp && window.open(`https://wa.me/${hotel.whatsapp.replace(/\D/g, '')}`, '_blank')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">support_agent</span>
              <span>Falar com a Recepção</span>
            </button>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Meus Pedidos no Quarto</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe o status de preparação e entrega de todos os itens pedidos nesta estadia no Quarto {quartoAtivoNumero}
            </p>
          </div>

          {meusPedidos.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
              <h3 className="text-base font-bold text-slate-800">Nenhum pedido realizado ainda</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Você ainda não fez nenhum pedido no cardápio durante esta estadia.
              </p>
              <button
                type="button"
                onClick={() => setViewState('cardapio')}
                className="mt-3 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Abrir Cardápio
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {meusPedidos.map(ped => {
                const getStatusBadge = () => {
                  switch (ped.status) {
                    case 'pendente':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900">Pendente / Recepção</span>;
                    case 'em_preparo':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-900">Em Preparo na Copa</span>;
                    case 'em_rota':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-900">A Caminho do Quarto</span>;
                    case 'entregue':
                    case 'concluido':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900">Entregue no Quarto</span>;
                    case 'cancelado':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-red-100 text-red-900">Cancelado pela Recepção</span>;
                    default:
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">{ped.status}</span>;
                  }
                };

                return (
                  <div key={ped.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-slate-900">{ped.codigo}</span>
                          {getStatusBadge()}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {new Date(ped.criadoEm).toLocaleString('pt-BR')} • Quarto {ped.quartoNumero}
                        </span>
                      </div>
                      <span className="text-base font-black text-slate-900">
                        R$ {ped.valorTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {ped.itens.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-700">
                          <span>{it.quantidade}x {it.nome}</span>
                          <span className="font-semibold text-slate-900">R$ {it.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {ped.observacoesGerais && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg">
                        Obs: {ped.observacoesGerais}
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-50">
                      <span>Lançado no extrato do quarto</span>
                      <span className="text-slate-400 italic">Alterações apenas via recepção</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL DE PRODUTO (Estilo ZapZap Delivery: Foto, Detalhes, Qtd, Obs)     */}
      {/* ========================================================================= */}
      {produtoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-scaleUp flex flex-col max-h-[90vh]">
            {/* Foto e Botão Fechar */}
            <div className="relative h-52 w-full bg-slate-100 shrink-0">
              <img 
                src={getProductImage(produtoModal)} 
                alt={produtoModal.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setProdutoModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition cursor-pointer"
              >
                ✕
              </button>
              {produtoModal.category && (
                <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-black/70 backdrop-blur-md text-white border border-white/20">
                  {produtoModal.category}
                </span>
              )}
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    {produtoModal.name}
                  </h3>
                  <span className="text-base font-black text-emerald-700 shrink-0">
                    R$ {produtoModal.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {produtoModal.description || 'Item disponível para entrega e atendimento imediato no quarto.'}
                </p>
              </div>

              {/* Campo de Observações do Item (Estilo ZapZap) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Alguma observação para este item?
                </label>
                <input
                  type="text"
                  value={modalObs}
                  onChange={(e) => setModalObs(e.target.value)}
                  placeholder="Ex: sem talher, bem gelado, sem açúcar..."
                  className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              {/* Seletor de Quantidade */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-bold text-slate-700">Quantidade</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalQtd(Math.max(1, modalQtd - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-black text-slate-900">
                    {modalQtd}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalQtd(modalQtd + 1)}
                    className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center hover:bg-emerald-800 transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal com Total e Botão de Adicionar */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Subtotal</span>
                <span className="text-base font-black text-slate-900">
                  R$ {(produtoModal.price * modalQtd).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSalvarItemModal}
                className="px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                <span>Adicionar ao Pedido</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL DO CARRINHO (Lista de Itens, Totais, Avançar para Checkout)       */}
      {/* ========================================================================= */}
      {isCarrinhoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700">shopping_bag</span>
                <h3 className="text-base font-black text-slate-900">Meu Pedido ({totalItensCount} itens)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCarrinhoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {itensCarrinho.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300">remove_shopping_cart</span>
                <p className="text-xs">Seu carrinho está vazio.</p>
              </div>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-1">
                  {itensCarrinho.map(it => (
                    <div key={it.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 block truncate">{it.nome}</span>
                        <span className="text-slate-400 text-[11px]">R$ {it.precoUnitario.toFixed(2)} un</span>
                        {it.observacoes && (
                          <span className="text-[10px] text-emerald-800 block italic truncate">
                            Obs: {it.observacoes}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidade(it.produtoId, -1)}
                            className="w-6 h-6 rounded bg-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-xs">{it.quantidade}</span>
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidade(it.produtoId, 1)}
                            className="w-6 h-6 rounded bg-emerald-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-extrabold text-slate-900 w-16 text-right">
                          R$ {it.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Taxa de Entrega</span>
                    <span className="font-bold text-emerald-700">Grátis (No Quarto)</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-black text-slate-900">
                    <span>Total</span>
                    <span className="text-emerald-800">
                      R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleIniciarCheckout}
                  className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Avançar para o Quarto</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL INTELIGENTE DE IDENTIFICAÇÃO DO HÓSPEDE (Por Quarto ou E-mail)     */}
      {/* ========================================================================= */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">key</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Identificação do Hóspede</h3>
                  <p className="text-xs text-slate-500">{hotel.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O cardápio é exclusivo para hóspedes com <strong>check-in ativo</strong> para que o consumo seja lançado diretamente na conta da sua acomodação.
            </p>

            {/* Abas de Entrada */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => { setLoginTab('quarto'); setLoginError(''); }}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  loginTab === 'quarto' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                🔑 Entrar por Quarto
              </button>
              <button
                type="button"
                onClick={() => { setLoginTab('credenciais'); setLoginError(''); }}
                className={`py-2 rounded-lg transition cursor-pointer ${
                  loginTab === 'credenciais' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                ✉️ E-mail da Reserva
              </button>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                {loginError}
              </div>
            )}

            <form onSubmit={handleExecutarLoginHospede} className="space-y-4">
              {loginTab === 'quarto' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Número do seu Quarto
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 104, 201..."
                      value={loginQuarto}
                      onChange={(e) => setLoginQuarto(e.target.value)}
                      className="w-full py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Sobrenome ou CPF do Titular
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Silva ou 123.456.789-00"
                      value={loginCpfOuSobrenome}
                      onChange={(e) => setLoginCpfOuSobrenome(e.target.value)}
                      className="w-full py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    E-mail informado na Reserva
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full py-2.5 px-3.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isAuthenticating ? 'Validando Estadia...' : 'Confirmar e Acessar Cardápio'}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </form>

            <div className="pt-2 text-center text-[11px] text-slate-400">
              Ainda não realizou check-in? Favor dirigir-se à recepção do hotel.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardapioHotel;
