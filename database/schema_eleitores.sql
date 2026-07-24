CREATE TABLE IF NOT EXISTS candidatos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cargo VARCHAR(100),
    partido VARCHAR(50),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    candidato_id INTEGER REFERENCES candidatos(id) ON DELETE SET NULL,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    perfil VARCHAR(30) NOT NULL DEFAULT 'USUARIO',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS eleitores (
    id SERIAL PRIMARY KEY,
    candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    status VARCHAR(50),
    nome VARCHAR(200) NOT NULL,
    apelido VARCHAR(100),
    telefone VARCHAR(30),
    cidade VARCHAR(100),
    cep VARCHAR(20),
    endereco VARCHAR(200),
    bairro VARCHAR(120),
    numero VARCHAR(30),
    complemento VARCHAR(100),
    data_nascimento DATE,
    nome_mae VARCHAR(200),
    titulo_eleitoral VARCHAR(30),
    zona VARCHAR(20),
    secao VARCHAR(20),
    local_votacao VARCHAR(200),
    observacao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS importacoes (
    id SERIAL PRIMARY KEY,
    candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    nome_arquivo VARCHAR(255),
    total_registros INTEGER DEFAULT 0,
    registros_importados INTEGER DEFAULT 0,
    registros_rejeitados INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_candidato
ON usuarios(candidato_id);

CREATE INDEX IF NOT EXISTS idx_eleitores_candidato
ON eleitores(candidato_id);

CREATE INDEX IF NOT EXISTS idx_eleitores_nome
ON eleitores(nome);

CREATE INDEX IF NOT EXISTS idx_eleitores_cidade
ON eleitores(cidade);

CREATE INDEX IF NOT EXISTS idx_eleitores_bairro
ON eleitores(bairro);

CREATE INDEX IF NOT EXISTS idx_eleitores_zona
ON eleitores(zona);

CREATE INDEX IF NOT EXISTS idx_eleitores_secao
ON eleitores(secao);