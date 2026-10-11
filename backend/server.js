const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const webhookRoutes = require("./routes/webhook.routes");

require("dotenv").config();

const db = require("./db");

const {
  testarOpenAI
} = require("./services/openai.service");

const {
  enviarTextoWhatsApp,
  enviarTemplateWhatsApp,
  normalizarTelefoneBR
} = require("./services/whatsapp.service");

const demandasExportacoesRoutes = require("./routes/demandas-exportacoes.routes");
const relatoriosRoutes = require("./routes/relatorios.routes");
const dashboardRoutes = require("./routes/relatorios.dashboard.routes");
const liderancasRoutes = require("./routes/liderancas.routes");
const interacoesRoutes = require("./routes/interacoes.routes");
const cidadaosRoutes = require("./routes/cidadaos.routes");
const demandasGabineteRoutes = require("./routes/demandas-gabinete.routes");
const eleitoresRoutes = require("./routes/eleitores.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const disparosRoutes = require("./routes/disparos.routes");
const disparosContatosRoutes = require("./routes/disparos-contatos.routes");

const app = express();

const PORT =
  process.env.PORT ||
  3000;

const JWT_SECRET = String(
  process.env.JWT_SECRET || ""
).trim();

if (JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET obrigatório com pelo menos 32 caracteres."
  );
}

const frontendPath =
  path.join(
    __dirname,
    "public"
  );

const emProducao =
  process.env.NODE_ENV ===
  "production";

if (emProducao) {
  app.set(
    "trust proxy",
    1
  );
}

app.disable(
  "x-powered-by"
);

const opcoesHelmet = {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
};

if (!emProducao) {
  opcoesHelmet.strictTransportSecurity =
    false;
}

app.use(
  helmet(opcoesHelmet)
);

app.use(
  express.json({
    limit: "20mb",
    verify: (req, res, buffer) => {
      if (req.originalUrl === "/api/webhook") {
        req.rawBody = Buffer.from(buffer);
      }
    }
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use((req, res, next) => {
  console.log(
    "======================================"
  );

  console.log(
    `${req.method} ${req.originalUrl}`
  );

  console.log(
    "======================================"
  );

  next();
});

app.use(cookieParser());

function limparCPF(valor) {
  return String(valor || "")
    .replace(/\D/g, "");
}

function cpfValido(valor) {
  return limparCPF(valor).length === 11;
}

function normalizarPerfil(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase();
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      cpf: limparCPF(usuario.cpf),
      perfil: normalizarPerfil(
        usuario.perfil
      )
    },
    JWT_SECRET,
    {
      expiresIn: "8h"
    }
  );
}

async function obterUsuarioAtivoPorToken(
  token
) {
  const payload = jwt.verify(
    token,
    JWT_SECRET
  );

  const usuarioId = Number(
    payload?.id
  );

  if (
    !Number.isInteger(usuarioId) ||
    usuarioId <= 0
  ) {
    throw new Error(
      "TOKEN_SEM_USUARIO_VALIDO"
    );
  }

  const resultado = await db.query(
    `
    SELECT
      id,
      nome,
      email,
      cpf,
      perfil,
      ativo
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  if (resultado.rows.length === 0) {
    throw new Error(
      "USUARIO_NAO_ENCONTRADO"
    );
  }

  const usuario =
    resultado.rows[0];

  if (usuario.ativo !== true) {
    throw new Error(
      "USUARIO_INATIVO"
    );
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    cpf: usuario.cpf,
    perfil: normalizarPerfil(
      usuario.perfil
    ),
    ativo: true
  };
}

function extrairTokenRequisicao(req) {
  const tokenCookie =
    req.cookies?.token;

  const autorizacao = String(
    req.headers.authorization || ""
  );

  const tokenBearer =
    autorizacao.startsWith(
      "Bearer "
    )
      ? autorizacao
          .slice(7)
          .trim()
      : "";

  return (
    tokenCookie ||
    tokenBearer ||
    ""
  );
}

function limparCookieToken(res) {
  res.clearCookie(
    "token",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/"
    }
  );
}

async function autenticar(
  req,
  res,
  next
) {
  const token =
    extrairTokenRequisicao(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      mensagem:
        "Acesso não autorizado."
    });
  }

  try {
    req.usuario =
      await obterUsuarioAtivoPorToken(
        token
      );

    return next();
  } catch (erro) {
    limparCookieToken(res);

    return res.status(401).json({
      ok: false,
      mensagem:
        "Sessão inválida, expirada ou usuário inativo."
    });
  }
}

function autorizarPerfis(
  ...perfisPermitidos
) {
  const perfisNormalizados =
    new Set(
      perfisPermitidos.map(
        normalizarPerfil
      )
    );

  return (req, res, next) => {
    const perfilAtual =
      normalizarPerfil(
        req.usuario?.perfil
      );

    if (
      !perfilAtual ||
      !perfisNormalizados.has(
        perfilAtual
      )
    ) {
      return res.status(403).json({
        ok: false,
        mensagem:
          "Você não tem permissão para acessar este recurso."
      });
    }

    return next();
  };
}

async function autenticarPagina(
  req,
  res,
  next
) {
  const paginasPublicas = [
    "index.html",
    "login.html",
    "nova-demanda.html",
    "protocolo-publico.html"
  ];

  const pagina =
    req.params.pagina ||
    "index.html";

  if (
    paginasPublicas.includes(
      pagina
    )
  ) {
    return next();
  }

  const token =
    req.cookies?.token;

  if (!token) {
    return res.redirect(
      "/index.html"
    );
  }

  try {
    req.usuario =
      await obterUsuarioAtivoPorToken(
        token
      );

    return next();
  } catch (erro) {
    limparCookieToken(res);

    return res.redirect(
      "/index.html"
    );
  }
}

function protegerPaginaPorPerfil(
  perfisPermitidos
) {
  const perfisNormalizados =
    new Set(
      perfisPermitidos.map(
        normalizarPerfil
      )
    );

  return async (
    req,
    res,
    next
  ) => {
    const token =
      req.cookies?.token;

    if (!token) {
      return res.redirect(
        "/index.html"
      );
    }

    try {
      const usuario =
        await obterUsuarioAtivoPorToken(
          token
        );

      if (
        !perfisNormalizados.has(
          usuario.perfil
        )
      ) {
        return res
          .status(403)
          .send(
            "Acesso negado."
          );
      }

      req.usuario = usuario;

      return next();
    } catch (erro) {
      limparCookieToken(res);

      return res.redirect(
        "/index.html"
      );
    }
  };
}

function gerarHashDemanda({
  protocolo,
  cidadaoId,
  servico,
  descricao,
  secretaria,
  bairro
}) {
  const conteudo = [
    protocolo || "",
    cidadaoId || "",
    servico || "",
    descricao || "",
    secretaria || "",
    bairro || ""
  ]
    .map((valor) =>
      String(valor)
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
    )
    .join("|");

  return crypto
    .createHash("sha256")
    .update(conteudo)
    .digest("hex");
}

console.log(
  "Frontend path:",
  frontendPath
);

console.log(
  "Index existe:",
  fs.existsSync(
    path.join(
      frontendPath,
      "index.html"
    )
  )
);

app.use(
  "/css",
  express.static(
    path.join(
      frontendPath,
      "css"
    )
  )
);

app.use(
  "/js",
  express.static(
    path.join(
      frontendPath,
      "js"
    )
  )
);

app.use(
  "/img",
  express.static(
    path.join(
      frontendPath,
      "img"
    )
  )
);

app.use(
  "/assets",
  express.static(
    path.join(
      frontendPath,
      "assets"
    )
  )
);

app.use(
  "/data",
  express.static(
    path.join(
      frontendPath,
      "data"
    )
  )
);

app.use(
  "/api/webhook",
  webhookRoutes
);

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      sistema:
        "SDC Serviços de Dados e Comunicação",

      status:
        "API funcionando"
    });
  }
);

// ======================================
// TESTE CONTROLADO DA OPENAI
// ======================================

app.get(
  "/api/teste-ia",
  autenticar,
  autorizarPerfis("ADMIN"),
  async (req, res) => {
    try {
      const resposta =
        await testarOpenAI();

      return res.json({
        ok: true,
        mensagem:
          "Conexão com a OpenAI funcionando.",
        resposta
      });
    } catch (erro) {
      console.error(
        "Erro no teste da IA:",
        erro
      );

      return res.status(500).json({
        ok: false,
        mensagem:
          "Não foi possível conectar com a OpenAI.",
        erro:
          erro.message
      });
    }
  }
);

const limitadorLogin = rateLimit({
  windowMs:
    emProducao
      ? 15 * 60 * 1000
      : 60 * 1000,

  limit:
    emProducao
      ? 10
      : 30,

  standardHeaders:
    "draft-7",

  legacyHeaders:
    false,

  skipSuccessfulRequests:
    true,

  message: {
    ok: false,
    mensagem:
      "Muitas tentativas de login. Aguarde e tente novamente."
  }
});

app.post(
  "/api/auth/login",
  limitadorLogin,
  async (req, res) => {
    try {
      const {
        cpf,
        login,
        senha
      } = req.body;

      const cpfRecebido =
        cpf ||
        login;

      const cpfLimpo =
        limparCPF(
          cpfRecebido
        );

      if (
        !cpfValido(
          cpfLimpo
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "CPF inválido. Informe um CPF com 11 números."
          });
      }

      if (!senha) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe a senha."
          });
      }

      const resultado =
        await db.query(
          `
          SELECT
            id,
            nome,
            email,
            cpf,
            senha_hash,
            perfil,
            ativo
          FROM usuarios
          WHERE REGEXP_REPLACE(
            COALESCE(cpf, ''),
            '[^0-9]',
            '',
            'g'
          ) = $1
          LIMIT 1
          `,
          [
            cpfLimpo
          ]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res
          .status(401)
          .json({
            ok: false,
            mensagem:
              "CPF ou senha inválidos."
          });
      }

      const usuario =
        resultado.rows[0];

      if (
        usuario.ativo === false
      ) {
        return res
          .status(403)
          .json({
            ok: false,
            mensagem:
              "Usuário inativo."
          });
      }

      const senhaValida =
        await bcrypt.compare(
          senha,
          usuario.senha_hash
        );

      if (!senhaValida) {
        return res
          .status(401)
          .json({
            ok: false,
            mensagem:
              "CPF ou senha inválidos."
          });
      }

      const token =
        gerarToken(
          usuario
        );

      res.cookie(
        "token",
        token,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV ===
            "production",
          sameSite: "lax",
          path: "/",
          maxAge:
            8 *
            60 *
            60 *
            1000
        }
      );

      return res.json({
        ok: true,
        mensagem:
          "Login realizado com sucesso.",

        usuario: {
          id:
            usuario.id,

          nome:
            usuario.nome,

          cpf:
            usuario.cpf,

          perfil:
            usuario.perfil
        }
      });
    } catch (erro) {
      console.error(
        "Erro no login:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro interno ao realizar login."
        });
    }
  }
);

app.get(
  "/api/auth/me",
  autenticar,
  async (req, res) => {
    try {
      const resultado =
        await db.query(
          `
          SELECT
            id,
            nome,
            email,
            cpf,
            perfil,
            ativo
          FROM usuarios
          WHERE id = $1
          LIMIT 1
          `,
          [
            req.usuario.id
          ]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      return res.json({
        ok: true,
        usuario:
          resultado.rows[0]
      });
    } catch (erro) {
      console.error(
        "Erro ao verificar sessão:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao verificar sessão."
        });
    }
  }
);

app.post(
  "/api/auth/logout",
  (req, res) => {
    res.clearCookie(
      "token",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/"
      }
    );

    return res.json({
      ok: true,
      mensagem:
        "Logout realizado com sucesso."
    });
  }
);

/* ROTA PÚBLICA SEGURA - NOVA SOLICITAÇÃO */
app.post(
  "/api/publico/nova-demanda",
  async (req, res) => {
    try {
      const {
        nome,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        descricao
      } = req.body;

      if (
        !nome ||
        !telefone ||
        !bairro ||
        !endereco ||
        !servico ||
        !secretaria
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Preencha todos os campos obrigatórios: nome, telefone, bairro, endereço, serviço e secretaria."
          });
      }

      const telefoneLimpo =
        normalizarTelefoneBR(
          telefone
        );

      if (!telefoneLimpo) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe um telefone válido."
          });
      }

      let cidadaoId = null;

      const buscaCidadao =
        await db.query(
          `
          SELECT id
          FROM cidadaos
          WHERE telefone = $1
             OR whatsapp = $1
          LIMIT 1
          `,
          [
            telefoneLimpo
          ]
        );

      if (
        buscaCidadao.rows.length > 0
      ) {
        cidadaoId =
          buscaCidadao.rows[0].id;

        await db.query(
          `
  UPDATE cidadaos
  SET
    nome = $1,
    bairro = $2,
    endereco = $3,
    whatsapp = $4,
    atualizado_em = timezone('America/Sao_Paulo', NOW())
  WHERE id = $5
  `,
          [
            nome.trim(),
            bairro || "",
            endereco || "",
            telefoneLimpo,
            cidadaoId
          ]
        );

        console.log(
          "Cidadão atualizado:",
          cidadaoId
        );
      } else {
        const novoCidadao =
          await db.query(
            `
            INSERT INTO cidadaos (
              nome,
              telefone,
              whatsapp,
              bairro,
              endereco,
              criado_em,
              atualizado_em
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              timezone('America/Sao_Paulo', NOW()),
              timezone('America/Sao_Paulo', NOW())
            )
            RETURNING id
            `,
            [
              nome.trim(),
              telefoneLimpo,
              telefoneLimpo,
              bairro || "",
              endereco || ""
            ]
          );

        cidadaoId =
          novoCidadao.rows[0].id;

        console.log(
          "Novo cidadão criado:",
          cidadaoId
        );
      }

      const agora =
        new Date();

      const ano =
        agora.getFullYear();

      const mes =
        agora.getMonth() + 1;

      const ultimo =
        await db.query(
          `
          SELECT COUNT(*)::int AS total
          FROM solicitacoes_publicas
          WHERE ano = $1
          `,
          [
            ano
          ]
        );

      const numero =
        ultimo.rows[0].total + 1;

      const protocolo =
        `XAV-${ano}-${String(numero).padStart(6, "0")}`;

      await db.query(
        `
        INSERT INTO historico_cidadaos (
          cidadao_id,
          tipo,
          descricao,
          usuario
        )
        VALUES (
          $1,
          $2,
          $3,
          $4
        )
        `,
        [
          cidadaoId,
          "PROTOCOLO",
          `Novo protocolo criado: ${protocolo}. Serviço: ${servico}`,
          "SDC Serviços de Dados e Comunicação"
        ]
      );

      console.log(
        "Histórico criado para cidadão:",
        cidadaoId
      );

      const resultado =
        await db.query(
          `
          INSERT INTO solicitacoes_publicas (
            cidadao_id,
            protocolo,
            ano,
            mes,
            solicitante,
            telefone,
            bairro,
            endereco,
            servico,
            secretaria,
            descricao,
            status,
            origem,
            criado_em
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            'RECEBIDA',
            'SITE_PUBLICO',
            timezone('America/Sao_Paulo', NOW())
          )
          RETURNING *
          `,
          [
            cidadaoId,
            protocolo,
            ano,
            mes,
            nome.trim(),
            telefoneLimpo,
            bairro || "",
            endereco || "",
            servico,
            secretaria,
            descricao
              ? descricao.trim()
              : ""
          ]
        );

      const hashRegistro =
        gerarHashDemanda({
          protocolo,
          cidadaoId,
          servico,
          descricao:
            descricao
              ? descricao.trim()
              : "",
          secretaria,
          bairro
        });

      try {
        await db.query(
          `
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
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      'RECEBIDA',
      timezone('America/Sao_Paulo', NOW())::date,
      timezone('America/Sao_Paulo', NOW()),
      $7
    )
    ON CONFLICT DO NOTHING
    `,
          [
            cidadaoId,
            protocolo,
            servico,
            descricao
              ? descricao.trim()
              : "Sem descrição informada",
            secretaria,
            bairro || "",
            hashRegistro
          ]
        );

        console.log(
          "Demanda adicionada em demandas_gabinete:",
          protocolo
        );
      } catch (erroGabinete) {
        console.error(
          "Falha ao adicionar em demandas_gabinete:",
          erroGabinete.message
        );
      }
      const mensagemCidadao = `
Olá, ${nome.trim()}.

Sua solicitação foi registrada com sucesso no SDC Serviços de Dados e Comunicação.
📌 Protocolo: ${protocolo}

🏥 Serviço: ${servico}

🏢 Secretaria responsável: ${secretaria}

📍 Bairro: ${bairro || "-"}

Status atual: RECEBIDA

Guarde este protocolo para acompanhar sua solicitação.

SDC Serviços de Dados e Comunicação - Atendimento ao cidadão.
`;

      const mensagemGabinete = `
🚨 NOVA DEMANDA - SDC Serviços de Dados e Comunicação

Protocolo: ${protocolo}

Solicitante:
${nome.trim()}

Telefone:
${telefoneLimpo || "-"}

Bairro:
${bairro || "-"}

Endereço:
${endereco || "-"}

Serviço:
${servico}

Secretaria:
${secretaria}

Descrição:

${descricao
          ? descricao.trim()
          : "Não informado"}
`;

      let whatsappCidadao = false;
      let whatsappGabinete = false;

      // ===========================================
      // ENVIO DO PROTOCOLO AO CIDADÃO
      // ===========================================

      try {
        await enviarTemplateWhatsApp(
          telefoneLimpo,
          "confirmacao_protocolo_xavier_online",
          "pt_BR",
          [
            nome.trim(),
            protocolo,
            secretaria
          ]
        );

        whatsappCidadao = true;

        console.log(
          "WhatsApp cidadão enviado por template:",
          protocolo
        );

      } catch (erroTemplate) {
        console.error(
          "Falha no envio do template ao cidadão:",
          erroTemplate.response?.data ||
          erroTemplate.message
        );
      }

      // ===========================================
      // ENVIO DA CÓPIA AO GABINETE
      // ===========================================

      try {
        const telefoneGabinete =
          process.env.WHATSAPP_GABINETE;

        console.log(
          "Preparando envio ao gabinete:",
          telefoneGabinete
        );

        if (telefoneGabinete) {
          await enviarTextoWhatsApp(
            telefoneGabinete,
            mensagemGabinete
          );

          whatsappGabinete = true;

          console.log(
            "WhatsApp gabinete enviado:",
            protocolo
          );
        } else {
          console.warn(
            "WHATSAPP_GABINETE não configurado."
          );
        }

      } catch (erroGabinete) {
        console.error(
          "Falha WhatsApp gabinete:",
          erroGabinete.response?.data ||
          erroGabinete.message
        );
      }

      return res
        .status(201)
        .json({
          ok: true,

          mensagem:
            "Solicitação cadastrada com sucesso.",

          protocolo,

          demanda:
            resultado.rows[0],

          whatsapp: {
            cidadao:
              whatsappCidadao,

            gabinete:
              whatsappGabinete
          }
        });
    } catch (erro) {
      console.error(
        "Erro ao cadastrar solicitação pública:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,

          mensagem:
            "Erro ao cadastrar solicitação pública.",

          erro:
            erro.message
        });
    }
  }
);

app.post(
  "/api/teste-ia",
  autenticar,
  autorizarPerfis("ADMIN"),
  async (req, res) => {
  try {

    const { mensagem } = req.body;

    if (!mensagem) {
      return res.status(400).json({
        ok: false,
        mensagem: "Informe uma mensagem."
      });
    }

    const resposta = await testarOpenAI(mensagem);

    return res.json({
      ok: true,
      resposta
    });

  } catch (erro) {

    console.error(erro);

    return res.status(500).json({
      ok: false,
      erro: erro.message
    });

  }
  }
);



// ======================================================
// CONSULTA PÚBLICA DE PROTOCOLO
// Não exige login
// ======================================================

app.get(
  "/api/publico/protocolo/:protocolo",
  async (req, res) => {
    try {
      const protocolo =
        String(
          req.params.protocolo || ""
        )
          .trim()
          .toUpperCase();

      const resultado =
        await db.query(
          `
          SELECT
            protocolo,
            servico,
            secretaria,
            status,
            criado_em
          FROM solicitacoes_publicas
          WHERE UPPER(protocolo) = $1
          LIMIT 1
          `,
          [
            protocolo
          ]
        );

      if (
        resultado.rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Protocolo não encontrado."
          });
      }

      const solicitacao =
        resultado.rows[0];

      const statusAtual =
        String(
          solicitacao.status ||
          "RECEBIDA"
        ).toUpperCase();

      let andamentoPublico =
        "Sua solicitação foi recebida e está sendo analisada.";

      if (
        statusAtual.includes(
          "ANDAMENTO"
        ) ||
        statusAtual.includes(
          "ENCAMINH"
        )
      ) {
        andamentoPublico =
          "Sua solicitação foi encaminhada e está em andamento junto ao setor responsável.";
      }

      if (
        statusAtual.includes(
          "AGUARD"
        )
      ) {
        andamentoPublico =
          "Sua solicitação está aguardando retorno do setor responsável.";
      }

      if (
        statusAtual.includes(
          "CONCLU"
        )
      ) {
        andamentoPublico =
          "Sua solicitação foi concluída.";
      }

      if (
        statusAtual.includes(
          "CANCEL"
        )
      ) {
        andamentoPublico =
          "Sua solicitação foi encerrada. Entre em contato com o gabinete para mais informações.";
      }

      return res.json({
        ok: true,

        protocolo:
          solicitacao.protocolo,

        servico:
          solicitacao.servico ||
          "Não informado",

        secretaria:
          solicitacao.secretaria ||
          "Não informado",

        status:
          statusAtual,

        criado_em:
          solicitacao.criado_em,

        data_criacao:
          solicitacao.criado_em,

        ultima_atualizacao:
          solicitacao.criado_em,

        andamento_publico:
          andamentoPublico,

        tratativas: [
          {
            data:
              solicitacao.criado_em,

            titulo:
              "Solicitação registrada",

            descricao:
              "Sua solicitação foi registrada com sucesso e está sendo analisada."
          }
        ]
      });
    } catch (erro) {
      console.error(
        "Erro consulta pública:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao consultar protocolo."
        });
    }
  }
);

app.use(
  "/api/relatorios",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  relatoriosRoutes
);

app.use(
  "/api/relatorios",
  autenticar,
  dashboardRoutes
);

app.use(
  "/api/liderancas",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  liderancasRoutes
);

app.use(
  "/api/interacoes",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE"
  ),
  interacoesRoutes
);

app.use(
  "/api/cidadaos",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE"
  ),
  cidadaosRoutes
);

app.use(
  "/api/demandas-gabinete",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  demandasExportacoesRoutes
);

app.use(
  "/api/demandas-gabinete",
  autenticar,
  demandasGabineteRoutes
);

// SDC_WHATSAPP_WEB_MOUNT_V1
app.use("/api/disparos/sdc-web", autenticar, require("./routes/sdc-disparos-web.routes"));

app.use(
  "/api/disparos",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  disparosContatosRoutes
);

app.use(
  "/api/disparos",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  disparosRoutes
);

app.use(
  "/api/usuarios",
  autenticar,
  autorizarPerfis(
    "ADMIN"
  ),
  usuariosRoutes
);

app.use(
  "/api/eleitores",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  eleitoresRoutes
);

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);

app.get(
  "/index.html",
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );
  }
);

app.get(
  "/usuarios.html",
  protegerPaginaPorPerfil([
    "ADMIN"
  ]),
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "usuarios.html"
      )
    );
  }
);

app.get(
  "/disparos.html",
  protegerPaginaPorPerfil([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "disparos.html"
      )
    );
  }
);

app.get(
  "/configuracoes.html",
  protegerPaginaPorPerfil([
    "ADMIN"
  ]),
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "configuracoes.html"
      )
    );
  }
);

app.get(
  "/importar.html",
  protegerPaginaPorPerfil([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "importar.html"
      )
    );
  }
);

app.get(
  "/eleitores.html",
  protegerPaginaPorPerfil([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    res.sendFile(
      path.join(
        frontendPath,
        "eleitores.html"
      )
    );
  }
);

const PERFIS_POR_PAGINA =
  Object.freeze(
    {
  "admin.html": [
    "ADMIN"
  ],
  "cadastro.html": [
    "ADMIN"
  ],
  "dashboard.html": [
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE",
    "CONSULTA",
    "LIDERANCA"
  ],
  "demandas-gabinete.html": [
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE",
    "CONSULTA",
    "LIDERANCA"
  ],
  "protocolo.html": [
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE",
    "CONSULTA",
    "LIDERANCA"
  ],
  "mapa.html": [
    "ADMIN",
    "ASSESSOR",
    "CONSULTA",
    "LIDERANCA"
  ],
  "eleitores.html": [
    "ADMIN",
    "ASSESSOR"
  ],
  "interacoes.html": [
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE"
  ],
  "cidadao.html": [
    "ADMIN",
    "ASSESSOR",
    "ATENDENTE"
  ],
  "importar.html": [
    "ADMIN",
    "ASSESSOR"
  ],
  "secretarias.html": [
    "ADMIN",
    "ASSESSOR"
  ],
  "liderancas.html": [
    "ADMIN",
    "ASSESSOR"
  ],
  "disparos.html": [
    "ADMIN",
    "ASSESSOR"
  ],
  "usuarios.html": [
    "ADMIN"
  ],
  "configuracoes.html": [
    "ADMIN"
  ],
  "relatorio-legislativo.html": [
    "ADMIN",
    "ASSESSOR",
    "CONSULTA"
  ],
  "relatorios.html": [
    "ADMIN",
    "ASSESSOR"
  ]
}
  );

function autorizarPaginaMapeada(
  req,
  res,
  next
) {
  const pagina =
    String(
      req.params.pagina || ""
    );

  const perfisPermitidos =
    PERFIS_POR_PAGINA[
      pagina
    ];

  if (!perfisPermitidos) {
    return next();
  }

  const perfilAtual =
    normalizarPerfil(
      req.usuario?.perfil
    );

  if (
    !perfisPermitidos.includes(
      perfilAtual
    )
  ) {
    return res
      .status(403)
      .send(
        "Acesso negado."
      );
  }

  return next();
}

app.get(
  "/:pagina",
  autenticarPagina,
  autorizarPaginaMapeada,
  (req, res, next) => {
    const pagina =
      req.params.pagina;

    const arquivo =
      path.join(
        frontendPath,
        pagina
      );

    if (
      fs.existsSync(
        arquivo
      ) &&
      pagina.endsWith(
        ".html"
      )
    ) {
      return res.sendFile(
        arquivo
      );
    }

    next();
  }
);
app.use((req, res) => {
  res.status(404).send("Não encontrado");
});

(async () => {
  try {
    const resultado = await db.query(`
      SELECT COUNT(*) AS total
      FROM demandas_gabinete
    `);

    console.log("==================================");
    console.log("BANCO EM USO PELO NODE");
    console.log("Demandas:", resultado.rows[0].total);
    console.log("==================================");

  } catch (erro) {
    console.error(
      "Erro ao consultar banco:",
      erro
    );
  }
})();

app.listen(PORT, () => {
  console.log(
    `Servidor SDC Serviços de Dados e Comunicação rodando na porta ${PORT}`
  );
});
