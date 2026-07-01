const API_LIDERANCAS = "http://localhost:3000/api/liderancas";
const API_DEMANDAS = "http://localhost:3000/api/demandas";

let liderancaEditandoId = null;

document.addEventListener("DOMContentLoaded", () => {
  carregarLiderancas();
  configurarFormularioLideranca();
});

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
        ? `${API_LIDERANCAS}/${liderancaEditandoId}`
        : API_LIDERANCAS;

      const metodo = liderancaEditandoId ? "PUT" : "POST";

      const resposta = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dados)
      });

      const retorno = await resposta.json();

      if (!resposta.ok) {
        alert(retorno.erro || "Erro ao salvar liderança.");
        return;
      }

      alert(
        liderancaEditandoId
          ? "Liderança atualizada com sucesso!"
          : "Liderança cadastrada com sucesso!"
      );

      limparFormulario();
      carregarLiderancas();

    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com a API.");
    }
  });
}

async function carregarLiderancas() {
  try {
    const respLiderancas = await fetch(API_LIDERANCAS);
    const liderancas = await respLiderancas.json();

    const respDemandas = await fetch(API_DEMANDAS);
    const demandas = await respDemandas.json();

    atualizarCards(liderancas, demandas);
    montarTabelaLiderancas(liderancas);
    montarRankingLiderancas(liderancas);

  } catch (error) {
    console.error("Erro ao carregar lideranças:", error);
  }
}

function atualizarCards(liderancas, demandas) {
  const bairros = new Set(liderancas.map(item => normalizar(item.bairro)));

  const demandasRelacionadas = demandas.filter(demanda =>
    bairros.has(normalizar(demanda.bairro))
  );

  document.getElementById("totalLiderancas").innerText = liderancas.length;
  document.getElementById("totalBairrosLiderancas").innerText = bairros.size;
  document.getElementById("totalDemandasLiderancas").innerText = demandasRelacionadas.length;
}

function montarTabelaLiderancas(liderancas) {
  const tbody = document.getElementById("listaLiderancas");

  if (!liderancas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma liderança cadastrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = liderancas.map(item => `
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

  if (!liderancas.length) {
    container.innerHTML = "<p>Nenhuma liderança cadastrada.</p>";
    return;
  }

  const resumo = {};

  liderancas.forEach(item => {
    resumo[item.bairro] = (resumo[item.bairro] || 0) + 1;
  });

  const lista = Object.entries(resumo)
    .sort((a, b) => b[1] - a[1]);

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
    const resposta = await fetch(`${API_LIDERANCAS}/${id}`, {
      method: "DELETE"
    });

    if (!resposta.ok) {
      alert("Erro ao excluir liderança.");
      return;
    }

    carregarLiderancas();

  } catch (error) {
    console.error(error);
    alert("Erro ao conectar com a API.");
  }
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}