"use strict";

const db = require("../backend/db");
const bcrypt = require("../backend/node_modules/bcryptjs");

const PERMISSOES_SISTEMA = [
  // Dashboard
  {
    codigo: "dashboard.visualizar",
    modulo: "dashboard",
    acao: "visualizar",
    descricao: "Visualizar o dashboard"
  },

  // Eleitores
  {
    codigo: "eleitores.visualizar",
    modulo: "eleitores",
    acao: "visualizar",
    descricao: "Visualizar eleitores"
  },
  {
    codigo: "eleitores.cadastrar",
    modulo: "eleitores",
    acao: "cadastrar",
    descricao: "Cadastrar eleitores"
  },
  {
    codigo: "eleitores.editar_proprios",
    modulo: "eleitores",
    acao: "editar_proprios",
    descricao: "Editar somente os eleitores cadastrados pelo próprio usuário"
  },
  {
    codigo: "eleitores.editar_todos",
    modulo: "eleitores",
    acao: "editar_todos",
    descricao: "Editar eleitores cadastrados por qualquer usuário"
  },
  {
    codigo: "eleitores.excluir",
    modulo: "eleitores",
    acao: "excluir",
    descricao: "Excluir eleitores"
  },
  {
    codigo: "eleitores.importar",
    modulo: "eleitores",
    acao: "importar",
    descricao: "Importar planilhas de eleitores"
  },
  {
    codigo: "eleitores.exportar_excel",
    modulo: "eleitores",
    acao: "exportar_excel",
    descricao: "Exportar eleitores em Excel"
  },
  {
    codigo: "eleitores.exportar_pdf",
    modulo: "eleitores",
    acao: "exportar_pdf",
    descricao: "Exportar eleitores em PDF"
  },

  // Lideranças
  {
    codigo: "liderancas.visualizar",
    modulo: "liderancas",
    acao: "visualizar",
    descricao: "Visualizar lideranças"
  },
  {
    codigo: "liderancas.cadastrar",
    modulo: "liderancas",
    acao: "cadastrar",
    descricao: "Cadastrar lideranças"
  },
  {
    codigo: "liderancas.editar",
    modulo: "liderancas",
    acao: "editar",
    descricao: "Editar lideranças"
  },
  {
    codigo: "liderancas.excluir",
    modulo: "liderancas",
    acao: "excluir",
    descricao: "Excluir lideranças"
  },

  // Mapa
  {
    codigo: "mapa.visualizar",
    modulo: "mapa",
    acao: "visualizar",
    descricao: "Visualizar o mapa eleitoral"
  },
  {
    codigo: "mapa.dados_completos",
    modulo: "mapa",
    acao: "dados_completos",
    descricao: "Visualizar dados completos no mapa"
  },

  // Relatórios
  {
    codigo: "relatorios.visualizar",
    modulo: "relatorios",
    acao: "visualizar",
    descricao: "Visualizar relatórios"
  },
  {
    codigo: "relatorios.exportar_excel",
    modulo: "relatorios",
    acao: "exportar_excel",
    descricao: "Exportar relatórios em Excel"
  },
  {
    codigo: "relatorios.exportar_pdf",
    modulo: "relatorios",
    acao: "exportar_pdf",
    descricao: "Exportar relatórios em PDF"
  },

  // Usuários
  {
    codigo: "usuarios.visualizar",
    modulo: "usuarios",
    acao: "visualizar",
    descricao: "Visualizar usuários"
  },
  {
    codigo: "usuarios.criar",
    modulo: "usuarios",
    acao: "criar",
    descricao: "Criar usuários"
  },
  {
    codigo: "usuarios.editar",
    modulo: "usuarios",
    acao: "editar",
    descricao: "Editar usuários"
  },
  {
    codigo: "usuarios.redefinir_senha",
    modulo: "usuarios",
    acao: "redefinir_senha",
    descricao: "Redefinir senhas de usuários"
  },
  {
    codigo: "usuarios.alterar_permissoes",
    modulo: "usuarios",
    acao: "alterar_permissoes",
    descricao: "Alterar permissões individuais"
  },
  {
    codigo: "usuarios.bloquear",
    modulo: "usuarios",
    acao: "bloquear",
    descricao: "Bloquear ou desbloquear usuários"
  },
  {
    codigo: "usuarios.excluir",
    modulo: "usuarios",
    acao: "excluir",
    descricao: "Excluir usuários"
  },
  {
    codigo: "usuarios.ver_acessos",
    modulo: "usuarios",
    acao: "ver_acessos",
    descricao: "Visualizar histórico e últimos acessos"
  },

  // Configurações
  {
    codigo: "configuracoes.visualizar",
    modulo: "configuracoes",
    acao: "visualizar",
    descricao: "Visualizar configurações"
  },
  {
    codigo: "configuracoes.editar",
    modulo: "configuracoes",
    acao: "editar",
    descricao: "Alterar configurações"
  },

  // Clientes e candidatos
  {
    codigo: "clientes.visualizar_todos",
    modulo: "clientes",
    acao: "visualizar_todos",
    descricao: "Visualizar todos os clientes e candidatos"
  },
  {
    codigo: "clientes.gerenciar",
    modulo: "clientes",
    acao: "gerenciar",
    descricao: "Criar e administrar clientes e candidatos"
  }
];

const PERMISSOES_PADRAO = {
  ADMIN: "*",

  SUPERADMIN: "*",

  DIRETOR: [
    "dashboard.visualizar",

    "eleitores.visualizar",
    "eleitores.cadastrar",
    "eleitores.editar_proprios",
    "eleitores.editar_todos",
    "eleitores.excluir",
    "eleitores.importar",
    "eleitores.exportar_excel",
    "eleitores.exportar_pdf",

    "liderancas.visualizar",
    "liderancas.cadastrar",
    "liderancas.editar",
    "liderancas.excluir",

    "mapa.visualizar",
    "mapa.dados_completos",

    "relatorios.visualizar",
    "relatorios.exportar_excel",
    "relatorios.exportar_pdf",

    "usuarios.visualizar",
    "usuarios.criar",
    "usuarios.editar",
    "usuarios.redefinir_senha",
    "usuarios.alterar_permissoes",
    "usuarios.bloquear",
    "usuarios.ver_acessos",

    "configuracoes.visualizar"
  ],

  FUNCIONARIO: [
    "dashboard.visualizar",

    "eleitores.visualizar",
    "eleitores.cadastrar",
    "eleitores.editar_proprios",

    "liderancas.visualizar",

    "mapa.visualizar",

    "relatorios.visualizar"
  ],

  CONSULTA: [
    "dashboard.visualizar",
    "eleitores.visualizar",
    "liderancas.visualizar",
    "mapa.visualizar",
    "relatorios.visualizar"
  ],

  ASSESSOR: [
    "dashboard.visualizar",

    "eleitores.visualizar",
    "eleitores.cadastrar",
    "eleitores.editar_proprios",
    "eleitores.editar_todos",

    "liderancas.visualizar",
    "liderancas.cadastrar",
    "liderancas.editar",

    "mapa.visualizar",

    "relatorios.visualizar",

    "configuracoes.visualizar"
  ]
};

async function criarEstruturaPrincipal() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS candidatos (
      id SERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL,
      cargo VARCHAR(100),
      partido VARCHAR(50),
      cidade VARCHAR(100),
      estado VARCHAR(2),
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios_lucas (
      id SERIAL PRIMARY KEY,

      candidato_id INTEGER
        REFERENCES candidatos(id)
        ON DELETE SET NULL,

      nome VARCHAR(150) NOT NULL,

      cpf VARCHAR(11),

      login VARCHAR(80),

      email VARCHAR(150),

      senha VARCHAR(255) NOT NULL,

      perfil VARCHAR(30)
        NOT NULL
        DEFAULT 'FUNCIONARIO',

      ativo BOOLEAN DEFAULT TRUE,

      ultimo_acesso_em TIMESTAMP,

      ultimo_ip VARCHAR(100),

      tentativas_login_falhas INTEGER DEFAULT 0,

      bloqueado_ate TIMESTAMP,

      senha_alterada_em TIMESTAMP,

      precisa_alterar_senha BOOLEAN DEFAULT FALSE,

      criado_por_usuario_id INTEGER,

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_usuario_criado_por
        FOREIGN KEY (criado_por_usuario_id)
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS eleitores (
      id SERIAL PRIMARY KEY,

      candidato_id INTEGER NOT NULL
        REFERENCES candidatos(id)
        ON DELETE CASCADE,

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

      criado_por_usuario_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      atualizado_por_usuario_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS importacoes_eleitores (
      id SERIAL PRIMARY KEY,

      candidato_id INTEGER NOT NULL
        REFERENCES candidatos(id)
        ON DELETE CASCADE,

      usuario_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      nome_arquivo VARCHAR(255),

      total_registros INTEGER DEFAULT 0,

      registros_importados INTEGER DEFAULT 0,

      registros_rejeitados INTEGER DEFAULT 0,

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function atualizarEstruturasExistentes() {
  await db.query(`
    ALTER TABLE candidatos
    ADD COLUMN IF NOT EXISTS atualizado_em
    TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS login VARCHAR(80);

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS ultimo_acesso_em TIMESTAMP;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS ultimo_ip VARCHAR(100);

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS tentativas_login_falhas
    INTEGER DEFAULT 0;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMP;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS senha_alterada_em TIMESTAMP;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS precisa_alterar_senha
    BOOLEAN DEFAULT FALSE;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS criado_por_usuario_id INTEGER;

    ALTER TABLE usuarios_lucas
    ADD COLUMN IF NOT EXISTS atualizado_em
    TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE usuarios_lucas
    ALTER COLUMN email DROP NOT NULL;

    ALTER TABLE eleitores
    ADD COLUMN IF NOT EXISTS criado_por_usuario_id INTEGER;

    ALTER TABLE eleitores
    ADD COLUMN IF NOT EXISTS atualizado_por_usuario_id INTEGER;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_usuario_criado_por'
      ) THEN
        ALTER TABLE usuarios_lucas
        ADD CONSTRAINT fk_usuario_criado_por
        FOREIGN KEY (criado_por_usuario_id)
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL;
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_eleitor_criado_por'
      ) THEN
        ALTER TABLE eleitores
        ADD CONSTRAINT fk_eleitor_criado_por
        FOREIGN KEY (criado_por_usuario_id)
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL;
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_eleitor_atualizado_por'
      ) THEN
        ALTER TABLE eleitores
        ADD CONSTRAINT fk_eleitor_atualizado_por
        FOREIGN KEY (atualizado_por_usuario_id)
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);
}

async function criarEstruturaPermissoes() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS permissoes (
      id SERIAL PRIMARY KEY,

      codigo VARCHAR(120)
        UNIQUE
        NOT NULL,

      modulo VARCHAR(60)
        NOT NULL,

      acao VARCHAR(60)
        NOT NULL,

      descricao VARCHAR(255),

      ativo BOOLEAN DEFAULT TRUE,

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS perfil_permissoes (
      id SERIAL PRIMARY KEY,

      perfil VARCHAR(30)
        NOT NULL,

      permissao_id INTEGER NOT NULL
        REFERENCES permissoes(id)
        ON DELETE CASCADE,

      permitido BOOLEAN DEFAULT TRUE,

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      UNIQUE (perfil, permissao_id)
    );

    CREATE TABLE IF NOT EXISTS usuario_permissoes (
      id SERIAL PRIMARY KEY,

      usuario_id INTEGER NOT NULL
        REFERENCES usuarios_lucas(id)
        ON DELETE CASCADE,

      permissao_id INTEGER NOT NULL
        REFERENCES permissoes(id)
        ON DELETE CASCADE,

      permitido BOOLEAN NOT NULL,

      alterado_por_usuario_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      UNIQUE (usuario_id, permissao_id)
    );

    CREATE TABLE IF NOT EXISTS acessos_usuarios (
      id BIGSERIAL PRIMARY KEY,

      usuario_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      login_informado VARCHAR(150),

      sucesso BOOLEAN NOT NULL DEFAULT FALSE,

      ip VARCHAR(100),

      user_agent TEXT,

      motivo VARCHAR(255),

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auditoria_usuarios (
      id BIGSERIAL PRIMARY KEY,

      usuario_alvo_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      realizado_por_usuario_id INTEGER
        REFERENCES usuarios_lucas(id)
        ON DELETE SET NULL,

      acao VARCHAR(80) NOT NULL,

      detalhes JSONB,

      ip VARCHAR(100),

      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function criarIndices() {
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_usuarios_lucas_cpf_unico
    ON usuarios_lucas(cpf)
    WHERE cpf IS NOT NULL
      AND TRIM(cpf) <> '';

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_usuarios_lucas_login_unico
    ON usuarios_lucas(LOWER(login))
    WHERE login IS NOT NULL
      AND TRIM(login) <> '';

    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_usuarios_lucas_email_unico
    ON usuarios_lucas(LOWER(email))
    WHERE email IS NOT NULL
      AND TRIM(email) <> '';

    CREATE INDEX IF NOT EXISTS
      idx_usuarios_lucas_candidato
    ON usuarios_lucas(candidato_id);

    CREATE INDEX IF NOT EXISTS
      idx_usuarios_lucas_perfil
    ON usuarios_lucas(perfil);

    CREATE INDEX IF NOT EXISTS
      idx_usuarios_lucas_ativo
    ON usuarios_lucas(ativo);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_candidato
    ON eleitores(candidato_id);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_nome
    ON eleitores(nome);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_cidade
    ON eleitores(cidade);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_bairro
    ON eleitores(bairro);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_zona
    ON eleitores(zona);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_secao
    ON eleitores(secao);

    CREATE INDEX IF NOT EXISTS
      idx_eleitores_criado_por
    ON eleitores(criado_por_usuario_id);

    CREATE INDEX IF NOT EXISTS
      idx_permissoes_modulo
    ON permissoes(modulo);

    CREATE INDEX IF NOT EXISTS
      idx_perfil_permissoes_perfil
    ON perfil_permissoes(perfil);

    CREATE INDEX IF NOT EXISTS
      idx_usuario_permissoes_usuario
    ON usuario_permissoes(usuario_id);

    CREATE INDEX IF NOT EXISTS
      idx_acessos_usuarios_usuario
    ON acessos_usuarios(usuario_id);

    CREATE INDEX IF NOT EXISTS
      idx_acessos_usuarios_data
    ON acessos_usuarios(criado_em DESC);

    CREATE INDEX IF NOT EXISTS
      idx_auditoria_usuarios_alvo
    ON auditoria_usuarios(usuario_alvo_id);

    CREATE INDEX IF NOT EXISTS
      idx_auditoria_usuarios_data
    ON auditoria_usuarios(criado_em DESC);
  `);
}

async function cadastrarPermissoes() {
  for (const permissao of PERMISSOES_SISTEMA) {
    await db.query(
      `
        INSERT INTO permissoes (
          codigo,
          modulo,
          acao,
          descricao,
          ativo
        )
        VALUES ($1, $2, $3, $4, TRUE)

        ON CONFLICT (codigo)
        DO UPDATE SET
          modulo = EXCLUDED.modulo,
          acao = EXCLUDED.acao,
          descricao = EXCLUDED.descricao,
          ativo = TRUE
      `,
      [
        permissao.codigo,
        permissao.modulo,
        permissao.acao,
        permissao.descricao
      ]
    );
  }
}

async function cadastrarPermissoesDosPerfis() {
  const permissoesResultado = await db.query(`
    SELECT id, codigo
    FROM permissoes
    WHERE ativo = TRUE
  `);

  const permissoes = permissoesResultado.rows;

  for (
    const [perfil, codigosPermitidos]
    of Object.entries(PERMISSOES_PADRAO)
  ) {
    for (const permissao of permissoes) {
      const permitido =
        codigosPermitidos === "*" ||
        codigosPermitidos.includes(permissao.codigo);

      await db.query(
        `
          INSERT INTO perfil_permissoes (
            perfil,
            permissao_id,
            permitido,
            atualizado_em
          )
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)

          ON CONFLICT (perfil, permissao_id)
          DO UPDATE SET
            permitido = EXCLUDED.permitido,
            atualizado_em = CURRENT_TIMESTAMP
        `,
        [
          perfil,
          permissao.id,
          permitido
        ]
      );
    }
  }
}

async function garantirCandidatoInicial() {
  const candidatoExistente = await db.query(
    `
      SELECT id
      FROM candidatos
      WHERE nome = $1
      LIMIT 1
    `,
    ["Lucas Mourão"]
  );

  if (candidatoExistente.rows.length > 0) {
    return candidatoExistente.rows[0].id;
  }

  const novoCandidato = await db.query(
    `
      INSERT INTO candidatos (
        nome,
        cargo,
        cidade,
        estado,
        ativo
      )
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id
    `,
    [
      "Lucas Mourão",
      "Deputado Estadual",
      "Praia Grande",
      "SP"
    ]
  );

  return novoCandidato.rows[0].id;
}

async function garantirAdministradorInicial(
  candidatoId
) {
  const cpfAdministrador =
    "32531851844";

  const loginAdministrador =
    "edivaldo";

  const emailAdministrador =
    "admin@sistemalucas.com";

  const administradorExistente =
    await db.query(
      `
        SELECT id
        FROM usuarios_lucas
        WHERE cpf = $1
           OR LOWER(email) = LOWER($2)
           OR LOWER(login) = LOWER($3)
        LIMIT 1
      `,
      [
        cpfAdministrador,
        emailAdministrador,
        loginAdministrador
      ]
    );

  if (
    administradorExistente.rows.length === 0
  ) {
    const senhaCriptografada =
      await bcrypt.hash(
        "Lucas@2026",
        12
      );

    await db.query(
      `
        INSERT INTO usuarios_lucas (
          candidato_id,
          nome,
          cpf,
          login,
          email,
          senha,
          perfil,
          ativo,
          senha_alterada_em,
          precisa_alterar_senha
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          TRUE,
          CURRENT_TIMESTAMP,
          FALSE
        )
      `,
      [
        candidatoId,
        "Edivaldo",
        cpfAdministrador,
        loginAdministrador,
        emailAdministrador,
        senhaCriptografada,
        "ADMIN"
      ]
    );

    console.log(
      "Administrador inicial criado com sucesso."
    );

    return;
  }

  await db.query(
    `
      UPDATE usuarios_lucas
      SET
        candidato_id = COALESCE(
          candidato_id,
          $1
        ),

        nome = COALESCE(
          NULLIF(TRIM(nome), ''),
          $2
        ),

        cpf = COALESCE(
          NULLIF(TRIM(cpf), ''),
          $3
        ),

        login = COALESCE(
          NULLIF(TRIM(login), ''),
          $4
        ),

        email = COALESCE(
          NULLIF(TRIM(email), ''),
          $5
        ),

        perfil = 'ADMIN',

        ativo = TRUE,

        atualizado_em =
          CURRENT_TIMESTAMP

      WHERE id = $6
    `,
    [
      candidatoId,
      "Edivaldo",
      cpfAdministrador,
      loginAdministrador,
      emailAdministrador,
      administradorExistente.rows[0].id
    ]
  );

  console.log(
    "Administrador inicial verificado com sucesso."
  );
}

async function initDatabase() {
  try {
    console.log(
      "Verificando estrutura do Sistema Lucas..."
    );

    await criarEstruturaPrincipal();

    await atualizarEstruturasExistentes();

    await criarEstruturaPermissoes();

    await criarIndices();

    await cadastrarPermissoes();

    await cadastrarPermissoesDosPerfis();

    const candidatoId =
      await garantirCandidatoInicial();

    await garantirAdministradorInicial(
      candidatoId
    );

    console.log(
      "Tabelas, usuários e permissões do Sistema Lucas verificados com sucesso."
    );

  } catch (erro) {
    console.error(
      "Erro ao criar as tabelas do Sistema Lucas:",
      erro
    );

    throw erro;
  }
}

module.exports = initDatabase;