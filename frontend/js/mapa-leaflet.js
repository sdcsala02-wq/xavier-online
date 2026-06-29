const API_URL_MAPA_REAL = "http://localhost:3000/api/demandas";

const mapa = L.map("mapaLeaflet", {
  zoomControl: true,
  scrollWheelZoom: false
}).setView([-24.01, -46.43], 11);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "Xavier Online"
  }
).addTo(mapa);

let demandasPorBairro = {};
let demandasTodas = [];
let camadaBairrosGlobal = null;

async function carregarMapaReal() {
  try {
    const resumoResp = await fetch(`${API_URL_MAPA_REAL}/dashboard/resumo`);
    const resumo = await resumoResp.json();

    const demandasResp = await fetch(API_URL_MAPA_REAL);
    demandasTodas = await demandasResp.json();

    (resumo.porBairro || []).forEach(item => {
      demandasPorBairro[normalizar(item.bairro)] = Number(item.total);
    });

    montarRankingBairrosReal(resumo.porBairro || []);

    const geojsonResp = await fetch("data/bairros-praia-grande.geojson");
    const bairros = await geojsonResp.json();

    camadaBairrosGlobal = L.geoJSON(bairros, {
      style: estiloBairro,
      onEachFeature: aoCarregarBairro
    }).addTo(mapa);

    mapa.fitBounds(camadaBairrosGlobal.getBounds(), {
      padding: [20, 20]
    });

  } catch (erro) {
    console.error("Erro ao carregar mapa:", erro);
  }
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function obterNomeBairro(feature) {
  return (
    feature.properties.NOME ||
    feature.properties.nome ||
    feature.properties.BAIRRO ||
    feature.properties.bairro ||
    feature.properties.Name ||
    feature.properties.name ||
    "Bairro"
  );
}

function contarStatusPorBairro(bairro) {
  const demandas = filtrarDemandasPorBairro(bairro);

  const total = demandas.length;
  const resolvidas = demandas.filter(d =>
    String(d.status).toUpperCase() === "RESOLVIDA"
  ).length;

  const pendentes = demandas.filter(d =>
    String(d.status).toUpperCase() !== "RESOLVIDA"
  ).length;

  return {
    total,
    resolvidas,
    pendentes
  };
}

function filtrarDemandasPorBairro(bairro) {
  return demandasTodas.filter(demanda =>
    normalizar(demanda.bairro) === normalizar(bairro)
  );
}

function estiloBairro(feature) {
  const bairro = obterNomeBairro(feature);
  const total = demandasPorBairro[normalizar(bairro)] || 0;

  let cor = "#1e293b";

  if (total >= 20) cor = "#ef4444";
  else if (total >= 10) cor = "#f97316";
  else if (total >= 5) cor = "#eab308";
  else if (total >= 1) cor = "#22c55e";

  return {
    color: "#ffffff",
    weight: 1,
    fillColor: cor,
    fillOpacity: 0.78
  };
}

function aoCarregarBairro(feature, layer) {
  const bairro = obterNomeBairro(feature);
  const dados = contarStatusPorBairro(bairro);

  layer.bindPopup(`
    <div class="info-bairro">
      <strong>${bairro}</strong>
      <br>
      Total: ${dados.total}
      <br>
      Resolvidas: ${dados.resolvidas}
      <br>
      Pendentes: ${dados.pendentes}
      <br><br>
      <small>Clique para ver os protocolos</small>
    </div>
  `);

  layer.on("mouseover", () => {
    layer.setStyle({
      weight: 3,
      fillOpacity: 0.95
    });
  });

  layer.on("mouseout", () => {
    camadaBairrosGlobal.resetStyle(layer);
  });

  layer.on("click", () => {
    selecionarBairroMapaReal(bairro, layer);
  });
}

function selecionarBairroMapaReal(bairro, layer) {
  const demandas = filtrarDemandasPorBairro(bairro);
  const dados = contarStatusPorBairro(bairro);

  montarSecretariasDoBairro(bairro);
  carregarLideranca(bairro);

  document.getElementById("bairroSelecionado").innerText = bairro;
  document.getElementById("tituloDemandasBairro").innerText = `Demandas do Bairro - ${bairro}`;

  montarTabelaDemandasBairroReal(demandas);

  layer.setStyle({
    weight: 4,
    color: "#38bdf8",
    fillOpacity: 1
  });

  layer.openPopup();

  mapa.fitBounds(layer.getBounds(), {
    padding: [40, 40],
    maxZoom: 13
  });

  atualizarCardSelecionadoMapa(bairro, dados);
}

function montarTabelaDemandasBairroReal(demandas) {
  const tbody = document.getElementById("listaDemandasBairro");

  if (!tbody) return;

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
      <td>
        <span class="status-badge ${classeStatus(demanda.status)}">
          ${demanda.status || "-"}
        </span>
      </td>
    </tr>
  `).join("");
}

function montarRankingBairrosReal(bairros) {
  const container = document.getElementById("rankingBairros");

  if (!container) return;

  if (!bairros.length) {
    container.innerHTML = "<p>Nenhum bairro com demanda cadastrada.</p>";
    return;
  }

  const maior = Math.max(...bairros.map(item => Number(item.total)));

  container.innerHTML = bairros.map(item => {
    const total = Number(item.total);
    const largura = maior ? (total / maior) * 100 : 0;

    return `
      <div class="ranking-item" onclick="selecionarBairroPeloRanking('${item.bairro}')">
        <span>${formatarNome(item.bairro)}</span>
        <div class="barra-ranking">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${total}</strong>
      </div>
    `;
  }).join("");
}

function selecionarBairroPeloRanking(bairro) {
  if (!camadaBairrosGlobal) return;

  camadaBairrosGlobal.eachLayer(layer => {
    const nomeLayer = obterNomeBairro(layer.feature);

    if (normalizar(nomeLayer) === normalizar(bairro)) {
      selecionarBairroMapaReal(nomeLayer, layer);
    }
  });
}

function atualizarCardSelecionadoMapa(bairro, dados) {
  const cardSelecionado = document.getElementById("bairroSelecionado");

  if (cardSelecionado) {
    cardSelecionado.innerText = bairro;
  }

  let info = document.getElementById("infoBairroSelecionado");

  if (!info) {
    const card = cardSelecionado?.closest(".card-mod");

    if (card) {
      info = document.createElement("p");
      info.id = "infoBairroSelecionado";
      card.appendChild(info);
    }
  }

  if (info) {
    info.innerText = `Total: ${dados.total} | Resolvidas: ${dados.resolvidas} | Pendentes: ${dados.pendentes}`;
  }
}

function classeStatus(status) {
  const texto = String(status || "").toUpperCase();

  if (texto === "RESOLVIDA") return "status-ok";
  if (texto === "RECEBIDA") return "status-recebida";
  if (texto === "EM ANÁLISE") return "status-analise";
  if (texto === "EM EXECUÇÃO") return "status-execucao";
  if (texto === "ENCAMINHADA") return "status-encaminhada";

  return "status-padrao";
}

function formatarNome(texto) {
  return String(texto || "Não informado")
    .toLowerCase()
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

window.limparSelecaoBairro = function () {
  document.getElementById("bairroSelecionado").innerText = "-";
  document.getElementById("tituloDemandasBairro").innerText = "Demandas do Bairro";

  const info = document.getElementById("infoBairroSelecionado");
  if (info) info.remove();

  const tbody = document.getElementById("listaDemandasBairro");

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Clique em um bairro para visualizar as demandas.</td>
      </tr>
    `;
  }

  if (camadaBairrosGlobal) {
    camadaBairrosGlobal.eachLayer(layer => {
      camadaBairrosGlobal.resetStyle(layer);
    });

    mapa.fitBounds(camadaBairrosGlobal.getBounds(), {
      padding: [20, 20]
    });
  }
};

function montarSecretariasDoBairro(bairro) {
  const container = document.getElementById("secretariasDoBairro");

  if (!container) return;

  const demandas = filtrarDemandasPorBairro(bairro);

  if (!demandas.length) {
    container.innerHTML = "<p>Nenhuma demanda cadastrada neste bairro.</p>";
    return;
  }

  const resumo = {};

  demandas.forEach(demanda => {
    const secretaria = demanda.secretaria || "NÃO INFORMADA";
    resumo[secretaria] = (resumo[secretaria] || 0) + 1;
  });

  const lista = Object.entries(resumo)
    .sort((a, b) => b[1] - a[1]);

  container.innerHTML = lista.map(([secretaria, total]) => `
    <div class="secretaria-bairro-item">
      <span>${secretaria}</span>
      <strong>${total}</strong>
    </div>
  `).join("");
}

async function carregarLideranca(bairro) {
  const div = document.getElementById("dadosLideranca");

  if (!div) return;

  try {

    const resposta = await fetch(
      `http://localhost:3000/api/liderancas/resumo`
    );

    const lista = await resposta.json();

    const lideranca = lista.find(item =>
      normalizar(item.bairro) === normalizar(bairro)
    );

    if (!lideranca) {

      div.innerHTML = `
        <div class="lideranca-card-info">
          <strong>Nenhuma liderança cadastrada</strong>
        </div>
      `;

      return;
    }

    div.innerHTML = `
      <div class="lideranca-card-info">

        <strong>${lideranca.nome}</strong>

        <div>
          📞 ${lideranca.telefone || "-"}
        </div>

        <hr>

        <div>Total: ${lideranca.total_demandas || 0}</div>
        <div>Resolvidas: ${lideranca.resolvidas || 0}</div>
        <div>Pendentes: ${lideranca.abertas || 0}</div>

      </div>
    `;

  } catch (erro) {

    console.error(erro);

    div.innerHTML = `
      <div class="lideranca-card-info">
        Erro ao carregar liderança
      </div>
    `;
  }
}


document.addEventListener("DOMContentLoaded", carregarMapaReal);