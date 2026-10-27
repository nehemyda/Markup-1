import React, { useEffect, useMemo, useState } from 'react';
import { Coins, Sparkles, FolderKanban, CalendarDays, Receipt, Save, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { subscribeAiMonths, subscribeAiUsage } from '../lib/supabaseSync';
import { apiFetch } from '../lib/api';
import { Project } from '../types';

interface Totals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface MonthDoc extends Totals {
  month: string;
  projects?: Record<string, Totals & { projectId?: string | null }>;
  features?: Record<string, Totals & { feature?: string }>;
}

interface UsageRecord extends Totals {
  id: string;
  at?: string;
  feature: string;
  projectId?: string | null;
  actor?: { name?: string; email?: string } | null;
  model: string;
}

const FEATURE_NAMES: Record<string, string> = {
  'fix-with-ai': 'Fix with AI (WordPress)',
  'audit-site': 'AI website review',
  'summarize-thread': 'Summarize thread',
  'convert-ticket': 'Dev ticket',
  'suggest-fix': 'Suggest fix',
  other: 'Other',
};

const featureName = (key = '') => FEATURE_NAMES[key] || FEATURE_NAMES[key.replace(/_/g, '-')] || key;

// Small amounts need more decimals ($0.0042), larger ones read better rounded ($12.40)
function usd(value = 0) {
  const digits = value !== 0 && Math.abs(value) < 0.01 ? 4 : 2;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const tokens = (n = 0) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const thisMonth = () => new Date().toISOString().slice(0, 7);

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

const EMPTY: Totals = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

export const AiCreditsView: React.FC<{ projects: Project[]; canEdit: boolean }> = ({ projects, canEdit }) => {
  const [months, setMonths] = useState<MonthDoc[]>([]);
  const [selected, setSelected] = useState(thisMonth());
  const [recent, setRecent] = useState<UsageRecord[]>([]);
  const [pricing, setPricing] = useState<{ inputPerMillion: string; outputPerMillion: string } | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceNote, setPriceNote] = useState('');

  // Monthly totals (the history) and the selected month's latest requests
  useEffect(() => subscribeAiMonths<MonthDoc>(setMonths), []);
  useEffect(() => subscribeAiUsage<UsageRecord>(selected, setRecent), [selected]);
  useEffect(() => {
    apiFetch('/api/ai-pricing')
      .then((r) => r.json())
      .then((p) => setPricing({ inputPerMillion: String(p.inputPerMillion), outputPerMillion: String(p.outputPerMillion) }))
      .catch(() => {});
  }, []);

  const current = months.find((m) => m.month === selected) || ({ month: selected, ...EMPTY } as MonthDoc);
  const previous = months.find((m) => m.month === previousMonth(selected));
  const change = previous && previous.costUsd > 0 ? ((current.costUsd - previous.costUsd) / previous.costUsd) * 100 : null;
  const monthOptions = useMemo(() => Array.from(new Set([thisMonth(), ...months.map((m) => m.month)])).sort().reverse(), [months]);
  const allTime = months.reduce((acc, m) => ({
    requests: acc.requests + (m.requests || 0),
    inputTokens: acc.inputTokens + (m.inputTokens || 0),
    outputTokens: acc.outputTokens + (m.outputTokens || 0),
    costUsd: acc.costUsd + (m.costUsd || 0),
  }), EMPTY);

  const projectName = (id?: string | null) => {
    if (!id || id === 'none') return 'Not linked to a project';
    const p = projects.find((x) => x.id === id);
    return p ? (p.assets?.[0]?.url || p.name).replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Deleted project';
  };

  const byProject = (Object.entries(current.projects || {}) as Array<[string, Totals & { projectId?: string | null }]>)
    .map(([key, t]) => ({ id: t.projectId ?? (key === 'none' ? null : key), ...t }))
    .sort((a, b) => b.costUsd - a.costUsd);
  const byFeature = (Object.entries(current.features || {}) as Array<[string, Totals & { feature?: string }]>)
    .map(([key, t]) => ({ key: t.feature || key, ...t }))
    .sort((a, b) => b.costUsd - a.costUsd);

  const savePricing = async () => {
    if (!pricing) return;
    setSavingPrice(true);
    setPriceNote('');
    try {
      const res = await apiFetch('/api/ai-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputPerMillion: Number(pricing.inputPerMillion), outputPerMillion: Number(pricing.outputPerMillion) }),
      });
      const data = await res.json().catch(() => ({}));
      setPriceNote(res.ok ? 'Saved. New requests use these prices.' : data.error || 'Could not save.');
    } finally {
      setSavingPrice(false);
    }
  };

  const stat = (icon: React.ReactNode, label: string, value: string, sub?: React.ReactNode) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{icon}{label}</div>
      <div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );

  const share = (cost: number) => (current.costUsd > 0 ? Math.round((cost / current.costUsd) * 100) : 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" /> AI Credits
          </h1>
          <p className="text-xs text-slate-500 mt-1">Gemini usage and estimated cost in USD, per project and per month.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer">
            {monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat(<Receipt className="w-3.5 h-3.5" />, 'Estimated cost', usd(current.costUsd),
          change === null ? (previous ? `${usd(previous.costUsd)} last month` : 'No earlier month to compare') : (
            <span className={`inline-flex items-center gap-1 ${change > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(change).toFixed(0)}% vs {monthLabel(previousMonth(selected)).split(' ')[0]}
            </span>
          ))}
        {stat(<Sparkles className="w-3.5 h-3.5" />, 'AI requests', current.requests.toLocaleString(), current.requests ? `${usd(current.costUsd / current.requests)} per request` : undefined)}
        {stat(<Coins className="w-3.5 h-3.5" />, 'Tokens', tokens(current.inputTokens + current.outputTokens), `${tokens(current.inputTokens)} in · ${tokens(current.outputTokens)} out`)}
        {stat(<FolderKanban className="w-3.5 h-3.5" />, 'Projects using AI', String(byProject.filter((p) => p.id).length))}
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        {/* Per project */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-bold text-sm text-slate-900">By project · {monthLabel(selected)}</div>
          {byProject.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No AI usage in this month.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 font-bold border-b border-slate-100">
                  <th className="py-2 px-5">Project</th>
                  <th className="py-2 px-3 text-right">Requests</th>
                  <th className="py-2 px-3 text-right">Tokens</th>
                  <th className="py-2 px-5 text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byProject.map((p) => (
                  <tr key={p.id || 'none'}>
                    <td className="py-2.5 px-5">
                      <div className="font-semibold text-slate-800 truncate max-w-[260px]">{projectName(p.id)}</div>
                      <div className="h-1 bg-slate-100 rounded mt-1"><div className="h-1 bg-indigo-500 rounded" style={{ width: `${share(p.costUsd)}%` }} /></div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{p.requests}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{tokens(p.inputTokens + p.outputTokens)}</td>
                    <td className="py-2.5 px-5 text-right font-bold text-slate-900">{usd(p.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Per feature */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-bold text-sm text-slate-900">By feature</div>
          {byFeature.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No AI usage in this month.</div>
          ) : (
            <ul className="divide-y divide-slate-50 text-xs">
              {byFeature.map((f) => (
                <li key={f.key} className="px-5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800">{featureName(f.key)}</div>
                    <div className="text-[11px] text-slate-400">{f.requests} requests · {tokens(f.inputTokens + f.outputTokens)} tokens</div>
                  </div>
                  <div className="font-bold text-slate-900 shrink-0">{usd(f.costUsd)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Monthly history */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-sm text-slate-900">Monthly history</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 font-bold border-b border-slate-100">
              <th className="py-2 px-5">Month</th>
              <th className="py-2 px-3 text-right">Requests</th>
              <th className="py-2 px-3 text-right">Input tokens</th>
              <th className="py-2 px-3 text-right">Output tokens</th>
              <th className="py-2 px-5 text-right">Cost (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {months.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-400">No AI usage recorded yet.</td></tr>
            )}
            {months.map((m) => (
              <tr key={m.month} onClick={() => setSelected(m.month)} className={`cursor-pointer hover:bg-slate-50 ${m.month === selected ? 'bg-indigo-50/50' : ''}`}>
                <td className="py-2.5 px-5 font-semibold text-slate-800">{monthLabel(m.month)}</td>
                <td className="py-2.5 px-3 text-right text-slate-600">{m.requests}</td>
                <td className="py-2.5 px-3 text-right text-slate-600">{tokens(m.inputTokens)}</td>
                <td className="py-2.5 px-3 text-right text-slate-600">{tokens(m.outputTokens)}</td>
                <td className="py-2.5 px-5 text-right font-bold text-slate-900">{usd(m.costUsd)}</td>
              </tr>
            ))}
            {months.length > 1 && (
              <tr className="bg-slate-50 font-bold">
                <td className="py-2.5 px-5 text-slate-800">All time</td>
                <td className="py-2.5 px-3 text-right text-slate-700">{allTime.requests}</td>
                <td className="py-2.5 px-3 text-right text-slate-700">{tokens(allTime.inputTokens)}</td>
                <td className="py-2.5 px-3 text-right text-slate-700">{tokens(allTime.outputTokens)}</td>
                <td className="py-2.5 px-5 text-right text-slate-900">{usd(allTime.costUsd)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        {/* Latest requests */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-bold text-sm text-slate-900">Latest requests · {monthLabel(selected)}</div>
          {recent.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No AI requests in this month.</div>
          ) : (
            <ul className="divide-y divide-slate-50 text-xs max-h-80 overflow-y-auto">
              {recent.map((r) => (
                <li key={r.id} className="px-5 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{featureName(r.feature)} · <span className="font-normal text-slate-500">{projectName(r.projectId)}</span></div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {r.at ? new Date(r.at).toLocaleString() : ''} · {r.actor?.name || r.actor?.email || 'Unknown'} · {tokens(r.inputTokens)} in / {tokens(r.outputTokens)} out
                    </div>
                  </div>
                  <div className="font-bold text-slate-900 shrink-0">{usd(r.costUsd)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Prices */}
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 space-y-3 text-xs">
          <div className="font-bold text-sm text-slate-900">Prices used for the estimate</div>
          <p className="text-slate-500 leading-relaxed">
            USD per 1 million tokens. Set these to match your Google AI billing for the model in use (gemini-3.6-flash). Each request keeps the price it was charged at, so changes only affect new requests.
          </p>
          {pricing ? (
            <>
              {(['inputPerMillion', 'outputPerMillion'] as const).map((key) => (
                <label key={key} className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-700">{key === 'inputPerMillion' ? 'Input tokens' : 'Output tokens (incl. thinking)'}</span>
                  <span className="flex items-center gap-1">
                    $
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricing[key]}
                      disabled={!canEdit}
                      onChange={(e) => setPricing({ ...pricing, [key]: e.target.value })}
                      className="w-20 border border-slate-200 rounded px-2 py-1 text-right disabled:bg-slate-50"
                    />
                  </span>
                </label>
              ))}
              {canEdit && (
                <button onClick={savePricing} disabled={savingPrice} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-md disabled:opacity-50">
                  {savingPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save prices
                </button>
              )}
              {priceNote && <div className="text-[11px] text-slate-500">{priceNote}</div>}
            </>
          ) : (
            <div className="text-slate-400">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
};
