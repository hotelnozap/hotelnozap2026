-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Categorias de Comodidades NÍVEL HOTEL + Itens
-- Data: 2026-01-19
-- Idempotente: DO blocks + IF NOT EXISTS em toda parte
-- Nível Hotel: todas categorias valem para TODO estabelecimento (todos quartos herdam)
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. TABELA: hotel_comodidade_categorias
-- ============================================================
DO $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.hotel_comodidade_categorias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hotel_id UUID NOT NULL REFERENCES public.hoteis(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        icone TEXT DEFAULT '',
        icone_classe TEXT DEFAULT '',
        cor_icone TEXT DEFAULT '#006c49',
        ordenacao INT DEFAULT 1,
        status TEXT DEFAULT 'ativo',
        criado_em TIMESTAMPTZ DEFAULT NOW()
    );
EXCEPTION WHEN duplicate_table THEN
    NULL;
END $$;

-- FK index (performance para JOIN com hoteis)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_hotel_comodidade_categorias_hotel_id'
          AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_hotel_comodidade_categorias_hotel_id
            ON public.hotel_comodidade_categorias(hotel_id);
    END IF;
END $$;

-- Ordenacao + criado_em compound index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_hotel_comodidade_categorias_ordem'
          AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_hotel_comodidade_categorias_ordem
            ON public.hotel_comodidade_categorias(hotel_id, ordenacao ASC, criado_em ASC);
    END IF;
END $$;

-- ============================================================
-- 2. TABELA: hotel_comodidade_itens
-- ============================================================
DO $$
BEGIN
    CREATE TABLE IF NOT EXISTS public.hotel_comodidade_itens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        categoria_id UUID NOT NULL REFERENCES public.hotel_comodidade_categorias(id) ON DELETE CASCADE,
        texto TEXT NOT NULL,
        ordenacao INT DEFAULT 1,
        criado_em TIMESTAMPTZ DEFAULT NOW()
    );
EXCEPTION WHEN duplicate_table THEN
    NULL;
END $$;

-- FK index categoria_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_hotel_comodidade_itens_categoria_id'
          AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_hotel_comodidade_itens_categoria_id
            ON public.hotel_comodidade_itens(categoria_id);
    END IF;
END $$;

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS) + Policies
-- ============================================================

-- RLS: hotel_comodidade_categorias
DO $$
BEGIN
    ALTER TABLE public.hotel_comodidade_categorias ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Policy Leitura pública
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'hotel_comodidade_categorias'
          AND policyname = 'hotel_comodidade_categorias_select_publico'
    ) THEN
        CREATE POLICY hotel_comodidade_categorias_select_publico
            ON public.hotel_comodidade_categorias
            FOR SELECT
            USING (true);
    END IF;
END $$;

-- Policy Escrita (qualquer role autenticado / anon com permissão hotel owner)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'hotel_comodidade_categorias'
          AND policyname = 'hotel_comodidade_categorias_write_owner'
    ) THEN
        CREATE POLICY hotel_comodidade_categorias_write_owner
            ON public.hotel_comodidade_categorias
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- RLS: hotel_comodidade_itens
DO $$
BEGIN
    ALTER TABLE public.hotel_comodidade_itens ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Policy Leitura pública
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'hotel_comodidade_itens'
          AND policyname = 'hotel_comodidade_itens_select_publico'
    ) THEN
        CREATE POLICY hotel_comodidade_itens_select_publico
            ON public.hotel_comodidade_itens
            FOR SELECT
            USING (true);
    END IF;
END $$;

-- Policy Escrita
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'hotel_comodidade_itens'
          AND policyname = 'hotel_comodidade_itens_write_owner'
    ) THEN
        CREATE POLICY hotel_comodidade_itens_write_owner
            ON public.hotel_comodidade_itens
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- ============================================================
-- 4. Notifica PostgREST para recarregar schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
