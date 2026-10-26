// Background worker: checks Markup every minute, keeps the toolbar badge (unread notifications) up to date and
// shows a desktop alert for each new notification. Also finishes connecting once the member approves in the app.
import { api, claimConnection, getConfig, NotConnectedError, pinUrl } from './shared.js';

const MAX_ALERTS = 3;

async function setBadge(unread) {
  await chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
  await chrome.action.setBadgeText({ text: unread > 0 ? (unread > 99 ? '99+' : String(unread)) : '' });
}

async function refresh() {
  const { key } = await getConfig();
  if (!key) {
    await setBadge(0);
    return null;
  }
  let summary;
  try {
    summary = await api('/api/extension/summary');
  } catch (err) {
    if (err instanceof NotConnectedError) await setBadge(0);
    return null;
  }
  await chrome.storage.local.set({ summary: { ...summary, loadedAt: Date.now() } });
  await setBadge(summary.unread);
  await alertNew(summary.notifications);
  return summary;
}

// Desktop alerts for unread notifications not alerted before (none for those that existed when connecting)
async function alertNew(notifications) {
  const { alertedIds = [], primed = false } = await chrome.storage.local.get(['alertedIds', 'primed']);
  const seen = new Set(alertedIds);
  const fresh = notifications.filter((n) => !n.read && !seen.has(n.id));
  if (primed) {
    for (const n of fresh.slice(0, MAX_ALERTS)) {
      await chrome.notifications.create(`markup:${n.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: n.title,
        message: n.message || '',
        priority: 1,
      });
    }
    if (fresh.length > MAX_ALERTS) {
      await chrome.notifications.create('markup:more', {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: `${fresh.length - MAX_ALERTS} more new notifications`,
        message: 'Open the Markup extension to see them all.',
      });
    }
  }
  // Remember the latest ids only
  const ids = [...fresh.map((n) => n.id), ...alertedIds].slice(0, 300);
  await chrome.storage.local.set({ alertedIds: ids, primed: true });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  chrome.notifications.clear(notificationId);
  const { server, summary } = await getConfig();
  if (notificationId === 'markup:more') {
    chrome.tabs.create({ url: server });
    return;
  }
  const id = notificationId.replace(/^markup:/, '');
  const n = summary?.notifications?.find((x) => x.id === id);
  chrome.tabs.create({ url: n?.projectId ? pinUrl(server, n.projectId, n.pinId) : server });
  try {
    await api('/api/extension/read', { method: 'POST', body: JSON.stringify({ ids: [id] }) });
  } catch {}
  refresh();
});

// Connecting: the app page switches to /extension/connected?state=… after the member approves
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const { server, pendingState } = await getConfig();
  if (!pendingState || !changeInfo.url.startsWith(`${server}/extension/connected`) || !changeInfo.url.includes(encodeURIComponent(pendingState))) return;
  if (await claimConnection()) {
    await refresh();
    setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 1500);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') refresh();
});

function schedule() {
  chrome.alarms.create('refresh', { periodInMinutes: 1 });
  refresh();
}
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

// The popup asks for a refresh when it opens
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'refresh') {
    refresh().then((summary) => sendResponse({ summary }));
    return true;
  }
  return false;
});
