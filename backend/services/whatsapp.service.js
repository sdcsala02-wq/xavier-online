const pool = require("../db");

// ===========================================
// Verificação do Webhook da Meta
// ===========================================

exports.verificarWebhook = (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === process.env.VERIFY_TOKEN
  ) {
    console.log("✅ Webhook verificado.");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);

};

// ===========================================
// Receber mensagens
// ===========================================

exports.receberWebhook = async (req, res) => {

  try {

    console.log("📩 Webhook recebido");

    console.log(JSON.stringify(req.body, null, 2));

    // Nesta primeira etapa apenas confirmamos
    // que a Meta conseguiu entregar o evento.

    res.sendStatus(200);

  } catch (erro) {

    console.error(erro);

    res.sendStatus(500);

  }

};