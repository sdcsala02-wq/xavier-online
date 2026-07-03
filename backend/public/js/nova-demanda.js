const API_NOVA_DEMANDA = "/api/demandas";

const secretariasPorServico = {
  "Obras Públicas": "SESURB",
  "Áreas Públicas": "SESURB",
  "Limpeza e Manutenção": "SESURB",
  "Tapa Buraco": "SESURB",
  "Iluminação Pública": "SESURB",

  "Saúde": "SESAP",

  "Educação": "SEDUC",

  "Segurança": "SEASP",

  "Trânsito e Transporte": "SETRANSP",

  "Agenda com Vereador": "GABINETE",

  "Projetos e Melhorias": "SESURB",

  "Outros": "GABINETE"
};

function atualizarSecretariaAutomatica() {
  const servico = document.getElementById("servico").value;
  const secretaria = document.getElementById("secretaria");

  secretaria.value = secretariasPorServico[servico] || "GABINETE";
}

function limparFormularioNovaDemanda() {
  document.getElementById("formNovaDemanda").reset();
  document.getElementById("secretaria").value = "";
}

async function salvarNovaDemanda(event) {
  event.preventDefault();

  const dados = {
    nome: document.getElementById("nome").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    bairro: document.getElementById("bairro").value.trim(),
    endereco: document.getElementById("endereco").value.trim(),
    servico: document.getElementById("servico").value.trim(),
    secretaria: document.getElementById("secretaria").value.trim(),
    descricao: document.getElementById("descricao").value.trim()
  };

  if (!dados.nome || !dados.servico || !dados.descricao) {
    alert("Preencha nome, serviço e descrição da demanda.");
    return;
  }

  try {
    const resposta = await fetch(API_NOVA_DEMANDA, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dados)
    });

    const retorno = await resposta.json();

    if (!resposta.ok) {
      alert(retorno.erro || retorno.mensagem || "Erro ao salvar demanda.");
      return;
    }

    alert(`Demanda cadastrada com sucesso!\nProtocolo: ${retorno.demanda?.protocolo || "-"}`);

    limparFormularioNovaDemanda();

  } catch (error) {
    console.error("Erro ao salvar demanda:", error);
    alert("Erro ao conectar com a API.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const servico = document.getElementById("servico");
  const form = document.getElementById("formNovaDemanda");

  if (servico) {
    servico.addEventListener("change", atualizarSecretariaAutomatica);
  }

  if (form) {
    form.addEventListener("submit", salvarNovaDemanda);
  }
});