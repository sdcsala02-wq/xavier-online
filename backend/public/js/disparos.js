const campoMensagem =
  document.getElementById(
    "mensagemDisparo"
  );

const previa =
  document.getElementById(
    "previaDisparo"
  );

const contador =
  document.getElementById(
    "contadorMensagem"
  );

const formulario =
  document.getElementById(
    "formCampanha"
  );

const tipoMensagem =
  document.getElementById(
    "tipoMensagem"
  );

const campoTemplate =
  document.getElementById(
    "campoTemplate"
  );

const templateCampanha =
  document.getElementById(
    "templateCampanha"
  );

const mensagemSistema =
  document.getElementById(
    "mensagemSistemaDisparos"
  );

function mostrarMensagem(
  mensagem,
  tipo = "sucesso"
) {
  if (!mensagemSistema) {
    return;
  }

  mensagemSistema.textContent =
    mensagem;

  mensagemSistema.className =
    `disparo-mensagem ${tipo}`;

  mensagemSistema.hidden = false;
}

function esconderMensagem() {
  if (mensagemSistema) {
    mensagemSistema.hidden = true;
  }
}

async function apiDisparos(
  caminho,
  opcoes = {}
) {
  const resposta =
    await fetch(
      `/api/disparos${caminho}`,
      {
        credentials: "include",
        ...opcoes,
        headers: {
          ...(
            opcoes.body instanceof FormData
              ? {}
              : {
                  "Content-Type":
                    "application/json"
                }
          ),
          ...(opcoes.headers || {})
        }
      }
    );

  let dados = {};

  try {
    dados =
      await resposta.json();
  } catch {
    dados = {};
  }

  if (!resposta.ok) {
    throw new Error(
      dados.mensagem ||
      "Não foi possível concluir a operação."
    );
  }

  return dados;
}

function atualizarPrevia() {
  const texto =
    String(
      campoMensagem?.value || ""
    ).trim();

  if (previa) {
    previa.textContent =
      texto ||
      "A prévia da mensagem aparecerá aqui.";
  }

  if (contador) {
    contador.textContent =
      `${texto.length} caracteres`;
  }
}

function atualizarTipoMensagem() {
  const usaTemplate =
    tipoMensagem?.value ===
      "TEMPLATE_OFICIAL";

  if (campoTemplate) {
    campoTemplate.hidden =
      !usaTemplate;
  }

  if (templateCampanha) {
    templateCampanha.disabled =
      !usaTemplate;
  }
}

function formatarData(valor) {
  if (!valor) {
    return "-";
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return "-";
  }

  return data.toLocaleString(
    "pt-BR"
  );
}

function nomeBase(valor) {
  const nomes = {
    CONTATOS:
      "Contatos importados",
    CIDADAOS: "Cidadãos",
    ELEITORES: "Eleitores",
    LIDERANCAS: "Lideranças"
  };

  return nomes[valor] || valor;
}

function criarCelula(
  texto,
  classe = ""
) {
  const celula =
    document.createElement("td");

  celula.textContent =
    String(
      texto ?? "-"
    );

  if (classe) {
    celula.className = classe;
  }

  return celula;
}

function renderizarCampanhas(
  campanhas
) {
  const corpo =
    document.getElementById(
      "listaCampanhas"
    );

  if (!corpo) {
    return;
  }

  corpo.replaceChildren();

  if (
    !Array.isArray(campanhas) ||
    campanhas.length === 0
  ) {
    const linha =
      document.createElement("tr");

    const celula =
      criarCelula(
        "Nenhuma campanha cadastrada."
      );

    celula.colSpan = 5;
    celula.className =
      "disparo-vazio";

    linha.appendChild(celula);
    corpo.appendChild(linha);

    return;
  }

  for (
    const campanha of campanhas
  ) {
    const linha =
      document.createElement("tr");

    linha.appendChild(
      criarCelula(
        campanha.nome
      )
    );

    linha.appendChild(
      criarCelula(
        nomeBase(
          campanha.baseDestinatarios
        )
      )
    );

    linha.appendChild(
      criarCelula(
        campanha.status,
        "disparo-status-tabela"
      )
    );

    linha.appendChild(
      criarCelula(
        campanha.totalDestinatarios
      )
    );

    linha.appendChild(
      criarCelula(
        formatarData(
          campanha.criadoEm
        )
      )
    );

    corpo.appendChild(linha);
  }
}

async function carregarResumo() {
  const dados =
    await apiDisparos(
      "/resumo"
    );

  const resumo =
    dados.resumo || {};

  document.getElementById(
    "kpiCampanhas"
  ).textContent =
    resumo.campanhas || 0;

  document.getElementById(
    "kpiDestinatarios"
  ).textContent =
    resumo.destinatarios || 0;

  document.getElementById(
    "kpiEntregues"
  ).textContent = "0";

  document.getElementById(
    "kpiFalhas"
  ).textContent =
    resumo.falhas || 0;
}

async function carregarTemplates() {
  const dados =
    await apiDisparos(
      "/templates"
    );

  templateCampanha.replaceChildren();

  const inicial =
    document.createElement(
      "option"
    );

  inicial.value = "";

  inicial.textContent =
    dados.templates.length
      ? "Selecione um template"
      : "Nenhum template cadastrado";

  templateCampanha.appendChild(
    inicial
  );

  for (
    const template of
      dados.templates
  ) {
    const opcao =
      document.createElement(
        "option"
      );

    opcao.value =
      template.id;

    opcao.textContent =
      `${template.nome_interno} — ${template.status}`;

    templateCampanha.appendChild(
      opcao
    );
  }
}

async function carregarCampanhas() {
  const dados =
    await apiDisparos(
      "/campanhas"
    );

  renderizarCampanhas(
    dados.campanhas
  );
}

async function carregarTela() {
  try {
    await Promise.all([
      carregarResumo(),
      carregarTemplates(),
      carregarCampanhas(),
      carregarCategoriasContatos(),
      carregarContatos()
    ]);

    await carregarEstimativaPublico();
  } catch (erro) {
    mostrarMensagem(
      erro.message,
      "erro"
    );
  }
}

let temporizadorEstimativaPublico = null;

async function carregarEstimativaPublico() {
  const total =
    document.getElementById(
      "totalPublicoCampanha"
    );

  const resumo =
    document.getElementById(
      "resumoPublicoCampanha"
    );

  if (!total) return;

  const parametros =
    new URLSearchParams();

  const categoriaId =
    document.getElementById(
      "categoriaCampanha"
    )?.value || "";

  const genero =
    document.getElementById(
      "generoCampanha"
    )?.value || "TODOS";

  const bairro =
    document.getElementById(
      "bairroCampanha"
    )?.value.trim() || "";

  if (categoriaId) {
    parametros.set(
      "categoriaId",
      categoriaId
    );
  }

  if (genero !== "TODOS") {
    parametros.set(
      "genero",
      genero
    );
  }

  if (bairro) {
    parametros.set(
      "bairro",
      bairro
    );
  }

  try {
    const dados =
      await apiDisparos(
        `/publico/estimativa?${parametros.toString()}`
      );

    total.textContent =
      dados.totalAutorizados || 0;

    if (resumo) {
      resumo.textContent =
        dados.totalBloqueados
          ? ` (${dados.totalBloqueados} bloqueado(s) por consentimento)`
          : "";
    }
  } catch (erro) {
    total.textContent = "-";
    if (resumo) {
      resumo.textContent =
        ` (${erro.message})`;
    }
  }
}

function agendarEstimativaPublico() {
  clearTimeout(
    temporizadorEstimativaPublico
  );

  temporizadorEstimativaPublico =
    setTimeout(
      carregarEstimativaPublico,
      300
    );
}

async function salvarRascunho(
  evento
) {
  evento.preventDefault();
  esconderMensagem();

  const nome =
    document.getElementById(
      "nomeCampanha"
    ).value.trim();

  const baseDestinatarios =
    document.getElementById(
      "baseDestinatarios"
    ).value;

  const categoriaId =
    document.getElementById(
      "categoriaCampanha"
    ).value;

  const bairro =
    document.getElementById(
      "bairroCampanha"
    ).value.trim();

  const genero =
    document.getElementById(
      "generoCampanha"
    ).value;

  const tipo =
    tipoMensagem.value;

  const templateId =
    templateCampanha.value;

  const mensagemPrevia =
    campoMensagem.value.trim();

  const agendadaPara =
    document.getElementById(
      "agendamentoCampanha"
    ).value;

  if (!nome) {
    mostrarMensagem(
      "Informe o nome da campanha.",
      "erro"
    );

    return;
  }

  if (
    tipo === "TEMPLATE_OFICIAL" &&
    !templateId
  ) {
    mostrarMensagem(
      "Cadastre ou selecione um template oficial.",
      "erro"
    );

    return;
  }

  if (
    tipo === "JANELA_24H" &&
    !mensagemPrevia
  ) {
    mostrarMensagem(
      "Informe a mensagem da campanha.",
      "erro"
    );

    return;
  }

  const botao =
    document.getElementById(
      "salvarRascunho"
    );

  botao.disabled = true;
  botao.textContent =
    "Salvando...";

  try {
    const dados =
      await apiDisparos(
        "/campanhas",
        {
          method: "POST",
          body:
            JSON.stringify({
              nome,
              baseDestinatarios,
              categoriaId:
                categoriaId || null,
              bairro:
                bairro || null,
              genero,
              tipoMensagem:
                tipo,
              templateId:
                templateId || null,
              mensagemPrevia:
                mensagemPrevia || null,
              agendadaPara:
                agendadaPara || null
            })
        }
      );

    if (
      dados.campanha?.id &&
      tipo === "TEMPLATE_OFICIAL"
    ) {
      window.xavierCampanhaDemoId =
        Number(
          dados.campanha.id
        );

      const botaoDemo =
        document.getElementById(
          "enviarTemplateDemo"
        );

      if (botaoDemo) {
        botaoDemo.hidden = false;
      }
    }

    formulario.reset();
    atualizarPrevia();
    atualizarTipoMensagem();
    await carregarEstimativaPublico();

    mostrarMensagem(
      dados.mensagem,
      "sucesso"
    );

    await Promise.all([
      carregarResumo(),
      carregarCampanhas()
    ]);
  } catch (erro) {
    mostrarMensagem(
      erro.message,
      "erro"
    );
  } finally {
    botao.disabled = false;
    botao.textContent =
      "Salvar rascunho";
  }
}


async function enviarTemplateDemo() {
  const campanhaId =
    Number(
      window.xavierCampanhaDemoId
    );

  if (!campanhaId) {
    mostrarMensagem(
      "Salve primeiro a campanha da demonstra??o.",
      "erro"
    );
    return;
  }

  const confirmado =
    window.confirm(
      "Confirmar envio do template para todos os contatos AUTORIZADOS da categoria Apresenta??o?"
    );

  if (!confirmado) {
    return;
  }

  const botao =
    document.getElementById(
      "enviarTemplateDemo"
    );

  botao.disabled = true;
  botao.textContent =
    "Enviando...";

  try {
    const dados =
      await apiDisparos(
        "/enviar",
        {
          method: "POST",
          body:
            JSON.stringify({
              campanhaId
            })
        }
      );

    mostrarMensagem(
      dados.mensagem +
      " Enviados: " +
      (dados.enviados || 0) +
      ". Falhas: " +
      (dados.falhas || 0) +
      ".",
      dados.falhas
        ? "erro"
        : "sucesso"
    );
  } catch (erro) {
    mostrarMensagem(
      erro.message,
      "erro"
    );
  } finally {
    botao.disabled = false;
    botao.textContent =
      "Enviar demonstra??o";
  }
}

function formatarTelefoneContato(
  valor
) {
  const numeros =
    String(valor || "")
      .replace(/\D/g, "");

  if (
    numeros.length === 13 &&
    numeros.startsWith("55")
  ) {
    return (
      `+55 (${numeros.slice(2, 4)}) ` +
      `${numeros.slice(4, 9)}-` +
      `${numeros.slice(9)}`
    );
  }

  if (
    numeros.length === 12 &&
    numeros.startsWith("55")
  ) {
    return (
      `+55 (${numeros.slice(2, 4)}) ` +
      `${numeros.slice(4, 8)}-` +
      `${numeros.slice(8)}`
    );
  }

  return valor || "-";
}

function criarBadgeConsentimento(
  status
) {
  const badge =
    document.createElement("span");

  const valor =
    String(
      status ||
      "SEM_REGISTRO"
    );

  badge.className =
    `disparo-consentimento ${valor.toLowerCase()}`;

  badge.textContent =
    valor.replaceAll("_", " ");

  return badge;
}

function renderizarContatos(
  contatos
) {
  const corpo =
    document.getElementById(
      "listaContatosDisparos"
    );

  if (!corpo) {
    return;
  }

  corpo.replaceChildren();

  if (
    !Array.isArray(contatos) ||
    contatos.length === 0
  ) {
    const linha =
      document.createElement("tr");

    const celula =
      criarCelula(
        "Nenhum contato encontrado."
      );

    celula.colSpan = 7;
    celula.className =
      "disparo-vazio";

    linha.appendChild(celula);
    corpo.appendChild(linha);

    return;
  }

  for (const contato of contatos) {
    const linha =
      document.createElement("tr");

    linha.appendChild(
      criarCelula(
        contato.nome || "-"
      )
    );

    const rotulosGenero = {
      HOMEM: "Homem",
      MULHER: "Mulher",
      NAO_INFORMADO: "Não informado"
    };

    linha.appendChild(
      criarCelula(
        rotulosGenero[contato.genero] ||
          "Não informado"
      )
    );

    linha.appendChild(
      criarCelula(
        formatarTelefoneContato(
          contato.telefoneNormalizado
        )
      )
    );

    const categorias =
      Array.isArray(
        contato.categorias
      )
        ? contato.categorias
            .map(
              (item) => item.nome
            )
            .join(", ")
        : "";

    linha.appendChild(
      criarCelula(
        categorias || "-"
      )
    );

    const localidade = [
      contato.bairro,
      contato.cidade
    ]
      .filter(Boolean)
      .join(" / ");

    linha.appendChild(
      criarCelula(
        localidade || "-"
      )
    );

    const celulaConsentimento =
      document.createElement("td");

    celulaConsentimento.appendChild(
      criarBadgeConsentimento(
        contato.consentimento
      )
    );

    linha.appendChild(
      celulaConsentimento
    );

    linha.appendChild(
      criarCelula(
        contato.ativo
          ? "ATIVO"
          : "INATIVO",
        contato.ativo
          ? "disparo-status-tabela"
          : ""
      )
    );

    corpo.appendChild(linha);
  }
}

async function carregarCategoriasContatos() {
  const dados =
    await apiDisparos(
      "/categorias?ativo=true"
    );

  const categorias =
    dados.categorias || [];

  function preencher(
    id,
    rotuloInicial
  ) {
    const seletor =
      document.getElementById(id);

    if (!seletor) return;

    const selecionada =
      seletor.value || "";

    seletor.replaceChildren();

    const todas =
      document.createElement(
        "option"
      );

    todas.value = "";
    todas.textContent =
      rotuloInicial;

    seletor.appendChild(todas);

    for (const categoria of categorias) {
      const opcao =
        document.createElement(
          "option"
        );

      opcao.value =
        categoria.id;
      opcao.textContent =
        `${categoria.nome} (${categoria.totalContatos})`;

      seletor.appendChild(opcao);
    }

    seletor.value =
      selecionada;
  }

  preencher(
    "filtroCategoriaContatos",
    "Todas as categorias"
  );

  preencher(
    "categoriaCampanha",
    "Todas as categorias"
  );

  const totalCategorias =
    document.getElementById(
      "totalCategoriasBase"
    );

  if (totalCategorias) {
    totalCategorias.textContent =
      dados.total || 0;
  }
}
function parametrosContatos({
  consentimentoForcado = null,
  limite = 100
} = {}) {
  const parametros =
    new URLSearchParams();

  parametros.set(
    "limite",
    String(limite)
  );

  parametros.set(
    "ativo",
    "true"
  );

  const categoriaId =
    document.getElementById(
      "filtroCategoriaContatos"
    )?.value;

  const genero =
    document.getElementById(
      "filtroGeneroContatos"
    )?.value;

  const consentimento =
    consentimentoForcado ||
    document.getElementById(
      "filtroConsentimentoContatos"
    )?.value;

  const busca =
    document.getElementById(
      "buscaContatos"
    )?.value.trim();

  if (categoriaId) {
    parametros.set(
      "categoriaId",
      categoriaId
    );
  }

  if (genero) {
    parametros.set(
      "genero",
      genero
    );
  }

  if (consentimento) {
    parametros.set(
      "consentimento",
      consentimento
    );
  }

  if (busca) {
    parametros.set(
      "busca",
      busca
    );
  }

  return parametros;
}

async function carregarContatos() {
  const parametros =
    parametrosContatos();

  const parametrosAutorizados =
    parametrosContatos({
      consentimentoForcado:
        "AUTORIZADO",
      limite: 1
    });

  const [
    dados,
    autorizados
  ] = await Promise.all([
    apiDisparos(
      `/contatos?${parametros.toString()}`
    ),

    apiDisparos(
      `/contatos?${parametrosAutorizados.toString()}`
    )
  ]);

  renderizarContatos(
    dados.contatos
  );

  const totalContatos =
    document.getElementById(
      "totalContatosBase"
    );

  if (totalContatos) {
    totalContatos.textContent =
      dados.total || 0;
  }

  const totalAutorizados =
    document.getElementById(
      "totalAutorizadosBase"
    );

  if (totalAutorizados) {
    totalAutorizados.textContent =
      autorizados.total || 0;
  }
}

async function importarContatos(
  evento
) {
  evento.preventDefault();
  esconderMensagem();

  const formularioImportacao =
    document.getElementById(
      "formImportacaoContatos"
    );

  const campoArquivo =
    document.getElementById(
      "arquivoContatos"
    );

  const arquivo =
    campoArquivo?.files?.[0];

  if (!arquivo) {
    mostrarMensagem(
      "Selecione uma planilha XLSX.",
      "erro"
    );

    return;
  }

  if (
    !arquivo.name
      .toLowerCase()
      .endsWith(".xlsx")
  ) {
    mostrarMensagem(
      "Utilize somente o modelo no formato XLSX.",
      "erro"
    );

    return;
  }

  const botao =
    document.getElementById(
      "importarContatos"
    );

  const dadosFormulario =
    new FormData();

  dadosFormulario.append(
    "arquivo",
    arquivo
  );

  botao.disabled = true;
  botao.textContent =
    "Importando...";

  try {
    const dados =
      await apiDisparos(
        "/contatos/importar",
        {
          method: "POST",
          body:
            dadosFormulario
        }
      );

    const totais =
      dados.totais || {};

    mostrarMensagem(
      [
        dados.mensagem,
        `Inseridos: ${totais.inseridos || 0}.`,
        `Atualizados: ${totais.atualizados || 0}.`,
        `Ignorados: ${totais.ignorados || 0}.`,
        `Erros: ${totais.erros || 0}.`,
        "Nenhuma mensagem foi enviada."
      ].join(" "),
      totais.erros > 0
        ? "alerta"
        : "sucesso"
    );

    formularioImportacao.reset();

    await Promise.all([
      carregarCategoriasContatos(),
      carregarContatos()
    ]);
  } catch (erro) {
    mostrarMensagem(
      erro.message,
      "erro"
    );
  } finally {
    botao.disabled = false;
    botao.textContent =
      "Importar contatos";
  }
}

async function aplicarFiltrosContatos() {
  esconderMensagem();

  try {
    await carregarContatos();
  } catch (erro) {
    mostrarMensagem(
      erro.message,
      "erro"
    );
  }
}
campoMensagem?.addEventListener(
  "input",
  atualizarPrevia
);

tipoMensagem?.addEventListener(
  "change",
  atualizarTipoMensagem
);

formulario?.addEventListener(
  "submit",
  salvarRascunho
);

document.getElementById(
  "atualizarCampanhas"
)?.addEventListener(
  "click",
  carregarTela
);

document.getElementById(
  "formImportacaoContatos"
)?.addEventListener(
  "submit",
  importarContatos
);

document.getElementById(
  "filtrarContatos"
)?.addEventListener(
  "click",
  aplicarFiltrosContatos
);

document.getElementById(
  "filtroCategoriaContatos"
)?.addEventListener(
  "change",
  aplicarFiltrosContatos
);

document.getElementById(
  "filtroGeneroContatos"
)?.addEventListener(
  "change",
  aplicarFiltrosContatos
);

document.getElementById(
  "filtroConsentimentoContatos"
)?.addEventListener(
  "change",
  aplicarFiltrosContatos
);

document.getElementById(
  "buscaContatos"
)?.addEventListener(
  "keydown",
  (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      aplicarFiltrosContatos();
    }
  }
);

document.getElementById(
  "categoriaCampanha"
)?.addEventListener(
  "change",
  carregarEstimativaPublico
);

document.getElementById(
  "generoCampanha"
)?.addEventListener(
  "change",
  carregarEstimativaPublico
);

document.getElementById(
  "bairroCampanha"
)?.addEventListener(
  "input",
  agendarEstimativaPublico
);

atualizarPrevia();
atualizarTipoMensagem();
carregarTela();

document.getElementById(
  "enviarTemplateDemo"
)?.addEventListener(
  "click",
  enviarTemplateDemo
);
