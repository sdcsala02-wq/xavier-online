const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pegarValor(linha, nomes) {
  for (const nome of nomes) {
    if (linha[nome] !== undefined && linha[nome] !== null && linha[nome] !== "") {
      return linha[nome];
    }
  }
  return "";
}

function converterData(valor) {
  if (!valor) return null;

  if (valor instanceof Date) {
    return valor.toISOString().split("T")[0];
  }

  if (typeof valor === "number") {
    const data = XLSX.SSF.parse_date_code(valor);
    if (!data) return null;

    const ano = data.y;
    const mes = String(data.m).padStart(2, "0");
    const dia = String(data.d).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
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

function converterHora(valor) {
  if (!valor) return null;

  if (valor instanceof Date) {
    return valor.toTimeString().slice(0, 8);
  }

  if (typeof valor === "number") {
    const totalSegundos = Math.round(valor * 24 * 60 * 60);
    const horas = String(Math.floor(totalSegundos / 3600)).padStart(2, "0");
    const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0");
    const segundos = String(totalSegundos % 60).padStart(2, "0");
    return `${horas}:${minutos}:${segundos}`;
  }

  const texto = String(valor).trim();

  if (/^\d{1,2}:\d{2}/.test(texto)) {
    return texto.length === 5 ? `${texto}:00` : texto;
  }

  return null;
}

function obterMesNome(dataISO) {
  if (!dataISO) return null;

  const meses = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO"
  ];

  const mes = Number(dataISO.split("-")[1]);
  return meses[mes - 1] || null;
}

router.get("/resumo", async (req, res) => {
  try {
    const total = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas_gabinete
    `);

    const resolvidas = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE UPPER(status) IN ('CONCLUÍDO', 'CONCLUIDO', 'RESOLVIDA')
    `);

    const pendentes = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE UPPER(status) IN ('PENDENTE', 'EM ANDAMENTO')
    `);

    const secretarias = await pool.query(`
      SELECT COUNT(DISTINCT secretaria)::int AS total
      FROM demandas_gabinete
      WHERE secretaria IS NOT NULL
        AND TRIM(secretaria) <> ''
    `);

    const cidadaos = await pool.query(`
      SELECT COUNT(DISTINCT cidadao_id)::int AS total
      FROM demandas_gabinete
      WHERE cidadao_id IS NOT NULL
    `);

    const bairros = await pool.query(`
      SELECT COUNT(DISTINCT c.bairro)::int AS total
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c ON c.id = dg.cidadao_id
      WHERE c.bairro IS NOT NULL
        AND TRIM(c.bairro) <> ''
        AND c.bairro NOT IN ('Não Informado', 'Outro Município')
    `);

    const telefones = await pool.query(`
      SELECT COUNT(DISTINCT c.telefone)::int AS total
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c ON c.id = dg.cidadao_id
      WHERE c.telefone IS NOT NULL
        AND TRIM(c.telefone) <> ''
    `);

    const porSecretaria = await pool.query(`
      SELECT secretaria, COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE secretaria IS NOT NULL
        AND TRIM(secretaria) <> ''
      GROUP BY secretaria
      ORDER BY total DESC
      LIMIT 10
    `);

    const porStatus = await pool.query(`
      SELECT status, COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE status IS NOT NULL
        AND TRIM(status) <> ''
      GROUP BY status
      ORDER BY total DESC
    `);

    const topBairros = await pool.query(`
      SELECT c.bairro, COUNT(*)::int AS total
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c ON c.id = dg.cidadao_id
      WHERE c.bairro IS NOT NULL
        AND TRIM(c.bairro) <> ''
        AND c.bairro NOT IN ('Não Informado', 'Outro Município')
      GROUP BY c.bairro
      ORDER BY total DESC
      LIMIT 10
    `);

    const evolucaoMensal = await pool.query(`
      SELECT 
        ano,
        mes,
        COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE ano IS NOT NULL
        AND mes IS NOT NULL
        AND TRIM(mes) <> ''
      GROUP BY ano, mes
      ORDER BY ano,
        CASE UPPER(mes)
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
          ELSE 13
        END
    `);

    const evolucaoAnual = await pool.query(`
      SELECT ano, COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE ano IS NOT NULL
      GROUP BY ano
      ORDER BY ano
    `);

    const mesAtual = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
    `);

    const secretariaMaisAcionada = await pool.query(`
      SELECT secretaria, COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE secretaria IS NOT NULL
        AND TRIM(secretaria) <> ''
      GROUP BY secretaria
      ORDER BY total DESC
      LIMIT 1
    `);

    res.json({
      total: total.rows[0].total,
      resolvidas: resolvidas.rows[0].total,
      pendentes: pendentes.rows[0].total,
      totalSecretarias: secretarias.rows[0].total,
      totalCidadaos: cidadaos.rows[0].total,
      totalBairros: bairros.rows[0].total,
      totalTelefones: telefones.rows[0].total,
      demandasMesAtual: mesAtual.rows[0].total,
      secretariaMaisAcionada: secretariaMaisAcionada.rows[0] || null,
      porSecretaria: porSecretaria.rows,
      porStatus: porStatus.rows,
      topBairros: topBairros.rows,
      evolucaoMensal: evolucaoMensal.rows,
      evolucaoAnual: evolucaoAnual.rows
    });

  } catch (error) {
    console.error("Erro no resumo do gabinete:", error);
    res.status(500).json({
      erro: "Erro ao carregar resumo do gabinete.",
      detalhe: error.message
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      busca,
      bairro,
      secretaria,
      status,
      ano,
      mes
    } = req.query;

    const filtros = [];
    const valores = [];

    if (busca) {
      valores.push(`%${busca}%`);
      filtros.push(`
        (
          c.nome ILIKE $${valores.length}
          OR c.telefone ILIKE $${valores.length}
          OR c.bairro ILIKE $${valores.length}
          OR dg.demanda ILIKE $${valores.length}
          OR dg.secretaria ILIKE $${valores.length}
          OR dg.status ILIKE $${valores.length}
        )
      `);
    }

    if (bairro) {
      valores.push(`%${bairro}%`);
      filtros.push(`c.bairro ILIKE $${valores.length}`);
    }

    if (secretaria) {
      valores.push(`%${secretaria}%`);
      filtros.push(`dg.secretaria ILIKE $${valores.length}`);
    }

    if (status) {
      valores.push(`%${status}%`);
      filtros.push(`dg.status ILIKE $${valores.length}`);
    }

    if (ano) {
      valores.push(Number(ano));
      filtros.push(`dg.ano = $${valores.length}`);
    }

    if (mes) {
      valores.push(`%${mes}%`);
      filtros.push(`dg.mes ILIKE $${valores.length}`);
    }

    const where = filtros.length
      ? `WHERE ${filtros.join(" AND ")}`
      : "";

    const resultado = await pool.query(
      `
      SELECT 
        dg.*,
        c.nome,
        c.telefone,
        c.bairro,
        c.endereco,
        c.cep,
        c.cidade
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c ON c.id = dg.cidadao_id
      ${where}
      ORDER BY dg.data DESC NULLS LAST, dg.id DESC
      LIMIT 500
      `,
      valores
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error("Erro ao filtrar demandas gabinete:", error);
    res.status(500).json({
      erro: "Erro ao filtrar demandas do gabinete.",
      detalhe: error.message
    });
  }
});

router.post("/importar", upload.single("arquivo"), async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    const hashArquivo = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    const jaImportado = await client.query(
      "SELECT lote FROM importacoes_gabinete WHERE hash_arquivo = $1",
      [hashArquivo]
    );

    if (jaImportado.rows.length > 0) {
      return res.status(409).json({
        erro: "Este arquivo já foi importado anteriormente.",
        lote: jaImportado.rows[0].lote
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true
    });

    const lote = `LOTE-GAB-${Date.now()}`;

    let totalImportado = 0;
    let totalIgnorado = 0;

    await client.query("BEGIN");

    for (const nomeAba of workbook.SheetNames) {
      const abaNormalizada = normalizarTexto(nomeAba);

      let anoFixo = null;

      if (abaNormalizada === "DEMANDAS 2025") {
        anoFixo = 2025;
      } else if (abaNormalizada === "2026") {
        anoFixo = 2026;
      } else {
        continue;
      }

      const sheet = workbook.Sheets[nomeAba];
      const linhas = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        range: 0,
        blankrows: false
      });

      for (const linha of linhas) {
        const nome = pegarValor(linha, ["NOME", "Nome", "nome"]);
        const telefone = pegarValor(linha, ["TELEFONE", "Telefone", "telefone"]);
        const endereco = pegarValor(linha, ["ENDEREÇO", "ENDERECO", "Endereço", "Endereco", "endereco"]);
        const bairro = pegarValor(linha, ["BAIRRO", "Bairro", "bairro"]);
        const cep = pegarValor(linha, ["CEP", "Cep", "cep"]);
        const cidade = pegarValor(linha, ["CIDADE", "Cidade", "cidade"]);
        const sexo = pegarValor(linha, ["SEXO", "Sexo", "sexo"]);
        const idade = Number(pegarValor(linha, ["IDADE", "Idade", "idade"])) || null;
        const nascimento = converterData(pegarValor(linha, ["NASC.", "NASC", "Nascimento"]));
        const cpf = pegarValor(linha, ["CPF:", "CPF", "Cpf", "cpf"]);
        const rg = pegarValor(linha, ["RG", "Rg", "rg"]);
        const titulo = pegarValor(linha, ["TÍTULO", "TITULO", "Título", "Titulo"]);
        const nomeMae = pegarValor(linha, ["NOME DA MÃE", "NOME DA MAE", "Nome da mãe"]);
        const nomePai = pegarValor(linha, ["NOME DO PAI", "Nome do pai"]);
        const recado = pegarValor(linha, ["RECADO", "Recado", "recado"]);
        const email = pegarValor(linha, ["E-MAIL", "EMAIL", "Email", "email"]);
        const complemento = pegarValor(linha, ["COMPLEMENTO", "COMPLE\nMENTO", "Complemento"]);

        const data = converterData(pegarValor(linha, ["DATA", "Data", "data"]));
        const hora = converterHora(pegarValor(linha, ["HORA", "Hora", "hora"]));
        const demanda = pegarValor(linha, ["DEMANDA", "Demanda", "demanda"]);
        const infOrigem = pegarValor(linha, ["INF. DE ORIGEM", "INF DE ORIGEM", "Inf. de Origem"]);
        const orientador = pegarValor(linha, ["ORIENTADOR", "Orientador", "orientador"]);
        const secretaria = pegarValor(linha, ["SECRETARIA", "Secretaria", "secretaria"]);
        const status = pegarValor(linha, ["STATUS", "Status", "status"]);
        const contato = pegarValor(linha, ["CONTATO", "Contato", "contato"]);
        const acao = pegarValor(linha, ["AÇÃO", "ACAO", "Ação", "Acao"]);
        const resposta = pegarValor(linha, ["RESPOSTA", "Resposta", "resposta"]);
        const codigoOrigem = pegarValor(linha, ["CÓD", "COD", "Código", "Codigo"]);

        if (!data && !hora && !nome && !telefone && !demanda && !secretaria) {
          totalIgnorado++;
          continue;
        }
        const cidadaoInsert = await client.query(
          `
          INSERT INTO cidadaos (
            nome, sexo, idade, data_nascimento, cpf, rg, titulo,
            nome_mae, nome_pai, telefone, recado, email,
            endereco, complemento, bairro, cep, cidade, lote_importacao
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,
            $13,$14,$15,$16,$17,$18
          )
          RETURNING id
          `,
          [
            nome,
            sexo,
            idade,
            nascimento,
            cpf,
            rg,
            titulo,
            nomeMae,
            nomePai,
            telefone,
            recado,
            email,
            endereco,
            complemento,
            bairro,
            cep,
            cidade,
            lote
          ]
        );

        const cidadaoId = cidadaoInsert.rows[0].id;
        const ano = data ? Number(data.substring(0, 4)) : anoFixo;
        const mes = obterMesNome(data);

        await client.query(
          `
          INSERT INTO demandas_gabinete (
            cidadao_id,
            codigo_origem,
            data,
            hora,
            ano,
            mes,
            demanda,
            inf_origem,
            orientador,
            secretaria,
            status,
            acao,
            resposta,
            observacao,
            lote_importacao
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,
            $7,$8,$9,$10,$11,
            $12,$13,$14,$15
          )
          `,
          [
            cidadaoId,
            codigoOrigem,
            data,
            hora,
            ano,
            mes,
            demanda,
            infOrigem,
            orientador,
            secretaria,
            status,
            acao,
            resposta,
            contato,
            lote
          ]
        );

        totalImportado++;
      }
    }

    await client.query(
      `
      INSERT INTO importacoes_gabinete (
        lote,
        nome_arquivo,
        tipo_importacao,
        hash_arquivo,
        total_cidadaos,
        total_demandas
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        lote,
        req.file.originalname,
        "DEMANDAS_GABINETE",
        hashArquivo,
        totalImportado,
        totalImportado
      ]
    );

    await client.query("COMMIT");

    res.json({
      mensagem: "Importação concluída.",
      lote,
      totalImportado,
      totalIgnorado
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Erro ao importar demandas gabinete:", error);

    res.status(500).json({
      erro: "Erro ao importar demandas do gabinete.",
      detalhe: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;