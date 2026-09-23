-- =============================================================================
-- Migration: 20260117000001_add_destaques_icone_classe.sql
-- Descrição: Adiciona a coluna icone_classe TEXT na tabela public.destaques_quarto
--            para permitir uso de ícones via classe CSS (ex: UIcons, FontAwesome).
--            A coluna NÃO substitui o campo icone (Material Symbols); ela tem
--            PRIORIDADE quando preenchida.
-- Autor: HotelNoZap2
-- Data: 2026-01-17
-- Modo: IDEMPOTENTE (pode rodar várias vezes sem erro)
-- =============================================================================

DO $$
BEGIN
    -- Tenta adicionar a coluna apenas se ela ainda não existir
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'destaques_quarto'
          AND column_name  = 'icone_classe'
    ) THEN
        ALTER TABLE public.destaques_quarto
        ADD COLUMN icone_classe TEXT DEFAULT '';

        RAISE NOTICE '✅ Coluna icone_classe adicionada com sucesso em public.destaques_quarto';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna icone_classe já existe em public.destaques_quarto — nada a fazer.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '⚠️  Erro ao processar migration icone_classe: % - %', SQLERRM, SQLSTATE;
END
$$;

-- =============================================================================
-- RESET SCHEMA CACHE (PostgREST)
-- =============================================================================
-- Após rodar este script no SQL Editor do Supabase, execute:
-- NOTIFY pgrst, 'reload schema';
-- OU vá em: Database → Replication → Reset Schema Cache
