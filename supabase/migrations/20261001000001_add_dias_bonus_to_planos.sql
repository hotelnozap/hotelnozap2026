-- ==============================================================================
-- Migration: Adicionar coluna oficial 'dias_bonus' na tabela 'planos'
-- Data: 2026-10-01
-- Objetivo: Tornar o campo oficial 'dias_bonus' no banco de dados e sincronizar
--           bidirecionalmente com 'dias_trial' para segurança e retrocompatibilidade.
-- ==============================================================================

-- 1. Cria a coluna oficial dias_bonus caso ainda não exista
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS dias_bonus INTEGER DEFAULT 0;

-- 2. Migra os valores atuais de dias_trial para a nova coluna dias_bonus
UPDATE public.planos 
SET dias_bonus = COALESCE(dias_trial, 0);

-- 3. Cria função e gatilho para manter dias_bonus e dias_trial sempre sincronizados
CREATE OR REPLACE FUNCTION public.sync_planos_dias_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- Se dias_bonus for fornecido ou alterado, reflete em dias_trial
  IF NEW.dias_bonus IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.dias_bonus IS NULL OR NEW.dias_bonus <> OLD.dias_bonus) THEN
    NEW.dias_trial = NEW.dias_bonus;
  -- Se dias_trial for fornecido e dias_bonus estiver zerado/nulo, sincroniza dias_bonus
  ELSIF NEW.dias_trial IS NOT NULL AND (NEW.dias_bonus IS NULL OR NEW.dias_bonus = 0) THEN
    NEW.dias_bonus = NEW.dias_trial;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_planos_dias_bonus ON public.planos;
CREATE TRIGGER trg_sync_planos_dias_bonus
BEFORE INSERT OR UPDATE ON public.planos
FOR EACH ROW
EXECUTE FUNCTION public.sync_planos_dias_bonus();
