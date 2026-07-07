const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  res.json({
    sucesso: true,
    mensagem: "Central de conversas online"
  });
});

module.exports = router;