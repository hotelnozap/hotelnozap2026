-- ==============================================================================
-- MIGRACAO PARCEIROS: 3 tabelas vinculadas (Auth <-> usuarios <-> parceiros)
-- FLUXO ESPERADO (transacao em 3 etapas com ROLLBACK em cascata no app):
--   1) cria auth.users (Supabase Auth)
--   2) cria public.usuarios <-> auth.users (perfil Parceiro)
--   3) cria public.parceiros <-> public.usuarios (dados do parceiro, pix, banco, comissao)
-- Qualquer falha em etapa 2 ou 3 -> app remove a etapa anterior + avisa limpar Auth manual
-- ==============================================================================

-- A) public.usuarios (colunas que podem estar faltando de rodadas anteriores)
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE IF EXISTS public.usuarios ADD COLUMN IF NOT EXISTS iniciais TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='usuarios' AND column_name='auth_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='usuarios_auth_user_id_fkey' AND table_schema='public'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- B) public.parceiros (dados bancarios + endereco + vinculos)
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS uf TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS pix_tipo TEXT DEFAULT 'PIX';
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS pix_chave TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS titular_pix TEXT;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS usuario_id UUID;
ALTER TABLE IF EXISTS public.parceiros ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- FK 1: parceiros.usuario_id -> public.usuarios.id (ON DELETE SET NULL, parceiro fica mas sem usuario de login)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parceiros' AND column_name='usuario_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='usuarios'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='parceiros_usuario_id_fkey' AND table_schema='public'
  ) THEN
    ALTER TABLE public.parceiros
      ADD CONSTRAINT parceiros_usuario_id_fkey
      FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- FK 2: parceiros.auth_user_id -> auth.users.id (ON DELETE SET NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='parceiros' AND column_name='auth_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='parceiros_auth_user_id_fkey' AND table_schema='public'
  ) THEN
    ALTER TABLE public.parceiros
      ADD CONSTRAINT parceiros_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ==============================================================================
-- MODO DE USO:
--   1) Abra Supabase -> SQL Editor -> New Query (projeto obkvgluunbnktzulzjfg)
--   2) Cole TODO este arquivo
--   3) Clique "Run"
--   4) Aguarde 60s para refresh do schema cache (salve qualquer coisa em Replication -> Realtime para forcar)
--   5) Teste salvar um parceiro novo com nome completo de banco e titular
-- ==============================================================================
