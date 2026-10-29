import React, { useEffect, useState } from 'react';
import { Check, Loader2, Lock, MessageSquare, Send, Unlink } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ChatSettings {
  team: { connected: boolean; space: string };
  summary: { enabled: boolean; time: string; timeZone: string; weekdaysOnly: boolean };
  lastSentDate: string | null;
}

const TIME_ZONES = (() => {
  try {
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    return ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London'];
  }
})();

// Settings → Notifications: the team's Google Chat space (client feedback alerts + daily summary of open pins)
export const GoogleChatSettings: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'' | 'connect' | 'disconnect' | 'summary' | 'send'>('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    apiFetch('/api/chat/settings')
      .then(async (r) => (r.ok ? setSettings(await r.json()) : setLoadError((await r.json().catch(() => ({}))).error || 'Could not load.')))
      .catch(() => setLoadError('Could not load the Google Chat settings.'));
  }, [canEdit]);

  const save = async (body: object, kind: typeof busy, done: string) => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await apiFetch('/api/chat/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      setSettings((prev) => (prev ? { ...prev, team: data.team, summary: { ...prev.summary, ...((body as any).summary || {}) } } : prev));
      setMessage({ ok: true, text: done });
      if (kind === 'connect') setUrl('');
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  };

  const sendNow = async () => {
    setBusy('send');
    setMessage(null);
    try {
      const res = await apiFetch('/api/chat/summary-now', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send.');
      setMessage({ ok: true, text: 'Summary sent to the team space.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy('');
    }
  };

  if (!canEdit) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-medium">
        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Only workspace Owners and Admins can set up Google Chat alerts.</span>
      </div>
    );
  }
  if (loadError) return <div className="text-xs text-rose-600">{loadError}</div>;
  if (!settings) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  const summary = settings.summary;
  const setSummary = (patch: Partial<ChatSettings['summary']>) => setSettings({ ...settings, summary: { ...summary, ...patch } });

  return (
    <div className="space-y-6">
      {/* TEAM SPACE */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Team Google Chat space
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              New client pins and replies are posted here, grouped into one message per minute. A project can post to its own space instead (project menu → Google Chat alerts).
            </p>
          </div>
          {settings.team.connected && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              <Check className="w-3.5 h-3.5" /> Connected · {settings.team.space}
            </span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save({ teamWebhookUrl: url.trim() }, 'connect', 'Connected. A test message was posted in the space.');
          }}
          className="space-y-2"
        >
          <label className="block text-xs font-bold text-slate-700" htmlFor="chat-team-url">
            {settings.team.connected ? 'Replace with another space' : 'Webhook link'}
          </label>
          <div className="flex gap-2">
            <input
              id="chat-team-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://chat.googleapis.com/v1/spaces/…/messages?key=…&token=…"
              className="flex-1 min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!url.trim() || !!busy}
              className="shrink-0 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {busy === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Connect
            </button>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            In Google Chat, open the space → space name → <strong>Apps &amp; integrations</strong> → <strong>Webhooks</strong> → Add webhook (name it "Vpin"), then copy the link here. The link is stored on the server only.
          </p>
        </form>

        {settings.team.connected && (
          <button
            type="button"
            onClick={() => window.confirm('Stop posting to the team space? Projects with their own space keep posting.') && save({ teamWebhookUrl: '' }, 'disconnect', 'Disconnected.')}
            disabled={!!busy}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50"
          >
            {busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
            Disconnect
          </button>
        )}
      </div>

      {/* DAILY SUMMARY */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-bold text-sm text-slate-900">Daily summary of open pins</h2>
          <p className="text-xs text-slate-500 mt-1">
            One message in the team space with each developer's open pins: how many, new from clients and older than 3 days. Pins waiting on customers are counted separately.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={summary.enabled} onChange={(e) => setSummary({ enabled: e.target.checked })} className="w-4 h-4 rounded" />
          Send a daily summary
        </label>

        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${summary.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <label className="block text-xs font-bold text-slate-700">
            Time
            <input
              type="time"
              value={summary.time}
              onChange={(e) => setSummary({ time: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500"
            />
          </label>
          <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
            Time zone
            <select
              value={summary.timeZone}
              onChange={(e) => setSummary({ timeZone: e.target.value })}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:border-indigo-500"
            >
              {(TIME_ZONES.includes(summary.timeZone) ? TIME_ZONES : [summary.timeZone, ...TIME_ZONES]).map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer sm:col-span-3">
            <input type="checkbox" checked={summary.weekdaysOnly} onChange={(e) => setSummary({ weekdaysOnly: e.target.checked })} className="w-4 h-4 rounded" />
            Weekdays only (Monday to Friday)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => save({ summary: { enabled: summary.enabled, time: summary.time, timeZone: summary.timeZone, weekdaysOnly: summary.weekdaysOnly } }, 'summary', 'Summary settings saved.')}
            disabled={!!busy}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {busy === 'summary' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
          <button
            type="button"
            onClick={sendNow}
            disabled={!!busy || !settings.team.connected}
            title={settings.team.connected ? 'Post today’s summary now' : 'Connect the team space first'}
            className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {busy === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send summary now
          </button>
          {settings.lastSentDate && <span className="text-[11px] text-slate-500">Last daily summary: {settings.lastSentDate}</span>}
        </div>
      </div>

      {message && (
        <div className={`text-xs font-semibold ${message.ok ? 'text-emerald-700' : 'text-rose-600'}`} role="status">
          {message.text}
        </div>
      )}
    </div>
  );
};
