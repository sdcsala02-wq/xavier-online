const API_ATIVIDADES = "http://localhost:3000/api/relatorios/atividades/dashboard";

async function carregarRelatorioLegislativo() {
  try {
    const resposta = await fetch(API_ATIVIDADES);
    const dados = await resposta.json();

    const total = dados.resumo.total_atividades || 0;

    const indicacoes = buscarTotal(dados.proposicoes, "INDICAÇÃO");
    const requerimentos = buscarTotal(dados.proposicoes, "REQUERIMENTO");
    const projetoLei = buscarTotal(dados.proposicoes, "PROJETO DE LEI");

    document.getElementById("totalAtividades").innerText = total;
    document.getElementById("totalRodape").innerText = total;
    document.getElementById("totalIndicacoes").innerText = indicacoes;
    document.getElementById("totalRequerimentos").innerText = requerimentos;
    document.getElementById("totalProjetoLei").innerText = projetoLei;

    montarSecretarias(dados.secretarias || []);
    montarBairros(dados.bairros || []);

  } catch (error) {
    console.error("Erro ao carregar relatório legislativo:", error);
    alert("Erro ao carregar relatório legislativo.");
  }
}

function buscarTotal(lista, nome) {
  const item = (lista || []).find(i =>
    String(i.propositura).toUpperCase() === nome.toUpperCase()
  );

  return item ? Number(item.total) : 0;
}

function montarSecretarias(secretarias) {
  const container = document.getElementById("listaSecretarias");
  const pizza = document.getElementById("graficoPizza");

  if (!secretarias.length) {
    container.innerHTML = "<p>Nenhuma secretaria encontrada.</p>";
    return;
  }

  const cores = ["#078220", "#5b0099", "#00a7a7", "#ff9f1c", "#8b5cf6", "#d946ef"];
  const maior = Math.max(...secretarias.map(i => Number(i.total)));
  const soma = secretarias.reduce((acc, item) => acc + Number(item.total), 0);

  let inicio = 0;
  const partes = secretarias.map((item, index) => {
    const total = Number(item.total);
    const percentual = soma ? (total / soma) * 100 : 0;
    const fim = inicio + percentual;
    const cor = cores[index % cores.length];

    const trecho = `${cor} ${inicio}% ${fim}%`;
    inicio = fim;

    return trecho;
  });

  pizza.style.background = `conic-gradient(${partes.join(",")})`;

  pizza.innerHTML = secretarias.slice(0, 5).map((item, index) => {
    const classes = ["principal", "secundaria", "terceira", "quarta", "quinta"];
    return `<span class="pizza-label ${classes[index]}">${Number(item.total)}</span>`;
  }).join("");

  container.innerHTML = secretarias.map((item, index) => {
    const total = Number(item.total);
    const largura = maior ? (total / maior) * 100 : 0;
    const cor = cores[index % cores.length];

    return `
      <div class="linha-barra">
        <span class="legenda-cor" style="background:${cor}"></span>
        <b>${item.secretaria}</b>
        <div class="barra">
          <span style="width:${largura}%; background:${cor}"></span>
        </div>
        <strong>${total}</strong>
      </div>
    `;
  }).join("");
}

function montarBairros(bairros) {
  const container = document.getElementById("listaBairros");

  if (!bairros.length) {
    container.innerHTML = "<p>Nenhum bairro encontrado.</p>";
    return;
  }

  const maior = Math.max(...bairros.map(i => Number(i.total)));

  container.innerHTML = bairros.map(item => {
    const total = Number(item.total);
    const largura = maior ? (total / maior) * 100 : 0;

    return `
      <div class="bairro-item">
        <span>${formatarNome(item.bairro)}</span>
        <div class="barra">
          <span style="width:${largura}%"></span>
        </div>
        <strong>${total}</strong>
      </div>
    `;
  }).join("");
}

function formatarNome(texto) {
  return String(texto || "Não informado")
    .toLowerCase()
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

document.addEventListener("DOMContentLoaded", carregarRelatorioLegislativo);