-- Xavier Online 2027
-- Etapa 6C.1 — Estrutura de usuários, perfis e auditoria

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS secretaria VARCHAR(150),
    ADD COLUMN IF NOT EXISTS senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ultimo_login_em TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS criado_por INTEGER;

UPDATE public.usuarios
SET
    cpf = REGEXP_REPLACE(
        COALESCE(cpf, ''),
        '[^0-9]',
        '',
        'g'
    ),
    perfil = UPPER(TRIM(perfil)),
    ativo = COALESCE(ativo, TRUE),
    secretaria = NULLIF(TRIM(COALESCE(secretaria, '')), ''),
    atualizado_em = COALESCE(atualizado_em, NOW());

ALTER TABLE public.usuarios
    ALTER COLUMN ativo SET DEFAULT TRUE,
    ALTER COLUMN ativo SET NOT NULL,
    ALTER COLUMN perfil SET DEFAULT 'CONSULTA';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usuarios_perfil_valido_check'
          AND conrelid = 'public.usuarios'::regclass
    ) THEN
        ALTER TABLE public.usuarios
            ADD CONSTRAINT usuarios_perfil_valido_check
            CHECK (
                perfil IN (
                    'ADMIN',
                    'ASSESSOR',
                    'ATENDENTE',
                    'SECRETARIA',
                    'CONSULTA',
                    'LIDERANCA'
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usuarios_secretaria_obrigatoria_check'
          AND conrelid = 'public.usuarios'::regclass
    ) THEN
        ALTER TABLE public.usuarios
            ADD CONSTRAINT usuarios_secretaria_obrigatoria_check
            CHECK (
                perfil <> 'SECRETARIA'
                OR NULLIF(TRIM(COALESCE(secretaria, '')), '') IS NOT NULL
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usuarios_criado_por_fkey'
          AND conrelid = 'public.usuarios'::regclass
    ) THEN
        ALTER TABLE public.usuarios
            ADD CONSTRAINT usuarios_criado_por_fkey
            FOREIGN KEY (criado_por)
            REFERENCES public.usuarios(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_normalizado_uidx
    ON public.usuarios (
        REGEXP_REPLACE(
            COALESCE(cpf, ''),
            '[^0-9]',
            '',
            'g'
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_normalizado_uidx
    ON public.usuarios (LOWER(TRIM(email)))
    WHERE NULLIF(TRIM(COALESCE(email, '')), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS usuarios_perfil_ativo_idx
    ON public.usuarios (perfil, ativo);

CREATE INDEX IF NOT EXISTS usuarios_secretaria_ativo_idx
    ON public.usuarios (secretaria, ativo)
    WHERE secretaria IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.usuarios_auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_alvo_id INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    usuario_executor_id INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    acao VARCHAR(60) NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    endereco_ip VARCHAR(80),
    criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usuarios_auditoria_alvo_idx
    ON public.usuarios_auditoria (
        usuario_alvo_id,
        criado_em DESC
    );

CREATE INDEX IF NOT EXISTS usuarios_auditoria_executor_idx
    ON public.usuarios_auditoria (
        usuario_executor_id,
        criado_em DESC
    );

CREATE OR REPLACE FUNCTION public.atualizar_timestamp_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usuarios_atualizar_timestamp
    ON public.usuarios;

CREATE TRIGGER usuarios_atualizar_timestamp
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_usuario();