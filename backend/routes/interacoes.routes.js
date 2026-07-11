const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../db");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

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
      SELECT
        COALESCE(SUM(quantidade), 0)::int AS total
      FROM interacoes_mensais
    `);

    res.json({
      total: totalGeral.rows[0].total,
      porAno: totaisPorAno.rows
    });
  } catch (error) {
    console.error(
      "Erro ao buscar resumo de interações:",
      error
    );

    res.status(500).json({
      erro: "Erro ao buscar resumo de interações.",
      detalhe: error.message
    });
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
    console.error(
      "Erro ao buscar interações mensais:",
      error
    );

    res.status(500).json({
      erro: "Erro ao buscar interações mensais.",
      detalhe: error.message
    });
  }
});

router.get("/total/:ano", async (req, res) => {
  try {
    const ano = Number(req.params.ano);

    if (!Number.isInteger(ano)) {
      return res.status(400).json({
        erro: "Ano inválido."
      });
    }

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
      ano,
      total: resultado.rows[0].total
    });
  } catch (error) {
    console.error(
      "Erro ao buscar total de interações por ano:",
      error
    );

    res.status(500).json({
      erro: "Erro ao buscar total de interações por ano.",
      detalhe: error.message
    });
  }
});

router.post(
  "/importar",
  upload.single("arquivo"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!req.file) {
        return res.status(400).json({
          erro: "Nenhum arquivo enviado."
        });
      }

      const workbook = XLSX.read(
        req.file.buffer,
        {
          type: "buffer"
        }
      );

      const nomeAba = workbook.SheetNames.find(
        (nome) =>
          normalizarTexto(nome) === "INTERACOES"
      );

      if (!nomeAba) {
        return res.status(400).json({
          erro: "A aba INTERAÇÕES não foi encontrada."
        });
      }

      const sheet = workbook.Sheets[nomeAba];

      const linhas = XLSX.utils.sheet_to_json(
        sheet,
        {
          defval: "",
          blankrows: false
        }
      );

      const meses = {
        JANEIRO: 1,
        FEVEREIRO: 2,
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

      let totalInserido = 0;
      let totalAtualizado = 0;
      let totalSemAlteracao = 0;
      let totalIgnorado = 0;

      await client.query("BEGIN");

      for (const linha of linhas) {
        const ano = Number(
          linha["ANO"] ??
          linha["Ano"] ??
          linha["ano"]
        );

        const mesOriginal =
          linha["MÊS"] ??
          linha["MES"] ??
          linha["Mês"] ??
          linha["Mes"] ??
          linha["mes"] ??
          "";

        const mesTexto =
          normalizarTexto(mesOriginal);

        let mes = meses[mesTexto];

        if (!mes) {
          const mesNumerico =
            Number(mesOriginal);

          if (
            Number.isInteger(mesNumerico) &&
            mesNumerico >= 1 &&
            mesNumerico <= 12
          ) {
            mes = mesNumerico;
          }
        }

        const quantidadeBruta =
          linha["QUANTIDADE"] ??
          linha["Quantidade"] ??
          linha["quantidade"];

        const quantidade =
          Number(quantidadeBruta);

        if (
          !Number.isInteger(ano) ||
          !mes ||
          !Number.isFinite(quantidade) ||
          quantidade < 0
        ) {
          totalIgnorado++;
          continue;
        }

        const existente = await client.query(
          `
          SELECT quantidade
          FROM interacoes_mensais
          WHERE ano = $1
            AND mes = $2
          `,
          [ano, mes]
        );

        if (existente.rows.length === 0) {
          await client.query(
            `
            INSERT INTO interacoes_mensais (
              ano,
              mes,
              quantidade
            )
            VALUES ($1, $2, $3)
            `,
            [ano, mes, quantidade]
          );

          totalInserido++;
          continue;
        }

        const quantidadeAtual =
          Number(existente.rows[0].quantidade);

        if (quantidadeAtual === quantidade) {
          totalSemAlteracao++;
          continue;
        }

        await client.query(
          `
          UPDATE interacoes_mensais
          SET quantidade = $3
          WHERE ano = $1
            AND mes = $2
          `,
          [ano, mes, quantidade]
        );

        totalAtualizado++;
      }

      await client.query("COMMIT");

      res.json({
        mensagem:
          "Interações importadas e atualizadas com sucesso.",
        totalProcessado:
          totalInserido +
          totalAtualizado +
          totalSemAlteracao,
        totalInserido,
        totalAtualizado,
        totalSemAlteracao,
        totalIgnorado
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (erroRollback) {
        console.error(
          "Erro ao desfazer importação de interações:",
          erroRollback
        );
      }

      console.error(
        "Erro ao importar interações:",
        error
      );

      res.status(500).json({
        erro: "Erro ao importar interações.",
        detalhe: error.message
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;