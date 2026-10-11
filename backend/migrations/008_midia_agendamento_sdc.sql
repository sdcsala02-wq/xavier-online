ALTER TABLE IF EXISTS public.sdc_disparos_web_campanhas
  ADD COLUMN IF NOT EXISTS agendada_para TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN IF NOT EXISTS midia_tipo TEXT,
  ADD COLUMN IF NOT EXISTS midia_nome TEXT,
  ADD COLUMN IF NOT EXISTS midia_mime TEXT,
  ADD COLUMN IF NOT EXISTS midia_dados BYTEA;

DO $$
BEGIN
  IF to_regclass('public.sdc_disparos_web_campanhas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS sdc_disparos_web_agendamento_idx
      ON public.sdc_disparos_web_campanhas (status, agendada_para)
      WHERE status = 'AGENDADA';
  END IF;
END $$;
