const express = require("express");
const router = express.Router();
const pool = require("../db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

function definirSecretaria(servico) {
  const regras = {

    "IPTU": "Finanças",
    "Parcelamento": "Finanças",
    "Dívida Ativa": "Finanças",

    "Limpeza Urbana": "SESURB",
    "Iluminação Pública": "SESURB",
    "Buraco na Rua": "SESURB",
    "Coleta de Lixo": "SESURB",

    "Saúde": "SESAP",
    "Consulta Médica": "SESAP",
    "Medicamento": "SESAP",
    "UPA": "SESAP",

    "Educação": "SEDUC",
    "Creche": "SEDUC",
    "Escola": "SEDUC",

    "Trânsito": "SETRANSP",
    "Sinalização": "SETRANSP",
    "Lombada": "SETRANSP",

    "Assistência Social": "SEAS",
    "Fiscalização": "FISCALIZAÇÃO",
    "Gabinete": "GABINETE"
  };

  return regras[servico] || "GABINETE";
}

function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const numero = Math.floor(Math.random() * 900000) + 100000;
  return `XAV-${ano}-${numero}`;
}

function montarFiltros(query) {
  const { bairro, secretaria, servico, status, nome } = query;

  const filtros = [];
  const valores = [];

  if (bairro) {
    valores.push(`%${bairro}%`);
    filtros.push(`bairro ILIKE $${valores.length}`);
  }

  if (secretaria) {
    valores.push(secretaria);
    filtros.push(`secretaria = $${valores.length}`);
  }

  if (servico) {
    valores.push(servico);
    filtros.push(`servico = $${valores.length}`);
  }

  if (status) {
    valores.push(status);
    filtros.push(`status = $${valores.length}`);
  }

  if (nome) {
    valores.push(`%${nome}%`);
    filtros.push(`nome ILIKE $${valores.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  return { where, valores };
}

router.post("/", async (req, res) => {
  try {
    const {
      nome,
      telefone,
      bairro,
      endereco,
      servico,
      descricao
    } = req.body;

    if (!nome || !servico || !descricao) {
      return res.status(400).json({
        erro: "Nome, serviço e descrição são obrigatórios."
      });
    }

    const secretaria = definirSecretaria(servico);
    const protocolo = gerarProtocolo();

    const resultado = await pool.query(
      `
      INSERT INTO demandas (
        protocolo,
        nome,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        descricao,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'RECEBIDA'
      )
      RETURNING *
      `,
      [
        protocolo,
        nome,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        descricao
      ]
    );

    res.status(201).json({
      mensagem: "Demanda cadastrada com sucesso.",
      demanda: resultado.rows[0]
    });
  } catch (error) {
    console.error("Erro ao cadastrar demanda:", error);
    res.status(500).json({
      erro: "Erro interno ao cadastrar demanda."
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { where, valores } = montarFiltros(req.query);

    const resultado = await pool.query(
      `
      SELECT *
      FROM demandas
      ${where}
      ORDER BY data_criacao DESC
      `,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error("ERRO COMPLETO:");
    console.error(error);
    res.status(500).json({
      erro: "Erro interno ao listar demandas."
    });
  }
});

router.get("/dashboard/resumo", async (req, res) => {
  try {
    const total = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas
    `);

    const resolvidas = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas
      WHERE status = 'RESOLVIDA'
    `);

    const pendentes = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas
      WHERE status <> 'RESOLVIDA'
    `);

    const totalSecretarias = await pool.query(`
      SELECT COUNT(DISTINCT secretaria)::int AS total
      FROM demandas
    `);

    const porSecretaria = await pool.query(`
      SELECT secretaria, COUNT(*)::int AS total
      FROM demandas
      GROUP BY secretaria
      ORDER BY total DESC
    `);

    const porBairro = await pool.query(`
      SELECT bairro, COUNT(*)::int AS total
      FROM demandas
      WHERE bairro IS NOT NULL AND bairro <> ''
      GROUP BY bairro
      ORDER BY total DESC
    `);

    const porStatus = await pool.query(`
      SELECT status, COUNT(*)::int AS total
      FROM demandas
      GROUP BY status
      ORDER BY total DESC
    `);

    res.json({
      total: total.rows[0].total,
      resolvidas: resolvidas.rows[0].total,
      pendentes: pendentes.rows[0].total,
      totalSecretarias: totalSecretarias.rows[0].total,
      porSecretaria: porSecretaria.rows,
      porBairro: porBairro.rows,
      porStatus: porStatus.rows
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    res.status(500).json({
      erro: "Erro interno ao carregar dashboard."
    });
  }
});

router.get("/exportar/excel", async (req, res) => {
  try {
    const { where, valores } = montarFiltros(req.query);

    const resultado = await pool.query(
      `
      SELECT
        protocolo,
        nome,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        status,
        descricao,
        data_criacao
      FROM demandas
      ${where}
      ORDER BY data_criacao DESC
      `,
      valores
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Demandas");

    worksheet.columns = [
      { header: "Protocolo", key: "protocolo", width: 24 },
      { header: "Nome", key: "nome", width: 28 },
      { header: "Telefone", key: "telefone", width: 18 },
      { header: "Bairro", key: "bairro", width: 20 },
      { header: "Endereço", key: "endereco", width: 35 },
      { header: "Serviço", key: "servico", width: 25 },
      { header: "Secretaria", key: "secretaria", width: 18 },
      { header: "Status", key: "status", width: 18 },
      { header: "Descrição", key: "descricao", width: 45 },
      { header: "Data de Criação", key: "data_criacao", width: 22 }
    ];

    resultado.rows.forEach((linha) => {
      worksheet.addRow({
        ...linha,
        data_criacao: linha.data_criacao
          ? new Date(linha.data_criacao).toLocaleString("pt-BR")
          : ""
      });
    });

    worksheet.getRow(1).font = {
      bold: true,
      color: { argb: "FFFFFFFF" }
    };

    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }
    };

    worksheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "center"
    };

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } }
        };
        cell.alignment = {
          vertical: "middle",
          wrapText: true
        };
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Demandas_Xavier_Online.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Erro ao exportar Excel:", error);
    res.status(500).json({
      erro: "Erro ao exportar Excel."
    });
  }
});

router.get("/exportar/pdf", async (req, res) => {
  try {
    const { where, valores } = montarFiltros(req.query);

    const resultado = await pool.query(
      `
      SELECT
        protocolo,
        nome,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        status,
        descricao,
        data_criacao
      FROM demandas
      ${where}
      ORDER BY data_criacao DESC
      `,
      valores
    );

    const total = resultado.rows.length;
    const resolvidas = resultado.rows.filter(item => item.status === "RESOLVIDA").length;
    const pendentes = resultado.rows.filter(item => item.status !== "RESOLVIDA").length;

    const doc = new PDFDocument({
      size: "A4",
      margin: 40
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Demandas_Xavier_Online.pdf"
    );

    doc.pipe(res);

    doc
      .fontSize(20)
      .fillColor("#0f172a")
      .text("XAVIER ONLINE", { align: "center" });

    doc
      .fontSize(13)
      .fillColor("#334155")
      .text("Relatório de Demandas", { align: "center" });

    doc.moveDown();

    doc
      .fontSize(9)
      .fillColor("#64748b")
      .text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, {
        align: "right"
      });

    doc.moveDown();

    doc
      .fontSize(11)
      .fillColor("#0f172a")
      .text(`Total de demandas: ${total}`)
      .text(`Resolvidas: ${resolvidas}`)
      .text(`Pendentes: ${pendentes}`);

    doc.moveDown();

    resultado.rows.forEach((item, index) => {
      if (doc.y > 720) {
        doc.addPage();
      }

      doc
        .fontSize(10)
        .fillColor("#0f172a")
        .text(`${index + 1}. ${item.protocolo || "-"} | ${item.nome || "-"}`, {
          underline: true
        });

      doc
        .fontSize(9)
        .fillColor("#334155")
        .text(`Telefone: ${item.telefone || "-"}`)
        .text(`Bairro: ${item.bairro || "-"} | Serviço: ${item.servico || "-"}`)
        .text(`Secretaria: ${item.secretaria || "-"} | Status: ${item.status || "-"}`)
        .text(`Endereço: ${item.endereco || "-"}`)
        .text(`Descrição: ${item.descricao || "-"}`);

      doc
        .fontSize(8)
        .fillColor("#64748b")
        .text(
          `Data: ${item.data_criacao
            ? new Date(item.data_criacao).toLocaleString("pt-BR")
            : "-"
          }`
        );

      doc.moveDown();
    });

    doc.end();

  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    res.status(500).json({
      erro: "Erro ao exportar PDF."
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nome,
      telefone,
      bairro,
      endereco,
      servico,
      secretaria,
      descricao,
      status
    } = req.body;

    if (!nome || !servico || !descricao) {
      return res.status(400).json({
        erro: "Nome, serviço e descrição são obrigatórios."
      });
    }

    const resultado = await pool.query(
      `
      UPDATE demandas
      SET
        nome = $1,
        telefone = $2,
        bairro = $3,
        endereco = $4,
        servico = $5,
        secretaria = $6,
        descricao = $7,
        status = $8
      WHERE id = $9
      RETURNING *
      `,
      [
        nome,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        descricao,
        status,
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Demanda não encontrada."
      });
    }

    res.json({
      mensagem: "Demanda atualizada com sucesso.",
      demanda: resultado.rows[0]
    });

  } catch (error) {
    console.error("Erro ao editar demanda:", error);
    res.status(500).json({
      erro: "Erro interno ao editar demanda."
    });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusPermitidos = [
      "RECEBIDA",
      "EM ANÁLISE",
      "ENCAMINHADA",
      "EM EXECUÇÃO",
      "RESOLVIDA"
    ];

    if (!statusPermitidos.includes(status)) {
      return res.status(400).json({
        erro: "Status inválido."
      });
    }

    const resultado = await pool.query(
      `
      UPDATE demandas
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Demanda não encontrada."
      });
    }

    res.json({
      mensagem: "Status atualizado com sucesso.",
      demanda: resultado.rows[0]
    });

  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    res.status(500).json({
      erro: "Erro interno ao atualizar status."
    });
  }
});

module.exports = router;