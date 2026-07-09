const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const webhookRoutes = require("./routes/webhook.routes");

require("dotenv").config();

const db = require("./db");
const { enviarTextoWhatsApp, normalizarTelefoneBR } = require("./services/whatsapp.service");

const demandasRoutes = require("./routes/demandas.routes");
const relatoriosRoutes = require("./routes/relatorios.routes");
const dashboardRoutes = require("./routes/relatorios.dashboard.routes");
const liderancasRoutes = require("./routes/liderancas.routes");
const interacoesRoutes = require("./routes/interacoes.routes");
const cidadaosRoutes = require("./routes/cidadaos.routes");
const demandasGabineteRoutes = require("./routes/demandas-gabinete.routes");
const eleitoresRoutes = require("./routes/eleitores.routes");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "xavier_online_segredo_temporario";
const frontendPath = path.join(__dirname, "public");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log("======================================");
  console.log(`${req.method} ${req.originalUrl}`);
  console.log("Headers:");
  console.log(req.headers);
  console.log("======================================");
  next();
});
app.use(cookieParser());


function limparCPF(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function somenteNumeros(valor) {
  return String(valor || "")
    .replace(/\D/g, "");
}


function cpfValido(valor) {
  return limparCPF(valor).length === 11;
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      cpf: limparCPF(usuario.cpf),
      perfil: usuario.perfil
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function autenticar(req, res, next) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        ok: false,
        mensagem: "Acesso não autorizado."
      });
    }

    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (erro) {
    return res.status(401).json({
      ok: false,
      mensagem: "Sessão inválida ou expirada."
    });
  }
}

function autorizarPerfis(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({
        ok: false,
        mensagem: "Você não tem permissão para acessar este recurso."
      });
    }

    next();
  };
}

function autenticarPagina(req, res, next) {
  const paginasPublicas = [
    "index.html",
    "login.html",
    "nova-demanda.html"
  ];

  const pagina = req.params.pagina || "index.html";

  if (paginasPublicas.includes(pagina)) {
    return next();
  }

  const token = req.cookies?.token;

  if (!token) {
    return res.redirect("/index.html");
  }

  try {
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch (erro) {
    return res.redirect("/index.html");
  }
}

function protegerPaginaPorPerfil(perfisPermitidos) {
  return (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
      return res.redirect("/index.html");
    }

    try {
      const usuario = jwt.verify(token, JWT_SECRET);

      if (!perfisPermitidos.includes(usuario.perfil)) {
        return res.status(403).send("Acesso negado.");
      }

      req.usuario = usuario;
      return next();
    } catch (erro) {
      return res.redirect("/index.html");
    }
  };
}

console.log("Frontend path:", frontendPath);
console.log("Index existe:", fs.existsSync(path.join(frontendPath, "index.html")));

app.use("/css", express.static(path.join(frontendPath, "css")));
app.use("/js", express.static(path.join(frontendPath, "js")));
app.use("/img", express.static(path.join(frontendPath, "img")));
app.use("/assets", express.static(path.join(frontendPath, "assets")));
app.use("/data", express.static(path.join(frontendPath, "data")));

app.use("/api/webhook", webhookRoutes);


app.get("/api/status", (req, res) => {
  res.json({
    sistema: "Xavier Online",
    status: "API funcionando"
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { cpf, login, senha } = req.body;
    const cpfRecebido = cpf || login;
    const cpfLimpo = limparCPF(cpfRecebido);

    if (!cpfValido(cpfLimpo)) {
      return res.status(400).json({
        ok: false,
        mensagem: "CPF inválido. Informe um CPF com 11 números."
      });
    }

    if (!senha) {
      return res.status(400).json({
        ok: false,
        mensagem: "Informe a senha."
      });
    }

    const resultado = await db.query(
      `
      SELECT id, nome, email, cpf, senha_hash, perfil, ativo
      FROM usuarios
      WHERE REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g') = $1
      LIMIT 1
      `,
      [cpfLimpo]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        mensagem: "CPF ou senha inválidos."
      });
    }

    const usuario = resultado.rows[0];

    if (usuario.ativo === false) {
      return res.status(403).json({
        ok: false,
        mensagem: "Usuário inativo."
      });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        ok: false,
        mensagem: "CPF ou senha inválidos."
      });
    }

    const token = gerarToken(usuario);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      ok: true,
      mensagem: "Login realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        cpf: usuario.cpf,
        perfil: usuario.perfil
      }
    });
  } catch (erro) {
    console.error("Erro no login:", erro);

    return res.status(500).json({
      ok: false,
      mensagem: "Erro interno ao realizar login."
    });
  }
});

app.get("/api/auth/me", autenticar, async (req, res) => {
  try {
    const resultado = await db.query(
      `
      SELECT id, nome, email, cpf, perfil, ativo
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensagem: "Usuário não encontrado."
      });
    }

    return res.json({
      ok: true,
      usuario: resultado.rows[0]
    });
  } catch (erro) {
    console.error("Erro ao verificar sessão:", erro);

    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao verificar sessão."
    });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

  return res.json({
    ok: true,
    mensagem: "Logout realizado com sucesso."
  });
});



/* ROTA PÚBLICA SEGURA - NOVA SOLICITAÇÃO */
app.post("/api/publico/nova-demanda", async (req, res) => {

  try {

    const {
      nome,
      telefone,
      bairro,
      endereco,
      servico,
      secretaria,
      descricao
    } = req.body;

    if (
      !nome ||
      !telefone ||
      !bairro ||
      !endereco ||
      !servico ||
      !secretaria
    ) {

      return res.status(400).json({
        ok: false,
        mensagem: "Preencha todos os campos obrigatórios: nome, telefone, bairro, endereço, serviço e secretaria."
      });

    }


    // ======================================
    // CRIAR OU LOCALIZAR CIDADÃO - CRM
    // ======================================

    const telefoneLimpo = normalizarTelefoneBR(telefone);

    let cidadaoId = null;


    if (telefoneLimpo) {

      const buscaCidadao = await db.query(
        `
        SELECT id
        FROM cidadaos
        WHERE telefone = $1
        OR whatsapp = $1
        LIMIT 1
        `,
        [
          telefoneLimpo
        ]
      );


      if (buscaCidadao.rows.length > 0) {

        cidadaoId = buscaCidadao.rows[0].id;


        await db.query(
          `
          UPDATE cidadaos
          SET
            nome = $1,
            bairro = $2,
            endereco = $3,
            whatsapp = $4,
            atualizado_em = NOW()
          WHERE id = $5
          `,
          [
            nome.trim(),
            bairro || "",
            endereco || "",
            telefoneLimpo,
            cidadaoId
          ]
        );


        console.log(
          "Cidadão atualizado:",
          cidadaoId
        );


      } else {


        const novoCidadao = await db.query(
          `
          INSERT INTO cidadaos
          (
            nome,
            telefone,
            whatsapp,
            bairro,
            endereco,
            criado_em,
            atualizado_em
          )
          VALUES
          ($1,$2,$3,$4,$5,NOW(),NOW())
          RETURNING id
          `,
          [
            nome.trim(),
            telefoneLimpo,
            telefoneLimpo,
            bairro || "",
            endereco || ""
          ]
        );


        cidadaoId = novoCidadao.rows[0].id;


        console.log(
          "Novo cidadão criado:",
          cidadaoId
        );

      }

    }

    const agora = new Date();

    const ano = agora.getFullYear();

    const mes = agora.getMonth() + 1;



    const ultimo = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM solicitacoes_publicas
      WHERE ano = $1
      `,
      [ano]
    );


    const numero = ultimo.rows[0].total + 1;


    const protocolo =
      `XAV-${ano}-${String(numero).padStart(6, "0")}`;

    // ======================================
    // GRAVAR HISTÓRICO DO CIDADÃO
    // ======================================

    if (cidadaoId) {

      await db.query(
        `
    INSERT INTO historico_cidadaos
    (
      cidadao_id,
      tipo,
      descricao,
      usuario
    )
    VALUES
    ($1,$2,$3,$4)
    `,
        [
          cidadaoId,
          "PROTOCOLO",
          `Novo protocolo criado: ${protocolo}. Serviço: ${servico}`,
          "SISTEMA XAVIER ONLINE"
        ]
      );

      console.log(
        "Histórico criado para cidadão:",
        cidadaoId
      );

    }



    const resultado = await db.query(

      `
      INSERT INTO solicitacoes_publicas
      (
        cidadao_id,
        protocolo,
        ano,
        mes,
        solicitante,
        telefone,
        bairro,
        endereco,
        servico,
        secretaria,
        descricao,
        status,
        origem,
        criado_em
      )
        
      VALUES
	(
	$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
	'RECEBIDA',
	'SITE_PUBLICO',
	NOW()
	)

      RETURNING *
      `,

      [
        cidadaoId,
        protocolo,
        ano,
        mes,
        nome.trim(),
        telefoneLimpo,
        bairro || "",
        endereco || "",
        servico,
        secretaria,
        descricao ? descricao.trim() : ""
      ]

    );

    // ======================================
    // TENTAR ADICIONAR TAMBÉM AO GABINETE
    // Sem travar o cadastro/WhatsApp se a tabela estiver diferente
    // ======================================
    try {
      const colunasBanco = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'demandas_gabinete'
  `);

      const colunasExistentes = colunasBanco.rows.map(c => c.column_name);

      const dadosGabinete = {
        protocolo,
        cidadao_id: cidadaoId,
        ano,
        data: new Date(),
        mes: String(mes),
        solicitante: nome.trim(),
        telefone: telefoneLimpo,
        bairro: bairro || "",
        endereco: endereco || "",
        servico,
        secretaria,
        descricao: descricao ? descricao.trim() : "",
        demanda: descricao ? descricao.trim() : "",
        status: "RECEBIDA",
        origem: "SITE_PUBLICO",
        inf_origem: "SITE_PUBLICO",
        criado_em: new Date()
      };

      const colunasParaInserir = Object.keys(dadosGabinete)
        .filter(coluna => colunasExistentes.includes(coluna));

      const valores = colunasParaInserir.map(coluna => dadosGabinete[coluna]);

      const parametros = colunasParaInserir
        .map((_, index) => `$${index + 1}`)
        .join(", ");

      if (colunasParaInserir.length > 0) {
        await db.query(
          `
      INSERT INTO demandas_gabinete
      (${colunasParaInserir.join(", ")})
      VALUES (${parametros})
      `,
          valores
        );

        console.log("Demanda adicionada em demandas_gabinete:", protocolo);
      }

    } catch (erroGabinete) {
      console.error("Falha ao adicionar em demandas_gabinete:", erroGabinete.message);
    }

    // ================================
    // MENSAGENS WHATSAPP XAVIER ONLINE
    // ================================


    const mensagemCidadao = `

Olá, ${nome.trim()}.


Sua solicitação foi registrada com sucesso no Xavier Online.


📌 Protocolo: ${protocolo}

🏥 Serviço: ${servico}

🏢 Secretaria responsável: ${secretaria}

📍 Bairro: ${bairro || "-"}


Status atual: RECEBIDA


Guarde este protocolo para acompanhar sua solicitação.


Xavier Online - Atendimento ao cidadão.

`;



    const mensagemGabinete = `

🚨 NOVA DEMANDA - XAVIER ONLINE


Protocolo: ${protocolo}

Solicitante:
${nome.trim()}

Telefone:
${telefoneLimpo || "-"}

Bairro:
${bairro || "-"}

Endereço:
${endereco || "-"}

Serviço:
${servico}

Secretaria:
${secretaria}

Descrição:

${descricao ? descricao.trim() : "Não informado"}

`;



    let whatsappCidadao = false;

    let whatsappGabinete = false;



    // ENVIO PARA CIDADÃO

    try {

      await enviarTextoWhatsApp(
        telefoneLimpo,
        mensagemCidadao
      );

      whatsappCidadao = true;

      console.log(
        "WhatsApp cidadão enviado:",
        protocolo
      );

    }


    catch (erro) {

      console.error(
        "Falha WhatsApp cidadão:",
        erro.message
      );

    }



    // ENVIO PARA GABINETE

    try {


      if (process.env.WHATSAPP_GABINETE) {


        await enviarTextoWhatsApp(

          process.env.WHATSAPP_GABINETE,

          mensagemGabinete

        );


        whatsappGabinete = true;


        console.log(
          "WhatsApp gabinete enviado:",
          protocolo
        );


      }


    } catch (erro) {

      console.error(
        "Falha WhatsApp gabinete:",
        erro.message
      );

    }




    return res.status(201).json({

      ok: true,

      mensagem:
        "Solicitação cadastrada com sucesso.",


      protocolo,


      demanda:
        resultado.rows[0],


      whatsapp: {

        cidadao:
          whatsappCidadao,


        gabinete:
          whatsappGabinete

      }

    });



  } catch (erro) {


    console.error(
      "Erro ao cadastrar solicitação pública:",
      erro
    );


    return res.status(500).json({

      ok: false,

      mensagem:
        "Erro ao cadastrar solicitação pública.",

      erro:
        erro.message

    });


  }


});



app.use("/api/demandas", autenticar, demandasRoutes);
app.use("/api/relatorios", autenticar, relatoriosRoutes);
app.use("/api/relatorios", autenticar, dashboardRoutes);

app.use(
  "/api/liderancas",
  autenticar,
  autorizarPerfis("ADMIN", "ASSESSOR"),
  liderancasRoutes
);

app.use(
  "/api/interacoes",
  autenticar,
  autorizarPerfis("ADMIN", "ASSESSOR", "ATENDENTE"),
  interacoesRoutes
);

app.use("/api/cidadaos", autenticar, cidadaosRoutes);
app.use("/api/demandas-gabinete", autenticar, demandasGabineteRoutes);

app.use(
  "/api/eleitores",
  autenticar,
  autorizarPerfis("ADMIN", "ASSESSOR"),
  eleitoresRoutes
);

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/configuracoes.html", protegerPaginaPorPerfil(["ADMIN"]), (req, res) => {
  res.sendFile(path.join(frontendPath, "configuracoes.html"));
});

app.get("/importar.html", protegerPaginaPorPerfil(["ADMIN", "ASSESSOR"]), (req, res) => {
  res.sendFile(path.join(frontendPath, "importar.html"));
});

app.get("/eleitores.html", protegerPaginaPorPerfil(["ADMIN", "ASSESSOR"]), (req, res) => {
  res.sendFile(path.join(frontendPath, "eleitores.html"));
});

app.get("/:pagina", autenticarPagina, (req, res, next) => {
  const pagina = req.params.pagina;
  const arquivo = path.join(frontendPath, pagina);

  if (fs.existsSync(arquivo) && pagina.endsWith(".html")) {
    return res.sendFile(arquivo);
  }

  next();
});

app.use((req, res) => {
  res.status(404).send("Não encontrado");
});

app.listen(PORT, () => {
  console.log(`Servidor Xavier Online rodando na porta ${PORT}`);
});