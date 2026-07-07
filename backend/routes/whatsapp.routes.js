const express = require("express");
const router = express.Router();

const {
  verificarWebhook,
  receberWebhook
} = require("../services/whatsapp.service");

// Verificação da Meta
router.get("/", verificarWebhook);

// Recebimento das mensagens
router.post("/", receberWebhook);

module.exports = router;