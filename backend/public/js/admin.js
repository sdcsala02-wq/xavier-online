const API_ADMIN = "http://localhost:3000/api/demandas";

let demandasAdmin = [];

async function carregarAdmin() {
  const listaAdmin = document.getElementById("listaAdmin");

  try {
    const resposta = await fetch(API_ADMIN);
    demandasAdmin = await resposta.json();

    atualizarCards(demandasAdmin);
    renderizarTabela(demandasAdmin);

  } catch (error) {
    console.error("Erro ao carregar admin:", error);
    listaAdmin.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar demandas.</td>
      </tr>
    `;
  }
}

function atualizarCards(demandas) {
  document.getElementById("cardTotal").innerText = demandas.length;

  document.getElementById("cardRecebidas").innerText =
    demandas.filter(d => d.status === "RECEBIDA").length;

  document.getElementById("cardAnalise").innerText =
    demandas.filter(d => d.status === "EM ANÁLISE").length;

  document.getElementById("cardResolvidas").innerText =
    demandas.filter(d => d.status === "RESOLVIDA").length;
}

function classeStatus(status) {
  switch (status) {
    case "RECEBIDA":
      return "status-recebida";
    case "EM ANÁLISE":
      return "status-analise";
    case "ENCAMINHADA":
      return "status-encaminhada";
    case "EM EXECUÇÃO":
      return "status-execucao";
    case "RESOLVIDA":
      return "status-resolvida";
    default:
      return "";
  }
}

function renderizarTabela(demandas) {
  const listaAdmin = document.getElementById("listaAdmin");

  if (!demandas.length) {
    listaAdmin.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma demanda encontrada.</td>
      </tr>
    `;
    return;
  }

  listaAdmin.innerHTML = demandas.map(d => `
    <tr>
      <td>
        <a href="#" onclick="abrirModal(${d.id})" class="link-protocolo">
          ${d.protocolo}
        </a>
      </td>

      <td>${d.nome || "-"}</td>
      <td>${d.bairro || "-"}</td>
      <td>${d.servico || "-"}</td>
      <td>${d.secretaria || "-"}</td>

      <td>
        <select
          class="status-select ${classeStatus(d.status)}"
          onchange="atualizarStatus(${d.id}, this.value)"
        >
          <option value="RECEBIDA" ${d.status === "RECEBIDA" ? "selected" : ""}>RECEBIDA</option>
          <option value="EM ANÁLISE" ${d.status === "EM ANÁLISE" ? "selected" : ""}>EM ANÁLISE</option>
          <option value="ENCAMINHADA" ${d.status === "ENCAMINHADA" ? "selected" : ""}>ENCAMINHADA</option>
          <option value="EM EXECUÇÃO" ${d.status === "EM EXECUÇÃO" ? "selected" : ""}>EM EXECUÇÃO</option>
          <option value="RESOLVIDA" ${d.status === "RESOLVIDA" ? "selected" : ""}>RESOLVIDA</option>
        </select>
      </td>

      <td>
        <button class="btn-editar" onclick="abrirModalEditar(${d.id})">
          Editar
        </button>
      </td>
    </tr>
  `).join("");
}

function aplicarFiltros() {
  const busca = document.getElementById("filtroBusca").value.toLowerCase();
  const status = document.getElementById("filtroStatus").value;

  const filtradas = demandasAdmin.filter(d => {
    const textoBusca = `
      ${d.protocolo || ""}
      ${d.nome || ""}
      ${d.bairro || ""}
      ${d.servico || ""}
      ${d.secretaria || ""}
    `.toLowerCase();

    const bateBusca = textoBusca.includes(busca);
    const bateStatus = !status || d.status === status;

    return bateBusca && bateStatus;
  });

  renderizarTabela(filtradas);
  atualizarCards(filtradas);
}

async function atualizarStatus(id, status) {
  try {
    const resposta = await fetch(`${API_ADMIN}/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      alert(dados.erro || "Erro ao atualizar status.");
      return;
    }

    await carregarAdmin();

  } catch (error) {
    console.error(error);
    alert("Erro ao conectar com a API.");
  }
}

function abrirModal(id) {
  const demanda = demandasAdmin.find(d => d.id === id);

  if (!demanda) return;

  document.getElementById("conteudoModal").innerHTML = `
    <div class="modal-grid">
      <div class="modal-item">
        <strong>Protocolo</strong>
        ${demanda.protocolo || "-"}
      </div>

      <div class="modal-item">
        <strong>Status</strong>
        ${demanda.status || "-"}
      </div>

      <div class="modal-item">
        <strong>Nome</strong>
        ${demanda.nome || "-"}
      </div>

      <div class="modal-item">
        <strong>Telefone</strong>
        ${demanda.telefone || "-"}
      </div>

      <div class="modal-item">
        <strong>Bairro</strong>
        ${demanda.bairro || "-"}
      </div>

      <div class="modal-item">
        <strong>Endereço</strong>
        ${demanda.endereco || "-"}
      </div>

      <div class="modal-item">
        <strong>Serviço</strong>
        ${demanda.servico || "-"}
      </div>

      <div class="modal-item">
        <strong>Secretaria</strong>
        ${demanda.secretaria || "-"}
      </div>

      <div class="modal-item descricao">
        <strong>Descrição</strong>
        ${demanda.descricao || "-"}
      </div>
    </div>
  `;

  document.getElementById("modalDemanda").style.display = "flex";
}

function fecharModal() {
  document.getElementById("modalDemanda").style.display = "none";
}

function abrirModalEditar(id) {
  const demanda = demandasAdmin.find(d => d.id === id);

  if (!demanda) return;

  document.getElementById("editarId").value = demanda.id;
  document.getElementById("editarNome").value = demanda.nome || "";
  document.getElementById("editarTelefone").value = demanda.telefone || "";
  document.getElementById("editarBairro").value = demanda.bairro || "";
  document.getElementById("editarEndereco").value = demanda.endereco || "";
  document.getElementById("editarServico").value = demanda.servico || "";
  document.getElementById("editarSecretaria").value = demanda.secretaria || "";
  document.getElementById("editarStatus").value = demanda.status || "RECEBIDA";
  document.getElementById("editarDescricao").value = demanda.descricao || "";

  document.getElementById("modalEditarDemanda").style.display = "flex";
}

function fecharModalEditar() {
  document.getElementById("modalEditarDemanda").style.display = "none";
}

async function salvarEdicaoDemanda(event) {
  event.preventDefault();

  const id = document.getElementById("editarId").value;

  const dados = {
    nome: document.getElementById("editarNome").value,
    telefone: document.getElementById("editarTelefone").value,
    bairro: document.getElementById("editarBairro").value,
    endereco: document.getElementById("editarEndereco").value,
    servico: document.getElementById("editarServico").value,
    secretaria: document.getElementById("editarSecretaria").value,
    status: document.getElementById("editarStatus").value,
    descricao: document.getElementById("editarDescricao").value
  };

  try {
    const resposta = await fetch(`${API_ADMIN}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dados)
    });

    const retorno = await resposta.json();

    if (!resposta.ok) {
      alert(retorno.erro || "Erro ao editar demanda.");
      return;
    }

    alert("Demanda atualizada com sucesso!");
    fecharModalEditar();
    await carregarAdmin();

  } catch (error) {
    console.error(error);
    alert("Erro ao conectar com a API.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  carregarAdmin();

  document.getElementById("filtroBusca").addEventListener("input", aplicarFiltros);
  document.getElementById("filtroStatus").addEventListener("change", aplicarFiltros);

  const formEditar = document.getElementById("formEditarDemanda");

  if (formEditar) {
    formEditar.addEventListener("submit", salvarEdicaoDemanda);
  }
});