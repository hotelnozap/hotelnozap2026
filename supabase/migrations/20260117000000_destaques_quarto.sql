-- ================================================================
-- Migration: Destaques da Acomodação (CRUD front-end)
--   + Relacionamento M:N: quartos ↔ destaques_quarto
-- Data: 2026-01-17  (corrigida 2026-09-15: quarto_id UUID vs BIGINT)
-- Modo: IDEMPOTENTE — pode rodar quantas vezes quiser sem erro.
--   Usa blocos DO $$ ... $$ com exception handlers.
-- ================================================================

-- ----------------------------------------------------------------
-- PASSO 1: ROLLBACK SEGURO (limpa qualquer estado anterior,
--   independentemente do que exista no banco agora)
-- ----------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP TABLE IF EXISTS public.quartos_destaques CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_destaques_quarto_atualizado ON public.destaques_quarto';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP TABLE IF EXISTS public.destaques_quarto CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS public.set_atualizado_em_destaques() CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;


-- ----------------------------------------------------------------
-- PASSO 2: TABELA PRINCIPAL — destaques_quarto (cadastra-se pelo front)
--   PK: BIGSERIAL (numérico auto-incremento)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.destaques_quarto (
    id          BIGSERIAL PRIMARY KEY,
    hotel_id    UUID REFERENCES public.hoteis(id) ON DELETE CASCADE ON UPDATE CASCADE,
    icone       TEXT NOT NULL DEFAULT 'bed',
    icone_cor   TEXT DEFAULT NULL,
    titulo      TEXT NOT NULL,
    subtitulo   TEXT DEFAULT '',
    ordenacao   INTEGER DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_destaques_quarto_hotel ON public.destaques_quarto(hotel_id);
CREATE INDEX IF NOT EXISTS idx_destaques_quarto_status ON public.destaques_quarto(status);
COMMENT ON TABLE public.destaques_quarto IS 'Destaques personalizáveis exibidos no topo da página DetalhesQuarto (ex: Cama King, Wi-Fi Fibra, Hidro Dupla, Vista Panorâmica, Split Inverter, Até X Hóspedes).';


-- ----------------------------------------------------------------
-- PASSO 3: TABELA PIVÔ M:N — quartos_destaques (quais destaques cada quarto tem)
--   ⚠  quarto_id = UUID     (compatível com quartos.id UUID PK)
--   ⚠  destaque_id = BIGINT (compatível com destaques_quarto.id BIGSERIAL PK)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quartos_destaques (
    id          BIGSERIAL PRIMARY KEY,
    quarto_id   UUID NOT NULL REFERENCES public.quartos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    destaque_id BIGINT NOT NULL REFERENCES public.destaques_quarto(id) ON DELETE CASCADE ON UPDATE CASCADE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(quarto_id, destaque_id)
);
CREATE INDEX IF NOT EXISTS idx_quartos_destaques_quarto  ON public.quartos_destaques(quarto_id);
CREATE INDEX IF NOT EXISTS idx_quartos_destaques_destaque ON public.quartos_destaques(destaque_id);
COMMENT ON TABLE public.quartos_destaques IS 'Relacionamento muitos-para-muitos entre quartos e seus destaques (amenities principais).';


-- ----------------------------------------------------------------
-- PASSO 4: TRIGGER — atualiza automaticamente "atualizado_em"
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_atualizado_em_destaques()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS trg_destaques_quarto_atualizado ON public.destaques_quarto;
CREATE TRIGGER trg_destaques_quarto_atualizado
BEFORE UPDATE ON public.destaques_quarto
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_destaques();


-- ----------------------------------------------------------------
-- PASSO 5 (Opcional): SEED dos 6 destaques-padrão do layout
--   Só insere se a tabela estiver VAZIA para não duplicar.
--   Se preferir, remova esta parte e cadastre tudo pelo front.
-- ----------------------------------------------------------------
INSERT INTO public.destaques_quarto
    (hotel_id, icone, titulo, subtitulo, ordenacao, status)
SELECT
    h.id                                           AS hotel_id,
    seed.icone                                      AS icone,
    seed.titulo                                     AS titulo,
    seed.subtitulo                                  AS subtitulo,
    seed.ordenacao                                  AS ordenacao,
    'ativo'                                         AS status
FROM (
    SELECT 'bed'                     AS icone, 'Cama King Size'       AS titulo, 'Lençóis 300 fios'         AS subtitulo, 1 AS ordenacao  UNION ALL
    SELECT 'group'                   AS icone, 'Até 2 Hóspedes'       AS titulo, 'Espaço Família'           AS subtitulo, 2 AS ordenacao  UNION ALL
    SELECT 'bathtub'                 AS icone, 'Hidro Dupla'          AS titulo, 'Privativa & Aquecida'     AS subtitulo, 3 AS ordenacao  UNION ALL
    SELECT 'waves'                   AS icone, 'Vista Panorâmica'     AS titulo, 'Varanda com Rede'        AS subtitulo, 4 AS ordenacao  UNION ALL
    SELECT 'ac_unit'                 AS icone, 'Split Inverter'       AS titulo, 'Silencioso & Potente'    AS subtitulo, 5 AS ordenacao  UNION ALL
    SELECT 'signal_cellular_alt'     AS icone, 'Wi-Fi Fibra 500M'     AS titulo, 'Sinal dedicado'           AS subtitulo, 6 AS ordenacao
) AS seed
CROSS JOIN (
    -- Pega o primeiro hotel cadastrado como dono do seed.
    -- Se houver múltiplos hoteis: cada um terá seus próprios destaques
    -- (gerenciáveis pelo front Gerenciar Destaques do MapaQuartos)
    SELECT id FROM public.hoteis ORDER BY criado_em LIMIT 1
) AS h
WHERE NOT EXISTS (SELECT 1 FROM public.destaques_quarto);
