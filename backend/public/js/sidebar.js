"use strict";

(() => {
  const CONFIGURACAO_MENU = {
    nomeSistema: "SISTEMA LUCAS",
    subtituloSistema: "Gestão Eleitoral",
    versao: "Sistema Lucas v1.0"
  };

  let usuarioLogado = null;


  /* =====================================================
     INICIALIZAÇÃO
  ===================================================== */

  async function iniciarSidebar() {
    const sidebar =
      document.querySelector(".sidebar");

    if (!sidebar) {
      return;
    }

    exibirMenuCarregando(sidebar);

    try {
      usuarioLogado =
        await buscarUsuarioLogado();

      renderizarMenu(
        sidebar,
        usuarioLogado
      );

      configurarLinksDoMenu();

    } catch (erro) {
      console.error(
        "Erro ao carregar o menu lateral:",
        erro
      );

      localStorage.removeItem("usuario");

      window.location.href =
        "/index.html";
    }
  }


  /* =====================================================
     USUÁRIO E SESSÃO
  ===================================================== */

  async function buscarUsuarioLogado() {
    const resposta = await fetch(
      "/api/auth/me",
      {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      }
    );

    let dados = {};

    try {
      dados = await resposta.json();
    } catch (erroLeitura) {
      throw new Error(
        "O servidor retornou uma resposta inválida."
      );
    }

    if (
      resposta.status === 401 ||
      resposta.status === 403
    ) {
      throw new Error(
        "Sua sessão expirou."
      );
    }

    if (
      !resposta.ok ||
      !dados.ok ||
      !dados.usuario
    ) {
      throw new Error(
        dados.mensagem ||
        "Não foi possível identificar o usuário."
      );
    }

    const usuario = {
      ...dados.usuario,

      perfil:
        normalizarPerfil(
          dados.usuario.perfil
        )
    };

    localStorage.setItem(
      "usuario",
      JSON.stringify(usuario)
    );

    return usuario;
  }


  /* =====================================================
     FUNÇÕES AUXILIARES
  ===================================================== */

  function normalizarPerfil(perfil) {
    return String(perfil || "")
      .trim()
      .toUpperCase();
  }


  function escaparHTML(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function obterPaginaAtual() {
    const pagina =
      window.location.pathname
        .split("/")
        .pop();

    return pagina || "dashboard.html";
  }


  function obterIniciais(nome) {
    const palavras =
      String(nome || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (palavras.length === 0) {
      return "US";
    }

    if (palavras.length === 1) {
      return palavras[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      palavras[0][0] +
      palavras[palavras.length - 1][0]
    ).toUpperCase();
  }


  function itemEstaAtivo(
    paginaAtual,
    paginas
  ) {
    const lista =
      Array.isArray(paginas)
        ? paginas
        : [paginas];

    return lista.includes(
      paginaAtual
    );
  }


  /* =====================================================
     ITENS DO MENU
  ===================================================== */

  function obterItensPrincipais() {
    return [
      {
        nome: "Dashboard",
        icone: "📊",
        href: "/dashboard.html",
        paginas: [
          "dashboard.html"
        ]
      },

      {
        nome: "Eleitores",
        icone: "👥",
        href: "/eleitores.html",
        paginas: [
          "eleitores.html",
          "cadastro.html",
          "cidadao.html",
          "cidadaos.html"
        ]
      },

      {
        nome: "Lideranças",
        icone: "🤝",
        href: "/liderancas.html",
        paginas: [
          "liderancas.html"
        ]
      },

      {
        nome: "Mapa Territorial",
        icone: "🗺️",
        href: "/mapa.html",
        paginas: [
          "mapa.html"
        ]
      },

      {
        nome: "Relatórios",
        icone: "📈",
        href: "/relatorios.html",
        paginas: [
          "relatorios.html",
          "relatorio-geral.html",
          "relatorio-legislativo.html"
        ]
      },

      {
        nome: "Importação",
        icone: "📥",
        href: "/importar.html",
        paginas: [
          "importar.html"
        ]
      }
    ];
  }


  function criarHTMLItemMenu(
    item,
    paginaAtual,
    classeAdicional = ""
  ) {
    const ativo =
      itemEstaAtivo(
        paginaAtual,
        item.paginas
      );

    return `
      <a
        href="${item.href}"
        class="${ativo ? "active" : ""
      } ${classeAdicional}"
      >
        <span class="menu-item-icone">
          ${item.icone}
        </span>

        <span class="menu-item-texto">
          ${escaparHTML(item.nome)}
        </span>

        ${classeAdicional.includes(
        "menu-administrativo"
      )
        ? `
              <span class="menu-seta">
                ›
              </span>
            `
        : ""
      }
      </a>
    `;
  }


  /* =====================================================
     RENDERIZAÇÃO
  ===================================================== */

  function exibirMenuCarregando(
    sidebar
  ) {
    sidebar.innerHTML = `
      <div class="brand">

        <div class="brand-icon">
          🏛️
        </div>

        <div>
          <h2>
            ${CONFIGURACAO_MENU.nomeSistema}
          </h2>

          <span>
            ${CONFIGURACAO_MENU.subtituloSistema}
          </span>
        </div>

      </div>

      <div class="sidebar-carregando">
        Carregando menu...
      </div>
    `;
  }


  function renderizarMenu(
    sidebar,
    usuario
  ) {
    const paginaAtual =
      obterPaginaAtual();

    const perfil =
      normalizarPerfil(
        usuario?.perfil
      );

    const administrador =
      perfil === "ADMIN";

    const itensPrincipais =
      obterItensPrincipais();

    const htmlItensPrincipais =
      itensPrincipais
        .map(item =>
          criarHTMLItemMenu(
            item,
            paginaAtual
          )
        )
        .join("");

    const itemAdministrativo = {
      nome: "Painel Administrativo",
      icone: "🛡️",
      href: "/admin.html",
      paginas: [
        "admin.html",
        "usuarios.html",
        "configuracoes.html"
      ]
    };

    const htmlAdministracao =
      administrador
        ? `
          <div class="menu-divisor"></div>

          ${criarHTMLItemMenu(
          itemAdministrativo,
          paginaAtual,
          "menu-administrativo"
        )}

          <div
            class="menu-divisor inferior"
          ></div>
        `
        : "";

    sidebar.innerHTML = `
      <div class="brand">

        <div class="brand-icon">
          🏛️
        </div>

        <div>
          <h2>
            ${CONFIGURACAO_MENU.nomeSistema}
          </h2>

          <span>
            ${CONFIGURACAO_MENU.subtituloSistema}
          </span>
        </div>

      </div>


      <nav class="menu">

        <div class="menu-secao">
          Principal
        </div>

        ${htmlItensPrincipais}

        ${htmlAdministracao}

      </nav>


      <div class="sidebar-footer">

        <div class="sidebar-usuario">

          <div class="sidebar-avatar">
            ${escaparHTML(
      obterIniciais(
        usuario?.nome
      )
    )}
          </div>

          <div class="sidebar-usuario-dados">

            <strong>
              ${escaparHTML(
      usuario?.nome ||
      "Usuário"
    )}
            </strong>

            <span>
              Perfil ${escaparHTML(
      perfil ||
      "NÃO INFORMADO"
    )}
            </span>

          </div>

        </div>

        <button
          type="button"
          class="btn-sair-menu"
          id="btnSairSidebar"
        >
          <span>
            🚪
          </span>

          <span>
            Sair
          </span>
        </button>

        <small>
          ${CONFIGURACAO_MENU.versao}
        </small>

      </div>
    `;

    sidebar.dataset.menuLucas =
      "carregado";
  }


  /* =====================================================
     EVENTOS DO MENU
  ===================================================== */

  function configurarLinksDoMenu() {
    document
      .querySelectorAll(
        ".sidebar .menu a"
      )
      .forEach(link => {
        link.addEventListener(
          "click",
          () => {
            fecharMenuMobile();
          }
        );
      });

    const botaoSair =
      document.getElementById(
        "btnSairSidebar"
      );

    if (botaoSair) {
      botaoSair.addEventListener(
        "click",
        sairDoSistema
      );
    }
  }


  function fecharMenuMobile() {
    const sidebar =
      document.querySelector(
        ".sidebar"
      );

    const overlay =
      document.querySelector(
        ".sidebar-overlay"
      );

    if (sidebar) {
      sidebar.classList.remove(
        "active"
      );
    }

    if (overlay) {
      overlay.classList.remove(
        "active"
      );
    }

    document.body.classList.remove(
      "menu-aberto"
    );
  }


  async function sairDoSistema() {
    try {
      await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include"
        }
      );

    } catch (erro) {
      console.error(
        "Erro ao sair do sistema:",
        erro
      );

    } finally {
      localStorage.removeItem(
        "usuario"
      );

      sessionStorage.clear();

      window.location.href =
        "/index.html";
    }
  }


  /* =====================================================
     PROTEÇÃO CONTRA OUTROS SCRIPTS ANTIGOS
  ===================================================== */

  function garantirMenuFinal() {
    const sidebar =
      document.querySelector(
        ".sidebar"
      );

    if (
      !sidebar ||
      !usuarioLogado
    ) {
      return;
    }

    const possuiRelatorios =
      sidebar.querySelector(
        'a[href="/relatorios.html"]'
      );

    const perfil =
      normalizarPerfil(
        usuarioLogado.perfil
      );

    const precisaPainelAdmin =
      perfil === "ADMIN";

    const possuiPainelAdmin =
      sidebar.querySelector(
        'a[href="/admin.html"]'
      );

    if (
      !possuiRelatorios ||
      (
        precisaPainelAdmin &&
        !possuiPainelAdmin
      )
    ) {
      renderizarMenu(
        sidebar,
        usuarioLogado
      );

      configurarLinksDoMenu();
    }
  }


  /* =====================================================
     EXECUÇÃO
  ===================================================== */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      async () => {
        await iniciarSidebar();

        setTimeout(
          garantirMenuFinal,
          100
        );

        setTimeout(
          garantirMenuFinal,
          500
        );
      }
    );

  } else {
    iniciarSidebar()
      .then(() => {
        setTimeout(
          garantirMenuFinal,
          100
        );

        setTimeout(
          garantirMenuFinal,
          500
        );
      });
  }

  /* =====================================================
   RESTAURAÇÃO DO MENU AO VOLTAR PARA A ABA
===================================================== */

  let restaurandoMenu = false;


  function menuEstaCompleto() {
    const sidebar =
      document.querySelector(".sidebar");

    if (!sidebar) {
      return false;
    }

    const perfil =
      normalizarPerfil(
        usuarioLogado?.perfil
      );

    const temDashboard =
      Boolean(
        sidebar.querySelector(
          'a[href="/dashboard.html"]'
        )
      );

    const temRelatorios =
      Boolean(
        sidebar.querySelector(
          'a[href="/relatorios.html"]'
        )
      );

    const temImportacao =
      Boolean(
        sidebar.querySelector(
          'a[href="/importar.html"]'
        )
      );

    const temPainelAdministrativo =
      Boolean(
        sidebar.querySelector(
          'a[href="/admin.html"]'
        )
      );

    if (
      !temDashboard ||
      !temRelatorios ||
      !temImportacao
    ) {
      return false;
    }

    if (
      perfil === "ADMIN" &&
      !temPainelAdministrativo
    ) {
      return false;
    }

    return true;
  }


  function restaurarMenuSeNecessario() {
    if (
      restaurandoMenu ||
      !usuarioLogado
    ) {
      return;
    }

    const sidebar =
      document.querySelector(".sidebar");

    if (!sidebar) {
      return;
    }

    if (menuEstaCompleto()) {
      return;
    }

    restaurandoMenu = true;

    renderizarMenu(
      sidebar,
      usuarioLogado
    );

    configurarLinksDoMenu();

    setTimeout(() => {
      restaurandoMenu = false;
    }, 100);
  }


  window.addEventListener(
    "pageshow",
    function () {
      setTimeout(
        restaurarMenuSeNecessario,
        50
      );
    }
  );


  document.addEventListener(
    "visibilitychange",
    function () {
      if (
        document.visibilityState ===
        "visible"
      ) {
        setTimeout(
          restaurarMenuSeNecessario,
          50
        );
      }
    }
  );


  window.addEventListener(
    "focus",
    function () {
      setTimeout(
        restaurarMenuSeNecessario,
        50
      );
    }
  );


  const observadorSidebar =
    new MutationObserver(
      function () {
        if (
          usuarioLogado &&
          !menuEstaCompleto()
        ) {
          setTimeout(
            restaurarMenuSeNecessario,
            20
          );
        }
      }
    );


  document.addEventListener(
    "DOMContentLoaded",
    function () {
      const sidebar =
        document.querySelector(".sidebar");

      if (sidebar) {
        observadorSidebar.observe(
          sidebar,
          {
            childList: true,
            subtree: true
          }
        );
      }
    }
  );

})();