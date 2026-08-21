const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const pool = require("../db");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

const MESES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function nomeMes(mes) {
  return MESES[Number(mes)] || `Mês ${mes}`;
}

function criarErroStatus(mensagem, status = 400) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function interpretarAno(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  const ano = Number(valor);

  if (
    !Number.isInteger(ano) ||
    ano < 2000 ||
    ano > 2100
  ) {
    throw criarErroStatus("Ano inválido.");
  }

  return ano;
}

function interpretarMes(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  const numero = Number(valor);

  if (
    Number.isInteger(numero) &&
    numero >= 1 &&
    numero <= 12
  ) {
    return numero;
  }

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

  const mes = meses[normalizarTexto(valor)];

  if (!mes) {
    throw criarErroStatus("Mês inválido.");
  }

  return mes;
}

function montarFiltro(req) {
  const ano = interpretarAno(req.query.ano);
  const mes = interpretarMes(req.query.mes);

  const clausulas = [];
  const parametros = [];

  if (ano !== null) {
    parametros.push(ano);
    clausulas.push(`ano = $${parametros.length}`);
  }

  if (mes !== null) {
    parametros.push(mes);
    clausulas.push(`mes = $${parametros.length}`);
  }

  return {
    ano,
    mes,
    parametros,
    where:
      clausulas.length > 0
        ? `WHERE ${clausulas.join(" AND ")}`
        : ""
  };
}

async function buscarInteracoes(req) {
  const filtro = montarFiltro(req);

  const resultado = await pool.query(
    `
    SELECT
      ano,
      mes,
      quantidade::int AS quantidade
    FROM interacoes_mensais
    ${filtro.where}
    ORDER BY ano DESC, mes ASC
    `,
    filtro.parametros
  );

  return {
    filtro,
    rows: resultado.rows.map((item) => ({
      ano: Number(item.ano),
      mes: Number(item.mes),
      mesNome: nomeMes(item.mes),
      quantidade: Number(item.quantidade)
    }))
  };
}

router.get("/", async (req, res) => {
  try {
    const { rows } = await buscarInteracoes(req);

    res.json(rows);
  } catch (error) {
    console.error(
      "Erro ao buscar interações:",
      error
    );

    res.status(error.status || 500).json({
      erro:
        error.status
          ? error.message
          : "Erro ao buscar interações."
    });
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const filtro = montarFiltro(req);

    const totaisPorAno = await pool.query(
      `
      SELECT
        ano,
        COALESCE(SUM(quantidade), 0)::int AS total
      FROM interacoes_mensais
      ${filtro.where}
      GROUP BY ano
      ORDER BY ano
      `,
      filtro.parametros
    );

    const totalGeral = await pool.query(
      `
      SELECT
        COALESCE(SUM(quantidade), 0)::int AS total
      FROM interacoes_mensais
      ${filtro.where}
      `,
      filtro.parametros
    );

    const anos = await pool.query(`
      SELECT DISTINCT ano
      FROM interacoes_mensais
      WHERE ano IS NOT NULL
      ORDER BY ano
    `);

    res.json({
      total: Number(totalGeral.rows[0].total),
      porAno: totaisPorAno.rows.map((item) => ({
        ano: Number(item.ano),
        total: Number(item.total)
      })),
      anosDisponiveis: anos.rows.map(
        (item) => Number(item.ano)
      ),
      filtros: {
        ano: filtro.ano,
        mes: filtro.mes
      }
    });
  } catch (error) {
    console.error(
      "Erro ao buscar resumo de interações:",
      error
    );

    res.status(error.status || 500).json({
      erro:
        error.status
          ? error.message
          : "Erro ao buscar resumo de interações."
    });
  }
});

router.get("/mensal", async (req, res) => {
  try {
    const { rows } = await buscarInteracoes(req);

    res.json(rows);
  } catch (error) {
    console.error(
      "Erro ao buscar interações mensais:",
      error
    );

    res.status(error.status || 500).json({
      erro:
        error.status
          ? error.message
          : "Erro ao buscar interações mensais."
    });
  }
});

router.get("/total/:ano", async (req, res) => {
  try {
    const ano = interpretarAno(req.params.ano);

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
      total: Number(resultado.rows[0].total)
    });
  } catch (error) {
    console.error(
      "Erro ao buscar total por ano:",
      error
    );

    res.status(error.status || 500).json({
      erro:
        error.status
          ? error.message
          : "Erro ao buscar total de interações."
    });
  }
});

router.get("/exportar/excel", async (req, res) => {
  try {
    const { filtro, rows } =
      await buscarInteracoes(req);

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Xavier Online";
    workbook.created = new Date();

    const sheet =
      workbook.addWorksheet("Interações");

    sheet.columns = [
      {
        header: "Ano",
        key: "ano",
        width: 12
      },
      {
        header: "Mês",
        key: "mesNome",
        width: 20
      },
      {
        header: "Quantidade",
        key: "quantidade",
        width: 18
      }
    ];

    rows.forEach((item) => {
      sheet.addRow(item);
    });

    const total = rows.reduce(
      (soma, item) =>
        soma + Number(item.quantidade || 0),
      0
    );

    sheet.addRow({});
    sheet.addRow({
      mesNome: "TOTAL",
      quantidade: total
    });

    sheet.getRow(1).font = {
      bold: true
    };

    sheet.views = [
      {
        state: "frozen",
        ySplit: 1
      }
    ];

    sheet.autoFilter = {
      from: "A1",
      to: "C1"
    };

    const filtros = workbook.addWorksheet(
      "Critérios"
    );

    filtros.addRows([
      ["Relatório", "Interações do Gabinete"],
      [
        "Gerado em",
        new Date().toLocaleString("pt-BR")
      ],
      [
        "Ano",
        filtro.ano || "Todos"
      ],
      [
        "Mês",
        filtro.mes
          ? nomeMes(filtro.mes)
          : "Todos"
      ],
      [
        "Total de interações",
        total
      ]
    ]);

    filtros.getColumn(1).width = 24;
    filtros.getColumn(2).width = 30;

    const data =
      new Date().toISOString().slice(0, 10);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="interacoes-xavier-online-${data}.xlsx"`
    );

    await workbook.xlsx.write(res);

    res.end();
  } catch (error) {
    console.error(
      "Erro ao exportar interações em Excel:",
      error
    );

    if (!res.headersSent) {
      res.status(error.status || 500).json({
        erro:
          error.status
            ? error.message
            : "Erro ao gerar Excel."
      });
    }
  }
});

router.get("/exportar/pdf", async (req, res) => {
  try {
    const { filtro, rows } =
      await buscarInteracoes(req);

    const data =
      new Date().toISOString().slice(0, 10);

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="interacoes-xavier-online-${data}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 45
    });

    doc.pipe(res);

    doc
      .fontSize(18)
      .text("Xavier Online", {
        align: "center"
      });

    doc
      .fontSize(14)
      .text(
        "Relatório de Interações do Gabinete",
        {
          align: "center"
        }
      );

    doc.moveDown();

    doc
      .fontSize(9)
      .text(
        `Gerado em: ${new Date().toLocaleString(
          "pt-BR"
        )}`
      );

    doc.text(
      `Ano: ${filtro.ano || "Todos"}`
    );

    doc.text(
      `Mês: ${
        filtro.mes
          ? nomeMes(filtro.mes)
          : "Todos"
      }`
    );

    doc.moveDown();

    const total = rows.reduce(
      (soma, item) =>
        soma + Number(item.quantidade || 0),
      0
    );

    doc
      .fontSize(11)
      .text(
        `Total de interações: ${total}`,
        {
          underline: true
        }
      );

    doc.moveDown();

    doc.fontSize(10);

    rows.forEach((item) => {
      if (doc.y > 740) {
        doc.addPage();
      }

      doc.text(
        `${item.ano} | ${item.mesNome} | ${item.quantidade} interações`
      );
    });

    if (rows.length === 0) {
      doc.text(
        "Nenhum registro encontrado para os filtros informados."
      );
    }

    doc.end();
  } catch (error) {
    console.error(
      "Erro ao exportar interações em PDF:",
      error
    );

    if (!res.headersSent) {
      res.status(error.status || 500).json({
        erro:
          error.status
            ? error.message
            : "Erro ao gerar PDF."
      });
    }
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
          erro:
            "A aba INTERAÇÕES não foi encontrada."
        });
      }

      const sheet =
        workbook.Sheets[nomeAba];

      const linhas =
        XLSX.utils.sheet_to_json(
          sheet,
          {
            defval: "",
            blankrows: false
          }
        );

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

        let mes = null;

        try {
          mes = interpretarMes(mesOriginal);
        } catch {
          mes = null;
        }

        const quantidade = Number(
          linha["QUANTIDADE"] ??
          linha["Quantidade"] ??
          linha["quantidade"]
        );

        if (
          !Number.isInteger(ano) ||
          ano < 2000 ||
          ano > 2100 ||
          !mes ||
          !Number.isInteger(quantidade) ||
          quantidade < 0
        ) {
          totalIgnorado++;
          continue;
        }

        const existente =
          await client.query(
            `
            SELECT quantidade
            FROM interacoes_mensais
            WHERE ano = $1
              AND mes = $2
            `,
            [ano, mes]
          );

        if (
          existente.rows.length === 0
        ) {
          await client.query(
            `
            INSERT INTO interacoes_mensais (
              ano,
              mes,
              quantidade
            )
            VALUES ($1, $2, $3)
            `,
            [
              ano,
              mes,
              quantidade
            ]
          );

          totalInserido++;
          continue;
        }

        const quantidadeAtual =
          Number(
            existente.rows[0].quantidade
          );

        if (
          quantidadeAtual === quantidade
        ) {
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
          [
            ano,
            mes,
            quantidade
          ]
        );

        totalAtualizado++;
      }

      await client.query("COMMIT");

      res.json({
        mensagem:
          "Interações importadas com sucesso.",
        arquivo:
          req.file.originalname,
        totalLinhas:
          linhas.length,
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
        await client.query(
          "ROLLBACK"
        );
      } catch (erroRollback) {
        console.error(
          "Erro no rollback:",
          erroRollback
        );
      }

      console.error(
        "Erro ao importar interações:",
        error
      );

      res.status(500).json({
        erro:
          "Erro ao importar interações.",
        detalhe: error.message
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;