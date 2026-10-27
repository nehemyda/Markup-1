// Client revisions in the app: the guest's banner with "Submit to developer", the reminder bar while pins are
// unsent, the submit dialog, and the team's revision bar (re-open for the next round, submit for the client, copy a
// message for the client). The server decides and records everything (server/revisions.ts).
import React, { useState } from 'react';
import { CheckCircle2, Copy, Loader2, Lock, RotateCcw, Send, AlertTriangle, X } from 'lucide-react';
import { INCLUDED_REVISIONS, Pin, Project, Revision } from '../types';
import { copyText } from '../lib/clipboard';

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const guestLink = (projectId: string) => `${window.location.origin}/projects/${encodeURIComponent(projectId)}?guest_mode=true`;

// Who added the unsent pins: "Anna 5, Raj 2, you 1"
function peopleOf(pins: Pin[], myEmail: string) {
  const counts = new Map<string, { name: string; count: number; me: boolean }>();
  for (const pin of pins) {
    const email = String(pin.author?.email || '').toLowerCase();
    const name = String(pin.author?.name || 'Client').replace(/\s*\(Guest\)$/i, '');
    const key = email || name.toLowerCase();
    const entry = counts.get(key) || { name, count: 0, me: !!myEmail && email === myEmail.toLowerCase() };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => Number(b.me) - Number(a.me) || b.count - a.count);
}

// ---------- Guest ----------

export const GuestReviewBanner: React.FC<{
  project: Project;
  latest?: Revision;
  guestName?: string;
  unsentCount: number;
  isMemberPreview: boolean;
  onSubmit: () => void;
  onSignIn: () => void;
  onChangeGuest?: () => void;
}> = ({ project, latest, guestName, unsentCount, isMemberPreview, onSubmit, onSignIn, onChangeGuest }) => {
  const locked = project.reviewState === 'submitted';
  const done = locked && latest?.status === 'done';
  const tone = done ? 'bg-emerald-500 text-white' : locked ? 'bg-slate-800 text-white' : 'bg-amber-500 text-slate-950';
  return (
    <div className={`${tone} font-bold px-4 py-2 flex items-center justify-between gap-3 text-xs shadow-sm z-50`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm">{done ? '✅' : locked ? '🔒' : '👁️'}</span>
        <span className="min-w-0">
          {done ? (
            <>Revision {latest!.number} is done. Please review the changes on <span className="underline">{project.name}</span>.</>
          ) : locked ? (
            <>Revision {latest?.number ?? project.revisionCount} was sent to the developer{latest ? ` on ${day(latest.submittedAt)}` : ''}. You can view your pins; adding more opens when the team starts your next revision.</>
          ) : (
            <>
              <strong>Guest review:</strong> you are reviewing <span className="underline">{project.name}</span>
              {guestName ? <> as {guestName}{onChangeGuest && <> (<button onClick={onChangeGuest} className="underline cursor-pointer">not you?</button>)</>}</> : ''}.
              {' '}Drop pins and comment, then send them to the developer.
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!locked && !isMemberPreview && (
          <button
            onClick={onSubmit}
            disabled={!unsentCount}
            title={unsentCount ? undefined : 'Add a pin first'}
            className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-950/20 disabled:text-slate-950/50 disabled:cursor-not-allowed px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Submit to developer{unsentCount ? ` (${unsentCount})` : ''}
          </button>
        )}
        <button
          onClick={onSignIn}
          className={`${locked ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-950 hover:bg-slate-900'} text-white px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer`}
        >
          {isMemberPreview ? 'Exit guest preview' : 'Sign in'}
        </button>
      </div>
    </div>
  );
};

// Reminder at the bottom while the client has pins that weren't sent
export const UnsentPinsBar: React.FC<{ count: number; onSubmit: () => void }> = ({ count, onSubmit }) =>
  count ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-full shadow-2xl pl-4 pr-1.5 py-1.5 flex items-center gap-3 text-xs font-semibold">
      <span>{plural(count, 'pin')} not sent to the developer yet</span>
      <button onClick={onSubmit} className="bg-indigo-500 hover:bg-indigo-400 rounded-full px-3 py-1 font-bold flex items-center gap-1 cursor-pointer">
        <Send className="w-3 h-3" /> Submit
      </button>
    </div>
  ) : null;

export const SubmitRevisionDialog: React.FC<{
  isOpen: boolean;
  pins: Pin[];
  nextNumber: number;
  // The person submitting (a guest, or a team member submitting for the client)
  me: { name: string; email: string };
  forClient: boolean;
  // Other people on the link writing a pin right now
  othersDrafting: string[];
  onSubmit: () => Promise<void>;
  onClose: () => void;
}> = ({ isOpen, pins, nextNumber, me, forClient, othersDrafting, onSubmit, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ count: number; number: number } | null>(null);
  if (!isOpen) return null;
  const people = peopleOf(pins, forClient ? '' : me.email);
  const overLimit = nextNumber > INCLUDED_REVISIONS;
  const close = () => {
    setError('');
    setSent(null);
    onClose();
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit();
      setSent({ count: pins.length, number: nextNumber });
    } catch (err: any) {
      setError(err?.message || 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-sm">
        {sent ? (
          <>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />
              <div>
                <h2 className="font-extrabold text-base text-slate-900">
                  {forClient ? `Submitted as Revision ${sent.number}` : 'Thanks! Your feedback was sent'}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  {forClient
                    ? `${plural(sent.count, 'pin')} went to the developers. The client's link is now view-only.`
                    : `Your ${plural(sent.count, 'pin')} went to the developer as Revision ${sent.number}. You can still view this page; the team will let you know at ${me.email} when the changes are done.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={close} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-base text-slate-900">{forClient ? 'Submit for the client' : 'Send your feedback to the developer'}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  This sends {plural(pins.length, 'pin')} as <strong>Revision {nextNumber}</strong>
                  {people.length ? `: ${people.map((p) => `${p.me ? 'you' : p.name} ${p.count}`).join(', ')}` : ''}.
                </p>
              </div>
              <button onClick={close} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {othersDrafting.length > 0 && (
              <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{othersDrafting.join(', ')}</strong> {othersDrafting.length === 1 ? 'is' : 'are'} adding a pin right now. You can wait for them, or send now; their unfinished pin is kept for the next revision.
                </span>
              </div>
            )}

            {overLimit && (
              <div className="flex gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Revision limit reached: {INCLUDED_REVISIONS} revisions are included. Revision {nextNumber} is an extra revision and may be charged.</span>
              </div>
            )}

            <div className="flex gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span>After sending, the review link is view-only until the team opens it for the next revision.</span>
            </div>

            {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{error}</div>}

            <div className="flex justify-end gap-2">
              <button onClick={close} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer">Not yet</button>
              <button
                onClick={submit}
                disabled={busy || !pins.length}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {forClient ? 'Submit for client' : 'Send to developer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------- Team ----------

// Shown above the canvas for the team when the project has client revisions or unsent client pins
export const TeamRevisionBar: React.FC<{
  project: Project;
  revisions: Revision[];
  unsentCount: number;
  onSubmitForClient: () => void;
  onReopen: () => Promise<void>;
}> = ({ project, revisions, unsentCount, onSubmitForClient, onReopen }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const count = project.revisionCount || 0;
  if (!count && !unsentCount) return null;
  const latest = revisions[0];
  const locked = project.reviewState === 'submitted';
  const overLimit = count > INCLUDED_REVISIONS;

  const flash = (text: string) => {
    setNote(text);
    setTimeout(() => setNote(''), 3000);
  };
  const reopen = async () => {
    setBusy(true);
    try {
      await onReopen();
      flash(`Open for Revision ${count + 1}`);
    } catch (err: any) {
      flash(err?.message || 'Could not open the link.');
    } finally {
      setBusy(false);
    }
  };
  const copyMessage = async () => {
    const link = guestLink(project.id);
    const text = latest?.status === 'done'
      ? `Hi! The changes from your Revision ${latest.number} on ${project.name} are done. Please review them here: ${link}`
      : `Hi! We've received your feedback (Revision ${latest?.number ?? count}) on ${project.name} and are working on it. You can follow along here: ${link}`;
    flash((await copyText(text)) ? 'Message copied' : 'Could not copy');
  };

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <span className="font-bold text-slate-900">Client review</span>
      <span className={`px-2 py-0.5 rounded-full font-bold ${overLimit ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
        Revision {count} of {INCLUDED_REVISIONS} included
      </span>
      {overLimit && <span className="text-rose-700 font-semibold">Revision limit is over: extra revisions are chargeable</span>}
      <span className="text-slate-500">
        {locked && latest
          ? `Revision ${latest.number} ${latest.status === 'done' ? 'done' : 'submitted'} by ${latest.submittedBy?.name || 'the client'} on ${day(latest.submittedAt)} · ${plural(latest.pinIds.length, 'pin')} · view-only for the client`
          : `Open for the client${unsentCount ? ` · ${plural(unsentCount, 'pin')} not submitted yet` : ''}`}
      </span>
      <span className="flex-1" />
      {note && <span className="text-emerald-600 font-semibold">{note}</span>}
      {!locked && unsentCount > 0 && (
        <button onClick={onSubmitForClient} className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 font-semibold flex items-center gap-1 cursor-pointer">
          <Send className="w-3.5 h-3.5" /> Submit for client
        </button>
      )}
      {latest && (
        <button onClick={copyMessage} className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 font-semibold flex items-center gap-1 cursor-pointer">
          <Copy className="w-3.5 h-3.5" /> Copy message for client
        </button>
      )}
      {locked && (
        <button onClick={reopen} disabled={busy} className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold flex items-center gap-1 cursor-pointer">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Open for next revision
        </button>
      )}
    </div>
  );
};
