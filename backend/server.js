const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const demandasRoutes = require("./routes/demandas.routes");
const relatoriosRoutes = require("./routes/relatorios.routes");
const dashboardRoutes = require("./routes/relatorios.dashboard.routes");
const liderancasRoutes = require("./routes/liderancas.routes");
const interacoesRoutes = require("./routes/interacoes.routes");
const cidadaosRoutes = require("./routes/cidadaos.routes");
const demandasGabineteRoutes = require("./routes/demandas-gabinete.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend dentro do backend/public
const frontendPath = path.join(__dirname, "public");

console.log("Frontend path:", frontendPath);
console.log("Index existe:", fs.existsSync(path.join(frontendPath, "index.html")));

// Servir frontend
app.use(express.static(frontendPath));

// Rotas da API
app.get("/api/status", (req, res) => {
  res.json({
    sistema: "Xavier Online",
    status: "API funcionando"
  });
});

app.use("/api/demandas", demandasRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/relatorios", dashboardRoutes);
app.use("/api/liderancas", liderancasRoutes);
app.use("/api/interacoes", interacoesRoutes);
app.use("/api/cidadaos", cidadaosRoutes);
app.use("/api/demandas-gabinete", demandasGabineteRoutes);

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