const express = require("express");
const router = express.Router();
const pool = require("../db");

// GARANTIR TABELA
async function garantirTabelaLiderancas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS liderancas (
      id SERIAL PRIMARY KEY,
      bairro VARCHAR(120) NOT NULL,
      nome VARCHAR(160) NOT NULL,
      telefone VARCHAR(40),
      observacao TEXT,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE liderancas
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    ALTER TABLE liderancas
    ADD COLUMN IF NOT EXISTS observacao TEXT;
  `);
}

// LISTAR TODAS AS LIDERANÇAS
router.get("/", async (req, res) => {
  try {
    await garantirTabelaLiderancas();

    const resultado = await pool.query(`
      SELECT *
      FROM liderancas
      WHERE COALESCE(ativo, true) = true
      ORDER BY bairro, nome
    `);

    res.json(resultado.rows);

  } catch (erro) {
    console.error("Erro ao listar lideranças:", erro);
    res.status(500).json({
      erro: "Erro ao listar lideranças",
      detalhe: erro.message
    });
  }
});

// RESUMO DAS LIDERANÇAS + DEMANDAS
router.get("/resumo", async (req, res) => {
  try {
    await garantirTabelaLiderancas();

    const resultado = await pool.query(`
      SELECT
        l.id,
        l.bairro,
        l.nome,
        l.telefone,
        COUNT(d.id)::int AS total_demandas,
        COUNT(d.id) FILTER (
          WHERE UPPER(COALESCE(d.status,'')) NOT IN ('RESOLVIDA','FINALIZADA','CONCLUÍDO','CONCLUIDO')
        )::int AS abertas,
        COUNT(d.id) FILTER (
          WHERE UPPER(COALESCE(d.status,'')) IN ('RESOLVIDA','FINALIZADA','CONCLUÍDO','CONCLUIDO')
        )::int AS resolvidas
      FROM liderancas l
      LEFT JOIN demandas_gabinete d
        ON UPPER(TRIM(l.bairro)) = UPPER(TRIM(d.bairro))
      WHERE COALESCE(l.ativo, true) = true
      GROUP BY l.id, l.bairro, l.nome, l.telefone
      ORDER BY l.bairro
    `);

    res.json(resultado.rows);

  } catch (erro) {
    console.error("Erro ao gerar resumo:", erro);
    res.status(500).json({
      erro: "Erro ao gerar resumo das lideranças",
      detalhe: erro.message
    });
  }
});

// BUSCAR LIDERANÇA POR BAIRRO
router.get("/bairro/:bairro", async (req, res) => {
  try {
    await garantirTabelaLiderancas();

    const { bairro } = req.params;

    const resultado = await pool.query(`
      SELECT *
      FROM liderancas
      WHERE UPPER(TRIM(bairro)) = UPPER(TRIM($1))
      AND COALESCE(ativo, true) = true
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
      erro: "Erro ao buscar liderança",
      detalhe: erro.message
    });
  }
});

// CADASTRAR LIDERANÇA
router.post("/", async (req, res) => {
  try {
    await garantirTabelaLiderancas();

    const { bairro, nome, telefone, observacao } = req.body;

    if (!bairro || !nome) {
      return res.status(400).json({
        erro: "Bairro e nome são obrigatórios."
      });
    }

    const existente = await pool.query(`
      SELECT id
      FROM liderancas
      WHERE UPPER(TRIM(bairro)) = UPPER(TRIM($1))
      AND UPPER(TRIM(nome)) = UPPER(TRIM($2))
      AND COALESCE(ativo, true) = true
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
        observacao,
        ativo
      )
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `, [bairro, nome, telefone || null, observacao || null]);

    res.status(201).json({
      mensagem: "Liderança cadastrada com sucesso.",
      lideranca: resultado.rows[0]
    });

  } catch (erro) {
    console.error("Erro ao cadastrar liderança:", erro);
    res.status(500).json({
      erro: "Erro ao cadastrar liderança",
      detalhe: erro.message
    });
  }
});

// EDITAR LIDERANÇA
router.put("/:id", async (req, res) => {
  try {
    await garantirTabelaLiderancas();

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
      AND COALESCE(ativo, true) = true
      RETURNING *
    `, [bairro, nome, telefone || null, observacao || null, id]);

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
      erro: "Erro ao atualizar liderança.",
      detalhe: erro.message
    });
  }
});

// EXCLUIR LIDERANÇA
router.delete("/:id", async (req, res) => {
  try {
    await garantirTabelaLiderancas();

    const { id } = req.params;

    const resultado = await pool.query(`
      UPDATE liderancas
      SET ativo = false
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Liderança não encontrada."
      });
    }

    res.json({
      sucesso: true,
      mensagem: "Liderança excluída com sucesso."
    });

  } catch (erro) {
    console.error("Erro ao excluir liderança:", erro);
    res.status(500).json({
      erro: "Erro ao excluir liderança",
      detalhe: erro.message
    });
  }
});

module.exports = router;