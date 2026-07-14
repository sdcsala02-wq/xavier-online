const API_NOVA_DEMANDA = "/api/publico/nova-demanda";

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
  const servico = document.getElementById("servico");
  const secretaria = document.getElementById("secretaria");

  if (!servico || !secretaria) return;

  secretaria.value = secretariasPorServico[servico.value] || "";
}

function limparFormularioNovaDemanda() {
  const form = document.getElementById("formNovaDemanda");

  if (form) form.reset();

  const secretaria = document.getElementById("secretaria");
  if (secretaria) secretaria.value = "";
}

function abrirWhatsAppDemanda(dados, protocolo) {
  const telefoneDestino = "5513974172763";

  const mensagem = `Nova demanda Xavier Online

Protocolo: ${protocolo}
Nome: ${dados.nome}
Telefone: ${dados.telefone}
Bairro: ${dados.bairro}
Endereço: ${dados.endereco}
Serviço: ${dados.servico}
Secretaria: ${dados.secretaria}

Descrição:
${dados.descricao}`;

  const url = `https://wa.me/${telefoneDestino}?text=${encodeURIComponent(mensagem)}`;

  //window.open(url, "_blank");
}

async function salvarNovaDemanda(event) {
  event.preventDefault();

  atualizarSecretariaAutomatica();

  const dados = {
    nome: document.getElementById("nome").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    bairro: document.getElementById("bairro").value.trim(),
    endereco: document.getElementById("endereco").value.trim(),
    servico: document.getElementById("servico").value.trim(),
    secretaria: document.getElementById("secretaria").value.trim(),
    descricao: document.getElementById("descricao").value.trim()
  };

  if (!dados.nome || !dados.servico || !dados.secretaria || !dados.descricao) {
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
      alert(retorno.mensagem || retorno.erro || "Erro ao salvar demanda.");
      return;
    }

    //const protocolo = retorno.demanda?.protocolo || "-";

    const protocolo =
      retorno.protocolo ||
      retorno.demanda?.protocolo ||
      "-";




    exibirModalSucesso(protocolo);

    //abrirWhatsAppDemanda(dados, protocolo);
    //abrirWhatsAppCidadao(dados, protocolo);

    //limparFormularioNovaDemanda();

    function abrirWhatsAppCidadao(dados, protocolo) {
      const telefoneLimpo = dados.telefone.replace(/\D/g, "");

      if (!telefoneLimpo) return;

      const telefoneCidadao = telefoneLimpo.startsWith("55")
        ? telefoneLimpo
        : `55${telefoneLimpo}`;

      const mensagem = `Olá, ${dados.nome}.

Sua solicitação foi registrada no Xavier Online.

Protocolo: ${protocolo}
Serviço: ${dados.servico}
Secretaria responsável: ${dados.secretaria}
Status: RECEBIDA

Guarde este protocolo para acompanhar o atendimento.`;

      const url = `https://wa.me/${telefoneCidadao}?text=${encodeURIComponent(mensagem)}`;

      // window.open(url, "_blank");
    }

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

//function exibirModalSucesso(protocolo) {
//const numeroXavier = "5513996924317";
//const mensagem = `Olá, quero acompanhar meu protocolo ${protocolo}`;
//const linkWhatsApp = `https://wa.me/${numeroXavier}?text=${encodeURIComponent(mensagem)}`;

//document.getElementById("protocoloGerado").textContent = protocolo;
//document.getElementById("btnAbrirWhatsApp").href = linkWhatsApp;
//document.getElementById("btnConsultarProtocolo").href =
//`protocolo.html?protocolo=${encodeURIComponent(protocolo)}`;

//document.getElementById("modalSucessoDemanda").style.display = "flex";
//}

//function novaSolicitacao() {
//document.getElementById("modalSucessoDemanda").style.display = "none";
//limparFormularioNovaDemanda();
//}

function exibirModalSucesso(protocolo) {
  const numeroXavier = "5513996924317";

  const mensagem =
    `Olá, quero acompanhar meu protocolo ${protocolo}`;

  const linkWhatsApp =
    `https://wa.me/${numeroXavier}?text=${encodeURIComponent(mensagem)}`;

  const protocoloGerado =
    document.getElementById("protocoloGerado");

  const btnWhatsApp =
    document.getElementById("btnAbrirWhatsApp");

  const btnConsultar =
    document.getElementById("btnConsultarProtocolo");

  const modal =
    document.getElementById("modalSucessoDemanda");

  if (protocoloGerado) {
    protocoloGerado.textContent = protocolo;
  }

  if (btnWhatsApp) {
    btnWhatsApp.href = linkWhatsApp;
  }

  if (btnConsultar) {
    btnConsultar.href =
      `/protocolo-publico.html?protocolo=${encodeURIComponent(protocolo)}`;
  }

  if (modal) {
    modal.style.display = "flex";
  }
}