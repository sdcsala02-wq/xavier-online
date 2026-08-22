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
    codigo: "SECRETARIA",
    nome: "Secretaria",
    descricao: "Acesso às demandas vinculadas à sua secretaria."
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
    secretaria: row.secretaria,
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
        "Perfil ou vínculo de secretaria inválido."
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
            OR COALESCE(secretaria, '') ILIKE $${parametros.length}
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
            secretaria,
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

    const secretariaRecebida =
      normalizarTexto(
        req.body.secretaria
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

    if (
      perfil === "SECRETARIA" &&
      !secretariaRecebida
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe a secretaria vinculada ao usuário."
      });
    }

    const secretaria =
      perfil === "SECRETARIA"
        ? secretariaRecebida
        : null;

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
            secretaria,
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
            $6,
            TRUE,
            TRUE,
            $7,
            NOW()
          )
          RETURNING
            id,
            nome,
            email,
            cpf,
            perfil,
            secretaria,
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
            secretaria,
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
            secretaria:
              usuario.secretaria,
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

module.exports = router;