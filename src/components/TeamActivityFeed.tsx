import React, { useState } from 'react';
import { ActivityItem, Teammate, Project } from '../types';
import { 
  Activity, 
  MessageSquare, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Users, 
  UserPlus, 
  Send, 
  Filter, 
  ShieldCheck, 
  Sparkles, 
  Mail, 
  Globe,
  Award
} from 'lucide-react';

interface TeamActivityFeedProps {
  activityLogs: ActivityItem[];
  teammates: Teammate[];
  currentProject: Project;
  onInviteTeammate: (name: string, email: string, role: Teammate['role']) => void;
}

export const TeamActivityFeed: React.FC<TeamActivityFeedProps> = ({
  activityLogs,
  teammates,
  currentProject,
  onInviteTeammate,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Teammate['role']>('Designer');

  const filteredLogs = activityLogs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    return true;
  });

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    onInviteTeammate(inviteName.trim(), inviteEmail.trim(), inviteRole);
    setInviteName('');
    setInviteEmail('');
    setShowInviteModal(false);
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'status': return <Clock className="w-4 h-4 text-amber-400" />;
      case 'pin': return <MapPin className="w-4 h-4 text-purple-400" />;
      case 'approval': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50 overflow-hidden text-slate-900">
      
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>Team Activity Feed & Collaboration Audit</span>
            <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              {currentProject.name}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Real-time audit log tracking every annotation pin, comment thread, status transition, and approval across your team.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Invite Teammate</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Content Area */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Activity Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-lg text-xs shadow-xs">
              <span className="font-extrabold text-slate-700">Filter Timeline By Event Type:</span>
              <div className="flex items-center gap-1">
                {(['all', 'comment', 'status', 'pin', 'approval'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2 py-1 rounded-md font-semibold capitalize transition-colors text-[11px] ${
                      filterType === t ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {t === 'all' ? 'All Events' : t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
              {filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-xs font-medium">
                  No activity events found.
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="relative pl-14 group">
                    {/* Timeline Circle Icon */}
                    <div className="absolute left-3 top-3 -translate-x-1/2 w-7 h-7 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-xs group-hover:border-indigo-600 transition-colors">
                      {getLogIcon(log.type)}
                    </div>

                    <div className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 p-3.5 rounded-xl shadow-xs transition-all">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <img src={log.author.avatar} alt={log.author.name} className="w-5.5 h-5.5 rounded-full object-cover border border-slate-200" />
                          <span className="text-xs font-extrabold text-slate-900">{log.author.name}</span>
                          <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-slate-700 font-semibold">{log.author.role}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 font-medium">{log.timestamp}</span>
                      </div>

                      <div className="text-xs text-slate-800 mt-1">
                        <span className="text-slate-600 font-medium">{log.action}</span>{' '}
                        <strong className="text-indigo-600 font-extrabold">{log.targetName}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Col: Team Roster & Collaborators */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Project Team Roster ({teammates.length})</span>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                  {teammates.filter(t => t.status === 'online').length} Online Now
                </span>
              </div>

              <div className="space-y-2">
                {teammates.map((tm) => (
                  <div key={tm.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img src={tm.avatar} alt={tm.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          tm.status === 'online' ? 'bg-emerald-500' : tm.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate flex items-center gap-1">
                          <span>{tm.name}</span>
                          {tm.role === 'Owner' && <Award className="w-3 h-3 text-amber-500 shrink-0" title="Project Owner" />}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{tm.email}</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-bold">
                        {tm.role}
                      </span>
                      <div className="flex items-center gap-1">
                        <span style={{ backgroundColor: tm.cursorColor }} className="w-2 h-2 rounded-full" />
                        <span className="text-[9px] text-slate-500 uppercase font-mono font-medium">Cursor</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold py-1.5 rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member To Project</span>
                </button>
              </div>
            </div>

            {/* Security / Compliance Info Card */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-slate-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Enterprise Security & Access</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                All collaborative sessions use end-to-end TLS encryption with strict workspace role-based access controls (RBAC) and SOC2 Type II compliance logging.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-1.5 font-extrabold text-sm text-slate-900">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Invite Teammate to Workspace</span>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3.5 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Teammate Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Lee"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="jordan@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-600 shadow-xs"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Role in Project</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 focus:outline-none shadow-xs font-semibold"
                >
                  <option value="Designer">🎨 Designer</option>
                  <option value="Developer">💻 Developer</option>
                  <option value="Product Manager">📊 Product Manager</option>
                  <option value="Client">🤝 Client Representative</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-1.5 rounded-md font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-1.5 rounded-md shadow-xs transition-all"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
