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

CREATE TABLE IF NOT EXISTS liderancas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    telefone VARCHAR(30),
    bairro VARCHAR(150),
    zona VARCHAR(20),
    secao VARCHAR(20),
    observacao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interacoes (
    id SERIAL PRIMARY KEY,
    protocolo VARCHAR(30),
    tipo VARCHAR(100),
    descricao TEXT,
    usuario VARCHAR(100),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cidadaos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    telefone VARCHAR(30),
    endereco TEXT,
    bairro VARCHAR(150),
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    perfil VARCHAR(50) DEFAULT 'consulta',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);