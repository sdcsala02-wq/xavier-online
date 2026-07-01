const API_INTERACOES = "http://localhost:3000/api/interacoes";

let interacoesAtuais = [];

document.addEventListener("DOMContentLoaded", () => {
  carregarInteracoes();
  configurarFiltrosInteracoes();
  configurarImportadorExcel();
});

function configurarFiltrosInteracoes() {
  [
    "filtroAno",
    "filtroMes",
    "filtroBairro",
    "filtroSecretaria",
    "filtroStatus",
    "filtroContato",
    "filtroNome"
  ].forEach(id => {
    const campo = document.getElementById(id);

    if (campo) {
      campo.addEventListener("change", carregarInteracoes);
      campo.addEventListener("input", debounce(carregarInteracoes, 400));
    }
  });
}

function configurarImportadorExcel() {
  const inputArquivo = document.getElementById("arquivoExcel");

  if (!inputArquivo) return;

  inputArquivo.addEventListener("change", importarExcelInteligente);
}

function montarQueryInteracoes() {
  const params = new URLSearchParams();

  const filtros = {
    ano: document.getElementById("filtroAno")?.value,
    mes: document.getElementById("filtroMes")?.value,
    bairro: document.getElementById("filtroBairro")?.value,
    secretaria: document.getElementById("filtroSecretaria")?.value,
    status: document.getElementById("filtroStatus")?.value,
    contato: document.getElementById("filtroContato")?.value,
    nome: document.getElementById("filtroNome")?.value
  };

  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor && String(valor).trim() !== "") {
      params.append(chave, String(valor).trim());
    }
  });

  return params.toString();
}

async function carregarInteracoes() {
  const tbody = document.getElementById("listaInteracoes");

  try {
    const query = montarQueryInteracoes();

    const urlLista = query
      ? `${API_INTERACOES}?${query}`
      : API_INTERACOES;

    const urlResumo = query
      ? `${API_INTERACOES}/resumo?${query}`
      : `${API_INTERACOES}/resumo`;

    const respostaLista = await fetch(urlLista);
    const lista = await respostaLista.json();

    const respostaResumo = await fetch(urlResumo);
    const resumo = await respostaResumo.json();

    interacoesAtuais = lista;

    atualizarCardsInteracoes(lista, resumo);
    montarResumoAnoInteracoes(resumo.porAno || []);
    montarTabelaInteracoes(lista);

  } catch (erro) {
    console.error("Erro ao carregar interações:", erro);

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9">Erro ao carregar interações.</td>
        </tr>
      `;
    }
  }
}

function atualizarCardsInteracoes(lista, resumo) {
  const bairros = new Set(lista.map(item => normalizar(item.bairro)));
  const secretarias = new Set(lista.map(item => normalizar(item.secretaria)));

  document.getElementById("totalInteracoes").innerText = resumo.total || 0;

  document.getElementById("anoSelecionadoCard").innerText =
    document.getElementById("filtroAno")?.value || "Todos";

  document.getElementById("totalBairrosInteracoes").innerText =
    [...bairros].filter(Boolean).length;

  document.getElementById("totalSecretariasInteracoes").innerText =
    [...secretarias].filter(Boolean).length;
}

function montarResumoAnoInteracoes(porAno) {
  const container = document.getElementById("resumoAnoInteracoes");

  if (!container) return;

  if (!porAno.length) {
    container.innerHTML = "<p>Nenhum dado encontrado.</p>";
    return;
  }

  const maior = Math.max(...porAno.map(item => Number(item.total)));

  container.innerHTML = porAno.map(item => {
    const total = Number(item.total);
    const largura = maior ? (total / maior) * 100 : 0;

    return `
      <div class="ranking-item">
        <span>${item.ano || "Sem ano"}</span>
        <div class="barra-ranking">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${total}</strong>
      </div>
    `;
  }).join("");
}

function montarTabelaInteracoes(lista) {
  const tbody = document.getElementById("listaInteracoes");

  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">Nenhuma interação encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(item => `
    <tr>
      <td>${formatarData(item.data)}</td>
      <td>${item.hora || "-"}</td>
      <td>${item.nome || "-"}</td>
      <td>${item.telefone || "-"}</td>
      <td>${item.bairro || "-"}</td>
      <td title="${escaparHtml(item.demanda || "")}">
        ${limitarTexto(item.demanda || "-", 80)}
      </td>
      <td>${item.secretaria || "-"}</td>
      <td>
        <span class="status-badge ${classeStatusInteracao(item.status)}">
          ${item.status || "-"}
        </span>
      </td>
      <td>${item.contato || "-"}</td>
    </tr>
  `).join("");
}

function limparFiltrosInteracoes() {
  [
    "filtroAno",
    "filtroMes",
    "filtroBairro",
    "filtroSecretaria",
    "filtroStatus",
    "filtroContato",
    "filtroNome"
  ].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.value = "";
  });

  carregarInteracoes();
}

function exportarExcelInteracoes() {
  const query = montarQueryInteracoes();
  const url = query
    ? `${API_INTERACOES}/exportar/excel?${query}`
    : `${API_INTERACOES}/exportar/excel`;

  window.open(url, "_blank");
}

function exportarPdfInteracoes() {
  const query = montarQueryInteracoes();
  const url = query
    ? `${API_INTERACOES}/exportar/pdf?${query}`
    : `${API_INTERACOES}/exportar/pdf`;

  window.open(url, "_blank");
}

async function importarExcelInteligente(event) {
  const arquivo = event.target.files[0];

  if (!arquivo) return;

  const formData = new FormData();
  formData.append("arquivo", arquivo);

  try {
    const resposta = await fetch(
      `${API_INTERACOES}/importar-inteligente`,
      {
        method: "POST",
        body: formData
      }
    );

    const dados = await resposta.json();

    event.target.value = "";

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao importar planilha.");
      return;
    }

    alert(
      `Importação inteligente concluída!\n\n` +
      `Arquivo: ${dados.arquivo}\n` +
      `Lote: ${dados.lote}\n\n` +
      `Cidadãos: ${dados.cidadaos}\n` +
      `Demandas: ${dados.demandas}\n` +
      `Histórico: ${dados.historico}\n` +
      `Estatísticas: ${dados.estatisticas}`
    );

    carregarInteracoes();

  } catch (erro) {
    console.error("Erro ao importar planilha:", erro);
    alert("Erro ao conectar com a API de importação.");
  }
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

function classeStatusInteracao(status) {
  const texto = String(status || "").toUpperCase();

  if (texto === "CONCLUÍDO" || texto === "CONCLUIDO" || texto === "RESOLVIDA") {
    return "status-ok";
  }

  if (texto === "PENDENTE") {
    return "status-analise";
  }

  if (texto === "EM ANDAMENTO") {
    return "status-execucao";
  }

  return "status-padrao";
}

function limitarTexto(texto, limite = 80) {
  const valor = String(texto || "");

  if (valor.length <= limite) return valor;

  return `${valor.substring(0, limite)}...`;
}

function escaparHtml(texto) {
  return String(texto || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function debounce(funcao, tempo = 400) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => funcao(...args), tempo);
  };
}