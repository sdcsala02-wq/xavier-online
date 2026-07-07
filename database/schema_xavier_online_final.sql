-- =====================================================
-- XAVIER ONLINE - ESTRUTURA FINAL DO BANCO
-- Migração segura - não apaga dados existentes
-- =====================================================


-- Ajuste da tabela liderancas existente
ALTER TABLE liderancas
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;


-- =====================================================
-- CIDADÃOS
-- =====================================================

CREATE TABLE IF NOT EXISTS cidadaos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    telefone VARCHAR(30),
    bairro VARCHAR(150),
    endereco TEXT,
    cep VARCHAR(20),
    cidade VARCHAR(100),
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- DEMANDAS
-- =====================================================

CREATE TABLE IF NOT EXISTS demandas (
    id SERIAL PRIMARY KEY,
    protocolo VARCHAR(30) UNIQUE NOT NULL,
    nome VARCHAR(200) NOT NULL,
    telefone VARCHAR(30),
    bairro VARCHAR(150),
    endereco TEXT,
    servico VARCHAR(200),
    secretaria VARCHAR(150),
    descricao TEXT,
    status VARCHAR(50) DEFAULT 'RECEBIDA',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- DEMANDAS GABINETE
-- =====================================================

CREATE TABLE IF NOT EXISTS demandas_gabinete (
    id SERIAL PRIMARY KEY,
    cidadao_id INTEGER REFERENCES cidadaos(id),
    protocolo VARCHAR(50),
    assunto VARCHAR(200),
    descricao TEXT,
    secretaria VARCHAR(150),
    bairro VARCHAR(150),
    status VARCHAR(50) DEFAULT 'RECEBIDA',
    data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- IMPORTAÇÕES GABINETE
-- =====================================================

CREATE TABLE IF NOT EXISTS importacoes_gabinete (
    id SERIAL PRIMARY KEY,
    arquivo VARCHAR(255),
    hash_arquivo TEXT UNIQUE,
    lote INTEGER,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- ELEITORES
-- =====================================================

CREATE TABLE IF NOT EXISTS eleitores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    cpf VARCHAR(20),
    telefone VARCHAR(30),
    bairro VARCHAR(150),
    zona VARCHAR(20),
    secao VARCHAR(20),
    endereco TEXT,
    observacao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- INTERAÇÕES MENSAIS
-- =====================================================

CREATE TABLE IF NOT EXISTS interacoes_mensais (
    id SERIAL PRIMARY KEY,
    ano INTEGER,
    mes INTEGER,
    quantidade INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- DEMANDAS HISTÓRICAS
-- =====================================================

CREATE TABLE IF NOT EXISTS demandas_historicas (
    id SERIAL PRIMARY KEY,
    ano INTEGER,
    mes INTEGER,
    secretaria VARCHAR(150),
    quantidade INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- ATIVIDADES LEGISLATIVAS
-- =====================================================

CREATE TABLE IF NOT EXISTS atividades_legislativas (
    id SERIAL PRIMARY KEY,
    ano INTEGER,
    mes INTEGER,
    tipo VARCHAR(100),
    quantidade INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- WHATSAPP - CENTRAL DE CONVERSAS
-- =====================================================

CREATE TABLE IF NOT EXISTS conversas_whatsapp (
    id SERIAL PRIMARY KEY,
    telefone VARCHAR(30) NOT NULL,
    nome VARCHAR(200),
    ultimo_contato TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS mensagens_whatsapp (
    id SERIAL PRIMARY KEY,
    conversa_id INTEGER REFERENCES conversas_whatsapp(id),
    telefone VARCHAR(30),
    mensagem TEXT,
    tipo VARCHAR(50),
    origem VARCHAR(50),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- AUDITORIA
-- =====================================================

CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    acao VARCHAR(100),
    tabela VARCHAR(100),
    registro_id INTEGER,
    detalhes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_demandas_protocolo
ON demandas(protocolo);

CREATE INDEX IF NOT EXISTS idx_whatsapp_telefone
ON conversas_whatsapp(telefone);

CREATE INDEX IF NOT EXISTS idx_eleitores_nome
ON eleitores(nome);
