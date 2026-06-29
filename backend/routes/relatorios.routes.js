const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function limpar(valor) {
  if (valor === undefined || valor === null) return null;
  return String(valor).trim();
}

function converterData(valor) {
  if (!valor) return null;

  if (typeof valor === "number") {
    const data = XLSX.SSF.parse_date_code(valor);
    if (!data) return null;

    return `${data.y}-${String(data.m).padStart(2, "0")}-${String(data.d).padStart(2, "0")}`;
  }

  const texto = String(valor).trim();

  if (texto.includes("/")) {
    const partes = texto.split("/");
    if (partes.length === 3) {
      const dia = partes[0].padStart(2, "0");
      const mes = partes[1].padStart(2, "0");
      const ano = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
      return `${ano}-${mes}-${dia}`;
    }
  }

  return null;
}

function localizarCampo(linha, nomes) {
  for (const nome of nomes) {
    const chave = Object.keys(linha).find(k =>
      k && k.toString().trim().toUpperCase() === nome.toUpperCase()
    );

    if (chave) return linha[chave];
  }

  return null;
}

router.post("/importar", upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhum arquivo enviado."
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: false
    });

    let totalImportado = 0;
    let totalIgnorado = 0;

    for (const nomeAba of workbook.SheetNames) {
      const sheet = workbook.Sheets[nomeAba];

      const linhas = XLSX.utils.sheet_to_json(sheet, {
        defval: null
      });

      for (const linha of linhas) {
        const nome = limpar(localizarCampo(linha, ["NOME", "MUNÍCIPE", "MUNICIPE"]));
        const telefone = limpar(localizarCampo(linha, ["TELEFONE", "CONTATO", "WHATSAPP"]));
        const endereco = limpar(localizarCampo(linha, ["ENDEREÇO", "ENDERECO"]));
        const bairro = limpar(localizarCampo(linha, ["BAIRRO"]));
        const demanda = limpar(localizarCampo(linha, ["DEMANDA", "SERVIÇO", "SERVICO", "SOLICITAÇÃO", "SOLICITACAO"]));
        const secretaria = limpar(localizarCampo(linha, ["SECRETARIA", "SETOR"]));
        const status = limpar(localizarCampo(linha, ["STATUS", "SITUAÇÃO", "SITUACAO"]));
        const contato = limpar(localizarCampo(linha, ["RESPONSÁVEL", "RESPONSAVEL", "ATENDENTE", "CONTATO"]));
        const dataBruta = localizarCampo(linha, ["DATA", "DATA DEMANDA", "DATA_DA_DEMANDA"]);

        const data_demanda = converterData(dataBruta);

        let ano = null;

        if (data_demanda) {
          const anoExtraido = Number(data_demanda.substring(0, 4));
          ano = Number.isNaN(anoExtraido) ? null : anoExtraido;
        } else {
          const matchAno = nomeAba.match(/\d{4}/);
          if (matchAno) {
            const anoAba = Number(matchAno[0]);
            ano = Number.isNaN(anoAba) ? null : anoAba;
          }
        }

        if (!nome && !bairro && !demanda && !secretaria) {
          totalIgnorado++;
          continue;
        }

        await pool.query(
          `
          INSERT INTO demandas_historicas (
            data_demanda,
            nome,
            telefone,
            endereco,
            bairro,
            demanda,
            secretaria,
            status,
            contato,
            origem,
            ano
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `,
          [
            data_demanda,
            nome,
            telefone,
            endereco,
            bairro,
            demanda,
            secretaria,
            status,
            contato,
            nomeAba,
            ano
          ]
        );

        totalImportado++;
      }
    }

    res.json({
      mensagem: "Importação concluída.",
      totalImportado,
      totalIgnorado
    });

  } catch (error) {
    console.error("Erro ao importar planilha:", error);
    res.status(500).json({
      erro: "Erro interno ao importar planilha."
    });
  }
});

router.post("/atividades/importar", upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        erro: "Nenhum arquivo enviado."
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: false
    });

    let totalImportado = 0;
    let totalIgnorado = 0;

    for (const nomeAba of workbook.SheetNames) {
      const sheet = workbook.Sheets[nomeAba];

      const linhas = XLSX.utils.sheet_to_json(sheet, {
        defval: null
      });

      for (const linha of linhas) {
        const dataBruta = localizarCampo(linha, ["DATA"]);
        const data_atividade = converterData(dataBruta);

        const propositura = limpar(localizarCampo(linha, ["PROPOSITURA"]));
        const secretaria = limpar(localizarCampo(linha, ["SECRETARIA"]));
        const bairro = limpar(localizarCampo(linha, ["BAIRRO"]));
        const secao_ordinaria = limpar(localizarCampo(linha, ["SEÇÃO ORDINÁRIA", "SECAO ORDINARIA"]));
        const numero = limpar(localizarCampo(linha, ["NUMERO", "NÚMERO"]));

        const ano = data_atividade
          ? Number(data_atividade.substring(0, 4))
          : 2026;

        if (!data_atividade && !propositura && !secretaria && !bairro) {
          totalIgnorado++;
          continue;
        }

        await pool.query(
          `
          INSERT INTO atividades_legislativas (
            data_atividade,
            propositura,
            secretaria,
            bairro,
            secao_ordinaria,
            numero,
            ano
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            data_atividade,
            propositura,
            secretaria,
            bairro,
            secao_ordinaria,
            numero,
            ano
          ]
        );

        totalImportado++;
      }
    }

    res.json({
      mensagem: "Importação de atividades legislativas concluída.",
      totalImportado,
      totalIgnorado
    });

  } catch (error) {
    console.error("Erro ao importar atividades legislativas:", error);
    res.status(500).json({
      erro: "Erro interno ao importar atividades legislativas."
    });
  }
});


module.exports = router;