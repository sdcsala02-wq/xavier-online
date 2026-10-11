const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testarOpenAI(pergunta) {

  const resposta = await client.responses.create({

    model: "gpt-5.6",

    input: `
Você é a assistente virtual do SDC Serviços de Dados e Comunicação.

Responda sempre em português.

Pergunta do cidadão:

${pergunta}
`

  });

  return resposta.output_text;

}

module.exports = {
  testarOpenAI
};