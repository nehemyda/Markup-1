import { api, claimConnection, disconnect, getConfig, NotConnectedError, pinUrl, startConnect, timeAgo } from './shared.js';

const $ = (id) => document.getElementById(id);
let server = '';
let summary = null;
let tab = 'notes';
let waitTimer = null;

const STATUS = { open: 'Open', in_progress: 'In progress', waiting_on_customer: 'Waiting on customer' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openTab(url) {
  chrome.tabs.create({ url });
  window.close();
}

function renderNotes() {
  const list = $('list-notes');
  list.replaceChildren();
  const notes = summary?.notifications || [];
  if (!notes.length) {
    list.append(el('div', 'empty', "No notifications yet. You'll see new client feedback on your projects, replies, @mentions and pins assigned to you."));
    return;
  }
  for (const n of notes) {
    const item = el('button', `item${n.read ? '' : ' unread'}`);
    item.append(el('span', `dot${n.read ? ' read' : ''}`));
    const body = el('span', 'body');
    body.append(el('span', 'title', n.title));
    if (n.message) body.append(el('span', 'message', n.message));
    body.append(el('span', 'meta', timeAgo(n.createdAt)));
    item.append(body);
    item.addEventListener('click', async () => {
      if (!n.read) api('/api/extension/read', { method: 'POST', body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
      openTab(n.projectId ? pinUrl(server, n.projectId, n.pinId) : server);
    });
    list.append(item);
  }
}

function renderPins() {
  const list = $('list-pins');
  list.replaceChildren();
  const pins = summary?.openPins || [];
  if (!pins.length) {
    list.append(el('div', 'empty', 'No open pins on your projects. 🎉'));
    return;
  }
  for (const p of pins) {
    const item = el('button', 'item');
    item.append(el('span', 'pin-no', p.number ?? '•'));
    const body = el('span', 'body');
    body.append(el('span', 'title', p.title || 'Untitled pin'));
    const meta = el('span', 'meta');
    meta.append(el('span', '', p.projectName));
    if (p.fromClient) meta.append(el('span', 'tag client', 'Client'));
    if (p.status === 'waiting_on_customer') meta.append(el('span', 'tag', 'Waiting on customer'));
    else if (STATUS[p.status] && p.status !== 'open') meta.append(el('span', '', STATUS[p.status]));
    meta.append(el('span', '', timeAgo(p.createdAt)));
    body.append(meta);
    item.append(body);
    item.addEventListener('click', () => openTab(pinUrl(server, p.projectId, p.id)));
    list.append(item);
  }
  if (summary.openPinCount > pins.length) list.append(el('div', 'empty', `Showing ${pins.length} of ${summary.openPinCount}.`));
}

function render() {
  $('unread').textContent = summary?.unread ? String(summary.unread) : '';
  $('pin-count').textContent = summary ? String(summary.openPinCount ?? 0) : '';
  $('mark-all').disabled = !summary?.unread;
  renderNotes();
  renderPins();
}

function showTab(next) {
  tab = next;
  $('tab-notes').classList.toggle('active', tab === 'notes');
  $('tab-pins').classList.toggle('active', tab === 'pins');
  $('tab-notes').setAttribute('aria-selected', String(tab === 'notes'));
  $('tab-pins').setAttribute('aria-selected', String(tab === 'pins'));
  $('list-notes').hidden = tab !== 'notes';
  $('list-pins').hidden = tab !== 'pins';
  $('mark-all').hidden = tab !== 'notes';
}

function showError(message) {
  $('error').textContent = message || '';
  $('error').hidden = !message;
}

async function refresh() {
  $('refresh').classList.add('spinning');
  try {
    const fresh = await api('/api/extension/summary');
    summary = fresh;
    showError('');
    render();
    // Keep the badge in step too
    chrome.runtime.sendMessage({ type: 'refresh' }).catch(() => {});
  } catch (err) {
    if (err instanceof NotConnectedError) return showConnect();
    showError(err.message);
  } finally {
    $('refresh').classList.remove('spinning');
  }
}

function showConnect(waiting = false) {
  $('main').hidden = true;
  $('connect').hidden = false;
  $('connect-wait').hidden = !waiting;
  $('server-label').textContent = server;
}

async function showMain(config) {
  $('connect').hidden = true;
  $('main').hidden = false;
  $('user-label').textContent = config.user ? `${config.user.name} · ${config.user.email}` : '';
  summary = config.summary;
  if (summary) render();
  await refresh();
}

// While waiting for approval in the app, check every 2 seconds
function waitForApproval() {
  clearInterval(waitTimer);
  waitTimer = setInterval(async () => {
    if (await claimConnection()) {
      clearInterval(waitTimer);
      showMain(await getConfig());
    }
  }, 2000);
}

async function init() {
  const config = await getConfig();
  server = config.server;
  showTab('notes');
  if (config.key) return showMain(config);
  if (config.pendingState && (await claimConnection())) return showMain(await getConfig());
  showConnect(!!config.pendingState);
  if (config.pendingState) waitForApproval();
}

$('connect-btn').addEventListener('click', async () => {
  await startConnect();
  showConnect(true);
  waitForApproval();
});
$('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});
$('refresh').addEventListener('click', refresh);
$('tab-notes').addEventListener('click', () => showTab('notes'));
$('tab-pins').addEventListener('click', () => showTab('pins'));
$('open-app').addEventListener('click', () => openTab(server));
$('mark-all').addEventListener('click', async () => {
  try {
    await api('/api/extension/read', { method: 'POST', body: JSON.stringify({}) });
    await refresh();
  } catch (err) {
    showError(err.message);
  }
});
$('disconnect').addEventListener('click', async () => {
  if (!confirm('Disconnect this extension from Vpin?')) return;
  await disconnect();
  showConnect();
});

init();
