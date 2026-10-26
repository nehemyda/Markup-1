import { apiFetch } from '../lib/api';
import { WpFixPanel } from './WpFixPanel';
import { pinDevice, pinColor } from '../lib/pins';
import { toMillis, timeAgo, fullTime } from '../lib/time';
import { Tablet, Smartphone, RotateCcw } from 'lucide-react';
import { filesToAttachments, rejectedFilesMessage } from '../lib/attachments';
import React, { useState, useRef } from 'react';
import { Pin, PinStatus, Teammate, Comment, Attachment, QARubricRule, QAPinError, FilterState } from '../types';
import { SearchableMemberSelect } from './SearchableMemberSelect';
import { UserAvatar } from './UserAvatar';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  UserCheck, 
  Tag, 
  Monitor, 
  Terminal, 
  Copy, 
  Check, 
  Mic, 
  Paperclip, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  MoreVertical, 
  Bug, 
  Palette, 
  FileText, 
  HelpCircle,
  ExternalLink,
  Code,
  FileSpreadsheet,
  X,
  Pin as PinIcon,
  ChevronDown,
  Search,
  PinOff,
  Bell,
  AtSign,
  Award,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Loader2,
  Maximize2
} from 'lucide-react';

interface SidebarDiscussionProps {
  pins: Pin[];
  selectedPin: Pin | null;
  onSelectPin: (pin: Pin | null) => void;
  onUpdatePinStatus: (pinId: string, status: PinStatus) => void;
  onUpdatePinAssignee: (pinId: string, assignee: Teammate) => void;
  onAddComment: (pinId: string, text: string, attachments?: Attachment[], audioDuration?: string) => void;
  teammates: Teammate[];
  currentUser: Teammate;
  onNotify?: (notification: { title: string; message: string; recipient: string; pinId?: string; assetId?: string }) => void;
  rubricRules?: QARubricRule[];
  onUpdatePinQAError?: (pinId: string, qaError?: QAPinError) => void;
  onDeletePin?: (pinId: string) => void;
  // Deleted tab (team only)
  onRestorePin?: (pinId: string) => void;
  onPurgePin?: (pinId: string) => void;
  onDeleteComment?: (pinId: string, commentId: string) => void;
  onClose?: () => void;
  pages?: { id: string; url: string }[];
  filterState?: FilterState;
  onUpdateFilter?: (updates: Partial<FilterState>) => void;
  currentPageId?: string;
  isPinned?: boolean;
  onTogglePinned?: () => void;
  // Set when the project is connected to WordPress: shows "Fix with AI" for members
  wpFix?: {
    projectId: string;
    // false = project not connected yet: show how to connect instead
    connected: boolean;
    onConnect: () => void;
    isAdmin: boolean;
    // From Team → Roles & Permissions (always true for Owners and Admins)
    canAsk: boolean;
    canApply: boolean;
    onSiteChanged: () => void;
    onPreviewCss: (css: string | null) => void;
  };
}

const PIN_STATUSES: Array<{ value: PinStatus; label: string; dot: string }> = [
  { value: 'open', label: 'Open', dot: 'bg-rose-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-amber-400' },
  { value: 'waiting_on_customer', label: 'Waiting on Customer', dot: 'bg-sky-500' },
  { value: 'ready_for_review', label: 'In Review', dot: 'bg-purple-500' },
  { value: 'resolved', label: 'Resolved', dot: 'bg-emerald-500' },
  { value: 'archived', label: 'Archived', dot: 'bg-slate-300' },
];

// Pin status picker: the selected name may wrap to two lines (a plain <select> can't)
const StatusPicker: React.FC<{ value: PinStatus; onChange: (status: PinStatus) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const current = PIN_STATUSES.find((s) => s.value === value) || PIN_STATUSES[0];
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${current.label}`}
        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold pl-2 pr-1.5 py-1 rounded-md border border-slate-200 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-xs max-w-[150px] text-left leading-tight"
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${current.dot}`} />
        <span className="min-w-0">{current.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
      {open && (
        <ul role="listbox" className="absolute left-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 text-xs">
          {PIN_STATUSES.map((s) => (
            <li key={s.value}>
              <button
                type="button"
                role="option"
                aria-selected={s.value === value}
                onClick={() => {
                  setOpen(false);
                  if (s.value !== value) onChange(s.value);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100 ${s.value === value ? 'font-bold text-slate-900' : 'text-slate-700'}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="flex-1">{s.label}</span>
                {s.value === value && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Which view the pin was dropped in (desktop / tablet / mobile)
const DeviceLabel: React.FC<{ pin: Pin }> = ({ pin }) => {
  const device = pinDevice(pin);
  const Icon = device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : Monitor;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 capitalize" title={`Added in ${device} view`}>
      <Icon className="w-3 h-3" />
      {device}
    </span>
  );
};

export const SidebarDiscussion: React.FC<SidebarDiscussionProps> = ({
  pins,
  selectedPin,
  onSelectPin,
  onUpdatePinStatus,
  onUpdatePinAssignee,
  onAddComment,
  teammates,
  currentUser,
  onNotify,
  rubricRules = [],
  onUpdatePinQAError,
  onDeletePin,
  onRestorePin,
  onPurgePin,
  onDeleteComment,
  onClose,
  pages = [],
  filterState,
  onUpdateFilter,
  currentPageId = '',
  isPinned = true,
  onTogglePinned,
  wpFix,
}) => {
  // Re-render every minute so "5 minutes ago" stays current
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [commentInput, setCommentInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const listTab: 'active' | 'resolved' | 'deleted' = showDeleted ? 'deleted' : filterState?.showResolved ? 'resolved' : 'active';
  const setListTab = (tab: 'active' | 'resolved' | 'deleted') => {
    setShowDeleted(tab === 'deleted');
    if (tab !== 'deleted') onUpdateFilter?.({ showResolved: tab === 'resolved' });
  };
  const [showSearch, setShowSearch] = useState(false);
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set());
  const isGuest = currentUser.role === 'Guest';
  const [copiedSelector, setCopiedSelector] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Comment Attachments & Lightbox Modal
  const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUploadForComment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Images are compressed; other files over the size limit are refused (see lib/attachments)
    filesToAttachments(Array.from(files)).then(({ attachments, rejected }) => {
      if (attachments.length) setCommentAttachments((prev) => [...prev, ...attachments]);
      if (rejected.length) alert(rejectedFilesMessage(rejected));
    });

    e.target.value = '';
  };

  // Mention Autocomplete States
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  
  // AI Assistant states
  const [aiSummary, setAiSummary] = useState<any | null>(null);
  const [aiTicket, setAiTicket] = useState<any | null>(null);
  const [aiFix, setAiFix] = useState<any | null>(null);
  const [loadingAi, setLoadingAi] = useState<string | null>(null);
  const [ticketPlatform, setTicketPlatform] = useState<'jira' | 'linear' | 'github'>('linear');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleCommentInputChange = (text: string) => {
    setCommentInput(text);
    // Guests cannot @mention: the mention menu would show the team list
    if (isGuest) return;

    // Detect @ symbol for autocomplete popup
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const query = text.slice(lastAtIndex + 1);
      if (!query.includes('\n') && query.length <= 25) {
        setMentionQuery(query.toLowerCase());
        setShowMentionMenu(true);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectMentionTeammate = (tm: Teammate) => {
    const lastAtIndex = commentInput.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const before = commentInput.slice(0, lastAtIndex);
      setCommentInput(`${before}@${tm.name} `);
    } else {
      setCommentInput((prev) => `${prev}@${tm.name} `);
    }
    setShowMentionMenu(false);
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPin || (!commentInput.trim() && commentAttachments.length === 0)) return;

    const trimmed = commentInput.trim() || (commentAttachments.length > 0 ? '📎 [Attached File(s)]' : '');
    onAddComment(
      selectedPin.id, 
      trimmed, 
      commentAttachments.length > 0 ? commentAttachments : undefined
    );

    setCommentInput('');
    setCommentAttachments([]);

    // Check if any teammate was @mentioned
    const mentionedNames = teammates.filter(t => 
      trimmed.toLowerCase().includes(`@${t.name.toLowerCase()}`) ||
      trimmed.toLowerCase().includes(`@${t.name.split(' ')[0].toLowerCase()}`)
    );

    if (mentionedNames.length > 0) {
      const recipientStr = mentionedNames.map(m => `@${m.name}`).join(', ');
      showToast(`🔔 Notification Sent! ${recipientStr} received an instant in-app & email notification.`);
      if (onNotify) {
        onNotify({
          title: `Tagged in Pin #${selectedPin.number}`,
          message: `${currentUser.name} tagged you: "${trimmed.slice(0, 80)}"`,
          recipient: recipientStr,
          pinId: selectedPin.id,
          assetId: selectedPin.assetId,
        });
      }
    }

    setCommentInput('');
    setShowMentionMenu(false);
  };

  // Helper to format @mentions in comment text nicely
  const renderFormattedCommentText = (text: string) => {
    if (!text) return null;
    
    // Regex matching @Name or @Role mentions
    const parts = text.split(/(@[A-Za-z0-9._\s\(\)]+?(?=\s|$|[,!?.]))/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const namePart = part.slice(1).trim();
        const matchedTeammate = teammates.find(t => 
          t.name.toLowerCase().includes(namePart.toLowerCase()) || 
          namePart.toLowerCase().includes(t.name.split(' ')[0].toLowerCase())
        );

        return (
          <span
            key={i}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-extrabold px-1.5 py-0.5 rounded-md border border-indigo-200 text-[11px] inline-flex items-center gap-1 shadow-2xs my-0.5 transition-colors cursor-pointer"
            title={matchedTeammate ? `Tagged ${matchedTeammate.name} (${matchedTeammate.role}) - Alert Sent` : 'Tagged teammate'}
          >
            <AtSign className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>{namePart}</span>
            {matchedTeammate && (
              <span className="text-[9px] bg-indigo-200/80 text-indigo-800 px-1 rounded font-semibold">
                {matchedTeammate.role}
              </span>
            )}
          </span>
        );
      }
      return part;
    });
  };


  const handleSimulateVoiceNote = () => {
    if (!selectedPin) return;
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      onAddComment(selectedPin.id, '🎙️ [Voice Note Recorded: Reviewed padding and font weight on viewport.]', undefined, '0:24');
    }, 1500);
  };

  const handleRunAiSummary = async () => {
    if (!selectedPin) return;
    setLoadingAi('summary');
    try {
      const res = await apiFetch('/api/ai/summarize-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedPin.projectId,
          pinTitle: selectedPin.title,
          category: selectedPin.category,
          comments: selectedPin.comments.map(c => `${c.author.name} (${c.author.role}): ${c.text}`),
        }),
      });
      const data = await res.json();
      setAiSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(null);
    }
  };

  const handleRunAiTicket = async () => {
    if (!selectedPin) return;
    setLoadingAi('ticket');
    try {
      const res = await apiFetch('/api/ai/convert-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedPin.projectId,
          pin: selectedPin,
          comments: selectedPin.comments,
          platform: ticketPlatform,
        }),
      });
      const data = await res.json();
      setAiTicket(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(null);
    }
  };

  const handleRunAiFix = async () => {
    if (!selectedPin) return;
    setLoadingAi('fix');
    try {
      const lastCmt = selectedPin.comments[selectedPin.comments.length - 1]?.text || selectedPin.title;
      const res = await apiFetch('/api/ai/suggest-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedPin.projectId,
          pinTitle: selectedPin.title,
          category: selectedPin.category,
          currentComment: lastCmt,
          metadata: selectedPin.metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The AI could not suggest a fix.');
      setAiFix(data);
    } catch (err: any) {
      showToast(err.message || 'The AI could not suggest a fix.');
    } finally {
      setLoadingAi(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSelector(true);
    setTimeout(() => setCopiedSelector(false), 2000);
  };

  const getStatusBadge = (status: PinStatus) => {
    switch (status) {
      case 'open': return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">Open</span>;
      case 'in_progress': return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">In Progress</span>;
      case 'waiting_on_customer': return <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">Waiting on Customer</span>;
      case 'ready_for_review': return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">In Review</span>;
      case 'resolved': return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">Resolved</span>;
      case 'archived': return <span className="bg-slate-500/20 text-slate-300 border border-slate-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">Archived</span>;
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'text-rose-400 font-bold';
      case 'medium': return 'text-amber-400 font-medium';
      case 'low': return 'text-emerald-400 font-normal';
      default: return 'text-slate-400';
    }
  };

  // IF NO PIN SELECTED: Show summary list of all pins on this asset
  if (!selectedPin) {
    const q = (filterState?.search || '').trim().toLowerCase();
    const livePins = pins.filter((p) => !p.deletedAt);
    const matchesFilter = (p: Pin) =>
      (!filterState || filterState.category === 'all' || p.category === filterState.category) &&
      (!q || p.title.toLowerCase().includes(q) || p.comments.some((c) => c.text.toLowerCase().includes(q)));
    const deletedPins = isGuest ? [] : pins.filter((p) => p.deletedAt && matchesFilter(p));
    const matching = livePins.filter(
      (p) =>
        (!filterState || filterState.category === 'all' || p.category === filterState.category) &&
        (!q || p.title.toLowerCase().includes(q) || p.comments.some((c) => c.text.toLowerCase().includes(q)))
    );
    const openPins = matching.filter(p => p.status !== 'resolved' && p.status !== 'archived');
    const resolvedPins = matching.filter(p => p.status === 'resolved' || p.status === 'archived');

    return (
      <aside className="w-80 lg:w-96 min-w-[20rem] lg:min-w-[24rem] max-w-[20rem] lg:max-w-[24rem] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xs overflow-hidden text-slate-900 z-10 relative">
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Feedback Threads</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-slate-200 border border-slate-300 px-2 py-0.5 rounded text-[10px] text-slate-700 font-mono font-bold">
              {livePins.length} total
            </span>
            {onTogglePinned && (
              <button
                type="button"
                onClick={onTogglePinned}
                title={isPinned ? 'Unpin: float the sidebar over the page' : 'Pin: show the sidebar beside the page'}
                className={`p-1 rounded-md transition-colors hover:bg-slate-200 ${isPinned ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
              >
                {isPinned ? <PinIcon className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>
            )}
            {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close sidebar"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            )}
          </div>
        </div>

        {/* Active / Resolved tabs (like Markup.io) */}
        <div className="flex items-center gap-4 px-3 border-b border-slate-200 text-xs shrink-0">
          {(isGuest ? (['active', 'resolved'] as const) : (['active', 'resolved', 'deleted'] as const)).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setListTab(tab)}
              className={`py-2.5 border-b-2 -mb-px font-semibold transition-colors ${
                listTab === tab ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'active' ? openPins.length : tab === 'resolved' ? resolvedPins.length : deletedPins.length}{' '}
              {tab === 'active' ? 'Active' : tab === 'resolved' ? 'Resolved' : 'Deleted'}
            </button>
          ))}
          {filterState && onUpdateFilter && (
            <div className="ml-auto flex items-center gap-1">
              <label className="relative flex items-center" title="Filter by type">
                <span className="sr-only">Filter by type</span>
                <select
                  value={filterState.category}
                  onChange={(e) => onUpdateFilter({ category: e.target.value as FilterState['category'] })}
                  className={`appearance-none bg-transparent pl-1.5 pr-5 py-1 rounded-md text-[11px] font-semibold cursor-pointer hover:bg-slate-100 focus:outline-none ${
                    filterState.category === 'all' ? 'text-slate-500' : 'text-indigo-600'
                  }`}
                >
                  {(['all', 'bug', 'design', 'content', 'question', 'approved'] as const).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All types' : cat[0].toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 pointer-events-none" />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (showSearch) onUpdateFilter({ search: '' });
                  setShowSearch((open) => !open);
                }}
                title="Search comments"
                className={`p-1 rounded-md hover:bg-slate-100 ${showSearch || filterState.search ? 'text-indigo-600' : 'text-slate-400'}`}
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {showSearch && filterState && onUpdateFilter && (
          <div className="px-3 py-2 border-b border-slate-200 shrink-0">
            <input
              autoFocus
              value={filterState.search}
              onChange={(e) => onUpdateFilter({ search: e.target.value })}
              placeholder="Search comments..."
              className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Comments for the whole website, grouped by page (current page first) */}
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const shown = listTab === 'active' ? openPins : listTab === 'resolved' ? resolvedPins : deletedPins;
            if (shown.length === 0) {
              return (
                <div className="m-3 bg-slate-50 border border-slate-200 rounded-lg p-5 text-center text-xs text-slate-500">
                  {listTab === 'active'
                    ? 'No open comments. Switch to Comment mode and click the page to add one.'
                    : listTab === 'resolved'
                      ? 'No resolved comments yet.'
                      : 'Nothing deleted. Deleted pins stay here so they can be restored.'}
                </div>
              );
            }
            const pageOrder = [currentPageId, ...pages.map((pg) => pg.id).filter((id) => id !== currentPageId)];
            return pageOrder
              .map((pageId) => ({ page: pages.find((pg) => pg.id === pageId), items: shown.filter((p) => p.assetId === pageId).sort((a, b) => a.number - b.number) }))
              .filter((group) => group.items.length > 0)
              .map(({ page, items }) => {
                const pageId = items[0].assetId;
                const collapsed = collapsedPages.has(pageId);
                const label = page ? page.url.replace(/^https?:\/\//, '') : 'Page';
                return (
                  <div key={pageId} className="border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedPages((prev) => {
                          const next = new Set(prev);
                          next.has(pageId) ? next.delete(pageId) : next.add(pageId);
                          return next;
                        })
                      }
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50"
                      title={page?.url}
                    >
                      <span className={`truncate flex-1 text-left ${pageId === currentPageId ? 'font-bold text-slate-900' : ''}`}>{label}</span>
                      <span className="shrink-0 text-slate-400">{items.length}</span>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                    </button>
                    {!collapsed && (
                      <div className="px-3 pb-3 space-y-2">
                        {items.map((pin) => (
                          <div
                            key={pin.id}
                            onClick={() => listTab !== 'deleted' && onSelectPin(pin)}
                            className={`border p-3 rounded-lg transition-all group ${listTab === 'deleted' ? 'cursor-default' : 'cursor-pointer'} ${
                              listTab === 'active'
                                ? 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1 min-w-0">
                              <span
                                className={`w-5 h-5 rounded-full text-white font-extrabold text-[10px] flex items-center justify-center shrink-0 ${pinColor(pin.category).bg} ${
                                  listTab === 'active' ? '' : 'opacity-60'
                                }`}
                              >
                                {pin.number}
                              </span>
                              <span className={`text-xs font-bold line-clamp-1 ${listTab === 'active' ? 'text-slate-900 group-hover:text-indigo-600' : 'text-slate-500 line-through'}`}>
                                {pin.title}
                              </span>
                            </div>
                            {listTab === 'active' && (
                              <div className="text-xs text-slate-600 line-clamp-2 pl-7">{pin.comments[0]?.text || ''}</div>
                            )}
                            <div className="mt-1.5 pl-7 flex items-center justify-between text-[10px] text-slate-500">
                              <span className="truncate">{pin.author.name}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                <DeviceLabel pin={pin} />
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {pin.comments.length}
                                </span>
                              </span>
                            </div>
                            {listTab === 'deleted' && (
                              <div className="mt-2 pl-7 flex items-center justify-between gap-2 text-[10px]">
                                <span className="text-slate-400 truncate">
                                  Deleted{pin.deletedBy?.name ? ` by ${pin.deletedBy.name}` : ''}{pin.deletedAt ? ` · ${new Date(pin.deletedAt).toLocaleDateString()}` : ''}
                                </span>
                                <span className="flex items-center gap-1 shrink-0">
                                  {onRestorePin && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRestorePin(pin.id);
                                      }}
                                      className="flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Restore
                                    </button>
                                  )}
                                  {onPurgePin && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Delete Pin #${pin.number} permanently? This can't be undone.`)) onPurgePin(pin.id);
                                      }}
                                      className="text-rose-600 hover:bg-rose-50 font-bold px-1.5 py-0.5 rounded"
                                    >
                                      Delete permanently
                                    </button>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
          })()}
        </div>
      </aside>
    );
  }

  // IF PIN IS SELECTED: Render rich discussion thread, technical metadata, and AI assistant tools
  return (
    <aside className="w-80 lg:w-96 min-w-[20rem] lg:min-w-[24rem] max-w-[20rem] lg:max-w-[24rem] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xs overflow-hidden animate-in slide-in-from-right duration-200 text-slate-900 z-10 relative">
      
      {/* Top Header: Pin #, Back Button, Status Changer */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
        <button
          onClick={() => onSelectPin(null)}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-2 py-1 rounded-md border border-slate-200 transition-colors shadow-xs whitespace-nowrap shrink-0"
          title="Back to all pins"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>All</span>
        </button>

        <div className="flex items-center gap-2">
          <span className={`min-w-5 h-5 px-1 rounded-full text-white font-extrabold text-[10px] flex items-center justify-center shadow-xs ${pinColor(selectedPin.category).bg}`}>
            #{selectedPin.number}
          </span>
          
          {/* Status (custom dropdown so long names like "Waiting on Customer" can wrap to two lines) */}
          <StatusPicker value={selectedPin.status} onChange={(status) => onUpdatePinStatus(selectedPin.id, status)} />

          {/* Delete Pin Button */}
          {onDeletePin && !isGuest && (() => {
            const isOwnerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Owner';
            const isPinCreator = selectedPin.author?.id === currentUser.id || selectedPin.author?.email === currentUser.email || selectedPin.author?.name === currentUser.name;
            const canDeletePin = isOwnerOrAdmin || isPinCreator;

            return (
              <button
                onClick={() => {
                  if (!canDeletePin) {
                    alert('Permission Denied: Members can only delete pins they created.');
                    return;
                  }
                  if (window.confirm(`Are you sure you want to delete Pin #${selectedPin.number}?`)) {
                    onDeletePin(selectedPin.id);
                  }
                }}
                className={`p-1.5 rounded-md border text-xs font-bold transition-colors shadow-xs flex items-center justify-center cursor-pointer ${
                  canDeletePin
                    ? 'bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border-slate-200 hover:border-red-200'
                    : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                }`}
                title={
                  canDeletePin
                    ? `Delete Pin #${selectedPin.number}`
                    : 'Members can only delete pins they created'
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            );
          })()}
          {onTogglePinned && (
            <button
              type="button"
              onClick={onTogglePinned}
              title={isPinned ? 'Unpin: float the sidebar over the page' : 'Pin: show the sidebar beside the page'}
              className={`p-1 rounded-md transition-colors hover:bg-slate-200 ${isPinned ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
            >
              {isPinned ? <PinIcon className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close sidebar"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Discussion & Metadata Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        
        {/* Pin Title & Attributes */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                {selectedPin.category}
              </span>
              <DeviceLabel pin={selectedPin} />
            </span>
            <span className={`text-xs capitalize ${getPriorityColor(selectedPin.priority)}`}>
              ⚡ {selectedPin.priority} Priority
            </span>
          </div>
          <h2 className="text-sm font-extrabold text-slate-900 leading-snug mt-1">
            {selectedPin.title}
          </h2>
        </div>

        {/* Pin Screenshot & Attachments Block */}
        {(selectedPin.screenshotUrl || (selectedPin.attachments && selectedPin.attachments.length > 0)) && (
          <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-800 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
              <span className="flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pin Screenshot & Files</span>
              </span>
              <span className="text-slate-400 text-[9px]">Click image to view</span>
            </div>

            {selectedPin.screenshotUrl && (
              <div 
                onClick={() => setPreviewImageUrl(selectedPin.screenshotUrl!)}
                className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-700 bg-slate-950"
              >
                <img 
                  src={selectedPin.screenshotUrl} 
                  alt="Pin Viewport Screenshot" 
                  className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-xs font-bold text-white">
                  <Maximize2 className="w-4 h-4 text-indigo-400" />
                  <span>View Full Screenshot</span>
                </div>
              </div>
            )}

            {selectedPin.attachments && selectedPin.attachments.length > 0 && (
              <div className="space-y-1 pt-1">
                {selectedPin.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between bg-slate-800 border border-slate-700 p-2 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {att.type === 'image' ? (
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="truncate font-semibold text-slate-200">{att.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({att.size})</span>
                    </div>

                    {att.type === 'image' ? (
                      <button
                        onClick={() => setPreviewImageUrl(att.url)}
                        className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded font-bold transition-colors shrink-0"
                      >
                        View Image
                      </button>
                    ) : (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded font-bold transition-colors shrink-0"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fix with AI on the connected WordPress site (team only) */}
        {!isGuest && wpFix && (
          <WpFixPanel
            projectId={wpFix.projectId}
            connected={wpFix.connected}
            onConnect={wpFix.onConnect}
            pin={selectedPin}
            isAdmin={wpFix.isAdmin}
            canAsk={wpFix.canAsk}
            canApply={wpFix.canApply}
            currentUserId={currentUser.id}
            onSiteChanged={wpFix.onSiteChanged}
            onPreviewCss={wpFix.onPreviewCss}
          />
        )}

        {/* Assignee (hidden for guests: they never see the team list) */}
        {!isGuest && (
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assignee</div>

          <SearchableMemberSelect
            selectedMember={selectedPin.assignedTo}
            teammates={teammates}
            onSelect={(tm) => {
              onUpdatePinAssignee(selectedPin.id, tm);
              showToast(`🔔 Assigned Pin #${selectedPin.number} to ${tm.name}. Notification sent!`);
              if (onNotify) {
                onNotify({
                  title: `Assigned Pin #${selectedPin.number}`,
                  message: `${currentUser.name} assigned Pin #${selectedPin.number} (${selectedPin.title}) to you.`,
                  recipient: tm.name,
                  pinId: selectedPin.id,
                  assetId: selectedPin.assetId,
                });
              }
            }}
            placeholder="Search team members..."
          />
        </div>
        )}

        {/* Less-used tools, collapsed by default to keep the sidebar simple (team only) */}
        {!isGuest && (
        <div className="border border-slate-200 rounded-lg">
          <button
            type="button"
            onClick={() => setShowMoreDetails((open) => !open)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
          >
            <span>More details</span>
            <span className="flex items-center gap-1 text-[10px] font-normal text-slate-400">
              QA rating, browser info, AI actions
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {showMoreDetails && (
            <div className="p-3 pt-1 space-y-4">
        {/* QA Error & Weightage Classifier Card */}
        <div className="bg-slate-900 text-white border border-slate-800 p-3 rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
            <span className="flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              <span>QA Error & Weightage Rating</span>
            </span>
            <span className="text-slate-400">Score Impact</span>
          </div>

          {selectedPin.qaError ? (
            <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                  selectedPin.qaError.source === 'internal_qa' 
                    ? 'bg-rose-900/80 text-rose-200 border border-rose-700' 
                    : 'bg-indigo-900/80 text-indigo-200 border border-indigo-700'
                }`}>
                  {selectedPin.qaError.source === 'internal_qa' ? '⚠️ Internal QA Error' : '✨ Client Requested Edit'}
                </span>

                {selectedPin.qaError.source === 'internal_qa' ? (
                  <span className="text-rose-400 font-extrabold text-xs">
                    -{selectedPin.qaError.weightage || 0} pts penalty
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold text-[10px]">
                    0% QA Penalty
                  </span>
                )}
              </div>

              <div className="font-bold text-white leading-snug">
                {selectedPin.qaError.ruleName || 'Custom Error'}
              </div>
              <div className="text-[10px] text-slate-400">
                Category: <strong className="text-slate-200">{selectedPin.qaError.category || 'General'}</strong>
              </div>

              <button
                onClick={() => {
                  if (onUpdatePinQAError) onUpdatePinQAError(selectedPin.id, undefined);
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 underline pt-1 block"
              >
                Remove QA Classification
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-300">
                Tag this issue with a QA Rubric Error (deducts QA score) or flag as Client Edit (0% penalty):
              </p>

              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val === 'client_edit') {
                    if (onUpdatePinQAError) {
                      onUpdatePinQAError(selectedPin.id, {
                        source: 'client_edit',
                        ruleName: 'Client Requested Modification',
                        category: 'Content',
                        weightage: 0
                      });
                    }
                  } else {
                    const rule = rubricRules.find(r => r.id === val);
                    if (rule && onUpdatePinQAError) {
                      onUpdatePinQAError(selectedPin.id, {
                        source: 'internal_qa',
                        rubricRuleId: rule.id,
                        category: rule.category,
                        ruleName: rule.ruleName,
                        weightage: rule.weightage
                      });
                    }
                  }
                }}
                defaultValue=""
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="" disabled>-- Tag QA Error Category & Weightage --</option>
                <option value="client_edit">✨ Client Requested Edit (0 Penalty)</option>
                {rubricRules.filter(r => r.isActive).map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    [{rule.category}] {rule.ruleName} (-{rule.weightage} pts)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Auto-Captured Technical Metadata Block */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 uppercase tracking-wider pb-1 border-b border-slate-200">
            <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Tech Environment</span>
            <span>Auto-Captured</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-800">
            <div>
              <span className="text-slate-500 block">Browser / OS:</span>
              <span className="font-semibold">{selectedPin.metadata.browser}</span>
              <span className="block text-slate-500 text-[10px]">{selectedPin.metadata.os}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Viewport Size:</span>
              <span className="font-mono font-semibold text-indigo-700">{selectedPin.metadata.viewport}</span>
            </div>
          </div>

          {selectedPin.metadata.selector && (
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]">
                {selectedPin.metadata.selector}
              </span>
              <button
                onClick={() => copyToClipboard(selectedPin.metadata.selector || '')}
                className="text-[10px] bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono flex items-center gap-1 shrink-0 shadow-xs"
              >
                {copiedSelector ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSelector ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* ✨ AI MAGIC ACTIONS TOOLBAR */}
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50/50 to-indigo-50/80 border border-indigo-200 rounded-lg p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Gemini AI Feedback Actions</span>
            </span>
            <span className="text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-800 font-mono">v3.6</span>
          </div>

          <div className={`grid gap-1.5 ${wpFix?.connected ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <button
              onClick={handleRunAiSummary}
              disabled={loadingAi !== null}
              className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 p-2 rounded-md text-[11px] font-semibold flex flex-col items-center gap-1 transition-all text-center disabled:opacity-50 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>{loadingAi === 'summary' ? 'Synthesizing...' : 'Summarize'}</span>
            </button>

            <button
              onClick={handleRunAiTicket}
              disabled={loadingAi !== null}
              className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 p-2 rounded-md text-[11px] font-semibold flex flex-col items-center gap-1 transition-all text-center disabled:opacity-50 shadow-xs"
            >
              <Code className="w-3.5 h-3.5 text-purple-600" />
              <span>{loadingAi === 'ticket' ? 'Converting...' : 'Dev Ticket'}</span>
            </button>

            {/* On WordPress projects "Fix with AI" above replaces this */}
            {!wpFix?.connected && (
            <button
              onClick={handleRunAiFix}
              disabled={loadingAi !== null}
              className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 p-2 rounded-md text-[11px] font-semibold flex flex-col items-center gap-1 transition-all text-center disabled:opacity-50 shadow-xs"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-600" />
              <span>{loadingAi === 'fix' ? 'Suggesting...' : 'Suggest Fix'}</span>
            </button>
            )}
          </div>

          {/* AI Output Panes */}
          {aiSummary && (
            <div className="bg-white border border-blue-200 rounded-md p-2.5 text-xs space-y-2 animate-in fade-in duration-150 shadow-xs">
              <div className="font-bold text-blue-700 flex items-center justify-between">
                <span>📋 Executive Summary</span>
                <button onClick={() => setAiSummary(null)} className="text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
              </div>
              <p className="text-slate-700 leading-relaxed text-[11px]">{aiSummary.summary}</p>
              <div className="font-semibold text-slate-900 text-[11px] pt-1">Next Steps:</div>
              <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                {aiSummary.actionItems?.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {aiTicket && (
            <div className="bg-white border border-purple-200 rounded-md p-2.5 text-xs space-y-2 animate-in fade-in duration-150 shadow-xs">
              <div className="flex items-center justify-between font-bold text-purple-700">
                <div className="flex items-center gap-1.5">
                  <span>🎟️ {aiTicket.ticketId}: {aiTicket.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => copyToClipboard(`## [${aiTicket.ticketId}] ${aiTicket.title}\n\n**Priority**: ${aiTicket.priority}\n**Effort**: ${aiTicket.estimatedEffort}\n\n${aiTicket.description}`)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 rounded text-[10px]"
                  >
                    Copy Markdown
                  </button>
                  <button onClick={() => setAiTicket(null)} className="text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2 rounded text-[11px] text-slate-800 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {aiTicket.description}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1">
                <span>Priority: <strong className="text-slate-900 uppercase">{aiTicket.priority}</strong></span>
                <span>Est: <strong className="text-slate-900">{aiTicket.estimatedEffort}</strong></span>
              </div>
            </div>
          )}

          {aiFix && (
            <div className="bg-white border border-emerald-200 rounded-md p-2.5 text-xs space-y-2 animate-in fade-in duration-150 shadow-xs">
              <div className="font-bold text-emerald-700 flex items-center justify-between">
                <span>💡 {aiFix.fixType === 'code_snippet' ? 'Recommended Tailwind / CSS Fix' : 'Copywriting Suggestion'}</span>
                <button onClick={() => setAiFix(null)} className="text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
              </div>
              <p className="text-slate-700 text-[11px]">{aiFix.explanation}</p>
              <div className="relative">
                <pre className="bg-slate-900 p-2.5 rounded text-[11px] text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap border border-slate-800">
                  {aiFix.codeOrCopy}
                </pre>
                <button
                  onClick={() => copyToClipboard(aiFix.codeOrCopy)}
                  className="absolute top-1.5 right-1.5 bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded text-[10px]"
                >
                  Copy
                </button>
              </div>
              {aiFix.additionalTip && (
                <div className="text-[10px] text-amber-700 font-medium italic pt-1 border-t border-slate-100">
                  ⚡ Pro Tip: {aiFix.additionalTip}
                </div>
              )}
            </div>
          )}
        </div>

            </div>
          )}
        </div>
        )}

        {/* Discussion Timeline */}
        <div className="space-y-3 pt-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Comments ({selectedPin.comments.length})</span>
          </div>

          <div className="space-y-2.5">
            {selectedPin.comments.map((cmt) => (
              <div
                key={cmt.id}
                className="bg-white border border-slate-200 p-2.5 rounded-lg space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <UserAvatar
                      name={cmt.author.name}
                      email={cmt.author.email}
                      avatar={cmt.author.avatar}
                      size={20}
                    />
                    <span className="text-xs font-bold text-slate-900 truncate">{cmt.author.name}</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium shrink-0">{cmt.author.role}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-500" title={fullTime(toMillis(cmt.createdAt, cmt.id))}>
                      {timeAgo(toMillis(cmt.createdAt, cmt.id), now)}
                    </span>
                    {onDeleteComment && (() => {
                      const isOwnerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Owner';
                      const isCommentCreator = cmt.author?.id === currentUser.id || cmt.author?.email === currentUser.email || cmt.author?.name === currentUser.name;
                      const canDeleteComment = isOwnerOrAdmin || isCommentCreator;

                      return (
                        <button
                          onClick={() => {
                            if (!canDeleteComment) {
                              alert('Permission Denied: Members can only delete comments they created.');
                              return;
                            }
                            if (window.confirm('Are you sure you want to delete this comment?')) {
                              onDeleteComment(selectedPin.id, cmt.id);
                            }
                          }}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            canDeleteComment
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-300 cursor-not-allowed'
                          }`}
                          title={
                            canDeleteComment
                              ? 'Delete comment'
                              : 'Members can only delete comments they created'
                          }
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed pl-7 whitespace-pre-wrap">
                  {renderFormattedCommentText(cmt.text)}
                </div>

                {/* Voice Note Simulation Playback */}
                {cmt.audioDuration && (
                  <div className="ml-7 bg-indigo-50 border border-indigo-200 rounded-md p-1.5 flex items-center gap-2 max-w-[220px]">
                    <button className="w-5 h-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center text-[10px] shadow-xs">
                      ▶
                    </button>
                    <div className="flex-1 h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                      <div className="w-1/3 h-full bg-indigo-600 animate-pulse" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-indigo-800">{cmt.audioDuration}</span>
                  </div>
                )}

                {/* Attachments */}
                {cmt.attachments && cmt.attachments.length > 0 && (
                  <div className="ml-7 pt-1.5 flex flex-wrap gap-2">
                    {cmt.attachments.map((att) => {
                      const isImage = att.type === 'image' || att.url.startsWith('data:image') || att.url.includes('.png') || att.url.includes('.jpg') || att.url.includes('.jpeg') || att.url.includes('.webp');
                      return (
                        <div key={att.id} className="inline-block">
                          {isImage ? (
                            <div 
                              onClick={() => setPreviewImageUrl(att.url)}
                              className="relative group cursor-pointer border border-slate-200 rounded-lg overflow-hidden bg-slate-100 max-w-[180px] shadow-xs"
                            >
                              <img src={att.url} alt={att.name} className="w-full h-24 object-cover" />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold gap-1">
                                <Maximize2 className="w-3.5 h-3.5 text-indigo-300" />
                                <span>Expand</span>
                              </div>
                              <div className="p-1 bg-white border-t border-slate-100 text-[9px] font-medium text-slate-700 truncate">
                                📸 {att.name}
                              </div>
                            </div>
                          ) : (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-[11px] text-indigo-600 hover:text-indigo-800 transition-colors font-medium shadow-2xs"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[130px]">{att.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">({att.size})</span>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reactions */}
                {cmt.reactions && (
                  <div className="ml-7 flex flex-wrap gap-1 pt-1">
                    {Object.entries(cmt.reactions).map(([emoji, users]) => {
                      const userList = users as string[];
                      return (
                        <span
                          key={emoji}
                          title={`Reacted by: ${userList.join(', ')}`}
                          className="bg-slate-50 border border-slate-200 text-[11px] px-2 py-0.5 rounded-full text-slate-700 flex items-center gap-1 font-medium"
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] text-slate-500 font-bold">{userList.length}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Notification Toast Alert Banner */}
      {toastMessage && (
        <div className="mx-3 my-2 p-2.5 bg-indigo-900 text-white text-xs font-semibold rounded-lg shadow-lg flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-300 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Comment Composer Input */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2 relative">
        {/* Floating @Mention Autocomplete Menu */}
        {showMentionMenu && (
          <div className="absolute left-3 right-3 bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="p-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-[10px] font-bold text-indigo-900">
              <span className="flex items-center gap-1">
                <AtSign className="w-3 h-3 text-indigo-600" />
                <span>Mention Teammate (Notifies via email & in-app push)</span>
              </span>
              <button onClick={() => setShowMentionMenu(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-3 h-3" />
              </button>
            </div>
            
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 p-1">
              {teammates
                .filter(t => t.name.toLowerCase().includes(mentionQuery) || t.role.toLowerCase().includes(mentionQuery))
                .slice(0, 6)
                .map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => handleSelectMentionTeammate(tm)}
                    className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={tm.avatar} alt={tm.name} className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">@{tm.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{tm.email}</div>
                      </div>
                    </div>
                    <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                      {tm.role}
                    </span>
                  </button>
                ))}

              {teammates.filter(t => t.name.toLowerCase().includes(mentionQuery)).length === 0 && (
                <div className="p-3 text-center text-xs text-slate-500">
                  No matching teammate found for "{mentionQuery}"
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSendComment} className="space-y-2">
          <input
            ref={commentFileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUploadForComment}
          />

          {/* Comment Attachments Preview Chips */}
          {commentAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-lg max-h-28 overflow-y-auto">
              {commentAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 bg-white border border-indigo-200 px-2 py-1 rounded text-xs text-indigo-950 font-medium shadow-2xs"
                >
                  <Paperclip className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <span className="text-[9px] text-slate-400 font-mono">({att.size})</span>
                  <button
                    type="button"
                    onClick={() => setCommentAttachments(prev => prev.filter(a => a.id !== att.id))}
                    className="text-slate-400 hover:text-red-600 p-0.5 ml-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              rows={2}
              placeholder="Reply to discussion... (@mention teammates, attach screenshots/files)"
              value={commentInput}
              onChange={(e) => handleCommentInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment(e);
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-28 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 resize-none shadow-xs"
            />
            
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => commentFileInputRef.current?.click()}
                title="Attach file or screenshot"
                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>

              
              <button
                type="submit"
                disabled={!commentInput.trim() && commentAttachments.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-1.5 rounded-md shadow-xs transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Lightbox Image Preview Modal */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute -top-12 right-0 text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors shadow-lg cursor-pointer flex items-center gap-1 text-xs font-bold px-3"
            >
              <X className="w-4 h-4" />
              <span>Close Preview</span>
            </button>
            <img 
              src={previewImageUrl} 
              alt="Screenshot / Attachment Full Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-700" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </aside>
  );
};
