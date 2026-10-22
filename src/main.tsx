import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { navigateSpa } from './utils/navigation';
import { forceCleanReload } from './utils/lazyWithRetry';

// Força HTTPS em ambiente de produção (remove aviso 'Não seguro')
if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
  window.location.href = window.location.href.replace('http:', 'https:');
}

// Interceptador global para transformar cliques em links internos em navegação SPA instantânea
// Impede que o aplicativo PWABuilder / TWA no Android recarregue o documento e mostre pre-load "Abrindo..." ou splash cortada
if (typeof window !== 'undefined') {
  document.addEventListener('click', (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement)?.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('whatsapp:') ||
      href.startsWith('javascript:') ||
      href.startsWith('#') ||
      anchor.target === '_blank' ||
      anchor.hasAttribute('download')
    ) {
      return;
    }
    if (href.startsWith('/')) {
      event.preventDefault();
      navigateSpa(href);
    }
  });
}

// Tratamento automático de chunks e módulos desatualizados no Vite após novos deploys
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event: any) => {
    event?.preventDefault?.();
    console.warn('[Vite] Chunk desatualizado detectado após nova publicação. Atualizando página...');
    forceCleanReload();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const msg = (error?.message || '').toLowerCase();
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      error?.name === 'ChunkLoadError'
    ) {
      event.preventDefault();
      console.warn('[Vite Unhandled Rejection] Chunk desatualizado detectado. Atualizando página...');
      forceCleanReload();
    }
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  isChunkUpdating?: boolean;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private fallbackTimer?: any;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isChunkUpdating: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    if (typeof window !== 'undefined') {
      forceCleanReload();
    }
    return { hasError: true, error, isChunkUpdating: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[RootErrorBoundary] Interceptado:', error?.message || error, errorInfo);
    if (typeof window !== 'undefined') {
      forceCleanReload();
    }
  }

  componentDidMount() {
    if (this.state.hasError && typeof window !== 'undefined') {
      this.fallbackTimer = setTimeout(() => {
        forceCleanReload(true);
      }, 3500);
    }
  }

  componentWillUnmount() {
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
  }

  render() {
    if (this.state.hasError) {
      // Exibe SEMPRE a tela de pre-load oficial do Hotel no Zap sem NENHUM texto de erro ou instabilidade
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #003400 0%, #000000 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            userSelect: 'none',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              border: '4px solid rgba(52, 211, 153, 0.25)',
              borderTopColor: '#34d399',
              animation: 'spin 0.8s linear infinite',
              marginBottom: '20px'
            }}
          />
          <h2
            style={{
              color: '#ffffff',
              fontSize: '22px',
              fontWeight: 900,
              letterSpacing: '0.15em',
              margin: '0 0 6px 0',
              textTransform: 'uppercase'
            }}
          >
            HOTEL NO ZAP
          </h2>
          <p
            style={{
              color: '#34d399',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              margin: '0 0 20px 0'
            }}
          >
            Carregando painel...
          </p>
          <button
            type="button"
            onClick={() => forceCleanReload(true)}
            style={{
              background: 'rgba(52, 211, 153, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              padding: '8px 20px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Atualizar agora
          </button>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
