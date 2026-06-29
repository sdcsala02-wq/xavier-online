const API_DEMANDAS = "http://localhost:3000/api/demandas-gabinete";
const API_INTERACOES = "http://localhost:3000/api/interacoes";

async function carregarDashboard() {
  try {
    const [resDemandas, resInteracoes, resLista] = await Promise.all([
      fetch(`${API_DEMANDAS}/resumo`),
      fetch(`${API_INTERACOES}/resumo`),
      fetch(API_DEMANDAS)
    ]);

    const demandas = await resDemandas.json();
    const interacoes = await resInteracoes.json();
    const lista = await resLista.json();

    const demandas2025 = totalAno(demandas.evolucaoAnual, 2025);
    const demandas2026 = totalAno(demandas.evolucaoAnual, 2026);

    const interacoes2025 = totalAno(interacoes.porAno, 2025);
    const interacoes2026 = totalAno(interacoes.porAno, 2026);

    preencherTexto("demandas2025", demandas2025);
    preencherTexto("demandas2026", demandas2026);
    preencherTexto("interacoes2025", interacoes2025);
    preencherTexto("interacoes2026", interacoes2026);
    
    preencherTexto("donutTotal", demandas.total || 0);

    montarEvolucaoAnual([
      { ano: 2025, total: demandas2025 + interacoes2025 },
      { ano: 2026, total: demandas2026 + interacoes2026 }
    ]);

    montarGraficoStatus(demandas.porStatus || [], demandas.total || 0);
    montarRanking("rankingSecretarias", demandas.porSecretaria || [], "secretaria");
    montarRanking("rankingBairros", demandas.topBairros || [], "bairro");
    montarEvolucaoMensal(demandas.evolucaoMensal || []);
    montarUltimasDemandas(lista || []);

  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);
  }
}

function totalAno(lista, ano) {
  if (!Array.isArray(lista)) return 0;

  const item = lista.find(i => Number(i.ano) === Number(ano));
  return Number(item?.total || 0);
}

function preencherTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.innerText = formatarNumero(valor || 0);
  }
}

function montarEvolucaoAnual(dados) {
  const container = document.getElementById("evolucaoAnual");
  if (!container) return;

  const maior = Math.max(...dados.map(item => Number(item.total)), 1);

  container.innerHTML = dados.map(item => {
    const total = Number(item.total);
    const largura = (total / maior) * 100;

    return `
      <div class="linha-ranking-bi">
        <span>${item.ano}</span>
        <div class="barra-bi">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${formatarNumero(total)}</strong>
      </div>
    `;
  }).join("");
}

function montarGraficoStatus(statusLista, totalGeral) {
  const donut = document.querySelector(".donut-fake");
  const legenda = document.getElementById("legendaStatus");

  if (!donut || !legenda) return;

  const listaLimpa = statusLista.filter(item => item.status !== "INTERAÇÃO");

  if (!listaLimpa.length) {
    donut.style.background = "conic-gradient(#334155 0 100%)";
    legenda.innerHTML = "<p>Nenhum status encontrado.</p>";
    return;
  }

  const cores = ["#22c55e", "#f59e0b", "#2563eb", "#ef4444", "#8b5cf6", "#38bdf8"];
  let inicio = 0;

  const partes = listaLimpa.map((item, index) => {
    const total = Number(item.total);
    const percentual = totalGeral ? (total / totalGeral) * 100 : 0;
    const fim = inicio + percentual;
    const cor = cores[index % cores.length];

    const parte = `${cor} ${inicio}% ${fim}%`;
    inicio = fim;

    return parte;
  });

  donut.style.background = `conic-gradient(${partes.join(",")})`;

  legenda.innerHTML = listaLimpa.map((item, index) => {
    const total = Number(item.total);
    const percentual = totalGeral ? ((total / totalGeral) * 100).toFixed(1) : 0;
    const cor = cores[index % cores.length];

    return `
      <div class="item-legenda-status">
        <span style="background:${cor}"></span>
        <p>${item.status}</p>
        <strong>${formatarNumero(total)} (${percentual}%)</strong>
      </div>
    `;
  }).join("");
}

function montarRanking(id, dados, campoNome) {
  const container = document.getElementById(id);
  if (!container) return;

  const lista = dados.slice(0, 10);
  const maior = Math.max(...lista.map(item => Number(item.total)), 1);

  container.innerHTML = lista.map(item => {
    const nome = item[campoNome] || "-";
    const total = Number(item.total || 0);
    const largura = (total / maior) * 100;

    return `
      <div class="linha-ranking-bi">
        <span title="${nome}">${limitarTexto(nome, 22)}</span>
        <div class="barra-bi">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${formatarNumero(total)}</strong>
      </div>
    `;
  }).join("");
}

function montarEvolucaoMensal(dados) {
  const container = document.getElementById("evolucaoMensal");
  if (!container) return;

  const anosPermitidos = ["2025", "2026"];
  const mesesOrdem = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
  ];

  const porAno = { "2025": [], "2026": [] };

  dados.forEach(item => {
    const ano = String(item.ano);
    if (!anosPermitidos.includes(ano)) return;

    porAno[ano].push({
      mes: String(item.mes || "").toUpperCase(),
      total: Number(item.total || 0)
    });
  });

  container.innerHTML = anosPermitidos.map(ano => {
    const meses = porAno[ano].sort(
      (a, b) => mesesOrdem.indexOf(a.mes) - mesesOrdem.indexOf(b.mes)
    );

    const totalAno = meses.reduce((acc, item) => acc + item.total, 0);
    const maiorMes = Math.max(...meses.map(item => item.total), 1);

    return `
      <div class="evolucao-card-ano">
        <div class="evolucao-card-topo">
          <div>
            <h4>${ano}</h4>
            <span>Total anual</span>
          </div>
          <strong>${formatarNumero(totalAno)}</strong>
        </div>

        <div class="evolucao-meses">
          ${meses.map(item => {
      const largura = (item.total / maiorMes) * 100;

      return `
              <div class="evolucao-mes-linha">
                <span>${abreviarMes(item.mes)}</span>
                <div class="evolucao-barra">
                  <b style="width:${largura}%"></b>
                </div>
                <strong>${formatarNumero(item.total)}</strong>
              </div>
            `;
    }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function montarUltimasDemandas(demandas) {
  const listaDemandas = document.getElementById("listaDemandas");
  if (!listaDemandas) return;

  if (!demandas.length) {
    listaDemandas.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma demanda encontrada</td>
      </tr>
    `;
    return;
  }

  listaDemandas.innerHTML = demandas.slice(0, 8).map(demanda => `
    <tr>
      <td>${demanda.codigo_origem || demanda.id || "-"}</td>
      <td>${demanda.nome || "-"}</td>
      <td>${limitarTexto(demanda.demanda || "-", 60)}</td>
      <td>${demanda.secretaria || "-"}</td>
      <td>${demanda.status || "-"}</td>
    </tr>
  `).join("");
}

function abreviarMes(mes) {
  const mapa = {
    JANEIRO: "JAN",
    FEVEREIRO: "FEV",
    MARÇO: "MAR",
    MARCO: "MAR",
    ABRIL: "ABR",
    MAIO: "MAI",
    JUNHO: "JUN",
    JULHO: "JUL",
    AGOSTO: "AGO",
    SETEMBRO: "SET",
    OUTUBRO: "OUT",
    NOVEMBRO: "NOV",
    DEZEMBRO: "DEZ"
  };

  return mapa[String(mes || "").toUpperCase()] || mes || "-";
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function limitarTexto(texto, limite = 40) {
  const valor = String(texto || "");
  return valor.length <= limite ? valor : `${valor.substring(0, limite)}...`;
}

document.addEventListener("DOMContentLoaded", carregarDashboard);

function exportarExcel() {
  window.open(
    "http://localhost:3000/api/demandas/exportar/excel",
    "_blank"
  );
}

function exportarPDF() {
  window.open(
    "http://localhost:3000/api/demandas/exportar/pdf",
    "_blank"
  );
}

function mostrarSecretaria() {
  const servico = document.getElementById("servico");
  const secretariaPreview = document.getElementById("secretariaPreview");

  if (!servico || !secretariaPreview) return;

  const valor = servico.value;

  const mapaSecretarias = {
    "Limpeza Urbana": "SESURB",
    "Iluminação Pública": "SESURB",
    "Buraco na Rua": "SESURB",
    "Coleta de Lixo": "SESURB",

    "Saúde": "SESAP",
    "Consulta Médica": "SESAP",
    "Medicamento": "SESAP",

    "Educação": "SEDUC",
    "Creche": "SEDUC",
    "Escola": "SEDUC",

    "Trânsito": "SETRANSP",
    "Sinalização": "SETRANSP",
    "Lombada": "SETRANSP",

    "Assistência Social": "SEAS",
    "Fiscalização": "SEURB",
    "Gabinete": "GABINETE"
  };

  secretariaPreview.innerText = mapaSecretarias[valor] || "---";
}