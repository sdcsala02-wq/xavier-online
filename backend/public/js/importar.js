const arquivoExcel =
  document.getElementById("arquivoExcel");

const areaArquivo =
  document.getElementById("areaArquivo");

const arquivoSelecionado =
  document.getElementById("arquivoSelecionado");

const btnImportar =
  document.getElementById("btnImportar");

const progressoArea =
  document.getElementById("progressoArea");

const textoProgresso =
  document.getElementById("textoProgresso");

const percentualProgresso =
  document.getElementById("percentualProgresso");

const barraProgresso =
  document.getElementById("barraProgresso");

const resultadoImportacao =
  document.getElementById("resultadoImportacao");

const tituloResultado =
  document.getElementById("tituloResultado");

const resultadoLinhas =
  document.getElementById("resultadoLinhas");

const resultadoInseridos =
  document.getElementById("resultadoInseridos");

const resultadoAtualizados =
  document.getElementById("resultadoAtualizados");

const resultadoIgnorados =
  document.getElementById("resultadoIgnorados");

const resultadoErros =
  document.getElementById("resultadoErros");

const detalhesErros =
  document.getElementById("detalhesErros");

const listaErros =
  document.getElementById("listaErros");

let intervaloProgresso = null;


// ======================================================
// SELEÇÃO DO ARQUIVO
// ======================================================

arquivoExcel?.addEventListener(
  "change",
  () => {
    const arquivo =
      arquivoExcel.files?.[0];

    if (!arquivo) {
      limparImportacao();
      return;
    }

    const extensaoValida =
      /\.(xlsx|xls)$/i.test(
        arquivo.name
      );

    if (!extensaoValida) {
      alert(
        "Selecione um arquivo Excel no formato .xlsx ou .xls."
      );

      limparImportacao();
      return;
    }

    const tamanhoMaximo =
      10 * 1024 * 1024;

    if (
      arquivo.size >
      tamanhoMaximo
    ) {
      alert(
        "O arquivo ultrapassa o limite máximo de 10 MB."
      );

      limparImportacao();
      return;
    }

    const tamanhoFormatado =
      formatarTamanhoArquivo(
        arquivo.size
      );

    arquivoSelecionado.style.display =
      "block";

    arquivoSelecionado.textContent =
      `Arquivo selecionado: ${arquivo.name} (${tamanhoFormatado})`;

    areaArquivo.classList.add(
      "ativo"
    );

    btnImportar.disabled =
      false;

    ocultarResultado();
  }
);


// ======================================================
// IMPORTAR ELEITORES
// ======================================================

async function importarEleitores() {
  const arquivo =
    arquivoExcel?.files?.[0];

  if (!arquivo) {
    alert(
      "Selecione uma planilha antes de iniciar a importação."
    );

    return;
  }

  const confirmar =
    window.confirm(
      "Deseja importar os eleitores desta planilha?"
    );

  if (!confirmar) {
    return;
  }

  const formData =
    new FormData();

  formData.append(
    "arquivo",
    arquivo
  );

  bloquearImportacao();

  iniciarProgressoSimulado();

  try {
    const resposta =
      await fetch(
        "/api/eleitores/importar-excel",
        {
          method: "POST",
          credentials: "include",
          body: formData
        }
      );

    const dados =
      await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro ||
        dados.mensagem ||
        dados.detalhe ||
        "Não foi possível importar a planilha."
      );
    }

    finalizarProgresso();

    const resumo =
      dados.resumo || {};

    exibirResultadoSucesso(
      resumo
    );

  } catch (erro) {
    console.error(
      "Erro ao importar eleitores:",
      erro
    );

    finalizarProgresso();

    exibirResultadoErro(
      erro.message
    );

  } finally {
    desbloquearImportacao();
  }
}


// ======================================================
// RESULTADO DE SUCESSO
// ======================================================

function exibirResultadoSucesso(
  resumo
) {
  resultadoImportacao.style.display =
    "block";

  resultadoImportacao.classList.remove(
    "erro"
  );

  resultadoImportacao.classList.add(
    "sucesso"
  );

  tituloResultado.textContent =
    "Importação concluída com sucesso";

  resultadoLinhas.textContent =
    resumo.total_linhas ?? 0;

  resultadoInseridos.textContent =
    resumo.inseridos ?? 0;

  resultadoAtualizados.textContent =
    resumo.atualizados ?? 0;

  resultadoIgnorados.textContent =
    resumo.ignorados ?? 0;

  resultadoErros.textContent =
    resumo.erros ?? 0;

  preencherDetalhesErros(
    resumo.detalhes_erros || []
  );

  resultadoImportacao.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


// ======================================================
// RESULTADO DE ERRO
// ======================================================

function exibirResultadoErro(
  mensagem
) {
  resultadoImportacao.style.display =
    "block";

  resultadoImportacao.classList.remove(
    "sucesso"
  );

  resultadoImportacao.classList.add(
    "erro"
  );

  tituloResultado.textContent =
    mensagem ||
    "Erro ao realizar a importação";

  resultadoLinhas.textContent =
    "0";

  resultadoInseridos.textContent =
    "0";

  resultadoAtualizados.textContent =
    "0";

  resultadoIgnorados.textContent =
    "0";

  resultadoErros.textContent =
    "1";

  detalhesErros.style.display =
    "block";

  listaErros.innerHTML =
    "";

  const item =
    document.createElement("li");

  item.textContent =
    mensagem ||
    "Erro desconhecido.";

  listaErros.appendChild(
    item
  );

  resultadoImportacao.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


// ======================================================
// DETALHES DOS ERROS
// ======================================================

function preencherDetalhesErros(
  erros
) {
  listaErros.innerHTML =
    "";

  if (
    !Array.isArray(erros) ||
    erros.length === 0
  ) {
    detalhesErros.style.display =
      "none";

    return;
  }

  detalhesErros.style.display =
    "block";

  erros.forEach(erro => {
    const item =
      document.createElement("li");

    const linha =
      erro.linha
        ? `Linha ${erro.linha}: `
        : "";

    item.textContent =
      `${linha}${erro.erro || "Erro não identificado."}`;

    listaErros.appendChild(
      item
    );
  });
}


// ======================================================
// PROGRESSO VISUAL
// ======================================================

function iniciarProgressoSimulado() {
  let percentual = 5;

  progressoArea.style.display =
    "block";

  barraProgresso.style.width =
    `${percentual}%`;

  percentualProgresso.textContent =
    `${percentual}%`;

  textoProgresso.textContent =
    "Enviando planilha...";

  clearInterval(
    intervaloProgresso
  );

  intervaloProgresso =
    setInterval(() => {
      if (percentual >= 90) {
        clearInterval(
          intervaloProgresso
        );

        return;
      }

      percentual +=
        Math.floor(
          Math.random() * 8
        ) + 2;

      if (percentual > 90) {
        percentual = 90;
      }

      barraProgresso.style.width =
        `${percentual}%`;

      percentualProgresso.textContent =
        `${percentual}%`;

      if (percentual >= 60) {
        textoProgresso.textContent =
          "Processando os registros...";
      } else if (
        percentual >= 25
      ) {
        textoProgresso.textContent =
          "Validando a planilha...";
      }
    }, 450);
}

function finalizarProgresso() {
  clearInterval(
    intervaloProgresso
  );

  barraProgresso.style.width =
    "100%";

  percentualProgresso.textContent =
    "100%";

  textoProgresso.textContent =
    "Processamento concluído.";
}


// ======================================================
// CONTROLE DA TELA
// ======================================================

function bloquearImportacao() {
  btnImportar.disabled =
    true;

  btnImportar.textContent =
    "Importando...";
}

function desbloquearImportacao() {
  btnImportar.textContent =
    "Importar eleitores";

  btnImportar.disabled =
    !arquivoExcel?.files?.length;
}

function ocultarResultado() {
  resultadoImportacao.style.display =
    "none";

  resultadoImportacao.classList.remove(
    "sucesso",
    "erro"
  );

  detalhesErros.style.display =
    "none";

  listaErros.innerHTML =
    "";
}

function limparImportacao() {
  if (arquivoExcel) {
    arquivoExcel.value =
      "";
  }

  if (arquivoSelecionado) {
    arquivoSelecionado.style.display =
      "none";

    arquivoSelecionado.textContent =
      "";
  }

  if (areaArquivo) {
    areaArquivo.classList.remove(
      "ativo"
    );
  }

  if (btnImportar) {
    btnImportar.disabled =
      true;

    btnImportar.textContent =
      "Importar eleitores";
  }

  if (progressoArea) {
    progressoArea.style.display =
      "none";
  }

  if (barraProgresso) {
    barraProgresso.style.width =
      "0%";
  }

  if (percentualProgresso) {
    percentualProgresso.textContent =
      "0%";
  }

  clearInterval(
    intervaloProgresso
  );

  ocultarResultado();
}


// ======================================================
// FORMATAÇÃO
// ======================================================

function formatarTamanhoArquivo(
  bytes
) {
  if (!bytes) {
    return "0 KB";
  }

  const megabytes =
    bytes / 1024 / 1024;

  if (megabytes >= 1) {
    return `${megabytes.toFixed(2)} MB`;
  }

  const kilobytes =
    bytes / 1024;

  return `${kilobytes.toFixed(1)} KB`;
}