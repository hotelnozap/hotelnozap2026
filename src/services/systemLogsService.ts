import { supabase } from '../lib/supabase';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'security';

export type LogModule = 
  | 'auth'
  | 'hoteis'
  | 'reservas'
  | 'quartos'
  | 'financeiro'
  | 'whatsapp'
  | 'database'
  | 'config'
  | 'sistema';

export interface SystemLogEntry {
  id: string;
  timestamp: string; // ISO string
  level: LogLevel;
  module: LogModule;
  action: string;
  details?: string;
  userEmail?: string;
  userName?: string;
  ip?: string;
  hotelId?: string;
  hotelName?: string;
  metadata?: Record<string, any>;
  synced_db?: boolean;
}

const STORAGE_KEY_LOGS = 'hotelnozap_logs_sistema_saas';

// SEED Inicial com logs ilustrativos e realistas do sistema SaaS
const SEED_LOGS: SystemLogEntry[] = [
  {
    id: 'log-sys-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    level: 'success',
    module: 'quartos',
    action: 'Status dos Quartos Atualizado',
    details: 'Status "Ocupado em Limpeza" cadastrado e mapeado com sucesso para governança.',
    userEmail: 'admin@hotelnozap.com.br',
    userName: 'Administrador Master',
    ip: '177.136.241.10',
    metadata: { slug: 'ocupado_em_limpeza', permite_ocupacao: false, notifica_camareira: true }
  },
  {
    id: 'log-sys-02',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    level: 'info',
    module: 'database',
    action: 'Sincronização de Dados com Supabase',
    details: 'Tabela public.status_quartos sincronizada com regras e permissões de acesso.',
    userEmail: 'sistema@hotelnozap.com.br',
    userName: 'Supabase Realtime Sync',
    ip: '10.0.4.1',
    metadata: { table: 'status_quartos', total_registros: 7 }
  },
  {
    id: 'log-sys-03',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    level: 'success',
    module: 'reservas',
    action: 'Check-in Realizado com Sucesso',
    details: 'Entrada de hóspede confirmada no Quarto 102 com emissão de chave e FNRH.',
    userEmail: 'recepcao@hotelpousada.com.br',
    userName: 'Recepção Hotel',
    ip: '189.40.112.54',
    hotelName: 'Hotel Solar das Águas',
    metadata: { quarto: '102', valor: 450.00, forma_pagamento: 'PIX' }
  },
  {
    id: 'log-sys-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    level: 'warning',
    module: 'whatsapp',
    action: 'Instância WhatsApp Desconectada',
    details: 'Instância "Recepção Principal" perdeu conexão temporária com a Evolution API. Reconectando...',
    userEmail: 'sistema@hotelnozap.com.br',
    userName: 'Evolution Monitor',
    ip: '10.0.12.8',
    metadata: { instancia: 'hotel_matriz', status: 'close', code: 428 }
  },
  {
    id: 'log-sys-05',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    level: 'security',
    module: 'auth',
    action: 'Tentativa de Login Falha',
    details: 'Tentativa de acesso administrativo com senha incorreta para conta protegida.',
    userEmail: 'gestao@hotelnozap.com.br',
    userName: 'Desconhecido',
    ip: '45.181.20.14',
    metadata: { tentativas: 3, bloqueado_temporariamente: false }
  },
  {
    id: 'log-sys-06',
    timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    level: 'success',
    module: 'financeiro',
    action: 'Repasse Financeiro Processado',
    details: 'Liquidação de pagamento PIX e conciliação bancária concluída.',
    userEmail: 'financeiro@hotelnozap.com.br',
    userName: 'Robô de Conciliação',
    ip: '10.0.4.1',
    metadata: { transacao_id: 'pix_98124981', valor: 890.00, gateway: 'MercadoPago' }
  },
  {
    id: 'log-sys-07',
    timestamp: new Date(Date.now() - 1000 * 60 * 520).toISOString(),
    level: 'info',
    module: 'hoteis',
    action: 'Parâmetros de Propriedade Atualizados',
    details: 'Atualização de horário de check-in e política de cancelamento do estabelecimento.',
    userEmail: 'admin@hotelnozap.com.br',
    userName: 'Administrador Master',
    ip: '177.136.241.10',
    hotelName: 'Pousada Recanto Verde'
  }
];

export const systemLogsService = {
  // Retorna logs locais com fallback inteligente
  getLocalLogs(): SystemLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    
    // Se vazio, salva o seed e retorna
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(SEED_LOGS));
    } catch { /* ignore */ }
    return SEED_LOGS;
  },

  setLocalLogs(logs: SystemLogEntry[]): void {
    try {
      // Limita a retenção local em até 1000 registros para alta performance
      const bounded = logs.slice(0, 1000);
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(bounded));
    } catch { /* ignore */ }
  },

  // Busca logs (tenta no Supabase; se não houver tabela ou falhar, usa local)
  async getLogs(filters?: {
    search?: string;
    level?: string;
    module?: string;
  }): Promise<SystemLogEntry[]> {
    let list = this.getLocalLogs();

    try {
      const { data, error } = await supabase
        .from('logs_sistema')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data) && data.length > 0) {
        const mappedFromDb: SystemLogEntry[] = data.map((r: any) => ({
          id: r.id || `log-${Date.now()}`,
          timestamp: r.criado_em || r.timestamp || new Date().toISOString(),
          level: (r.nivel || r.level || 'info').toLowerCase() as LogLevel,
          module: (r.modulo || r.module || 'sistema').toLowerCase() as LogModule,
          action: r.acao || r.action || 'Ação Registrada',
          details: r.detalhes || r.details || '',
          userEmail: r.usuario_email || r.user_email || r.userEmail || '',
          userName: r.usuario_nome || r.user_name || r.userName || '',
          ip: r.ip || '',
          hotelId: r.hotel_id || r.hotelId || '',
          hotelName: r.hotel_nome || r.hotelName || '',
          metadata: typeof r.metadados === 'object' ? r.metadados : typeof r.metadata === 'object' ? r.metadata : undefined,
          synced_db: true
        }));

        // Mescla com logs locais recentes para não perder nada
        const dbIds = new Set(mappedFromDb.map(d => d.id));
        const unSynced = list.filter(l => !dbIds.has(l.id));
        list = [...mappedFromDb, ...unSynced].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        this.setLocalLogs(list);
      }
    } catch {
      // Falha graciosa: mantém list local
    }

    // Aplica filtros se houver
    if (filters) {
      if (filters.search && filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        list = list.filter(l => 
          (l.action || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q) ||
          (l.userEmail || '').toLowerCase().includes(q) ||
          (l.userName || '').toLowerCase().includes(q) ||
          (l.ip || '').toLowerCase().includes(q) ||
          (l.hotelName || '').toLowerCase().includes(q)
        );
      }
      if (filters.level && filters.level !== 'todos') {
        list = list.filter(l => l.level === filters.level);
      }
      if (filters.module && filters.module !== 'todos') {
        list = list.filter(l => l.module === filters.module);
      }
    }

    return list;
  },

  // Grava novo log
  async addLog(entry: {
    level: LogLevel;
    module: LogModule;
    action: string;
    details?: string;
    userEmail?: string;
    userName?: string;
    ip?: string;
    hotelId?: string;
    hotelName?: string;
    metadata?: Record<string, any>;
  }): Promise<SystemLogEntry> {
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_role') : '';
    const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_email') : '';
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('hotelnozap_user_name') : '';

    const newLog: SystemLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level: entry.level,
      module: entry.module,
      action: entry.action,
      details: entry.details || '',
      userEmail: entry.userEmail || storedEmail || 'sistema@hotelnozap.com.br',
      userName: entry.userName || storedName || (userRole ? `Operador (${userRole})` : 'Usuário do Sistema'),
      ip: entry.ip || '127.0.0.1',
      hotelId: entry.hotelId,
      hotelName: entry.hotelName,
      metadata: entry.metadata,
      synced_db: false
    };

    // 1. Tenta salvar no Supabase
    try {
      const payload = {
        nivel: newLog.level,
        modulo: newLog.module,
        acao: newLog.action,
        detalhes: newLog.details,
        usuario_email: newLog.userEmail,
        usuario_nome: newLog.userName,
        ip: newLog.ip,
        hotel_id: newLog.hotelId || null,
        hotel_nome: newLog.hotelName || null,
        metadados: newLog.metadata || null
      };

      const { data, error } = await supabase
        .from('logs_sistema')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        newLog.id = data.id || newLog.id;
        newLog.synced_db = true;
      }
    } catch {
      // Ignora erro de rede/permissão, salvando localmente
    }

    // 2. Persiste localmente
    const current = this.getLocalLogs();
    const updated = [newLog, ...current];
    this.setLocalLogs(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_novo_log_sistema', { detail: newLog }));
    }

    return newLog;
  },

  // Limpa todos os logs
  async clearLogs(): Promise<boolean> {
    try {
      await supabase.from('logs_sistema').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch { /* ignore */ }

    this.setLocalLogs([]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel_logs_sistema_limpos'));
    }
    return true;
  },

  // Exportação segura para formato CSV
  exportLogsCsv(logs: SystemLogEntry[]): void {
    if (!logs || logs.length === 0) return;

    const headers = ['ID', 'Data/Hora', 'Nível', 'Módulo', 'Ação / Evento', 'Detalhes', 'Usuário', 'E-mail', 'IP', 'Hotel'];
    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${new Date(l.timestamp).toLocaleString('pt-BR')}"`,
      `"${l.level.toUpperCase()}"`,
      `"${l.module.toUpperCase()}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${(l.userEmail || '').replace(/"/g, '""')}"`,
      `"${l.ip || ''}"`,
      `"${(l.hotelName || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs_sistema_hotelnozap_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
