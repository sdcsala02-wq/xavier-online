const path = require("path");
const multer = require("multer");
const ExcelJS = require("exceljs");

const LIMITE_ARQUIVO = 15 * 1024 * 1024;
const LIMITE_ABAS = 50;
const LIMITE_LINHAS = 50000;
const LIMITE_COLUNAS = 100;

function erroValidacao(mensagem) {
  const erro = new Error(mensagem);
  erro.status = 400;
  return erro;
}

function criarUploadXlsx() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: LIMITE_ARQUIVO,
      files: 1
    },
    fileFilter: (req, arquivo, callback) => {
      const extensao = path
        .extname(arquivo.originalname || "")
        .toLowerCase();

      if (extensao !== ".xlsx") {
        return callback(
          erroValidacao(
            "Formato inválido. Envie somente arquivo .xlsx."
          )
        );
      }

      callback(null, true);
    }
  });
}

function obterValorCelula(celula) {
  const valor = celula?.value;

  if (valor === null || valor === undefined) {
    return null;
  }

  if (valor instanceof Date) {
    return valor;
  }

  if (typeof valor !== "object") {
    return valor;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      valor,
      "result"
    )
  ) {
    return valor.result ?? null;
  }

  if (Array.isArray(valor.richText)) {
    return valor.richText
      .map((parte) => parte.text || "")
      .join("");
  }

  if (
    Object.prototype.hasOwnProperty.call(
      valor,
      "text"
    )
  ) {
    return valor.text ?? null;
  }

  return String(celula.text || "").trim() || null;
}

async function carregarPlanilhaXlsx(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw erroValidacao(
      "O arquivo Excel está vazio ou é inválido."
    );
  }

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw erroValidacao(
      "Não foi possível ler o arquivo .xlsx. Verifique se ele não está corrompido."
    );
  }

  if (workbook.worksheets.length === 0) {
    throw erroValidacao(
      "A planilha não contém abas para importar."
    );
  }

  if (workbook.worksheets.length > LIMITE_ABAS) {
    throw erroValidacao(
      `A planilha excede o limite de ${LIMITE_ABAS} abas.`
    );
  }

  return workbook;
}

function planilhaParaObjetos(
  worksheet,
  {
    defval = "",
    blankrows = false
  } = {}
) {
  if (worksheet.rowCount > LIMITE_LINHAS + 1) {
    throw erroValidacao(
      `A aba ${worksheet.name} excede o limite de ${LIMITE_LINHAS} linhas.`
    );
  }

  if (worksheet.columnCount > LIMITE_COLUNAS) {
    throw erroValidacao(
      `A aba ${worksheet.name} excede o limite de ${LIMITE_COLUNAS} colunas.`
    );
  }

  const cabecalhos = [];
  const repeticoes = new Map();
  const linhaCabecalho = worksheet.getRow(1);

  for (
    let coluna = 1;
    coluna <= worksheet.columnCount;
    coluna++
  ) {
    const original = String(
      obterValorCelula(
        linhaCabecalho.getCell(coluna)
      ) ?? ""
    ).trim();

    if (!original) {
      cabecalhos[coluna] = null;
      continue;
    }

    const quantidade =
      repeticoes.get(original) || 0;

    repeticoes.set(
      original,
      quantidade + 1
    );

    cabecalhos[coluna] = quantidade
      ? `${original}_${quantidade}`
      : original;
  }

  const resultado = [];

  for (
    let numero = 2;
    numero <= worksheet.rowCount;
    numero++
  ) {
    const linha = worksheet.getRow(numero);
    const objeto = {};
    let possuiConteudo = false;

    for (
      let coluna = 1;
      coluna < cabecalhos.length;
      coluna++
    ) {
      const cabecalho = cabecalhos[coluna];

      if (!cabecalho) {
        continue;
      }

      const valor = obterValorCelula(
        linha.getCell(coluna)
      );

      const vazio =
        valor === null ||
        valor === undefined ||
        String(valor).trim() === "";

      objeto[cabecalho] =
        vazio ? defval : valor;

      if (!vazio) {
        possuiConteudo = true;
      }
    }

    if (possuiConteudo || blankrows) {
      resultado.push(objeto);
    }
  }

  return resultado;
}

function converterDataSerialExcel(valor) {
  if (!Number.isFinite(valor)) {
    return null;
  }

  const milissegundos =
    Date.UTC(1899, 11, 30) +
    Math.floor(valor) *
      24 *
      60 *
      60 *
      1000;

  const data = new Date(milissegundos);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return [
    String(data.getUTCFullYear())
      .padStart(4, "0"),
    String(data.getUTCMonth() + 1)
      .padStart(2, "0"),
    String(data.getUTCDate())
      .padStart(2, "0")
  ].join("-");
}

module.exports = {
  carregarPlanilhaXlsx,
  converterDataSerialExcel,
  criarUploadXlsx,
  planilhaParaObjetos
};