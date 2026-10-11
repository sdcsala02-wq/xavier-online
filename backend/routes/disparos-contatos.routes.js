const express = require("express");
const ExcelJS = require("exceljs");
const crypto = require("crypto");
const db = require("../db");

const {
  carregarPlanilhaXlsx,
  criarUploadXlsx,
  planilhaParaObjetos
} = require("../utils/planilha-xlsx");

const router = express.Router();
const upload = criarUploadXlsx();

const STATUS_CONSENTIMENTO = new Set([
  "SEM_REGISTRO",
  "AUTORIZADO",
  "RECUSADO",
  "REVOGADO",
  "BLOQUEADO"
]);

const GENEROS_CONTATO = new Set([
  "HOMEM",
  "MULHER",
  "NAO_INFORMADO"
]);

function textoLimpo(valor, limite = 1000) {
  const texto = String(
    valor === null ||
    valor === undefined
      ? ""
      : valor
  ).trim();

  return texto
    ? texto.slice(0, limite)
    : null;
}

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizarCabecalho(valor) {
  return normalizarTexto(valor)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function interpretarGenero(valor) {
  const normalizado =
    normalizarTexto(valor)
      .replace(/\s+/g, "_");

  const equivalencias = {
    "": "NAO_INFORMADO",
    "H": "HOMEM",
    "HOMEM": "HOMEM",
    "MASCULINO": "HOMEM",
    "MULHER": "MULHER",
    "F": "MULHER",
    "FEMININO": "MULHER",
    "NAO_INFORMADO":
      "NAO_INFORMADO",
    "PREFERE_NAO_INFORMAR":
      "NAO_INFORMADO"
  };

  return (
    equivalencias[
      normalizado
    ] || null
  );
}

function normalizarTelefone(valor) {
  let numeros =
    String(valor || "")
      .replace(/\D/g, "");

  if (numeros.startsWith("00")) {
    numeros =
      numeros.slice(2);
  }

  if (
    numeros.startsWith("0") &&
    (
      numeros.length === 11 ||
      numeros.length === 12
    )
  ) {
    numeros =
      numeros.slice(1);
  }

  if (
    numeros.startsWith("0") &&
    (
      numeros.length === 13 ||
      numeros.length === 14
    )
  ) {
    numeros =
      numeros.slice(3);
  }

  if (
    numeros.length === 10 ||
    numeros.length === 11
  ) {
    numeros =
      `55${numeros}`;
  }

  if (
    !/^55[1-9]\d{9,10}$/.test(
      numeros
    )
  ) {
    return null;
  }

  return numeros;
}

function separarCategorias(valor) {
  const categorias =
    String(valor || "")
      .split(/[;,|]+/)
      .map((item) =>
        textoLimpo(item, 120)
      )
      .filter(Boolean);

  const unicas = new Map();

  for (const categoria of categorias) {
    const chave =
      normalizarTexto(categoria);

    if (chave) {
      unicas.set(
        chave,
        categoria
      );
    }
  }

  return Array.from(
    unicas.entries()
  ).map(([nomeNormalizado, nome]) => ({
    nome,
    nomeNormalizado
  }));
}

function interpretarConsentimento(valor) {
  const normalizado =
    normalizarTexto(valor);

  const equivalencias = {
    "": "SEM_REGISTRO",
    "SEM REGISTRO": "SEM_REGISTRO",
    "SEM_REGISTRO": "SEM_REGISTRO",
    "SIM": "AUTORIZADO",
    "S": "AUTORIZADO",
    "AUTORIZADO": "AUTORIZADO",
    "AUTORIZADA": "AUTORIZADO",
    "PERMITIDO": "AUTORIZADO",
    "NAO": "RECUSADO",
    "N": "RECUSADO",
    "RECUSADO": "RECUSADO",
    "RECUSADA": "RECUSADO",
    "REVOGADO": "REVOGADO",
    "REVOGADA": "REVOGADO",
    "BLOQUEADO": "BLOQUEADO",
    "BLOQUEADA": "BLOQUEADO"
  };

  return (
    equivalencias[normalizado] ||
    null
  );
}

function obterValorLinha(
  linha,
  nomesAceitos
) {
  const campos = new Map(
    Object.entries(linha).map(
      ([chave, valor]) => [
        normalizarCabecalho(chave),
        valor
      ]
    )
  );

  for (const nome of nomesAceitos) {
    const chave =
      normalizarCabecalho(nome);

    if (campos.has(chave)) {
      return campos.get(chave);
    }
  }

  return "";
}

function interpretarBooleano(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    return null;
  }

  const texto =
    String(valor)
      .trim()
      .toLowerCase();

  if (
    texto === "true" ||
    texto === "1" ||
    texto === "sim"
  ) {
    return true;
  }

  if (
    texto === "false" ||
    texto === "0" ||
    texto === "nao" ||
    texto === "não"
  ) {
    return false;
  }

  return null;
}

function tratarUpload(
  req,
  res,
  next
) {
  upload.single("arquivo")(
    req,
    res,
    (erro) => {
      if (!erro) {
        return next();
      }

      return res
        .status(400)
        .json({
          ok: false,
          mensagem:
            erro.message ||
            "Não foi possível receber a planilha."
        });
    }
  );
}

router.get(
  "/contatos/modelo",
  async (req, res) => {
    try {
      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "SDC Serviços de Dados e Comunicação";

      workbook.created =
        new Date();

      const contatos =
        workbook.addWorksheet(
          "Contatos",
          {
            views: [
              {
                state: "frozen",
                ySplit: 1
              }
            ]
          }
        );

      contatos.columns = [
        {
          header: "Nome",
          key: "nome",
          width: 28
        },
        {
          header: "Gênero",
          key: "genero",
          width: 20
        },
        {
          header: "Telefone",
          key: "telefone",
          width: 20,
          style: {
            numFmt: "@"
          }
        },
        {
          header: "Categorias",
          key: "categorias",
          width: 38
        },
        {
          header: "Bairro",
          key: "bairro",
          width: 24
        },
        {
          header: "Cidade",
          key: "cidade",
          width: 24
        },
        {
          header: "Consentimento",
          key: "consentimento",
          width: 22
        },
        {
          header:
            "Data do consentimento",
          key: "dataConsentimento",
          width: 24
        },
        {
          header: "Origem",
          key: "origem",
          width: 24
        },
        {
          header: "Observação",
          key: "observacao",
          width: 40
        }
      ];

      const cabecalho =
        contatos.getRow(1);

      cabecalho.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF"
        }
      };

      cabecalho.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF12335B"
        }
      };

      cabecalho.alignment = {
        vertical: "middle",
        horizontal: "center"
      };

      cabecalho.height = 28;

      contatos.autoFilter = {
        from: "A1",
        to: "J1"
      };

      contatos.getColumn(2)
        .eachCell(
          {
            includeEmpty: true
          },
          (
            celula,
            numeroLinha
          ) => {
            if (
              numeroLinha > 1
            ) {
              celula.dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                  '"HOMEM,MULHER,NAO_INFORMADO"'
                ]
              };
            }
          }
        );

      contatos.getColumn(7)
        .eachCell(
          {
            includeEmpty: true
          },
          (celula, numeroLinha) => {
            if (numeroLinha > 1) {
              celula.dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [
                  '"AUTORIZADO,RECUSADO,REVOGADO,BLOQUEADO,SEM_REGISTRO"'
                ]
              };
            }
          }
        );

      const instrucoes =
        workbook.addWorksheet(
          "Instruções"
        );

      instrucoes.columns = [
        {
          header: "Campo",
          key: "campo",
          width: 28
        },
        {
          header: "Orientação",
          key: "orientacao",
          width: 95
        }
      ];

      instrucoes.addRows([
        {
          campo: "Telefone",
          orientacao:
            "Obrigatório. Pode conter espaços, parênteses e hífens. O sistema padronizará como 55 + DDD + número."
        },
        {
          campo: "Gênero",
          orientacao:
            "Informe HOMEM ou MULHER somente quando declarado pelo contato. Quando não houver informação, use NAO_INFORMADO."
        },
        {
          campo: "Categorias",
          orientacao:
            "Use ponto e vírgula para várias categorias. Exemplo: Saúde; Caiçara; Lideranças."
        },
        {
          campo: "Consentimento",
          orientacao:
            "Use AUTORIZADO somente quando existir autorização válida do contato."
        },
        {
          campo:
            "Data do consentimento",
          orientacao:
            "Informe a data correspondente à autorização ou à alteração do consentimento."
        },
        {
          campo: "Segurança",
          orientacao:
            "Contatos recusados, revogados ou bloqueados não poderão ser liberados por uma nova importação comum."
        },
        {
          campo: "Duplicidade",
          orientacao:
            "O telefone identifica o contato. Telefones repetidos serão atualizados e suas categorias serão reunidas."
        },
        {
          campo: "Envio",
          orientacao:
            "A importação não envia mensagens e não habilita o serviço de disparo."
        }
      ]);

      const instrucaoCabecalho =
        instrucoes.getRow(1);

      instrucaoCabecalho.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF"
        }
      };

      instrucaoCabecalho.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF12335B"
        }
      };

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="MODELO-CONTATOS-DISPAROS.xlsx"'
      );

      await workbook.xlsx.write(res);

      return res.end();
    } catch (erro) {
      console.error(
        "Erro ao gerar modelo de contatos:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Não foi possível gerar o modelo."
        });
    }
  }
);

router.get(
  "/categorias",
  async (req, res) => {
    try {
      const somenteAtivas =
        interpretarBooleano(
          req.query.ativo
        );

      const parametros = [];
      const condicoes = [];

      if (somenteAtivas !== null) {
        parametros.push(
          somenteAtivas
        );

        condicoes.push(
          `dc.ativo = $${parametros.length}`
        );
      }

      const where =
        condicoes.length
          ? `WHERE ${condicoes.join(" AND ")}`
          : "";

      const { rows } =
        await db.query(
          `
          SELECT
            dc.id,
            dc.nome,
            dc.nome_normalizado AS "nomeNormalizado",
            dc.descricao,
            dc.ativo,
            dc.criado_em AS "criadoEm",
            COUNT(
              dcc.contato_id
            )::INTEGER AS "totalContatos"
          FROM disparos_categorias dc
          LEFT JOIN
            disparos_contatos_categorias dcc
            ON dcc.categoria_id = dc.id
          ${where}
          GROUP BY
            dc.id
          ORDER BY
            dc.nome
          `,
          parametros
        );

      return res.json({
        ok: true,
        total: rows.length,
        categorias: rows
      });
    } catch (erro) {
      console.error(
        "Erro ao listar categorias:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Não foi possível listar as categorias."
        });
    }
  }
);

router.get(
  "/contatos",
  async (req, res) => {
    try {
      const pagina =
        Math.max(
          1,
          Number.parseInt(
            req.query.pagina,
            10
          ) || 1
        );

      const limite =
        Math.min(
          200,
          Math.max(
            1,
            Number.parseInt(
              req.query.limite,
              10
            ) || 50
          )
        );

      const deslocamento =
        (pagina - 1) * limite;

      const parametros = [];
      const condicoes = [];

      const pesquisa =
        textoLimpo(
          req.query.busca,
          200
        );

      if (pesquisa) {
        parametros.push(
          `%${pesquisa}%`
        );

        const posicao =
          parametros.length;

        condicoes.push(
          `(
            dc.nome ILIKE $${posicao}
            OR dc.telefone_normalizado ILIKE $${posicao}
            OR dc.bairro ILIKE $${posicao}
            OR dc.cidade ILIKE $${posicao}
          )`
        );
      }

      const categoriaId =
        Number.parseInt(
          req.query.categoriaId,
          10
        );

      if (
        Number.isInteger(categoriaId) &&
        categoriaId > 0
      ) {
        parametros.push(
          categoriaId
        );

        condicoes.push(
          `EXISTS (
            SELECT 1
            FROM disparos_contatos_categorias filtro
            WHERE filtro.contato_id = dc.id
              AND filtro.categoria_id =
                $${parametros.length}
          )`
        );
      }

      const consentimento =
        normalizarTexto(
          req.query.consentimento
        ).replace(/\s+/g, "_");

      if (
        consentimento &&
        STATUS_CONSENTIMENTO.has(
          consentimento
        )
      ) {
        parametros.push(
          consentimento
        );

        condicoes.push(
          `COALESCE(
            dcon.status,
            'SEM_REGISTRO'
          ) = $${parametros.length}`
        );
      }

      const genero =
        normalizarTexto(
          req.query.genero
        ).replace(/\s+/g, "_");

      if (
        genero &&
        GENEROS_CONTATO.has(genero)
      ) {
        parametros.push(genero);

        condicoes.push(
          `dc.genero = $${parametros.length}`
        );
      }

      const ativo =
        interpretarBooleano(
          req.query.ativo
        );

      if (ativo !== null) {
        parametros.push(ativo);

        condicoes.push(
          `dc.ativo = $${parametros.length}`
        );
      }

      const where =
        condicoes.length
          ? `WHERE ${condicoes.join(" AND ")}`
          : "";

      const { rows: totalRows } =
        await db.query(
          `
          SELECT
            COUNT(*)::INTEGER AS total
          FROM disparos_contatos dc
          LEFT JOIN disparos_consentimentos dcon
            ON dcon.telefone_normalizado =
              dc.telefone_normalizado
          ${where}
          `,
          parametros
        );

      const parametrosLista = [
        ...parametros,
        limite,
        deslocamento
      ];

      const posicaoLimite =
        parametros.length + 1;

      const posicaoDeslocamento =
        parametros.length + 2;

      const { rows } =
        await db.query(
          `
          SELECT
            dc.id,
            dc.nome,
            dc.genero,
            dc.telefone_original AS "telefoneOriginal",
            dc.telefone_normalizado AS "telefoneNormalizado",
            dc.bairro,
            dc.cidade,
            dc.origem,
            dc.observacao,
            dc.ativo,
            dc.criado_em AS "criadoEm",
            dc.atualizado_em AS "atualizadoEm",
            COALESCE(
              dcon.status,
              'SEM_REGISTRO'
            ) AS consentimento,
            COALESCE(
              (
                SELECT JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id',
                    cat.id,
                    'nome',
                    cat.nome
                  )
                  ORDER BY cat.nome
                )
                FROM disparos_contatos_categorias vinculo
                JOIN disparos_categorias cat
                  ON cat.id =
                    vinculo.categoria_id
                WHERE vinculo.contato_id =
                  dc.id
              ),
              '[]'::JSON
            ) AS categorias
          FROM disparos_contatos dc
          LEFT JOIN disparos_consentimentos dcon
            ON dcon.telefone_normalizado =
              dc.telefone_normalizado
          ${where}
          ORDER BY
            dc.nome NULLS LAST,
            dc.id
          LIMIT $${posicaoLimite}
          OFFSET $${posicaoDeslocamento}
          `,
          parametrosLista
        );

      const total =
        totalRows[0]?.total || 0;

      return res.json({
        ok: true,
        total,
        pagina,
        limite,
        totalPaginas:
          Math.max(
            1,
            Math.ceil(total / limite)
          ),
        contatos: rows
      });
    } catch (erro) {
      console.error(
        "Erro ao listar contatos:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Não foi possível listar os contatos."
        });
    }
  }
);

router.get(
  "/publico/estimativa",
  async (req, res) => {
    try {
      const categoriaBruta =
        textoLimpo(
          req.query.categoriaId,
          40
        );

      const categoriaId =
        categoriaBruta
          ? Number.parseInt(
              categoriaBruta,
              10
            )
          : null;

      if (
        categoriaBruta &&
        (!Number.isInteger(categoriaId) ||
          categoriaId <= 0 ||
          String(categoriaId) !==
            categoriaBruta)
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Categoria inválida."
        });
      }

      const genero =
        normalizarTexto(
          req.query.genero
        ).replace(/\s+/g, "_");

      const generoInformado =
        textoLimpo(
          req.query.genero,
          40
        );

      if (
        generoInformado &&
        !GENEROS_CONTATO.has(genero)
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Gênero inválido."
        });
      }

      const bairro =
        textoLimpo(
          req.query.bairro,
          160
        );

      if (categoriaId) {
        const categoria =
          await db.query(
            `
            SELECT id
            FROM disparos_categorias
            WHERE id = $1
              AND ativo = TRUE
            `,
            [categoriaId]
          );

        if (categoria.rows.length === 0) {
          return res.status(400).json({
            ok: false,
            mensagem:
              "Categoria não encontrada."
          });
        }
      }

      const parametros = [];
      const condicoes = [
        "dc.ativo = TRUE"
      ];

      if (categoriaId) {
        parametros.push(categoriaId);
        condicoes.push(`
          EXISTS (
            SELECT 1
            FROM disparos_contatos_categorias dcc
            WHERE dcc.contato_id = dc.id
              AND dcc.categoria_id =
                $${parametros.length}
          )
        `);
      }

      if (generoInformado) {
        parametros.push(genero);
        condicoes.push(
          `dc.genero = $${parametros.length}`
        );
      }

      if (bairro) {
        parametros.push(bairro);
        condicoes.push(`
          UPPER(BTRIM(COALESCE(dc.bairro, ''))) =
          UPPER(BTRIM($${parametros.length}))
        `);
      }

      const { rows } =
        await db.query(
          `
          SELECT
            COUNT(DISTINCT dc.telefone_normalizado)::INTEGER
              AS total_filtrados,
            COUNT(DISTINCT dc.telefone_normalizado)
              FILTER (
                WHERE dcon.status = 'AUTORIZADO'
              )::INTEGER
              AS total_autorizados,
            COUNT(DISTINCT dc.telefone_normalizado)
              FILTER (
                WHERE COALESCE(
                  dcon.status,
                  'SEM_REGISTRO'
                ) <> 'AUTORIZADO'
              )::INTEGER
              AS total_bloqueados
          FROM disparos_contatos dc
          LEFT JOIN disparos_consentimentos dcon
            ON dcon.telefone_normalizado =
              dc.telefone_normalizado
          WHERE ${condicoes.join(" AND ")}
          `,
          parametros
        );

      const resultado = rows[0];

      return res.json({
        ok: true,
        totalFiltrados:
          resultado.total_filtrados || 0,
        totalAutorizados:
          resultado.total_autorizados || 0,
        totalBloqueados:
          resultado.total_bloqueados || 0,
        contatosUnicos: true,
        envioHabilitado: false
      });
    } catch (erro) {
      console.error(
        "Erro ao estimar público:",
        erro
      );

      return res.status(500).json({
        ok: false,
        mensagem:
          "Não foi possível calcular o público."
      });
    }
  }
);

router.get(
  "/importacoes",
  async (req, res) => {
    try {
      const limite =
        Math.min(
          100,
          Math.max(
            1,
            Number.parseInt(
              req.query.limite,
              10
            ) || 30
          )
        );

      const { rows } =
        await db.query(
          `
          SELECT
            di.id,
            di.nome_arquivo AS "nomeArquivo",
            di.hash_arquivo AS "hashArquivo",
            di.status,
            di.total_linhas AS "totalLinhas",
            di.total_inseridos AS "totalInseridos",
            di.total_atualizados AS "totalAtualizados",
            di.total_ignorados AS "totalIgnorados",
            di.total_erros AS "totalErros",
            di.resumo,
            di.iniciado_em AS "iniciadoEm",
            di.concluido_em AS "concluidoEm",
            u.nome AS "criadoPorNome"
          FROM disparos_importacoes di
          LEFT JOIN usuarios u
            ON u.id = di.criado_por
          ORDER BY
            di.iniciado_em DESC
          LIMIT $1
          `,
          [limite]
        );

      return res.json({
        ok: true,
        total: rows.length,
        importacoes: rows
      });
    } catch (erro) {
      console.error(
        "Erro ao listar importações:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Não foi possível listar as importações."
        });
    }
  }
);

function normalizarDataConsentimento(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  if (
    valor instanceof Date &&
    !Number.isNaN(valor.getTime())
  ) {
    return valor.toISOString();
  }

  const texto =
    String(valor).trim();

  const brasileiro =
    texto.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (brasileiro) {
    const [, dia, mes, ano] =
      brasileiro;

    const data =
      new Date(
        Date.UTC(
          Number(ano),
          Number(mes) - 1,
          Number(dia)
        )
      );

    if (
      data.getUTCFullYear() ===
        Number(ano) &&
      data.getUTCMonth() ===
        Number(mes) - 1 &&
      data.getUTCDate() ===
        Number(dia)
    ) {
      return data.toISOString();
    }

    return null;
  }

  const timestamp =
    Date.parse(texto);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(
    timestamp
  ).toISOString();
}

function valoresDiferentes(
  anterior,
  novo
) {
  if (
    novo === null ||
    novo === undefined
  ) {
    return false;
  }

  return (
    String(anterior || "").trim() !==
    String(novo).trim()
  );
}

async function registrarItemImportacao(
  client,
  {
    importacaoId,
    linhaPlanilha,
    contatoId = null,
    acao,
    telefoneInformado = null,
    detalhes = {}
  }
) {
  await client.query(
    `
    INSERT INTO disparos_importacoes_itens (
      importacao_id,
      linha_planilha,
      contato_id,
      acao,
      telefone_informado,
      detalhes
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::JSONB
    )
    `,
    [
      importacaoId,
      linhaPlanilha,
      contatoId,
      acao,
      textoLimpo(
        telefoneInformado,
        50
      ),
      JSON.stringify(detalhes)
    ]
  );
}

async function salvarConsentimento(
  client,
  {
    telefoneNormalizado,
    statusInformado,
    origem,
    dataConsentimento,
    importacaoId,
    linhaPlanilha,
    usuarioId
  }
) {
  const prioridades = {
    SEM_REGISTRO: 0,
    AUTORIZADO: 1,
    RECUSADO: 2,
    REVOGADO: 3,
    BLOQUEADO: 4
  };

  const { rows } =
    await client.query(
      `
      SELECT
        id,
        status
      FROM disparos_consentimentos
      WHERE telefone_normalizado = $1
      FOR UPDATE
      `,
      [telefoneNormalizado]
    );

  const anterior =
    rows[0] || null;

  let statusFinal =
    statusInformado;

  if (anterior) {
    const prioridadeAnterior =
      prioridades[anterior.status] ?? 0;

    const prioridadeInformada =
      prioridades[statusInformado] ?? 0;

    statusFinal =
      prioridadeAnterior >
      prioridadeInformada
        ? anterior.status
        : statusInformado;
  }

  const comprovante = {
    tipo:
      "IMPORTACAO_XLSX",
    importacaoId,
    linhaPlanilha,
    statusInformado,
    statusAplicado:
      statusFinal,
    dataConsentimento,
    registradoEm:
      new Date().toISOString()
  };

  if (!anterior) {
    await client.query(
      `
      INSERT INTO disparos_consentimentos (
        telefone_normalizado,
        status,
        origem,
        comprovante,
        registrado_por
      )
      VALUES (
        $1,
        $2,
        $3,
        $4::JSONB,
        $5
      )
      `,
      [
        telefoneNormalizado,
        statusFinal,
        origem,
        JSON.stringify(
          comprovante
        ),
        usuarioId
      ]
    );

    return {
      alterado: true,
      statusAnterior: null,
      statusFinal
    };
  }

  const statusAlterado =
    anterior.status !==
    statusFinal;

  await client.query(
    `
    UPDATE disparos_consentimentos
    SET
      status = $1,
      origem =
        COALESCE(
          $2,
          origem
        ),
      comprovante =
        comprovante ||
        $3::JSONB,
      registrado_por = $4,
      atualizado_em = NOW()
    WHERE id = $5
    `,
    [
      statusFinal,
      origem,
      JSON.stringify(
        comprovante
      ),
      usuarioId,
      anterior.id
    ]
  );

  return {
    alterado:
      statusAlterado,
    statusAnterior:
      anterior.status,
    statusFinal
  };
}

async function salvarCategorias(
  client,
  {
    contatoId,
    categorias,
    usuarioId
  }
) {
  let novosVinculos = 0;

  for (const categoria of categorias) {
    const { rows } =
      await client.query(
        `
        INSERT INTO disparos_categorias (
          nome,
          nome_normalizado,
          criado_por
        )
        VALUES (
          $1,
          $2,
          $3
        )
        ON CONFLICT (
          nome_normalizado
        )
        DO UPDATE SET
          nome =
            EXCLUDED.nome,
          ativo = TRUE
        RETURNING id
        `,
        [
          categoria.nome,
          categoria.nomeNormalizado,
          usuarioId
        ]
      );

    const categoriaId =
      rows[0].id;

    const resultadoVinculo =
      await client.query(
        `
        INSERT INTO
          disparos_contatos_categorias (
            contato_id,
            categoria_id,
            vinculado_por
          )
        VALUES (
          $1,
          $2,
          $3
        )
        ON CONFLICT (
          contato_id,
          categoria_id
        )
        DO NOTHING
        `,
        [
          contatoId,
          categoriaId,
          usuarioId
        ]
      );

    novosVinculos +=
      resultadoVinculo.rowCount;
  }

  return novosVinculos;
}

async function salvarContatoImportado(
  client,
  {
    nome,
    genero,
    telefoneOriginal,
    telefoneNormalizado,
    bairro,
    cidade,
    origem,
    observacao,
    importacaoId,
    usuarioId,
    linhaPlanilha
  }
) {
  const { rows } =
    await client.query(
      `
      SELECT
        id,
        nome,
        genero,
        telefone_original,
        bairro,
        cidade,
        origem,
        observacao
      FROM disparos_contatos
      WHERE telefone_normalizado = $1
      FOR UPDATE
      `,
      [telefoneNormalizado]
    );

  const anterior =
    rows[0] || null;

  const metadados = {
    ultimaOrigem:
      "IMPORTACAO_XLSX",
    ultimaImportacaoId:
      importacaoId,
    ultimaLinhaPlanilha:
      linhaPlanilha
  };

  if (!anterior) {
    const resultado =
      await client.query(
        `
        INSERT INTO disparos_contatos (
          nome,
          genero,
          telefone_original,
          telefone_normalizado,
          bairro,
          cidade,
          origem,
          observacao,
          ultima_importacao_id,
          criado_por,
          metadados
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
          $11::JSONB
        )
        RETURNING id
        `,
        [
          nome,
          genero,
          telefoneOriginal,
          telefoneNormalizado,
          bairro,
          cidade,
          origem,
          observacao,
          importacaoId,
          usuarioId,
          JSON.stringify(
            metadados
          )
        ]
      );

    return {
      contatoId:
        resultado.rows[0].id,
      inserido: true,
      alterado: true
    };
  }

  const alterado =
    valoresDiferentes(
      anterior.nome,
      nome
    ) ||
    valoresDiferentes(
      anterior.genero,
      genero
    ) ||
    valoresDiferentes(
      anterior.telefone_original,
      telefoneOriginal
    ) ||
    valoresDiferentes(
      anterior.bairro,
      bairro
    ) ||
    valoresDiferentes(
      anterior.cidade,
      cidade
    ) ||
    valoresDiferentes(
      anterior.origem,
      origem
    ) ||
    valoresDiferentes(
      anterior.observacao,
      observacao
    );

  await client.query(
    `
    UPDATE disparos_contatos
    SET
      nome =
        COALESCE(
          $1,
          nome
        ),
      genero = $2,
      telefone_original =
        COALESCE(
          $3,
          telefone_original
        ),
      bairro =
        COALESCE(
          $4,
          bairro
        ),
      cidade =
        COALESCE(
          $5,
          cidade
        ),
      origem =
        COALESCE(
          $6,
          origem
        ),
      observacao =
        COALESCE(
          $7,
          observacao
        ),
      ultima_importacao_id = $8,
      metadados =
        metadados ||
        $9::JSONB
    WHERE id = $10
    `,
    [
      nome,
      genero,
      telefoneOriginal,
      bairro,
      cidade,
      origem,
      observacao,
      importacaoId,
      JSON.stringify(
        metadados
      ),
      anterior.id
    ]
  );

  return {
    contatoId:
      anterior.id,
    inserido: false,
    alterado
  };
}

router.post(
  "/contatos/importar",
  tratarUpload,
  async (req, res) => {
    let client = null;
    let transacaoAtiva = false;

    try {
      if (
        !req.file ||
        !Buffer.isBuffer(
          req.file.buffer
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "Selecione uma planilha XLSX."
          });
      }

      const usuarioId =
        Number(
          req.usuario?.id
        );

      if (
        !Number.isInteger(
          usuarioId
        ) ||
        usuarioId <= 0
      ) {
        return res
          .status(403)
          .json({
            ok: false,
            mensagem:
              "Usuário administrativo inválido."
          });
      }

      const hashArquivo =
        crypto
          .createHash("sha256")
          .update(
            req.file.buffer
          )
          .digest("hex");

      const workbook =
        await carregarPlanilhaXlsx(
          req.file.buffer
        );

      const worksheet =
        workbook.worksheets.find(
          (planilha) =>
            normalizarTexto(
              planilha.name
            ) === "CONTATOS"
        ) ||
        workbook.worksheets[0];

      if (!worksheet) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "A planilha não possui nenhuma aba."
          });
      }

      const cabecalhos =
        worksheet
          .getRow(1)
          .values
          .slice(1)
          .map(
            normalizarCabecalho
          );

      if (
        !cabecalhos.includes(
          "TELEFONE"
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              'A coluna obrigatória "Telefone" não foi encontrada.'
          });
      }

      const linhas =
        planilhaParaObjetos(
          worksheet,
          {
            defval: "",
            blankrows: false
          }
        );

      if (linhas.length === 0) {
        return res
          .status(400)
          .json({
            ok: false,
            mensagem:
              "A planilha não possui contatos para importar."
          });
      }

      client =
        await db.connect();

      await client.query(
        "BEGIN"
      );

      transacaoAtiva = true;

      await client.query(
        `
        SELECT
          pg_advisory_xact_lock(
            hashtext($1)
          )
        `,
        [hashArquivo]
      );

      const importacaoAnterior =
        await client.query(
          `
          SELECT
            id,
            status,
            concluido_em
          FROM disparos_importacoes
          WHERE hash_arquivo = $1
            AND status IN (
              'CONCLUIDA',
              'CONCLUIDA_COM_ALERTAS'
            )
          ORDER BY
            id DESC
          LIMIT 1
          `,
          [hashArquivo]
        );

      if (
        importacaoAnterior.rows.length
      ) {
        await client.query(
          "ROLLBACK"
        );

        transacaoAtiva = false;

        return res
          .status(409)
          .json({
            ok: false,
            mensagem:
              "Esta planilha já foi importada.",
            importacaoAnterior:
              importacaoAnterior.rows[0]
          });
      }

      const resultadoImportacao =
        await client.query(
          `
          INSERT INTO disparos_importacoes (
            nome_arquivo,
            hash_arquivo,
            status,
            total_linhas,
            criado_por,
            resumo
          )
          VALUES (
            $1,
            $2,
            'PROCESSANDO',
            $3,
            $4,
            $5::JSONB
          )
          RETURNING id
          `,
          [
            textoLimpo(
              req.file.originalname,
              255
            ) ||
              "planilha-contatos.xlsx",
            hashArquivo,
            linhas.length,
            usuarioId,
            JSON.stringify({
              aba:
                worksheet.name,
              formato:
                "XLSX"
            })
          ]
        );

      const importacaoId =
        resultadoImportacao.rows[0].id;

      const totais = {
        linhas:
          linhas.length,
        inseridos: 0,
        atualizados: 0,
        ignorados: 0,
        erros: 0,
        categoriasVinculadas: 0
      };

      const alertas = [];

      for (
        let indice = 0;
        indice < linhas.length;
        indice += 1
      ) {
        const linha =
          linhas[indice];

        const linhaPlanilha =
          indice + 2;

        const savepoint =
          `linha_importacao_${linhaPlanilha}`;

        const telefoneOriginal =
          textoLimpo(
            obterValorLinha(
              linha,
              [
                "Telefone",
                "Celular",
                "WhatsApp"
              ]
            ),
            50
          );

        await client.query(
          `SAVEPOINT ${savepoint}`
        );

        try {
          const telefoneNormalizado =
            normalizarTelefone(
              telefoneOriginal
            );

          if (!telefoneNormalizado) {
            throw new Error(
              "Telefone ausente ou inválido."
            );
          }

          const nome =
            textoLimpo(
              obterValorLinha(
                linha,
                ["Nome"]
              ),
              200
            );

          const generoBruto =
            obterValorLinha(
              linha,
              ["Gênero", "Genero", "Sexo"]
            );

          const genero =
            interpretarGenero(
              generoBruto
            );

          if (!genero) {
            throw new Error(
              "Gênero inválido. Utilize HOMEM, MULHER ou NAO_INFORMADO."
            );
          }

          const bairro =
            textoLimpo(
              obterValorLinha(
                linha,
                ["Bairro"]
              ),
              160
            );

          const cidade =
            textoLimpo(
              obterValorLinha(
                linha,
                ["Cidade", "Município"]
              ),
              160
            );

          const origem =
            textoLimpo(
              obterValorLinha(
                linha,
                ["Origem"]
              ),
              100
            ) ||
            "IMPORTACAO_XLSX";

          const observacao =
            textoLimpo(
              obterValorLinha(
                linha,
                [
                  "Observação",
                  "Observacao"
                ]
              ),
              3000
            );

          const categorias =
            separarCategorias(
              obterValorLinha(
                linha,
                [
                  "Categorias",
                  "Categoria"
                ]
              )
            );

          const consentimentoBruto =
            obterValorLinha(
              linha,
              [
                "Consentimento",
                "Autorização",
                "Autorizacao"
              ]
            );

          const statusConsentimento =
            interpretarConsentimento(
              consentimentoBruto
            );

          if (!statusConsentimento) {
            throw new Error(
              "Consentimento inválido. Utilize AUTORIZADO, RECUSADO, REVOGADO, BLOQUEADO ou SEM_REGISTRO."
            );
          }

          const dataBruta =
            obterValorLinha(
              linha,
              [
                "Data do consentimento",
                "Data consentimento"
              ]
            );

          const dataConsentimento =
            normalizarDataConsentimento(
              dataBruta
            );

          if (
            textoLimpo(
              dataBruta,
              100
            ) &&
            !dataConsentimento
          ) {
            throw new Error(
              "Data do consentimento inválida."
            );
          }

          const resultadoContato =
            await salvarContatoImportado(
              client,
              {
                nome,
                genero,
                telefoneOriginal,
                telefoneNormalizado,
                bairro,
                cidade,
                origem,
                observacao,
                importacaoId,
                usuarioId,
                linhaPlanilha
              }
            );

          const novosVinculos =
            await salvarCategorias(
              client,
              {
                contatoId:
                  resultadoContato.contatoId,
                categorias,
                usuarioId
              }
            );

          const consentimento =
            await salvarConsentimento(
              client,
              {
                telefoneNormalizado,
                statusInformado:
                  statusConsentimento,
                origem,
                dataConsentimento,
                importacaoId,
                linhaPlanilha,
                usuarioId
              }
            );

          totais.categoriasVinculadas +=
            novosVinculos;

          let acao =
            "IGNORADO";

          if (
            resultadoContato.inserido
          ) {
            acao =
              "INSERIDO";

            totais.inseridos += 1;
          } else if (
            resultadoContato.alterado ||
            novosVinculos > 0 ||
            consentimento.alterado
          ) {
            acao =
              "ATUALIZADO";

            totais.atualizados += 1;
          } else {
            totais.ignorados += 1;
          }

          await registrarItemImportacao(
            client,
            {
              importacaoId,
              linhaPlanilha,
              contatoId:
                resultadoContato.contatoId,
              acao,
              telefoneInformado:
                telefoneOriginal,
              detalhes: {
                genero,
                categorias:
                  categorias.map(
                    (item) =>
                      item.nome
                  ),
                novosVinculos,
                consentimentoInformado:
                  statusConsentimento,
                consentimentoAplicado:
                  consentimento.statusFinal,
                consentimentoAnterior:
                  consentimento.statusAnterior
              }
            }
          );

          await client.query(
            `RELEASE SAVEPOINT ${savepoint}`
          );
        } catch (erroLinha) {
          await client.query(
            `ROLLBACK TO SAVEPOINT ${savepoint}`
          );

          totais.erros += 1;

          const mensagem =
            String(
              erroLinha.message ||
              "Erro desconhecido."
            ).slice(0, 500);

          alertas.push({
            linha:
              linhaPlanilha,
            mensagem
          });

          await registrarItemImportacao(
            client,
            {
              importacaoId,
              linhaPlanilha,
              acao: "ERRO",
              telefoneInformado:
                telefoneOriginal,
              detalhes: {
                mensagem
              }
            }
          );

          await client.query(
            `RELEASE SAVEPOINT ${savepoint}`
          );
        }
      }

      const statusFinal =
        totais.erros > 0
          ? "CONCLUIDA_COM_ALERTAS"
          : "CONCLUIDA";

      const resumo = {
        aba:
          worksheet.name,
        hashArquivo,
        categoriasVinculadas:
          totais.categoriasVinculadas,
        alertas:
          alertas.slice(0, 100),
        envioRealizado: false
      };

      await client.query(
        `
        UPDATE disparos_importacoes
        SET
          status = $1,
          total_inseridos = $2,
          total_atualizados = $3,
          total_ignorados = $4,
          total_erros = $5,
          resumo = $6::JSONB,
          concluido_em = NOW()
        WHERE id = $7
        `,
        [
          statusFinal,
          totais.inseridos,
          totais.atualizados,
          totais.ignorados,
          totais.erros,
          JSON.stringify(
            resumo
          ),
          importacaoId
        ]
      );

      await client.query(
        "COMMIT"
      );

      transacaoAtiva = false;

      return res.json({
        ok: true,
        mensagem:
          totais.erros > 0
            ? "Importação concluída com alertas."
            : "Importação concluída com sucesso.",
        importacaoId,
        status:
          statusFinal,
        totais,
        alertas:
          alertas.slice(0, 100),
        mensagensEnviadas: 0
      });
    } catch (erro) {
      if (
        client &&
        transacaoAtiva
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      console.error(
        "Erro ao importar contatos:",
        erro
      );

      return res
        .status(500)
        .json({
          ok: false,
          mensagem:
            "Não foi possível importar a planilha.",
          erro:
            erro.message
        });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;