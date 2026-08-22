const API_DEMANDAS = "/api/demandas-gabinete";
const API_INTERACOES = "/api/interacoes";

let USUARIO_LOGADO = null;

async function carregarUsuarioLogado() {
  try {
    const resposta = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include"
    });

    const dados = await resposta.json();

    if (!resposta.ok || !dados.ok) {
      localStorage.removeItem("usuario");
      localStorage.removeItem("usuarioLogado");
      window.location.href = "index.html";
      return null;
    }

    USUARIO_LOGADO = dados.usuario;
    localStorage.setItem("usuario", JSON.stringify(dados.usuario));
    localStorage.setItem("usuarioLogado", "true");

    aplicarPermissoesMenu(dados.usuario.perfil);

    return dados.usuario;

  } catch (erro) {
    console.error("Erro ao verificar usuário:", erro);
    localStorage.removeItem("usuario");
    localStorage.removeItem("usuarioLogado");
    window.location.href = "index.html";
    return null;
  }
}

function aplicarPermissoesMenu(perfil) {
  const perfilNormalizado = String(perfil || "").toUpperCase();

  const regras = {
    ADMIN: [
      "dashboard.html",
      "demandas-gabinete.html",
      "nova-demanda.html",
      "protocolo.html",
      "mapa.html",
      "eleitores.html",
      "relatorio-legislativo.html",
      "interacoes.html",
      "importar.html",
      "secretarias.html",
      "liderancas.html",
      "configuracoes.html"
    ],

    ASSESSOR: [
      "dashboard.html",
      "demandas-gabinete.html",
      "nova-demanda.html",
      "protocolo.html",
      "mapa.html",
      "eleitores.html",
      "relatorio-legislativo.html",
      "interacoes.html",
      "importar.html",
      "secretarias.html",
      "liderancas.html"
    ],

    LIDERANCA: [
      "dashboard.html",
      "demandas-gabinete.html",
      "nova-demanda.html",
      "protocolo.html",
      "mapa.html",
      "liderancas.html"
    ],

    CONSULTA: [
      "dashboard.html",
      "protocolo.html",
      "mapa.html",
      "relatorio-legislativo.html"
    ]
  };

  const permitidos = regras[perfilNormalizado] || regras.CONSULTA;

  document.querySelectorAll(".menu a").forEach(link => {

    const href = link.getAttribute("href");

    if (!href || href === "#" || href.startsWith("http")) return;

    // Remove a barra inicial (/dashboard.html -> dashboard.html)
    const pagina = href.replace(/^\//, "");

    if (!permitidos.includes(pagina)) {
      link.style.display = "none";
    } else {
      link.style.display = "";
    }

  });
}

function marcarPaginaAtiva() {
  const paginaAtual = window.location.pathname.split("/").pop();

  document.querySelectorAll(".menu a").forEach(link => {
    const href = link.getAttribute("href");

    link.classList.remove("active");
    link.classList.remove("ativo");

    if (href === paginaAtual) {
      link.classList.add("active");
    }
  });
}

async function logoutSistema() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (erro) {
    console.error("Erro ao sair:", erro);
  }

  localStorage.clear();
  sessionStorage.clear();

  window.location.replace("/index.html");
}

async function carregarDashboard() {
  try {
    const [
      resDemandas,
      resInteracoes,
      resLista
    ] = await Promise.all([
      fetch(`${API_DEMANDAS}/resumo`, {
        credentials: "include",
        cache: "no-store"
      }),

      fetch(`${API_INTERACOES}/resumo`, {
        credentials: "include",
        cache: "no-store"
      }),

      fetch(API_DEMANDAS, {
        credentials: "include",
        cache: "no-store"
      })
    ]);

    if (!resDemandas.ok) {
      throw new Error(
        `Erro no resumo de demandas: ${resDemandas.status}`
      );
    }

    if (!resInteracoes.ok) {
      throw new Error(
        `Erro no resumo de interações: ${resInteracoes.status}`
      );
    }

    if (!resLista.ok) {
      throw new Error(
        `Erro na lista de demandas: ${resLista.status}`
      );
    }

    const demandas =
      await resDemandas.json();

    const interacoes =
      await resInteracoes.json();

    const retornoLista =
      await resLista.json();

    const lista =
      Array.isArray(retornoLista)
        ? retornoLista
        : Array.isArray(retornoLista.dados)
          ? retornoLista.dados
          : Array.isArray(retornoLista.demandas)
            ? retornoLista.demandas
            : [];

    const evolucaoMensal =
      Array.isArray(demandas.evolucaoMensal)
        ? demandas.evolucaoMensal
        : [];

    const interacoesPorAno =
      Array.isArray(interacoes.porAno)
        ? interacoes.porAno
        : [];

    const resumoAnual =
      consolidarResumoAnualDashboard(
        evolucaoMensal,
        interacoesPorAno
      );

    renderizarCardsAnuais(
      resumoAnual
    );

    atualizarPeriodoDashboard(
      resumoAnual.map(
        (item) => item.ano
      )
    );

    preencherTexto(
      "donutTotal",
      demandas.total || 0
    );

    montarEvolucaoAnual(
      resumoAnual.map((item) => ({
        ano: item.ano,
        total:
          item.demandas +
          item.interacoes
      }))
    );

    montarGraficoStatus(
      Array.isArray(demandas.porStatus)
        ? demandas.porStatus
        : [],
      Number(demandas.total || 0)
    );

    montarRanking(
      "rankingSecretarias",
      Array.isArray(
        demandas.porSecretaria
      )
        ? demandas.porSecretaria
        : [],
      "secretaria"
    );

    montarRanking(
      "rankingBairros",
      Array.isArray(
        demandas.topBairros
      )
        ? demandas.topBairros
        : [],
      "bairro"
    );

    montarEvolucaoMensal(
      evolucaoMensal
    );

    montarUltimasDemandas(
      lista
    );

    console.log(
      "Dashboard carregado:",
      {
        anos: resumoAnual,
        totalDemandas:
          demandas.total,
        registros:
          lista.length
      }
    );
  } catch (erro) {
    console.error(
      "Erro ao carregar dashboard:",
      erro
    );
  }
}

function consolidarResumoAnualDashboard(
  evolucaoMensal,
  interacoesPorAno
) {
  const mapa = new Map();

  function garantirAno(valor) {
    const ano = Number(valor);

    if (
      !Number.isInteger(ano) ||
      ano < 2000 ||
      ano > 2999
    ) {
      return null;
    }

    if (!mapa.has(ano)) {
      mapa.set(ano, {
        ano,
        demandas: 0,
        interacoes: 0
      });
    }

    return mapa.get(ano);
  }

  evolucaoMensal.forEach(
    (item) => {
      const registro =
        garantirAno(item.ano);

      if (!registro) return;

      registro.demandas +=
        Number(item.total || 0);
    }
  );

  interacoesPorAno.forEach(
    (item) => {
      const registro =
        garantirAno(item.ano);

      if (!registro) return;

      registro.interacoes +=
        Number(item.total || 0);
    }
  );

  garantirAno(
    new Date().getFullYear()
  );

  return [...mapa.values()]
    .sort(
      (a, b) =>
        a.ano - b.ano
    );
}

function renderizarCardsAnuais(
  dados
) {
  const container =
    document.getElementById(
      "cardsExecutivos"
    );

  if (!container) return;

  if (!dados.length) {
    container.innerHTML =
      "<p>Nenhum indicador anual disponível.</p>";

    return;
  }

  const coresDemandas = [
    "azul",
    "verde",
    "ciano",
    "roxo"
  ];

  const coresInteracoes = [
    "roxo",
    "ciano",
    "verde",
    "azul"
  ];

  container.innerHTML =
    dados.flatMap(
      (item, index) => [
        `
        <div class="card-kpi ${coresDemandas[index % coresDemandas.length]}">
          <span>Demandas ${item.ano}</span>
          <strong>${formatarNumero(item.demandas)}</strong>
          <small>Total de demandas</small>
        </div>
        `,
        `
        <div class="card-kpi ${coresInteracoes[index % coresInteracoes.length]}">
          <span>Interações ${item.ano}</span>
          <strong>${formatarNumero(item.interacoes)}</strong>
          <small>Total de interações</small>
        </div>
        `
      ]
    ).join("");
}

function atualizarPeriodoDashboard(
  anos
) {
  const lista =
    [...new Set(
      anos
        .map(Number)
        .filter(Number.isInteger)
    )].sort(
      (a, b) => a - b
    );

  let periodo =
    "Sem período disponível";

  if (lista.length === 1) {
    periodo =
      String(lista[0]);
  }

  if (
    lista.length > 1 &&
    lista.length <= 4
  ) {
    periodo =
      lista.join(" • ");
  }

  if (lista.length > 4) {
    periodo =
      `${lista[0]} a ${lista[lista.length - 1]}`;
  }

  const subtitulo =
    document.querySelector(
      ".subtitulo-dashboard"
    );

  if (subtitulo) {
    subtitulo.textContent =
      `Visão consolidada por período: ${periodo}`;
  }

  document
    .querySelectorAll(
      ".periodo-dashboard"
    )
    .forEach((elemento) => {
      elemento.textContent =
        periodo;
    });
}

function totalAno(lista, ano) {
  if (!Array.isArray(lista)) return 0;
  const item = lista.find(i => Number(i.ano) === Number(ano));
  return Number(item?.total || 0);
}

function preencherTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.innerText = formatarNumero(valor || 0);
  }
}

function montarEvolucaoAnual(dados) {
  const container = document.getElementById("evolucaoAnual");
  if (!container) return;

  const maior = Math.max(...dados.map(item => Number(item.total)), 1);

  container.innerHTML = dados.map(item => {
    const total = Number(item.total);
    const largura = (total / maior) * 100;

    return `
      <div class="linha-ranking-bi">
        <span>${item.ano}</span>
        <div class="barra-bi">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${formatarNumero(total)}</strong>
      </div>
    `;
  }).join("");
}

function montarGraficoStatus(statusLista, totalGeral) {
  const donut = document.querySelector(".donut-fake");
  const legenda = document.getElementById("legendaStatus");

  if (!donut || !legenda) return;

  const listaLimpa = statusLista.filter(item => item.status !== "INTERAÇÃO");

  if (!listaLimpa.length) {
    donut.style.background = "conic-gradient(#334155 0 100%)";
    legenda.innerHTML = "<p>Nenhum status encontrado.</p>";
    return;
  }

  const cores = ["#22c55e", "#f59e0b", "#2563eb", "#ef4444", "#8b5cf6", "#38bdf8"];
  let inicio = 0;

  const partes = listaLimpa.map((item, index) => {
    const total = Number(item.total);
    const percentual = totalGeral ? (total / totalGeral) * 100 : 0;
    const fim = inicio + percentual;
    const cor = cores[index % cores.length];

    const parte = `${cor} ${inicio}% ${fim}%`;
    inicio = fim;

    return parte;
  });

  donut.style.background = `conic-gradient(${partes.join(",")})`;

  legenda.innerHTML = listaLimpa.map((item, index) => {
    const total = Number(item.total);
    const percentual = totalGeral ? ((total / totalGeral) * 100).toFixed(1) : 0;
    const cor = cores[index % cores.length];

    return `
      <div class="item-legenda-status">
        <span style="background:${cor}"></span>
        <p>${item.status}</p>
        <strong>${formatarNumero(total)} (${percentual}%)</strong>
      </div>
    `;
  }).join("");
}

function montarRanking(id, dados, campoNome) {
  const container = document.getElementById(id);
  if (!container) return;

  const lista = dados.slice(0, 10);
  const maior = Math.max(...lista.map(item => Number(item.total)), 1);

  container.innerHTML = lista.map(item => {
    const nome = item[campoNome] || "-";
    const total = Number(item.total || 0);
    const largura = (total / maior) * 100;

    return `
      <div class="linha-ranking-bi">
        <span title="${nome}">${limitarTexto(nome, 22)}</span>
        <div class="barra-bi">
          <b style="width:${largura}%"></b>
        </div>
        <strong>${formatarNumero(total)}</strong>
      </div>
    `;
  }).join("");
}

function montarEvolucaoMensal(dados) {
  const container =
    document.getElementById(
      "evolucaoMensal"
    );

  if (!container) return;

  const mesesOrdem = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO"
  ];

  const anosSet =
    new Set(
      dados
        .map(
          (item) =>
            Number(item.ano)
        )
        .filter(
          (ano) =>
            Number.isInteger(ano) &&
            ano >= 2000 &&
            ano <= 2999
        )
    );

  anosSet.add(
    new Date().getFullYear()
  );

  const anos =
    [...anosSet].sort(
      (a, b) => a - b
    );

  const porAno =
    Object.fromEntries(
      anos.map(
        (ano) => [
          String(ano),
          []
        ]
      )
    );

  dados.forEach((item) => {
    const ano =
      String(
        Number(item.ano)
      );

    if (!porAno[ano]) {
      return;
    }

    porAno[ano].push({
      mes:
        String(
          item.mes || ""
        ).toUpperCase(),

      total:
        Number(
          item.total || 0
        )
    });
  });

  container.innerHTML =
    anos.map((anoNumero) => {
      const ano =
        String(anoNumero);

      const meses =
        porAno[ano].sort(
          (a, b) =>
            mesesOrdem.indexOf(
              a.mes
            ) -
            mesesOrdem.indexOf(
              b.mes
            )
        );

      const totalAno =
        meses.reduce(
          (acc, item) =>
            acc + item.total,
          0
        );

      const maiorMes =
        Math.max(
          ...meses.map(
            (item) =>
              item.total
          ),
          1
        );

      const linhas =
        meses.length
          ? meses.map((item) => {
              const largura =
                (
                  item.total /
                  maiorMes
                ) * 100;

              return `
                <div class="evolucao-mes-linha">
                  <span>${abreviarMes(item.mes)}</span>
                  <div class="evolucao-barra">
                    <b style="width:${largura}%"></b>
                  </div>
                  <strong>${formatarNumero(item.total)}</strong>
                </div>
              `;
            }).join("")
          : `
              <div class="evolucao-mes-linha">
                <span>SEM DADOS</span>
                <div class="evolucao-barra">
                  <b style="width:0%"></b>
                </div>
                <strong>0</strong>
              </div>
            `;

      return `
        <div class="evolucao-card-ano">
          <div class="evolucao-card-topo">
            <div>
              <h4>${ano}</h4>
              <span>Total anual</span>
            </div>
            <strong>${formatarNumero(totalAno)}</strong>
          </div>

          <div class="evolucao-meses">
            ${linhas}
          </div>
        </div>
      `;
    }).join("");
}

function montarUltimasDemandas(demandas) {
  const listaDemandas = document.getElementById("listaDemandas");
  if (!listaDemandas) return;

  if (!demandas.length) {
    listaDemandas.innerHTML = `
      <tr>
        <td colspan="5">Nenhuma demanda encontrada</td>
      </tr>
    `;
    return;
  }

  listaDemandas.innerHTML = demandas.slice(0, 8).map(demanda => `
    <tr>
      <td>${demanda.codigo_origem || demanda.id || "-"}</td>
      <td>${demanda.nome || "-"}</td>
      <td>${limitarTexto(demanda.demanda || "-", 60)}</td>
      <td>${demanda.secretaria || "-"}</td>
      <td>${demanda.status || "-"}</td>
    </tr>
  `).join("");
}

function abreviarMes(mes) {
  const mapa = {
    JANEIRO: "JAN",
    FEVEREIRO: "FEV",
    MARÇO: "MAR",
    MARCO: "MAR",
    ABRIL: "ABR",
    MAIO: "MAI",
    JUNHO: "JUN",
    JULHO: "JUL",
    AGOSTO: "AGO",
    SETEMBRO: "SET",
    OUTUBRO: "OUT",
    NOVEMBRO: "NOV",
    DEZEMBRO: "DEZ"
  };

  return mapa[String(mes || "").toUpperCase()] || mes || "-";
}

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString("pt-BR");
}

function limitarTexto(texto, limite = 40) {
  const valor = String(texto || "");
  return valor.length <= limite ? valor : `${valor.substring(0, limite)}...`;
}

function exportarExcel() {
  window.open("/api/demandas-gabinete/exportar/excel", "_blank");
}

function exportarPDF() {
  window.open("/api/demandas-gabinete/exportar/pdf", "_blank");
}

function mostrarSecretaria() {
  const servico = document.getElementById("servico");
  const secretariaPreview = document.getElementById("secretariaPreview");

  if (!servico || !secretariaPreview) return;

  const valor = servico.value;

  const mapaSecretarias = {
    "IPTU": "SEFIN",
    "Parcelamento": "SEFIN",
    "Dívida Ativa": "SEFIN",

    "Limpeza Urbana": "SESURB",
    "Iluminação Pública": "SESURB",
    "Buraco na Rua": "SESURB",
    "Coleta de Lixo": "SESURB",

    "Saúde": "SESAP",
    "Consulta Médica": "SESAP",
    "Medicamento": "SESAP",

    "Educação": "SEDUC",
    "Creche": "SEDUC",
    "Escola": "SEDUC",

    "Trânsito": "SETRANSP",
    "Sinalização": "SETRANSP",
    "Lombada": "SETRANSP",

    "Assistência Social": "SEAS",
    "Fiscalização": "SEURB",
    "Gabinete": "GABINETE"
  };

  secretariaPreview.innerText = mapaSecretarias[valor] || "---";
}

function aplicarMascaraTelefone(input) {
  let numeros = String(input.value || "").replace(/\D/g, "");

  // Permite apenas DDD + 9 números
  numeros = numeros.slice(0, 11);

  if (numeros.length === 0) {
    input.value = "";
    return;
  }

  if (numeros.length <= 2) {
    input.value = `(${numeros}`;
    return;
  }

  if (numeros.length <= 7) {
    input.value = `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    return;
  }

  input.value =
    `(${numeros.slice(0, 2)}) ` +
    `${numeros.slice(2, 7)} - ` +
    `${numeros.slice(7, 11)}`;
}


function validarTelefoneCelular(telefone) {
  const numeros = String(telefone || "").replace(/\D/g, "");

  /*
    Exige:
    - 11 números;
    - DDD com dois dígitos;
    - celular começando com 9.
  */
  return /^[1-9]{2}9\d{8}$/.test(numeros);
}


function configurarCampoTelefone() {
  const campoTelefone = document.getElementById("telefone");
  const formDemanda = document.getElementById("formDemanda");

  // Evita erro nas páginas que não possuem telefone
  if (!campoTelefone) return;

  campoTelefone.addEventListener("input", function () {
    aplicarMascaraTelefone(this);
  });

  campoTelefone.addEventListener("paste", function () {
    setTimeout(() => {
      aplicarMascaraTelefone(this);
    }, 0);
  });

  if (formDemanda) {
    formDemanda.addEventListener("submit", function (evento) {
      if (!validarTelefoneCelular(campoTelefone.value)) {
        evento.preventDefault();
        evento.stopImmediatePropagation();

        alert(
          "Informe um celular válido no formato (XX) XXXXX - XXXX."
        );

        campoTelefone.focus();
      }
    }, true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const pagina = window.location.pathname.split("/").pop();

  if (pagina !== "index.html" && pagina !== "") {
    await carregarUsuarioLogado();
  }

  marcarPaginaAtiva();

  // Ativa a máscara e a validação do telefone
  configurarCampoTelefone();


  if (
    document.getElementById("cardsExecutivos") ||
    document.getElementById("rankingSecretarias") ||
    document.getElementById("evolucaoMensal")
  ) {
    carregarDashboard();
  }
});