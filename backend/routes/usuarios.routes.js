const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

const PERFIS = Object.freeze([
  {
    codigo: "ADMIN",
    nome: "Administrador",
    descricao: "Acesso completo ao sistema e à gestão de usuários."
  },
  {
    codigo: "ASSESSOR",
    nome: "Assessor",
    descricao: "Demandas, cidadãos, interações, relatórios e importações."
  },
  {
    codigo: "ATENDENTE",
    nome: "Atendente",
    descricao: "Cadastro e atualização de atendimentos e demandas."
  },
  {
    codigo: "CONSULTA",
    nome: "Consulta",
    descricao: "Acesso somente para consulta."
  },
  {
    codigo: "LIDERANCA",
    nome: "Liderança",
    descricao: "Acesso territorial e às informações de liderança."
  }
]);

const PERFIS_VALIDOS =
  new Set(
    PERFIS.map(
      (perfil) => perfil.codigo
    )
  );

function limparCPF(valor) {
  return String(valor || "")
    .replace(/\D/g, "");
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim();
}

function normalizarEmail(valor) {
  const email =
    normalizarTexto(valor)
      .toLowerCase();

  return email || null;
}

function normalizarPerfil(valor) {
  return normalizarTexto(valor)
    .toUpperCase();
}

function validarEmail(email) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function validarSenha(senha) {
  const valor =
    String(senha || "");

  return (
    valor.length >= 8 &&
    /[A-Za-zÀ-ÿ]/.test(valor) &&
    /\d/.test(valor)
  );
}

function prepararUsuario(row) {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    cpf: row.cpf,
    perfil: row.perfil,
    ativo: row.ativo,
    senhaTemporaria:
      row.senha_temporaria,
    ultimoLoginEm:
      row.ultimo_login_em,
    criadoEm:
      row.criado_em,
    atualizadoEm:
      row.atualizado_em
  };
}

async function registrarAuditoria(
  client,
  req,
  {
    usuarioAlvoId,
    acao,
    dadosAnteriores = null,
    dadosNovos = null
  }
) {
  await client.query(
    `
    INSERT INTO usuarios_auditoria (
      usuario_alvo_id,
      usuario_executor_id,
      acao,
      dados_anteriores,
      dados_novos,
      endereco_ip
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      usuarioAlvoId,
      req.usuario.id,
      acao,
      dadosAnteriores,
      dadosNovos,
      req.ip ||
        req.socket?.remoteAddress ||
        null
    ]
  );
}

function responderErro(
  res,
  erro,
  operacao
) {
  if (erro.code === "23505") {
    const campo =
      String(erro.constraint || "")
        .includes("email")
        ? "E-mail"
        : "CPF";

    return res.status(409).json({
      ok: false,
      mensagem:
        `${campo} já está vinculado a outro usuário.`
    });
  }

  if (erro.code === "23514") {
    return res.status(400).json({
      ok: false,
      mensagem:
        "Perfil inválido."
    });
  }

  console.error(
    `Erro ao ${operacao}:`,
    erro
  );

  return res.status(500).json({
    ok: false,
    mensagem:
      `Erro interno ao ${operacao}.`
  });
}

router.get(
  "/perfis",
  (req, res) => {
    return res.json({
      ok: true,
      perfis: PERFIS
    });
  }
);

router.get(
  "/",
  async (req, res) => {
    try {
      const busca =
        normalizarTexto(
          req.query.busca
        );

      const perfil =
        normalizarPerfil(
          req.query.perfil
        );

      const ativoRecebido =
        normalizarTexto(
          req.query.ativo
        ).toLowerCase();

      const parametros = [];
      const filtros = [];

      if (busca) {
        parametros.push(
          `%${busca}%`
        );

        filtros.push(`
          (
            nome ILIKE $${parametros.length}
            OR COALESCE(email, '') ILIKE $${parametros.length}
            OR cpf ILIKE $${parametros.length}
          )
        `);
      }

      if (perfil) {
        if (!PERFIS_VALIDOS.has(perfil)) {
          return res.status(400).json({
            ok: false,
            mensagem:
              "Perfil de consulta inválido."
          });
        }

        parametros.push(perfil);

        filtros.push(
          `perfil = $${parametros.length}`
        );
      }

      if (
        ativoRecebido === "true" ||
        ativoRecebido === "false"
      ) {
        parametros.push(
          ativoRecebido === "true"
        );

        filtros.push(
          `ativo = $${parametros.length}`
        );
      }

      const where =
        filtros.length > 0
          ? `WHERE ${filtros.join(" AND ")}`
          : "";

      const resultado =
        await db.query(
          `
          SELECT
            id,
            nome,
            email,
            cpf,
            perfil,
            ativo,
            senha_temporaria,
            ultimo_login_em,
            criado_em,
            atualizado_em
          FROM usuarios
          ${where}
          ORDER BY
            ativo DESC,
            nome ASC,
            id ASC
          `,
          parametros
        );

      return res.json({
        ok: true,
        total:
          resultado.rows.length,
        usuarios:
          resultado.rows.map(
            prepararUsuario
          )
      });
    } catch (erro) {
      return responderErro(
        res,
        erro,
        "listar usuários"
      );
    }
  }
);

router.post(
  "/",
  async (req, res) => {
    const nome =
      normalizarTexto(
        req.body.nome
      );

    const email =
      normalizarEmail(
        req.body.email
      );

    const cpf =
      limparCPF(
        req.body.cpf
      );

    const senha =
      String(
        req.body.senha || ""
      );

    const perfil =
      normalizarPerfil(
        req.body.perfil
      );

    if (!nome) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe o nome do usuário."
      });
    }

    if (cpf.length !== 11) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "O CPF deve possuir 11 números."
      });
    }

    if (!validarEmail(email)) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe um e-mail válido."
      });
    }

    if (!PERFIS_VALIDOS.has(perfil)) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Selecione um perfil válido."
      });
    }

    if (!validarSenha(senha)) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "A senha temporária deve possuir ao menos 8 caracteres, uma letra e um número."
      });
    }

    const client =
      await db.connect();

    let transacaoAtiva = false;

    try {
      await client.query("BEGIN");
      transacaoAtiva = true;

      const senhaHash =
        await bcrypt.hash(
          senha,
          12
        );

      const resultado =
        await client.query(
          `
          INSERT INTO usuarios (
            nome,
            email,
            cpf,
            senha_hash,
            perfil,
            ativo,
            senha_temporaria,
            criado_por,
            atualizado_em
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            TRUE,
            TRUE,
            $6,
            NOW()
          )
          RETURNING
            id,
            nome,
            email,
            cpf,
            perfil,
            ativo,
            senha_temporaria,
            ultimo_login_em,
            criado_em,
            atualizado_em
          `,
          [
            nome,
            email,
            cpf,
            senhaHash,
            perfil,
            req.usuario.id
          ]
        );

      const usuario =
        prepararUsuario(
          resultado.rows[0]
        );

      await registrarAuditoria(
        client,
        req,
        {
          usuarioAlvoId:
            usuario.id,
          acao:
            "USUARIO_CRIADO",
          dadosNovos: {
            nome:
              usuario.nome,
            email:
              usuario.email,
            cpf:
              usuario.cpf,
            perfil:
              usuario.perfil,
            ativo:
              usuario.ativo,
            senhaTemporaria:
              usuario.senhaTemporaria
          }
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.status(201).json({
        ok: true,
        mensagem:
          "Usuário criado com sucesso.",
        usuario
      });
    } catch (erro) {
      if (transacaoAtiva) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErro(
        res,
        erro,
        "criar usuário"
      );
    } finally {
      client.release();
    }
  }
);

function criarErroHttp(
  status,
  mensagem
) {
  const erro =
    new Error(mensagem);

  erro.statusHttp = status;

  return erro;
}

function responderErroAdministrativo(
  res,
  erro,
  operacao
) {
  if (
    Number.isInteger(
      erro.statusHttp
    )
  ) {
    return res
      .status(erro.statusHttp)
      .json({
        ok: false,
        mensagem:
          erro.message
      });
  }

  return responderErro(
    res,
    erro,
    operacao
  );
}

async function buscarUsuarioPorId(
  client,
  usuarioId,
  bloquear = false
) {
  const resultado =
    await client.query(
      `
      SELECT
        id,
        nome,
        email,
        cpf,
        perfil,
        ativo,
        senha_temporaria,
        ultimo_login_em,
        criado_em,
        atualizado_em
      FROM usuarios
      WHERE id = $1
      ${bloquear ? "FOR UPDATE" : ""}
      `,
      [usuarioId]
    );

  return (
    resultado.rows[0] ||
    null
  );
}

async function contarAdministradoresAtivos(
  client
) {
  const resultado =
    await client.query(`
      SELECT id
      FROM usuarios
      WHERE perfil = 'ADMIN'
        AND ativo = TRUE
      ORDER BY id
      FOR UPDATE
    `);

  return resultado.rows.length;
}

function validarIdUsuario(valor) {
  const id = Number(valor);

  return (
    Number.isInteger(id) &&
    id > 0
  )
    ? id
    : null;
}

router.put(
  "/:id",
  async (req, res) => {
    const usuarioId =
      validarIdUsuario(
        req.params.id
      );

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Identificador de usuário inválido."
      });
    }

    const nome =
      normalizarTexto(
        req.body.nome
      );

    const email =
      normalizarEmail(
        req.body.email
      );

    const cpf =
      limparCPF(
        req.body.cpf
      );

    const perfil =
      normalizarPerfil(
        req.body.perfil
      );

    if (!nome) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe o nome do usuário."
      });
    }

    if (cpf.length !== 11) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "O CPF deve possuir 11 números."
      });
    }

    if (!validarEmail(email)) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe um e-mail válido."
      });
    }

    if (!PERFIS_VALIDOS.has(perfil)) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Selecione um perfil válido."
      });
    }

    let client = null;
    let transacaoAtiva = false;

    try {
      client =
        await db.connect();

      await client.query("BEGIN");
      transacaoAtiva = true;

      const usuarioAnterior =
        await buscarUsuarioPorId(
          client,
          usuarioId,
          true
        );

      if (!usuarioAnterior) {
        throw criarErroHttp(
          404,
          "Usuário não encontrado."
        );
      }

      if (
        usuarioId ===
          req.usuario.id &&
        perfil !== "ADMIN"
      ) {
        throw criarErroHttp(
          400,
          "O administrador não pode retirar o próprio perfil administrativo."
        );
      }

      if (
        usuarioAnterior.perfil ===
          "ADMIN" &&
        usuarioAnterior.ativo ===
          true &&
        perfil !== "ADMIN"
      ) {
        const totalAdministradores =
          await contarAdministradoresAtivos(
            client
          );

        if (
          totalAdministradores <= 1
        ) {
          throw criarErroHttp(
            400,
            "Não é permitido remover o perfil do último administrador ativo."
          );
        }
      }

      const resultado =
        await client.query(
          `
          UPDATE usuarios
          SET
            nome = $1,
            email = $2,
            cpf = $3,
            perfil = $4
          WHERE id = $5
          RETURNING
            id,
            nome,
            email,
            cpf,
            perfil,
            ativo,
            senha_temporaria,
            ultimo_login_em,
            criado_em,
            atualizado_em
          `,
          [
            nome,
            email,
            cpf,
            perfil,
            usuarioId
          ]
        );

      const usuarioAtual =
        prepararUsuario(
          resultado.rows[0]
        );

      await registrarAuditoria(
        client,
        req,
        {
          usuarioAlvoId:
            usuarioId,
          acao:
            "USUARIO_ATUALIZADO",
          dadosAnteriores:
            prepararUsuario(
              usuarioAnterior
            ),
          dadosNovos:
            usuarioAtual
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.json({
        ok: true,
        mensagem:
          "Usuário atualizado com sucesso.",
        usuario:
          usuarioAtual
      });
    } catch (erro) {
      if (
        transacaoAtiva &&
        client
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErroAdministrativo(
        res,
        erro,
        "atualizar usuário"
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.patch(
  "/:id/status",
  async (req, res) => {
    const usuarioId =
      validarIdUsuario(
        req.params.id
      );

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Identificador de usuário inválido."
      });
    }

    if (
      typeof req.body.ativo !==
      "boolean"
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe um status válido."
      });
    }

    const ativo =
      req.body.ativo;

    let client = null;
    let transacaoAtiva = false;

    try {
      client =
        await db.connect();

      await client.query("BEGIN");
      transacaoAtiva = true;

      const usuarioAnterior =
        await buscarUsuarioPorId(
          client,
          usuarioId,
          true
        );

      if (!usuarioAnterior) {
        throw criarErroHttp(
          404,
          "Usuário não encontrado."
        );
      }

      if (
        usuarioId ===
          req.usuario.id &&
        ativo === false
      ) {
        throw criarErroHttp(
          400,
          "O administrador não pode inativar a própria conta."
        );
      }

      if (
        usuarioAnterior.perfil ===
          "ADMIN" &&
        usuarioAnterior.ativo ===
          true &&
        ativo === false
      ) {
        const totalAdministradores =
          await contarAdministradoresAtivos(
            client
          );

        if (
          totalAdministradores <= 1
        ) {
          throw criarErroHttp(
            400,
            "Não é permitido inativar o último administrador ativo."
          );
        }
      }

      if (
        usuarioAnterior.ativo ===
        ativo
      ) {
        await client.query("COMMIT");
        transacaoAtiva = false;

        return res.json({
          ok: true,
          mensagem:
            ativo
              ? "O usuário já está ativo."
              : "O usuário já está inativo.",
          usuario:
            prepararUsuario(
              usuarioAnterior
            )
        });
      }

      const resultado =
        await client.query(
          `
          UPDATE usuarios
          SET ativo = $1
          WHERE id = $2
          RETURNING
            id,
            nome,
            email,
            cpf,
            perfil,
            ativo,
            senha_temporaria,
            ultimo_login_em,
            criado_em,
            atualizado_em
          `,
          [
            ativo,
            usuarioId
          ]
        );

      const usuarioAtual =
        prepararUsuario(
          resultado.rows[0]
        );

      await registrarAuditoria(
        client,
        req,
        {
          usuarioAlvoId:
            usuarioId,
          acao:
            ativo
              ? "USUARIO_ATIVADO"
              : "USUARIO_INATIVADO",
          dadosAnteriores: {
            ativo:
              usuarioAnterior.ativo
          },
          dadosNovos: {
            ativo:
              usuarioAtual.ativo
          }
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.json({
        ok: true,
        mensagem:
          ativo
            ? "Usuário ativado com sucesso."
            : "Usuário inativado com sucesso.",
        usuario:
          usuarioAtual
      });
    } catch (erro) {
      if (
        transacaoAtiva &&
        client
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErroAdministrativo(
        res,
        erro,
        "alterar status do usuário"
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.patch(
  "/:id/senha",
  async (req, res) => {
    const usuarioId =
      validarIdUsuario(
        req.params.id
      );

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Identificador de usuário inválido."
      });
    }

    const senha =
      String(
        req.body.senha || ""
      );

    if (!validarSenha(senha)) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "A nova senha deve possuir ao menos 8 caracteres, uma letra e um número."
      });
    }

    let client = null;
    let transacaoAtiva = false;

    try {
      client =
        await db.connect();

      await client.query("BEGIN");
      transacaoAtiva = true;

      const usuarioAnterior =
        await buscarUsuarioPorId(
          client,
          usuarioId,
          true
        );

      if (!usuarioAnterior) {
        throw criarErroHttp(
          404,
          "Usuário não encontrado."
        );
      }

      const senhaHash =
        await bcrypt.hash(
          senha,
          12
        );

      const resultado =
        await client.query(
          `
          UPDATE usuarios
          SET
            senha_hash = $1,
            senha_temporaria = TRUE
          WHERE id = $2
          RETURNING
            id,
            nome,
            email,
            cpf,
            perfil,
            ativo,
            senha_temporaria,
            ultimo_login_em,
            criado_em,
            atualizado_em
          `,
          [
            senhaHash,
            usuarioId
          ]
        );

      const usuarioAtual =
        prepararUsuario(
          resultado.rows[0]
        );

      await registrarAuditoria(
        client,
        req,
        {
          usuarioAlvoId:
            usuarioId,
          acao:
            "SENHA_REDEFINIDA",
          dadosAnteriores: {
            senhaTemporaria:
              usuarioAnterior
                .senha_temporaria
          },
          dadosNovos: {
            senhaTemporaria:
              true
          }
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.json({
        ok: true,
        mensagem:
          "Senha temporária definida com sucesso.",
        usuario:
          usuarioAtual
      });
    } catch (erro) {
      if (
        transacaoAtiva &&
        client
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErroAdministrativo(
        res,
        erro,
        "redefinir senha"
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.get(
  "/:id/auditoria",
  async (req, res) => {
    const usuarioId =
      validarIdUsuario(
        req.params.id
      );

    if (!usuarioId) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Identificador de usuário inválido."
      });
    }

    try {
      const usuario =
        await buscarUsuarioPorId(
          db,
          usuarioId
        );

      if (!usuario) {
        return res.status(404).json({
          ok: false,
          mensagem:
            "Usuário não encontrado."
        });
      }

      const resultado =
        await db.query(
          `
          SELECT
            ua.id,
            ua.acao,
            ua.dados_anteriores,
            ua.dados_novos,
            ua.endereco_ip,
            ua.criado_em,
            executor.id AS executor_id,
            executor.nome AS executor_nome
          FROM usuarios_auditoria ua
          LEFT JOIN usuarios executor
            ON executor.id =
               ua.usuario_executor_id
          WHERE ua.usuario_alvo_id = $1
          ORDER BY
            ua.criado_em DESC,
            ua.id DESC
          LIMIT 100
          `,
          [
            usuarioId
          ]
        );

      return res.json({
        ok: true,
        usuario: {
          id:
            usuario.id,
          nome:
            usuario.nome
        },
        total:
          resultado.rows.length,
        auditoria:
          resultado.rows.map(
            (item) => ({
              id:
                item.id,
              acao:
                item.acao,
              dadosAnteriores:
                item.dados_anteriores,
              dadosNovos:
                item.dados_novos,
              enderecoIp:
                item.endereco_ip,
              criadoEm:
                item.criado_em,
              executor: {
                id:
                  item.executor_id,
                nome:
                  item.executor_nome
              }
            })
          )
      });
    } catch (erro) {
      return responderErroAdministrativo(
        res,
        erro,
        "consultar auditoria do usuário"
      );
    }
  }
);

module.exports = router;