-- ================================================================
-- Migration: Logs do Sistema & Auditoria SaaS
-- Data: 2026-09-30
-- Modo: 100% Idempotente e Seguro (pode executar várias vezes)
-- ================================================================

-- 1. Habilitar extensões necessárias para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criação da tabela logs_sistema
CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nivel TEXT NOT NULL DEFAULT 'info' CHECK (nivel IN ('info', 'success', 'warning', 'error', 'security')),
    modulo TEXT NOT NULL DEFAULT 'sistema',
    acao TEXT NOT NULL,
    detalhes TEXT DEFAULT '',
    usuario_email TEXT DEFAULT '',
    usuario_nome TEXT DEFAULT '',
    ip TEXT DEFAULT '127.0.0.1',
    hotel_id UUID,
    hotel_nome TEXT DEFAULT '',
    metadados JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para busca ultrarrápida
CREATE INDEX IF NOT EXISTS idx_logs_sistema_criado_em ON public.logs_sistema(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_nivel ON public.logs_sistema(nivel);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_modulo ON public.logs_sistema(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_sistema_usuario ON public.logs_sistema(usuario_email);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso (com verificação segura de existência de tabela)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'logs_sistema'
    ) THEN
        DROP POLICY IF EXISTS "Leitura de logs_sistema" ON public.logs_sistema;
        CREATE POLICY "Leitura de logs_sistema"
            ON public.logs_sistema FOR SELECT USING (true);

        DROP POLICY IF EXISTS "Inserção de logs_sistema" ON public.logs_sistema;
        CREATE POLICY "Inserção de logs_sistema"
            ON public.logs_sistema FOR INSERT WITH CHECK (true);

        DROP POLICY IF EXISTS "Exclusão de logs_sistema" ON public.logs_sistema;
        CREATE POLICY "Exclusão de logs_sistema"
            ON public.logs_sistema FOR DELETE USING (true);
    END IF;
END $$;

-- 6. Concessão de privilégios de tabela para os roles da API REST do Supabase
GRANT ALL ON TABLE public.logs_sistema TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 7. Seed inicial com eventos de exemplo para demonstração e auditoria
INSERT INTO public.logs_sistema (nivel, modulo, acao, detalhes, usuario_email, usuario_nome, ip, metadados)
VALUES
    ('success', 'quartos', 'Status dos Quartos Atualizado', 'Status Ocupado em Limpeza cadastrado e integrado com sucesso.', 'admin@hotelnozap.com.br', 'Administrador Master', '177.136.241.10', '{"slug": "ocupado_em_limpeza", "permite_ocupacao": false}'::jsonb),
    ('info', 'database', 'Sincronização de Banco de Dados', 'Verificação de integridade e permissões na tabela status_quartos.', 'sistema@hotelnozap.com.br', 'Supabase Realtime Sync', '10.0.4.1', '{"tabela": "status_quartos"}'::jsonb),
    ('success', 'reservas', 'Check-in Realizado com Sucesso', 'Entrada de hóspede confirmada no Quarto 102 com emissão de FNRH.', 'recepcao@hotelpousada.com.br', 'Recepção Hotel', '189.40.112.54', '{"quarto": "102", "forma_pagamento": "PIX"}'::jsonb),
    ('warning', 'whatsapp', 'Instância WhatsApp Desconectada', 'Instância Recepção Principal perdeu conexão temporária com a Evolution API.', 'sistema@hotelnozap.com.br', 'Evolution Monitor', '10.0.12.8', '{"status": "close", "code": 428}'::jsonb),
    ('security', 'auth', 'Tentativa de Login Bloqueada', 'Tentativa de acesso com senha incorreta para conta de gestão.', 'gestao@hotelnozap.com.br', 'Desconhecido', '45.181.20.14', '{"bloqueado": false}'::jsonb)
ON CONFLICT DO NOTHING;
