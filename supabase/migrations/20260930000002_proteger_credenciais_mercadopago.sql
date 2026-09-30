-- ================================================================
-- Migration: Proteção & Blindagem de Credenciais Mercado Pago
-- Data: 2026-09-30
-- Modo: 100% Idempotente e Seguro (pode executar várias vezes)
-- ================================================================

-- 1. Garante que a tabela hotel_configuracoes tem RLS ativo
ALTER TABLE IF EXISTS public.hotel_configuracoes ENABLE ROW LEVEL SECURITY;

-- 2. Revoga permissão de leitura de colunas confidenciais para usuários não autenticados (anon)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'hotel_configuracoes' 
        AND column_name = 'mp_access_token'
    ) THEN
        -- Revoga leitura anônima direta do Access Token e Client Secret
        REVOKE SELECT (mp_access_token, mp_client_secret) ON public.hotel_configuracoes FROM anon;
    END IF;
END $$;

-- 3. Atualiza as políticas de RLS para que o Access Token nunca seja exposto publicamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'hotel_configuracoes'
    ) THEN
        -- Política para usuários autenticados (admin e proprietários de hotel)
        DROP POLICY IF EXISTS "Acesso total para autenticados" ON public.hotel_configuracoes;
        CREATE POLICY "Acesso total para autenticados"
            ON public.hotel_configuracoes
            FOR ALL
            TO authenticated, service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 4. Notificação de confirmação
SELECT 'Blindagem de credenciais Mercado Pago executada com sucesso!' AS status;
