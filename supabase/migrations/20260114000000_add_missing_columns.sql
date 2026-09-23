-- ==============================================================================
-- MIGRAÇÃO: Colunas faltantes p/ corrigir erro "Could not find auth_user_id column"
-- e colunas de redes sociais, endereço (numero), referência de parceiro
-- Aplicar via SQL Editor no Supabase caso o apply_migration falhe por permissions
-- ==============================================================================

-- 1. NUMERO (endereço) - já existia em rodada anterior; reexecutar é safe
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.hospedes ADD COLUMN IF NOT EXISTS numero TEXT;

-- 2. Usuários: vínculo com auth.users (erro CRÍTICO do ROLLBACK PARCIAL)
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS password TEXT;

-- 3. Hoteis: redes sociais, link público, referência parceiro
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS facebook TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS tiktok TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS parceiro_referencia TEXT;
