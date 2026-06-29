const express = require("express");
const router = express.Router();
const pool = require("../db");

// LISTAR TODAS AS LIDERANÇAS
router.get("/", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM liderancas
      WHERE ativo = true
      ORDER BY bairro, nome
    `);

    res.json(resultado.rows);

  } catch (erro) {
    console.error("Erro ao listar lideranças:", erro);
    res.status(500).json({
      erro: "Erro ao listar lideranças"
    });
  }
});

// RESUMO DAS LIDERANÇAS + DEMANDAS
router.get("/resumo", async (req, res) => {
  try {

    const resultado = await pool.query(`
      SELECT
        l.id,
        l.bairro,
        l.nome,
        l.telefone,

        COUNT(d.id)::int AS total_demandas,

        COUNT(d.id) FILTER (
          WHERE UPPER(COALESCE(d.status,'')) NOT IN ('RESOLVIDA','FINALIZADA')
        )::int AS abertas,

        COUNT(d.id) FILTER (
          WHERE UPPER(COALESCE(d.status,'')) IN ('RESOLVIDA','FINALIZADA')
        )::int AS resolvidas

      FROM liderancas l

      LEFT JOIN demandas d
        ON UPPER(TRIM(l.bairro)) = UPPER(TRIM(d.bairro))

      WHERE l.ativo = true

      GROUP BY
        l.id,
        l.bairro,
        l.nome,
        l.telefone

      ORDER BY l.bairro
    `);

    res.json(resultado.rows);

  } catch (erro) {
    console.error("Erro ao gerar resumo:", erro);
    res.status(500).json({
      erro: "Erro ao gerar resumo das lideranças"
    });
  }
});

// BUSCAR LIDERANÇA POR BAIRRO
router.get("/bairro/:bairro", async (req, res) => {
  try {

    const { bairro } = req.params;

    const resultado = await pool.query(`
      SELECT *
      FROM liderancas
      WHERE
        UPPER(TRIM(bairro)) = UPPER(TRIM($1))
        AND ativo = true
      LIMIT 1
    `, [bairro]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Nenhuma liderança encontrada"
      });
    }

    res.json(resultado.rows[0]);

  } catch (erro) {
    console.error("Erro ao buscar liderança:", erro);
    res.status(500).json({
      erro: "Erro ao buscar liderança"
    });
  }
});

// CADASTRAR LIDERANÇA
router.post("/", async (req, res) => {

  try {

    const {
      bairro,
      nome,
      telefone,
      observacao
    } = req.body;

    // EVITAR DUPLICIDADE
    const existente = await pool.query(`
      SELECT id
      FROM liderancas
      WHERE
        UPPER(TRIM(bairro)) = UPPER(TRIM($1))
        AND UPPER(TRIM(nome)) = UPPER(TRIM($2))
        AND ativo = true
    `, [bairro, nome]);

    if (existente.rows.length > 0) {
      return res.status(400).json({
        erro: "Esta liderança já está cadastrada neste bairro."
      });
    }

    const resultado = await pool.query(`
      INSERT INTO liderancas (
        bairro,
        nome,
        telefone,
        observacao
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `,
      [
        bairro,
        nome,
        telefone,
        observacao
      ]);

    res.status(201).json(resultado.rows[0]);

  } catch (erro) {
    console.error("Erro ao cadastrar liderança:", erro);
    res.status(500).json({
      erro: "Erro ao cadastrar liderança"
    });
  }
});

// EDITAR LIDERANÇA
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { bairro, nome, telefone, observacao } = req.body;

    if (!bairro || !nome) {
      return res.status(400).json({
        erro: "Bairro e nome são obrigatórios."
      });
    }

    const resultado = await pool.query(`
      UPDATE liderancas
      SET
        bairro = $1,
        nome = $2,
        telefone = $3,
        observacao = $4
      WHERE id = $5
      AND ativo = true
      RETURNING *
    `, [bairro, nome, telefone, observacao, id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Liderança não encontrada."
      });
    }

    res.json({
      mensagem: "Liderança atualizada com sucesso.",
      lideranca: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao atualizar liderança:", erro);
    res.status(500).json({
      erro: "Erro ao atualizar liderança."
    });
  }
});

// EXCLUIR LIDERANÇA
router.delete("/:id", async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(`
      UPDATE liderancas
      SET ativo = false
      WHERE id = $1
    `, [id]);

    res.json({
      sucesso: true
    });

  } catch (erro) {
    console.error("Erro ao excluir liderança:", erro);
    res.status(500).json({
      erro: "Erro ao excluir liderança"
    });
  }
});

module.exports = router;