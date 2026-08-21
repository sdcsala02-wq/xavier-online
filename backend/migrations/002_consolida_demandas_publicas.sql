-- Xavier Online 2027
-- Etapa 5 - Consolidação das demandas públicas
--
-- Objetivos:
-- 1. demandas_gabinete passa a ser a referência operacional canônica;
-- 2. solicitacoes_publicas permanece como registro/auditoria da entrada pública;
-- 3. cada solicitação pública passa a possuir vínculo explícito com sua demanda;
-- 4. solicitações antigas sem espelho são inseridas de forma idempotente;
-- 5. protocolos canônicos não podem ser duplicados.
--
-- Esta migration não remove tabelas nem registros históricos.

ALTER TABLE solicitacoes_publicas
ADD COLUMN IF NOT EXISTS demanda_gabinete_id INTEGER;


-- ============================================================
-- PROTEÇÃO: NÃO ACEITAR PROTOCOLOS CANÔNICOS DUPLICADOS
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM demandas_gabinete
    WHERE protocolo IS NOT NULL
      AND BTRIM(protocolo) <> ''
    GROUP BY UPPER(BTRIM(protocolo))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existem protocolos duplicados normalizados em demandas_gabinete.';
  END IF;
END
$$;


CREATE UNIQUE INDEX IF NOT EXISTS
  ux_demandas_gabinete_protocolo_normalizado
ON demandas_gabinete (
  UPPER(BTRIM(protocolo))
)
WHERE protocolo IS NOT NULL
  AND BTRIM(protocolo) <> '';


-- ============================================================
-- VINCULAR SOLICITAÇÕES QUE JÁ POSSUEM DEMANDA
-- ============================================================

UPDATE solicitacoes_publicas sp
SET demanda_gabinete_id = dg.id
FROM demandas_gabinete dg
WHERE sp.demanda_gabinete_id IS NULL
  AND sp.protocolo IS NOT NULL
  AND UPPER(BTRIM(dg.protocolo))
      = UPPER(BTRIM(sp.protocolo));


-- ============================================================
-- BACKFILL DAS SOLICITAÇÕES SEM DEMANDA CANÔNICA
-- ============================================================
--
-- hash_registro:
-- São produzidos 64 caracteres hexadecimais de forma determinística,
-- sem depender da extensão pgcrypto.
--
-- A idempotência principal é garantida pelo protocolo.

INSERT INTO demandas_gabinete (
  cidadao_id,
  protocolo,
  assunto,
  descricao,
  secretaria,
  bairro,
  status,
  data,
  criado_em,
  hash_registro
)
SELECT
  sp.cidadao_id,
  UPPER(BTRIM(sp.protocolo)),
  sp.servico,
  sp.descricao,
  sp.secretaria,
  sp.bairro,
  COALESCE(
    NULLIF(BTRIM(sp.status), ''),
    'RECEBIDA'
  ),
  sp.criado_em,
  sp.criado_em,

  md5(
    'XAVIER_PUBLICO_A|' ||
    UPPER(BTRIM(sp.protocolo))
  )
  ||
  md5(
    'XAVIER_PUBLICO_B|' ||
    UPPER(BTRIM(sp.protocolo))
  )

FROM solicitacoes_publicas sp

WHERE sp.demanda_gabinete_id IS NULL

  AND NOT EXISTS (
    SELECT 1
    FROM demandas_gabinete dg
    WHERE UPPER(BTRIM(dg.protocolo))
        = UPPER(BTRIM(sp.protocolo))
  );


-- ============================================================
-- VINCULAR AS DEMANDAS CRIADAS PELO BACKFILL
-- ============================================================

UPDATE solicitacoes_publicas sp
SET demanda_gabinete_id = dg.id
FROM demandas_gabinete dg
WHERE sp.demanda_gabinete_id IS NULL
  AND UPPER(BTRIM(dg.protocolo))
      = UPPER(BTRIM(sp.protocolo));


-- ============================================================
-- GARANTIA: NENHUMA SOLICITAÇÃO PÚBLICA PODE FICAR ÓRFÃ
-- APÓS O BACKFILL
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM solicitacoes_publicas
    WHERE demanda_gabinete_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existem solicitacoes_publicas sem demanda_gabinete_id após o backfill.';
  END IF;
END
$$;


-- ============================================================
-- FK EXPLÍCITA PARA A FONTE CANÔNICA
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'fk_solicitacao_demanda_gabinete'
  ) THEN

    ALTER TABLE solicitacoes_publicas
    ADD CONSTRAINT
      fk_solicitacao_demanda_gabinete
    FOREIGN KEY (
      demanda_gabinete_id
    )
    REFERENCES demandas_gabinete(id)
    ON DELETE SET NULL;

  END IF;
END
$$;


-- ============================================================
-- RELAÇÃO 1:1 ENTRE SOLICITAÇÃO PÚBLICA E DEMANDA CANÔNICA
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  ux_solicitacoes_publicas_demanda_gabinete_id
ON solicitacoes_publicas (
  demanda_gabinete_id
)
WHERE demanda_gabinete_id IS NOT NULL;


COMMENT ON COLUMN
  solicitacoes_publicas.demanda_gabinete_id
IS
  'Demanda operacional canônica correspondente em demandas_gabinete.';


-- ============================================================
-- VALIDAÇÃO FINAL DA MIGRATION
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM solicitacoes_publicas sp

    LEFT JOIN demandas_gabinete dg
      ON dg.id =
         sp.demanda_gabinete_id

    WHERE dg.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Integridade final inválida entre solicitacoes_publicas e demandas_gabinete.';
  END IF;
END
$$;
-- ============================================================
-- GARANTIA FUTURA: TODA SOLICITACAO PUBLICA TEM DEMANDA CANONICA
-- ============================================================

CREATE OR REPLACE FUNCTION fn_vincular_solicitacao_publica_demanda()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_demanda_id INTEGER;
BEGIN
  IF NEW.demanda_gabinete_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id
  INTO v_demanda_id
  FROM demandas_gabinete
  WHERE UPPER(BTRIM(protocolo)) = UPPER(BTRIM(NEW.protocolo))
  LIMIT 1;

  IF v_demanda_id IS NULL THEN
    INSERT INTO demandas_gabinete (
      cidadao_id, protocolo, assunto, descricao, secretaria,
      bairro, status, data, criado_em, hash_registro
    )
    VALUES (
      NEW.cidadao_id,
      UPPER(BTRIM(NEW.protocolo)),
      NEW.servico,
      NEW.descricao,
      NEW.secretaria,
      NEW.bairro,
      COALESCE(NULLIF(BTRIM(NEW.status), ''), 'RECEBIDA'),
      NEW.criado_em,
      NEW.criado_em,
      md5('XAVIER_PUBLICO_A|' || UPPER(BTRIM(NEW.protocolo))) ||
      md5('XAVIER_PUBLICO_B|' || UPPER(BTRIM(NEW.protocolo)))
    )
    RETURNING id INTO v_demanda_id;
  END IF;

  NEW.demanda_gabinete_id := v_demanda_id;
  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_vincular_solicitacao_publica_demanda'
      AND tgrelid = 'solicitacoes_publicas'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_vincular_solicitacao_publica_demanda
    BEFORE INSERT ON solicitacoes_publicas
    FOR EACH ROW
    EXECUTE FUNCTION fn_vincular_solicitacao_publica_demanda();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION fn_sincronizar_status_demanda_publica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE solicitacoes_publicas
  SET status = NEW.status
  WHERE demanda_gabinete_id = NEW.id
    AND status IS DISTINCT FROM NEW.status;

  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_sincronizar_status_demanda_publica'
      AND tgrelid = 'demandas_gabinete'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_sincronizar_status_demanda_publica
    AFTER UPDATE OF status ON demandas_gabinete
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_sincronizar_status_demanda_publica();
  END IF;
END
$$;
