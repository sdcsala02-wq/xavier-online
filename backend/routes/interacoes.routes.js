const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const XLSX = require("xlsx");

const upload = multer({
  storage: multer.memoryStorage()
});

router.get("/resumo", async (req, res) => {
  try {
    const totaisPorAno = await pool.query(`
      SELECT 
        ano,
        COALESCE(SUM(quantidade), 0)::int AS total
      FROM interacoes_mensais
      GROUP BY ano
      ORDER BY ano
    `);

    const totalGeral = await pool.query(`
      SELECT COALESCE(SUM(quantidade), 0)::int AS total
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

router.get("/mensal", async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        ano,
        mes,
        quantidade::int AS total
      FROM interacoes_mensais
      ORDER BY ano, mes
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error("Erro ao buscar interações mensais:", error);
    res.status(500).json({ erro: "Erro ao buscar interações mensais." });
  }
});

router.get("/total/:ano", async (req, res) => {
  try {
    const { ano } = req.params;

    const resultado = await pool.query(
      `
      SELECT COALESCE(SUM(quantidade), 0)::int AS total
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

router.post("/importar", upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets["INTERAÇÕES"];

    if (!sheet) {
      return res.status(400).json({
        erro: "A aba INTERAÇÕES não foi encontrada."
      });
    }

    const linhas = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const meses = {
      JANEIRO: 1,
      FEVEREIRO: 2,
      MARÇO: 3,
      MARCO: 3,
      ABRIL: 4,
      MAIO: 5,
      JUNHO: 6,
      JULHO: 7,
      AGOSTO: 8,
      SETEMBRO: 9,
      OUTUBRO: 10,
      NOVEMBRO: 11,
      DEZEMBRO: 12
    };

    await pool.query("TRUNCATE TABLE interacoes_mensais RESTART IDENTITY");

    let totalImportado = 0;
    let totalIgnorado = 0;

    for (const linha of linhas) {
      const ano = Number(linha["ANO"]);

      const mesTexto = String(
        linha["MÊS"] || linha["MES"] || ""
      )
        .trim()
        .toUpperCase();

      const mes = meses[mesTexto];
      const quantidade = Number(linha["QUANTIDADE"] || 0);

      if (!ano || !mes) {
        totalIgnorado++;
        continue;
      }

      await pool.query(
        `
  INSERT INTO interacoes_mensais
  (ano, mes, quantidade)
  VALUES ($1, $2, $3)
  `,
        [ano, mes, quantidade]
      );

      totalImportado++;
    }

    res.json({
      mensagem: "Interações importadas com sucesso.",
      totalImportado,
      totalIgnorado
    });
  } catch (error) {
    console.error("Erro ao importar interações:", error);

    res.status(500).json({
      erro: "Erro ao importar interações.",
      detalhe: error.message
    });
  }
});

module.exports = router;