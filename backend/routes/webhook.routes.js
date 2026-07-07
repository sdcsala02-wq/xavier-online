const express = require("express");
const router = express.Router();

const {
  verificarWebhook,
  receberWebhook
} = require("../services/whatsapp.service");


// =====================================
// VERIFICAÇÃO DO WEBHOOK META
// =====================================

router.get("/", verificarWebhook);


// =====================================
// RECEBIMENTO DE EVENTOS WHATSAPP
// =====================================

router.post("/", (req, res) => {

    console.log("=================================");
    console.log("📩 WEBHOOK WHATSAPP RECEBIDO");
    console.log("=================================");

    console.log(
        JSON.stringify(req.body, null, 2)
    );


    // Encaminha para o serviço principal
    receberWebhook(req, res);

});


module.exports = router;