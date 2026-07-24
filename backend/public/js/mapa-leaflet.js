const API_URL_ELEITORES = "/api/eleitores";
const API_URL_BAIRROS = "/data/bairros-praia-grande.geojson";

let mapa = null;
let camadaBairros = null;
let camadaSelecionada = null;

let eleitoresMapa = [];
let resumoBairros = [];
let totaisPorBairro = new Map();

document.addEventListener(
  "DOMContentLoaded",
  carregarMapaEleitoral
);

async function carregarMapaEleitoral() {
  try {
    inicializarMapa();

    const [
      respostaResumo,
      respostaEleitores,
      respostaGeoJson
    ] = await Promise.all([
      fetch(`${API_URL_ELEITORES}/resumo`, {
        credentials: "include",
        cache: "no-store"
      }),

      fetch(`${API_URL_ELEITORES}?limite=5000`, {
        credentials: "include",
        cache: "no-store"
      }),

      fetch(API_URL_BAIRROS, {
        cache: "no-store"
      })
    ]);

    if (!respostaResumo.ok) {
      throw new Error(
        "Não foi possível carregar o resumo eleitoral."
      );
    }

    if (!respostaEleitores.ok) {
      throw new Error(
        "Não foi possível carregar os eleitores."
      );
    }

    if (!respostaGeoJson.ok) {
      const erroMapa = await respostaGeoJson
        .json()
        .catch(() => ({}));

      throw new Error(
        erroMapa.detalhe ||
        erroMapa.erro ||
        "Não foi possível carregar os bairros da cidade."
      );
    }

    const resumo =
      await respostaResumo.json();

    const retornoEleitores =
      await respostaEleitores.json();

    const geoJson =
      await respostaGeoJson.json();

    eleitoresMapa =
      extrairListaEleitores(
        retornoEleitores
      );

    resumoBairros =
      gerarResumoBairros(
        eleitoresMapa
      );

    totaisPorBairro =
      criarMapaTotais(
        resumoBairros
      );

    atualizarCardsMapa(
      resumo,
      resumoBairros,
      eleitoresMapa
    );

    montarMapaBairros(
      geoJson
    );

    montarRankingBairros(
      resumoBairros
    );

  } catch (erro) {
    console.error(
      "Erro ao carregar mapa eleitoral:",
      erro
    );

    exibirErroMapa(
      erro.message ||
      "Erro ao carregar o mapa eleitoral."
    );
  }
}

function inicializarMapa() {
  if (mapa) {
    return;
  }

  mapa = L.map(
    "mapaLeaflet",
    {
      zoomControl: true,
      minZoom: 11,
      maxZoom: 18
    }
  ).setView(
    [-24.0277, -46.4778],
    12
  );

  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        "&copy; OpenStreetMap"
    }
  ).addTo(mapa);

  setTimeout(() => {
    mapa.invalidateSize();
  }, 300);
}

function montarMapaBairros(geoJson) {
  if (camadaBairros) {
    mapa.removeLayer(camadaBairros);
  }

  camadaBairros = L.geoJSON(
    geoJson,
    {
      style: feature =>
        obterEstiloBairro(feature),

      onEachFeature: (
        feature,
        camada
      ) => {
        configurarBairro(
          feature,
          camada
        );
      }
    }
  ).addTo(mapa);

  const limites =
    camadaBairros.getBounds();

  if (limites.isValid()) {
    mapa.fitBounds(
      limites,
      {
        padding: [12, 12]
      }
    );
  }

  setTimeout(() => {
    mapa.invalidateSize();
  }, 300);
}

function configurarBairro(
  feature,
  camada
) {
  const bairro =
    obterNomeBairroFeature(feature);

  const total =
    obterTotalBairro(bairro);

  camada.bindTooltip(
    `
      <div style="text-align:center">
        <strong>${escaparHtml(
      formatarNome(bairro)
    )}</strong>
        <br>
        ${total} eleitor(es)
      </div>
    `,
    {
      sticky: true,
      direction: "top",
      opacity: 0.95
    }
  );

  camada.on({
    mouseover: evento => {
      const alvo =
        evento.target;

      if (
        camadaSelecionada !== alvo
      ) {
        alvo.setStyle({
          weight: 3,
          color: "#ffffff",
          fillOpacity: 0.8
        });
      }

      if (
        !L.Browser.ie &&
        !L.Browser.opera &&
        !L.Browser.edge
      ) {
        alvo.bringToFront();
      }
    },

    mouseout: evento => {
      const alvo =
        evento.target;

      if (
        camadaSelecionada !== alvo
      ) {
        camadaBairros.resetStyle(
          alvo
        );
      }
    },

    click: evento => {
      selecionarBairroNoMapa(
        bairro,
        evento.target
      );
    }
  });
}

function selecionarBairroNoMapa(
  bairro,
  camada
) {
  if (camadaSelecionada) {
    camadaBairros.resetStyle(
      camadaSelecionada
    );
  }

  camadaSelecionada = camada;

  camadaSelecionada.setStyle({
    weight: 4,
    color: "#facc15",
    fillOpacity: 0.9
  });

  camadaSelecionada.bringToFront();

  mapa.fitBounds(
    camadaSelecionada.getBounds(),
    {
      padding: [30, 30],
      maxZoom: 15
    }
  );

  selecionarBairro(bairro);
}

function selecionarBairro(bairro) {
  const nomeFormatado =
    formatarNome(bairro);

  atualizarTexto(
    "bairroSelecionado",
    nomeFormatado
  );

  atualizarTexto(
    "infoBairroSelecionado",
    "Bairro selecionado"
  );

  atualizarTexto(
    "tituloEleitoresBairro",
    `Eleitores do Bairro — ${nomeFormatado}`
  );

  const eleitoresFiltrados =
    eleitoresMapa.filter(eleitor => {
      return bairrosEquivalentes(
        eleitor.bairro,
        bairro
      );
    });

  montarTabelaEleitoresBairro(
    eleitoresFiltrados
  );

  montarResumoStatusBairro(
    eleitoresFiltrados
  );

  selecionarCamadaPeloNome(
    bairro
  );
}

function selecionarCamadaPeloNome(
  bairro
) {
  if (!camadaBairros) {
    return;
  }

  camadaBairros.eachLayer(
    camada => {
      const nome =
        obterNomeBairroFeature(
          camada.feature
        );

      if (
        bairrosEquivalentes(
          nome,
          bairro
        )
      ) {
        if (
          camadaSelecionada &&
          camadaSelecionada !== camada
        ) {
          camadaBairros.resetStyle(
            camadaSelecionada
          );
        }

        camadaSelecionada =
          camada;

        camada.setStyle({
          weight: 4,
          color: "#facc15",
          fillOpacity: 0.9
        });

        camada.bringToFront();

        mapa.fitBounds(
          camada.getBounds(),
          {
            padding: [30, 30],
            maxZoom: 15
          }
        );
      }
    }
  );
}

function obterEstiloBairro(feature) {
  const bairro =
    obterNomeBairroFeature(feature);

  const total =
    obterTotalBairro(bairro);

  return {
    color: "#dbeafe",
    weight: 1.5,
    opacity: 1,
    fillColor:
      obterCorQuantidade(total),
    fillOpacity:
      total > 0 ? 0.68 : 0.18
  };
}

function obterCorQuantidade(total) {
  if (total >= 20) {
    return "#7c3aed";
  }

  if (total >= 10) {
    return "#2563eb";
  }

  if (total >= 5) {
    return "#0891b2";
  }

  if (total >= 1) {
    return "#22c55e";
  }

  return "#64748b";
}

function obterNomeBairroFeature(feature) {
  const propriedades =
    feature?.properties || {};

  const candidatos = [
    "BAIRRO",
    "bairro",
    "NOME",
    "nome",
    "NM_BAIRRO",
    "nm_bairro",
    "DESCRICAO",
    "descricao",
    "NOME_BAIRR",
    "nome_bairr",
    "BAIRRO_NOM",
    "bairro_nom"
  ];

  for (
    const campo of candidatos
  ) {
    if (
      propriedades[campo] !==
      undefined &&
      propriedades[campo] !==
      null &&
      String(
        propriedades[campo]
      ).trim()
    ) {
      return String(
        propriedades[campo]
      ).trim();
    }
  }

  const primeiraPropriedadeTexto =
    Object.entries(propriedades)
      .find(([, valor]) => {
        return (
          typeof valor ===
          "string" &&
          valor.trim().length > 1
        );
      });

  return primeiraPropriedadeTexto
    ? String(
      primeiraPropriedadeTexto[1]
    ).trim()
    : "Não informado";
}

function extrairListaEleitores(
  retorno
) {
  if (Array.isArray(retorno)) {
    return retorno;
  }

  const possibilidades = [
    retorno?.eleitores,
    retorno?.dados,
    retorno?.registros,
    retorno?.items,
    retorno?.resultado,
    retorno?.data
  ];

  const encontrada =
    possibilidades.find(
      item =>
        Array.isArray(item)
    );

  return encontrada || [];
}

function gerarResumoBairros(
  eleitores
) {
  const contagem =
    new Map();

  eleitores.forEach(eleitor => {
    const bairroOriginal =
      String(
        eleitor.bairro || ""
      ).trim();

    if (
      !bairroOriginal ||
      ehBairroNaoCadastrado(
        bairroOriginal
      )
    ) {
      return;
    }

    const chave =
      normalizarBairro(
        bairroOriginal
      );

    if (!contagem.has(chave)) {
      contagem.set(
        chave,
        {
          bairro:
            bairroOriginal,
          total: 0
        }
      );
    }

    contagem.get(chave).total++;
  });

  return Array.from(
    contagem.values()
  ).sort(
    (a, b) =>
      Number(b.total) -
      Number(a.total)
  );
}

function criarMapaTotais(
  bairros
) {
  const mapaTotais =
    new Map();

  bairros.forEach(item => {
    mapaTotais.set(
      normalizarBairro(
        item.bairro
      ),
      Number(item.total || 0)
    );
  });

  return mapaTotais;
}

function obterTotalBairro(bairro) {
  return totaisPorBairro.get(
    normalizarBairro(bairro)
  ) || 0;
}

function atualizarCardsMapa(
  resumo,
  bairros,
  eleitores
) {
  const destaque =
    bairros[0];

  atualizarTexto(
    "totalBairros",
    bairros.length
  );

  atualizarTexto(
    "totalEleitoresMapa",
    Number(
      resumo.total ||
      eleitores.length ||
      0
    )
  );

  atualizarTexto(
    "bairroDestaque",
    destaque
      ? formatarNome(
        destaque.bairro
      )
      : "-"
  );
}

function montarRankingBairros(
  bairros
) {
  const container =
    document.getElementById(
      "rankingBairros"
    );

  if (!container) {
    return;
  }

  if (!bairros.length) {
    container.innerHTML = `
      <p>
        Nenhum bairro com eleitores cadastrados.
      </p>
    `;

    return;
  }

  const maior =
    Math.max(
      ...bairros.map(
        item =>
          Number(
            item.total || 0
          )
      ),
      1
    );

  container.innerHTML =
    bairros
      .map(item => {
        const total =
          Number(
            item.total || 0
          );

        const largura =
          (total / maior) *
          100;

        return `
          <div
            class="ranking-item"
            data-bairro="${escaparHtml(
          item.bairro
        )}"
          >
            <span>
              ${escaparHtml(
          formatarNome(
            item.bairro
          )
        )}
            </span>

            <div class="barra-ranking">
              <b style="width:${largura}%"></b>
            </div>

            <strong>
              ${total}
            </strong>
          </div>
        `;
      })
      .join("");

  container
    .querySelectorAll(
      ".ranking-item"
    )
    .forEach(item => {
      item.addEventListener(
        "click",
        () => {
          selecionarBairro(
            item.dataset.bairro
          );
        }
      );
    });
}

function montarTabelaEleitoresBairro(
  eleitores
) {
  const tbody =
    document.getElementById(
      "listaEleitoresBairro"
    );

  if (!tbody) {
    return;
  }

  if (!eleitores.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          Nenhum eleitor encontrado neste bairro.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    eleitores
      .map(eleitor => {
        const status =
          String(
            eleitor.status ||
            "INDEFINIDO"
          ).toUpperCase();

        return `
          <tr>
            <td>
              ${escaparHtml(
          eleitor.nome || "-"
        )}
            </td>

            <td>
              ${escaparHtml(
          eleitor.telefone || "-"
        )}
            </td>

            <td>
              ${escaparHtml(
          eleitor.cidade || "-"
        )}
            </td>

            <td>
              ${escaparHtml(
          eleitor.local_votacao ||
          eleitor.escola_votacao ||
          "Não informado"
        )}
            </td>

            <td>
              <span
                class="
                  status-mapa
                  status-${status.toLowerCase()}
                "
              >
                ${escaparHtml(status)}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
}

function montarResumoStatusBairro(
  eleitores
) {
  const container =
    document.getElementById(
      "statusDoBairro"
    );

  if (!container) {
    return;
  }

  const resumo = {
    ATIVO: 0,
    INATIVO: 0,
    INDEFINIDO: 0
  };

  eleitores.forEach(eleitor => {
    const status =
      String(
        eleitor.status ||
        "INDEFINIDO"
      ).toUpperCase();

    if (
      Object.prototype
        .hasOwnProperty.call(
          resumo,
          status
        )
    ) {
      resumo[status]++;
    } else {
      resumo.INDEFINIDO++;
    }
  });

  container.innerHTML = `
    <div class="secretaria-bairro-item">
      <span>Ativos</span>
      <strong>
        ${resumo.ATIVO}
      </strong>
    </div>

    <div class="secretaria-bairro-item">
      <span>Inativos</span>
      <strong>
        ${resumo.INATIVO}
      </strong>
    </div>

    <div class="secretaria-bairro-item">
      <span>Indefinidos</span>
      <strong>
        ${resumo.INDEFINIDO}
      </strong>
    </div>

    <div class="secretaria-bairro-item">
      <span>Total</span>
      <strong>
        ${eleitores.length}
      </strong>
    </div>
  `;
}

function limparSelecaoBairro() {
  if (
    camadaSelecionada &&
    camadaBairros
  ) {
    camadaBairros.resetStyle(
      camadaSelecionada
    );

    camadaSelecionada =
      null;
  }

  atualizarTexto(
    "bairroSelecionado",
    "-"
  );

  atualizarTexto(
    "infoBairroSelecionado",
    "Bairro em análise"
  );

  atualizarTexto(
    "tituloEleitoresBairro",
    "Eleitores do Bairro"
  );

  const tabela =
    document.getElementById(
      "listaEleitoresBairro"
    );

  if (tabela) {
    tabela.innerHTML = `
      <tr>
        <td colspan="5">
          Clique em um bairro para visualizar os eleitores.
        </td>
      </tr>
    `;
  }

  const status =
    document.getElementById(
      "statusDoBairro"
    );

  if (status) {
    status.innerHTML = `
      <p>
        Selecione um bairro no mapa.
      </p>
    `;
  }

  if (
    camadaBairros &&
    camadaBairros
      .getBounds()
      .isValid()
  ) {
    mapa.fitBounds(
      camadaBairros.getBounds(),
      {
        padding: [12, 12]
      }
    );
  }
}

function bairrosEquivalentes(
  bairroA,
  bairroB
) {
  return (
    normalizarBairro(bairroA) ===
    normalizarBairro(bairroB)
  );
}

function normalizarBairro(texto) {
  const valor =
    normalizarTexto(texto);

  const equivalencias = {
    "vila caicara": "caicara",
    "balneario caicara": "caicara",

    "jardim gloria": "gloria",
    "gloria": "gloria",

    "vila mirim": "mirim",
    "nova mirim": "nova mirim",

    "cidade das criancas":
      "cidade da crianca",

    "cidade da crianca":
      "cidade da crianca",

    "sitio do campo":
      "sitio do campo",

    "sitio do campo":
      "sitio do campo",

    "balneario florida":
      "florida",

    "balneario esmeralda":
      "esmeralda",

    "canto do forte":
      "canto do forte"
  };

  return (
    equivalencias[valor] ||
    valor
  );
}

function ehBairroNaoCadastrado(
  bairro
) {
  const valor =
    normalizarTexto(bairro);

  return [
    "nao cadastrado",
    "nao informado",
    "sem bairro",
    "indefinido",
    "-"
  ].includes(valor);
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function formatarNome(texto) {
  return String(
    texto || "Não informado"
  )
    .toLocaleLowerCase(
      "pt-BR"
    )
    .replace(
      /(^|\s)\S/g,
      letra =>
        letra.toLocaleUpperCase(
          "pt-BR"
        )
    );
}

function atualizarTexto(
  id,
  valor
) {
  const elemento =
    document.getElementById(id);

  if (elemento) {
    elemento.innerText =
      valor;
  }
}

function exibirErroMapa(
  mensagem
) {
  const container =
    document.getElementById(
      "mapaLeaflet"
    );

  if (container) {
    container.innerHTML = `
      <div
        style="
          height:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          color:#f87171;
          padding:30px;
        "
      >
        ${escaparHtml(mensagem)}
      </div>
    `;
  }
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.selecionarBairro =
  selecionarBairro;

window.limparSelecaoBairro =
  limparSelecaoBairro;