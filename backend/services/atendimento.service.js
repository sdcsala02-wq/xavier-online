const db = require("../db");

const {
  enviarTextoWhatsApp,
  normalizarTelefoneBR
} = require("./whatsapp.service");

function normalizarMensagem(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extrairProtocolo(texto) {
  const encontrado = String(texto || "")
    .match(/XAV-\d{4}-\d{6}/i);

  return encontrado
    ? encontrado[0].toUpperCase()
    : null;
}

function ehSaudacao(texto) {
  const mensagem = normalizarMensagem(texto);

  const saudacoes = [
    "OI",
    "OLA",
    "BOM DIA",
    "BOA TARDE",
    "BOA NOITE",
    "MENU",
    "ATENDIMENTO",
    "INICIAR",
    "COMEÇAR",
    "COMECAR"
  ];

  return saudacoes.includes(mensagem);
}

async function buscarCidadaoPorTelefone(telefone) {
  const resultado = await db.query(
    `
    SELECT
      id,
      nome,
      telefone,
      whatsapp
    FROM cidadaos
    WHERE telefone = $1
       OR whatsapp = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [telefone]
  );

  return resultado.rows[0] || null;
}

function obterPrimeiroNome(nome) {
  const nomeLimpo = String(nome || "").trim();

  if (!nomeLimpo) {
    return null;
  }

  return nomeLimpo.split(/\s+/)[0];
}

async function enviarMenuInicial(telefone, cidadao) {
  const primeiroNome =
    obterPrimeiroNome(cidadao?.nome);

  const saudacao = primeiroNome
    ? `Olá, ${primeiroNome}! 👋`
    : "Olá! 👋";

  const mensagem = `${saudacao}

Sou a assistente virtual do Gabinete do Vereador Eduardo Xavier.

Como posso ajudar?

1️⃣ Consultar protocolo
2️⃣ Registrar uma nova solicitação
3️⃣ Falar com um assessor
4️⃣ Informações sobre o gabinete
5️⃣ Outro assunto

Digite apenas o número da opção desejada.`;

  await enviarTextoWhatsApp(
    telefone,
    mensagem
  );
}

async function responderOpcaoMenu({
  telefone,
  opcao
}) {
  switch (opcao) {
    case "1":
      await enviarTextoWhatsApp(
        telefone,
        `Certo. Para consultar sua solicitação, envie o número completo do protocolo.

Exemplo:
XAV-2026-000059`
      );
      return true;

    case "2": {
      const enderecoSistema =
        process.env.PUBLIC_URL ||
        process.env.APP_URL ||
        "";

      const linkNovaDemanda = enderecoSistema
        ? `${enderecoSistema.replace(/\/$/, "")}/nova-demanda.html`
        : "/nova-demanda.html";

      await enviarTextoWhatsApp(
        telefone,
        `Para registrar uma nova solicitação, acesse:

${linkNovaDemanda}

Preencha os dados solicitados e, ao final, você receberá o número do protocolo.`
      );

      return true;
    }

    case "3":
      await enviarTextoWhatsApp(
        telefone,
        `Certo. Seu atendimento será encaminhado para um assessor do gabinete.

Por favor, envie uma mensagem explicando brevemente o assunto.`
      );
      return true;

    case "4":
      await enviarTextoWhatsApp(
        telefone,
        `O Xavier Online é o canal digital de atendimento do Gabinete do Vereador Eduardo Xavier.

Por este canal, você pode registrar solicitações, consultar protocolos e solicitar atendimento da equipe.

Para voltar ao início, digite MENU.`
      );
      return true;

    case "5":
      await enviarTextoWhatsApp(
        telefone,
        `Por favor, escreva sua dúvida ou explique o assunto com o máximo de detalhes possível.

Nesta fase de testes, a mensagem ficará disponível para encaminhamento ao atendimento do gabinete.`
      );
      return true;

    default:
      return false;
  }
}

async function responderPorProtocolo(
  telefone,
  protocolo
) {
  const resultado = await db.query(
    `
    SELECT
      protocolo,
      solicitante,
      servico,
      secretaria,
      descricao,
      status,
      criado_em
    FROM solicitacoes_publicas
    WHERE UPPER(protocolo) = $1
    LIMIT 1
    `,
    [protocolo.toUpperCase()]
  );

  if (resultado.rows.length === 0) {
    await enviarTextoWhatsApp(
      telefone,
      `Não encontrei o protocolo ${protocolo}.

Verifique se o número foi digitado corretamente.

Exemplo:
XAV-2026-000059

Para voltar ao início, digite MENU.`
    );

    return;
  }

  const solicitacao =
    resultado.rows[0];

  await enviarTextoWhatsApp(
    telefone,
    `📋 Xavier Online

Protocolo: ${solicitacao.protocolo}

Solicitante: ${solicitacao.solicitante || "-"}
Serviço: ${solicitacao.servico || "-"}
Secretaria: ${solicitacao.secretaria || "-"}
Status: ${solicitacao.status || "RECEBIDA"}

Descrição:
${solicitacao.descricao || "Não informada"}

Para voltar ao início, digite MENU.`
  );
}

async function processarMensagemWhatsApp({
  telefone,
  mensagem
}) {
  try {
    const telefoneNormalizado =
      normalizarTelefoneBR(telefone);

    const texto =
      String(mensagem || "").trim();

    if (
      !telefoneNormalizado ||
      !texto
    ) {
      return;
    }

    console.log(
      "Mensagem recebida no atendimento:",
      {
        telefone:
          telefoneNormalizado,

        texto
      }
    );

    const cidadao =
      await buscarCidadaoPorTelefone(
        telefoneNormalizado
      );

    const protocolo =
      extrairProtocolo(texto);

    if (protocolo) {
      await responderPorProtocolo(
        telefoneNormalizado,
        protocolo
      );

      return;
    }

    if (ehSaudacao(texto)) {
      await enviarMenuInicial(
        telefoneNormalizado,
        cidadao
      );

      return;
    }

    const opcaoRespondida =
      await responderOpcaoMenu({
        telefone:
          telefoneNormalizado,

        opcao:
          normalizarMensagem(texto)
      });

    if (opcaoRespondida) {
      return;
    }

    await enviarTextoWhatsApp(
      telefoneNormalizado,
      `Não consegui identificar a opção escolhida.

Digite MENU para visualizar as opções de atendimento.`
    );
  } catch (erro) {
    console.error(
      "Erro no atendimento automático:",
      erro.response?.data ||
      erro.message
    );
  }
}

module.exports = {
  processarMensagemWhatsApp
};