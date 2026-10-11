const express = require("express");
const router = express.Router();
const pool = require("../db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

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
      FROM (
        SELECT
          dg.id AS ordem_id,
          dg.protocolo,
          c.nome,
          c.telefone,
          COALESCE(c.bairro, dg.bairro) AS bairro,
          c.endereco,
          dg.assunto AS servico,
          dg.secretaria,
          dg.status,
          dg.descricao,
          COALESCE(dg.data, dg.criado_em) AS data_criacao
        FROM demandas_gabinete dg
        LEFT JOIN cidadaos c
          ON c.id = dg.cidadao_id
      ) demandas_exportacao
      ${where}
      ORDER BY
        NULLIF(BTRIM(protocolo), '') ASC NULLS LAST,
        data_criacao ASC NULLS LAST,
        ordem_id ASC
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
      "attachment; filename=Demandas_SDC.xlsx"
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
      FROM (
        SELECT
          dg.id AS ordem_id,
          dg.protocolo,
          c.nome,
          c.telefone,
          COALESCE(c.bairro, dg.bairro) AS bairro,
          c.endereco,
          dg.assunto AS servico,
          dg.secretaria,
          dg.status,
          dg.descricao,
          COALESCE(dg.data, dg.criado_em) AS data_criacao
        FROM demandas_gabinete dg
        LEFT JOIN cidadaos c
          ON c.id = dg.cidadao_id
      ) demandas_exportacao
      ${where}
      ORDER BY
        NULLIF(BTRIM(protocolo), '') ASC NULLS LAST,
        data_criacao ASC NULLS LAST,
        ordem_id ASC
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

    const geradoEm =
      new Date().toLocaleString("pt-BR");

    const desenharCabecalho = () => {
      const larguraPagina = doc.page.width;

      doc.save();

      doc
        .rect(0, 0, larguraPagina, 108)
        .fill("#0F2747");

      doc
        .rect(0, 104, larguraPagina, 4)
        .fill("#19A7CE");

      doc
        .font("Helvetica-Bold")
        .fontSize(21)
        .fillColor("#FFFFFF")
        .text(
          "SDC Serviços de Dados e Comunicação",
          40,
          27,
          {
            width: 300
          }
        );

      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#DCEAF7")
        .text(
          "SDC Serviços de Dados e Comunicação",
          40,
          56,
          {
            width: 320
          }
        );

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#FFFFFF")
        .text(
          "RELATÓRIO DE DEMANDAS",
          larguraPagina - 235,
          30,
          {
            width: 195,
            align: "right"
          }
        );

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#DCEAF7")
        .text(
          `Gerado em: ${geradoEm}`,
          larguraPagina - 235,
          57,
          {
            width: 195,
            align: "right"
          }
        );

      doc.restore();

      doc.x = 40;
      doc.y = 128;
    };

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Demandas_SDC.pdf"
    );

    doc.on(
      "pageAdded",
      desenharCabecalho
    );

    doc.pipe(res);

    desenharCabecalho();

    const larguraResumo =
      doc.page.width - 80;

    doc
      .roundedRect(
        40,
        128,
        larguraResumo,
        68,
        7
      )
      .fill("#EAF4FB");

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#0F2747")
      .text(
        "RESUMO EXECUTIVO",
        55,
        141
      );

    const larguraIndicador =
      larguraResumo / 3;

    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#0F2747")
      .text(
        String(total),
        55,
        161,
        {
          width: larguraIndicador - 20
        }
      );

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#52677D")
      .text(
        "TOTAL DE DEMANDAS",
        55,
        181,
        {
          width: larguraIndicador - 20
        }
      );

    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#16825D")
      .text(
        String(resolvidas),
        55 + larguraIndicador,
        161,
        {
          width: larguraIndicador - 20
        }
      );

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#52677D")
      .text(
        "RESOLVIDAS",
        55 + larguraIndicador,
        181,
        {
          width: larguraIndicador - 20
        }
      );

    doc
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#B45309")
      .text(
        String(pendentes),
        55 + larguraIndicador * 2,
        161,
        {
          width: larguraIndicador - 20
        }
      );

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#52677D")
      .text(
        "PENDENTES",
        55 + larguraIndicador * 2,
        181,
        {
          width: larguraIndicador - 20
        }
      );

    doc.x = 40;
    doc.y = 218;

    resultado.rows.forEach((item, index) => {
      if (doc.y > doc.page.height - 125) {
        doc.addPage();
      }

      const inicioRegistro = doc.y;

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#0F2747")
        .text(
          `${index + 1}. ${item.protocolo || "-"} | ${item.nome || "-"}`
        );

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#334155")
        .text(
          `Telefone: ${item.telefone || "-"}`
        )
        .text(
          `Bairro: ${item.bairro || "-"} | Serviço: ${item.servico || "-"}`
        )
        .text(
          `Secretaria: ${item.secretaria || "-"} | Status: ${item.status || "-"}`
        )
        .text(
          `Endereço: ${item.endereco || "-"}`
        )
        .text(
          `Descrição: ${item.descricao || "-"}`
        );

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#64748B")
        .text(
          `Data: ${
            item.data_criacao
              ? new Date(
                  item.data_criacao
                ).toLocaleString("pt-BR")
              : "-"
          }`
        );

      doc
        .moveTo(40, doc.y + 5)
        .lineTo(
          doc.page.width - 40,
          doc.y + 5
        )
        .lineWidth(0.5)
        .strokeColor("#D7E3ED")
        .stroke();

      doc.y += 13;

      if (doc.y <= inicioRegistro) {
        doc.y = inicioRegistro + 20;
      }
    });

    doc.end();

  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    res.status(500).json({
      erro: "Erro ao exportar PDF."
    });
  }
});

module.exports = router;
