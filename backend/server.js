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

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

function limparCPF(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function cpfValido(valor) {
  const cpf = limparCPF(valor);
  return cpf.length === 11;
}

function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      perfil: usuario.perfil
    },
    process.env.JWT_SECRET || "xavier_online_segredo_temporario",
    { expiresIn: "8h" }
  );
}

function autenticar(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        ok: false,
        mensagem: "Acesso não autorizado."
      });
    }

    const usuario = jwt.verify(
      token,
      process.env.JWT_SECRET || "xavier_online_segredo_temporario"
    );

    req.usuario = usuario;
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

// Frontend dentro do backend/public
const frontendPath = path.join(__dirname, "public");

console.log("Frontend path:", frontendPath);
console.log("Index existe:", fs.existsSync(path.join(frontendPath, "index.html")));

// Servir frontend
app.use(express.static(frontendPath));

// Status da API
app.get("/api/status", (req, res) => {
  res.json({
    sistema: "Xavier Online",
    status: "API funcionando"
  });
});

// Login somente por CPF
app.post("/api/auth/login", async (req, res) => {
  try {

    console.log("BODY RECEBIDO:");
    console.log(req.body);

    const { login, cpf, senha } = req.body;

    const cpfRecebido = cpf || login;

    console.log("CPF recebido:", cpfRecebido);
    console.log("Senha recebida:", senha);

    // resto do código...


    const cpfLimpo = limparCPF(cpfRecebido);

    if (!cpfValido(cpfLimpo)) {
      return res.status(400).json({
        ok: false,
        mensagem: "CPF inválido. Informe um CPF com 11 números."
      });
    }

    const resultado = await db.query(
      `
      SELECT 
        id,
        nome,
        email,
        cpf,
        senha_hash,
        perfil,
        ativo
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
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      ok: true,
      mensagem: "Login realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
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

// Verificar usuário logado
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

// Logout
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");

  return res.json({
    ok: true,
    mensagem: "Logout realizado com sucesso."
  });
});

// Rotas da API
app.use("/api/demandas", demandasRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/relatorios", dashboardRoutes);
app.use("/api/liderancas", liderancasRoutes);
app.use("/api/interacoes", interacoesRoutes);
app.use("/api/cidadaos", cidadaosRoutes);
app.use("/api/demandas-gabinete", demandasGabineteRoutes);
app.use("/api/eleitores", eleitoresRoutes);

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Páginas HTML
app.get("/:pagina", (req, res, next) => {
  const arquivo = path.join(frontendPath, req.params.pagina);

  if (fs.existsSync(arquivo)) {
    return res.sendFile(arquivo);
  }

  next();
});

// Página não encontrada
app.use((req, res) => {
  res.status(404).send("Não encontrado");
});

app.listen(PORT, () => {
  console.log(`Servidor Xavier Online rodando na porta ${PORT}`);
});