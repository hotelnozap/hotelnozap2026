import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Força HTTPS em ambiente de produção (remove aviso 'Não seguro')
if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
  window.location.href = window.location.href.replace('http:', 'https:');
}

// Registro do Service Worker para PWA (Progressive Web App)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('PWA Service Worker registrado com sucesso:', reg.scope);
    }).catch((err) => {
      console.warn('Falha ao registrar Service Worker:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
