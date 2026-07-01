const express = require("express");
const cors = require("cors");
const path = require("path");

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

// FRONTEND
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// APIs
app.use("/api/demandas", demandasRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/relatorios", dashboardRoutes);
app.use("/api/liderancas", liderancasRoutes);
app.use("/api/interacoes", interacoesRoutes);
app.use("/api/cidadaos", cidadaosRoutes);
app.use("/api/demandas-gabinete", demandasGabineteRoutes);

app.listen(PORT, () => {
  console.log(`Servidor Xavier Online rodando na porta ${PORT}`);
});