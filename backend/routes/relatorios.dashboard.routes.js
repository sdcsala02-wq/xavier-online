const express = require("express");
const pool = require("../db");

const router = express.Router();

// DASHBOARD DE DEMANDAS HISTÓRICAS
router.get("/dashboard", async (req, res) => {
  try {
    const totais = await pool.query(`
      SELECT
        COUNT(*) AS total_demandas,
        COUNT(DISTINCT bairro) AS total_bairros,
        COUNT(DISTINCT secretaria) AS total_secretarias,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(status,'')) LIKE '%RESOLV%'
             OR UPPER(COALESCE(status,'')) LIKE '%CONCLU%'
        ) AS resolvidas,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(status,'')) LIKE '%ANÁLISE%'
             OR UPPER(COALESCE(status,'')) LIKE '%ANALISE%'
        ) AS em_analise,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(status,'')) LIKE '%ENCAMINH%'
             OR UPPER(COALESCE(status,'')) LIKE '%ENVIADO%'
        ) AS encaminhadas
      FROM demandas_historicas
    `);

    const bairros = await pool.query(`
      SELECT bairro, COUNT(*) AS total
      FROM demandas_historicas
      WHERE bairro IS NOT NULL AND bairro <> ''
      GROUP BY bairro
      ORDER BY total DESC
      LIMIT 10
    `);

    const secretarias = await pool.query(`
      SELECT secretaria, COUNT(*) AS total
      FROM demandas_historicas
      WHERE secretaria IS NOT NULL AND secretaria <> ''
      GROUP BY secretaria
      ORDER BY total DESC
      LIMIT 10
    `);

    const evolucao = await pool.query(`
      SELECT TO_CHAR(data_demanda,'YYYY-MM') AS mes, COUNT(*) AS total
      FROM demandas_historicas
      WHERE data_demanda IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);

    const status = await pool.query(`
      SELECT COALESCE(status,'NÃO INFORMADO') AS status, COUNT(*) AS total
      FROM demandas_historicas
      GROUP BY status
      ORDER BY total DESC
    `);

    res.json({
      resumo: totais.rows[0],
      bairros: bairros.rows,
      secretarias: secretarias.rows,
      evolucao: evolucao.rows,
      status: status.rows
    });

  } catch (error) {
    console.error("Erro dashboard demandas:", error);
    res.status(500).json({
      erro: "Erro ao carregar dashboard de demandas."
    });
  }
});

// DASHBOARD DE ATIVIDADES LEGISLATIVAS
router.get("/atividades/dashboard", async (req, res) => {
  try {
    const total = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM atividades_legislativas
    `);

    const proposicoes = await pool.query(`
      SELECT
        COALESCE(propositura, 'NÃO INFORMADO') AS propositura,
        COUNT(*)::int AS total
      FROM atividades_legislativas
      GROUP BY propositura
      ORDER BY total DESC
    `);

    const secretarias = await pool.query(`
      SELECT
        COALESCE(secretaria, 'NÃO INFORMADO') AS secretaria,
        COUNT(*)::int AS total
      FROM atividades_legislativas
      WHERE secretaria IS NOT NULL AND secretaria <> ''
      GROUP BY secretaria
      ORDER BY total DESC
      LIMIT 10
    `);

    const bairros = await pool.query(`
      SELECT
        COALESCE(bairro, 'NÃO INFORMADO') AS bairro,
        COUNT(*)::int AS total
      FROM atividades_legislativas
      WHERE bairro IS NOT NULL AND bairro <> ''
      GROUP BY bairro
      ORDER BY total DESC
      LIMIT 20
    `);

    const secoes = await pool.query(`
      SELECT
        COALESCE(secao_ordinaria, 'NÃO INFORMADO') AS secao_ordinaria,
        COUNT(*)::int AS total
      FROM atividades_legislativas
      GROUP BY secao_ordinaria
      ORDER BY total DESC
    `);

    res.json({
      resumo: {
        total_atividades: total.rows[0].total
      },
      proposicoes: proposicoes.rows,
      secretarias: secretarias.rows,
      bairros: bairros.rows,
      secoes: secoes.rows
    });

  } catch (error) {
    console.error("Erro dashboard atividades:", error);
    res.status(500).json({
      erro: "Erro ao gerar dashboard de atividades legislativas."
    });
  }
});

module.exports = router;