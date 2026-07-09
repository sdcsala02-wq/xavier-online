const API_ADMIN = "/api/demandas-gabinete";

let demandasAdmin = [];

function normalizarStatus(status) {
  const s = String(status || "").trim().toUpperCase();

  if (!s) return "CONCLUÍDO";
  if (s === "CONCLUIDO") return "CONCLUÍDO";

  return s;
}

async function carregarAdmin() {
  const listaAdmin = document.getElementById("listaAdmin");

  try {
    const resposta = await fetch(API_ADMIN);
    const dados = await resposta.json();

    demandasAdmin = Array.isArray(dados)
      ? dados
      : dados.demandas || dados.registros || [];

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
    demandas.filter(d => normalizarStatus(d.status) === "RECEBIDA").length;

  document.getElementById("cardAnalise").innerText =
    demandas.filter(d => normalizarStatus(d.status) === "EM ANÁLISE").length;

  document.getElementById("cardResolvidas").innerText =
    demandas.filter(d => {
      const status = normalizarStatus(d.status);
      return status === "RESOLVIDA" || status === "CONCLUÍDO";
    }).length;
}

function classeStatus(status) {
  switch (normalizarStatus(status)) {
    case "RECEBIDA":
      return "status-recebida";
    case "EM ANÁLISE":
      return "status-analise";
    case "ENCAMINHADA":
      return "status-encaminhada";
    case "EM EXECUÇÃO": 
      return "status-execucao";
    case "RESOLVIDA":
    case "CONCLUÍDO":
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

  listaAdmin.innerHTML = demandas.map(d => {
    const statusAtual = normalizarStatus(d.status);

    return `
      <tr>
        <td>
          <a href="#" onclick="abrirModal(${d.id})" class="link-protocolo">
            ${d.protocolo || d.id || "-"}
          </a>
        </td>

        <td>${d.nome || "-"}</td>
        <td>${d.bairro || "-"}</td>
        <td>${d.servico || d.demanda || "-"}</td>
        <td>${d.secretaria || "-"}</td>

        <td>
          <select
            class="status-select ${classeStatus(statusAtual)}"
            onchange="atualizarStatus(${d.id}, this.value)"
          >
            <option value="RECEBIDA" ${statusAtual === "RECEBIDA" ? "selected" : ""}>RECEBIDA</option>
            <option value="EM ANÁLISE" ${statusAtual === "EM ANÁLISE" ? "selected" : ""}>EM ANÁLISE</option>
            <option value="ENCAMINHADA" ${statusAtual === "ENCAMINHADA" ? "selected" : ""}>ENCAMINHADA</option>
            <option value="EM EXECUÇÃO" ${statusAtual === "EM EXECUÇÃO" ? "selected" : ""}>EM EXECUÇÃO</option>
            <option value="RESOLVIDA" ${statusAtual === "RESOLVIDA" ? "selected" : ""}>RESOLVIDA</option>
            <option value="CONCLUÍDO" ${statusAtual === "CONCLUÍDO" ? "selected" : ""}>CONCLUÍDO</option>
          </select>
        </td>

        <td>
          <button class="btn-editar" onclick="abrirModalEditar(${d.id})">
            Editar
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function aplicarFiltros() {
  const busca = document.getElementById("filtroBusca").value.toLowerCase();
  const status = document.getElementById("filtroStatus").value;

  const filtradas = demandasAdmin.filter(d => {
    const textoBusca = `
      ${d.protocolo || ""}
      ${d.id || ""}
      ${d.nome || ""}
      ${d.bairro || ""}
      ${d.servico || ""}
      ${d.demanda || ""}
      ${d.secretaria || ""}
    `.toLowerCase();

    const bateBusca = textoBusca.includes(busca);
    const bateStatus = !status || normalizarStatus(d.status) === status;

    return bateBusca && bateStatus;
  });

  renderizarTabela(filtradas);
  atualizarCards(filtradas);
}

async function atualizarStatus(id, status) {
  const demanda = demandasAdmin.find(d => Number(d.id) === Number(id));

  if (!demanda) return;

  demanda.status = status;

  renderizarTabela(demandasAdmin);
  atualizarCards(demandasAdmin);
}

function abrirModal(id) {
  const demanda = demandasAdmin.find(d => Number(d.id) === Number(id));

  if (!demanda) return;

  document.getElementById("conteudoModal").innerHTML = `
    <div class="modal-grid">
      <div class="modal-item">
        <strong>Protocolo</strong>
        ${demanda.protocolo || demanda.id || "-"}
      </div>

      <div class="modal-item">
        <strong>Status</strong>
        ${normalizarStatus(demanda.status)}
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
        ${demanda.servico || demanda.demanda || "-"}
      </div>

      <div class="modal-item">
        <strong>Secretaria</strong>
        ${demanda.secretaria || "-"}
      </div>

      <div class="modal-item descricao">
        <strong>Descrição</strong>
        ${demanda.descricao || demanda.observacao || "-"}
      </div>
    </div>
  `;

  document.getElementById("modalDemanda").style.display = "flex";
}

function fecharModal() {
  document.getElementById("modalDemanda").style.display = "none";
}

function abrirModalEditar(id) {
  const demanda = demandasAdmin.find(d => Number(d.id) === Number(id));

  if (!demanda) return;

  document.getElementById("editarId").value = demanda.id;
  document.getElementById("editarNome").value = demanda.nome || "";
  document.getElementById("editarTelefone").value = demanda.telefone || "";
  document.getElementById("editarBairro").value = demanda.bairro || "";
  document.getElementById("editarEndereco").value = demanda.endereco || "";
  document.getElementById("editarServico").value = demanda.servico || demanda.demanda || "";
  document.getElementById("editarSecretaria").value = demanda.secretaria || "";
  document.getElementById("editarStatus").value = normalizarStatus(demanda.status);
  document.getElementById("editarDescricao").value = demanda.descricao || demanda.observacao || "";

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
      alert(retorno.erro || retorno.mensagem || "Erro ao editar demanda.");
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