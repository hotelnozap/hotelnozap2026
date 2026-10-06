-- ==============================================================================
-- MIGRATION: METATAGS OPEN GRAPH & CTA DE ALTA CONVERSÃO PARA CADA HOTEL
-- TABELAS: public.hoteis e public.hotel_configuracoes
-- Permite que cada hotel tenha suas próprias meta tags para preview rico no WhatsApp
-- ==============================================================================

DO $$
BEGIN
    -- 1. Colunas na tabela public.hoteis
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'hoteis' AND column_name = 'meta_titulo'
    ) THEN
        ALTER TABLE public.hoteis ADD COLUMN meta_titulo TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'hoteis' AND column_name = 'meta_descricao'
    ) THEN
        ALTER TABLE public.hoteis ADD COLUMN meta_descricao TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'hoteis' AND column_name = 'meta_imagem'
    ) THEN
        ALTER TABLE public.hoteis ADD COLUMN meta_imagem TEXT DEFAULT '';
    END IF;

    -- 2. Colunas na tabela public.hotel_configuracoes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'hotel_configuracoes' AND column_name = 'meta_titulo'
    ) THEN
        ALTER TABLE public.hotel_configuracoes ADD COLUMN meta_titulo TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'hotel_configuracoes' AND column_name = 'meta_descricao'
    ) THEN
        ALTER TABLE public.hotel_configuracoes ADD COLUMN meta_descricao TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'hotel_configuracoes' AND column_name = 'meta_imagem'
    ) THEN
        ALTER TABLE public.hotel_configuracoes ADD COLUMN meta_imagem TEXT DEFAULT '';
    END IF;
END $$;

COMMENT ON COLUMN public.hoteis.meta_titulo IS 'Título personalizado da Meta Tag Open Graph (WhatsApp/Redes)';
COMMENT ON COLUMN public.hoteis.meta_descricao IS 'Descrição e CTA de alta conversão para o WhatsApp';
COMMENT ON COLUMN public.hoteis.meta_imagem IS 'Imagem de destaque personalizada para o preview do link';
