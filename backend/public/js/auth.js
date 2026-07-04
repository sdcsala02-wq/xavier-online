async function verificarAutenticacao() {

  try {

    const resposta = await fetch("/api/auth/me", {
      credentials: "include"
    });

    if (!resposta.ok) {
      window.location.href = "/";
      return;
    }

    const dados = await resposta.json();

    localStorage.setItem(
      "usuario",
      JSON.stringify(dados.usuario)
    );

  } catch (erro) {

    console.error(erro);

    window.location.href = "/";
  }
}

document.addEventListener(
  "DOMContentLoaded",
  verificarAutenticacao
);