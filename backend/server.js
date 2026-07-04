const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const db = require("./db");

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
app.use(cookieParser());

function limparCPF(valor) {
  return String(valor || "").replace(/\D/g, "");
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