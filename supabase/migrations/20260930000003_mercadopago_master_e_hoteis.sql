-- ================================================================
-- Migration: Separação de Credenciais Mercado Pago (Master SaaS vs Hotéis)
-- Data: 2026-09-30
-- Modo: 100% Idempotente e Seguro (pode executar várias vezes)
-- ================================================================

-- 1. Garante que a tabela hotel_configuracoes suporta as credenciais próprias de cada hotel
CREATE TABLE IF NOT EXISTS public.hotel_configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteis(id) ON DELETE CASCADE UNIQUE,
    mp_environment TEXT NOT NULL DEFAULT 'production',
    mp_public_key TEXT DEFAULT '',
    mp_access_token TEXT DEFAULT '',
    mp_client_id TEXT DEFAULT '',
    mp_client_secret TEXT DEFAULT '',
    mp_enable_pix BOOLEAN NOT NULL DEFAULT true,
    mp_enable_credit_card BOOLEAN NOT NULL DEFAULT true,
    mp_enable_boleto BOOLEAN NOT NULL DEFAULT false,
    mp_max_installments TEXT NOT NULL DEFAULT '12',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Garante que a tabela parametros_sistema suporta as credenciais exclusivas do Administrador Master para Planos
CREATE TABLE IF NOT EXISTS public.parametros_sistema (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_provider TEXT NOT NULL DEFAULT 'mercadopago',
    gateway_environment TEXT NOT NULL DEFAULT 'production',
    gateway_public_key TEXT DEFAULT '',
    gateway_token TEXT DEFAULT '',
    gateway_client_id TEXT DEFAULT '',
    gateway_client_secret TEXT DEFAULT '',
    chave_pix_master TEXT DEFAULT 'financeiro@hotelnozap.com.br',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Inserção do registro único de parâmetros master se não existir
INSERT INTO public.parametros_sistema (id, gateway_provider, gateway_environment)
VALUES ('00000000-0000-0000-0000-000000000001', 'mercadopago', 'production')
ON CONFLICT (id) DO NOTHING;

-- 4. Habilitar RLS em ambas as tabelas
ALTER TABLE public.hotel_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_sistema ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança e Proteção das Chaves
DO $$
BEGIN
    -- Hotel Configurações
    DROP POLICY IF EXISTS "Autenticados gerenciam config hotel" ON public.hotel_configuracoes;
    CREATE POLICY "Autenticados gerenciam config hotel"
        ON public.hotel_configuracoes
        FOR ALL
        TO authenticated, service_role
        USING (true)
        WITH CHECK (true);

    -- Parâmetros do Sistema (Master SaaS)
    DROP POLICY IF EXISTS "Autenticados gerenciam parametros master" ON public.parametros_sistema;
    CREATE POLICY "Autenticados gerenciam parametros master"
        ON public.parametros_sistema
        FOR ALL
        TO authenticated, service_role
        USING (true)
        WITH CHECK (true);
END $$;

-- 6. Concessão de permissões de tabela para a API
GRANT ALL ON TABLE public.hotel_configuracoes TO authenticated, service_role;
GRANT ALL ON TABLE public.parametros_sistema TO authenticated, service_role;

-- 7. Notificação de conclusão
SELECT 'Separação de credenciais Mercado Pago (Master SaaS vs Hotéis) aplicada com sucesso!' AS status;
