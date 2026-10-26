import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Check, Undo2, X, Eye, EyeOff, AlertTriangle, Code } from 'lucide-react';
import { Pin, WpFix } from '../types';
import { apiFetch } from '../lib/api';
import { subscribeWpFixes } from '../lib/firebaseSync';

interface WpFixPanelProps {
  projectId: string;
  connected: boolean;
  onConnect: () => void;
  pin: Pin;
  // Connecting sites is for admins; asking/applying AI fixes follows Team → Roles & Permissions
  isAdmin: boolean;
  canAsk: boolean;
  canApply: boolean;
  currentUserId: string;
  // The live site changed (fix applied or undone): reload the page
  onSiteChanged: () => void;
  // Show CSS on the page without saving it (null = stop previewing)
  onPreviewCss: (css: string | null) => void;
}

const STATUS: Record<WpFix['status'], { label: string; className: string }> = {
  proposed: { label: 'Waiting for approval', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  applying: { label: 'Applying…', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  applied: { label: 'Live on site', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  undoing: { label: 'Undoing…', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  reverted: { label: 'Undone', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  rejected: { label: 'Dismissed', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  stale: { label: 'Page changed', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  not_possible: { label: 'Needs a person', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Readable Elementor setting value: colors with a swatch, sizes like "48px"
function SettingValue({ value }: { value: any }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400 italic">not set</span>;
  if (typeof value === 'string' && HEX.test(value)) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm border border-slate-300" style={{ background: value }} />
        <span className="font-mono">{value}</span>
      </span>
    );
  }
  if (value && typeof value === 'object' && 'size' in value) return <span className="font-mono">{value.size}{value.unit || ''}</span>;
  const text = typeof value === 'string' ? value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : JSON.stringify(value);
  return <span className="font-mono break-words">{text.length > 120 ? `${text.slice(0, 120)}…` : text}</span>;
}

const settingLabel = (key: string) => key.replace(/^typography_/, '').replace(/_/g, ' ');
const plainText = (html = '') => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\[\/?et_pb_[^\]]*\]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// Divi shortcode attributes (name="value") in a piece of page content
const diviAttrs = (text = '') => Object.fromEntries(Array.from(text.matchAll(/\b([a-z0-9_]+)="([^"]*)"/gi)).map((m) => [m[1], m[2]]));

function SettingsTable({ before, after, keys }: { before: Record<string, any>; after: Record<string, any>; keys: string[] }) {
  return (
    <table className="w-full text-[10px]">
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="align-top">
            <td className="pr-2 py-0.5 text-slate-500 capitalize whitespace-nowrap">{settingLabel(k)}</td>
            <td className="py-0.5 text-slate-500"><SettingValue value={before[k]} /></td>
            <td className="px-1 py-0.5 text-slate-400">→</td>
            <td className="py-0.5 text-slate-900 font-semibold"><SettingValue value={after[k]} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The attached image a fix adds, shown from the pin's comment (or the uploaded copy once applied)
function FixImage({ fix, pin }: { fix: WpFix; pin: Pin }) {
  if (!fix.image) return null;
  const holder = fix.image.commentId ? pin.comments.find((c) => c.id === fix.image!.commentId) : pin;
  const att = holder?.attachments?.find((a) => a.id === fix.image!.attachmentId);
  const src = fix.media?.url || att?.url;
  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1.5">
      {src && <img src={src} alt="" className="w-12 h-12 object-cover rounded border border-slate-200 bg-white" />}
      <div className="text-[10px] text-slate-600 min-w-0">
        <div className="font-semibold text-slate-800 truncate">Adds image: {fix.image.name}</div>
        <div>{fix.media ? 'Uploaded to the Media Library' : 'Uploaded to the Media Library when approved'}</div>
      </div>
    </div>
  );
}

const WIDGET_NAMES: Record<string, string> = { image: 'image', heading: 'heading', 'text-editor': 'text', button: 'button', spacer: 'spacer', divider: 'divider' };

function ChangeDetails({ fix, pin }: { fix: WpFix; pin: Pin }) {
  const [showCode, setShowCode] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (fix.kind === 'site_replace' && fix.siteReplace) {
    const { total, places, items } = fix.siteReplace;
    const shown = showAll ? items : items.slice(0, 5);
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5 text-rose-900 line-through decoration-rose-300">{fix.find}</span>
          <span className="text-slate-400">→</span>
          <span className="bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 text-emerald-900">{fix.replace}</span>
          <span className="text-[10px] text-slate-500">everywhere{fix.wholeWord === false ? ' (also inside words)' : ''}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          {total} {total === 1 ? 'change' : 'changes'} in {places} {places === 1 ? 'place' : 'places'} across the site
        </div>
        <ul className="border border-slate-200 rounded divide-y divide-slate-100 max-h-48 overflow-y-auto">
          {shown.map((it, i) => (
            <li key={i} className="px-2 py-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 truncate">{it.label}</span>
                <span className={`text-[10px] shrink-0 ${it.count ? 'text-slate-500' : 'text-amber-700'}`}>{it.count ? `${it.count}× · ${it.where}` : it.where}</span>
              </div>
              {it.sample && <div className="text-[10px] text-slate-500 truncate">{it.sample}</div>}
            </li>
          ))}
        </ul>
        {items.length > 5 && (
          <button onClick={() => setShowAll((v) => !v)} className="text-[10px] text-slate-500 hover:text-slate-800">
            {showAll ? 'Show fewer' : `Show all ${items.length}`}
          </button>
        )}
      </div>
    );
  }
  if (fix.kind === 'elementor_insert') {
    const settings = JSON.parse(fix.settingsJson || '{}');
    const keys = Object.keys(settings).filter((k) => k !== 'image' && k !== 'typography_typography');
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500">
          Adds a new Elementor {WIDGET_NAMES[fix.elementType || ''] || fix.elementType} below the {fix.afterElementType} element
        </div>
        <FixImage fix={fix} pin={pin} />
        {keys.length > 0 && <SettingsTable before={{}} after={settings} keys={keys} />}
      </div>
    );
  }
  if (fix.kind === 'elementor_settings') {
    const after = JSON.parse(fix.settingsJson || '{}');
    const before = JSON.parse(fix.beforeJson || '{}');
    const keys = Object.keys(after).filter((k) => k !== 'typography_typography');
    return (
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500">Elementor {fix.elementType} element</div>
        <SettingsTable before={before} after={after} keys={keys} />
      </div>
    );
  }
  if (fix.kind === 'content_replace') {
    const before = plainText(fix.find);
    const after = plainText(fix.replace);
    const imageOnly = !!fix.image && before === after;
    // Divi module settings changed (shortcode attributes): show them like Elementor settings
    const attrsBefore = fix.builder === 'divi' ? diviAttrs(fix.find) : {};
    const attrsAfter = fix.builder === 'divi' ? diviAttrs(fix.replace) : {};
    const changedAttrs = Array.from(new Set([...Object.keys(attrsBefore), ...Object.keys(attrsAfter)]))
      .filter((k) => attrsBefore[k] !== attrsAfter[k] && !k.startsWith('_'));
    return (
      <div className="space-y-1.5 text-[11px]">
        <FixImage fix={fix} pin={pin} />
        {changedAttrs.length > 0 && (
          <>
            <div className="text-[10px] text-slate-500">Divi module settings</div>
            <SettingsTable before={attrsBefore} after={attrsAfter} keys={changedAttrs} />
          </>
        )}
        {before !== after ? (
          <>
            <div className="bg-rose-50 border border-rose-100 rounded px-2 py-1 text-rose-900 line-through decoration-rose-300">{before || '(no text)'}</div>
            <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-900">{after || '(no text)'}</div>
          </>
        ) : changedAttrs.length === 0 && !imageOnly ? (
          <div className="text-[10px] text-slate-500">Changes the page markup only (text stays the same).</div>
        ) : null}
        <button onClick={() => setShowCode((v) => !v)} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800">
          <Code className="w-3 h-3" /> {showCode ? 'Hide code' : 'Show code'}
        </button>
        {showCode && (
          <div className="space-y-1">
            <pre className="bg-slate-900 text-rose-300 text-[10px] p-2 rounded whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{fix.find}</pre>
            <pre className="bg-slate-900 text-emerald-300 text-[10px] p-2 rounded whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{fix.replace}</pre>
          </div>
        )}
      </div>
    );
  }
  if (fix.kind === 'css') {
    return <pre className="bg-slate-900 text-emerald-300 text-[10px] p-2 rounded whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{fix.css}</pre>;
  }
  return fix.reason ? <div className="text-[11px] text-slate-600">{fix.reason}</div> : null;
}

// Not connected yet: one line explaining how to turn on Fix with AI
const ConnectHint: React.FC<{ isAdmin: boolean; onConnect: () => void }> = ({ isAdmin, onConnect }) => (
  <div className="border border-dashed border-indigo-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
    <span className="flex items-center gap-1.5">
      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
      {isAdmin ? 'Connect this site to WordPress to fix pins with AI.' : 'Fix with AI is available once an admin connects this site to WordPress.'}
    </span>
    {isAdmin && (
      <button onClick={onConnect} className="shrink-0 text-indigo-600 hover:text-indigo-800 font-bold">
        Connect WordPress
      </button>
    )}
  </div>
);

export const WpFixPanel: React.FC<WpFixPanelProps> = (props) =>
  props.connected ? <ConnectedWpFixPanel {...props} /> : <ConnectHint isAdmin={props.isAdmin} onConnect={props.onConnect} />;

const ConnectedWpFixPanel: React.FC<WpFixPanelProps> = ({ projectId, pin, canAsk, canApply, currentUserId, onSiteChanged, onPreviewCss }) => {
  const [fixes, setFixes] = useState<WpFix[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [busyFix, setBusyFix] = useState('');
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [showOld, setShowOld] = useState(false);

  useEffect(() => {
    setError('');
    setShowOld(false);
    return subscribeWpFixes(pin.id, setFixes);
  }, [pin.id]);

  // Stop any preview when switching pins or closing the panel
  useEffect(() => {
    setPreviewId('');
    onPreviewCss(null);
    return () => onPreviewCss(null);
  }, [pin.id]);

  const post = async (path: string, body?: unknown) => {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
    return data;
  };

  const prepare = async () => {
    setPreparing(true);
    setError('');
    try {
      await post(`/api/wp/${projectId}/fixes`, { pinId: pin.id });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreparing(false);
    }
  };

  const act = async (fix: WpFix, action: 'apply' | 'undo' | 'reject') => {
    setBusyFix(fix.id);
    setError('');
    if (previewId === fix.id) {
      setPreviewId('');
      onPreviewCss(null);
    }
    try {
      await post(`/api/wp/${projectId}/fixes/${fix.id}/${action}`);
      if (action !== 'reject') onSiteChanged();
    } catch (err: any) {
      // Undo refused because the page was edited afterwards: let an admin decide
      if (action === 'undo' && err.status === 409 && /edited after/.test(err.message)) {
        if (window.confirm(`${err.message}\n\nUndo anyway? Later edits to this page will be lost.`)) {
          try {
            await post(`/api/wp/${projectId}/fixes/${fix.id}/undo`, { force: true });
            onSiteChanged();
          } catch (forced: any) {
            setError(forced.message);
          }
        }
      } else {
        setError(err.message);
      }
    } finally {
      setBusyFix('');
    }
  };

  const togglePreview = (fix: WpFix) => {
    const next = previewId === fix.id ? '' : fix.id;
    setPreviewId(next);
    onPreviewCss(next ? fix.css || null : null);
  };

  const active = fixes.filter((f) => !['rejected', 'reverted'].includes(f.status));
  const old = fixes.filter((f) => ['rejected', 'reverted'].includes(f.status));
  const hasOpenProposal = fixes.some((f) => f.status === 'proposed' || f.status === 'applying');

  const card = (fix: WpFix) => {
    const status = STATUS[fix.status];
    const busy = busyFix === fix.id;
    const mine = fix.proposedBy?.uid === currentUserId;
    return (
      <div key={fix.id} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold text-slate-900">{fix.summary}</div>
          <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full whitespace-nowrap ${status.className}`}>{status.label}</span>
        </div>
        {fix.explanation && fix.kind !== 'none' && <p className="text-[11px] text-slate-600">{fix.explanation}</p>}
        <ChangeDetails fix={fix} pin={pin} />
        {fix.status === 'applied' && fix.visibleChange === false && (
          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-[11px] text-amber-900 flex gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Applied, but nothing visibly changed at the pin. {canApply ? 'Undo it and try another fix, or check the page.' : 'Someone allowed to apply AI fixes can undo it.'}</span>
          </div>
        )}
        {fix.lastError && <div className="text-[10px] text-rose-700 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{fix.lastError}</div>}

        <div className="flex items-center gap-1.5 flex-wrap">
          {fix.status === 'proposed' && canApply && (
            <button
              onClick={() => act(fix, 'apply')}
              disabled={!!busyFix}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve & apply
            </button>
          )}
          {fix.status === 'proposed' && fix.kind === 'css' && (
            <button
              onClick={() => togglePreview(fix)}
              className="flex items-center gap-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-2.5 py-1 rounded text-[11px]"
            >
              {previewId === fix.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {previewId === fix.id ? 'Stop preview' : 'Preview'}
            </button>
          )}
          {fix.status === 'applied' && canApply && (
            <button
              onClick={() => act(fix, 'undo')}
              disabled={!!busyFix}
              className="flex items-center gap-1 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-2.5 py-1 rounded text-[11px] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Undo
            </button>
          )}
          {['proposed', 'stale', 'not_possible'].includes(fix.status) && (canApply || mine) && (
            <button
              onClick={() => act(fix, 'reject')}
              disabled={!!busyFix}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-600 font-bold px-1.5 py-1 rounded text-[11px] disabled:opacity-50 ml-auto"
            >
              <X className="w-3 h-3" /> Dismiss
            </button>
          )}
        </div>
        {fix.remaining && fix.remaining.length > 0 && ['proposed', 'applied'].includes(fix.status) && (
          <div className="bg-indigo-50/70 border border-indigo-100 rounded px-2 py-1.5 text-[11px] text-indigo-950">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">Still to do in this thread</span>
              {canAsk && fix.status === 'applied' && !hasOpenProposal && (
                <button
                  onClick={prepare}
                  disabled={preparing}
                  className="flex items-center gap-1 text-indigo-700 hover:text-indigo-900 font-bold disabled:opacity-50"
                >
                  {preparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Fix next
                </button>
              )}
            </div>
            <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
              {fix.remaining.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
        {fix.status === 'proposed' && !canApply && <div className="text-[10px] text-slate-400">Someone allowed to apply AI fixes needs to approve this before it goes live.</div>}
        {fix.status === 'applied' && fix.appliedBy && <div className="text-[10px] text-slate-400">Applied by {fix.appliedBy.name}</div>}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
          <Sparkles className="w-4 h-4 text-indigo-500" /> Fix on WordPress
        </span>
        {canAsk && !hasOpenProposal && (
          <button
            onClick={prepare}
            disabled={preparing}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded text-[11px] disabled:opacity-60"
          >
            {preparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {preparing ? 'Reading the page…' : active.length ? 'Try another fix' : 'Fix with AI'}
          </button>
        )}
      </div>
      {!canAsk && (
        <p className="text-[10px] text-slate-500">Fix with AI is turned off for members. A workspace admin can turn it on in Team → Roles &amp; Permissions.</p>
      )}
      {canAsk && !fixes.length && !preparing && (
        <p className="text-[10px] text-slate-500">Gemini reads this page in WordPress and proposes a change. Nothing goes live until an admin approves it, and every change can be undone.</p>
      )}
      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded px-2 py-1.5 text-[11px]">{error}</div>}
      {active.map(card)}
      {old.length > 0 && (
        <button onClick={() => setShowOld((v) => !v)} className="text-[10px] text-slate-500 hover:text-slate-800">
          {showOld ? 'Hide' : 'Show'} {old.length} earlier {old.length === 1 ? 'fix' : 'fixes'}
        </button>
      )}
      {showOld && old.map(card)}
    </div>
  );
};
