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
      msg.includes('failed to fetch') ||
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
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isChunkUpdating: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const msg = (error?.message || '').toLowerCase();
    const isChunkError =
      msg.includes('dynamically imported module') ||
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('failed to fetch') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError && typeof window !== 'undefined') {
      forceCleanReload();
      return { hasError: true, error, isChunkUpdating: true };
    }

    return { hasError: true, error, isChunkUpdating: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkUpdating) {
        return (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0b1c30', color: '#fff', fontFamily: 'sans-serif', padding: '20px' }}>
            <div style={{ width: '38px', height: '38px', border: '3px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', marginBottom: '4px' }}>Sincronizando atualização...</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>Carregando a versão mais recente do sistema.</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        );
      }

      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1c30', color: '#fff', fontFamily: 'sans-serif', padding: '20px' }}>
          <div style={{ maxWidth: '480px', width: '100%', background: '#132338', padding: '32px', borderRadius: '16px', textAlign: 'center', border: '1px solid #1e3a5f' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#10b981' }}>HOTEL NO ZAP</h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px' }}>
              Ocorreu uma instabilidade temporária ao carregar este módulo.
            </p>
            <div style={{ textAlign: 'left', background: '#071220', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#f87171', fontFamily: 'monospace', overflowX: 'auto', marginBottom: '20px' }}>
              {this.state.error?.message || 'Erro desconhecido'}
            </div>
            <button
              onClick={() => {
                forceCleanReload(true);
              }}
              style={{ background: '#003400', color: '#fff', border: '1px solid #10b981', padding: '10px 24px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              Recarregar Painel
            </button>
          </div>
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
