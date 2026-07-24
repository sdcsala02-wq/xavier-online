const express = require("express");
const router = express.Router();
const pool = require("../db");
const ExcelJS = require("exceljs");
const multer = require("multer");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const extensaoValida = /\.(xlsx|xls)$/i.test(file.originalname);

    if (!extensaoValida) {
      return callback(
        new Error("Envie somente arquivos Excel no formato .xlsx ou .xls.")
      );
    }

    callback(null, true);
  }
});

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function limpar(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const texto = String(valor).trim();

  return texto === "" ? null : texto;
}

function validarId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function obterCandidatoId(req) {
  const candidatoId = Number(req.usuario?.candidato_id);

  if (!Number.isInteger(candidatoId) || candidatoId <= 0) {
    return null;
  }

  return candidatoId;
}

/*
  O frontend atual ainda utiliza alguns nomes antigos:

  titulo_eleitor
  escola_votacao
  endereco_completo
  rua

  O banco novo utiliza:

  titulo_eleitoral
  local_votacao
  endereco

  Esta função aceita os dois formatos para não quebrar a tela.
*/
function normalizarDadosEleitor(body = {}) {
  return {
    status: limpar(body.status) || "ATIVO",

    nome: limpar(body.nome),
    apelido: limpar(body.apelido),
    telefone: limpar(body.telefone),

    cidade: limpar(body.cidade),
    cep: limpar(body.cep),

    endereco:
      limpar(body.endereco) ||
      limpar(body.rua) ||
      limpar(body.endereco_completo),

    bairro: limpar(body.bairro),
    numero: limpar(body.numero),
    complemento: limpar(body.complemento),

    data_nascimento: limpar(body.data_nascimento),
    nome_mae: limpar(body.nome_mae),

    titulo_eleitoral:
      limpar(body.titulo_eleitoral) ||
      limpar(body.titulo_eleitor),

    zona: limpar(body.zona),
    secao: limpar(body.secao),

    local_votacao:
      limpar(body.local_votacao) ||
      limpar(body.escola_votacao),

    observacao: limpar(body.observacao)
  };
}

function montarFiltros(query, candidatoId) {
  const {
    busca,
    nome,
    titulo,
    zona,
    secao,
    escola,
    local_votacao,
    bairro,
    rua,
    endereco,
    numero,
    telefone,
    cidade,
    status
  } = query;

  const filtros = ["candidato_id = $1"];
  const valores = [candidatoId];

  function adicionarFiltroLike(coluna, valor) {
    const texto = limpar(valor);

    if (!texto) {
      return;
    }

    valores.push(`%${texto}%`);
    filtros.push(`${coluna} ILIKE $${valores.length}`);
  }

  if (limpar(busca)) {
    valores.push(`%${limpar(busca)}%`);

    const posicao = valores.length;

    filtros.push(`
      (
        nome ILIKE $${posicao}
        OR COALESCE(apelido, '') ILIKE $${posicao}
        OR COALESCE(telefone, '') ILIKE $${posicao}
        OR COALESCE(cidade, '') ILIKE $${posicao}
        OR COALESCE(cep, '') ILIKE $${posicao}
        OR COALESCE(endereco, '') ILIKE $${posicao}
        OR COALESCE(bairro, '') ILIKE $${posicao}
        OR COALESCE(numero, '') ILIKE $${posicao}
        OR COALESCE(titulo_eleitoral, '') ILIKE $${posicao}
        OR COALESCE(zona, '') ILIKE $${posicao}
        OR COALESCE(secao, '') ILIKE $${posicao}
        OR COALESCE(local_votacao, '') ILIKE $${posicao}
        OR COALESCE(nome_mae, '') ILIKE $${posicao}
        OR COALESCE(observacao, '') ILIKE $${posicao}
      )
    `);
  }

  adicionarFiltroLike("nome", nome);
  adicionarFiltroLike("titulo_eleitoral", titulo);
  adicionarFiltroLike("zona", zona);
  adicionarFiltroLike("secao", secao);
  adicionarFiltroLike(
    "local_votacao",
    local_votacao || escola
  );
  adicionarFiltroLike("bairro", bairro);
  adicionarFiltroLike("endereco", endereco || rua);
  adicionarFiltroLike("numero", numero);
  adicionarFiltroLike("telefone", telefone);
  adicionarFiltroLike("cidade", cidade);
  adicionarFiltroLike("status", status);

  return {
    where: `WHERE ${filtros.join(" AND ")}`,
    valores
  };
}

/*
  Retorna também os nomes antigos como aliases.

  Assim, o eleitores.html atual continuará funcionando
  enquanto migramos gradualmente para os nomes novos.
*/
const SELECT_ELEITOR = `
  SELECT
    id,
    candidato_id,
    status,
    nome,
    apelido,
    telefone,
    cidade,
    cep,
    endereco,
    bairro,
    numero,
    complemento,
    data_nascimento,
    nome_mae,
    titulo_eleitoral,
    zona,
    secao,
    local_votacao,
    observacao,
    criado_em,
    atualizado_em,

    titulo_eleitoral AS titulo_eleitor,
    local_votacao AS escola_votacao,
    endereco AS rua,
    endereco AS endereco_completo

  FROM eleitores
`;

function normalizarCabecalho(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function obterValorLinha(linha, nomesPossiveis) {
  for (const nome of nomesPossiveis) {
    const chaveNormalizada = normalizarCabecalho(nome);

    if (
      Object.prototype.hasOwnProperty.call(
        linha,
        chaveNormalizada
      )
    ) {
      return limpar(linha[chaveNormalizada]);
    }
  }

  return null;
}

function normalizarTelefoneImportacao(valor) {
  const numeros = String(valor || "").replace(/\D/g, "");

  if (!numeros) {
    return null;
  }

  return numeros;
}

function normalizarStatusImportacao(valor) {
  const status = String(valor || "ATIVO")
    .trim()
    .toUpperCase();

  const permitidos = [
    "ATIVO",
    "INATIVO",
    "INDEFINIDO"
  ];

  return permitidos.includes(status)
    ? status
    : "ATIVO";
}

function formatarDataImportacao(valor) {
  if (!valor) {
    return null;
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }

  if (typeof valor === "number") {
    const dataExcel = XLSX.SSF.parse_date_code(valor);

    if (dataExcel) {
      const ano = String(dataExcel.y).padStart(4, "0");
      const mes = String(dataExcel.m).padStart(2, "0");
      const dia = String(dataExcel.d).padStart(2, "0");

      return `${ano}-${mes}-${dia}`;
    }
  }

  const texto = String(valor).trim();

  const formatoBrasileiro = texto.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (formatoBrasileiro) {
    const dia = formatoBrasileiro[1].padStart(2, "0");
    const mes = formatoBrasileiro[2].padStart(2, "0");
    const ano = formatoBrasileiro[3];

    return `${ano}-${mes}-${dia}`;
  }

  const formatoIso = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (formatoIso) {
    return formatoIso[0];
  }

  return null;
}


// ======================================================
// LISTAR ELEITORES
// GET /api/eleitores
// ======================================================

router.get("/", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    const { where, valores } = montarFiltros(
      req.query,
      candidatoId
    );

    const resultado = await pool.query(
      `
        ${SELECT_ELEITOR}
        ${where}
        ORDER BY nome ASC, id DESC
      `,
      valores
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error("Erro ao listar eleitores:", error);

    return res.status(500).json({
      erro: "Erro interno ao listar eleitores.",
      detalhe: error.message
    });
  }
});

// ======================================================
// RESUMO E RANKINGS
// GET /api/eleitores/resumo
// ======================================================

router.get("/resumo", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    const resumoResultado = await pool.query(
      `
        SELECT
  COUNT(*)::INTEGER AS total,

  COUNT(*) FILTER (
    WHERE UPPER(TRIM(COALESCE(status, ''))) = 'ATIVO'
  )::INTEGER AS ativos,

  COUNT(
    DISTINCT NULLIF(
      TRIM(cidade),
      ''
    )
  )::INTEGER AS cidades,

          COUNT(
            DISTINCT NULLIF(
              TRIM(zona),
              ''
            )
          )::INTEGER AS zonas,

          COUNT(
            DISTINCT NULLIF(
              TRIM(secao),
              ''
            )
          )::INTEGER AS secoes,

          COUNT(
            DISTINCT NULLIF(
              TRIM(bairro),
              ''
            )
          )::INTEGER AS bairros,

          COUNT(
            DISTINCT NULLIF(
              TRIM(endereco),
              ''
            )
          )::INTEGER AS ruas

        FROM eleitores
        WHERE candidato_id = $1
      `,
      [candidatoId]
    );

    const topEscolasResultado = await pool.query(
      `
        SELECT
          TRIM(local_votacao) AS escola,
          COUNT(*)::INTEGER AS total

        FROM eleitores

        WHERE candidato_id = $1
          AND local_votacao IS NOT NULL
          AND TRIM(local_votacao) <> ''

        GROUP BY TRIM(local_votacao)

        ORDER BY
          total DESC,
          escola ASC

        LIMIT 10
      `,
      [candidatoId]
    );

    const topBairrosResultado = await pool.query(
      `
        SELECT
          TRIM(bairro) AS bairro,
          COUNT(*)::INTEGER AS total

        FROM eleitores

        WHERE candidato_id = $1
          AND bairro IS NOT NULL
          AND TRIM(bairro) <> ''

        GROUP BY TRIM(bairro)

        ORDER BY
          total DESC,
          bairro ASC

        LIMIT 10
      `,
      [candidatoId]
    );

    const topRuasResultado = await pool.query(
      `
        SELECT
          TRIM(endereco) AS rua,
          TRIM(COALESCE(bairro, '')) AS bairro,
          COUNT(*)::INTEGER AS total

        FROM eleitores

        WHERE candidato_id = $1
          AND endereco IS NOT NULL
          AND TRIM(endereco) <> ''

        GROUP BY
          TRIM(endereco),
          TRIM(COALESCE(bairro, ''))

        ORDER BY
          total DESC,
          rua ASC

        LIMIT 10
      `,
      [candidatoId]
    );

    const topZonasResultado = await pool.query(
      `
        SELECT
          TRIM(zona) AS zona,
          COUNT(*)::INTEGER AS total

        FROM eleitores

        WHERE candidato_id = $1
          AND zona IS NOT NULL
          AND TRIM(zona) <> ''

        GROUP BY TRIM(zona)

        ORDER BY
          total DESC,
          zona ASC

        LIMIT 10
      `,
      [candidatoId]
    );

    const topSecoesResultado = await pool.query(
      `
        SELECT
          TRIM(COALESCE(zona, '')) AS zona,
          TRIM(secao) AS secao,
          TRIM(COALESCE(local_votacao, '')) AS escola,
          COUNT(*)::INTEGER AS total

        FROM eleitores

        WHERE candidato_id = $1
          AND secao IS NOT NULL
          AND TRIM(secao) <> ''

        GROUP BY
          TRIM(COALESCE(zona, '')),
          TRIM(secao),
          TRIM(COALESCE(local_votacao, ''))

        ORDER BY
          total DESC,
          zona ASC,
          secao ASC

        LIMIT 10
      `,
      [candidatoId]
    );

    const resumo = resumoResultado.rows[0];


    return res.json({
      total: resumo.total || 0,
      ativos: resumo.ativos || 0,
      cidades: resumo.cidades || 0,
      escolas: resumo.escolas || 0,
      zonas: resumo.zonas || 0,
      secoes: resumo.secoes || 0,
      bairros: resumo.bairros || 0,
      ruas: resumo.ruas || 0,

      topEscolas: topEscolasResultado.rows,
      topBairros: topBairrosResultado.rows,
      topRuas: topRuasResultado.rows,
      topZonas: topZonasResultado.rows,
      topSecoes: topSecoesResultado.rows
    });


  } catch (error) {
    console.error("Erro no resumo de eleitores:", error);

    return res.status(500).json({
      erro: "Erro interno ao carregar resumo.",
      detalhe: error.message
    });
  }
});

// ======================================================
// BAIXAR MODELO OFICIAL DE ELEITORES
// GET /api/eleitores/modelo-excel
// ======================================================

router.get("/modelo-excel", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Sistema Lucas";
    workbook.lastModifiedBy = "Sistema Lucas";
    workbook.created = new Date();
    workbook.modified = new Date();

    // ==================================================
    // ABA DE INSTRUÇÕES
    // ==================================================

    const instrucoes = workbook.addWorksheet("Instruções", {
      views: [
        {
          showGridLines: false
        }
      ]
    });

    instrucoes.getColumn("A").width = 28;
    instrucoes.getColumn("B").width = 95;

    instrucoes.mergeCells("A1:B1");

    const tituloInstrucoes = instrucoes.getCell("A1");

    tituloInstrucoes.value =
      "SISTEMA LUCAS — INSTRUÇÕES PARA IMPORTAÇÃO";

    tituloInstrucoes.font = {
      bold: true,
      size: 16,
      color: {
        argb: "FFFFFFFF"
      }
    };

    tituloInstrucoes.alignment = {
      horizontal: "center",
      vertical: "middle"
    };

    tituloInstrucoes.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1E3A8A"
      }
    };

    instrucoes.getRow(1).height = 34;

    const orientacoes = [
      [
        "Regra",
        "Orientação"
      ],
      [
        "Campo obrigatório",
        "O campo Nome deve estar preenchido em todos os registros."
      ],
      [
        "Cabeçalhos",
        "Não altere, exclua ou renomeie os nomes das colunas."
      ],
      [
        "Uma pessoa por linha",
        "Cada linha deve representar somente um eleitor."
      ],
      [
        "Linha de exemplo",
        "A linha amarela da aba Eleitores é apenas um exemplo e deve ser apagada antes da importação."
      ],
      [
        "Status",
        "Utilize somente ATIVO, INATIVO ou INDEFINIDO."
      ],
      [
        "Telefone",
        "Pode ser preenchido com ou sem pontuação."
      ],
      [
        "CEP",
        "Pode ser preenchido como 11700-000 ou 11700000."
      ],
      [
        "Título, zona e seção",
        "Recomendamos manter essas colunas no formato Texto para preservar zeros à esquerda."
      ],
      [
        "Arquivo",
        "Salve o arquivo no formato .xlsx antes de realizar a importação."
      ]
    ];

    orientacoes.forEach((dados, indice) => {
      const numeroLinha = indice + 3;
      const linha = instrucoes.getRow(numeroLinha);

      linha.values = [
        dados[0],
        dados[1]
      ];

      linha.height = numeroLinha === 3 ? 26 : 32;

      linha.eachCell(celula => {
        celula.alignment = {
          vertical: "middle",
          wrapText: true
        };

        celula.border = {
          top: {
            style: "thin",
            color: {
              argb: "FFE2E8F0"
            }
          },
          left: {
            style: "thin",
            color: {
              argb: "FFE2E8F0"
            }
          },
          bottom: {
            style: "thin",
            color: {
              argb: "FFE2E8F0"
            }
          },
          right: {
            style: "thin",
            color: {
              argb: "FFE2E8F0"
            }
          }
        };
      });

      if (numeroLinha === 3) {
        linha.eachCell(celula => {
          celula.font = {
            bold: true,
            color: {
              argb: "FFFFFFFF"
            }
          };

          celula.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "FF2563EB"
            }
          };
        });
      } else {
        linha.getCell(1).font = {
          bold: true,
          color: {
            argb: "FF1E3A8A"
          }
        };
      }
    });

    // ==================================================
    // ABA DE ELEITORES
    // ==================================================

    const planilha = workbook.addWorksheet("Eleitores", {
      views: [
        {
          state: "frozen",
          ySplit: 4
        }
      ]
    });

    const colunas = [
      {
        titulo: "Nome",
        largura: 32
      },
      {
        titulo: "Apelido",
        largura: 20
      },
      {
        titulo: "Telefone",
        largura: 20
      },
      {
        titulo: "Cidade",
        largura: 24
      },
      {
        titulo: "CEP",
        largura: 15
      },
      {
        titulo: "Endereço",
        largura: 38
      },
      {
        titulo: "Número",
        largura: 13
      },
      {
        titulo: "Complemento",
        largura: 22
      },
      {
        titulo: "Bairro",
        largura: 25
      },
      {
        titulo: "Data de Nascimento",
        largura: 21
      },
      {
        titulo: "Nome da Mãe",
        largura: 34
      },
      {
        titulo: "Título Eleitoral",
        largura: 21
      },
      {
        titulo: "Zona",
        largura: 13
      },
      {
        titulo: "Seção",
        largura: 13
      },
      {
        titulo: "Local de Votação",
        largura: 38
      },
      {
        titulo: "Status",
        largura: 17
      },
      {
        titulo: "Observação",
        largura: 45
      }
    ];

    colunas.forEach((coluna, indice) => {
      planilha.getColumn(indice + 1).width = coluna.largura;
    });

    // Título principal
    planilha.mergeCells("A1:Q1");

    const titulo = planilha.getCell("A1");

    titulo.value =
      "SISTEMA LUCAS — MODELO OFICIAL DE IMPORTAÇÃO DE ELEITORES";

    titulo.font = {
      bold: true,
      size: 16,
      color: {
        argb: "FFFFFFFF"
      }
    };

    titulo.alignment = {
      horizontal: "center",
      vertical: "middle"
    };

    titulo.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1E3A8A"
      }
    };

    planilha.getRow(1).height = 34;

    // Orientação
    planilha.mergeCells("A2:Q2");

    const orientacao = planilha.getCell("A2");

    orientacao.value =
      "Preencha uma linha por eleitor. Não altere os nomes das colunas. O campo Nome é obrigatório.";

    orientacao.font = {
      italic: true,
      size: 11,
      color: {
        argb: "FF475569"
      }
    };

    orientacao.alignment = {
      horizontal: "left",
      vertical: "middle"
    };

    orientacao.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFEFF6FF"
      }
    };

    planilha.getRow(2).height = 26;
    planilha.getRow(3).height = 8;

    // Cabeçalhos na linha 4
    const linhaCabecalho = planilha.getRow(4);

    linhaCabecalho.values = colunas.map(coluna => coluna.titulo);
    linhaCabecalho.height = 28;

    linhaCabecalho.eachCell((celula, numeroColuna) => {
      celula.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF"
        }
      };

      celula.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
      };

      let cor = "FF2563EB";

      // Dados pessoais
      if (numeroColuna >= 1 && numeroColuna <= 3) {
        cor = "FF2563EB";
      }

      // Endereço
      if (numeroColuna >= 4 && numeroColuna <= 9) {
        cor = "FF15803D";
      }

      // Dados pessoais complementares
      if (numeroColuna >= 10 && numeroColuna <= 11) {
        cor = "FF7C3AED";
      }

      // Dados eleitorais
      if (numeroColuna >= 12 && numeroColuna <= 15) {
        cor = "FF9333EA";
      }

      // Status e observação
      if (numeroColuna >= 16) {
        cor = "FFEA580C";
      }

      celula.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: cor
        }
      };

      celula.border = {
        top: {
          style: "thin",
          color: {
            argb: "FFCBD5E1"
          }
        },
        left: {
          style: "thin",
          color: {
            argb: "FFCBD5E1"
          }
        },
        bottom: {
          style: "thin",
          color: {
            argb: "FFCBD5E1"
          }
        },
        right: {
          style: "thin",
          color: {
            argb: "FFCBD5E1"
          }
        }
      };
    });

    // Linha de exemplo correta
    const exemplo = [
      "João da Silva",
      "João",
      "(13) 99999-9999",
      "Praia Grande",
      "11700-000",
      "Avenida Presidente Kennedy",
      "1000",
      "Apartamento 12",
      "Boqueirão",
      "15/08/1985",
      "Maria da Silva",
      "123456789012",
      "0406",
      "0132",
      "E.E. Exemplo",
      "ATIVO",
      "LINHA DE EXEMPLO — APAGUE ANTES DE IMPORTAR"
    ];

    const linhaExemplo = planilha.getRow(5);

    linhaExemplo.values = exemplo;
    linhaExemplo.height = 24;

    linhaExemplo.eachCell(celula => {
      celula.font = {
        italic: true,
        color: {
          argb: "FF854D0E"
        }
      };

      celula.alignment = {
        vertical: "middle"
      };

      celula.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FFFEF9C3"
        }
      };

      celula.border = {
        bottom: {
          style: "thin",
          color: {
            argb: "FFFACC15"
          }
        }
      };
    });

    // Formatar como texto para preservar zeros
    [
      3,  // Telefone
      5,  // CEP
      7,  // Número
      12, // Título eleitoral
      13, // Zona
      14  // Seção
    ].forEach(numeroColuna => {
      planilha.getColumn(numeroColuna).numFmt = "@";
    });

    // Lista de status
    for (let linha = 5; linha <= 5000; linha++) {
      planilha.getCell(linha, 16).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [
          '"ATIVO,INATIVO,INDEFINIDO"'
        ],
        showErrorMessage: true,
        errorTitle: "Status inválido",
        error:
          "Escolha ATIVO, INATIVO ou INDEFINIDO."
      };
    }

    // Filtro
    planilha.autoFilter = {
      from: {
        row: 4,
        column: 1
      },
      to: {
        row: 4,
        column: 17
      }
    };

    planilha.properties.defaultRowHeight = 20;

    const nomeArquivo =
      "modelo_oficial_eleitores_sistema_lucas.xlsx";

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );

    await workbook.xlsx.write(res);

    return res.end();

  } catch (error) {
    console.error(
      "Erro ao gerar modelo Excel:",
      error
    );

    return res.status(500).json({
      erro: "Erro interno ao gerar o modelo Excel.",
      detalhe: error.message
    });
  }
});

// ======================================================
// IMPORTAR ELEITORES POR EXCEL
// POST /api/eleitores/importar-excel
// ======================================================

router.post(
  "/importar-excel",
  upload.single("arquivo"),
  async (req, res) => {
    const cliente = await pool.connect();

    try {
      const candidatoId = obterCandidatoId(req);

      if (!candidatoId) {
        return res.status(400).json({
          erro: "Candidato não identificado na sessão."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          erro: "Nenhum arquivo Excel foi enviado."
        });
      }

      const workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
        raw: false
      });

      const nomeAba = workbook.SheetNames[0];

      const nomeAbaEleitores = workbook.SheetNames.find(nome => {
        return String(nome)
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") === "eleitores";
      });

      if (!nomeAbaEleitores) {
        return res.status(400).json({
          erro: 'A planilha precisa possuir uma aba chamada "Eleitores".'
        });
      }

      const planilha = workbook.Sheets[nomeAbaEleitores];


      /*  
        O modelo oficial possui:
        linha 1: título/orientação
        linha 2 e 3: espaço
        linha 4: cabeçalhos
        linha 5 em diante: dados
      */
      const linhasBrutas = XLSX.utils.sheet_to_json(
        planilha,
        {
          range: 3,
          defval: null,
          raw: false
        }
      );

      if (!linhasBrutas.length) {
        return res.status(400).json({
          erro: "A planilha não possui eleitores para importar."
        });
      }

      const linhas = linhasBrutas.map(linha => {
        const normalizada = {};

        Object.entries(linha).forEach(([chave, valor]) => {
          normalizada[normalizarCabecalho(chave)] = valor;
        });

        return normalizada;
      });

      const resumo = {
        arquivo: req.file.originalname,
        total_linhas: linhas.length,
        inseridos: 0,
        atualizados: 0,
        ignorados: 0,
        erros: 0,
        detalhes_erros: []
      };

      await cliente.query("BEGIN");

      for (let indice = 0; indice < linhas.length; indice++) {
        const numeroLinhaExcel = indice + 5;
        const linha = linhas[indice];

        try {
          const nome = obterValorLinha(linha, [
            "Nome",
            "Nome Completo"
          ]);

          const apelido = obterValorLinha(linha, [
            "Apelido"
          ]);

          const telefoneOriginal = obterValorLinha(linha, [
            "Telefone",
            "Celular",
            "WhatsApp"
          ]);

          const telefone =
            normalizarTelefoneImportacao(telefoneOriginal);

          const cidade = obterValorLinha(linha, [
            "Cidade",
            "Município"
          ]);

          const cep = obterValorLinha(linha, [
            "CEP"
          ]);

          const endereco = obterValorLinha(linha, [
            "Endereço",
            "Endereco",
            "Rua"
          ]);

          const numero = obterValorLinha(linha, [
            "Número",
            "Numero"
          ]);

          const complemento = obterValorLinha(linha, [
            "Complemento"
          ]);

          const bairro = obterValorLinha(linha, [
            "Bairro"
          ]);

          const dataNascimento = formatarDataImportacao(
            obterValorLinha(linha, [
              "Data de Nascimento",
              "Nascimento"
            ])
          );

          const nomeMae = obterValorLinha(linha, [
            "Nome da Mãe",
            "Nome da Mae",
            "Mãe",
            "Mae"
          ]);

          const tituloEleitoral = obterValorLinha(linha, [
            "Título Eleitoral",
            "Titulo Eleitoral",
            "Título",
            "Titulo"
          ]);

          const zona = obterValorLinha(linha, [
            "Zona",
            "Zona Eleitoral"
          ]);

          const secao = obterValorLinha(linha, [
            "Seção",
            "Secao",
            "Seção Eleitoral",
            "Secao Eleitoral"
          ]);

          const localVotacao = obterValorLinha(linha, [
            "Local de Votação",
            "Local de Votacao",
            "Escola de Votação",
            "Escola de Votacao"
          ]);

          const status = normalizarStatusImportacao(
            obterValorLinha(linha, [
              "Status",
              "Situação",
              "Situacao"
            ])
          );

          const observacao = obterValorLinha(linha, [
            "Observação",
            "Observacao"
          ]);

          /*
            Ignora a linha de exemplo do modelo.
          */
          if (
            nome &&
            nome.toUpperCase() === "JOÃO DA SILVA" &&
            observacao &&
            observacao
              .toUpperCase()
              .includes("LINHA DE EXEMPLO")
          ) {
            resumo.ignorados++;
            continue;
          }

          const linhaTotalmenteVazia = Object.values(linha)
            .every(valor => {
              return valor === null ||
                valor === undefined ||
                String(valor).trim() === "";
            });

          if (linhaTotalmenteVazia) {
            resumo.ignorados++;
            continue;
          }

          if (!nome) {
            resumo.erros++;

            resumo.detalhes_erros.push({
              linha: numeroLinhaExcel,
              erro: "O campo Nome é obrigatório."
            });

            continue;
          }

          let eleitorExistente = null;

          /*
            Primeira tentativa:
            localizar pelo título eleitoral.
          */
          if (tituloEleitoral) {
            const buscaTitulo = await cliente.query(
              `
                SELECT id
                FROM eleitores
                WHERE candidato_id = $1
                  AND REGEXP_REPLACE(
                    COALESCE(titulo_eleitoral, ''),
                    '[^0-9]',
                    '',
                    'g'
                  ) = REGEXP_REPLACE(
                    $2,
                    '[^0-9]',
                    '',
                    'g'
                  )
                LIMIT 1
              `,
              [
                candidatoId,
                tituloEleitoral
              ]
            );

            eleitorExistente =
              buscaTitulo.rows[0] || null;
          }

          /*
            Segunda tentativa:
            nome + telefone.
          */
          if (!eleitorExistente && telefone) {
            const buscaTelefone = await cliente.query(
              `
                SELECT id
                FROM eleitores
                WHERE candidato_id = $1
                  AND UPPER(TRIM(nome)) = UPPER(TRIM($2))
                  AND REGEXP_REPLACE(
                    COALESCE(telefone, ''),
                    '[^0-9]',
                    '',
                    'g'
                  ) = $3
                LIMIT 1
              `,
              [
                candidatoId,
                nome,
                telefone
              ]
            );

            eleitorExistente =
              buscaTelefone.rows[0] || null;
          }

          if (eleitorExistente) {
            await cliente.query(
              `
                UPDATE eleitores
                SET
                  status = $1,
                  nome = $2,
                  apelido = $3,
                  telefone = $4,
                  cidade = $5,
                  cep = $6,
                  endereco = $7,
                  bairro = $8,
                  numero = $9,
                  complemento = $10,
                  data_nascimento = $11,
                  nome_mae = $12,
                  titulo_eleitoral = $13,
                  zona = $14,
                  secao = $15,
                  local_votacao = $16,
                  observacao = $17,
                  atualizado_em = NOW()
                WHERE id = $18
                  AND candidato_id = $19
              `,
              [
                status,
                nome,
                apelido,
                telefoneOriginal,
                cidade,
                cep,
                endereco,
                bairro,
                numero,
                complemento,
                dataNascimento,
                nomeMae,
                tituloEleitoral,
                zona,
                secao,
                localVotacao,
                observacao,
                eleitorExistente.id,
                candidatoId
              ]
            );

            resumo.atualizados++;
          } else {
            await cliente.query(
              `
                INSERT INTO eleitores (
                  candidato_id,
                  status,
                  nome,
                  apelido,
                  telefone,
                  cidade,
                  cep,
                  endereco,
                  bairro,
                  numero,
                  complemento,
                  data_nascimento,
                  nome_mae,
                  titulo_eleitoral,
                  zona,
                  secao,
                  local_votacao,
                  observacao,
                  criado_em,
                  atualizado_em
                )
                VALUES (
                  $1, $2, $3, $4, $5,
                  $6, $7, $8, $9, $10,
                  $11, $12, $13, $14, $15,
                  $16, $17, $18,
                  NOW(), NOW()
                )
              `,
              [
                candidatoId,
                status,
                nome,
                apelido,
                telefoneOriginal,
                cidade,
                cep,
                endereco,
                bairro,
                numero,
                complemento,
                dataNascimento,
                nomeMae,
                tituloEleitoral,
                zona,
                secao,
                localVotacao,
                observacao
              ]
            );

            resumo.inseridos++;
          }
        } catch (erroLinha) {
          resumo.erros++;

          resumo.detalhes_erros.push({
            linha: numeroLinhaExcel,
            erro: erroLinha.message
          });
        }
      }

      await cliente.query("COMMIT");

      await pool.query(
        `
    INSERT INTO importacoes_eleitores (
      candidato_id,
      usuario_id,
      nome_arquivo,
      total_linhas,
      inseridos,
      atualizados,
      ignorados,
      erros,
      status,
      detalhes_erros
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10
    )
  `,
        [
          candidatoId,
          req.usuario?.id || null,
          resumo.arquivo,
          resumo.total_linhas,
          resumo.inseridos,
          resumo.atualizados,
          resumo.ignorados,
          resumo.erros,
          resumo.erros > 0
            ? "CONCLUIDA_COM_ERROS"
            : "CONCLUIDA",
          JSON.stringify(resumo.detalhes_erros || [])
        ]
      );

      return res.json({
        ok: true,
        mensagem: "Importação concluída com sucesso.",
        resumo
      });
    } catch (error) {
      await cliente.query("ROLLBACK");

      console.error(
        "Erro ao importar eleitores:",
        error
      );

      return res.status(500).json({
        erro: "Erro interno ao importar eleitores.",
        detalhe: error.message
      });
    } finally {
      cliente.release();
    }
  }
);

// ======================================================
// EXPORTAR ELEITORES PARA EXCEL
// GET /api/eleitores/exportar-excel
// ======================================================

router.get("/exportar-excel", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    const { where, valores } = montarFiltros(
      req.query,
      candidatoId
    );

    const resultado = await pool.query(
      `
        ${SELECT_ELEITOR}
        ${where}
        ORDER BY nome ASC, id DESC
      `,
      valores
    );

    const registros = resultado.rows;

    if (!registros.length) {
      return res.status(404).json({
        erro: "Nenhum eleitor foi encontrado para exportação."
      });
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Sistema Lucas";
    workbook.lastModifiedBy = "Sistema Lucas";
    workbook.created = new Date();
    workbook.modified = new Date();

    const planilha = workbook.addWorksheet(
      "Eleitores",
      {
        views: [
          {
            state: "frozen",
            ySplit: 4,
            showGridLines: false
          }
        ]
      }
    );

    // ==================================================
    // CONFIGURAÇÃO DAS COLUNAS
    // ==================================================

    const colunas = [
      { titulo: "Nome", largura: 32 },
      { titulo: "Apelido", largura: 20 },
      { titulo: "Telefone", largura: 20 },
      { titulo: "Cidade", largura: 24 },
      { titulo: "CEP", largura: 15 },
      { titulo: "Endereço", largura: 38 },
      { titulo: "Número", largura: 13 },
      { titulo: "Complemento", largura: 22 },
      { titulo: "Bairro", largura: 25 },
      { titulo: "Data de Nascimento", largura: 21 },
      { titulo: "Nome da Mãe", largura: 34 },
      { titulo: "Título Eleitoral", largura: 21 },
      { titulo: "Zona", largura: 13 },
      { titulo: "Seção", largura: 13 },
      { titulo: "Local de Votação", largura: 38 },
      { titulo: "Status", largura: 17 },
      { titulo: "Observação", largura: 45 }
    ];

    colunas.forEach((coluna, indice) => {
      planilha.getColumn(indice + 1).width =
        coluna.largura;
    });

    // ==================================================
    // TÍTULO
    // ==================================================

    planilha.mergeCells("A1:Q1");

    const titulo = planilha.getCell("A1");

    titulo.value =
      "SISTEMA LUCAS — RELATÓRIO DE ELEITORES";

    titulo.font = {
      bold: true,
      size: 16,
      color: {
        argb: "FFFFFFFF"
      }
    };

    titulo.alignment = {
      horizontal: "center",
      vertical: "middle"
    };

    titulo.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF1E3A8A"
      }
    };

    planilha.getRow(1).height = 34;

    // ==================================================
    // INFORMAÇÕES DO RELATÓRIO
    // ==================================================

    planilha.mergeCells("A2:Q2");

    const informacao = planilha.getCell("A2");

    const dataGeracao =
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo"
      }).format(new Date());

    informacao.value =
      `Relatório gerado em ${dataGeracao} — ` +
      `Total de registros: ${registros.length}`;

    informacao.font = {
      italic: true,
      size: 11,
      color: {
        argb: "FF475569"
      }
    };

    informacao.alignment = {
      horizontal: "left",
      vertical: "middle"
    };

    informacao.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFEFF6FF"
      }
    };

    planilha.getRow(2).height = 26;
    planilha.getRow(3).height = 8;

    // ==================================================
    // CABEÇALHOS
    // ==================================================

    const linhaCabecalho = planilha.getRow(4);

    linhaCabecalho.values =
      colunas.map(coluna => coluna.titulo);

    linhaCabecalho.height = 28;

    linhaCabecalho.eachCell(
      (celula, numeroColuna) => {
        celula.font = {
          bold: true,
          color: {
            argb: "FFFFFFFF"
          }
        };

        celula.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true
        };

        let cor = "FF2563EB";

        if (
          numeroColuna >= 4 &&
          numeroColuna <= 9
        ) {
          cor = "FF15803D";
        }

        if (
          numeroColuna >= 10 &&
          numeroColuna <= 11
        ) {
          cor = "FF7C3AED";
        }

        if (
          numeroColuna >= 12 &&
          numeroColuna <= 15
        ) {
          cor = "FF9333EA";
        }

        if (numeroColuna >= 16) {
          cor = "FFEA580C";
        }

        celula.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: cor
          }
        };

        celula.border = {
          top: {
            style: "thin",
            color: {
              argb: "FFCBD5E1"
            }
          },
          left: {
            style: "thin",
            color: {
              argb: "FFCBD5E1"
            }
          },
          bottom: {
            style: "thin",
            color: {
              argb: "FFCBD5E1"
            }
          },
          right: {
            style: "thin",
            color: {
              argb: "FFCBD5E1"
            }
          }
        };
      }
    );

    // ==================================================
    // DADOS
    // ==================================================

    registros.forEach((eleitor, indice) => {
      const numeroLinha = indice + 5;

      const linha = planilha.getRow(numeroLinha);

      linha.values = [
        eleitor.nome || "",
        eleitor.apelido || "",
        eleitor.telefone || "",
        eleitor.cidade || "",
        eleitor.cep || "",
        eleitor.endereco || "",
        eleitor.numero || "",
        eleitor.complemento || "",
        eleitor.bairro || "",
        eleitor.data_nascimento
          ? new Date(eleitor.data_nascimento)
            .toLocaleDateString("pt-BR", {
              timeZone: "UTC"
            })
          : "",
        eleitor.nome_mae || "",
        eleitor.titulo_eleitoral || "",
        eleitor.zona || "",
        eleitor.secao || "",
        eleitor.local_votacao || "",
        eleitor.status || "",
        eleitor.observacao || ""
      ];

      linha.height = 23;

      linha.eachCell(celula => {
        celula.alignment = {
          vertical: "middle",
          wrapText: false
        };

        celula.border = {
          bottom: {
            style: "thin",
            color: {
              argb: "FFE2E8F0"
            }
          }
        };
      });

      if (indice % 2 !== 0) {
        linha.eachCell(celula => {
          celula.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "FFF8FAFC"
            }
          };
        });
      }

      const celulaStatus =
        planilha.getCell(numeroLinha, 16);

      const statusNormalizado = String(
        eleitor.status || "INDEFINIDO"
      ).toUpperCase();

      let corTextoStatus = "FF92400E";
      let corFundoStatus = "FFFEF3C7";

      if (statusNormalizado === "ATIVO") {
        corTextoStatus = "FF15803D";
        corFundoStatus = "FFDCFCE7";
      }

      if (statusNormalizado === "INATIVO") {
        corTextoStatus = "FFB91C1C";
        corFundoStatus = "FFFEE2E2";
      }

      celulaStatus.font = {
        bold: true,
        color: {
          argb: corTextoStatus
        }
      };

      celulaStatus.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: corFundoStatus
        }
      };

      celulaStatus.alignment = {
        horizontal: "center",
        vertical: "middle"
      };
    });

    // ==================================================
    // PRESERVAR ZEROS À ESQUERDA
    // ==================================================

    [
      3,  // Telefone
      5,  // CEP
      7,  // Número
      12, // Título eleitoral
      13, // Zona
      14  // Seção
    ].forEach(numeroColuna => {
      planilha.getColumn(numeroColuna).numFmt = "@";
    });

    // ==================================================
    // FILTRO AUTOMÁTICO
    // ==================================================

    planilha.autoFilter = {
      from: {
        row: 4,
        column: 1
      },
      to: {
        row: 4,
        column: 17
      }
    };

    // ==================================================
    // NOME DO ARQUIVO
    // ==================================================

    const agora = new Date();

    const dataArquivo = [
      agora.getFullYear(),
      String(agora.getMonth() + 1).padStart(2, "0"),
      String(agora.getDate()).padStart(2, "0")
    ].join("-");

    const nomeArquivo =
      `eleitores_sistema_lucas_${dataArquivo}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );

    await workbook.xlsx.write(res);

    return res.end();

  } catch (error) {
    console.error(
      "Erro ao exportar eleitores para Excel:",
      error
    );

    return res.status(500).json({
      erro: "Erro interno ao exportar os eleitores.",
      detalhe: error.message
    });
  }
});

// ======================================================
// EXPORTAR ELEITORES PARA PDF
// GET /api/eleitores/exportar-pdf
// ======================================================

router.get("/exportar-pdf", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    const { where, valores } = montarFiltros(
      req.query,
      candidatoId
    );

    const resultado = await pool.query(
      `
        ${SELECT_ELEITOR}
        ${where}
        ORDER BY nome ASC, id DESC
      `,
      valores
    );

    const registros = resultado.rows;

    if (!registros.length) {
      return res.status(404).json({
        erro: "Nenhum eleitor foi encontrado para exportação."
      });
    }

    const agora = new Date();

    const dataArquivo = [
      agora.getFullYear(),
      String(agora.getMonth() + 1).padStart(2, "0"),
      String(agora.getDate()).padStart(2, "0")
    ].join("-");

    const nomeArquivo =
      `eleitores_sistema_lucas_${dataArquivo}.pdf`;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );

    const pdf = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: {
        top: 40,
        right: 35,
        bottom: 45,
        left: 35
      },
      bufferPages: true
    });

    pdf.pipe(res);

    const larguraPagina =
      pdf.page.width -
      pdf.page.margins.left -
      pdf.page.margins.right;

    const colunas = [
      { titulo: "Nome", campo: "nome", largura: 135 },
      { titulo: "Telefone", campo: "telefone", largura: 85 },
      { titulo: "Cidade", campo: "cidade", largura: 75 },
      { titulo: "Bairro", campo: "bairro", largura: 85 },
      { titulo: "Zona", campo: "zona", largura: 42 },
      { titulo: "Seção", campo: "secao", largura: 45 },
      {
        titulo: "Local de votação",
        campo: "local_votacao",
        largura: 150
      },
      { titulo: "Status", campo: "status", largura: 60 }
    ];

    const larguraTotal =
      colunas.reduce(
        (total, coluna) => total + coluna.largura,
        0
      );

    const proporcao =
      larguraPagina / larguraTotal;

    colunas.forEach(coluna => {
      coluna.largura *= proporcao;
    });

    function desenharCabecalhoPagina() {
      const esquerda = pdf.page.margins.left;
      const topo = 32;

      pdf
        .rect(
          esquerda,
          topo,
          larguraPagina,
          42
        )
        .fill("#1E3A8A");

      pdf
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(
          "SISTEMA LUCAS",
          esquerda + 14,
          topo + 9
        );

      pdf
        .font("Helvetica")
        .fontSize(8)
        .text(
          "SALA 02 - SDC | RELATÓRIO DE ELEITORES",
          esquerda + 14,
          topo + 27
        );

      pdf
        .fillColor("#334155")
        .font("Helvetica")
        .fontSize(8)
        .text(
          `Gerado em ${new Intl.DateTimeFormat(
            "pt-BR",
            {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo"
            }
          ).format(agora)} | Total: ${registros.length}`,
          esquerda,
          topo + 50
        );

      return topo + 68;
    }

    function desenharCabecalhoTabela(y) {
      let x = pdf.page.margins.left;

      colunas.forEach(coluna => {
        pdf
          .rect(
            x,
            y,
            coluna.largura,
            24
          )
          .fillAndStroke(
            "#1F2937",
            "#CBD5E1"
          );

        pdf
          .fillColor("#FFFFFF")
          .font("Helvetica-Bold")
          .fontSize(7)
          .text(
            coluna.titulo,
            x + 4,
            y + 8,
            {
              width: coluna.largura - 8,
              align: "center",
              lineBreak: false
            }
          );

        x += coluna.largura;
      });

      return y + 24;
    }

    function desenharRodape() {
      const rodapeY =
        pdf.page.height -
        pdf.page.margins.bottom -
        12;

      pdf
        .strokeColor("#CBD5E1")
        .lineWidth(0.5)
        .moveTo(
          pdf.page.margins.left,
          rodapeY - 7
        )
        .lineTo(
          pdf.page.width -
          pdf.page.margins.right,
          rodapeY - 7
        )
        .stroke();

      pdf
        .fillColor("#64748B")
        .font("Helvetica")
        .fontSize(7)
        .text(
          "Documento gerado automaticamente pelo Sistema Lucas.",
          pdf.page.margins.left,
          rodapeY,
          {
            width: larguraPagina,
            align: "left",
            lineBreak: false
          }
        );
    }

    let y = desenharCabecalhoPagina();
    y = desenharCabecalhoTabela(y);

    registros.forEach((eleitor, indice) => {
      const alturaLinha = 28;

      const limiteInferior =
        pdf.page.height -
        pdf.page.margins.bottom -
        25;

      if (y + alturaLinha > limiteInferior) {
        desenharRodape();

        pdf.addPage();

        y = desenharCabecalhoPagina();
        y = desenharCabecalhoTabela(y);
      }

      let x = pdf.page.margins.left;

      const corFundo =
        indice % 2 === 0
          ? "#FFFFFF"
          : "#F8FAFC";

      colunas.forEach(coluna => {
        let valor = eleitor[coluna.campo] || "";

        if (coluna.campo === "status") {
          valor = String(valor).toUpperCase();
        }

        pdf
          .rect(
            x,
            y,
            coluna.largura,
            alturaLinha
          )
          .fillAndStroke(
            corFundo,
            "#E2E8F0"
          );

        let corTexto = "#334155";

        if (coluna.campo === "status") {
          if (valor === "ATIVO") {
            corTexto = "#15803D";
          } else if (valor === "INATIVO") {
            corTexto = "#B91C1C";
          } else {
            corTexto = "#92400E";
          }
        }

        pdf
          .fillColor(corTexto)
          .font(
            coluna.campo === "status"
              ? "Helvetica-Bold"
              : "Helvetica"
          )
          .fontSize(7)
          .text(
            String(valor),
            x + 4,
            y + 8,
            {
              width: coluna.largura - 8,
              height: alturaLinha - 8,
              ellipsis: true,
              lineBreak: false,
              align:
                ["zona", "secao", "status"]
                  .includes(coluna.campo)
                  ? "center"
                  : "left"
            }
          );

        x += coluna.largura;
      });

      y += alturaLinha;
    });

    desenharRodape();

    pdf.end();



  } catch (error) {
    console.error(
      "Erro ao exportar eleitores para PDF:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        erro: "Erro interno ao exportar os eleitores em PDF.",
        detalhe: error.message
      });
    }

    return res.end();
  }
});

// SOMENTE DEPOIS:
router.get("/:id", async (req, res) => {
  // buscar eleitor pelo ID
});

// ======================================================
// BUSCAR UM ELEITOR
// GET /api/eleitores/:id
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);
    const id = validarId(req.params.id);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    if (!id) {
      return res.status(400).json({
        erro: "ID do eleitor inválido."
      });
    }

    const resultado = await pool.query(
      `
        ${SELECT_ELEITOR}
        WHERE id = $1
          AND candidato_id = $2
        LIMIT 1
      `,
      [id, candidatoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Eleitor não encontrado."
      });
    }

    return res.json(resultado.rows[0]);
  } catch (error) {
    console.error("Erro ao buscar eleitor:", error);

    return res.status(500).json({
      erro: "Erro interno ao buscar eleitor.",
      detalhe: error.message
    });
  }
});

// ======================================================
// CADASTRAR ELEITOR
// POST /api/eleitores
// ======================================================

router.post("/", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);
    const dados = normalizarDadosEleitor(req.body);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    if (!dados.nome) {
      return res.status(400).json({
        erro: "Nome é obrigatório."
      });
    }

    const resultado = await pool.query(
      `
        INSERT INTO eleitores (
          candidato_id,
          status,
          nome,
          apelido,
          telefone,
          cidade,
          cep,
          endereco,
          bairro,
          numero,
          complemento,
          data_nascimento,
          nome_mae,
          titulo_eleitoral,
          zona,
          secao,
          local_votacao,
          observacao,
          criado_em,
          atualizado_em
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          timezone('America/Sao_Paulo', NOW()),
          timezone('America/Sao_Paulo', NOW())
        )
        RETURNING *
      `,
      [
        candidatoId,
        dados.status,
        dados.nome,
        dados.apelido,
        dados.telefone,
        dados.cidade,
        dados.cep,
        dados.endereco,
        dados.bairro,
        dados.numero,
        dados.complemento,
        dados.data_nascimento,
        dados.nome_mae,
        dados.titulo_eleitoral,
        dados.zona,
        dados.secao,
        dados.local_votacao,
        dados.observacao
      ]
    );

    return res.status(201).json({
      mensagem: "Eleitor cadastrado com sucesso.",
      eleitor: resultado.rows[0]
    });
  } catch (error) {
    console.error("Erro ao cadastrar eleitor:", error);

    return res.status(500).json({
      erro: "Erro interno ao cadastrar eleitor.",
      detalhe: error.message
    });
  }
});

// ======================================================
// ATUALIZAR ELEITOR
// PUT /api/eleitores/:id
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);
    const id = validarId(req.params.id);
    const dados = normalizarDadosEleitor(req.body);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    if (!id) {
      return res.status(400).json({
        erro: "ID do eleitor inválido."
      });
    }

    if (!dados.nome) {
      return res.status(400).json({
        erro: "Nome é obrigatório."
      });
    }

    const resultado = await pool.query(
      `
        UPDATE eleitores
        SET
          status = $1,
          nome = $2,
          apelido = $3,
          telefone = $4,
          cidade = $5,
          cep = $6,
          endereco = $7,
          bairro = $8,
          numero = $9,
          complemento = $10,
          data_nascimento = $11,
          nome_mae = $12,
          titulo_eleitoral = $13,
          zona = $14,
          secao = $15,
          local_votacao = $16,
          observacao = $17,
          atualizado_em = timezone('America/Sao_Paulo', NOW())

        WHERE id = $18
          AND candidato_id = $19

        RETURNING *
      `,
      [
        dados.status,
        dados.nome,
        dados.apelido,
        dados.telefone,
        dados.cidade,
        dados.cep,
        dados.endereco,
        dados.bairro,
        dados.numero,
        dados.complemento,
        dados.data_nascimento,
        dados.nome_mae,
        dados.titulo_eleitoral,
        dados.zona,
        dados.secao,
        dados.local_votacao,
        dados.observacao,
        id,
        candidatoId
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Eleitor não encontrado."
      });
    }

    return res.json({
      mensagem: "Eleitor atualizado com sucesso.",
      eleitor: resultado.rows[0]
    });
  } catch (error) {
    console.error("Erro ao editar eleitor:", error);

    return res.status(500).json({
      erro: "Erro interno ao editar eleitor.",
      detalhe: error.message
    });
  }
});

// ======================================================
// EXCLUIR ELEITOR
// DELETE /api/eleitores/:id
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    const candidatoId = obterCandidatoId(req);
    const id = validarId(req.params.id);

    if (!candidatoId) {
      return res.status(400).json({
        erro: "Candidato não identificado na sessão."
      });
    }

    if (!id) {
      return res.status(400).json({
        erro: "ID do eleitor inválido."
      });
    }

    const resultado = await pool.query(
      `
        DELETE FROM eleitores
        WHERE id = $1
          AND candidato_id = $2
        RETURNING id, nome
      `,
      [id, candidatoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Eleitor não encontrado."
      });
    }

    return res.json({
      mensagem: "Eleitor excluído com sucesso.",
      eleitor: resultado.rows[0]
    });
  } catch (error) {
    console.error("Erro ao excluir eleitor:", error);

    return res.status(500).json({
      erro: "Erro interno ao excluir eleitor.",
      detalhe: error.message
    });
  }
});

module.exports = router;