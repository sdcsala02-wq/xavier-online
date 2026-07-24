const API_URL_MAPA_REAL = "/api/demandas-gabinete";

const mapa = L.map("mapaLeaflet", {
  zoomControl: true,
  scrollWheelZoom: false
}).setView([-24.01, -46.43], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Xavier Online"
}).addTo(mapa);

let demandasPorBairro = {};
let demandasTodas = [];
let camadaBairrosGlobal = null;
let bairrosResumoGlobal = [];

const BAIRROS_IGNORADOS = [
  "radio clube",
  "vila gomes",
  "vila gilda",
  "parque dos esportes 2",
  "vila nova sao vicente",
  "outra cidade",
  "outro municipio",
  "outro município",
  "nao informado",
  "não informado",
  "vila nova sao vicente",
  "vila nova são vicente",
  "ribeirao preto",
  "ribeirão preto",
  "sao vicente",
  "são vicente",
  "santos",
  "itanhaem",
  "itanhaém",
  "radio clube",
  "vila gomes",
  "vila gilda",
  "",
  null,
  undefined
];

async function carregarMapaReal() {
  try {
    const [demandasResp, geojsonResp] = await Promise.all([
      fetch(API_URL_MAPA_REAL, {
        credentials: "include"
      }),
      fetch("data/bairros-praia-grande.geojson")
    ]);

    demandasTodas = await demandasResp.json();
    const bairros = await geojsonResp.json();

    bairrosResumoGlobal = gerarResumoPorBairro(demandasTodas);

    demandasPorBairro = {};

    bairrosResumoGlobal.forEach(item => {
      const bairroCorrigido = corrigirNomeBairro(item.bairro);

      if (bairroValido(bairroCorrigido)) {
        demandasPorBairro[bairroCorrigido] =
          (demandasPorBairro[bairroCorrigido] || 0) + Number(item.total || 0);
      }
    });

    atualizarCardsMapa(bairrosResumoGlobal);
    montarRankingBairrosReal(bairrosResumoGlobal);

    if (camadaBairrosGlobal) {
      mapa.removeLayer(camadaBairrosGlobal);
    }

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
    .replace(/\s+/g, " ")
    .trim();
}

function corrigirNomeBairro(bairro) {
  const chave = normalizar(bairro);

  const mapa = {
    "imperador": "imperador",
    "parque das americas": "parque das americas",
    "vilamar": "vilamar",
    "caicara": "vila caicara",
    "vila caicara": "vila caicara",

    "cidade da crianca": "cidade das criancas",
    "cidade de crianca": "cidade das criancas",
    "cidade das criancas": "cidade das criancas",

    "sitio do campo": "sitio do campo",
    "sitio do campo": "sitio do campo",

    "tupyry": "tupiry",
    "tupiry": "tupiry",

    "balneario japura": "japura",
    "balneario japuira": "japura",
    "japura": "japura",

    "jardim guaramar": "guaramar",
    "guaramar": "guaramar",

    "vila assuncao": "vila assuncao",
    "vila assunção": "vila assuncao",
    "caicara": "vila caicara",
    "vila caicara": "vila caicara",

    "cidade da crianca": "cidade das criancas",
    "cidade de crianca": "cidade das criancas",
    "cidade das criancas": "cidade das criancas",

    "jardim guaramar": "guaramar",
    "guaramar": "guaramar",

    "balneario japura": "japura",
    "balneario japuira": "japura",
    "japura": "japura",

    "boqueirao": "boqueirao",
    "guilhermina": "guilhermina",
    "aviacao": "aviacao",
    "tupi": "tupi",
    "ocian": "ocian",
    "mirim": "mirim",
    "nova mirim": "nova mirim",
    "maracana": "maracana",
    "real": "real",
    "solemar": "solemar",
    "florida": "florida",
    "esmeralda": "esmeralda",
    "ribeiropolis": "ribeiropolis",
    "samambaia": "samambaia",
    "melvi": "melvi",
    "quietude": "quietude",
    "sitio do campo": "sitio do campo",
    "anhanguera": "anhanguera",
    "antartica": "antartica",
    "vila sonia": "vila sonia",
    "canto do forte": "canto do forte",
    "princesa": "princesa",
    "gloria": "gloria",

    "outra cidade": "",
    "outro municipio": "",
    "outro município": "",
    "nao informado": "",
    "não informado": "",
    "radio clube": "",
    "vila gomes": "",
    "vila gilda": "",
    "vila nova sao vicente": "",
    "vila nova são vicente": "",
    "ribeirao preto": "",
    "ribeirão preto": "",
    "sao vicente": "",
    "são vicente": "",
    "santos": "",
    "itanhaem": "",
    "itanhaém": ""
  };

  return mapa[chave] !== undefined ? mapa[chave] : chave;
}

function bairroValido(bairro) {
  const bairroNormalizado = normalizar(bairro);
  return bairroNormalizado && !BAIRROS_IGNORADOS.map(normalizar).includes(bairroNormalizado);
}

function gerarResumoPorBairro(demandas) {
  const resumo = {};

  demandas.forEach(demanda => {
    const bairroOriginal = demanda.bairro || "";
    const bairroCorrigido = corrigirNomeBairro(bairroOriginal);

    if (!bairroValido(bairroCorrigido)) return;

    resumo[bairroCorrigido] = (resumo[bairroCorrigido] || 0) + 1;
  });

  return Object.entries(resumo)
    .map(([bairro, total]) => ({
      bairro,
      total
    }))
    .sort((a, b) => b.total - a.total);
}

function atualizarCardsMapa(bairros) {
  const bairrosValidos = bairros
    .map(item => corrigirNomeBairro(item.bairro))
    .filter(bairroValido);

  const bairrosUnicos = [...new Set(bairrosValidos)];

  const totalDemandasBanco = Array.isArray(demandasTodas)
    ? demandasTodas.length
    : 0;

  const destaque = bairros[0];

  preencherTextoMapa("totalBairros", bairrosUnicos.length);
  preencherTextoMapa("totalDemandasMapa", totalDemandasBanco);
  preencherTextoMapa("bairroDestaque", destaque ? formatarNome(destaque.bairro) : "-");
}

function preencherTextoMapa(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;

  el.innerText = typeof valor === "number"
    ? valor.toLocaleString("pt-BR")
    : valor;
}

function obterNomeBairro(feature) {
  const p = feature.properties || {};

  return (
    p.NOME ||
    p.nome ||
    p.BAIRRO ||
    p.bairro ||
    p.Name ||
    p.name ||
    p.NM_BAIRRO ||
    p.nm_bairro ||
    p.NOME_BAIRRO ||
    p.nome_bairro ||
    p.nomebairro ||
    "Bairro"
  );
}

function filtrarDemandasPorBairro(bairro) {
  return demandasTodas.filter(demanda =>
    corrigirNomeBairro(demanda.bairro) === corrigirNomeBairro(bairro)
  );
}

function contarStatusPorBairro(bairro) {
  const demandas = filtrarDemandasPorBairro(bairro);
  const total = demandas.length;

  const concluidas = demandas.filter(d => {
    const status = String(d.status || "").toUpperCase();
    return status === "CONCLUÍDO" || status === "CONCLUIDO" || status === "RESOLVIDA";
  }).length;

  return {
    total,
    resolvidas: concluidas,
    pendentes: total - concluidas
  };
}

function estiloBairro(feature) {
  const bairro = obterNomeBairro(feature);
  const total = demandasPorBairro[corrigirNomeBairro(bairro)] || 0;

  let cor = "#1e293b";

  if (total >= 100) cor = "#ef4444";
  else if (total >= 50) cor = "#f97316";
  else if (total >= 20) cor = "#eab308";
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
      <strong>${bairro}</strong><br>
      Total: ${dados.total}<br>
      Concluídas: ${dados.resolvidas}<br>
      Pendentes: ${dados.pendentes}<br><br>
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
    if (camadaBairrosGlobal) {
      camadaBairrosGlobal.resetStyle(layer);
    }
  });

  layer.on("click", () => {
    selecionarBairroMapaReal(bairro, layer);
  });
}

function selecionarBairroMapaReal(bairro, layer = null) {
  const demandas = filtrarDemandasPorBairro(bairro);
  const dados = contarStatusPorBairro(bairro);

  preencherTextoMapa("bairroSelecionado", bairro);

  const titulo = document.getElementById("tituloDemandasBairro");
  if (titulo) titulo.innerText = `Demandas do Bairro - ${bairro}`;

  montarTabelaDemandasBairroReal(demandas);
  montarSecretariasDoBairro(bairro);
  carregarLideranca(bairro);
  atualizarCardSelecionadoMapa(bairro, dados);

  if (layer) {
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
  }
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
      <td>${demanda.codigo_origem || demanda.protocolo || demanda.id || "-"}</td>
      <td>${demanda.nome || "-"}</td>
      <td>${demanda.demanda || demanda.servico || "-"}</td>
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

  const maior = Math.max(...bairros.map(item => Number(item.total || 0)), 1);

  container.innerHTML = bairros.map(item => {
    const total = Number(item.total || 0);
    const largura = (total / maior) * 100;
    const bairroSeguro = String(item.bairro || "").replace(/'/g, "\\'");

    return `
      <div 
        onclick="selecionarBairroPeloRanking('${bairroSeguro}')"
        style="
          display: grid;
          grid-template-columns: 115px 1fr 45px;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          cursor: pointer;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
        "
      >
        <span style="
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        ">
          ${formatarNome(item.bairro)}
        </span>

        <div style="
          width: 100%;
          height: 10px;
          background: #1f2a44;
          border-radius: 999px;
          overflow: hidden;
        ">
          <b style="
            display: block;
            width: ${largura}%;
            height: 100%;
            background: linear-gradient(90deg, #2563eb, #38bdf8);
            border-radius: 999px;
          "></b>
        </div>

        <strong style="
          text-align: right;
          color: #ffffff;
        ">
          ${total}
        </strong>
      </div>
    `;
  }).join("");
}

function selecionarBairroPeloRanking(bairro) {
  let encontrouNoMapa = false;

  if (camadaBairrosGlobal) {
    camadaBairrosGlobal.eachLayer(layer => {
      const nomeLayer = obterNomeBairro(layer.feature);

      if (corrigirNomeBairro(nomeLayer) === corrigirNomeBairro(bairro)) {
        encontrouNoMapa = true;
        selecionarBairroMapaReal(nomeLayer, layer);
      }
    });
  }

  if (!encontrouNoMapa) {
    selecionarBairroMapaReal(bairro, null);
  }
}

function atualizarCardSelecionadoMapa(bairro, dados) {
  preencherTextoMapa("bairroSelecionado", bairro);

  const info = document.getElementById("infoBairroSelecionado");
  if (info) {
    info.innerText = `Total: ${dados.total} | Concluídas: ${dados.resolvidas} | Pendentes: ${dados.pendentes}`;
  }
}

function classeStatus(status) {
  const texto = String(status || "").toUpperCase();

  if (texto === "CONCLUÍDO" || texto === "CONCLUIDO" || texto === "RESOLVIDA") {
    return "status-ok";
  }

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

window.selecionarBairroPeloRanking = selecionarBairroPeloRanking;

window.limparSelecaoBairro = function () {
  preencherTextoMapa("bairroSelecionado", "-");

  const info = document.getElementById("infoBairroSelecionado");
  if (info) info.innerText = "Bairro em análise";

  const titulo = document.getElementById("tituloDemandasBairro");
  if (titulo) titulo.innerText = "Demandas do Bairro";

  const tbody = document.getElementById("listaDemandasBairro");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Clique em um bairro para visualizar as demandas.</td>
      </tr>
    `;
  }

  const secretarias = document.getElementById("secretariasDoBairro");
  if (secretarias) {
    secretarias.innerHTML = "<p>Selecione um bairro no mapa.</p>";
  }

  const lideranca = document.getElementById("dadosLideranca");
  if (lideranca) {
    lideranca.innerHTML = "<p>Selecione um bairro no mapa.</p>";
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

  const lista = Object.entries(resumo).sort((a, b) => b[1] - a[1]);

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
    const resposta = await fetch("/api/liderancas/resumo",
      {
        credentials: "include"
      }
    );
    const lista = await resposta.json();

    const lideranca = lista.find(item =>
      corrigirNomeBairro(item.bairro) === corrigirNomeBairro(bairro)
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
        <div>📞 ${lideranca.telefone || "-"}</div>
        <hr>
        <div>Total: ${lideranca.total_demandas || 0}</div>
        <div>Resolvidas: ${lideranca.resolvidas || 0}</div>
        <div>Pendentes: ${lideranca.abertas || 0}</div>
      </div>
    `;

  } catch (erro) {
    div.innerHTML = `
      <div class="lideranca-card-info">
        Erro ao carregar liderança
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", carregarMapaReal);