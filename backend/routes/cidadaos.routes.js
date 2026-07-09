const express = require("express");
const router = express.Router();

const db = require("../db");

// =====================================
// LISTAR / BUSCAR CIDADÃOS
// =====================================
router.get("/", async (req, res) => {
  try {
    const busca = req.query.busca || "";

    const resultado = await db.query(
      `
      SELECT
        c.id,
        c.nome,
        c.telefone,
        c.whatsapp,
        c.bairro,
        c.endereco,
        c.criado_em,
        (
          SELECT sp.protocolo
          FROM solicitacoes_publicas sp
          WHERE sp.cidadao_id = c.id
          ORDER BY sp.criado_em DESC
          LIMIT 1
        ) AS ultimo_protocolo,
        (
          SELECT sp.servico
          FROM solicitacoes_publicas sp
          WHERE sp.cidadao_id = c.id
          ORDER BY sp.criado_em DESC
          LIMIT 1
        ) AS ultimo_servico
      FROM cidadaos c
      WHERE
        c.nome ILIKE $1
        OR c.telefone ILIKE $1
        OR c.whatsapp ILIKE $1
        OR c.bairro ILIKE $1
      ORDER BY c.nome ASC
      `,
      [`%${busca}%`]
    );

    return res.json({
      ok: true,
      total: resultado.rows.length,
      cidadaos: resultado.rows
    });

  } catch (erro) {
    console.error("Erro ao listar cidadãos:", erro);

    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao buscar cidadãos."
    });
  }
});

// =====================================
// PERFIL COMPLETO DO CIDADÃO - CRM
// =====================================
router.get("/:id/perfil", async (req, res) => {
  try {
    const { id } = req.params;

    const cidadao = await db.query(
      `
      SELECT *
      FROM cidadaos
      WHERE id = $1
      `,
      [id]
    );

    if (cidadao.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensagem: "Cidadão não encontrado."
      });
    }

    const protocolos = await db.query(
      `
      SELECT
        id,
        protocolo,
        servico,
        secretaria,
        status,
        criado_em
      FROM solicitacoes_publicas
      WHERE cidadao_id = $1
      ORDER BY criado_em DESC
      `,
      [id]
    );

    const historico = await db.query(
      `
      SELECT
        id,
        tipo,
        descricao,
        usuario,
        criado_em
      FROM historico_cidadaos
      WHERE cidadao_id = $1
      ORDER BY criado_em DESC
      `,
      [id]
    );

    return res.json({
      ok: true,
      cidadao: cidadao.rows[0],
      protocolos: protocolos.rows,
      historico: historico.rows
    });

  } catch (erro) {
    console.error("Erro ao buscar perfil cidadão:", erro);

    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao carregar perfil do cidadão."
    });
  }
});

module.exports = router;