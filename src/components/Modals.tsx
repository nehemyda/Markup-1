import React, { useState } from 'react';
import { Project, Asset, Teammate, Folder } from '../types';
import { projectUrl } from '../lib/routes';
import { copyText } from '../lib/clipboard';
import { useGuestPolicy } from '../lib/workspaceSettings';
import { InviteForm } from './InviteForm';
import { 
  Plus, 
  X, 
  Share2, 
  Copy, 
  Check, 
  Globe, 
  Image as ImageIcon, 
  Smartphone, 
  Download, 
  Users, 
  Sparkles, 
  Mail, 
  Lock, 
  Link as LinkIcon 
} from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (url: string, name: string, folderId: string | null) => void;
  folders?: Folder[];
  defaultFolderId?: string | null;
}

// A project is one website: only the address is needed. Name defaults to the address; folder defaults to the open one.
export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreateProject, folders = [], defaultFolderId = null }) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setUrl('');
      setName('');
      setError('');
      setFolderId(defaultFolderId);
    }
  }, [isOpen, defaultFolderId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = url.trim();
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(withScheme);
      if (!parsed.hostname.includes('.')) throw new Error('no domain');
    } catch {
      setError('Enter a website address, e.g. example.com');
      return;
    }
    onCreateProject(withScheme, name.trim(), folderId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base text-slate-900">New project</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">Website address</span>
          <input
            autoFocus
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            placeholder="e.g. example.com or staging.example.com"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />
          {error && <span className="block text-xs text-rose-600 mt-1">{error}</span>}
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-600">Project name <span className="font-normal text-slate-400">(optional)</span></span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Uses the website address if empty"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />
        </label>

        {folders.length > 0 && (
          <label className="block">
            <span className="text-xs font-bold text-slate-600">Folder</span>
            <select
              value={folderId || ''}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">No folder</option>
              {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            Create project
          </button>
        </div>
      </form>
    </div>
  );
};

interface NewAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAsset: (title: string, url: string, type: Asset['type']) => void;
}

export const NewAssetModal: React.FC<NewAssetModalProps> = ({ isOpen, onClose, onCreateAsset }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<Asset['type']>('url');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    onCreateAsset(title.trim(), url.trim(), type);
    setTitle('');
    setUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-1.5 font-extrabold text-sm text-slate-900">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Add Asset / Web Page to Annotate</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">Asset Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('url')}
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                  type === 'url' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold shadow-xs' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Live Website</span>
              </button>
              <button
                type="button"
                onClick={() => setType('image')}
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                  type === 'image' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold shadow-xs' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>Image Mockup</span>
              </button>
              <button
                type="button"
                onClick={() => setType('mockup')}
                className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition-all ${
                  type === 'mockup' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-extrabold shadow-xs' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Mobile App</span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Asset Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Checkout Step 2 or Staging Portal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
            />
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Target URL or Image Link</label>
            <input
              type="text"
              required
              placeholder={type === 'url' ? 'https://yourwebsite.com' : 'https://images.unsplash.com/...'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 font-mono shadow-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900">Cancel</button>
            <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-1.5 rounded-md shadow-xs transition-all">
              Add to Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: Project | null;
  onInviteTeammate?: (name: string, email: string, role: Teammate['role']) => Promise<void>;
  // Admins pick the invite role; Owners may also invite Owners
  canChooseRole?: boolean;
  allowOwner?: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, currentProject, onInviteTeammate, canChooseRole = false, allowOwner = false }) => {
  const guestPolicy = useGuestPolicy();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedGuestLink, setCopiedGuestLink] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (!isOpen) return null;

  const shareUrl = currentProject ? projectUrl(currentProject.id) : '';
  const guestShareUrl = currentProject ? projectUrl(currentProject.id, true) : '';

  // Only show "Copied" when the copy really worked; otherwise ask the person to copy the link by hand
  const copyLink = async () => {
    const ok = await copyText(shareUrl);
    setCopyFailed(!ok);
    if (!ok) return;
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyGuestLink = async () => {
    const ok = await copyText(guestShareUrl);
    setCopyFailed(!ok);
    if (!ok) return;
    setCopiedGuestLink(true);
    setTimeout(() => setCopiedGuestLink(false), 2000);
  };


  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-base text-slate-900">
            <Share2 className="w-5 h-5 text-blue-600" />
            <span>Share & Collaborate</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4 text-xs">

          {currentProject ? (
            <div className="text-[11px] text-slate-500">
              Sharing project: <strong className="text-slate-900">{currentProject.name}</strong>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-600">
              There are no projects to share yet. Create a project first, then open Share from inside it.
            </div>
          )}

          {currentProject && (<>
          {/* Guest Client Link (No Login Required) — only when allowed in Settings */}
          {guestPolicy.guestLinksEnabled ? (
            <>
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Globe className="w-3.5 h-3.5 text-amber-600" />
                <span>Share Review Link (No Login Required)</span>
              </label>
              <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                Share Link
              </span>
            </div>
            <p className="text-[11px] text-amber-800 leading-snug">
              External clients or reviewers can open this link to drop comment pins, review pages, and reply without needing a workspace account.
            </p>
            <div className="flex items-center gap-1.5 bg-white border border-amber-300 rounded-lg p-1 shadow-2xs">
              <LinkIcon className="w-3.5 h-3.5 text-amber-600 ml-1.5 shrink-0" />
              <input
                type="text"
                readOnly
                value={guestShareUrl}
                className="bg-transparent text-amber-950 font-mono w-full focus:outline-none text-[11px] px-1"
              />
              <button
                onClick={copyGuestLink}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-md shadow-2xs shrink-0 flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedGuestLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedGuestLink ? 'Copied Link' : 'Copy Share Link'}</span>
              </button>
            </div>
          </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[11px] text-slate-600">
              Guest review links are turned off in <strong>Settings → Workspace Details</strong>, so clients can't open this project without an account.
            </div>
          )}

          {/* Regular Workspace Member Link */}
          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Standard Workspace Member Link</label>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl p-1 shadow-2xs">
              <LinkIcon className="w-3.5 h-3.5 text-slate-500 ml-1.5 shrink-0" />
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-slate-800 font-mono w-full focus:outline-none text-xs px-1"
              />
              <button
                onClick={copyLink}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-2xs shrink-0 flex items-center gap-1 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          </>)}

          {copyFailed && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">
              Your browser blocked copying. Click into the link box, select the link and copy it (Cmd+C).
            </div>
          )}

          {/* Invite a teammate (role choice for admins; shows a sign-up link afterwards) */}
          {onInviteTeammate && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <label className="font-extrabold text-slate-700 uppercase tracking-wider block">Invite a Teammate</label>
              <InviteForm canChooseRole={canChooseRole} allowOwner={allowOwner} onInvite={onInviteTeammate} />
            </div>
          )}

          {guestPolicy.guestLinksEnabled && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shadow-2xs font-medium">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Permissions: Anyone with Guest link can view & comment</span>
            </div>
          </div>
          )}

          <div className="pt-2 flex justify-end border-t border-slate-200">
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold px-5 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Asks a signed-out guest for their name before their first pin or comment, so feedback is attributed
export const GuestNameModal: React.FC<{
  isOpen: boolean;
  onSave: (profile: { name: string; email: string }) => void;
  onCancel: () => void;
}> = ({ isOpen, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave({ name: name.trim(), email: email.trim() });
        }}
        className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-sm"
      >
        <div>
          <h2 className="font-extrabold text-base text-slate-900">Before you leave feedback</h2>
          <p className="text-xs text-slate-500 mt-1">Your name is shown on the pins and comments you add.</p>
        </div>
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Your name</span>
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maria Lopez"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-600">Email <span className="font-normal text-slate-400">(optional)</span></span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            Continue
          </button>
        </div>
      </form>
    </div>
  );
};

