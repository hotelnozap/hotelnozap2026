-- ==============================================================================
-- MIGRATION: ADICIONAR CREDENCIAIS DE MARKETING, RASTREAMENTO E SEGURANÇA WEB
-- TABELA: public.parametros_sistema
-- Permite que administradores configurem Meta Pixel, Metatag Google, GA4 e reCAPTCHA
-- ==============================================================================

DO $$
BEGIN
    -- 1. Meta Pixel ID (Facebook Ads)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'parametros_sistema' 
          AND column_name = 'meta_pixel_id'
    ) THEN
        ALTER TABLE public.parametros_sistema ADD COLUMN meta_pixel_id TEXT DEFAULT '';
    END IF;

    -- 2. Google Site Verification (Metatag de verificação de propriedade)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'parametros_sistema' 
          AND column_name = 'google_meta_tag'
    ) THEN
        ALTER TABLE public.parametros_sistema ADD COLUMN google_meta_tag TEXT DEFAULT '';
    END IF;

    -- 3. Google Analytics 4 (GA4 Measurement ID - G-XXXXXXXXXX)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'parametros_sistema' 
          AND column_name = 'google_analytics_id'
    ) THEN
        ALTER TABLE public.parametros_sistema ADD COLUMN google_analytics_id TEXT DEFAULT '';
    END IF;

    -- 4. Google reCAPTCHA Site Key (Chave Pública)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'parametros_sistema' 
          AND column_name = 'recaptcha_site_key'
    ) THEN
        ALTER TABLE public.parametros_sistema ADD COLUMN recaptcha_site_key TEXT DEFAULT '';
    END IF;

    -- 5. Google reCAPTCHA Secret Key (Chave Privada / Segredo)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'parametros_sistema' 
          AND column_name = 'recaptcha_secret_key'
    ) THEN
        ALTER TABLE public.parametros_sistema ADD COLUMN recaptcha_secret_key TEXT DEFAULT '';
    END IF;
END $$;

COMMENT ON COLUMN public.parametros_sistema.meta_pixel_id IS 'ID numérico do Meta Pixel (Facebook)';
COMMENT ON COLUMN public.parametros_sistema.google_meta_tag IS 'Código ou tag do Google Site Verification (Search Console)';
COMMENT ON COLUMN public.parametros_sistema.google_analytics_id IS 'ID de medição do Google Analytics 4 (G-XXXXXXXXXX)';
COMMENT ON COLUMN public.parametros_sistema.recaptcha_site_key IS 'Chave pública de site do Google reCAPTCHA';
COMMENT ON COLUMN public.parametros_sistema.recaptcha_secret_key IS 'Chave secreta de validação do Google reCAPTCHA';
