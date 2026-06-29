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