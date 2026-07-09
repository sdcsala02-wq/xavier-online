const express = require("express");
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

// =====================================
// RECEBIMENTO DE EVENTOS WHATSAPP
// =====================================
router.post("/", async (req, res) => {
    try {
        console.log("📩 WEBHOOK WHATSAPP RECEBIDO");
        console.log(JSON.stringify(req.body, null, 2));

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