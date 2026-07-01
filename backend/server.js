const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const demandasRoutes = require("./routes/demandas.routes");
const relatoriosRoutes = require("./routes/relatorios.routes");
const dashboardRoutes = require("./routes/relatorios.routes");
const dashboardResumoRoutes = require("./routes/relatorios.dashboard.routes");
const liderancasRoutes = require("./routes/liderancas.routes");
const interacoesRoutes = require("./routes/interacoes.routes");
const cidadaosRoutes = require("./routes/cidadaos.routes");
const demandasGabineteRoutes = require("./routes/demandas-gabinete.routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const frontendPath = path.resolve(__dirname, "..", "frontend");

console.log("Frontend path:", frontendPath);
console.log("Index existe:", fs.existsSync(path.join(frontendPath, "index.html")));

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  const indexPath = path.join(frontendPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    return res.status(404).send("Frontend não encontrado");
  }

  res.sendFile(indexPath);
});

app.get("/api/status", (req, res) => {
  res.json({
    sistema: "Xavier Online",
    status: "API funcionando"
  });
});

app.use("/api/demandas", demandasRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/relatorios", dashboardResumoRoutes);
app.use("/api/liderancas", liderancasRoutes);
app.use("/api/interacoes", interacoesRoutes);
app.use("/api/cidadaos", cidadaosRoutes);
app.use("/api/demandas-gabinete", demandasGabineteRoutes);

app.listen(PORT, () => {
  console.log(`Servidor Xavier Online rodando na porta ${PORT}`);
});