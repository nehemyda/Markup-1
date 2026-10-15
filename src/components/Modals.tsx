import React, { useState } from 'react';
import { Project, Asset, Teammate } from '../types';
import { projectUrl } from '../lib/routes';
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
  onCreateProject: (name: string, client: string, desc: string, avatar: string, color: string, websiteUrl?: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreateProject }) => {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [desc, setDesc] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [avatar, setAvatar] = useState('🚀');
  const [color, setColor] = useState('from-blue-600 to-indigo-600');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name.trim(), client.trim() || 'Internal Team', desc.trim(), avatar, color, websiteUrl.trim());
    setName('');
    setClient('');
    setDesc('');
    setWebsiteUrl('');
    onClose();
  };

  const avatars = ['🚀', '⚡', '💎', '🎨', '🛍️', '🔥', '🌐', '🛡️', '✨'];
  const colors = [
    'from-blue-600 to-indigo-600',
    'from-purple-600 to-pink-600',
    'from-emerald-600 to-teal-600',
    'from-amber-600 to-orange-600',
    'from-rose-600 to-red-600',
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-1.5 font-extrabold text-sm text-slate-900">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Create New Client Project</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Project Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Web App Redesign Beta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
              autoFocus
            />
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Client / Organization Name</label>
            <input
              type="text"
              placeholder="e.g. Acme Enterprises Inc."
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
            />
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Project Goal / Description</label>
            <textarea
              rows={2}
              placeholder="Brief summary of the annotation goals or launch deadline..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 resize-none shadow-xs"
            />
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Target Website or Staging URL</label>
            <input
              type="text"
              placeholder="e.g. https://myclientwebsite.com or staging.app.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
            />
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">Project Avatar Emoji</label>
            <div className="flex items-center gap-1.5">
              {avatars.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                    avatar === a ? 'bg-indigo-600 text-white scale-110 shadow-sm' : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">Color Theme</label>
            <div className="flex items-center gap-2.5">
              {colors.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full bg-gradient-to-r ${c} transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-slate-900 shadow-sm' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-1.5 rounded-md shadow-xs transition-all"
            >
              Create Project Folder
            </button>
          </div>
        </form>
      </div>
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
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
  onInviteTeammate?: (name: string, email: string, role: Teammate['role']) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, currentProject, onInviteTeammate }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedGuestLink, setCopiedGuestLink] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sentInvite, setSentInvite] = useState(false);

  if (!isOpen) return null;

  const shareUrl = currentProject ? projectUrl(currentProject.id) : '';
  const guestShareUrl = currentProject ? projectUrl(currentProject.id, true) : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyGuestLink = () => {
    navigator.clipboard.writeText(guestShareUrl);
    setCopiedGuestLink(true);
    setTimeout(() => setCopiedGuestLink(false), 2000);
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const email = inviteEmail.trim();
    onInviteTeammate?.(email.split('@')[0].replace(/[._]/g, ' '), email, 'Member');
    setSentInvite(true);
    setTimeout(() => {
      setInviteEmail('');
      setSentInvite(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 select-none">
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
          {/* Guest Client Link (No Login Required) */}
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

          {/* Email Invite */}
          <div className="pt-2 border-t border-slate-200 space-y-1.5">
            <label className="font-extrabold text-slate-700 uppercase tracking-wider block">Invite Teammate via Email</label>
            <p className="text-[11px] text-slate-500">
              Users with <code className="bg-slate-100 text-slate-800 font-bold px-1 rounded">@yourdigitalagents.com</code> automatically join as <strong>Member (Editor & Annotator)</strong>.
            </p>
            <form onSubmit={handleSendEmail} className="flex gap-1.5">
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600 shadow-2xs"
              />
              <button
                type="submit"
                disabled={sentInvite}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                {sentInvite ? '✅ Invite Sent!' : 'Invite Member'}
              </button>
            </form>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-slate-600 shadow-2xs font-medium">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Permissions: Anyone with Guest link can view & comment</span>
            </div>
          </div>

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
