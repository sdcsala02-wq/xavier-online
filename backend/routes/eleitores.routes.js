const express = require("express");
const router = express.Router();
const pool = require("../db");

function limpar(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

function montarFiltros(query) {
  const {
    busca,
    nome,
    titulo,
    zona,
    secao,
    escola,
    bairro,
    rua,
    numero,
    telefone
  } = query;

  const filtros = [];
  const valores = [];

  if (busca) {
    valores.push(`%${busca}%`);
    filtros.push(`(
      nome ILIKE $${valores.length}
      OR titulo_eleitor ILIKE $${valores.length}
      OR escola_votacao ILIKE $${valores.length}
      OR endereco_completo ILIKE $${valores.length}
      OR rua ILIKE $${valores.length}
      OR bairro ILIKE $${valores.length}
      OR telefone ILIKE $${valores.length}
    )`);
  }

  if (nome) {
    valores.push(`%${nome}%`);
    filtros.push(`nome ILIKE $${valores.length}`);
  }

  if (titulo) {
    valores.push(`%${titulo}%`);
    filtros.push(`titulo_eleitor ILIKE $${valores.length}`);
  }

  if (zona) {
    valores.push(`%${zona}%`);
    filtros.push(`zona ILIKE $${valores.length}`);
  }

  if (secao) {
    valores.push(`%${secao}%`);
    filtros.push(`secao ILIKE $${valores.length}`);
  }

  if (escola) {
    valores.push(`%${escola}%`);
    filtros.push(`escola_votacao ILIKE $${valores.length}`);
  }

  if (bairro) {
    valores.push(`%${bairro}%`);
    filtros.push(`bairro ILIKE $${valores.length}`);
  }

  if (rua) {
    valores.push(`%${rua}%`);
    filtros.push(`(
      rua ILIKE $${valores.length}
      OR endereco_completo ILIKE $${valores.length}
    )`);
  }

  if (numero) {
    valores.push(`%${numero}%`);
    filtros.push(`numero ILIKE $${valores.length}`);
  }

  if (telefone) {
    valores.push(`%${telefone}%`);
    filtros.push(`telefone ILIKE $${valores.length}`);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  return { where, valores };
}

router.get("/", async (req, res) => {
  try {
    const { where, valores } = montarFiltros(req.query);

    const resultado = await pool.query(
      `
      SELECT *
      FROM eleitores
      ${where}
      ORDER BY nome ASC
      `,
      valores
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error("Erro ao listar eleitores:", error);

    res.status(500).json({
      erro: "Erro interno ao listar eleitores.",
      detalhe: error.message
    });
  }
});

router.get("/resumo", async (req, res) => {
  try {
    const total = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM eleitores
    `);

    const escolas = await pool.query(`
      SELECT COUNT(DISTINCT TRIM(escola_votacao))::int AS total
      FROM eleitores
      WHERE escola_votacao IS NOT NULL
      AND TRIM(escola_votacao) <> ''
    `);

    const zonas = await pool.query(`
      SELECT COUNT(DISTINCT TRIM(zona))::int AS total
      FROM eleitores
      WHERE zona IS NOT NULL
      AND TRIM(zona) <> ''
    `);

    const secoes = await pool.query(`
      SELECT COUNT(DISTINCT TRIM(secao))::int AS total
      FROM eleitores
      WHERE secao IS NOT NULL
      AND TRIM(secao) <> ''
    `);

    const bairros = await pool.query(`
      SELECT COUNT(DISTINCT TRIM(bairro))::int AS total
      FROM eleitores
      WHERE bairro IS NOT NULL
      AND TRIM(bairro) <> ''
    `);

    const ruas = await pool.query(`
      SELECT COUNT(DISTINCT TRIM(COALESCE(NULLIF(rua, ''), endereco_completo)))::int AS total
      FROM eleitores
      WHERE COALESCE(NULLIF(TRIM(rua), ''), NULLIF(TRIM(endereco_completo), '')) IS NOT NULL
    `);

    const topEscolas = await pool.query(`
      SELECT 
        TRIM(escola_votacao) AS escola,
        COUNT(*)::int AS total
      FROM eleitores
      WHERE escola_votacao IS NOT NULL
      AND TRIM(escola_votacao) <> ''
      GROUP BY TRIM(escola_votacao)
      ORDER BY total DESC, escola ASC
      LIMIT 10
    `);

    const topBairros = await pool.query(`
      SELECT 
        TRIM(bairro) AS bairro,
        COUNT(*)::int AS total
      FROM eleitores
      WHERE bairro IS NOT NULL
      AND TRIM(bairro) <> ''
      GROUP BY TRIM(bairro)
      ORDER BY total DESC, bairro ASC
      LIMIT 10
    `);

    const topRuas = await pool.query(`
      SELECT
        TRIM(COALESCE(NULLIF(rua, ''), endereco_completo)) AS rua,
        TRIM(COALESCE(bairro, '')) AS bairro,
        COUNT(*)::int AS total
      FROM eleitores
      WHERE COALESCE(NULLIF(TRIM(rua), ''), NULLIF(TRIM(endereco_completo), '')) IS NOT NULL
      GROUP BY 
        TRIM(COALESCE(NULLIF(rua, ''), endereco_completo)),
        TRIM(COALESCE(bairro, ''))
      ORDER BY total DESC, rua ASC
      LIMIT 10
    `);

    const topZonas = await pool.query(`
      SELECT 
        TRIM(zona) AS zona,
        COUNT(*)::int AS total
      FROM eleitores
      WHERE zona IS NOT NULL
      AND TRIM(zona) <> ''
      GROUP BY TRIM(zona)
      ORDER BY total DESC, zona ASC
      LIMIT 10
    `);

    const topSecoes = await pool.query(`
      SELECT 
        TRIM(COALESCE(zona, '')) AS zona,
        TRIM(secao) AS secao,
        TRIM(COALESCE(escola_votacao, '')) AS escola,
        COUNT(*)::int AS total
      FROM eleitores
      WHERE secao IS NOT NULL
      AND TRIM(secao) <> ''
      GROUP BY 
        TRIM(COALESCE(zona, '')),
        TRIM(secao),
        TRIM(COALESCE(escola_votacao, ''))
      ORDER BY total DESC, zona ASC, secao ASC
      LIMIT 10
    `);

    res.json({
      total: total.rows[0].total,
      escolas: escolas.rows[0].total,
      zonas: zonas.rows[0].total,
      secoes: secoes.rows[0].total,
      bairros: bairros.rows[0].total,
      ruas: ruas.rows[0].total,
      topEscolas: topEscolas.rows,
      topBairros: topBairros.rows,
      topRuas: topRuas.rows,
      topZonas: topZonas.rows,
      topSecoes: topSecoes.rows
    });

  } catch (error) {
    console.error("Erro no resumo de eleitores:", error);

    res.status(500).json({
      erro: "Erro interno ao carregar resumo.",
      detalhe: error.message
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      nome,
      titulo_eleitor,
      zona,
      secao,
      escola_votacao,
      endereco_completo,
      rua,
      numero,
      complemento,
      bairro,
      telefone,
      observacao
    } = req.body;

    if (!limpar(nome)) {
      return res.status(400).json({
        erro: "Nome é obrigatório."
      });
    }

    const resultado = await pool.query(
      `
      INSERT INTO eleitores (
        nome,
        titulo_eleitor,
        zona,
        secao,
        escola_votacao,
        endereco_completo,
        rua,
        numero,
        complemento,
        bairro,
        telefone,
        observacao
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        limpar(nome),
        limpar(titulo_eleitor),
        limpar(zona),
        limpar(secao),
        limpar(escola_votacao),
        limpar(endereco_completo),
        limpar(rua),
        limpar(numero),
        limpar(complemento),
        limpar(bairro),
        limpar(telefone),
        limpar(observacao)
      ]
    );

    res.status(201).json({
      mensagem: "Eleitor cadastrado com sucesso.",
      eleitor: resultado.rows[0]
    });

  } catch (error) {
    console.error("Erro ao cadastrar eleitor:", error);

    res.status(500).json({
      erro: "Erro interno ao cadastrar eleitor.",
      detalhe: error.message
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nome,
      titulo_eleitor,
      zona,
      secao,
      escola_votacao,
      endereco_completo,
      rua,
      numero,
      complemento,
      bairro,
      telefone,
      observacao
    } = req.body;

    if (!limpar(nome)) {
      return res.status(400).json({
        erro: "Nome é obrigatório."
      });
    }

    const resultado = await pool.query(
      `
      UPDATE eleitores
      SET
        nome = $1,
        titulo_eleitor = $2,
        zona = $3,
        secao = $4,
        escola_votacao = $5,
        endereco_completo = $6,
        rua = $7,
        numero = $8,
        complemento = $9,
        bairro = $10,
        telefone = $11,
        observacao = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        limpar(nome),
        limpar(titulo_eleitor),
        limpar(zona),
        limpar(secao),
        limpar(escola_votacao),
        limpar(endereco_completo),
        limpar(rua),
        limpar(numero),
        limpar(complemento),
        limpar(bairro),
        limpar(telefone),
        limpar(observacao),
        id
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Eleitor não encontrado."
      });
    }

    res.json({
      mensagem: "Eleitor atualizado com sucesso.",
      eleitor: resultado.rows[0]
    });

  } catch (error) {
    console.error("Erro ao editar eleitor:", error);

    res.status(500).json({
      erro: "Erro interno ao editar eleitor.",
      detalhe: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const resultado = await pool.query(
      `
      DELETE FROM eleitores
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        erro: "Eleitor não encontrado."
      });
    }

    res.json({
      mensagem: "Eleitor excluído com sucesso."
    });

  } catch (error) {
    console.error("Erro ao excluir eleitor:", error);

    res.status(500).json({
      erro: "Erro interno ao excluir eleitor.",
      detalhe: error.message
    });
  }
});

module.exports = router;