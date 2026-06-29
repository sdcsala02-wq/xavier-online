const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/interacoes/resumo
 * Retorna o resumo anual das interações mensais
 */
router.get("/resumo", async (req, res) => {
  try {
    const totaisPorAno = await pool.query(`
      SELECT 
        ano,
        SUM(quantidade)::int AS total
      FROM interacoes_mensais
      GROUP BY ano
      ORDER BY ano
    `);

    const totalGeral = await pool.query(`
      SELECT 
        COALESCE(SUM(quantidade), 0)::int AS total
      FROM interacoes_mensais
    `);

    res.json({
      total: totalGeral.rows[0].total,
      porAno: totaisPorAno.rows
    });
  } catch (error) {
    console.error("Erro ao buscar resumo de interações:", error);
    res.status(500).json({ erro: "Erro ao buscar resumo de interações." });
  }
});

/**
 * GET /api/interacoes/mensal
 * Retorna as interações agrupadas por ano e mês
 */
router.get("/mensal", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        ano,
        mes,
        quantidade::int AS total
      FROM interacoes_mensais
      ORDER BY 
        ano,
        CASE mes
          WHEN 'JANEIRO' THEN 1
          WHEN 'FEVEREIRO' THEN 2
          WHEN 'MARÇO' THEN 3
          WHEN 'MARCO' THEN 3
          WHEN 'ABRIL' THEN 4
          WHEN 'MAIO' THEN 5
          WHEN 'JUNHO' THEN 6
          WHEN 'JULHO' THEN 7
          WHEN 'AGOSTO' THEN 8
          WHEN 'SETEMBRO' THEN 9
          WHEN 'OUTUBRO' THEN 10
          WHEN 'NOVEMBRO' THEN 11
          WHEN 'DEZEMBRO' THEN 12
          ELSE 99
        END
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error("Erro ao buscar interações mensais:", error);
    res.status(500).json({ erro: "Erro ao buscar interações mensais." });
  }
});

/**
 * GET /api/interacoes/total/:ano
 * Retorna o total de interações de um ano específico
 */
router.get("/total/:ano", async (req, res) => {
  try {
    const { ano } = req.params;

    const resultado = await pool.query(
      `
      SELECT 
        COALESCE(SUM(quantidade), 0)::int AS total
      FROM interacoes_mensais
      WHERE ano = $1
      `,
      [ano]
    );

    res.json({
      ano: Number(ano),
      total: resultado.rows[0].total
    });
  } catch (error) {
    console.error("Erro ao buscar total de interações por ano:", error);
    res.status(500).json({ erro: "Erro ao buscar total de interações por ano." });
  }
});

module.exports = router;