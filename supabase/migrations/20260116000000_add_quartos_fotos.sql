-- Migration: Adiciona colunas de fotos na tabela quartos
-- Data: 2026-01-16
-- Autor: Equipe HotelNoZap

-- Adiciona array de URLs das fotos cadastradas no upload (jsonb)
ALTER TABLE public.quartos
ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Adiciona URL da foto selecionada como capa (primeira do array por padrão)
ALTER TABLE public.quartos
ADD COLUMN IF NOT EXISTS foto_capa text;

-- Comentários para documentar
COMMENT ON COLUMN public.quartos.fotos IS 'Array JSON com URLs das fotos cadastradas no upload do quarto (máximo 5)';
COMMENT ON COLUMN public.quartos.foto_capa IS 'URL da foto selecionada como capa do quarto. Se vazio, usa fotos[0]';
