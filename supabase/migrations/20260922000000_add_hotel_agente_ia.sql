-- ==============================================================================
-- MIGRAÇÃO: Adiciona a coluna agente_ia na tabela hoteis
-- Cada hotel terá seu próprio agente de Inteligência Artificial exclusivo
-- Inicialmente em branco (NULL) para cada hotel configurar seu próprio agente
-- ==============================================================================

ALTER TABLE IF EXISTS public.hoteis ADD COLUMN IF NOT EXISTS agente_ia TEXT;

-- Remove qualquer valor default para manter em branco
ALTER TABLE IF EXISTS public.hoteis ALTER COLUMN agente_ia DROP DEFAULT;

-- Deixa em branco em todos os hotéis existentes
UPDATE public.hoteis SET agente_ia = NULL;
