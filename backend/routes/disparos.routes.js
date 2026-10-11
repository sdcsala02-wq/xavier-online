const express = require("express");
const db = require("../db");

const {
  enviarTemplateWhatsApp
} = require("../services/whatsapp.service");

const router = express.Router();

const BASES_VALIDAS =
  new Set([
    "CIDADAOS",
    "ELEITORES",
    "LIDERANCAS",
    "CONTATOS"
  ]);

const GENEROS_CONTATO =
  new Set([
    "TODOS",
    "HOMEM",
    "MULHER",
    "NAO_INFORMADO"
  ]);

const TIPOS_VALIDOS =
  new Set([
    "TEMPLATE_OFICIAL",
    "JANELA_24H"
  ]);

const STATUS_CONSENTIMENTO =
  new Set([
    "SEM_REGISTRO",
    "AUTORIZADO",
    "RECUSADO",
    "REVOGADO",
    "BLOQUEADO"
  ]);

const STATUS_TEMPLATE =
  new Set([
    "RASCUNHO",
    "EM_ANALISE",
    "APROVADO",
    "REJEITADO",
    "PAUSADO"
  ]);

const CATEGORIAS_TEMPLATE =
  new Set([
    "MARKETING",
    "UTILITY",
    "AUTHENTICATION"
  ]);

function texto(valor) {
  return String(valor || "")
    .trim();
}

function codigo(valor) {
  return texto(valor)
    .toUpperCase();
}

function inteiroPositivo(valor) {
  const numero = Number(valor);

  return (
    Number.isInteger(numero) &&
    numero > 0
  )
    ? numero
    : null;
}

function normalizarTelefone(valor) {
  let telefone =
    String(valor || "")
      .replace(/\D/g, "");

  if (telefone.startsWith("00")) {
    telefone =
      telefone.slice(2);
  }

  if (
    telefone.startsWith("55") &&
    telefone.length > 13
  ) {
    telefone =
      telefone.slice(2);
  }

  if (
    telefone.length === 10 ||
    telefone.length === 11
  ) {
    telefone =
      `55${telefone}`;
  }

  if (
    !/^55\d{10,11}$/.test(
      telefone
    )
  ) {
    return null;
  }

  return telefone;
}

function usuarioAdministrador(req) {
  return (
    codigo(
      req.usuario?.perfil
    ) === "ADMIN"
  );
}

function exigirAdministrador(
  req,
  res
) {
  if (!usuarioAdministrador(req)) {
    res.status(403).json({
      ok: false,
      mensagem:
        "Somente administradores podem executar esta operação."
    });

    return false;
  }

  return true;
}

function prepararCampanha(row) {
  return {
    id: row.id,
    nome: row.nome,
    baseDestinatarios:
      row.base_destinatarios,
    filtros:
      row.filtros || {},
    tipoMensagem:
      row.tipo_mensagem,
    templateId:
      row.template_id,
    mensagemPrevia:
      row.mensagem_previa,
    status:
      row.status,
    modoPreparacao:
      row.modo_preparacao,
    agendadaPara:
      row.agendada_para,
    criadoPor:
      row.criado_por,
    aprovadoPor:
      row.aprovado_por,
    aprovadoEm:
      row.aprovado_em,
    motivoRejeicao:
      row.motivo_rejeicao,
    criadoEm:
      row.criado_em,
    atualizadoEm:
      row.atualizado_em,
    totalDestinatarios:
      Number(
        row.total_destinatarios || 0
      )
  };
}

async function registrarAuditoria(
  client,
  req,
  {
    campanhaId = null,
    acao,
    dadosAnteriores = null,
    dadosNovos = null
  }
) {
  await client.query(
    `
    INSERT INTO disparos_auditoria (
      campanha_id,
      usuario_executor_id,
      acao,
      dados_anteriores,
      dados_novos,
      endereco_ip
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      campanhaId,
      req.usuario.id,
      acao,
      dadosAnteriores,
      dadosNovos,
      req.ip ||
        req.socket?.remoteAddress ||
        null
    ]
  );
}

function responderErro(
  res,
  erro,
  operacao
) {
  if (
    erro.code === "23505"
  ) {
    return res.status(409).json({
      ok: false,
      mensagem:
        "Já existe um registro com essas informações."
    });
  }

  if (
    erro.code === "23503" ||
    erro.code === "23514"
  ) {
    return res.status(400).json({
      ok: false,
      mensagem:
        "Os dados informados não são válidos."
    });
  }

  console.error(
    `Erro ao ${operacao}:`,
    erro
  );

  return res.status(500).json({
    ok: false,
    mensagem:
      `Erro interno ao ${operacao}.`
  });
}

router.get(
  "/resumo",
  async (req, res) => {
    try {
      const resultado =
        await db.query(`
          SELECT
            COUNT(*)::INTEGER
              AS campanhas,

            COUNT(*) FILTER (
              WHERE status = 'RASCUNHO'
            )::INTEGER
              AS rascunhos,

            COUNT(*) FILTER (
              WHERE status =
                'AGUARDANDO_APROVACAO'
            )::INTEGER
              AS aguardando_aprovacao,

            (
              SELECT COUNT(*)::INTEGER
              FROM disparos_destinatarios
            ) AS destinatarios,

            (
              SELECT COUNT(*)::INTEGER
              FROM disparos_consentimentos
              WHERE status = 'AUTORIZADO'
            ) AS consentimentos_autorizados,

            (
              SELECT COUNT(*)::INTEGER
              FROM disparos_tentativas
              WHERE status = 'ERRO_TECNICO'
            ) AS falhas
          FROM disparos_campanhas
        `);

      return res.json({
        ok: true,
        modoPreparacao: true,
        enviosHabilitados: false,
        resumo:
          resultado.rows[0]
      });
    } catch (erro) {
      return responderErro(
        res,
        erro,
        "carregar resumo dos disparos"
      );
    }
  }
);

router.get(
  "/templates",
  async (req, res) => {
    try {
      const resultado =
        await db.query(`
          SELECT
            id,
            nome_interno,
            nome_meta,
            idioma,
            categoria,
            corpo_previa,
            status,
            criado_em,
            atualizado_em
          FROM disparos_templates
          ORDER BY
            atualizado_em DESC,
            id DESC
        `);

      return res.json({
        ok: true,
        total:
          resultado.rows.length,
        templates:
          resultado.rows
      });
    } catch (erro) {
      return responderErro(
        res,
        erro,
        "listar templates"
      );
    }
  }
);

router.post(
  "/templates",
  async (req, res) => {
    if (
      !exigirAdministrador(
        req,
        res
      )
    ) {
      return;
    }

    const nomeInterno =
      texto(
        req.body.nomeInterno
      );

    const nomeMeta =
      texto(
        req.body.nomeMeta
      ) || null;

    const idioma =
      texto(
        req.body.idioma
      ) || "pt_BR";

    const categoria =
      codigo(
        req.body.categoria
      ) || null;

    const corpoPrevia =
      texto(
        req.body.corpoPrevia
      );

    const status =
      codigo(
        req.body.status
      ) || "RASCUNHO";

    if (
      !nomeInterno ||
      !corpoPrevia
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Nome e conteúdo do template são obrigatórios."
      });
    }

    if (
      !STATUS_TEMPLATE.has(
        status
      )
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Status do template inválido."
      });
    }

    if (
      categoria &&
      !CATEGORIAS_TEMPLATE.has(
        categoria
      )
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Categoria do template inválida."
      });
    }

    let client;
    let transacaoAtiva = false;

    try {
      client =
        await db.connect();

      await client.query("BEGIN");
      transacaoAtiva = true;

      const resultado =
        await client.query(
          `
          INSERT INTO disparos_templates (
            nome_interno,
            nome_meta,
            idioma,
            categoria,
            corpo_previa,
            status,
            criado_por
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING *
          `,
          [
            nomeInterno,
            nomeMeta,
            idioma,
            categoria,
            corpoPrevia,
            status,
            req.usuario.id
          ]
        );

      await registrarAuditoria(
        client,
        req,
        {
          acao:
            "TEMPLATE_CRIADO",
          dadosNovos: {
            templateId:
              resultado.rows[0].id,
            nomeInterno,
            nomeMeta,
            idioma,
            categoria,
            status
          }
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.status(201).json({
        ok: true,
        mensagem:
          "Template registrado com sucesso.",
        template:
          resultado.rows[0]
      });
    } catch (erro) {
      if (
        transacaoAtiva &&
        client
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErro(
        res,
        erro,
        "registrar template"
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.get(
  "/consentimentos",
  async (req, res) => {
    try {
      const busca =
        texto(
          req.query.busca
        );

      const status =
        codigo(
          req.query.status
        );

      const parametros = [];
      const filtros = [];

      if (busca) {
        parametros.push(
          `%${busca.replace(/\D/g, "")}%`
        );

        filtros.push(`
          telefone_normalizado
          LIKE $${parametros.length}
        `);
      }

      if (status) {
        if (
          !STATUS_CONSENTIMENTO.has(
            status
          )
        ) {
          return res.status(400).json({
            ok: false,
            mensagem:
              "Status de consentimento inválido."
          });
        }

        parametros.push(status);

        filtros.push(`
          status =
          $${parametros.length}
        `);
      }

      const where =
        filtros.length
          ? `WHERE ${filtros.join(" AND ")}`
          : "";

      const resultado =
        await db.query(
          `
          SELECT
            id,
            telefone_normalizado,
            status,
            origem,
            comprovante,
            registrado_por,
            registrado_em,
            atualizado_em
          FROM disparos_consentimentos
          ${where}
          ORDER BY atualizado_em DESC
          LIMIT 200
          `,
          parametros
        );

      return res.json({
        ok: true,
        total:
          resultado.rows.length,
        consentimentos:
          resultado.rows
      });
    } catch (erro) {
      return responderErro(
        res,
        erro,
        "listar consentimentos"
      );
    }
  }
);

router.put(
  "/consentimentos/:telefone",
  async (req, res) => {
    const telefone =
      normalizarTelefone(
        req.params.telefone
      );

    const status =
      codigo(
        req.body.status
      );

    const origem =
      texto(
        req.body.origem
      ) || null;

    const comprovante =
      (
        req.body.comprovante &&
        typeof req.body.comprovante ===
          "object" &&
        !Array.isArray(
          req.body.comprovante
        )
      )
        ? req.body.comprovante
        : {};

    if (!telefone) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Telefone inválido."
      });
    }

    if (
      !STATUS_CONSENTIMENTO.has(
        status
      )
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Status de consentimento inválido."
      });
    }

    let client;
    let transacaoAtiva = false;

    try {
      client =
        await db.connect();

      await client.query("BEGIN");
      transacaoAtiva = true;

      const anterior =
        await client.query(
          `
          SELECT *
          FROM disparos_consentimentos
          WHERE telefone_normalizado = $1
          FOR UPDATE
          `,
          [telefone]
        );

      const resultado =
        await client.query(
          `
          INSERT INTO disparos_consentimentos (
            telefone_normalizado,
            status,
            origem,
            comprovante,
            registrado_por
          )
          VALUES ($1,$2,$3,$4,$5)

          ON CONFLICT (
            telefone_normalizado
          )
          DO UPDATE SET
            status =
              EXCLUDED.status,
            origem =
              EXCLUDED.origem,
            comprovante =
              EXCLUDED.comprovante,
            registrado_por =
              EXCLUDED.registrado_por,
            registrado_em =
              NOW()

          RETURNING *
          `,
          [
            telefone,
            status,
            origem,
            comprovante,
            req.usuario.id
          ]
        );

      await registrarAuditoria(
        client,
        req,
        {
          acao:
            "CONSENTIMENTO_ATUALIZADO",
          dadosAnteriores:
            anterior.rows[0] || null,
          dadosNovos: {
            telefoneNormalizado:
              telefone,
            status,
            origem
          }
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.json({
        ok: true,
        mensagem:
          "Consentimento atualizado com sucesso.",
        consentimento:
          resultado.rows[0]
      });
    } catch (erro) {
      if (
        transacaoAtiva &&
        client
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErro(
        res,
        erro,
        "atualizar consentimento"
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.get(
  "/campanhas",
  async (req, res) => {
    try {
      const resultado =
        await db.query(`
          SELECT
            c.*,
            COUNT(d.id)::INTEGER
              AS total_destinatarios
          FROM disparos_campanhas c

          LEFT JOIN
            disparos_destinatarios d
            ON d.campanha_id = c.id

          GROUP BY c.id

          ORDER BY
            c.criado_em DESC,
            c.id DESC
        `);

      return res.json({
        ok: true,
        modoPreparacao: true,
        total:
          resultado.rows.length,
        campanhas:
          resultado.rows.map(
            prepararCampanha
          )
      });
    } catch (erro) {
      return responderErro(
        res,
        erro,
        "listar campanhas"
      );
    }
  }
);

router.get(
  "/campanhas/:id",
  async (req, res) => {
    const campanhaId =
      inteiroPositivo(
        req.params.id
      );

    if (!campanhaId) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Campanha inválida."
      });
    }

    try {
      const campanha =
        await db.query(
          `
          SELECT
            c.*,
            COUNT(d.id)::INTEGER
              AS total_destinatarios
          FROM disparos_campanhas c

          LEFT JOIN
            disparos_destinatarios d
            ON d.campanha_id = c.id

          WHERE c.id = $1

          GROUP BY c.id
          `,
          [campanhaId]
        );

      if (
        campanha.rows.length === 0
      ) {
        return res.status(404).json({
          ok: false,
          mensagem:
            "Campanha não encontrada."
        });
      }

      const destinatarios =
        await db.query(
          `
          SELECT
            id,
            base_origem,
            origem_id,
            nome_snapshot,
            telefone_normalizado,
            bairro_snapshot,
            consentimento_status,
            status,
            motivo_bloqueio,
            criado_em
          FROM disparos_destinatarios
          WHERE campanha_id = $1
          ORDER BY id
          LIMIT 500
          `,
          [campanhaId]
        );

      return res.json({
        ok: true,
        campanha:
          prepararCampanha(
            campanha.rows[0]
          ),
        destinatarios:
          destinatarios.rows
      });
    } catch (erro) {
      return responderErro(
        res,
        erro,
        "carregar campanha"
      );
    }
  }
);

router.post(
  "/campanhas",
  async (req, res) => {
    const nome =
      texto(
        req.body.nome
      );

    const baseDestinatarios =
      codigo(
        req.body.baseDestinatarios
      );

    const categoriaInformada =
      req.body.categoriaId;

    const categoriaId =
      inteiroPositivo(
        categoriaInformada
      );

    const tipoMensagem =
      codigo(
        req.body.tipoMensagem
      );

    const templateId =
      inteiroPositivo(
        req.body.templateId
      );

    const mensagemPrevia =
      texto(
        req.body.mensagemPrevia
      ) || null;

    const bairro =
      texto(
        req.body.bairro
      ) || null;

    const genero =
      codigo(
        req.body.genero
      ) || "TODOS";

    const agendadaPara =
      texto(
        req.body.agendadaPara
      ) || null;

    if (
      !GENEROS_CONTATO.has(genero)
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Gênero do público inválido."
      });
    }

    if (
      categoriaInformada !== null &&
      categoriaInformada !== undefined &&
      categoriaInformada !== "" &&
      !categoriaId
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Categoria inválida."
      });
    }

    if (!nome) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe o nome da campanha."
      });
    }

    if (
      !BASES_VALIDAS.has(
        baseDestinatarios
      )
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Base de destinatários inválida."
      });
    }

    if (
      !TIPOS_VALIDOS.has(
        tipoMensagem
      )
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Tipo de mensagem inválido."
      });
    }

    if (
      tipoMensagem ===
        "TEMPLATE_OFICIAL" &&
      !templateId
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Selecione um template oficial."
      });
    }

    if (
      tipoMensagem ===
        "JANELA_24H" &&
      !mensagemPrevia
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Informe a mensagem."
      });
    }

    if (
      agendadaPara &&
      Number.isNaN(
        Date.parse(
          agendadaPara
        )
      )
    ) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Data de agendamento inválida."
      });
    }

    let client;
    let transacaoAtiva = false;

    try {
      client =
        await db.connect();

      await client.query("BEGIN");
      transacaoAtiva = true;

      let categoriaNome = null;

      if (categoriaId) {
        const categoria =
          await client.query(
            `
            SELECT id, nome
            FROM disparos_categorias
            WHERE id = $1
              AND ativo = TRUE
            `,
            [categoriaId]
          );

        if (categoria.rows.length === 0) {
          await client.query("ROLLBACK");
          transacaoAtiva = false;

          return res.status(400).json({
            ok: false,
            mensagem:
              "Categoria não encontrada."
          });
        }

        categoriaNome =
          categoria.rows[0].nome;
      }

      if (templateId) {
        const template =
          await client.query(
            `
            SELECT id
            FROM disparos_templates
            WHERE id = $1
            `,
            [templateId]
          );

        if (
          template.rows.length === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          transacaoAtiva = false;

          return res.status(400).json({
            ok: false,
            mensagem:
              "Template não encontrado."
          });
        }
      }

      const resultado =
        await client.query(
          `
          INSERT INTO disparos_campanhas (
            nome,
            base_destinatarios,
            filtros,
            tipo_mensagem,
            template_id,
            mensagem_previa,
            status,
            modo_preparacao,
            agendada_para,
            criado_por
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,
            'RASCUNHO',
            TRUE,
            $7,
            $8
          )
          RETURNING *
          `,
          [
            nome,
            baseDestinatarios,
            {
              bairro,
              genero,
              categoriaId,
              categoriaNome
            },
            tipoMensagem,
            templateId,
            mensagemPrevia,
            agendadaPara,
            req.usuario.id
          ]
        );

      await registrarAuditoria(
        client,
        req,
        {
          campanhaId:
            resultado.rows[0].id,
          acao:
            "CAMPANHA_RASCUNHO_CRIADA",
          dadosNovos: {
            nome,
            baseDestinatarios,
            tipoMensagem,
            templateId,
            bairro,
            genero,
            categoriaId,
            categoriaNome,
            agendadaPara,
            modoPreparacao: true
          }
        }
      );

      await client.query("COMMIT");
      transacaoAtiva = false;

      return res.status(201).json({
        ok: true,
        mensagem:
          "Rascunho salvo com sucesso. Nenhuma mensagem foi enviada.",
        campanha:
          prepararCampanha(
            resultado.rows[0]
          )
      });
    } catch (erro) {
      if (
        transacaoAtiva &&
        client
      ) {
        await client.query(
          "ROLLBACK"
        );
      }

      return responderErro(
        res,
        erro,
        "criar campanha"
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

router.post(
  "/enviar",
  async (req, res) => {
    if (
      !exigirAdministrador(
        req,
        res
      )
    ) {
      return;
    }

    if (
      codigo(
        process.env.XAVIER_DEMO_ENVIO
      ) !== "ATIVO"
    ) {
      return res.status(423).json({
        ok: false,
        mensagem:
          "Envio de demonstra??o n?o est? habilitado."
      });
    }

    const campanhaId =
      inteiroPositivo(
        req.body.campanhaId
      );

    if (!campanhaId) {
      return res.status(400).json({
        ok: false,
        mensagem:
          "Campanha inv?lida."
      });
    }

    try {
      const resultadoCampanha =
        await db.query(
          [
            "SELECT",
            "  c.id,",
            "  c.nome,",
            "  c.tipo_mensagem,",
            "  c.template_id,",
            "  c.filtros,",
            "  t.nome_meta,",
            "  t.idioma,",
            "  t.status AS template_status",
            "FROM disparos_campanhas c",
            "JOIN disparos_templates t",
            "  ON t.id = c.template_id",
            "WHERE c.id = $1"
          ].join("\n"),
          [campanhaId]
        );

      if (
        resultadoCampanha.rows.length === 0
      ) {
        return res.status(404).json({
          ok: false,
          mensagem:
            "Campanha n?o encontrada."
        });
      }

      const campanha =
        resultadoCampanha.rows[0];

      if (
        codigo(
          campanha.tipo_mensagem
        ) !== "TEMPLATE_OFICIAL"
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A demonstra??o permite somente template oficial."
        });
      }

      if (
        codigo(
          campanha.template_status
        ) !== "APROVADO"
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "O template precisa estar marcado como APROVADO."
        });
      }

      const templatesPermitidos =
        new Set([
          "confirmacao_protocolo_xavier_online",
          "xavier_online_teste_demonstracao"
        ]);

      const nomeMeta =
        texto(
          campanha.nome_meta
        );

      if (
        !templatesPermitidos.has(
          nomeMeta
        )
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Template n?o autorizado para a demonstra??o."
        });
      }

      const filtros =
        campanha.filtros || {};

      const categoriaId =
        inteiroPositivo(
          filtros.categoriaId
        );

      if (!categoriaId) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Selecione exclusivamente a categoria Apresenta??o."
        });
      }

      const resultadoCategoria =
        await db.query(
          [
            "SELECT id, nome",
            "FROM disparos_categorias",
            "WHERE id = $1",
            "  AND ativo = TRUE"
          ].join("\n"),
          [categoriaId]
        );

      if (
        resultadoCategoria.rows.length === 0
      ) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Categoria n?o encontrada."
        });
      }

      const normalizarNome =
        (valor) =>
          String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();

      if (
        normalizarNome(
          resultadoCategoria.rows[0].nome
        ) !== "APRESENTACAO"
      ) {
        return res.status(403).json({
          ok: false,
          mensagem:
            "O envio real desta demonstra??o est? restrito ? categoria Apresenta??o."
        });
      }

      const parametros = [
        categoriaId
      ];

      const condicoes = [
        "dc.ativo = TRUE",
        "dcon.status = 'AUTORIZADO'",
        [
          "EXISTS (",
          "  SELECT 1",
          "  FROM disparos_contatos_categorias dcc",
          "  WHERE dcc.contato_id = dc.id",
          "    AND dcc.categoria_id = $1",
          ")"
        ].join("\n")
      ];

      const genero =
        codigo(
          filtros.genero
        );

      if (
        genero &&
        genero !== "TODOS"
      ) {
        parametros.push(genero);

        condicoes.push(
          "dc.genero = $" +
          parametros.length
        );
      }

      const bairro =
        texto(
          filtros.bairro
        );

      if (bairro) {
        parametros.push(bairro);

        condicoes.push(
          [
            "UPPER(BTRIM(COALESCE(dc.bairro, ''))) =",
            "UPPER(BTRIM($" +
              parametros.length +
              "))"
          ].join(" ")
        );
      }

      const resultadoContatos =
        await db.query(
          [
            "SELECT DISTINCT ON",
            "  (dc.telefone_normalizado)",
            "  dc.id,",
            "  dc.nome,",
            "  dc.telefone_normalizado",
            "FROM disparos_contatos dc",
            "JOIN disparos_consentimentos dcon",
            "  ON dcon.telefone_normalizado =",
            "     dc.telefone_normalizado",
            "WHERE " +
              condicoes.join("\nAND "),
            "ORDER BY",
            "  dc.telefone_normalizado,",
            "  dc.id",
            "LIMIT 21"
          ].join("\n"),
          parametros
        );

      const contatos =
        resultadoContatos.rows;

      if (contatos.length === 0) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "Nenhum contato autorizado encontrado para a demonstra??o."
        });
      }

      if (contatos.length > 20) {
        return res.status(400).json({
          ok: false,
          mensagem:
            "A demonstra??o est? limitada a 20 destinat?rios."
        });
      }

      const resultados = [];

      for (const contato of contatos) {
        try {
          let parametrosTemplate = [];

          if (
            nomeMeta ===
            "confirmacao_protocolo_xavier_online"
          ) {
            parametrosTemplate = [
              contato.nome ||
                "Participante",
              "DEMONSTRACAO-2026",
              "SDC Serviços de Dados e Comunicação"
            ];
          }

          const retorno =
            await enviarTemplateWhatsApp(
              contato.telefone_normalizado,
              nomeMeta,
              campanha.idioma ||
                "pt_BR",
              parametrosTemplate
            );

          resultados.push({
            contatoId:
              contato.id,
            telefone:
              contato.telefone_normalizado,
            ok: true,
            messageId:
              retorno?.messages?.[0]?.id ||
              null
          });
        } catch (erro) {
          resultados.push({
            contatoId:
              contato.id,
            telefone:
              contato.telefone_normalizado,
            ok: false,
            erro:
              erro.response?.data?.error?.message ||
              erro.message
          });
        }
      }

      const enviados =
        resultados.filter(
          item => item.ok
        ).length;

      const falhas =
        resultados.length -
        enviados;

      await registrarAuditoria(
        db,
        req,
        {
          campanhaId,
          acao:
            "DEMONSTRACAO_TEMPLATE_EXECUTADA",
          dadosNovos: {
            template:
              nomeMeta,
            categoria:
              resultadoCategoria
                .rows[0].nome,
            total:
              resultados.length,
            enviados,
            falhas
          }
        }
      );

      return res.json({
        ok:
          falhas === 0,
        mensagem:
          falhas === 0
            ? "Demonstra??o enviada com sucesso."
            : "Demonstra??o conclu?da com algumas falhas.",
        total:
          resultados.length,
        enviados,
        falhas,
        resultados
      });

    } catch (erro) {
      return responderErro(
        res,
        erro,
        "executar demonstra??o"
      );
    }
  }
);

module.exports = router;