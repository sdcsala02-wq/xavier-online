const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const TAMANHO_LOTE_CIDADAOS = 300;
const TAMANHO_LOTE_DEMANDAS = 300;

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function limparTelefone(valor) {
  return String(valor ?? "")
    .replace(/\D/g, "")
    .trim();
}

function limitarTexto(valor, limite) {
  const texto = String(valor ?? "").trim();

  if (!texto) {
    return null;
  }

  return texto.slice(0, limite);
}

function dividirEmLotes(lista, tamanho) {
  const lotes = [];

  for (
    let indice = 0;
    indice < lista.length;
    indice += tamanho
  ) {
    lotes.push(
      lista.slice(
        indice,
        indice + tamanho
      )
    );
  }

  return lotes;
}

function normalizarCabecalhosLinha(linha) {
  const resultado = {};

  for (const [cabecalho, valor] of Object.entries(linha)) {
    const chave = normalizarTexto(cabecalho)
      .replace(/\./g, "")
      .replace(/:/g, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    resultado[chave] = valor;
  }

  return resultado;
}

function pegarCampo(linha, nomes) {
  for (const nome of nomes) {
    const chave = normalizarTexto(nome)
      .replace(/\./g, "")
      .replace(/:/g, "")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const valor = linha[chave];

    if (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ""
    ) {
      return valor;
    }
  }

  return "";
}

function converterData(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(
      valor.getMonth() + 1
    ).padStart(2, "0");
    const dia = String(
      valor.getDate()
    ).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  }

  if (typeof valor === "number") {
    const data = XLSX.SSF.parse_date_code(valor);

    if (!data) {
      return null;
    }

    return [
      String(data.y).padStart(4, "0"),
      String(data.m).padStart(2, "0"),
      String(data.d).padStart(2, "0")
    ].join("-");
  }

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const formatoBrasileiro = texto.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/
  );

  if (formatoBrasileiro) {
    const dia = formatoBrasileiro[1]
      .padStart(2, "0");

    const mes = formatoBrasileiro[2]
      .padStart(2, "0");

    let ano = formatoBrasileiro[3];

    if (ano.length === 2) {
      ano = `20${ano}`;
    }

    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

function converterHora(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  if (valor instanceof Date) {
    return [
      String(valor.getHours()).padStart(2, "0"),
      String(valor.getMinutes()).padStart(2, "0"),
      String(valor.getSeconds()).padStart(2, "0")
    ].join(":");
  }

  if (typeof valor === "number") {
    const totalSegundos =
      Math.round(valor * 86400) % 86400;

    const horas = Math.floor(
      totalSegundos / 3600
    );

    const minutos = Math.floor(
      (totalSegundos % 3600) / 60
    );

    const segundos =
      totalSegundos % 60;

    return [
      String(horas).padStart(2, "0"),
      String(minutos).padStart(2, "0"),
      String(segundos).padStart(2, "0")
    ].join(":");
  }

  const texto = String(valor).trim();

  const correspondencia = texto.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!correspondencia) {
    return null;
  }

  return [
    correspondencia[1].padStart(2, "0"),
    correspondencia[2],
    correspondencia[3] || "00"
  ].join(":");
}

function obterAnoDaAba(nomeAba) {
  const nomeNormalizado =
    normalizarTexto(nomeAba);

  if (
    nomeNormalizado === "DEMANDAS 2025" ||
    nomeNormalizado === "2025"
  ) {
    return 2025;
  }

  if (
    nomeNormalizado === "DEMANDAS 2026" ||
    nomeNormalizado === "2026"
  ) {
    return 2026;
  }

  return null;
}

function linhaEstaVazia(dados) {
  return ![
    dados.data,
    dados.hora,
    dados.nome,
    dados.telefone,
    dados.endereco,
    dados.bairro,
    dados.demanda,
    dados.secretaria,
    dados.status,
    dados.orientador,
    dados.codigoOrigem
  ].some((valor) => {
    return (
      valor !== undefined &&
      valor !== null &&
      String(valor).trim() !== ""
    );
  });
}

function valorParaHash(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return "";
  }

  return normalizarTexto(valor);
}

function gerarHashRegistro(dados) {
  const conteudo = [
    valorParaHash(dados.data),
    valorParaHash(dados.hora),
    valorParaHash(dados.nome),
    valorParaHash(dados.telefoneLimpo),
    valorParaHash(dados.endereco),
    valorParaHash(dados.bairro),
    valorParaHash(dados.demanda),
    valorParaHash(dados.secretaria),
    valorParaHash(dados.status),
    valorParaHash(dados.orientador),
    valorParaHash(dados.codigoOrigem)
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(conteudo)
    .digest("hex");
}

function gerarChaveCidadao(dados) {
  if (dados.telefoneLimpo) {
    return `TELEFONE:${dados.telefoneLimpo}`;
  }

  const nome = normalizarTexto(dados.nome);
  const endereco = normalizarTexto(dados.endereco);
  const bairro = normalizarTexto(dados.bairro);

  return [
    "SEM_TELEFONE",
    nome,
    endereco,
    bairro
  ].join("|");
}

function montarObservacoesCidadao(dados) {
  return [
    "Importado da planilha Demandas do Gabinete",

    dados.nascimento
      ? `Nascimento: ${dados.nascimento}`
      : null,

    dados.cpf
      ? `CPF: ${dados.cpf}`
      : null,

    dados.rg
      ? `RG: ${dados.rg}`
      : null,

    dados.titulo
      ? `Título: ${dados.titulo}`
      : null,

    dados.nomeMae
      ? `Nome da mãe: ${dados.nomeMae}`
      : null,

    dados.nomePai
      ? `Nome do pai: ${dados.nomePai}`
      : null,

    dados.recado
      ? `Recado: ${dados.recado}`
      : null,

    dados.email
      ? `E-mail: ${dados.email}`
      : null,

    dados.complemento
      ? `Complemento: ${dados.complemento}`
      : null
  ]
    .filter(Boolean)
    .join(" | ");
}

function montarDescricaoDemanda(dados) {
  return [
    dados.demanda ||
    "Sem descrição informada",

    dados.hora
      ? `Hora: ${dados.hora}`
      : null,

    dados.infOrigem
      ? `Informação de origem: ${dados.infOrigem}`
      : null,

    dados.orientador
      ? `Orientador: ${dados.orientador}`
      : null,

    dados.contato
      ? `Contato: ${dados.contato}`
      : null,

    dados.acao
      ? `Ação: ${dados.acao}`
      : null,

    dados.resposta
      ? `Resposta: ${dados.resposta}`
      : null,

    dados.codigoOrigem
      ? `Código de origem: ${dados.codigoOrigem}`
      : null
  ]
    .filter(Boolean)
    .join(" | ");
}

function montarDadosDaLinha(linhaOriginal) {
  const linha =
    normalizarCabecalhosLinha(linhaOriginal);

  const telefone = pegarCampo(
    linha,
    [
      "TELEFONE",
      "CELULAR",
      "WHATSAPP"
    ]
  );

  return {
    data: converterData(
      pegarCampo(
        linha,
        ["DATA"]
      )
    ),

    hora: converterHora(
      pegarCampo(
        linha,
        ["HORA"]
      )
    ),

    nome: pegarCampo(
      linha,
      ["NOME"]
    ),

    telefone,

    telefoneLimpo:
      limparTelefone(telefone),

    endereco: pegarCampo(
      linha,
      [
        "ENDEREÇO",
        "ENDERECO"
      ]
    ),

    bairro: pegarCampo(
      linha,
      ["BAIRRO"]
    ),

    cep: pegarCampo(
      linha,
      ["CEP"]
    ),

    cidade: pegarCampo(
      linha,
      ["CIDADE"]
    ),

    demanda: pegarCampo(
      linha,
      [
        "DEMANDA",
        "ASSUNTO"
      ]
    ),

    secretaria: pegarCampo(
      linha,
      ["SECRETARIA"]
    ),

    status: pegarCampo(
      linha,
      ["STATUS"]
    ),

    infOrigem: pegarCampo(
      linha,
      [
        "INF DE ORIGEM",
        "INFORMAÇÃO DE ORIGEM",
        "INFORMACAO DE ORIGEM"
      ]
    ),

    orientador: pegarCampo(
      linha,
      ["ORIENTADOR"]
    ),

    contato: pegarCampo(
      linha,
      ["CONTATO"]
    ),

    acao: pegarCampo(
      linha,
      [
        "AÇÃO",
        "ACAO"
      ]
    ),

    resposta: pegarCampo(
      linha,
      ["RESPOSTA"]
    ),

    codigoOrigem: pegarCampo(
      linha,
      [
        "CÓD",
        "COD",
        "CÓDIGO",
        "CODIGO"
      ]
    ),

    nascimento: converterData(
      pegarCampo(
        linha,
        [
          "NASC",
          "NASCIMENTO"
        ]
      )
    ),

    cpf: pegarCampo(
      linha,
      ["CPF"]
    ),

    rg: pegarCampo(
      linha,
      ["RG"]
    ),

    titulo: pegarCampo(
      linha,
      [
        "TÍTULO",
        "TITULO"
      ]
    ),

    nomeMae: pegarCampo(
      linha,
      [
        "NOME DA MÃE",
        "NOME DA MAE"
      ]
    ),

    nomePai: pegarCampo(
      linha,
      ["NOME DO PAI"]
    ),

    recado: pegarCampo(
      linha,
      ["RECADO"]
    ),

    email: pegarCampo(
      linha,
      [
        "E-MAIL",
        "EMAIL"
      ]
    ),

    complemento: pegarCampo(
      linha,
      ["COMPLEMENTO"]
    )
  };
}

//parte 02

router.get("/resumo", async (req, res) => {
  try {
    const totais = await pool.query(`
      SELECT
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(status, '')) IN (
            'CONCLUÍDO',
            'CONCLUIDO',
            'RESOLVIDA'
          )
        )::int AS resolvidas,

        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(status, '')) IN (
            'PENDENTE',
            'EM ANDAMENTO',
            'RECEBIDA',
            'RECESSO'
          )
        )::int AS pendentes
      FROM demandas_gabinete
    `);

    const totalSecretarias = await pool.query(`
      SELECT
        COUNT(DISTINCT secretaria)::int AS total
      FROM demandas_gabinete
      WHERE secretaria IS NOT NULL
        AND TRIM(secretaria) <> ''
    `);

    const totalCidadaos = await pool.query(`
      SELECT
        COUNT(DISTINCT cidadao_id)::int AS total
      FROM demandas_gabinete
      WHERE cidadao_id IS NOT NULL
    `);

    const totalBairros = await pool.query(`
      SELECT
        COUNT(
          DISTINCT COALESCE(c.bairro, dg.bairro)
        )::int AS total
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c
        ON c.id = dg.cidadao_id
      WHERE COALESCE(c.bairro, dg.bairro) IS NOT NULL
        AND TRIM(
          COALESCE(c.bairro, dg.bairro)
        ) <> ''
        AND COALESCE(c.bairro, dg.bairro) NOT IN (
          'Não Informado',
          'Outro Município'
        )
    `);

    const totalTelefones = await pool.query(`
      SELECT
        COUNT(DISTINCT c.telefone)::int AS total
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c
        ON c.id = dg.cidadao_id
      WHERE c.telefone IS NOT NULL
        AND TRIM(c.telefone) <> ''
    `);

    const porSecretaria = await pool.query(`
      SELECT
        secretaria,
        COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE secretaria IS NOT NULL
        AND TRIM(secretaria) <> ''
      GROUP BY secretaria
      ORDER BY total DESC
      LIMIT 10
    `);

    const porStatus = await pool.query(`
      SELECT
        status,
        COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE status IS NOT NULL
        AND TRIM(status) <> ''
      GROUP BY status
      ORDER BY total DESC
    `);

    const topBairros = await pool.query(`
      SELECT
        COALESCE(c.bairro, dg.bairro) AS bairro,
        COUNT(*)::int AS total
      FROM demandas_gabinete dg
      LEFT JOIN cidadaos c
        ON c.id = dg.cidadao_id
      WHERE COALESCE(c.bairro, dg.bairro) IS NOT NULL
        AND TRIM(
          COALESCE(c.bairro, dg.bairro)
        ) <> ''
        AND COALESCE(c.bairro, dg.bairro) NOT IN (
          'Não Informado',
          'Outro Município'
        )
      GROUP BY COALESCE(c.bairro, dg.bairro)
      ORDER BY total DESC
      LIMIT 10
    `);

    const evolucaoAnual = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM data)::int AS ano,
        COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE data IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM data)
      ORDER BY ano
    `);

    const evolucaoMensal = await pool.query(`
      SELECT
        EXTRACT(YEAR FROM data)::int AS ano,

        CASE EXTRACT(MONTH FROM data)::int
          WHEN 1 THEN 'JANEIRO'
          WHEN 2 THEN 'FEVEREIRO'
          WHEN 3 THEN 'MARÇO'
          WHEN 4 THEN 'ABRIL'
          WHEN 5 THEN 'MAIO'
          WHEN 6 THEN 'JUNHO'
          WHEN 7 THEN 'JULHO'
          WHEN 8 THEN 'AGOSTO'
          WHEN 9 THEN 'SETEMBRO'
          WHEN 10 THEN 'OUTUBRO'
          WHEN 11 THEN 'NOVEMBRO'
          WHEN 12 THEN 'DEZEMBRO'
        END AS mes,

        EXTRACT(MONTH FROM data)::int AS mes_numero,

        COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE data IS NOT NULL
      GROUP BY
        EXTRACT(YEAR FROM data),
        EXTRACT(MONTH FROM data)
      ORDER BY
        ano,
        mes_numero
    `);

    const mesAtual = await pool.query(`
      SELECT
        COUNT(*)::int AS total
      FROM demandas_gabinete
      WHERE data IS NOT NULL
        AND EXTRACT(YEAR FROM data) =
            EXTRACT(YEAR FROM CURRENT_DATE)
        AND EXTRACT(MONTH FROM data) =
            EXTRACT(MONTH FROM CURRENT_DATE)
    `);

    const secretariaMaisAcionada =
      await pool.query(`
        SELECT
          secretaria,
          COUNT(*)::int AS total
        FROM demandas_gabinete
        WHERE secretaria IS NOT NULL
          AND TRIM(secretaria) <> ''
        GROUP BY secretaria
        ORDER BY total DESC
        LIMIT 1
      `);

    res.json({
      total: totais.rows[0].total,
      resolvidas: totais.rows[0].resolvidas,
      pendentes: totais.rows[0].pendentes,

      totalSecretarias:
        totalSecretarias.rows[0].total,

      totalCidadaos:
        totalCidadaos.rows[0].total,

      totalBairros:
        totalBairros.rows[0].total,

      totalTelefones:
        totalTelefones.rows[0].total,

      demandasMesAtual:
        mesAtual.rows[0].total,

      secretariaMaisAcionada:
        secretariaMaisAcionada.rows[0] || null,

      porSecretaria:
        porSecretaria.rows,

      porStatus:
        porStatus.rows,

      topBairros:
        topBairros.rows,

      evolucaoAnual:
        evolucaoAnual.rows,

      evolucaoMensal:
        evolucaoMensal.rows
    });
  } catch (error) {
    console.error(
      "Erro ao carregar resumo das demandas:",
      error
    );

    res.status(500).json({
      erro:
        "Erro ao carregar resumo das demandas.",
      detalhe:
        error.message
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
          OR c.endereco ILIKE $${valores.length}
          OR c.bairro ILIKE $${valores.length}
          OR dg.bairro ILIKE $${valores.length}
          OR dg.assunto ILIKE $${valores.length}
          OR dg.descricao ILIKE $${valores.length}
          OR dg.secretaria ILIKE $${valores.length}
          OR dg.status ILIKE $${valores.length}
        )
      `);
    }

    if (bairro) {
      valores.push(`%${bairro}%`);

      filtros.push(`
        COALESCE(
          c.bairro,
          dg.bairro
        ) ILIKE $${valores.length}
      `);
    }

    if (secretaria) {
      valores.push(`%${secretaria}%`);

      filtros.push(`
        dg.secretaria ILIKE $${valores.length}
      `);
    }

    if (status) {
      valores.push(`%${status}%`);

      filtros.push(`
        dg.status ILIKE $${valores.length}
      `);
    }

    if (ano) {
      const anoNumero = Number(ano);

      if (Number.isInteger(anoNumero)) {
        valores.push(anoNumero);

        filtros.push(`
          EXTRACT(
            YEAR FROM dg.data
          )::int = $${valores.length}
        `);
      }
    }

    if (mes) {
      const mesNumero = Number(mes);

      if (
        Number.isInteger(mesNumero) &&
        mesNumero >= 1 &&
        mesNumero <= 12
      ) {
        valores.push(mesNumero);

        filtros.push(`
          EXTRACT(
            MONTH FROM dg.data
          )::int = $${valores.length}
        `);
      }
    }

    const where = filtros.length
      ? `WHERE ${filtros.join(" AND ")}`
      : "";

    const resultado = await pool.query(
      `
      SELECT
        dg.id,
        dg.cidadao_id,
        dg.protocolo,
        dg.assunto,
        dg.descricao,
        dg.secretaria,
        dg.bairro,
        dg.status,
        dg.data,
        dg.criado_em,
        dg.hash_registro,

        c.nome,
        c.telefone,
        c.endereco,
        c.bairro AS bairro_cidadao

      FROM demandas_gabinete dg

      LEFT JOIN cidadaos c
        ON c.id = dg.cidadao_id

      ${where}

      ORDER BY
        dg.data DESC NULLS LAST,
        dg.id DESC
      `,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error(
      "Erro ao carregar demandas:",
      error
    );

    res.status(500).json({
      erro:
        "Erro ao carregar demandas.",
      detalhe:
        error.message
    });
  }
});

//Parte 03

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

      const inicioImportacao = Date.now();

      const workbook = XLSX.read(
        req.file.buffer,
        {
          type: "buffer",
          cellDates: true
        }
      );

      const hashArquivo = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex");

      const loteImportacao =
        Math.floor(Date.now() / 1000);

      let totalLinhasPlanilha = 0;
      let totalVazio = 0;
      let totalDuplicado = 0;
      let totalAbasIgnoradas = 0;
      let totalCidadaosCriados = 0;

      const registrosPlanilha = [];

      /*
       * 1. Lê todas as abas de demandas.
       * Nenhuma consulta ao banco é feita dentro deste laço.
       */
      for (const nomeAba of workbook.SheetNames) {
        const anoAba =
          obterAnoDaAba(nomeAba);

        if (!anoAba) {
          totalAbasIgnoradas++;
          continue;
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

        for (const linhaOriginal of linhas) {
          totalLinhasPlanilha++;

          const dados =
            montarDadosDaLinha(
              linhaOriginal
            );

          if (linhaEstaVazia(dados)) {
            totalVazio++;
            continue;
          }

          /*
           * A data em branco continua sendo válida.
           * Não criamos uma data artificial.
           */
          dados.anoAba = anoAba;

          dados.hashRegistro =
            gerarHashRegistro(dados);

          dados.chaveCidadao =
            gerarChaveCidadao(dados);

          dados.observacoesCidadao =
            montarObservacoesCidadao(dados);

          dados.descricaoDemanda =
            montarDescricaoDemanda(dados);

          registrosPlanilha.push(dados);
        }
      }

      await client.query("BEGIN");

      /*
       * 2. Carrega todos os hashes já existentes
       * em apenas uma consulta.
       */
      const hashesDoBanco =
        await client.query(`
          SELECT hash_registro
          FROM demandas_gabinete
          WHERE hash_registro IS NOT NULL
            AND TRIM(hash_registro) <> ''
        `);

      const hashesExistentes =
        new Set(
          hashesDoBanco.rows.map(
            (registro) =>
              registro.hash_registro
          )
        );

      /*
       * Também controla duplicidades dentro
       * da própria planilha enviada.
       */
      const hashesDestaPlanilha =
        new Set();

      const registrosNovos = [];

      for (const dados of registrosPlanilha) {
        if (
          hashesExistentes.has(
            dados.hashRegistro
          ) ||
          hashesDestaPlanilha.has(
            dados.hashRegistro
          )
        ) {
          totalDuplicado++;
          continue;
        }

        hashesDestaPlanilha.add(
          dados.hashRegistro
        );

        registrosNovos.push(dados);
      }

      /*
       * 3. Carrega todos os cidadãos existentes
       * em apenas uma consulta.
       */
      const cidadaosDoBanco =
        await client.query(`
          SELECT
            id,
            nome,
            telefone,
            endereco,
            bairro
          FROM cidadaos
        `);

      const mapaCidadaos =
        new Map();

      for (
        const cidadao
        of cidadaosDoBanco.rows
      ) {
        const telefoneLimpo =
          limparTelefone(
            cidadao.telefone
          );

        let chave;

        if (telefoneLimpo) {
          chave =
            `TELEFONE:${telefoneLimpo}`;
        } else {
          chave = [
            "SEM_TELEFONE",
            normalizarTexto(
              cidadao.nome
            ),
            normalizarTexto(
              cidadao.endereco
            ),
            normalizarTexto(
              cidadao.bairro
            )
          ].join("|");
        }

        if (!mapaCidadaos.has(chave)) {
          mapaCidadaos.set(
            chave,
            Number(cidadao.id)
          );
        }
      }

      /*
       * 4. Separa somente cidadãos que ainda
       * não existem no banco.
       */
      const novosCidadaosPorChave =
        new Map();

      for (const dados of registrosNovos) {
        if (
          mapaCidadaos.has(
            dados.chaveCidadao
          )
        ) {
          continue;
        }

        if (
          novosCidadaosPorChave.has(
            dados.chaveCidadao
          )
        ) {
          continue;
        }

        novosCidadaosPorChave.set(
          dados.chaveCidadao,
          {
            chave:
              dados.chaveCidadao,

            nome:
              limitarTexto(
                dados.nome ||
                "Não informado",
                200
              ),

            telefone:
              limitarTexto(
                dados.telefoneLimpo ||
                dados.telefone,
                30
              ),

            endereco:
              limitarTexto(
                dados.endereco,
                300
              ),

            bairro:
              limitarTexto(
                dados.bairro,
                150
              ),

            observacoes:
              limitarTexto(
                dados.observacoesCidadao,
                2000
              )
          }
        );
      }

      const novosCidadaos =
        Array.from(
          novosCidadaosPorChave.values()
        );

      /*
       * 5. Insere cidadãos novos em lotes.
       */
      const lotesCidadaos =
        dividirEmLotes(
          novosCidadaos,
          TAMANHO_LOTE_CIDADAOS
        );

      for (
        const loteCidadaos
        of lotesCidadaos
      ) {
        const valores = [];
        const parametros = [];

        let parametro = 1;

        for (
          const cidadao
          of loteCidadaos
        ) {
          valores.push(
            `(
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++}
            )`
          );

          parametros.push(
            cidadao.nome,
            cidadao.telefone,
            cidadao.endereco,
            cidadao.bairro,
            cidadao.observacoes
          );
        }

        const inseridos =
          await client.query(
            `
            INSERT INTO cidadaos (
              nome,
              telefone,
              endereco,
              bairro,
              observacoes
            )
            VALUES
              ${valores.join(",")}
            RETURNING
              id,
              nome,
              telefone,
              endereco,
              bairro
            `,
            parametros
          );

        totalCidadaosCriados +=
          inseridos.rows.length;

        for (
          const cidadao
          of inseridos.rows
        ) {
          const telefoneLimpo =
            limparTelefone(
              cidadao.telefone
            );

          let chave;

          if (telefoneLimpo) {
            chave =
              `TELEFONE:${telefoneLimpo}`;
          } else {
            chave = [
              "SEM_TELEFONE",
              normalizarTexto(
                cidadao.nome
              ),
              normalizarTexto(
                cidadao.endereco
              ),
              normalizarTexto(
                cidadao.bairro
              )
            ].join("|");
          }

          mapaCidadaos.set(
            chave,
            Number(cidadao.id)
          );
        }
      }

      //Parte 04

      /*
       * 6. Prepara as demandas novas com
       * o cidadão correspondente.
       */
      const demandasParaInserir = [];

      for (const dados of registrosNovos) {
        const cidadaoId =
          mapaCidadaos.get(
            dados.chaveCidadao
          );

        if (!cidadaoId) {
          throw new Error(
            `Não foi possível vincular o cidadão: ${dados.nome || "Não informado"
            }`
          );
        }

        demandasParaInserir.push({
          cidadaoId,

          protocolo: null,

          assunto:
            limitarTexto(
              dados.demanda ||
              "Demanda importada",
              200
            ),

          descricao:
            limitarTexto(
              dados.descricaoDemanda ||
              "Sem descrição informada",
              5000
            ),

          secretaria:
            limitarTexto(
              dados.secretaria,
              200
            ),

          bairro:
            limitarTexto(
              dados.bairro,
              150
            ),

          status:
            limitarTexto(
              dados.status ||
              "RECEBIDA",
              100
            ),

          data:
            dados.data || null,

          hashRegistro:
            dados.hashRegistro
        });
      }

      /*
       * 7. Insere as demandas em lotes.
       */
      let totalImportado = 0;

      const lotesDemandas =
        dividirEmLotes(
          demandasParaInserir,
          TAMANHO_LOTE_DEMANDAS
        );

      for (
        const loteDemandas
        of lotesDemandas
      ) {
        const valores = [];
        const parametros = [];

        let parametro = 1;

        for (
          const demanda
          of loteDemandas
        ) {
          valores.push(
            `(
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++},
              $${parametro++}
            )`
          );

          parametros.push(
            demanda.cidadaoId,
            demanda.protocolo,
            demanda.assunto,
            demanda.descricao,
            demanda.secretaria,
            demanda.bairro,
            demanda.status,
            demanda.data,
            demanda.hashRegistro
          );
        }

        const resultadoInsercao =
          await client.query(
            `
            INSERT INTO demandas_gabinete (
              cidadao_id,
              protocolo,
              assunto,
              descricao,
              secretaria,
              bairro,
              status,
              data,
              hash_registro
            )
            VALUES
              ${valores.join(",")}
            ON CONFLICT DO NOTHING
            RETURNING id, hash_registro
            `,
            parametros
          );

        totalImportado +=
          resultadoInsercao.rows.length;

        const conflitosDoLote =
          loteDemandas.length -
          resultadoInsercao.rows.length;

        if (conflitosDoLote > 0) {
          totalDuplicado +=
            conflitosDoLote;
        }
      }

      /*
       * 8. Registra o lote de importação.
       */
      await client.query(
        `
        INSERT INTO importacoes_gabinete (
          arquivo,
          hash_arquivo,
          lote
        )
        VALUES (
          $1,
          $2,
          $3
        )
        ON CONFLICT DO NOTHING
        `,
        [
          limitarTexto(
            req.file.originalname,
            255
          ),
          hashArquivo,
          loteImportacao
        ]
      );

      await client.query("COMMIT");

      const tempoTotalMs =
        Date.now() -
        inicioImportacao;

      console.log(
        "=================================="
      );

      console.log(
        "IMPORTAÇÃO DE DEMANDAS CONCLUÍDA"
      );

      console.log(
        `Linhas da planilha: ${totalLinhasPlanilha}`
      );

      console.log(
        `Demandas importadas: ${totalImportado}`
      );

      console.log(
        `Duplicadas ignoradas: ${totalDuplicado}`
      );

      console.log(
        `Linhas vazias: ${totalVazio}`
      );

      console.log(
        `Cidadãos criados: ${totalCidadaosCriados}`
      );

      console.log(
        `Tempo: ${(tempoTotalMs / 1000).toFixed(2)} segundos`
      );

      console.log(
        "=================================="
      );

      res.json({
        mensagem:
          "Importação incremental concluída com sucesso.",

        arquivo:
          req.file.originalname,

        lote:
          loteImportacao,

        totalLinhasPlanilha,

        totalImportado,

        totalDuplicado,

        totalVazio,

        totalIgnorado:
          totalDuplicado +
          totalVazio,

        totalCidadaosCriados,

        totalAbasIgnoradas,

        tempoSegundos:
          Number(
            (
              tempoTotalMs / 1000
            ).toFixed(2)
          )
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (erroRollback) {
        console.error(
          "Erro ao desfazer a importação:",
          erroRollback
        );
      }

      console.error(
        "Erro na importação de demandas:",
        error
      );

      res.status(500).json({
        erro:
          "Erro ao importar demandas do gabinete.",

        detalhe:
          error.message
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;