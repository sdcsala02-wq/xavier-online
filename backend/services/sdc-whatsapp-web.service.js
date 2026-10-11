'use strict';
const path = require('path');
const { EventEmitter } = require('events');
const events = new EventEmitter();
const confirmations = new Map();
let client = null, starting = false, qrVersion = 0;
let state = { status: 'DESCONECTADO', qr: null, numero: null, erro: null };
function snapshot() { return { ...state }; }
async function connect() {
  if (starting || client) return snapshot();
  starting = true;
  state = { status: 'INICIANDO', qr: null, numero: null, erro: null };
  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const QRCode = require('qrcode');
    const options = {
      authStrategy: new LocalAuth({ clientId: 'sdc', dataPath: path.join(process.env.LOCALAPPDATA || require('os').homedir(), 'SDC', 'whatsapp-auth'), rmMaxRetries: 10 }),
      puppeteer: { headless: true },
      webVersionCache: { type: 'local', path: path.resolve(__dirname, '../.sdc_wwebjs_cache') }
    };
    if (process.env.SDC_CHROME_PATH) options.puppeteer.executablePath = process.env.SDC_CHROME_PATH;
    const instance = new Client(options);
    client = instance;
    instance.on('qr', async value => {
      const version = ++qrVersion;
      state.status = 'AGUARDANDO_QR';
      try {
        const image = await QRCode.toDataURL(value, { width: 260 });
        if (version === qrVersion && client === instance && state.status === 'AGUARDANDO_QR') state.qr = image;
      } catch { state.erro = 'Falha ao gerar QR Code.'; }
    });
    instance.on('authenticated', () => { ++qrVersion; state.qr = null; state.status = 'AUTENTICADO'; });
    instance.on('ready', () => {
      ++qrVersion;
      state = { status: 'CONECTADO', qr: null, numero: instance.info?.wid?.user || null, erro: null };
    });
    instance.on('auth_failure', () => {
      ++qrVersion; state.status = 'ERRO'; state.qr = null; state.erro = 'Falha de autenticacao. Reinicie o servidor para reconectar.';
    });
    instance.on('disconnected', () => {
      ++qrVersion; state.status = 'DESCONECTADO'; state.qr = null; state.numero = null;
      state.erro = 'Sessao desconectada. Reinicie o servidor para reconectar.';
    });
    instance.on('message_ack', (message, ack) => {
      const id = message?.id?._serialized;
      if (!id) return;
      confirmations.set(id, ack === -1 ? -1 : Math.max(confirmations.get(id) || 0, ack));
      if (confirmations.size > 10000) confirmations.delete(confirmations.keys().next().value);
      events.emit('ack', id, ack);
    });
// SDC_DIAGNOSTICO_CONEXAO
    instance.on('loading_screen', percent => console.log('[SDC] Carregando WhatsApp:', percent));
    instance.on('authenticated', () => console.log('[SDC] Autenticado; aguardando inicializacao.'));
    instance.on('ready', () => console.log('[SDC] CONECTADO e pronto para enviar.'));
    instance.on('change_state', state => console.log('[SDC] Estado:', state));
    instance.on('auth_failure', () => console.log('[SDC] Falha de autenticacao.'));
    instance.on('disconnected', reason => console.log('[SDC] Desconectado:', reason));
    instance.initialize().catch(error => {
      ++qrVersion; state.status = 'ERRO'; state.qr = null;
      state.erro = 'Nao foi possivel iniciar o WhatsApp: ' + String(error.message).slice(0, 300);
    }).finally(() => { starting = false; });
  } catch (error) {
    starting = false; client = null; state.status = 'ERRO';
    state.erro = 'Dependencias do WhatsApp indisponiveis: ' + String(error.message).slice(0, 300);
  }
  return snapshot();
}
function ready() { return state.status === 'CONECTADO' && !!client; }
function phone(value) {
  let number = String(value || '').replace(/\D/g, '');
  if (number.startsWith('00')) number = number.slice(2);
  if (number.length === 10 || number.length === 11) number = '55' + number;
  if (!/^55\d{10,11}$/.test(number)) throw new Error('Telefone brasileiro invalido.');
  return number;
}
async function resolveNumber(number) {
  if (!ready()) throw new Error('WhatsApp desconectado.');
  const id = await client.getNumberId(phone(number));
  if (!id) throw new Error('Numero nao possui WhatsApp.');
  return id._serialized;
}
async function send(id, text) {
  if (!ready()) throw new Error('WhatsApp desconectado.');
  const result = await client.sendMessage(id, text, { sendSeen: false, waitUntilMsgSent: true });
  if (!result?.id?._serialized) throw new Error('WhatsApp nao retornou identificador; envio incerto.');
  return { id: result.id._serialized, ack: Number(result.ack) || 0 };
}
async function sendMedia(id, media, caption = '') {
  if (!ready()) throw new Error('WhatsApp desconectado.');
  if (!media?.data || !media?.mimetype || !media?.filename) {
    throw new Error('Arquivo da campanha inválido.');
  }
  const { MessageMedia } = require('whatsapp-web.js');
  const attachment = new MessageMedia(media.mimetype, media.data, media.filename);
  const result = await client.sendMessage(id, attachment, {
    caption: String(caption || '').trim() || undefined,
    sendSeen: false,
    waitUntilMsgSent: true
  });
  if (!result?.id?._serialized) throw new Error('WhatsApp não retornou identificador; envio incerto.');
  return { id: result.id._serialized, ack: Number(result.ack) || 0 };
}
async function shutdown() {
  ++qrVersion;
  state.status = 'DESCONECTADO';
  if (client) await client.destroy();
}
function confirmation(id, fallback) {
  const ack = confirmations.get(id);
  return ack === -1 ? -1 : Math.max(ack || 0, fallback || 0);
}
module.exports = { snapshot, connect, ready, phone, resolveNumber, send, sendMedia, confirmation, events, shutdown };
