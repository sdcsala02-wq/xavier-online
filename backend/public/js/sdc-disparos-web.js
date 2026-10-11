(() => {
  'use strict';
  const main = document.querySelector('main');
  const form = document.getElementById('formCampanha');
  if (!main || !form) return;
  const panel = document.createElement('section');
  panel.className = 'disparo-card sdc-web-panel';
  panel.innerHTML = `<h3>WhatsApp SDC</h3>
    <p>Conecte o numero que enviara as mensagens da SDC.</p>
    <button type="button" class="disparo-btn" id="sdcConectar">Conectar WhatsApp</button>
    <strong id="sdcStatus" role="status">Consultando conexao...</strong>
    <img id="sdcQr" alt="QR Code para conectar o WhatsApp SDC" width="260" height="260" hidden>
    <p id="sdcNotice" role="status"></p>
    <h3>Campanhas SDC por WhatsApp</h3>
    <label>Campanha salva <select id="sdcCampanhas"><option value="">Selecione uma campanha</option></select></label>
    <button type="button" class="disparo-btn disparo-btn-secundario" id="sdcAtualizar">Atualizar campanhas</button>
    <div id="sdcResumoPrevia" class="sdc-message"></div>
    <button type="button" class="disparo-btn" id="sdcEnviar" disabled>Enviar agora pela SDC</button>
    <button type="button" class="disparo-btn disparo-btn-secundario" id="sdcCancelar" disabled>Cancelar restantes</button>
    <p id="sdcContadores" role="status"></p>
    <p>Enviado indica retorno do WhatsApp. Entregue e lido dependem de confirmacao do destinatario.
    Itens com resultado incerto nao sao reenviados automaticamente.</p>
    <div class="disparos-tabela-container"><table class="disparos-tabela"><thead><tr>
      <th>Contato</th><th>Telefone</th><th>Resultado</th><th>Detalhe</th>
    </tr></thead><tbody id="sdcResultados"></tbody></table></div>`;
  main.insertBefore(panel, document.querySelector('.disparos-kpis'));
  const byId = id => document.getElementById(id);
  const notice = (text, error = false) => {
    byId('sdcNotice').textContent = text;
    byId('sdcNotice').className = error ? 'sdc-error' : '';
  };
  const type = byId('tipoMensagem');
  type.replaceChildren(new Option('Mensagem direta pelo WhatsApp SDC', 'WHATSAPP_WEB'));
  type.disabled = true;
  byId('campoTemplate').hidden = true;
  const mediaLabel = document.createElement('label');
  mediaLabel.className = 'largo';
  mediaLabel.innerHTML = 'Arquivo da campanha <input id="midiaCampanha" type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"><small>Imagem, áudio, vídeo ou documento (até 16 MB).</small>';
  byId('mensagemDisparo').closest('label').after(mediaLabel);
  const mediaPreview = document.createElement('div');
  mediaPreview.id = 'sdcMidiaPrevia'; mediaPreview.className = 'disparo-preview'; mediaPreview.hidden = true;
  mediaLabel.after(mediaPreview);
  byId('enviarTemplateDemo').remove();
  byId('solicitarAprovacao').hidden = true;
  byId('salvarRascunho').textContent = 'Salvar campanha SDC';
  const preparation = document.querySelector('.disparos-aviso');
  if (preparation) preparation.textContent = 'Envio direto SDC: salve a campanha, confira o publico e clique em Enviar agora. Apenas contatos autorizados entram na fila.';
  const badge = document.querySelector('.disparo-status');
  if (badge) badge.textContent = 'WHATSAPP SDC';
  const flow = document.querySelector('.disparo-fluxo-titulo + p');
  if (flow) flow.textContent = 'Campanha salva → publico autorizado → envio manual → historico por destinatario.';
  const oldList = document.querySelector('.disparos-listagem-cabecalho h3');
  if (oldList) oldList.textContent = 'Campanhas anteriores';
  const oldKpis = document.querySelector('.disparos-kpis');
  if (oldKpis) oldKpis.hidden = true;
  let connected = false, selected = null, runId = null, busy = false, pollBusy = false, generation = 0;
  let campaigns = [];
  async function api(route, body) {
    const response = await fetch('/api/disparos/sdc-web' + route, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'include',
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensagem || 'Falha na operacao SDC.');
    return data;
  }
  function renderMedia(file) {
    const box = byId('sdcMidiaPrevia'); box.replaceChildren(); box.hidden = !file;
    if (!file) return;
    const url = URL.createObjectURL(file), title = document.createElement('strong'); title.textContent = file.name + ' — ' + Math.ceil(file.size / 1024) + ' KB'; box.append(title);
    const tag = file.type.startsWith('image/') ? 'img' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : null;
    if (tag) { const item = document.createElement(tag); item.src = url; item.controls = tag !== 'img'; if (tag === 'img') { item.alt = 'Prévia da imagem'; item.title = 'Clique para ampliar ou reduzir'; item.addEventListener('click', () => item.classList.toggle('sdc-midia-ampliada')); } box.append(item); }
  }
  byId('midiaCampanha').addEventListener('change', event => renderMedia(event.target.files[0]));
  function buttons() {
    byId('sdcEnviar').disabled = busy || !connected || !selected || !!selected.execucao_id;
    byId('sdcCampanhas').disabled = busy;
    byId('sdcAtualizar').disabled = busy;
    byId('salvarRascunho').disabled = busy;
  }
  async function status() {
    const state = await api('/status');
    connected = state.status === 'CONECTADO';
    byId('sdcStatus').textContent = state.status.replace(/_/g, ' ') + (state.numero ? ' — ' + state.numero : '');
    byId('sdcQr').hidden = !state.qr;
    if (state.qr) byId('sdcQr').src = state.qr;
    else byId('sdcQr').removeAttribute('src');
    byId('sdcConectar').disabled = !['DESCONECTADO','ERRO'].includes(state.status);
    if (state.erro) notice(state.erro, true);
    buttons();
  }
  async function loadCampaigns(prefer) {
    const previous = String(prefer || byId('sdcCampanhas').value || '');
    campaigns = (await api('/campanhas')).campanhas;
    byId('sdcCampanhas').replaceChildren(new Option('Selecione uma campanha', ''));
    for (const c of campaigns) byId('sdcCampanhas').add(new Option(c.nome + (c.execucao_status ? ' — ' + c.execucao_status : ' — RASCUNHO'), c.id));
    byId('sdcCampanhas').value = previous;
    await selectCampaign();
  }
  async function selectCampaign() {
    const current = ++generation;
    selected = null; runId = null; buttons();
    byId('sdcCancelar').disabled = true;
    byId('sdcResultados').replaceChildren();
    byId('sdcContadores').textContent = '';
    byId('sdcResumoPrevia').textContent = '';
    const id = byId('sdcCampanhas').value;
    if (!id) return;
    const data = await api('/campanhas/' + id + '/previa');
    if (generation !== current) return;
    selected = campaigns.find(c => String(c.id) === id);
    byId('sdcResumoPrevia').textContent = 'Destinatarios autorizados agora: ' + data.total + '\n\n' + (data.campanha.midia ? 'Anexo: ' + data.campanha.midia.nome + '\n' : '') + data.campanha.mensagem;
    runId = selected.execucao_id || null;
    buttons();
    if (runId) await history();
  }
  async function history() {
    const id = runId; if (!id) return;
    const data = await api('/execucoes/' + id);
    if (runId !== id) return;
    const r = data.resumo;
    byId('sdcContadores').textContent = data.execucao.status + ' | Total: ' + r.total + ' | Enviados: ' + r.enviados +
      ' | Entregues: ' + r.entregues + ' | Lidos: ' + r.lidos + ' | Pendentes: ' + r.pendentes + ' | Ocorrencias: ' + r.ocorrencias;
    byId('sdcCancelar').disabled = !['NA_FILA','EM_ENVIO'].includes(data.execucao.status) || data.execucao.cancelar;
    const fragment = document.createDocumentFragment();
    for (const item of data.itens) {
      const row = document.createElement('tr');
      const result = item.status === 'ENVIADO' ? (item.ack === -1 ? 'ERRO WHATSAPP' : item.ack >= 3 ? 'LIDO' : item.ack >= 2 ? 'ENTREGUE' : 'ENVIADO') : item.status;
      for (const value of [item.nome, item.telefone, result, item.erro || item.message_id || '']) {
        const cell = document.createElement('td'); cell.textContent = value || ''; row.appendChild(cell);
      }
      fragment.appendChild(row);
    }
    byId('sdcResultados').replaceChildren(fragment);
  }
  function guarded(fn) { return async () => { try { await fn(); } catch (e) { notice(e.message, true); } }; }
  byId('sdcConectar').addEventListener('click', guarded(async () => {
    byId('sdcConectar').disabled = true;
    await api('/conectar', {}); await status();
    notice('No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. Leia o QR Code desta tela.');
  }));
  byId('sdcAtualizar').addEventListener('click', guarded(() => loadCampaigns()));
  byId('sdcCampanhas').addEventListener('change', guarded(selectCampaign));
  form.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const button = byId('salvarRascunho'); if (button.disabled) return;
    button.disabled = true;
    try {
      const body = new FormData();
      body.set('nome', byId('nomeCampanha').value); body.set('mensagem', byId('mensagemDisparo').value);
      body.set('categoriaId', byId('categoriaCampanha').value || ''); body.set('bairro', byId('bairroCampanha').value); body.set('genero', byId('generoCampanha').value);
      const scheduled = byId('agendamentoCampanha').value;
      if (scheduled) body.set('agendadaPara', new Date(scheduled).toISOString());
      const file = byId('midiaCampanha').files[0]; if (file) body.set('arquivo', file);
      const data = await api('/campanhas', body);
      await loadCampaigns(data.campanha.id);
      notice(data.mensagem);
    } catch (e) { notice(e.message, true); }
    finally { button.disabled = false; }
  }, true);
  byId('sdcEnviar').addEventListener('click', guarded(async () => {
    if (busy || !selected || selected.execucao_id) return;
    busy = true; buttons();
    try {
      const data = await api('/enviar', { campanhaId: selected.id });
      selected.execucao_id = data.execucaoId; runId = data.execucaoId;
      notice(data.mensagem + ' Publico: ' + data.total + ' contato(s).');
      await history();
    } catch (e) {
      // Se a resposta se perdeu, consulta o servidor antes de oferecer novo envio.
      await loadCampaigns().catch(() => { selected = null; });
      throw e;
    } finally { busy = false; buttons(); }
  }));
  byId('sdcCancelar').addEventListener('click', guarded(async () => {
    if (!runId) return;
    notice((await api('/execucoes/' + runId + '/cancelar', {})).mensagem);
    await history();
  }));
  guarded(async () => { await status(); await loadCampaigns(); })();
  setInterval(async () => {
    if (pollBusy || document.hidden) return;
    pollBusy = true;
    try { await status(); await history(); } catch (e) { connected = false; buttons(); notice(e.message, true); }
    finally { pollBusy = false; }
  }, 3000);
})();
