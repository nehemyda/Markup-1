// Shared by the popup, the options page and the background worker.
// Storage (chrome.storage.local):
//   server        Vpin's address, e.g. http://localhost:3000 (Options page)
//   key           this extension's access key (from connecting; never the password)
//   user          { name, email } of the connected member
//   pendingState  random value while a connect is waiting for approval in the app
//   summary       last loaded notifications and open pins (shown instantly when the popup opens)

export const DEFAULT_SERVER = 'http://localhost:3000';

export async function getConfig() {
  const c = await chrome.storage.local.get(['server', 'key', 'user', 'pendingState', 'summary']);
  return { server: c.server || DEFAULT_SERVER, key: c.key || null, user: c.user || null, pendingState: c.pendingState || null, summary: c.summary || null };
}

export class NotConnectedError extends Error {}

// Calls Vpin's server with this extension's key
export async function api(path, init = {}) {
  const { server, key } = await getConfig();
  if (!key) throw new NotConnectedError('Not connected.');
  let res;
  try {
    res = await fetch(server + path, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
  } catch {
    throw new Error(`Can't reach Vpin at ${server}.`);
  }
  if (res.status === 401) {
    // Disconnected (or the account was removed): forget the key
    await chrome.storage.local.remove(['key', 'user', 'summary']);
    throw new NotConnectedError('Disconnected. Connect again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Vpin answered ${res.status}.`);
  return data;
}

// Connecting: open Vpin, where the member approves; the extension then claims its key
export async function startConnect() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const state = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await chrome.storage.local.set({ pendingState: state });
  const { server } = await getConfig();
  await chrome.tabs.create({ url: `${server}/extension/connect?state=${encodeURIComponent(state)}` });
}

// Returns true once connected
export async function claimConnection() {
  const { server, pendingState } = await getConfig();
  if (!pendingState) return false;
  try {
    const res = await fetch(`${server}/api/extension/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: pendingState }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    // Notifications that exist now are not shown as desktop alerts
    await chrome.storage.local.set({ key: data.key, user: { name: data.name, email: data.email }, alertedIds: [], primed: false });
    await chrome.storage.local.remove('pendingState');
    return true;
  } catch {
    return false;
  }
}

export async function disconnect() {
  try {
    await api('/api/extension/disconnect', { method: 'POST' });
  } catch {}
  await chrome.storage.local.remove(['key', 'user', 'summary', 'alertedIds', 'primed']);
  await chrome.action.setBadgeText({ text: '' });
}

export const pinUrl = (server, projectId, pinId) =>
  `${server}/projects/${encodeURIComponent(projectId)}${pinId ? `?pin=${encodeURIComponent(pinId)}` : ''}`;

export function timeAgo(ms) {
  if (!ms) return '';
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(ms).toLocaleDateString();
}
