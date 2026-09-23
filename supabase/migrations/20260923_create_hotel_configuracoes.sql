-- ====================================================================
-- HOTEL NO ZAP - CONFIGURAÇÕES DO HOTEL (HORÁRIOS, REGRAS E SERVIÇOS)
-- Execute este script no SQL Editor do Supabase para criar a tabela
-- e habilitar a sincronização em tempo real (Realtime).
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.hotel_configuracoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES public.hoteis(id) ON DELETE CASCADE UNIQUE,
  criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- 1. Horários & Estadia
  check_in_horario TEXT DEFAULT '14:00',
  check_out_horario TEXT DEFAULT '12:00',
  tolerancia_check_out_minutos INTEGER DEFAULT 30,
  cafe_inicio TEXT DEFAULT '06:30',
  cafe_fim TEXT DEFAULT '10:00',
  silencio_inicio TEXT DEFAULT '22:00',
  silencio_fim TEXT DEFAULT '08:00',
  recepcao_24_horas BOOLEAN DEFAULT TRUE,
  recepcao_inicio TEXT DEFAULT '07:00',
  recepcao_fim TEXT DEFAULT '23:00',
  lazer_inicio TEXT DEFAULT '08:00',
  lazer_fim TEXT DEFAULT '20:00',

  -- 2. Regras & Políticas
  politica_cancelamento TEXT DEFAULT 'flexivel',
  politica_cancelamento_texto TEXT DEFAULT 'Cancelamento gratuito até 7 dias antes do check-in. Após este prazo, cobrança da primeira diária.',
  permite_pet TEXT DEFAULT 'sob_consulta',
  taxa_pet NUMERIC(10,2) DEFAULT 50.00,
  proibido_fumar BOOLEAN DEFAULT TRUE,
  idade_minima_checkin INTEGER DEFAULT 18,
  permite_visitantes BOOLEAN DEFAULT TRUE,
  regras_gerais_texto TEXT DEFAULT 'Prezado hóspede, respeite os horários de silêncio e as áreas de convivência. É vedado o uso de caixas de som nas áreas comuns.',

  -- 3. LGPD & Privacidade
  dpo_nome TEXT DEFAULT 'Encarregado de Privacidade',
  dpo_email TEXT DEFAULT 'privacidade@hotelnozap.com.br',
  dpo_telefone TEXT DEFAULT '(11) 99999-9999',
  exigir_consentimento_checkin BOOLEAN DEFAULT TRUE,
  prazo_retencao_anos INTEGER DEFAULT 5,
  enviar_aviso_privacidade_whatsapp BOOLEAN DEFAULT TRUE,
  politica_privacidade_texto TEXT DEFAULT 'Seus dados pessoais coletados durante a estadia são utilizados exclusivamente para cumprimento de obrigações legais (FNRH/Embratur, emissão fiscal) e comunicação direta via WhatsApp sobre sua reserva, em total conformidade com a LGPD (Lei nº 13.709/2018).',

  -- 4. Mercado Pago & Checkout
  mp_environment TEXT DEFAULT 'production',
  mp_public_key TEXT,
  mp_access_token TEXT,
  mp_client_id TEXT,
  mp_client_secret TEXT,
  mp_enable_pix BOOLEAN DEFAULT TRUE,
  mp_enable_credit_card BOOLEAN DEFAULT TRUE,
  mp_enable_boleto BOOLEAN DEFAULT FALSE,
  mp_max_installments TEXT DEFAULT '12'
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.hotel_configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Leitura pública de configurações" ON public.hotel_configuracoes;
    CREATE POLICY "Leitura pública de configurações" ON public.hotel_configuracoes FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Inserção de configurações" ON public.hotel_configuracoes;
    CREATE POLICY "Inserção de configurações" ON public.hotel_configuracoes FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Atualização de configurações" ON public.hotel_configuracoes;
    CREATE POLICY "Atualização de configurações" ON public.hotel_configuracoes FOR UPDATE USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Exclusão de configurações" ON public.hotel_configuracoes;
    CREATE POLICY "Exclusão de configurações" ON public.hotel_configuracoes FOR DELETE USING (true);
END $$;

-- Habilitar canal Realtime para escuta automática na Área do Hóspede
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'hotel_configuracoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hotel_configuracoes;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignora se publicação não existir no ambiente local
  NULL;
END $$;
