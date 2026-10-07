-- ================================================================
-- Migration: Reforço de Segurança & Isolamento Multi-Tenant (RLS)
-- Data: 2026-10-07
-- Modo: 100% Idempotente e Seguro (pode executar várias vezes)
-- ================================================================

-- 1. BLINDAGEM DA TABELA: hotel_configuracoes
ALTER TABLE IF EXISTS public.hotel_configuracoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'hotel_configuracoes'
    ) THEN
        -- Remove política antiga permissiva que dava acesso total a qualquer usuário autenticado
        DROP POLICY IF EXISTS "Acesso total para autenticados" ON public.hotel_configuracoes;
        DROP POLICY IF EXISTS "Hotel acessa apenas suas configuracoes" ON public.hotel_configuracoes;
        DROP POLICY IF EXISTS "Service role acesso total hotel_configuracoes" ON public.hotel_configuracoes;

        -- Nova política estrita: cada usuário só acessa as configurações do seu próprio hotel ou se for Administrador Geral
        CREATE POLICY "Hotel acessa apenas suas configuracoes"
            ON public.hotel_configuracoes
            FOR ALL
            TO authenticated
            USING (
                -- Administrador Global do Sistema
                EXISTS (
                    SELECT 1 FROM public.usuarios u
                    WHERE (u.auth_user_id = auth.uid() OR u.email = auth.jwt() ->> 'email')
                    AND (LOWER(u.perfil) LIKE '%admin%' OR LOWER(u.perfil) LIKE '%super%' OR u.email = 'contato@hotelnozap.com.br')
                )
                -- Usuário do respectivo Hotel
                OR EXISTS (
                    SELECT 1 FROM public.usuarios u
                    WHERE (u.auth_user_id = auth.uid() OR u.email = auth.jwt() ->> 'email')
                    AND u.hotel_id = hotel_configuracoes.hotel_id
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.usuarios u
                    WHERE (u.auth_user_id = auth.uid() OR u.email = auth.jwt() ->> 'email')
                    AND (LOWER(u.perfil) LIKE '%admin%' OR LOWER(u.perfil) LIKE '%super%' OR u.email = 'contato@hotelnozap.com.br')
                )
                OR EXISTS (
                    SELECT 1 FROM public.usuarios u
                    WHERE (u.auth_user_id = auth.uid() OR u.email = auth.jwt() ->> 'email')
                    AND u.hotel_id = hotel_configuracoes.hotel_id
                )
            );

        -- Política irrestrita para rotinas backend de service_role
        CREATE POLICY "Service role acesso total hotel_configuracoes"
            ON public.hotel_configuracoes
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 2. BLINDAGEM DA TABELA: parametros_sistema
ALTER TABLE IF EXISTS public.parametros_sistema ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'parametros_sistema'
    ) THEN
        DROP POLICY IF EXISTS "Acesso total autenticados parametros_sistema" ON public.parametros_sistema;
        DROP POLICY IF EXISTS "Acesso restrito administradores parametros_sistema" ON public.parametros_sistema;
        DROP POLICY IF EXISTS "Service role acesso total parametros_sistema" ON public.parametros_sistema;

        -- Apenas administradores podem ler ou modificar as credenciais master no Supabase
        CREATE POLICY "Acesso restrito administradores parametros_sistema"
            ON public.parametros_sistema
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.usuarios u
                    WHERE (u.auth_user_id = auth.uid() OR u.email = auth.jwt() ->> 'email')
                    AND (LOWER(u.perfil) LIKE '%admin%' OR LOWER(u.perfil) LIKE '%super%' OR u.email = 'contato@hotelnozap.com.br')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.usuarios u
                    WHERE (u.auth_user_id = auth.uid() OR u.email = auth.jwt() ->> 'email')
                    AND (LOWER(u.perfil) LIKE '%admin%' OR LOWER(u.perfil) LIKE '%super%' OR u.email = 'contato@hotelnozap.com.br')
                )
            );

        CREATE POLICY "Service role acesso total parametros_sistema"
            ON public.parametros_sistema
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

SELECT 'Políticas RLS de segurança e isolamento multi-tenant aplicadas com sucesso!' AS status;
