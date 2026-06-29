async function importarArquivo(tipo) {
  const input = document.getElementById("arquivoExcel");
  const resultado = document.getElementById("resultadoImportacao");

  if (!input || !input.files || input.files.length === 0) {
    resultado.className = "erro";
    resultado.innerHTML = "Selecione um arquivo Excel antes de importar.";
    return;
  }

  const formData = new FormData();
  formData.append("arquivo", input.files[0]);

  const url =
    tipo === "atividades"
      ? "http://localhost:3000/api/importar/atividades/importar"
      : "http://localhost:3000/api/demandas-gabinete/importar";

  try {
    resultado.className = "";
    resultado.innerHTML = "Importando...";

    const resposta = await fetch(url, {
      method: "POST",
      body: formData
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      resultado.className = "erro";
      resultado.innerHTML = `
        <strong>Erro na importação.</strong><br>
        ${dados.erro || "Erro desconhecido."}<br>
        ${dados.detalhe || ""}
      `;
      return;
    }

    resultado.className = "sucesso";
    resultado.innerHTML = `
      <strong>${dados.mensagem || "Importação concluída."}</strong><br>
      Lote: ${dados.lote || "-"}<br>
      Total importado: ${dados.totalImportado ?? dados.total_importado ?? 0}<br>
      Total ignorado: ${dados.totalIgnorado ?? dados.total_ignorado ?? 0}
    `;

  } catch (erro) {
    console.error("Erro ao importar:", erro);

    resultado.className = "erro";
    resultado.innerHTML = `
      <strong>Erro ao conectar com o servidor.</strong><br>
      ${erro.message}
    `;
  }
}   