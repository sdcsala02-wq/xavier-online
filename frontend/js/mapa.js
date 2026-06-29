const API_URL_MAPA = "http://localhost:3000/api/demandas";

const bairrosPraiaGrande = [
  "Boqueirão",
  "Guilhermina",
  "Aviação",
  "Tupi",
  "Ocian",
  "Mirim",
  "Maracanã",
  "Caiçara",
  "Real",
  "Solemar",
  "Flórida",
  "Balneário Esmeralda",
  "Ribeirópolis",
  "Samambaia",
  "Melvi",
  "Quietude",
  "Sítio do Campo",
  "Anhanguera",
  "Antártica",
  "Vila Sônia"
];

let demandasMapa = [];
let resumoBairros = [];

async function carregarMapaCidade() {
  try {
    const respostaResumo = await fetch(`${API_URL_MAPA}/dashboard/resumo`);
    const resumo = await respostaResumo.json();

    const respostaDemandas = await fetch(API_URL_MAPA);
    demandasMapa = await respostaDemandas.json();

    resumoBairros = resumo.porBairro || [];

    atualizarCardsMapa(resumoBairros, demandasMapa);
    montarMapaVisual(resumoBairros);
    montarRankingBairros(resumoBairros);

  } catch (error) {
    console.error("Erro ao carregar mapa:", error);
    alert("Erro ao carregar mapa da cidade.");
  }
}

function atualizarCardsMapa(bairros, demandas) {
  const totalBairros = bairros.length;
  const totalDemandas = demandas.length;
  const destaque = bairros[0];

  document.getElementById("totalBairros").innerText = totalBairros;
  document.getElementById("totalDemandasMapa").innerText = totalDemandas;
  document.getElementById("bairroDestaque").innerText = destaque ? formatarNome(destaque.bairro) : "-";
}

function montarMapaVisual(bairrosComDados) {
  const container = document.getElementById("mapaVisual");

  container.innerHTML = bairrosPraiaGrande.map((bairro, index) => {
    const encontrado = bairrosComDados.find(item =>
      normalizarTexto(item.bairro) === normalizarTexto(bairro)
    );

    const total = encontrado ? Number(encontrado.total) : 0;
    const classe = definirClasseIntensidade(total);

    return `
      <button 
        class="bairro-mapa ${classe}" 
        onclick="selecionarBairro('${bairro}')"
        title="${bairro} - ${total} demanda(s)">
        <span>${bairro}</span>
        <strong>${total}</strong>
      </button>
    `;
  }).join("");
}

function montarRankingBairros(bairros) {
  const container = document.getElementById("rankingBairros");

  if (!bairros.length) {
    container.innerHTML = "<p>Nenhum bairro com demanda cadastrada.</p>";
    return;
  }

  const maior = Math.max(...bairros.map(item => Number(item.total)));

  container.innerHTML = bairros.map(item => {
    const total = Number(item.total);
    const largura = maior ? (total / maior) * 100 : 0;

    return `
      <div class="ranking-item" onclick="selecionarBairro('${item.bairro}')">
        <span>${formatarNome(item.bairro)}</span>
        <div class="barra-ranking">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${total}</strong>
      </div>
    `;
  }).join("");
}

function selecionarBairro(bairro) {
  document.getElementById("bairroSelecionado").innerText = bairro;
  document.getElementById("tituloDemandasBairro").innerText = `Demandas do Bairro - ${bairro}`;

  document.querySelectorAll(".bairro-mapa").forEach(botao => {
    botao.classList.remove("selecionado");
  });

  const botoes = Array.from(document.querySelectorAll(".bairro-mapa"));
  const botaoAtual = botoes.find(btn =>
    normalizarTexto(btn.querySelector("span").innerText) === normalizarTexto(bairro)
  );

  if (botaoAtual) {
    botaoAtual.classList.add("selecionado");
  }

  const filtradas = demandasMapa.filter(demanda =>
    normalizarTexto(demanda.bairro) === normalizarTexto(bairro)
  );

  montarTabelaDemandasBairro(filtradas);
}

function montarTabelaDemandasBairro(demandas) {
  const tbody = document.getElementById("listaDemandasBairro");

  if (!demandas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma demanda encontrada para este bairro.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = demandas.map(demanda => `
    <tr>
      <td>${demanda.protocolo || "-"}</td>
      <td>${demanda.nome || "-"}</td>
      <td>${demanda.servico || "-"}</td>
      <td>${demanda.secretaria || "-"}</td>
      <td>${demanda.status || "-"}</td>
    </tr>
  `).join("");
}

function limparSelecaoBairro() {
  document.getElementById("bairroSelecionado").innerText = "-";
  document.getElementById("tituloDemandasBairro").innerText = "Demandas do Bairro";

  document.querySelectorAll(".bairro-mapa").forEach(botao => {
    botao.classList.remove("selecionado");
  });

  document.getElementById("listaDemandasBairro").innerHTML = `
    <tr>
      <td colspan="5">Clique em um bairro para visualizar as demandas.</td>
    </tr>
  `;
}

function definirClasseIntensidade(total) {
  if (total >= 20) return "nivel-5";
  if (total >= 10) return "nivel-4";
  if (total >= 5) return "nivel-3";
  if (total >= 1) return "nivel-2";
  return "nivel-1";
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatarNome(texto) {
  return String(texto || "Não informado")
    .toLowerCase()
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

document.addEventListener("DOMContentLoaded", carregarMapaCidade);