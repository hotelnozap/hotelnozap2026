import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Força HTTPS em ambiente de produção (remove aviso 'Não seguro')
if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
  window.location.href = window.location.href.replace('http:', 'https:');
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
                localStorage.removeItem('hotelnozap_sb_session');
                window.location.href = '/paineladmin';
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
