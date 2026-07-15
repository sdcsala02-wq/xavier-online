require("dotenv").config();

const axios = require("axios");


// ===========================================
// NORMALIZAR TELEFONE BRASIL
// ===========================================

function normalizarTelefoneBR(numero) {

  if (!numero) {
    return null;
  }

  let telefone = numero
    .toString()
    .replace(/\D/g, "");


  // Remove 00 internacional
  if (telefone.startsWith("00")) {
    telefone = telefone.substring(2);
  }


  // Remove 55 duplicado
  if (
    telefone.startsWith("55") &&
    telefone.length > 11
  ) {
    telefone = telefone.substring(2);
  }


  // Adiciona código Brasil
  if (
    telefone.length === 10 ||
    telefone.length === 11
  ) {
    telefone = "55" + telefone;
  }


  return telefone;

}



// ===========================================
// ENVIO TEXTO WHATSAPP CLOUD API
// ===========================================

async function enviarTextoWhatsApp(numero, mensagem) {

  try {


    const telefone = normalizarTelefoneBR(numero);


    if (!telefone) {

      throw new Error(
        "Telefone inválido para WhatsApp"
      );

    }


    const phoneId =
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_PHONE_ID;


    if (!phoneId) {

      throw new Error(
        "WHATSAPP_PHONE_NUMBER_ID não configurado"
      );

    }


    if (!process.env.WHATSAPP_TOKEN) {

      throw new Error(
        "WHATSAPP_TOKEN não configurado"
      );

    }



    const url =
      `https://graph.facebook.com/v22.0/${phoneId}/messages`;



    console.log("==============================");
    console.log("Enviando WhatsApp");
    console.log("Número:", telefone);
    console.log("Phone ID:", phoneId);
    console.log("==============================");



    const resposta = await axios.post(

      url,

      {

        messaging_product: "whatsapp",

        recipient_type: "individual",

        to: telefone,

        type: "text",

        text: {

          preview_url: false,

          body: mensagem

        }

      },


      {

        headers: {

          Authorization:
            `Bearer ${process.env.WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json"

        }

      }

    );



    console.log(
      "WhatsApp enviado:",
      resposta.data
    );


    return resposta.data;



  } catch (erro) {


    console.error(
      "ERRO META WHATSAPP:"
    );


    console.error(
      erro.response?.data || erro.message
    );


    throw erro;

  }

}

// ===========================================
// ENVIO DE TEMPLATE WHATSAPP
// ===========================================

async function enviarTemplateWhatsApp(
  numero,
  nomeTemplate,
  idioma = "pt_BR",
  parametros = []
) {
  try {
    const telefone = normalizarTelefoneBR(numero);

    if (!telefone) {
      throw new Error("Telefone inválido para WhatsApp");
    }

    const phoneId =
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      process.env.WHATSAPP_PHONE_ID;

    if (!phoneId) {
      throw new Error(
        "WHATSAPP_PHONE_NUMBER_ID não configurado"
      );
    }

    if (!process.env.WHATSAPP_TOKEN) {
      throw new Error(
        "WHATSAPP_TOKEN não configurado"
      );
    }

    const url =
      `https://graph.facebook.com/v22.0/${phoneId}/messages`;

    const template = {
      name: nomeTemplate,
      language: {
        code: idioma
      }
    };

    if (parametros.length > 0) {
      template.components = [
        {
          type: "body",
          parameters: parametros.map((valor) => ({
            type: "text",
            text: String(valor ?? "")
          }))
        }
      ];
    }

    console.log("==============================");
    console.log("Enviando template WhatsApp");
    console.log("Número:", telefone);
    console.log("Template:", nomeTemplate);
    console.log("Phone ID:", phoneId);
    console.log("==============================");

    const resposta = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefone,
        type: "template",
        template
      },
      {
        headers: {
          Authorization:
            `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(
      "Template WhatsApp enviado:",
      resposta.data
    );

    return resposta.data;

  } catch (erro) {
    console.error(
      "ERRO TEMPLATE META WHATSAPP:",
      erro.response?.data || erro.message
    );

    throw erro;
  }
}



// ===========================================
// WEBHOOK META
// ===========================================

function verificarWebhook(req, res) {


  const mode =
    req.query["hub.mode"];


  const token =
    req.query["hub.verify_token"];


  const challenge =
    req.query["hub.challenge"];



  if (

    mode === "subscribe" &&

    token === process.env.VERIFY_TOKEN

  ) {


    console.log(
      "Webhook Meta verificado"
    );


    return res
      .status(200)
      .send(challenge);


  }


  return res.sendStatus(403);

}



// ===========================================
// RECEBER WEBHOOK
// ===========================================



// ===========================================  
// EXPORTS
// ===========================================
module.exports = {
  normalizarTelefoneBR,
  enviarTextoWhatsApp,
  enviarTemplateWhatsApp,
  verificarWebhook
};