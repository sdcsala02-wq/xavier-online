const API_LIDERANCAS_XAVIER = "/api/liderancas";
const API_DEMANDAS_LIDERANCAS_XAVIER = "/api/demandas";

let liderancaEditandoId = null;

document.addEventListener("DOMContentLoaded", () => {
  carregarLiderancas();
  configurarFormularioLideranca();
});

function garantirArray(dados) {
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.dados)) return dados.dados;
  if (Array.isArray(dados?.liderancas)) return dados.liderancas;
  if (Array.isArray(dados?.rows)) return dados.rows;
  return [];
}

async function buscarJsonLiderancas(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "include",
    ...opcoes
  });

  const texto = await resposta.text();

  let dados = null;

  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = {
      erro: texto || "Resposta inválida do servidor."
    };
  }

  if (!resposta.ok) {
    throw new Error(dados?.erro || dados?.mensagem || `Erro HTTP ${resposta.status}`);
  }

  return dados;
}

function configurarFormularioLideranca() {
  const form = document.getElementById("formLideranca");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const dados = {
      bairro: document.getElementById("bairro").value.trim(),
      nome: document.getElementById("nome").value.trim(),
      telefone: document.getElementById("telefone").value.trim(),
      observacao: document.getElementById("observacao").value.trim()
    };

    if (!dados.bairro || !dados.nome) {
      alert("Informe o bairro e o nome da liderança.");
      return;
    }

    try {
      const url = liderancaEditandoId
        ? `${API_LIDERANCAS_XAVIER}/${liderancaEditandoId}`
        : API_LIDERANCAS_XAVIER;

      const metodo = liderancaEditandoId ? "PUT" : "POST";

      await buscarJsonLiderancas(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dados)
      });

      alert(
        liderancaEditandoId
          ? "Liderança atualizada com sucesso!"
          : "Liderança cadastrada com sucesso!"
      );

      limparFormulario();
      carregarLiderancas();

    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao conectar com a API.");
    }
  });
}

async function carregarLiderancas() {
  try {
    const dadosLiderancas = await buscarJsonLiderancas(API_LIDERANCAS_XAVIER);
    const liderancas = garantirArray(dadosLiderancas);

    let demandas = [];

    try {
      const dadosDemandas = await buscarJsonLiderancas(API_DEMANDAS_LIDERANCAS_XAVIER);
      demandas = garantirArray(dadosDemandas);
    } catch (erroDemandas) {
      console.warn("Não foi possível carregar demandas relacionadas:", erroDemandas);
    }

    atualizarCards(liderancas, demandas);
    montarTabelaLiderancas(liderancas);
    montarRankingLiderancas(liderancas);

  } catch (error) {
    console.error("Erro ao carregar lideranças:", error);

    atualizarCards([], []);
    montarTabelaLiderancas([]);
    montarRankingLiderancas([]);
  }
}

function atualizarCards(liderancas, demandas) {
  const listaLiderancas = garantirArray(liderancas);
  const listaDemandas = garantirArray(demandas);

  const bairros = new Set(
    listaLiderancas
      .map(item => normalizar(item.bairro))
      .filter(Boolean)
  );

  const demandasRelacionadas = listaDemandas.filter(demanda =>
    bairros.has(normalizar(demanda.bairro))
  );

  document.getElementById("totalLiderancas").innerText = listaLiderancas.length;
  document.getElementById("totalBairrosLiderancas").innerText = bairros.size;
  document.getElementById("totalDemandasLiderancas").innerText = demandasRelacionadas.length;
}

function montarTabelaLiderancas(liderancas) {
  const tbody = document.getElementById("listaLiderancas");
  const lista = garantirArray(liderancas);

  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma liderança cadastrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(item => `
    <tr>
      <td>${item.bairro || "-"}</td>
      <td>${item.nome || "-"}</td>
      <td>${item.telefone || "-"}</td>
      <td>${item.observacao || "-"}</td>
      <td>
        <button class="btn-editar" onclick='editarLideranca(${JSON.stringify(item)})'>
          Editar
        </button>

        <button class="btn-excluir" onclick="excluirLideranca(${item.id})">
          Excluir
        </button>
      </td>
    </tr>
  `).join("");
}

function editarLideranca(item) {
  liderancaEditandoId = item.id;

  document.getElementById("bairro").value = item.bairro || "";
  document.getElementById("nome").value = item.nome || "";
  document.getElementById("telefone").value = item.telefone || "";
  document.getElementById("observacao").value = item.observacao || "";

  const botao = document.querySelector("#formLideranca button[type='submit']");

  if (botao) {
    botao.innerText = "Atualizar Liderança";
  }

  criarBotaoCancelar();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function criarBotaoCancelar() {
  if (document.getElementById("btnCancelarEdicao")) return;

  const botaoSalvar = document.querySelector("#formLideranca button[type='submit']");

  if (!botaoSalvar) return;

  const botaoCancelar = document.createElement("button");
  botaoCancelar.type = "button";
  botaoCancelar.id = "btnCancelarEdicao";
  botaoCancelar.className = "btn-cancelar";
  botaoCancelar.innerText = "Cancelar Edição";
  botaoCancelar.onclick = limparFormulario;

  botaoSalvar.insertAdjacentElement("afterend", botaoCancelar);
}

function limparFormulario() {
  liderancaEditandoId = null;

  const form = document.getElementById("formLideranca");

  if (form) form.reset();

  const botao = document.querySelector("#formLideranca button[type='submit']");

  if (botao) {
    botao.innerText = "Salvar Liderança";
  }

  const botaoCancelar = document.getElementById("btnCancelarEdicao");

  if (botaoCancelar) {
    botaoCancelar.remove();
  }
}

function montarRankingLiderancas(liderancas) {
  const container = document.getElementById("rankingLiderancas");
  const listaLiderancas = garantirArray(liderancas);

  if (!container) return;

  if (!listaLiderancas.length) {
    container.innerHTML = "<p>Nenhuma liderança cadastrada.</p>";
    return;
  }

  const resumo = {};

  listaLiderancas.forEach(item => {
    const bairro = item.bairro || "Não informado";
    resumo[bairro] = (resumo[bairro] || 0) + 1;
  });

  const lista = Object.entries(resumo).sort((a, b) => b[1] - a[1]);
  const maior = Math.max(...lista.map(item => item[1]));

  container.innerHTML = lista.map(([bairro, total]) => {
    const largura = maior ? (total / maior) * 100 : 0;

    return `
      <div class="ranking-item">
        <span>${bairro}</span>
        <div class="barra-ranking">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${total}</strong>
      </div>
    `;
  }).join("");
}

async function excluirLideranca(id) {
  if (!confirm("Deseja excluir esta liderança?")) return;

  try {
    await buscarJsonLiderancas(`${API_LIDERANCAS_XAVIER}/${id}`, {
      method: "DELETE"
    });

    carregarLiderancas();

  } catch (error) {
    console.error(error);
    alert(error.message || "Erro ao excluir liderança.");
  }
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}