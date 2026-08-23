const campoMensagem=document.getElementById("mensagemDisparo");
const previa=document.getElementById("previaDisparo");
const contador=document.getElementById("contadorMensagem");
function atualizarPrevia(){const texto=String(campoMensagem?.value||"").trim();if(previa)previa.textContent=texto||"A prévia da mensagem aparecerá aqui.";if(contador)contador.textContent=`${texto.length} caracteres`;}
campoMensagem?.addEventListener("input",atualizarPrevia);
atualizarPrevia();
