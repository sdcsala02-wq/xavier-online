const API_INTERACOES = "/api/interacoes";

const NOMES_MESES = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

document.addEventListener(
  "DOMContentLoaded",
  () => {
    configurarFiltrosInteracoes();
    configurarImportadorExcel();
    carregarInteracoes();
  }
);

function configurarFiltrosInteracoes() {
  ["filtroAno", "filtroMes"].forEach(
    (id) => {
      const campo =
        document.getElementById(id);

      if (campo) {
        campo.addEventListener(
          "change",
          carregarInteracoes
        );
      }
    }
  );
}

function configurarImportadorExcel() {
  const input =
    document.getElementById(
      "arquivoExcel"
    );

  if (!input) return;

  input.addEventListener(
    "change",
    importarExcelInteracoes
  );
}

function montarQueryInteracoes() {
  const params =
    new URLSearchParams();

  const ano =
    document.getElementById(
      "filtroAno"
    )?.value;

  const mes =
    document.getElementById(
      "filtroMes"
    )?.value;

  if (ano) {
    params.set("ano", ano);
  }

  if (mes) {
    params.set("mes", mes);
  }

  return params.toString();
}

async function carregarInteracoes() {
  const tbody =
    document.getElementById(
      "listaInteracoes"
    );

  try {
    const query =
      montarQueryInteracoes();

    const sufixo =
      query ? `?${query}` : "";

    const [
      respostaLista,
      respostaResumo
    ] = await Promise.all([
      fetch(
        `${API_INTERACOES}${sufixo}`
      ),
      fetch(
        `${API_INTERACOES}/resumo${sufixo}`
      )
    ]);

    if (
      !respostaLista.ok ||
      !respostaResumo.ok
    ) {
      throw new Error(
        "A API de interações retornou erro."
      );
    }

    const lista =
      await respostaLista.json();

    const resumo =
      await respostaResumo.json();

    preencherFiltroAnos(
      resumo.anosDisponiveis || []
    );

    atualizarCardsInteracoes(
      lista,
      resumo
    );

    montarResumoAnoInteracoes(
      resumo.porAno || []
    );

    montarTabelaInteracoes(
      lista
    );
  } catch (erro) {
    console.error(
      "Erro ao carregar interações:",
      erro
    );

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3">
            Erro ao carregar interações.
          </td>
        </tr>
      `;
    }
  }
}

function preencherFiltroAnos(
  anosBanco
) {
  const select =
    document.getElementById(
      "filtroAno"
    );

  if (!select) return;

  const selecionado =
    select.value;

  const anoAtual =
    new Date().getFullYear();

  const anos = new Set(
    [
      ...anosBanco.map(Number),
      anoAtual,
      anoAtual + 1
    ].filter(Number.isInteger)
  );

  const ordenados =
    [...anos].sort(
      (a, b) => b - a
    );

  select.innerHTML =
    '<option value="">Todos os anos</option>';

  ordenados.forEach((ano) => {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(ano);

    option.textContent =
      String(ano);

    select.appendChild(option);
  });

  if (
    selecionado &&
    anos.has(Number(selecionado))
  ) {
    select.value = selecionado;
  }
}

function atualizarCardsInteracoes(
  lista,
  resumo
) {
  const total =
    Number(resumo.total || 0);

  const ano =
    document.getElementById(
      "filtroAno"
    )?.value || "Todos";

  const mesesComDados =
    lista.length;

  const maior =
    lista.reduce(
      (atual, item) => {
        if (
          !atual ||
          Number(item.quantidade) >
            Number(
              atual.quantidade
            )
        ) {
          return item;
        }

        return atual;
      },
      null
    );

  definirTexto(
    "totalInteracoes",
    total
  );

  definirTexto(
    "anoSelecionadoCard",
    ano
  );

  definirTexto(
    "totalMesesInteracoes",
    mesesComDados
  );

  definirTexto(
    "maiorMesInteracoes",
    maior
      ? `${maior.mesNome}: ${maior.quantidade}`
      : "-"
  );
}

function montarResumoAnoInteracoes(
  porAno
) {
  const container =
    document.getElementById(
      "resumoAnoInteracoes"
    );

  if (!container) return;

  container.replaceChildren();

  if (!porAno.length) {
    const p =
      document.createElement("p");

    p.textContent =
      "Nenhum dado encontrado.";

    container.appendChild(p);
    return;
  }

  const maior =
    Math.max(
      ...porAno.map(
        (item) =>
          Number(item.total)
      )
    );

  porAno.forEach((item) => {
    const total =
      Number(item.total);

    const largura =
      maior
        ? (total / maior) * 100
        : 0;

    const linha =
      document.createElement(
        "div"
      );

    linha.className =
      "ranking-item";

    const ano =
      document.createElement(
        "span"
      );

    ano.textContent =
      String(item.ano);

    const barra =
      document.createElement(
        "div"
      );

    barra.className =
      "barra-ranking";

    const preenchimento =
      document.createElement("b");

    preenchimento.style.width =
      `${largura}%`;

    barra.appendChild(
      preenchimento
    );

    const valor =
      document.createElement(
        "strong"
      );

    valor.textContent =
      String(total);

    linha.append(
      ano,
      barra,
      valor
    );

    container.appendChild(
      linha
    );
  });
}

function montarTabelaInteracoes(
  lista
) {
  const tbody =
    document.getElementById(
      "listaInteracoes"
    );

  if (!tbody) return;

  tbody.replaceChildren();

  if (!lista.length) {
    const tr =
      document.createElement("tr");

    const td =
      document.createElement("td");

    td.colSpan = 3;
    td.textContent =
      "Nenhuma interação encontrada.";

    tr.appendChild(td);
    tbody.appendChild(tr);

    return;
  }

  lista.forEach((item) => {
    const tr =
      document.createElement("tr");

    [
      item.ano,
      item.mesNome ||
        nomeMes(item.mes),
      item.quantidade
    ].forEach((valor) => {
      const td =
        document.createElement(
          "td"
        );

      td.textContent =
        String(
          valor ?? "-"
        );

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function limparFiltrosInteracoes() {
  const ano =
    document.getElementById(
      "filtroAno"
    );

  const mes =
    document.getElementById(
      "filtroMes"
    );

  if (ano) ano.value = "";
  if (mes) mes.value = "";

  carregarInteracoes();
}

function exportarExcelInteracoes() {
  const query =
    montarQueryInteracoes();

  const url =
    query
      ? `${API_INTERACOES}/exportar/excel?${query}`
      : `${API_INTERACOES}/exportar/excel`;

  window.open(
    url,
    "_blank",
    "noopener"
  );
}

function exportarPdfInteracoes() {
  const query =
    montarQueryInteracoes();

  const url =
    query
      ? `${API_INTERACOES}/exportar/pdf?${query}`
      : `${API_INTERACOES}/exportar/pdf`;

  window.open(
    url,
    "_blank",
    "noopener"
  );
}

async function importarExcelInteracoes(
  event
) {
  const arquivo =
    event.target.files[0];

  if (!arquivo) return;

  const formData =
    new FormData();

  formData.append(
    "arquivo",
    arquivo
  );

  try {
    const resposta =
      await fetch(
        `${API_INTERACOES}/importar`,
        {
          method: "POST",
          body: formData
        }
      );

    const dados =
      await resposta.json();

    event.target.value = "";

    if (!resposta.ok) {
      alert(
        dados.erro ||
        "Erro ao importar planilha."
      );

      return;
    }

    alert(
      "Importação concluída!\n\n" +
      `Arquivo: ${dados.arquivo}\n` +
      `Linhas: ${dados.totalLinhas}\n` +
      `Novos: ${dados.totalInserido}\n` +
      `Atualizados: ${dados.totalAtualizado}\n` +
      `Sem alteração: ${dados.totalSemAlteracao}\n` +
      `Ignorados: ${dados.totalIgnorado}`
    );

    carregarInteracoes();
  } catch (erro) {
    console.error(
      "Erro ao importar planilha:",
      erro
    );

    alert(
      "Erro ao conectar com a API de importação."
    );
  }
}

function definirTexto(
  id,
  valor
) {
  const elemento =
    document.getElementById(id);

  if (elemento) {
    elemento.textContent =
      String(valor);
  }
}

function nomeMes(mes) {
  return (
    NOMES_MESES[
      Number(mes)
    ] || "-"
  );
}