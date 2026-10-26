import React, { useState } from 'react';
import { Check, Copy, Loader2, Send } from 'lucide-react';
import { Teammate } from '../types';
import { copyText } from '../lib/clipboard';
import { inviteLink } from '../lib/firebaseSync';

export type InviteRole = 'Member' | 'Admin' | 'Owner';

interface InviteFormProps {
  // Admins choose the role; everyone else invites as Member
  canChooseRole: boolean;
  // Only Owners can invite another Owner
  allowOwner: boolean;
  onInvite: (name: string, email: string, role: Teammate['role']) => Promise<void>;
}

const ROLE_HELP: Record<InviteRole, string> = {
  Member: 'Reviews projects, drops pins and comments.',
  Admin: 'Also manages the team, roles, settings and WordPress.',
  Owner: 'Full access, like you.',
};

// Invite someone by email. The app doesn't send emails yet, so afterwards it shows a sign-up link to share.
export const InviteForm: React.FC<InviteFormProps> = ({ canChooseRole, allowOwner, onInvite }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<InviteRole>('Member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invited, setInvited] = useState<{ email: string; role: InviteRole } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onInvite(name, address, canChooseRole ? role : 'Member');
      setInvited({ email: address, role: canChooseRole ? role : 'Member' });
      setEmail('');
      setName('');
      setRole('Member');
    } catch (err: any) {
      setError(
        err?.code === 'permission-denied'
          ? 'You are not allowed to send this invite. Ask a workspace admin.'
          : err?.message || 'Could not save the invite.'
      );
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!invited) return;
    if (await copyText(inviteLink(invited.email))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (invited) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2.5 text-xs">
        <div className="font-bold text-emerald-900">
          {invited.email} is invited as {invited.role}.
        </div>
        <p className="text-emerald-900/80 text-[11px] leading-relaxed">
          The app doesn't send emails yet. Send them this link; it opens sign-up with their email filled in. They can also sign up with Google.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700">
            {inviteLink(invited.email)}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy invite link'}
          </button>
        </div>
        <button type="button" onClick={() => setInvited(null)} className="text-[11px] font-bold text-emerald-800 hover:underline">
          Invite someone else
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          aria-label="Email"
          className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          aria-label="Name"
          className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
        />
      </div>
      {canChooseRole && (
        <div className="flex items-center gap-2">
          <label htmlFor="invite-role" className="font-semibold text-slate-600 shrink-0">Role</label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 cursor-pointer"
          >
            <option value="Member">Member</option>
            <option value="Admin">Admin</option>
            {allowOwner && <option value="Owner">Owner</option>}
          </select>
          <span className="text-[11px] text-slate-500">{ROLE_HELP[role]}</span>
        </div>
      )}
      {error && <div className="text-rose-600 text-[11px]">{error}</div>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500">
          They can sign up with this email even if it is outside your allowed domains. Roles can be changed later on the Team page.
        </span>
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Invite
        </button>
      </div>
    </form>
  );
};
