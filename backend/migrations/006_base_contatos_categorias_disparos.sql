-- Xavier Online 2027
-- Etapa 7A.2C
-- Base própria de contatos importados e categorizados.
-- Esta migration não habilita o envio de mensagens.

CREATE TABLE IF NOT EXISTS public.disparos_importacoes (
    id BIGSERIAL PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    hash_arquivo CHAR(64),
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSANDO',
    total_linhas INTEGER NOT NULL DEFAULT 0,
    total_inseridos INTEGER NOT NULL DEFAULT 0,
    total_atualizados INTEGER NOT NULL DEFAULT 0,
    total_ignorados INTEGER NOT NULL DEFAULT 0,
    total_erros INTEGER NOT NULL DEFAULT 0,
    resumo JSONB NOT NULL DEFAULT '{}'::JSONB,
    criado_por INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluido_em TIMESTAMPTZ,

    CONSTRAINT disparos_importacoes_status_check
        CHECK (
            status IN (
                'PROCESSANDO',
                'CONCLUIDA',
                'CONCLUIDA_COM_ALERTAS',
                'FALHA',
                'CANCELADA'
            )
        ),

    CONSTRAINT disparos_importacoes_totais_check
        CHECK (
            total_linhas >= 0
            AND total_inseridos >= 0
            AND total_atualizados >= 0
            AND total_ignorados >= 0
            AND total_erros >= 0
        ),

    CONSTRAINT disparos_importacoes_hash_check
        CHECK (
            hash_arquivo IS NULL
            OR hash_arquivo ~ '^[a-f0-9]{64}$'
        )
);

CREATE INDEX IF NOT EXISTS
    disparos_importacoes_criado_em_idx
ON public.disparos_importacoes (
    iniciado_em DESC
);

CREATE TABLE IF NOT EXISTS public.disparos_contatos (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(200),
    telefone_original VARCHAR(50),
    telefone_normalizado VARCHAR(20) NOT NULL,
    bairro VARCHAR(160),
    cidade VARCHAR(160),
    origem VARCHAR(100),
    observacao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultima_importacao_id BIGINT
        REFERENCES public.disparos_importacoes(id)
        ON DELETE SET NULL,
    criado_por INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    metadados JSONB NOT NULL DEFAULT '{}'::JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_contatos_telefone_check
        CHECK (
            telefone_normalizado ~ '^55[0-9]{10,11}$'
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS
    disparos_contatos_telefone_uidx
ON public.disparos_contatos (
    telefone_normalizado
);

CREATE INDEX IF NOT EXISTS
    disparos_contatos_bairro_ativo_idx
ON public.disparos_contatos (
    bairro,
    ativo
);

CREATE TABLE IF NOT EXISTS public.disparos_categorias (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    nome_normalizado VARCHAR(120) NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por INTEGER
        REFERENCES public.usuarios(id)
        ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT disparos_categorias_nome_check
        CHECK (
            TRIM(nome) <> ''
            AND TRIM(nome_normalizado) <> ''
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS
    disparos_categorias_nome_normalizado_uidx
ON public.disparos_categorias (
    nome_normalizado
);

CREATE INDEX IF NOT EXISTS
    disparos_categorias_ativo_nome_idx
ON public.disparos_categorias (
    ativo,
    nome
);

CREATE TABLE IF NOT EXISTS
    public.disparos_contatos_categorias (
        contato_id BIGINT NOT NULL
            REFERENCES public.disparos_contatos(id)
            ON DELETE CASCADE,
        categoria_id BIGINT NOT NULL
            REFERENCES public.disparos_categorias(id)
            ON DELETE CASCADE,
        vinculado_por INTEGER
            REFERENCES public.usuarios(id)
            ON DELETE SET NULL,
        vinculado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        PRIMARY KEY (
            contato_id,
            categoria_id
        )
    );

CREATE INDEX IF NOT EXISTS
    disparos_contatos_categorias_categoria_idx
ON public.disparos_contatos_categorias (
    categoria_id,
    contato_id
);

CREATE TABLE IF NOT EXISTS
    public.disparos_importacoes_itens (
        id BIGSERIAL PRIMARY KEY,
        importacao_id BIGINT NOT NULL
            REFERENCES public.disparos_importacoes(id)
            ON DELETE CASCADE,
        linha_planilha INTEGER NOT NULL,
        contato_id BIGINT
            REFERENCES public.disparos_contatos(id)
            ON DELETE SET NULL,
        acao VARCHAR(20) NOT NULL,
        telefone_informado VARCHAR(50),
        detalhes JSONB NOT NULL DEFAULT '{}'::JSONB,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT disparos_importacoes_itens_linha_check
            CHECK (
                linha_planilha >= 2
            ),

        CONSTRAINT disparos_importacoes_itens_acao_check
            CHECK (
                acao IN (
                    'INSERIDO',
                    'ATUALIZADO',
                    'IGNORADO',
                    'ERRO'
                )
            )
    );

CREATE INDEX IF NOT EXISTS
    disparos_importacoes_itens_importacao_idx
ON public.disparos_importacoes_itens (
    importacao_id,
    linha_planilha
);

ALTER TABLE public.disparos_campanhas
    DROP CONSTRAINT IF EXISTS
        disparos_campanhas_base_check;

ALTER TABLE public.disparos_campanhas
    ADD CONSTRAINT disparos_campanhas_base_check
    CHECK (
        base_destinatarios IN (
            'CONTATOS',
            'CIDADAOS',
            'ELEITORES',
            'LIDERANCAS'
        )
    );

DROP TRIGGER IF EXISTS
    disparos_contatos_atualizar_timestamp
ON public.disparos_contatos;

CREATE TRIGGER
    disparos_contatos_atualizar_timestamp
BEFORE UPDATE ON public.disparos_contatos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

DROP TRIGGER IF EXISTS
    disparos_categorias_atualizar_timestamp
ON public.disparos_categorias;

CREATE TRIGGER
    disparos_categorias_atualizar_timestamp
BEFORE UPDATE ON public.disparos_categorias
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_timestamp_disparos();

COMMENT ON TABLE public.disparos_contatos IS
    'Base própria de contatos destinados à comunicação autorizada.';

COMMENT ON TABLE public.disparos_categorias IS
    'Categorias utilizadas para segmentação das campanhas.';

COMMENT ON TABLE public.disparos_contatos_categorias IS
    'Permite vincular um contato a uma ou várias categorias.';

COMMENT ON TABLE public.disparos_importacoes IS
    'Histórico auditável dos arquivos XLSX importados.';

COMMENT ON TABLE public.disparos_importacoes_itens IS
    'Resultado individual de cada linha processada na importação.';