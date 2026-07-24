"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

const PERFIS_VALIDOS = [
  "ADMIN",
  "DIRETOR",
  "FUNCIONARIO",
  "CONSULTA"
];

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function limparTexto(valor) {
  return String(valor || "").trim();
}

function limparCpf(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarEmail(valor) {
  const email = limparTexto(valor).toLowerCase();

  return email || null;
}

function normalizarLogin(valor) {
  const login = limparTexto(valor)
    .toLowerCase()
    .replace(/\s+/g, ".");

  return login || null;
}

function normalizarPerfil(valor) {
  return limparTexto(valor).toUpperCase();
}

function obterIp(req) {
  const encaminhado =
    req.headers["x-forwarded-for"];

  if (encaminhado) {
    return String(encaminhado)
      .split(",")[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

function usuarioAdministrador(req) {
  const perfil =
    normalizarPerfil(
      req.usuario?.perfil
    );

  return (
    perfil === "ADMIN" ||
    perfil === "SUPERADMIN"
  );
}

function validarSenha(senha) {
  if (
    typeof senha !== "string" ||
    senha.length < 6
  ) {
    return {
      valida: false,
      mensagem:
        "A senha deve possuir pelo menos 6 caracteres."
    };
  }

  return {
    valida: true
  };
}

function validarPerfil(perfil) {
  return PERFIS_VALIDOS.includes(
    normalizarPerfil(perfil)
  );
}

function converterBooleano(valor) {
  if (typeof valor === "boolean") {
    return valor;
  }

  const texto =
    String(valor || "")
      .trim()
      .toUpperCase();

  return [
    "TRUE",
    "1",
    "SIM",
    "ATIVO"
  ].includes(texto);
}

async function registrarAuditoria({
  usuarioAlvoId,
  realizadoPorUsuarioId,
  acao,
  detalhes,
  ip
}) {
  try {
    await db.query(
      `
        INSERT INTO auditoria_usuarios (
          usuario_alvo_id,
          realizado_por_usuario_id,
          acao,
          detalhes,
          ip
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::jsonb,
          $5
        )
      `,
      [
        usuarioAlvoId || null,
        realizadoPorUsuarioId || null,
        acao,
        JSON.stringify(
          detalhes || {}
        ),
        ip || null
      ]
    );
  } catch (erro) {
    console.error(
      "Erro ao registrar auditoria:",
      erro
    );
  }
}

async function buscarUsuarioPorId(id) {
  const resultado =
    await db.query(
      `
        SELECT
          u.id,
          u.candidato_id,
          u.nome,
          u.cpf,
          u.login,
          u.email,
          u.perfil,
          u.ativo,
          u.ultimo_acesso_em,
          u.ultimo_ip,
          u.tentativas_login_falhas,
          u.bloqueado_ate,
          u.precisa_alterar_senha,
          u.criado_por_usuario_id,
          u.criado_em,
          u.atualizado_em,
          c.nome AS candidato_nome

        FROM usuarios_lucas u

        LEFT JOIN candidatos c
          ON c.id = u.candidato_id

        WHERE u.id = $1

        LIMIT 1
      `,
      [id]
    );

  return resultado.rows[0] || null;
}

// ======================================================
// PROTEÇÃO ADMINISTRATIVA
// ======================================================

router.use((req, res, next) => {
  if (!req.usuario) {
    return res
      .status(401)
      .json({
        ok: false,
        mensagem:
          "Usuário não autenticado."
      });
  }

  if (!usuarioAdministrador(req)) {
    return res
      .status(403)
      .json({
        ok: false,
        mensagem:
          "Somente o administrador geral pode gerenciar usuários."
      });
  }

  return next();
});

// ======================================================
// LISTAR PERFIS DISPONÍVEIS
// ======================================================

router.get(
  "/perfis",
  async (req, res) => {
    return res.json({
      ok: true,

      perfis: [
        {
          codigo: "ADMIN",
          nome:
            "Administrador Geral",
          descricao:
            "Acesso geral a todos os clientes, usuários e configurações."
        },
        {
          codigo: "DIRETOR",
          nome:
            "Cliente / Diretor",
          descricao:
            "Gerencia a equipe e os dados do próprio cliente."
        },
        {
          codigo: "FUNCIONARIO",
          nome:
            "Funcionário",
          descricao:
            "Acesso definido pelas permissões atribuídas."
        },
        {
          codigo: "CONSULTA",
          nome:
            "Consulta / Demonstração",
          descricao:
            "Acesso somente para visualização."
        }
      ]
    });
  }
);

// ======================================================
// LISTAR CANDIDATOS / CLIENTES
// ======================================================

router.get(
  "/clientes",
  async (req, res) => {
    try {
      const resultado =
        await db.query(
          `
            SELECT
              id,
              nome,
              cargo,
              partido,
              cidade,
              estado,
              ativo

            FROM candidatos

            ORDER BY
              ativo DESC,
              nome ASC
          `
        );

      return res.json({
        ok: true,
        clientes: resultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao listar clientes:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar os clientes."
        });
    }
  }
);

// ======================================================
// LISTAR USUÁRIOS
// ======================================================

router.get(
  "/",
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
              u.login,
              u.email,
              u.perfil,
              u.ativo,

              u.ultimo_acesso_em,
              u.ultimo_acesso_em
                AS ultimo_acesso,

              u.ultimo_ip,

              u.tentativas_login_falhas,

              u.bloqueado_ate,

              u.precisa_alterar_senha,

              u.criado_por_usuario_id,

              u.criado_em,

              u.atualizado_em,

              c.nome
                AS candidato_nome,

              criador.nome
                AS criado_por_nome

            FROM usuarios_lucas u

            LEFT JOIN candidatos c
              ON c.id = u.candidato_id

            LEFT JOIN usuarios_lucas criador
              ON criador.id =
                u.criado_por_usuario_id

            ORDER BY
              CASE
                WHEN u.id = $1
                  THEN 0
                ELSE 1
              END,

              u.ativo DESC,

              u.nome ASC
          `,
          [req.usuario.id]
        );

      return res.json({
        ok: true,
        usuarios: resultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao listar usuários:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar os usuários."
        });
    }
  }
);

// ======================================================
// CONSULTAR UM USUÁRIO
// ======================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Usuário inválido."
          });
      }

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
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
        usuario
      });

    } catch (erro) {
      console.error(
        "Erro ao consultar usuário:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao consultar o usuário."
        });
    }
  }
);

// ======================================================
// CRIAR USUÁRIO
// ======================================================

router.post(
  "/",
  async (req, res) => {
    const cliente =
      await db.connect();

    try {
      const nome =
        limparTexto(req.body.nome);

      const cpf =
        limparCpf(req.body.cpf);

      const login =
        normalizarLogin(
          req.body.login
        );

      const email =
        normalizarEmail(
          req.body.email
        );

      const perfil =
        normalizarPerfil(
          req.body.perfil
        );

      const senha =
        String(req.body.senha || "");

      const ativo =
        req.body.ativo === undefined
          ? true
          : converterBooleano(
            req.body.ativo
          );

      const candidatoId =
        Number(
          req.body.candidato_id ||
          req.usuario.candidato_id
        );

      if (!nome) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe o nome do usuário."
          });
      }

      if (
        cpf &&
        cpf.length !== 11
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "O CPF deve possuir 11 números."
          });
      }

      if (
        !cpf &&
        !login &&
        !email
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe ao menos CPF, login ou e-mail."
          });
      }

      if (!validarPerfil(perfil)) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Perfil de usuário inválido."
          });
      }

      const validacaoSenha =
        validarSenha(senha);

      if (!validacaoSenha.valida) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              validacaoSenha.mensagem
          });
      }

      if (
        !Number.isInteger(
          candidatoId
        ) ||
        candidatoId <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Selecione o cliente vinculado ao usuário."
          });
      }

      await cliente.query(
        "BEGIN"
      );

      const clienteExistente =
        await cliente.query(
          `
            SELECT id
            FROM candidatos
            WHERE id = $1
            LIMIT 1
          `,
          [candidatoId]
        );

      if (
        clienteExistente.rows.length === 0
      ) {
        await cliente.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Cliente não encontrado."
          });
      }

      const duplicado =
        await cliente.query(
          `
            SELECT
              id,
              nome,
              cpf,
              login,
              email

            FROM usuarios_lucas

            WHERE
              (
                $1::VARCHAR IS NOT NULL
                AND cpf = $1
              )

              OR (
                $2::VARCHAR IS NOT NULL
                AND LOWER(login) =
                  LOWER($2)
              )

              OR (
                $3::VARCHAR IS NOT NULL
                AND LOWER(email) =
                  LOWER($3)
              )

            LIMIT 1
          `,
          [
            cpf || null,
            login,
            email
          ]
        );

      if (
        duplicado.rows.length > 0
      ) {
        await cliente.query(
          "ROLLBACK"
        );

        return res
          .status(409)
          .json({
            ok: false,
            mensagem:
              "Já existe um usuário com o mesmo CPF, login ou e-mail."
          });
      }

      const senhaCriptografada =
        await bcrypt.hash(
          senha,
          12
        );

      const resultado =
        await cliente.query(
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
              precisa_alterar_senha,
              senha_alterada_em,
              criado_por_usuario_id,
              criado_em,
              atualizado_em
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
              CURRENT_TIMESTAMP,
              $10,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )

            RETURNING
              id,
              candidato_id,
              nome,
              cpf,
              login,
              email,
              perfil,
              ativo,
              precisa_alterar_senha,
              criado_em
          `,
          [
            candidatoId,
            nome,
            cpf || null,
            login,
            email,
            senhaCriptografada,
            perfil,
            ativo,
            req.body.precisa_alterar_senha ===
              undefined
              ? true
              : converterBooleano(
                req.body
                  .precisa_alterar_senha
              ),
            req.usuario.id
          ]
        );

      const novoUsuario =
        resultado.rows[0];

      await cliente.query(
        "COMMIT"
      );

      await registrarAuditoria({
        usuarioAlvoId:
          novoUsuario.id,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          "USUARIO_CRIADO",

        detalhes: {
          nome:
            novoUsuario.nome,

          login:
            novoUsuario.login,

          perfil:
            novoUsuario.perfil,

          candidato_id:
            novoUsuario.candidato_id
        },

        ip:
          obterIp(req)
      });

      return res
        .status(201)
        .json({
          ok: true,
          mensagem:
            "Usuário criado com sucesso.",
          usuario:
            novoUsuario
        });

    } catch (erro) {
      try {
        await cliente.query(
          "ROLLBACK"
        );
      } catch (_) {
        // Transação não iniciada.
      }

      console.error(
        "Erro ao criar usuário:",
        erro
      );

      if (
        erro.code === "23505"
      ) {
        return res
          .status(409)
          .json({
            ok: false,
            mensagem:
              "CPF, login ou e-mail já cadastrado."
          });
      }

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao criar o usuário."
        });

    } finally {
      cliente.release();
    }
  }
);

// ======================================================
// EDITAR USUÁRIO
// ======================================================

router.put(
  "/:id",
  async (req, res) => {
    const cliente =
      await db.connect();

    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Usuário inválido."
          });
      }

      const usuarioAtual =
        await buscarUsuarioPorId(id);

      if (!usuarioAtual) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      const nome =
        limparTexto(
          req.body.nome ??
          usuarioAtual.nome
        );

      const cpfRecebido =
        req.body.cpf === undefined
          ? usuarioAtual.cpf
          : limparCpf(req.body.cpf);

      const cpf =
        cpfRecebido || null;

      const login =
        req.body.login === undefined
          ? usuarioAtual.login
          : normalizarLogin(
            req.body.login
          );

      const email =
        req.body.email === undefined
          ? usuarioAtual.email
          : normalizarEmail(
            req.body.email
          );

      const perfil =
        req.body.perfil === undefined
          ? normalizarPerfil(
            usuarioAtual.perfil
          )
          : normalizarPerfil(
            req.body.perfil
          );

      const ativo =
        req.body.ativo === undefined
          ? usuarioAtual.ativo
          : converterBooleano(
            req.body.ativo
          );

      const candidatoId =
        req.body.candidato_id === undefined
          ? Number(
            usuarioAtual.candidato_id
          )
          : Number(
            req.body.candidato_id
          );

      if (!nome) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe o nome do usuário."
          });
      }

      if (
        cpf &&
        cpf.length !== 11
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "O CPF deve possuir 11 números."
          });
      }

      if (
        !cpf &&
        !login &&
        !email
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Informe ao menos CPF, login ou e-mail."
          });
      }

      if (!validarPerfil(perfil)) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Perfil de usuário inválido."
          });
      }

      if (
        !Number.isInteger(
          candidatoId
        ) ||
        candidatoId <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Cliente inválido."
          });
      }

      if (
        id === Number(
          req.usuario.id
        ) &&
        !ativo
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Você não pode bloquear o próprio usuário."
          });
      }

      if (
        id === Number(
          req.usuario.id
        ) &&
        perfil !== "ADMIN"
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Você não pode remover o próprio acesso de administrador."
          });
      }

      await cliente.query(
        "BEGIN"
      );

      const duplicado =
        await cliente.query(
          `
            SELECT id

            FROM usuarios_lucas

            WHERE id <> $1

              AND (
                (
                  $2::VARCHAR IS NOT NULL
                  AND cpf = $2
                )

                OR (
                  $3::VARCHAR IS NOT NULL
                  AND LOWER(login) =
                    LOWER($3)
                )

                OR (
                  $4::VARCHAR IS NOT NULL
                  AND LOWER(email) =
                    LOWER($4)
                )
              )

            LIMIT 1
          `,
          [
            id,
            cpf,
            login,
            email
          ]
        );

      if (
        duplicado.rows.length > 0
      ) {
        await cliente.query(
          "ROLLBACK"
        );

        return res
          .status(409)
          .json({
            ok: false,
            mensagem:
              "Já existe outro usuário com o mesmo CPF, login ou e-mail."
          });
      }

      const resultado =
        await cliente.query(
          `
            UPDATE usuarios_lucas

            SET
              candidato_id = $1,
              nome = $2,
              cpf = $3,
              login = $4,
              email = $5,
              perfil = $6,
              ativo = $7,
              atualizado_em =
                CURRENT_TIMESTAMP

            WHERE id = $8

            RETURNING
              id,
              candidato_id,
              nome,
              cpf,
              login,
              email,
              perfil,
              ativo,
              ultimo_acesso_em,
              precisa_alterar_senha,
              atualizado_em
          `,
          [
            candidatoId,
            nome,
            cpf,
            login,
            email,
            perfil,
            ativo,
            id
          ]
        );

      if (
        req.body.senha
      ) {
        const validacaoSenha =
          validarSenha(
            req.body.senha
          );

        if (
          !validacaoSenha.valida
        ) {
          await cliente.query(
            "ROLLBACK"
          );

          return res
            .status(400)
            .json({
              ok: false,
              mensagem:
                validacaoSenha.mensagem
            });
        }

        const senhaCriptografada =
          await bcrypt.hash(
            String(
              req.body.senha
            ),
            12
          );

        await cliente.query(
          `
            UPDATE usuarios_lucas

            SET
              senha = $1,

              senha_alterada_em =
                CURRENT_TIMESTAMP,

              precisa_alterar_senha =
                $2,

              tentativas_login_falhas =
                0,

              bloqueado_ate =
                NULL,

              atualizado_em =
                CURRENT_TIMESTAMP

            WHERE id = $3
          `,
          [
            senhaCriptografada,

            req.body
              .precisa_alterar_senha ===
              undefined
              ? true
              : converterBooleano(
                req.body
                  .precisa_alterar_senha
              ),

            id
          ]
        );
      }

      await cliente.query(
        "COMMIT"
      );

      await registrarAuditoria({
        usuarioAlvoId:
          id,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          "USUARIO_EDITADO",

        detalhes: {
          anterior: {
            nome:
              usuarioAtual.nome,

            login:
              usuarioAtual.login,

            perfil:
              usuarioAtual.perfil,

            ativo:
              usuarioAtual.ativo
          },

          atual: {
            nome,
            login,
            perfil,
            ativo
          }
        },

        ip:
          obterIp(req)
      });

      return res.json({
        ok: true,
        mensagem:
          "Usuário atualizado com sucesso.",
        usuario:
          resultado.rows[0]
      });

    } catch (erro) {
      try {
        await cliente.query(
          "ROLLBACK"
        );
      } catch (_) {
        // Transação não iniciada.
      }

      console.error(
        "Erro ao editar usuário:",
        erro
      );

      if (
        erro.code === "23505"
      ) {
        return res
          .status(409)
          .json({
            ok: false,
            mensagem:
              "CPF, login ou e-mail já utilizado."
          });
      }

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao atualizar o usuário."
        });

    } finally {
      cliente.release();
    }
  }
);

// ======================================================
// REDEFINIR SENHA
// ======================================================

router.patch(
  "/:id/senha",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const senha =
        String(
          req.body.senha ||
          req.body.nova_senha ||
          ""
        );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Usuário inválido."
          });
      }

      const validacao =
        validarSenha(senha);

      if (!validacao.valida) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              validacao.mensagem
          });
      }

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      const senhaCriptografada =
        await bcrypt.hash(
          senha,
          12
        );

      const obrigarTroca =
        req.body.precisa_alterar_senha ===
          undefined
          ? true
          : converterBooleano(
            req.body
              .precisa_alterar_senha
          );

      await db.query(
        `
          UPDATE usuarios_lucas

          SET
            senha = $1,

            senha_alterada_em =
              CURRENT_TIMESTAMP,

            precisa_alterar_senha =
              $2,

            tentativas_login_falhas =
              0,

            bloqueado_ate =
              NULL,

            atualizado_em =
              CURRENT_TIMESTAMP

          WHERE id = $3
        `,
        [
          senhaCriptografada,
          obrigarTroca,
          id
        ]
      );

      await registrarAuditoria({
        usuarioAlvoId:
          id,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          "SENHA_REDEFINIDA",

        detalhes: {
          precisa_alterar_senha:
            obrigarTroca
        },

        ip:
          obterIp(req)
      });

      return res.json({
        ok: true,
        mensagem:
          "Senha redefinida com sucesso."
      });

    } catch (erro) {
      console.error(
        "Erro ao redefinir senha:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao redefinir a senha."
        });
    }
  }
);

// ======================================================
// BLOQUEAR OU DESBLOQUEAR
// ======================================================

router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Usuário inválido."
          });
      }

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      const ativo =
        req.body.ativo !== undefined
          ? converterBooleano(
            req.body.ativo
          )
          : normalizarPerfil(
            req.body.status
          ) === "ATIVO";

      if (
        id === Number(
          req.usuario.id
        ) &&
        !ativo
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Você não pode bloquear o próprio usuário."
          });
      }

      await db.query(
        `
          UPDATE usuarios_lucas

          SET
            ativo = $1,

            tentativas_login_falhas =
              CASE
                WHEN $1 = TRUE
                  THEN 0
                ELSE tentativas_login_falhas
              END,

            bloqueado_ate =
              CASE
                WHEN $1 = TRUE
                  THEN NULL
                ELSE bloqueado_ate
              END,

            atualizado_em =
              CURRENT_TIMESTAMP

          WHERE id = $2
        `,
        [
          ativo,
          id
        ]
      );

      await registrarAuditoria({
        usuarioAlvoId:
          id,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          ativo
            ? "USUARIO_DESBLOQUEADO"
            : "USUARIO_BLOQUEADO",

        detalhes: {
          ativo
        },

        ip:
          obterIp(req)
      });

      return res.json({
        ok: true,

        mensagem:
          ativo
            ? "Usuário ativado com sucesso."
            : "Usuário bloqueado com sucesso.",

        ativo
      });

    } catch (erro) {
      console.error(
        "Erro ao alterar status:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao alterar o status do usuário."
        });
    }
  }
);

// ======================================================
// LISTAR PERMISSÕES DO USUÁRIO
// ======================================================

router.get(
  "/:id/permissoes",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      const resultado =
        await db.query(
          `
            SELECT
              p.id,
              p.codigo,
              p.modulo,
              p.acao,
              p.descricao,

              COALESCE(
                up.permitido,
                pp.permitido,
                FALSE
              ) AS permitido,

              CASE
                WHEN up.id IS NOT NULL
                  THEN 'USUARIO'
                WHEN pp.id IS NOT NULL
                  THEN 'PERFIL'
                ELSE 'SEM_PERMISSAO'
              END AS origem,

              pp.permitido
                AS permitido_perfil,

              up.permitido
                AS permitido_usuario

            FROM permissoes p

            LEFT JOIN perfil_permissoes pp
              ON pp.permissao_id = p.id

              AND pp.perfil =
                $2

            LEFT JOIN usuario_permissoes up
              ON up.permissao_id = p.id

              AND up.usuario_id =
                $1

            WHERE p.ativo = TRUE

            ORDER BY
              p.modulo ASC,
              p.descricao ASC
          `,
          [
            id,
            normalizarPerfil(
              usuario.perfil
            )
          ]
        );

      return res.json({
        ok: true,

        usuario: {
          id:
            usuario.id,

          nome:
            usuario.nome,

          perfil:
            usuario.perfil
        },

        permissoes:
          resultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao carregar permissões:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar as permissões."
        });
    }
  }
);

// ======================================================
// SALVAR PERMISSÕES INDIVIDUAIS
// ======================================================

router.put(
  "/:id/permissoes",
  async (req, res) => {
    const cliente =
      await db.connect();

    try {
      const id =
        Number(req.params.id);

      const permissoes =
        Array.isArray(
          req.body.permissoes
        )
          ? req.body.permissoes
          : [];

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      await cliente.query(
        "BEGIN"
      );

      for (
        const item of permissoes
      ) {
        const codigo =
          limparTexto(
            item.codigo
          );

        if (!codigo) {
          continue;
        }

        const permissaoResultado =
          await cliente.query(
            `
              SELECT id

              FROM permissoes

              WHERE codigo = $1
                AND ativo = TRUE

              LIMIT 1
            `,
            [codigo]
          );

        if (
          permissaoResultado
            .rows.length === 0
        ) {
          continue;
        }

        const permissaoId =
          permissaoResultado
            .rows[0].id;

        const permitido =
          converterBooleano(
            item.permitido
          );

        await cliente.query(
          `
            INSERT INTO usuario_permissoes (
              usuario_id,
              permissao_id,
              permitido,
              alterado_por_usuario_id,
              criado_em,
              atualizado_em
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )

            ON CONFLICT (
              usuario_id,
              permissao_id
            )

            DO UPDATE SET
              permitido =
                EXCLUDED.permitido,

              alterado_por_usuario_id =
                EXCLUDED
                  .alterado_por_usuario_id,

              atualizado_em =
                CURRENT_TIMESTAMP
          `,
          [
            id,
            permissaoId,
            permitido,
            req.usuario.id
          ]
        );
      }

      await cliente.query(
        "COMMIT"
      );

      await registrarAuditoria({
        usuarioAlvoId:
          id,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          "PERMISSOES_ALTERADAS",

        detalhes: {
          quantidade:
            permissoes.length,

          permissoes
        },

        ip:
          obterIp(req)
      });

      return res.json({
        ok: true,
        mensagem:
          "Permissões atualizadas com sucesso."
      });

    } catch (erro) {
      try {
        await cliente.query(
          "ROLLBACK"
        );
      } catch (_) {
        // Transação não iniciada.
      }

      console.error(
        "Erro ao salvar permissões:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao atualizar as permissões."
        });

    } finally {
      cliente.release();
    }
  }
);

// ======================================================
// RESTAURAR PERMISSÕES DO PERFIL
// ======================================================

router.delete(
  "/:id/permissoes",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      await db.query(
        `
          DELETE FROM usuario_permissoes
          WHERE usuario_id = $1
        `,
        [id]
      );

      await registrarAuditoria({
        usuarioAlvoId:
          id,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          "PERMISSOES_RESTAURADAS",

        detalhes: {
          perfil:
            usuario.perfil
        },

        ip:
          obterIp(req)
      });

      return res.json({
        ok: true,
        mensagem:
          "As permissões padrão do perfil foram restauradas."
      });

    } catch (erro) {
      console.error(
        "Erro ao restaurar permissões:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao restaurar as permissões."
        });
    }
  }
);

// ======================================================
// HISTÓRICO DE ACESSOS
// ======================================================

router.get(
  "/:id/acessos",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      const resultado =
        await db.query(
          `
            SELECT
              id,
              login_informado,
              sucesso,
              ip,
              user_agent,
              motivo,
              criado_em

            FROM acessos_usuarios

            WHERE usuario_id = $1

            ORDER BY
              criado_em DESC

            LIMIT 100
          `,
          [id]
        );

      return res.json({
        ok: true,
        usuario: {
          id:
            usuario.id,

          nome:
            usuario.nome,

          ultimo_acesso_em:
            usuario.ultimo_acesso_em,

          ultimo_ip:
            usuario.ultimo_ip
        },

        acessos:
          resultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao carregar acessos:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar o histórico de acessos."
        });
    }
  }
);

// ======================================================
// HISTÓRICO DE ALTERAÇÕES
// ======================================================

router.get(
  "/:id/auditoria",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      const resultado =
        await db.query(
          `
            SELECT
              a.id,
              a.acao,
              a.detalhes,
              a.ip,
              a.criado_em,

              responsavel.nome
                AS realizado_por_nome

            FROM auditoria_usuarios a

            LEFT JOIN usuarios_lucas
              responsavel

              ON responsavel.id =
                a.realizado_por_usuario_id

            WHERE a.usuario_alvo_id =
              $1

            ORDER BY
              a.criado_em DESC

            LIMIT 100
          `,
          [id]
        );

      return res.json({
        ok: true,
        auditoria:
          resultado.rows
      });

    } catch (erro) {
      console.error(
        "Erro ao carregar auditoria:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao carregar o histórico de alterações."
        });
    }
  }
);

// ======================================================
// EXCLUIR USUÁRIO
// ======================================================

router.delete(
  "/:id",
  async (req, res) => {
    const cliente =
      await db.connect();

    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Usuário inválido."
          });
      }

      if (
        id === Number(
          req.usuario.id
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Você não pode excluir o próprio usuário."
          });
      }

      const usuario =
        await buscarUsuarioPorId(id);

      if (!usuario) {
        return res
          .status(404)
          .json({
            ok: false,
            mensagem:
              "Usuário não encontrado."
          });
      }

      await cliente.query(
        "BEGIN"
      );

      await cliente.query(
        `
          UPDATE eleitores

          SET
            criado_por_usuario_id =
              NULL

          WHERE criado_por_usuario_id =
            $1
        `,
        [id]
      );

      await cliente.query(
        `
          UPDATE eleitores

          SET
            atualizado_por_usuario_id =
              NULL

          WHERE atualizado_por_usuario_id =
            $1
        `,
        [id]
      );

      await cliente.query(
        `
          DELETE FROM usuarios_lucas
          WHERE id = $1
        `,
        [id]
      );

      await cliente.query(
        "COMMIT"
      );

      await registrarAuditoria({
        usuarioAlvoId:
          null,

        realizadoPorUsuarioId:
          req.usuario.id,

        acao:
          "USUARIO_EXCLUIDO",

        detalhes: {
          usuario_excluido_id:
            id,

          nome:
            usuario.nome,

          login:
            usuario.login,

          perfil:
            usuario.perfil
        },

        ip:
          obterIp(req)
      });

      return res.json({
        ok: true,
        mensagem:
          "Usuário excluído com sucesso."
      });

    } catch (erro) {
      try {
        await cliente.query(
          "ROLLBACK"
        );
      } catch (_) {
        // Transação não iniciada.
      }

      console.error(
        "Erro ao excluir usuário:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Erro ao excluir o usuário."
        });

    } finally {
      cliente.release();
    }
  }
);

module.exports = router;