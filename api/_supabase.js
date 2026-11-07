/**
 * api/_supabase.js
 * Módulo centralizado de banco de dados para ambiente Serverless (Vercel).
 * 
 * Implementa:
 * 1. Padrão Singleton em memória (reúso de cliente entre invocações "warm" do container).
 * 2. HTTP Agent com Keep-Alive e connection pooling para reuso de sockets TCP.
 * 3. Limites de conexões simultâneas e timeouts para prevenir exaustão de conexões e travamento.
 */

import { createClient } from '@supabase/supabase-js';
import https from 'node:https';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://obkvgluunbnktzulzjfg.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuração de Agente HTTP com Pooling de Conexões para Serverless
// Mantém sockets abertos entre requisições da mesma lambda quente, encerrando ociosos.
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,   // Heartbeat keep-alive de 10s
  maxSockets: 10,          // Limite máximo de sockets simultâneos por instância serverless
  maxFreeSockets: 5,       // Limite de sockets livres mantidos em pool
  timeout: 15000           // Timeout de socket em 15s (encerra conexões ociosas ou travadas)
});

// Cache global no contexto de execução do Node.js (Vercel Lambda)
const GLOBAL_KEY = '__hotelnozap_supabase_admin__';

/**
 * Retorna a instância singleton do Supabase Admin com connection pooling ativo.
 * Reutiliza a instância e sockets entre execuções da mesma lambda warm.
 */
export function getSupabaseAdmin() {
  if (!globalThis[GLOBAL_KEY]) {
    const key = SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no ambiente do servidor.');
    }

    globalThis[GLOBAL_KEY] = createClient(SUPABASE_URL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            agent: httpsAgent,
            // Timeout de proteção para evitar queries presas segurando conexões
            signal: options.signal || AbortSignal.timeout(15000)
          });
        }
      }
    });
  }

  return globalThis[GLOBAL_KEY];
}

/**
 * Retorna as URLs e parâmetros recomendados para conexão direta ou via Pooler (PgBouncer/Supavisor).
 */
export function getDatabasePoolConfig() {
  return {
    supabaseUrl: SUPABASE_URL,
    pooler: {
      port: 6543,
      mode: 'transaction',
      recommendedLimit: 10,
      idleTimeoutSeconds: 30
    }
  };
}
