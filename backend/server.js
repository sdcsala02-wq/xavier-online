"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const db = require("./db");

const eleitoresRoutes = require("./routes/eleitores.routes");
const liderancasRoutes = require("./routes/liderancas.routes");
const usuariosRoutes = require("./routes/usuarios.routes");

const initDatabase = require("../database/initDatabase");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const NODE_ENV =
  process.env.NODE_ENV || "development";

const IS_PRODUCTION =
  NODE_ENV === "production";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "sistema_lucas_chave_temporaria";

const COOKIE_NAME = "token";

const FRONTEND_PATH =
  path.join(__dirname, "public");

// ======================================================
// CONFIGURAÇÕES GERAIS
// ======================================================

app.disable("x-powered-by");

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

app.use(cookieParser());

// ======================================================
// LOG DAS REQUISIÇÕES
// ======================================================

app.use((req, res, next) => {
  const inicio = Date.now();

  res.on("finish", () => {
    const duracao =
      Date.now() - inicio;

    console.log(
      `${req.method} ${req.originalUrl} | ` +
      `${res.statusCode} | ${duracao}ms`
    );
  });

  next();
});

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function limparCPF(valor) {
  return String(valor || "")
    .replace(/\D/g, "");
}

function cpfValido(valor) {
  const cpf = limparCPF(valor);

  if (cpf.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let soma = 0;

  for (let indice = 0; indice < 9; indice += 1) {
    soma += Number(cpf[indice]) * (10 - indice);
  }

  let primeiroDigito = (soma * 10) % 11;

  if (primeiroDigito === 10) {
    primeiroDigito = 0;
  }

  if (primeiroDigito !== Number(cpf[9])) {
    return false;
  }

  soma = 0;

  for (let indice = 0; indice < 10; indice += 1) {
    soma += Number(cpf[indice]) * (11 - indice);
  }

  let segundoDigito = (soma * 10) % 11;

  if (segundoDigito === 10) {
    segundoDigito = 0;
  }

  return segundoDigito === Number(cpf[10]);
}

function normalizarIdentificadorLogin(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase();
}

function pareceCpf(valor) {
  const texto = String(valor || "").trim();
  const numeros = limparCPF(texto);

  return (
    numeros.length === 11 &&
    /^[\d.\-\s]+$/.test(texto)
  );
}

function obterIpRequisicao(req) {
  const encaminhado =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim();

  return (
    encaminhado ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

function normalizarPerfil(perfil) {
  return String(perfil || "")
    .trim()
    .toUpperCase();
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,

      candidato_id:
        usuario.candidato_id,

      nome:
        usuario.nome,

      cpf:
        limparCPF(usuario.cpf),

      perfil:
        normalizarPerfil(
          usuario.perfil || "ASSESSOR"
        )
    },

    JWT_SECRET,

    {
      expiresIn: "8h"
    }
  );
}

function obterToken(req) {
  const tokenCookie =
    req.cookies?.[COOKIE_NAME];

  if (tokenCookie) {
    return tokenCookie;
  }

  const authorization =
    String(
      req.headers.authorization || ""
    );

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return null;
}

function candidatoIdDaSessao(req) {
  const candidatoId =
    Number(
      req.usuario?.candidato_id
    );

  if (
    Number.isInteger(candidatoId) &&
    candidatoId > 0
  ) {
    return candidatoId;
  }

  return null;
}

// ======================================================
// AUTENTICAÇÃO
// ======================================================

function autenticar(req, res, next) {
  const token =
    obterToken(req);

  if (!token) {
    return res
      .status(401)
      .json({
        ok: false,
        mensagem:
          "Acesso não autorizado. Faça login novamente."
      });
  }

  try {
    req.usuario =
      jwt.verify(
        token,
        JWT_SECRET
      );

    return next();

  } catch (erro) {
    return res
      .status(401)
      .json({
        ok: false,
        mensagem:
          "Sessão inválida ou expirada. Faça login novamente."
      });
  }
}

function autorizarPerfis(
  ...perfisPermitidos
) {
  const permitidos =
    perfisPermitidos.map(
      normalizarPerfil
    );

  return (req, res, next) => {
    const perfilAtual =
      normalizarPerfil(
        req.usuario?.perfil
      );

    if (
      !permitidos.includes(
        perfilAtual
      )
    ) {
      return res
        .status(403)
        .json({
          ok: false,
          mensagem:
            "Você não possui permissão para acessar este recurso."
        });
    }

    return next();
  };
}

// ======================================================
// PROTEÇÃO DAS PÁGINAS HTML
// ======================================================

function protegerPagina(
  perfisPermitidos = null
) {
  return (req, res, next) => {
    const token =
      obterToken(req);

    if (!token) {
      return res.redirect(
        "/index.html"
      );
    }

    try {
      const usuario =
        jwt.verify(
          token,
          JWT_SECRET
        );

      if (
        Array.isArray(
          perfisPermitidos
        ) &&
        perfisPermitidos.length > 0
      ) {
        const perfilAtual =
          normalizarPerfil(
            usuario.perfil
          );

        const permitidos =
          perfisPermitidos.map(
            normalizarPerfil
          );

        if (
          !permitidos.includes(
            perfilAtual
          )
        ) {
          return res
            .status(403)
            .send(`
              <!DOCTYPE html>
              <html lang="pt-BR">
              <head>
                <meta charset="UTF-8">
                <meta
                  name="viewport"
                  content="width=device-width, initial-scale=1.0"
                >
                <title>Acesso negado</title>

                <style>
                  body {
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: Arial, sans-serif;
                    background: #f4f6fa;
                    color: #202636;
                  }

                  .acesso-negado {
                    width: min(90%, 500px);
                    padding: 40px;
                    text-align: center;
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow:
                      0 10px 30px
                      rgba(0, 0, 0, 0.08);
                  }

                  .acesso-negado h1 {
                    margin-top: 0;
                    color: #b42318;
                  }

                  .acesso-negado a {
                    display: inline-block;
                    margin-top: 20px;
                    padding: 12px 22px;
                    color: #ffffff;
                    text-decoration: none;
                    background: #5426a6;
                    border-radius: 8px;
                  }
                </style>
              </head>

              <body>
                <div class="acesso-negado">
                  <h1>Acesso negado</h1>

                  <p>
                    Seu perfil não possui permissão para acessar esta página.
                  </p>

                  <a href="/dashboard.html">
                    Voltar ao sistema
                  </a>
                </div>
              </body>
              </html>
            `);
        }
      }

      req.usuario =
        usuario;

      return next();

    } catch (erro) {
      res.clearCookie(
        COOKIE_NAME,
        {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: IS_PRODUCTION
        }
      );

      return res.redirect(
        "/index.html"
      );
    }
  };
}

// ======================================================
// ARQUIVOS ESTÁTICOS
// ======================================================

app.use(
  "/css",
  express.static(
    path.join(
      FRONTEND_PATH,
      "css"
    )
  )
);

app.use(
  "/js",
  express.static(
    path.join(
      FRONTEND_PATH,
      "js"
    )
  )
);

app.use(
  "/img",
  express.static(
    path.join(
      FRONTEND_PATH,
      "img"
    )
  )
);

app.use(
  "/assets",
  express.static(
    path.join(
      FRONTEND_PATH,
      "assets"
    )
  )
);

app.use(
  "/data",
  express.static(
    path.join(
      FRONTEND_PATH,
      "data"
    )
  )
);

// ======================================================
// STATUS DO SISTEMA
// ======================================================

app.get(
  "/api/status",
  async (req, res) => {
    try {
      await db.query(
        "SELECT 1"
      );

      return res.json({
        ok: true,
        sistema:
          "Sistema Lucas",
        status:
          "API e banco de dados funcionando"
      });

    } catch (erro) {
      console.error(
        "Erro no status:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          sistema:
            "Sistema Lucas",
          status:
            "Banco de dados indisponível"
        });
    }
  }
);

// ======================================================
// LOGIN
// ======================================================

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const identificadorRecebido =
        req.body?.identificador ??
        req.body?.login ??
        req.body?.cpf ??
        req.body?.email ??
        "";

      const senha =
        String(req.body?.senha || "");

      const identificador =
        normalizarIdentificadorLogin(
          identificadorRecebido
        );

      if (!identificador) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe seu CPF, login ou e-mail."
          });
      }

      if (!senha) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe sua senha."
          });
      }

      const identificadorEhCpf =
        pareceCpf(
          identificadorRecebido
        );

      const cpfInformado =
        identificadorEhCpf
          ? limparCPF(
            identificadorRecebido
          )
          : null;

      if (
        identificadorEhCpf &&
        !cpfValido(cpfInformado)
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe um CPF válido."
          });
      }

      const resultado =
        await db.query(
          `
            SELECT
              id,
              candidato_id,
              nome,
              login,
              cpf,
              email,
              senha,
              perfil,
              ativo,
              ultimo_acesso_em,
              ultimo_ip,
              tentativas_login_falhas,
              bloqueado_ate,
              precisa_alterar_senha

            FROM usuarios_lucas

            WHERE
              (
                $1::text IS NOT NULL
                AND cpf = $1
              )

              OR LOWER(
                COALESCE(
                  login,
                  ''
                )
              ) = $2

              OR LOWER(
                COALESCE(
                  email,
                  ''
                )
              ) = $2

            LIMIT 1
          `,
          [
            cpfInformado,
            identificador
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
              "Usuário ou senha inválidos."
          });
      }

      const usuario =
        resultado.rows[0];

      if (!usuario.ativo) {
        return res
          .status(403)
          .json({
            ok: false,
            mensagem:
              "Este usuário está inativo. Entre em contato com o administrador."
          });
      }

      const bloqueadoAte =
        usuario.bloqueado_ate
          ? new Date(
            usuario.bloqueado_ate
          )
          : null;

      if (
        bloqueadoAte &&
        bloqueadoAte.getTime() >
        Date.now()
      ) {
        const minutosRestantes =
          Math.max(
            1,
            Math.ceil(
              (
                bloqueadoAte.getTime() -
                Date.now()
              ) /
              60000
            )
          );

        return res
          .status(429)
          .json({
            ok: false,
            mensagem:
              `Acesso temporariamente bloqueado. Tente novamente em aproximadamente ${minutosRestantes} minuto(s).`
          });
      }

      const senhaValida =
        await bcrypt.compare(
          senha,
          usuario.senha
        );

      if (!senhaValida) {
        const tentativasAtuais =
          Number(
            usuario
              .tentativas_login_falhas
          ) || 0;

        const novasTentativas =
          tentativasAtuais + 1;

        const deveBloquear =
          novasTentativas >= 5;

        await db.query(
          `
            UPDATE usuarios_lucas

            SET
              tentativas_login_falhas =
                CASE
                  WHEN $2 = true
                    THEN 0
                  ELSE $1
                END,

              bloqueado_ate =
                CASE
                  WHEN $2 = true
                    THEN NOW()
                      + INTERVAL '15 minutes'
                  ELSE NULL
                END,

              atualizado_em = NOW()

            WHERE id = $3
          `,
          [
            novasTentativas,
            deveBloquear,
            usuario.id
          ]
        );

        if (deveBloquear) {
          return res
            .status(429)
            .json({
              ok: false,
              mensagem:
                "Acesso bloqueado por 15 minutos após várias tentativas incorretas."
            });
        }

        const tentativasRestantes =
          5 - novasTentativas;

        return res
          .status(401)
          .json({
            ok: false,
            mensagem:
              `Usuário ou senha inválidos. Restam ${tentativasRestantes} tentativa(s).`
          });
      }

      const ipAtual =
        obterIpRequisicao(req);

      await db.query(
        `
          UPDATE usuarios_lucas

          SET
            ultimo_acesso_em = NOW(),
            ultimo_ip = $1,
            tentativas_login_falhas = 0,
            bloqueado_ate = NULL,
            atualizado_em = NOW()

          WHERE id = $2
        `,
        [
          ipAtual,
          usuario.id
        ]
      );

      try {
        await db.query(
          `
            INSERT INTO acessos_usuarios (
              usuario_id,
              ip,
              sucesso,
              criado_em
            )
            VALUES (
              $1,
              $2,
              true,
              NOW()
            )
          `,
          [
            usuario.id,
            ipAtual
          ]
        );

      } catch (erroHistorico) {
        console.warn(
          "Não foi possível registrar o histórico de acesso:",
          erroHistorico.message
        );
      }

      const token =
        gerarToken(usuario);

      res.cookie(
        COOKIE_NAME,
        token,
        {
          httpOnly: true,
          secure:
            IS_PRODUCTION,
          sameSite: "lax",
          maxAge:
            8 * 60 * 60 * 1000,
          path: "/"
        }
      );

      return res.json({
        ok: true,

        precisa_alterar_senha:
          Boolean(
            usuario
              .precisa_alterar_senha
          ),

        usuario: {
          id:
            usuario.id,

          candidato_id:
            usuario.candidato_id,

          nome:
            usuario.nome,

          login:
            usuario.login,

          cpf:
            usuario.cpf,

          email:
            usuario.email,

          perfil:
            normalizarPerfil(
              usuario.perfil
            ),

          precisa_alterar_senha:
            Boolean(
              usuario
                .precisa_alterar_senha
            )
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

// ======================================================
// SESSÃO ATUAL
// ======================================================

// ======================================================
// SESSÃO ATUAL
// ======================================================

app.get(
  "/api/auth/me",
  autenticar,
  async (req, res) => {
    try {
      const resultado = await db.query(
        `
          SELECT
            id,
            candidato_id,
            nome,
            login,
            cpf,
            email,
            perfil,
            ativo,
            precisa_alterar_senha,
            ultimo_acesso_em,
            ultimo_ip
          FROM usuarios_lucas
          WHERE id = $1
          LIMIT 1
        `,
        [req.usuario.id]
      );

      if (resultado.rows.length === 0) {
        res.clearCookie(
          COOKIE_NAME,
          {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: IS_PRODUCTION
          }
        );

        return res.status(404).json({
          ok: false,
          mensagem: "Usuário não encontrado."
        });
      }

      const usuario = resultado.rows[0];

      if (!usuario.ativo) {
        res.clearCookie(
          COOKIE_NAME,
          {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: IS_PRODUCTION
          }
        );

        return res.status(403).json({
          ok: false,
          mensagem: "Usuário inativo."
        });
      }

      usuario.perfil = normalizarPerfil(
        usuario.perfil
      );

      usuario.precisa_alterar_senha = Boolean(
        usuario.precisa_alterar_senha
      );

      return res.json({
        ok: true,
        usuario
      });

    } catch (erro) {
      console.error(
        "Erro ao validar sessão:",
        erro
      );

      return res.status(500).json({
        ok: false,
        mensagem: "Erro ao validar sessão."
      });
    }
  }
);


// ======================================================
// ALTERAR SENHA
// ======================================================

app.post(
  "/api/auth/alterar-senha",
  autenticar,
  async (req, res) => {
    try {
      const senhaAtual = String(
        req.body?.senhaAtual || ""
      );

      const novaSenha = String(
        req.body?.novaSenha || ""
      );

      const confirmarSenha = String(
        req.body?.confirmarSenha || ""
      );

      if (
        !senhaAtual ||
        !novaSenha ||
        !confirmarSenha
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Preencha a senha atual, a nova senha e a confirmação."
        });
      }

      if (novaSenha !== confirmarSenha) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha e a confirmação não são iguais."
        });
      }

      if (novaSenha.length < 8) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha deve possuir pelo menos 8 caracteres."
        });
      }

      if (!/[A-Z]/.test(novaSenha)) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha deve possuir pelo menos uma letra maiúscula."
        });
      }

      if (!/[a-z]/.test(novaSenha)) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha deve possuir pelo menos uma letra minúscula."
        });
      }

      if (!/\d/.test(novaSenha)) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha deve possuir pelo menos um número."
        });
      }

      if (!/[^A-Za-z0-9]/.test(novaSenha)) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha deve possuir pelo menos um caractere especial."
        });
      }

      if (senhaAtual === novaSenha) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A nova senha deve ser diferente da senha atual."
        });
      }

      const resultadoUsuario = await db.query(
        `
          SELECT
            id,
            senha,
            ativo
          FROM usuarios_lucas
          WHERE id = $1
          LIMIT 1
        `,
        [req.usuario.id]
      );

      if (resultadoUsuario.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          mensagem: "Usuário não encontrado."
        });
      }

      const usuario = resultadoUsuario.rows[0];

      if (!usuario.ativo) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "Usuário inativo. Entre em contato com o administrador."
        });
      }

      const senhaAtualValida =
        await bcrypt.compare(
          senhaAtual,
          usuario.senha
        );

      if (!senhaAtualValida) {
        return res.status(401).json({
          ok: false,
          mensagem:
            "A senha atual informada está incorreta."
        });
      }

      const novaSenhaCriptografada =
        await bcrypt.hash(
          novaSenha,
          12
        );

      await db.query(
        `
    UPDATE usuarios_lucas
    SET
      senha = $1,
      precisa_alterar_senha = false,
      senha_alterada_em = NOW(),
      tentativas_login_falhas = 0,
      bloqueado_ate = NULL,
      atualizado_em = NOW()
    WHERE id = $2
  `,
        [
          novaSenhaCriptografada,
          req.usuario.id
        ]
      );

      try {
        const ipAtual =
          obterIpRequisicao(req);

        await db.query(
          `
      INSERT INTO auditoria_usuarios (
        usuario_alvo_id,
        realizado_por_usuario_id,
        acao,
        detalhes,
        ip,
        criado_em
      )
      VALUES (
        $1,
        $1,
        'ALTERACAO_PROPRIA_SENHA',
        $2::jsonb,
        $3,
        NOW()
      )
    `,
          [
            req.usuario.id,

            JSON.stringify({
              origem: "alteracao_obrigatoria",
              resultado: "sucesso"
            }),

            ipAtual
          ]
        );

      } catch (erroAuditoria) {
        console.warn(
          "Não foi possível registrar a alteração de senha na auditoria:",
          erroAuditoria.message
        );
      }
      
      return res.json({
      ok: true,
      mensagem:
        "Senha alterada com sucesso."
    });

  } catch (erro) {
    console.error(
      "Erro ao alterar senha:",
      erro
    );

    return res.status(500).json({
      ok: false,
      mensagem:
        "Erro interno ao alterar a senha."
    });
  }
  }
);


// ======================================================
// LOGOUT
// ======================================================

app.post(
  "/api/auth/logout",
  (req, res) => {
    res.clearCookie(
      COOKIE_NAME,
      {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: IS_PRODUCTION
      }
    );

    return res.json({
      ok: true,
      mensagem:
        "Sessão encerrada com sucesso."
    });
  }
);

// ======================================================
// DASHBOARD — SISTEMA LUCAS
// ======================================================

app.get(
  "/api/dashboard/resumo",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  async (req, res) => {
    try {
      const candidatoId =
        candidatoIdDaSessao(req);

      if (!candidatoId) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "O usuário logado não possui candidato vinculado."
          });
      }

      const resumoResultado =
        await db.query(
          `
            SELECT
              COUNT(*)::INTEGER
                AS total_eleitores,

              COUNT(*) FILTER (
                WHERE criado_em >=
                  DATE_TRUNC(
                    'month',
                    CURRENT_DATE
                  )

                AND criado_em <
                  DATE_TRUNC(
                    'month',
                    CURRENT_DATE
                  ) + INTERVAL '1 month'
              )::INTEGER
                AS novos_cadastros,


                COUNT(
  DISTINCT NULLIF(
    TRIM(
      COALESCE(
        cidade,
        ''
      )
    ),
    ''
  )
)::INTEGER
  AS total_cidades,

              COUNT(
                DISTINCT NULLIF(
                  TRIM(
                    COALESCE(
                      bairro,
                      ''
                    )
                  ),
                  ''
                )
              )::INTEGER
                AS bairros_atendidos

            FROM eleitores

            WHERE candidato_id = $1
          `,
          [candidatoId]
        );

      let totalLiderancas = 0;

      try {
        const liderancasResultado =
          await db.query(
            `
              SELECT
                COUNT(*)::INTEGER
                  AS total_liderancas

              FROM liderancas

              WHERE COALESCE(
                ativo,
                true
              ) = true
            `
          );

        totalLiderancas =
          Number(
            liderancasResultado
              .rows[0]
              ?.total_liderancas
          ) || 0;

      } catch (erroLiderancas) {
        console.warn(
          "Não foi possível contar as lideranças:",
          erroLiderancas.message
        );

        totalLiderancas = 0;
      }

      const ultimosResultado =
        await db.query(
          `
            SELECT
              id,
              nome,
              telefone,
              bairro,
              cidade,
              criado_em

            FROM eleitores

            WHERE candidato_id = $1

            ORDER BY
              criado_em DESC NULLS LAST,
              id DESC

            LIMIT 10
          `,
          [candidatoId]
        );

      const resumo =
        resumoResultado.rows[0] || {};

      return res.json({
        ok: true,

        resumo: {
          total_eleitores:
            Number(
              resumo.total_eleitores
            ) || 0,

          total_cidades:
            Number(
              resumo.total_cidades
            ) || 0,

          novos_cadastros:
            Number(
              resumo.novos_cadastros
            ) || 0,

          total_liderancas:
            totalLiderancas,

          bairros_atendidos:
            Number(
              resumo.bairros_atendidos
            ) || 0
        },

        ultimos_eleitores:
          ultimosResultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao carregar dashboard:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar os dados do dashboard.",

          detalhe:
            NODE_ENV ===
              "development"
              ? erro.message
              : undefined
        });
    }
  }
);

// ======================================================
// ROTAS PRINCIPAIS DO SISTEMA
// ======================================================

app.use(
  "/api/eleitores",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  eleitoresRoutes
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
  "/api/usuarios",
  autenticar,
  autorizarPerfis(
    "ADMIN"
  ),
  usuariosRoutes
);

// ======================================================
// PAINEL DO ADMINISTRADOR
// ======================================================

app.get(
  "/api/admin/resumo",
  autenticar,
  autorizarPerfis("ADMIN"),
  async (req, res) => {
    try {
      const resumoUsuarios = await db.query(`
        SELECT
          COUNT(*)::INTEGER AS total_usuarios,

          COUNT(*) FILTER (
            WHERE COALESCE(ativo, false) = true
          )::INTEGER AS usuarios_ativos,

          COUNT(*) FILTER (
            WHERE COALESCE(ativo, false) = false
          )::INTEGER AS usuarios_inativos,

          COUNT(*) FILTER (
            WHERE bloqueado_ate IS NOT NULL
              AND bloqueado_ate > NOW()
          )::INTEGER AS usuarios_bloqueados,

          COUNT(*) FILTER (
            WHERE precisa_alterar_senha = true
          )::INTEGER AS aguardando_troca_senha,

          COUNT(*) FILTER (
            WHERE ultimo_acesso_em >=
              NOW() - INTERVAL '24 hours'
          )::INTEGER AS acessos_ultimas_24h

        FROM usuarios_lucas
      `);

      const usuariosPorPerfil = await db.query(`
        SELECT
          UPPER(
            COALESCE(
              NULLIF(TRIM(perfil), ''),
              'SEM PERFIL'
            )
          ) AS perfil,

          COUNT(*)::INTEGER AS total

        FROM usuarios_lucas

        GROUP BY
          UPPER(
            COALESCE(
              NULLIF(TRIM(perfil), ''),
              'SEM PERFIL'
            )
          )

        ORDER BY
          total DESC,
          perfil ASC
      `);

      const ultimosUsuarios = await db.query(`
        SELECT
          id,
          nome,
          login,
          cpf,
          email,
          perfil,
          ativo,
          ultimo_acesso_em,
          ultimo_ip,
          bloqueado_ate,
          precisa_alterar_senha

        FROM usuarios_lucas

        ORDER BY
          criado_em DESC NULLS LAST,
          id DESC

        LIMIT 8
      `);

      const ultimosAcessos = await db.query(`
        SELECT
          a.id,
          a.usuario_id,
          u.nome AS usuario_nome,
          u.login AS usuario_login,
          a.ip,
          a.sucesso,
          a.criado_em

        FROM acessos_usuarios a

        LEFT JOIN usuarios_lucas u
          ON u.id = a.usuario_id

        ORDER BY
          a.criado_em DESC NULLS LAST,
          a.id DESC

        LIMIT 10
      `);

      const ultimasAuditorias = await db.query(`
        SELECT
          au.id,
          au.usuario_alvo_id,
          alvo.nome AS usuario_alvo_nome,
          au.realizado_por_usuario_id,
          responsavel.nome AS realizado_por_nome,
          au.acao,
          au.detalhes,
          au.ip,
          au.criado_em

        FROM auditoria_usuarios au

        LEFT JOIN usuarios_lucas alvo
          ON alvo.id = au.usuario_alvo_id

        LEFT JOIN usuarios_lucas responsavel
          ON responsavel.id =
            au.realizado_por_usuario_id

        ORDER BY
          au.criado_em DESC NULLS LAST,
          au.id DESC

        LIMIT 10
      `);

      const resumo =
        resumoUsuarios.rows[0] || {};

      return res.json({
        ok: true,

        resumo: {
          total_usuarios:
            Number(resumo.total_usuarios) || 0,

          usuarios_ativos:
            Number(resumo.usuarios_ativos) || 0,

          usuarios_inativos:
            Number(resumo.usuarios_inativos) || 0,

          usuarios_bloqueados:
            Number(resumo.usuarios_bloqueados) || 0,

          aguardando_troca_senha:
            Number(resumo.aguardando_troca_senha) || 0,

          acessos_ultimas_24h:
            Number(resumo.acessos_ultimas_24h) || 0
        },

        usuarios_por_perfil:
          usuariosPorPerfil.rows,

        ultimos_usuarios:
          ultimosUsuarios.rows,

        ultimos_acessos:
          ultimosAcessos.rows,

        ultimas_auditorias:
          ultimasAuditorias.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao carregar o painel administrativo:",
        erro
      );

      return res.status(500).json({
        ok: false,
        mensagem:
          "Erro ao carregar o painel administrativo.",

        detalhe:
          NODE_ENV === "development"
            ? erro.message
            : undefined
      });
    }
  }
);

// ======================================================
// INFORMAÇÕES DO USUÁRIO LOGADO
// ======================================================

app.get(
  "/api/usuario",
  autenticar,
  async (req, res) => {
    try {
      const resultado =
        await db.query(
          `
            SELECT
              u.id,
              u.candidato_id,
              u.nome,
              u.cpf,
              u.email,
              u.perfil,
              u.ativo,
              c.nome AS candidato_nome,
              c.cargo AS candidato_cargo,
              c.partido AS candidato_partido,
              c.cidade AS candidato_cidade,
              c.estado AS candidato_estado

            FROM usuarios_lucas u

            LEFT JOIN candidatos c
              ON c.id = u.candidato_id

            WHERE u.id = $1

            LIMIT 1
          `,
          [req.usuario.id]
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

      const usuario =
        resultado.rows[0];

      usuario.perfil =
        normalizarPerfil(
          usuario.perfil
        );

      return res.json({
        ok: true,
        usuario
      });

    } catch (erro) {
      console.error(
        "Erro ao buscar usuário:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao buscar os dados do usuário."
        });
    }
  }
);

// ======================================================
// RESUMO DO MAPA ELEITORAL
// ======================================================

app.get(
  "/api/mapa/resumo",
  autenticar,
  autorizarPerfis(
    "ADMIN",
    "ASSESSOR"
  ),
  async (req, res) => {
    try {
      const candidatoId =
        candidatoIdDaSessao(req);

      if (!candidatoId) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "O usuário não possui candidato vinculado."
          });
      }

      const resultado =
        await db.query(
          `
            SELECT
              COALESCE(
                NULLIF(
                  TRIM(bairro),
                  ''
                ),
                'Não informado'
              ) AS bairro,

              COUNT(*)::INTEGER
                AS total

            FROM eleitores

            WHERE candidato_id = $1

            GROUP BY
              COALESCE(
                NULLIF(
                  TRIM(bairro),
                  ''
                ),
                'Não informado'
              )

            ORDER BY
              total DESC,
              bairro ASC
          `,
          [candidatoId]
        );

      return res.json({
        ok: true,
        bairros:
          resultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao carregar resumo do mapa:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar os dados do mapa."
        });
    }
  }
);

// ======================================================
// PÁGINA DE ALTERAÇÃO DE SENHA
// ======================================================

app.get(
  "/alterar-senha.html",
  protegerPagina(),
  (req, res) => {
    const caminhoArquivo =
      path.join(
        FRONTEND_PATH,
        "alterar-senha.html"
      );

    if (
      !fs.existsSync(
        caminhoArquivo
      )
    ) {
      return res
        .status(404)
        .send(
          "Página de alteração de senha não encontrada."
        );
    }

    return res.sendFile(
      caminhoArquivo
    );
  }
);

// ======================================================
// PÁGINA PÚBLICA DE LOGIN
// ======================================================

app.get(
  "/",
  (req, res) => {
    return res.sendFile(
      path.join(
        FRONTEND_PATH,
        "index.html"
      )
    );
  }
);

app.get(
  "/index.html",
  (req, res) => {
    return res.sendFile(
      path.join(
        FRONTEND_PATH,
        "index.html"
      )
    );
  }
);

// ======================================================
// PÁGINAS LIBERADAS PARA ADMIN E ASSESSOR
// ======================================================

const paginasAdminEAssessor = [
  "dashboard.html",
  "eleitores.html",
  "cadastro.html",
  "importar.html",
  "mapa.html",
  "liderancas.html",
  "relatorios.html",
  "relatorio-geral.html",
  "configuracoes.html"
];

paginasAdminEAssessor.forEach(
  pagina => {
    app.get(
      `/${pagina}`,
      protegerPagina([
        "ADMIN",
        "ASSESSOR"
      ]),
      (req, res) => {
        const caminhoArquivo =
          path.join(
            FRONTEND_PATH,
            pagina
          );

        if (
          !fs.existsSync(
            caminhoArquivo
          )
        ) {
          return res
            .status(404)
            .send(
              "Página não encontrada."
            );
        }

        return res.sendFile(
          caminhoArquivo
        );
      }
    );
  }
);

// ======================================================
// PÁGINAS EXCLUSIVAS DO ADMINISTRADOR
// ======================================================

const paginasSomenteAdmin = [
  "usuarios.html",
  "admin.html"
];

paginasSomenteAdmin.forEach(
  pagina => {
    app.get(
      `/${pagina}`,
      protegerPagina([
        "ADMIN"
      ]),
      (req, res) => {
        const caminhoArquivo =
          path.join(
            FRONTEND_PATH,
            pagina
          );

        if (
          !fs.existsSync(
            caminhoArquivo
          )
        ) {
          return res
            .status(404)
            .send(
              "Página não encontrada."
            );
        }

        return res.sendFile(
          caminhoArquivo
        );
      }
    );
  }
);

// ======================================================
// ATALHOS SEM .HTML
// ======================================================

app.get(
  "/dashboard",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/dashboard.html"
    );
  }
);

app.get(
  "/eleitores",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/eleitores.html"
    );
  }
);

app.get(
  "/cadastro",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/cadastro.html"
    );
  }
);

app.get(
  "/importar",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/importar.html"
    );
  }
);

app.get(
  "/mapa",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/mapa.html"
    );
  }
);

app.get(
  "/liderancas",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/liderancas.html"
    );
  }
);

app.get(
  "/relatorios",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/relatorios.html"
    );
  }
);

app.get(
  "/relatorio-geral",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/relatorio-geral.html"
    );
  }
);

app.get(
  "/configuracoes",
  protegerPagina([
    "ADMIN",
    "ASSESSOR"
  ]),
  (req, res) => {
    return res.redirect(
      "/configuracoes.html"
    );
  }
);

app.get(
  "/usuarios",
  protegerPagina([
    "ADMIN"
  ]),
  (req, res) => {
    return res.redirect(
      "/usuarios.html"
    );
  }
);

app.get(
  "/admin",
  protegerPagina([
    "ADMIN"
  ]),
  (req, res) => {
    return res.redirect(
      "/admin.html"
    );
  }
);

// ======================================================
// API NÃO ENCONTRADA
// ======================================================

app.use(
  "/api",
  (req, res) => {
    return res
      .status(404)
      .json({
        ok: false,
        mensagem:
          "Rota da API não encontrada."
      });
  }
);

// ======================================================
// PÁGINA NÃO ENCONTRADA
// ======================================================

app.use((req, res) => {
  return res
    .status(404)
    .send(`
      <!DOCTYPE html>

      <html lang="pt-BR">

      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <title>
          Página não encontrada
        </title>

        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            background: #f4f6fa;
            color: #202636;
          }

          .erro-pagina {
            width: min(90%, 500px);
            padding: 40px;
            text-align: center;
            background: #ffffff;
            border-radius: 16px;
            box-shadow:
              0 10px 30px
              rgba(0, 0, 0, 0.08);
          }

          .erro-pagina h1 {
            margin-top: 0;
            font-size: 64px;
          }

          .erro-pagina a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 22px;
            color: #ffffff;
            text-decoration: none;
            background: #5426a6;
            border-radius: 8px;
          }
        </style>
      </head>

      <body>
        <div class="erro-pagina">
          <h1>404</h1>

          <h2>
            Página não encontrada
          </h2>

          <p>
            O endereço informado não existe no Sistema Lucas.
          </p>

          <a href="/dashboard.html">
            Voltar ao sistema
          </a>
        </div>
      </body>

      </html>
    `);
});

// ======================================================
// TRATAMENTO CENTRAL DE ERROS
// ======================================================

app.use(
  (
    erro,
    req,
    res,
    next
  ) => {
    console.error(
      "Erro não tratado:",
      erro
    );

    if (
      res.headersSent
    ) {
      return next(erro);
    }

    return res
      .status(
        erro.status || 500
      )
      .json({
        ok: false,

        mensagem:
          erro.message ||
          "Erro interno do servidor."
      });
  }
);

// ======================================================
// INICIALIZAÇÃO DO SISTEMA
// ======================================================

async function iniciarSistema() {
  try {
    console.log(
      "Iniciando o Sistema Lucas..."
    );

    await db.query(
      "SELECT 1"
    );

    console.log(
      "Banco de dados conectado."
    );

    await initDatabase();

    console.log(
      "Estrutura do banco verificada."
    );

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("");
        console.log(
          "========================================"
        );

        console.log(
          "SISTEMA LUCAS INICIADO COM SUCESSO"
        );

        console.log(
          `Ambiente: ${NODE_ENV}`
        );

        console.log(
          `Porta: ${PORT}`
        );

        console.log(
          `Acesso local: http://localhost:${PORT}`
        );

        console.log(
          "========================================"
        );

        console.log("");
      }
    );

  } catch (erro) {
    console.error("");

    console.error(
      "Não foi possível iniciar o Sistema Lucas."
    );

    console.error(
      erro
    );

    process.exit(1);
  }
}

iniciarSistema();