// Serviço responsável pela lógica do chatbot Xavier Online
// Será desenvolvido na próxima etapa com a migração do fluxo atual

exports.processarMensagem = async (dados) => {

  console.log("Processando mensagem do chatbot:", dados);

  return {
    sucesso: true,
    resposta: null
  };

};