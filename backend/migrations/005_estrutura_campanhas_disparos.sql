-- Xavier Online 2027
-- Etapa 7A.2A
-- Fundação segura de campanhas e disparos.
-- Esta migration não habilita o envio de mensagens.

CREATE TABLE IF NOT EXISTS public.disparos_consentimentos (
    id BIGSERIAL PRIMARY KEY,
    telefone_normalizado VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'SEM_REGISTRO',
    origem VARCHAR(60),
    comprovante JSONB NOT NULL DEFAULT '{}'::JSONB,
    registrado_por INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_consentimentos_telefone_check
        CHECK (
            telefone_normalizado ~ '^[0-9]{12,13}$'
        ),

    CONSTRAINT disparos_consentimentos_status_check
        CHECK (
            status IN (
                'SEM_REGISTRO',
                'AUTORIZADO',
                'RECUSADO',
                'REVOGADO',
                'BLOQUEADO'
            )
        )
);

CREATE TABLE IF NOT EXISTS public.disparos_templates (
    id BIGSERIAL PRIMARY KEY,
    nome_interno VARCHAR(160) NOT NULL,
    nome_meta VARCHAR(160),
    idioma VARCHAR(20) NOT NULL DEFAULT 'pt_BR',
    categoria VARCHAR(30),
    corpo_previa TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    criado_por INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_templates_status_check
        CHECK (
            status IN (
                'RASCUNHO',
                'EM_ANALISE',
                'APROVADO',
                'REJEITADO',
                'PAUSADO'
            )
        ),

    CONSTRAINT disparos_templates_categoria_check
        CHECK (
            categoria IS NULL
            OR categoria IN (
                'MARKETING',
                'UTILITY',
                'AUTHENTICATION'
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS
    disparos_templates_nome_meta_idioma_uidx
ON public.disparos_templates (
    LOWER(TRIM(nome_meta)),
    LOWER(TRIM(idioma))
)
WHERE nome_meta IS NOT NULL
  AND TRIM(nome_meta) <> '';

CREATE TABLE IF NOT EXISTS public.disparos_campanhas (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(160) NOT NULL,
    base_destinatarios VARCHAR(20) NOT NULL,
    filtros JSONB NOT NULL DEFAULT '{}'::JSONB,
    tipo_mensagem VARCHAR(30) NOT NULL,
    template_id BIGINT
        REFERENCES public.disparos_templates(id)
        ON DELETE RESTRICT,
    mensagem_previa TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
    modo_preparacao BOOLEAN NOT NULL DEFAULT TRUE,
    agendada_para TIMESTAMPTZ,
    criado_por INTEGER NOT NULL
        REFERENCES public.usuarios(id)
        ON DELETE RESTRICT,
    aprovado_por INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    aprovado_em TIMESTAMPTZ,
    motivo_rejeicao TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_campanhas_base_check
        CHECK (
            base_destinatarios IN (
                'CIDADAOS',
                'ELEITORES',
                'LIDERANCAS'
            )
        ),

    CONSTRAINT disparos_campanhas_tipo_check
        CHECK (
            tipo_mensagem IN (
                'TEMPLATE_OFICIAL',
                'JANELA_24H'
            )
        ),

    CONSTRAINT disparos_campanhas_status_check
        CHECK (
            status IN (
                'RASCUNHO',
                'EM_VALIDACAO',
                'AGUARDANDO_APROVACAO',
                'APROVADA',
                'REJEITADA',
                'CANCELADA'
            )
        ),

    CONSTRAINT disparos_campanhas_preparacao_check
        CHECK (modo_preparacao = TRUE),

    CONSTRAINT disparos_campanhas_template_check
        CHECK (
            tipo_mensagem <> 'TEMPLATE_OFICIAL'
            OR template_id IS NOT NULL
        )
);

CREATE INDEX IF NOT EXISTS
    disparos_campanhas_status_idx
ON public.disparos_campanhas (
    status,
    criado_em DESC
);

CREATE TABLE IF NOT EXISTS public.disparos_destinatarios (
    id BIGSERIAL PRIMARY KEY,
    campanha_id BIGINT NOT NULL
        REFERENCES public.disparos_campanhas(id)
        ON DELETE CASCADE,
    base_origem VARCHAR(20) NOT NULL,
    origem_id BIGINT,
    nome_snapshot VARCHAR(200),
    telefone_original VARCHAR(50),
    telefone_normalizado VARCHAR(20),
    bairro_snapshot VARCHAR(160),
    consentimento_status VARCHAR(20) NOT NULL DEFAULT 'SEM_REGISTRO',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_VALIDACAO',
    motivo_bloqueio TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_destinatarios_base_check
        CHECK (
            base_origem IN (
                'CIDADAOS',
                'ELEITORES',
                'LIDERANCAS'
            )
        ),

    CONSTRAINT disparos_destinatarios_consentimento_check
        CHECK (
            consentimento_status IN (
                'SEM_REGISTRO',
                'AUTORIZADO',
                'RECUSADO',
                'REVOGADO',
                'BLOQUEADO'
            )
        ),

    CONSTRAINT disparos_destinatarios_status_check
        CHECK (
            status IN (
                'PENDENTE_VALIDACAO',
                'VALIDO',
                'TELEFONE_INVALIDO',
                'SEM_CONSENTIMENTO',
                'OPT_OUT',
                'DUPLICADO',
                'BLOQUEADO_PREPARACAO'
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS
    disparos_destinatarios_campanha_telefone_uidx
ON public.disparos_destinatarios (
    campanha_id,
    telefone_normalizado
)
WHERE telefone_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS
    disparos_destinatarios_campanha_status_idx
ON public.disparos_destinatarios (
    campanha_id,
    status
);

CREATE TABLE IF NOT EXISTS public.disparos_fila (
    id BIGSERIAL PRIMARY KEY,
    campanha_id BIGINT NOT NULL
        REFERENCES public.disparos_campanhas(id)
        ON DELETE CASCADE,
    destinatario_id BIGINT NOT NULL UNIQUE
        REFERENCES public.disparos_destinatarios(id)
        ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'BLOQUEADO_PREPARACAO',
    disponivel_em TIMESTAMPTZ,
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultima_tentativa_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_fila_status_check
        CHECK (
            status IN (
                'BLOQUEADO_PREPARACAO',
                'CANCELADO'
            )
        ),

    CONSTRAINT disparos_fila_tentativas_check
        CHECK (tentativas >= 0)
);

CREATE INDEX IF NOT EXISTS
    disparos_fila_status_idx
ON public.disparos_fila (
    status,
    disponivel_em
);

CREATE TABLE IF NOT EXISTS public.disparos_tentativas (
    id BIGSERIAL PRIMARY KEY,
    fila_id BIGINT NOT NULL
        REFERENCES public.disparos_fila(id)
        ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    resposta_provedor JSONB,
    erro TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_tentativas_status_check
        CHECK (
            status IN (
                'SIMULACAO',
                'BLOQUEADO_PREPARACAO',
                'ERRO_TECNICO'
            )
        )
);

CREATE TABLE IF NOT EXISTS public.disparos_auditoria (
    id BIGSERIAL PRIMARY KEY,
    campanha_id BIGINT
        REFERENCES public.disparos_campanhas(id)
        ON DELETE SET NULL,
    usuario_executor_id INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    acao VARCHAR(80) NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    endereco_ip VARCHAR(80),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
    disparos_auditoria_campanha_idx
ON public.disparos_auditoria (
    campanha_id,
    criado_em DESC
);

CREATE OR REPLACE FUNCTION
    public.atualizar_timestamp_disparos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
    disparos_consentimentos_atualizar_timestamp
ON public.disparos_consentimentos;

CREATE TRIGGER
    disparos_consentimentos_atualizar_timestamp
BEFORE UPDATE ON public.disparos_consentimentos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

DROP TRIGGER IF EXISTS
    disparos_templates_atualizar_timestamp
ON public.disparos_templates;

CREATE TRIGGER
    disparos_templates_atualizar_timestamp
BEFORE UPDATE ON public.disparos_templates
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

DROP TRIGGER IF EXISTS
    disparos_campanhas_atualizar_timestamp
ON public.disparos_campanhas;

CREATE TRIGGER
    disparos_campanhas_atualizar_timestamp
BEFORE UPDATE ON public.disparos_campanhas
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

DROP TRIGGER IF EXISTS
    disparos_destinatarios_atualizar_timestamp
ON public.disparos_destinatarios;

CREATE TRIGGER
    disparos_destinatarios_atualizar_timestamp
BEFORE UPDATE ON public.disparos_destinatarios
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

DROP TRIGGER IF EXISTS
    disparos_fila_atualizar_timestamp
ON public.disparos_fila;

CREATE TRIGGER
    disparos_fila_atualizar_timestamp
BEFORE UPDATE ON public.disparos_fila
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

COMMENT ON TABLE public.disparos_campanhas IS
    'Campanhas em preparação. O envio real permanece bloqueado na Etapa 7A.2A.';

COMMENT ON COLUMN public.disparos_campanhas.modo_preparacao IS
    'Proteção estrutural: deve permanecer TRUE até uma migration futura habilitar envio controlado.';

COMMENT ON TABLE public.disparos_consentimentos IS
    'Registro auditável de autorização, recusa e revogação por telefone.';

COMMENT ON TABLE public.disparos_fila IS
    'Fila estrutural bloqueada; não processa envios nesta etapa.';