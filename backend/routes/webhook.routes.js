const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const {
    verificarWebhook
} = require("../services/whatsapp.service");

const {
    processarMensagemWhatsApp
} = require("../services/atendimento.service");

// =====================================
// VERIFICAÇÃO DO WEBHOOK META
// =====================================
router.get("/", verificarWebhook);

function assinaturaValida(req) {
    const segredo = String(
        process.env.WHATSAPP_APP_SECRET || ""
    ).trim();

    const assinaturaRecebida = String(
        req.get("x-hub-signature-256") || ""
    );

    if (!segredo || !req.rawBody) {
        return false;
    }

    const assinaturaEsperada = `sha256=${crypto
        .createHmac("sha256", segredo)
        .update(req.rawBody)
        .digest("hex")}`;

    const recebida = Buffer.from(assinaturaRecebida);
    const esperada = Buffer.from(assinaturaEsperada);

    return (
        recebida.length === esperada.length &&
        crypto.timingSafeEqual(recebida, esperada)
    );
}

// =====================================
// RECEBIMENTO DE EVENTOS WHATSAPP
// =====================================
router.post("/", async (req, res) => {
    try {
        if (!process.env.WHATSAPP_APP_SECRET) {
            console.error("WHATSAPP_APP_SECRET não configurado.");
            return res.sendStatus(503);
        }

        if (!assinaturaValida(req)) {
            console.warn("Webhook WhatsApp rejeitado: assinatura inválida.");
            return res.sendStatus(401);
        }

        console.log("Webhook WhatsApp autenticado recebido.");

        const entry = req.body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const message = value?.messages?.[0];

        if (!message) {
            return res.sendStatus(200);
        }

        const telefone = message.from;
        const texto = message.text?.body || "";

        if (telefone && texto) {
            await processarMensagemWhatsApp({
                telefone,
                mensagem: texto
            });
        }

        return res.sendStatus(200);

    } catch (erro) {
        console.error("Erro no webhook WhatsApp:", erro);
        return res.sendStatus(200);
    }
});

module.exports = router;
