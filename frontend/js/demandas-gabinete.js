const API_DEMANDAS_GABINETE = "http://localhost:3000/api/demandas-gabinete";

async function carregarDemandasGabinete() {
  const tbody = document.getElementById("listaDemandasGabinete");

  const params = new URLSearchParams();

  const busca = document.getElementById("filtroBuscaGabinete")?.value;
  const bairro = document.getElementById("filtroBairroGabinete")?.value;
  const secretaria = document.getElementById("filtroSecretariaGabinete")?.value;
  const status = document.getElementById("filtroStatusGabinete")?.value;
  const ano = document.getElementById("filtroAnoGabinete")?.value;
  const mes = document.getElementById("filtroMesGabinete")?.value;

  if (busca) params.append("busca", busca);
  if (bairro) params.append("bairro", bairro);
  if (secretaria) params.append("secretaria", secretaria);
  if (status) params.append("status", status);
  if (ano) params.append("ano", ano);
  if (mes) params.append("mes", mes);

  const url = params.toString()
    ? `${API_DEMANDAS_GABINETE}?${params.toString()}`
    : API_DEMANDAS_GABINETE;

  try {
    const resposta = await fetch(url);
    const dados = await resposta.json();

    atualizarCardsGabinete(dados);
    montarTabelaDemandasGabinete(dados);

  } catch (error) {
    console.error(error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar demandas.</td>
      </tr>
    `;
  }
}

function atualizarCardsGabinete(dados) {
  const bairros = new Set(dados.map(item => normalizar(item.bairro)));
  const secretarias = new Set(dados.map(item => normalizar(item.secretaria)));

  document.getElementById("totalDemandasGabinete").innerText = dados.length;
  document.getElementById("totalBairrosGabinete").innerText = [...bairros].filter(Boolean).length;
  document.getElementById("totalSecretariasGabinete").innerText = [...secretarias].filter(Boolean).length;
  document.getElementById("anoSelecionadoGabinete").innerText =
    document.getElementById("filtroAnoGabinete")?.value || "Todos";
}

function montarTabelaDemandasGabinete(dados) {
  const tbody = document.getElementById("listaDemandasGabinete");

  if (!dados.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma demanda encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = dados.map(item => `
    <tr>
      <td>${formatarData(item.data)}</td>
      <td>${item.nome || "-"}</td>
      <td>${item.telefone || "-"}</td>
      <td>${item.bairro || "-"}</td>
      <td>${item.demanda || "-"}</td>
      <td>${item.secretaria || "-"}</td>
      <td>${item.status || "-"}</td>
    </tr>
  `).join("");
}

function limparFiltrosGabinete() {
  [
    "filtroBuscaGabinete",
    "filtroBairroGabinete",
    "filtroSecretariaGabinete",
    "filtroStatusGabinete",
    "filtroAnoGabinete",
    "filtroMesGabinete"
  ].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = "";
  });

  carregarDemandasGabinete();
}

function formatarData(data) {
  if (!data) return "-";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return data;
  return d.toLocaleDateString("pt-BR");
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

document.addEventListener("DOMContentLoaded", carregarDemandasGabinete);