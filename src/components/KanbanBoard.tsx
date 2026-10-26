import React, { useState } from 'react';
import { pinColor } from '../lib/pins';
import { Pin, PinStatus, Teammate, Project, Asset } from '../types';
import { UserAvatar } from './UserAvatar';
import { 
  Kanban as KanbanIcon, 
  MessageSquare, 
  Search, 
  ArrowRight, 
  ArrowLeft, 
  ExternalLink,
  GripVertical
} from 'lucide-react';

interface KanbanBoardProps {
  pins: Pin[];
  currentProject: Project;
  currentAsset: Asset;
  onUpdatePinStatus: (pinId: string, newStatus: PinStatus) => void;
  onSelectPin: (pin: Pin) => void;
  teammates: Teammate[];
  onSwitchToStudio: (asset: Asset) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  pins,
  currentProject,
  currentAsset,
  onUpdatePinStatus,
  onSelectPin,
  teammates,
  onSwitchToStudio,
}) => {
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [draggedPinId, setDraggedPinId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const columns: { id: PinStatus; label: string; headerStyle: string; badgeStyle: string; icon: React.ReactNode }[] = [
    { 
      id: 'open', 
      label: 'To Do / Open', 
      headerStyle: 'bg-rose-100/90 text-rose-950 border-rose-200', 
      badgeStyle: 'bg-rose-900 text-white font-extrabold',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shadow-xs" /> 
    },
    { 
      id: 'in_progress', 
      label: 'In Progress', 
      headerStyle: 'bg-amber-100/90 text-amber-950 border-amber-200', 
      badgeStyle: 'bg-amber-900 text-white font-extrabold',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shadow-xs" /> 
    },
    { 
      id: 'waiting_on_customer', 
      label: 'Waiting on Customer', 
      headerStyle: 'bg-sky-100/90 text-sky-950 border-sky-200', 
      badgeStyle: 'bg-sky-900 text-white font-extrabold',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-sky-600 shadow-xs" /> 
    },
    { 
      id: 'ready_for_review', 
      label: 'Ready for Review', 
      headerStyle: 'bg-purple-100/90 text-purple-950 border-purple-200', 
      badgeStyle: 'bg-purple-900 text-white font-extrabold',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-xs" /> 
    },
    { 
      id: 'resolved', 
      label: 'Resolved / Done', 
      headerStyle: 'bg-emerald-100/90 text-emerald-950 border-emerald-200', 
      badgeStyle: 'bg-emerald-900 text-white font-extrabold',
      icon: <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-xs" /> 
    },
  ];

  // Filter project pins
  const projectPins = pins.filter((p) => {
    const isProjectAsset = currentProject.assets.some(a => a.id === p.assetId);
    if (!isProjectAsset) return false;

    if (filterPriority !== 'all' && p.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && p.assignedTo?.id !== filterAssignee) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.comments.some(c => c.text.toLowerCase().includes(q));
    }
    return true;
  });

  const totalPins = projectPins.length;
  const resolvedCount = projectPins.filter(p => p.status === 'resolved' || p.status === 'archived').length;
  const progressPercent = totalPins > 0 ? Math.round((resolvedCount / totalPins) * 100) : 100;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded text-[10px] font-extrabold">🔴 High</span>;
      case 'medium': return <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">🟡 Medium</span>;
      case 'low': return <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">🟢 Low</span>;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'bug': return 'text-rose-700 bg-rose-50 border-rose-200 font-bold';
      case 'design': return 'text-purple-700 bg-purple-50 border-purple-200 font-bold';
      case 'content': return 'text-blue-700 bg-blue-50 border-blue-200 font-bold';
      case 'question': return 'text-amber-800 bg-amber-50 border-amber-200 font-bold';
      case 'approved': return 'text-emerald-700 bg-emerald-50 border-emerald-200 font-bold';
      default: return 'text-slate-700 bg-slate-100 border-slate-200 font-bold';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50 overflow-hidden text-slate-900">
      
      {/* Top Project Stats & Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
            <KanbanIcon className="w-4 h-4 text-indigo-600" />
            <span>Interactive Kanban Board</span>
            <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded-full font-extrabold">
              {currentProject.name}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Drag cards between columns or use the move buttons to update task progression across team review workflow.
          </p>
        </div>

        {/* Progress bar and metrics */}
        <div className="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Completion Progress</div>
            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>{progressPercent}%</span>
              <span className="text-[11px] font-medium text-slate-500">({resolvedCount}/{totalPins} completed)</span>
            </div>
          </div>
          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div style={{ width: `${progressPercent}%` }} className="h-full bg-gradient-to-r from-blue-600 to-emerald-600 transition-all duration-500" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 w-40 shadow-xs"
            />
          </div>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none shadow-xs font-semibold"
          >
            <option value="all">⚡ All Priorities</option>
            <option value="high">🔴 High Priority</option>
            <option value="medium">🟡 Medium Priority</option>
            <option value="low">🟢 Low Priority</option>
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none shadow-xs font-semibold"
          >
            <option value="all">👤 All Assignees</option>
            {teammates.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board Columns Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 h-full min-w-[1350px]">
          {columns.map((col) => {
            const colPins = projectPins.filter(p => p.status === col.id);
            const isDragTarget = dragOverColId === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColId !== col.id) {
                    setDragOverColId(col.id);
                  }
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  if (dragOverColId === col.id) {
                    setDragOverColId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverColId(null);
                  const pinId = e.dataTransfer.getData('text/plain') || draggedPinId;
                  if (pinId) {
                    onUpdatePinStatus(pinId, col.id);
                  }
                  setDraggedPinId(null);
                }}
                className={`flex-1 flex flex-col bg-slate-100 border rounded-xl overflow-hidden h-full max-h-full shadow-xs transition-all duration-150 ${
                  isDragTarget 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/50' 
                    : 'border-slate-200'
                }`}
              >
                {/* Column Header - High Contrast and Clear Readable Text */}
                <div className={`px-3.5 py-3 border-b flex items-center justify-between font-extrabold text-xs shadow-2xs ${col.headerStyle}`}>
                  <div className="flex items-center gap-2 text-slate-950 font-black">
                    {col.icon}
                    <span className="tracking-tight text-sm">{col.label}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs shadow-xs ${col.badgeStyle}`}>
                    {colPins.length}
                  </span>
                </div>

                {/* Column Card List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colPins.length === 0 ? (
                    <div className={`h-32 flex flex-col items-center justify-center text-center text-xs text-slate-400 border-2 border-dashed rounded-xl p-4 font-semibold transition-colors ${
                      isDragTarget ? 'border-indigo-400 bg-indigo-100/50 text-indigo-700' : 'border-slate-300 bg-white/40'
                    }`}>
                      <span>{isDragTarget ? '🎯 Drop card here' : 'Drag or add tasks here'}</span>
                    </div>
                  ) : (
                    colPins.map((pin) => {
                      const asset = currentProject.assets.find(a => a.id === pin.assetId) || currentAsset;
                      const isBeingDragged = draggedPinId === pin.id;

                      return (
                        <div
                          key={pin.id}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', pin.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedPinId(pin.id);
                          }}
                          onDragEnd={() => {
                            setDraggedPinId(null);
                            setDragOverColId(null);
                          }}
                          onClick={() => onSelectPin(pin)}
                          className={`bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 p-3.5 rounded-xl shadow-xs cursor-grab active:cursor-grabbing transition-all group relative ${
                            isBeingDragged ? 'opacity-40 scale-95 border-indigo-400' : 'hover:shadow-md'
                          }`}
                        >
                          {/* Drag handle & Top row */}
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <div className="flex items-center gap-1.5">
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                              <span className={`min-w-5 h-5 px-1 rounded-full text-white font-black text-[10px] flex items-center justify-center shadow-xs shrink-0 ${pinColor(pin.category).bg}`}>
                                #{pin.number}
                              </span>
                              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryColor(pin.category)}`}>
                                {pin.category}
                              </span>
                            </div>
                            {getPriorityBadge(pin.priority)}
                          </div>

                          {/* Task Title */}
                          <div className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                            {pin.title}
                          </div>

                          {/* Excerpt comment */}
                          {pin.comments[0] && (
                            <div className="text-[11px] text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded-md border border-slate-200/80 mb-2.5 font-normal italic">
                              "{pin.comments[0].text}"
                            </div>
                          )}

                          {/* Asset link badge */}
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              onSwitchToStudio(asset);
                            }}
                            className="text-[10px] text-slate-700 hover:text-indigo-600 flex items-center gap-1 mb-2.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 w-fit font-bold cursor-pointer"
                            title="Click to jump to this live webpage annotation"
                          >
                            <span>🌐 {asset.title}</span>
                            <ExternalLink className="w-3 h-3 text-indigo-500" />
                          </div>

                          {/* Bottom Row: Assignee & Comment Count */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <UserAvatar
                                name={pin.assignedTo?.name || 'Assignee'}
                                email={pin.assignedTo?.email}
                                avatar={pin.assignedTo?.avatar || teammates[0]?.avatar}
                                size={18}
                              />
                              <span className="text-slate-800 font-bold truncate max-w-[90px]">{pin.assignedTo?.name.split(' ')[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-slate-700 font-bold">
                                <MessageSquare className="w-3 h-3 text-indigo-600" />
                                <span>{pin.comments.length}</span>
                              </span>
                            </div>
                          </div>

                          {/* Quick Column Move Buttons (Hover / Touch) */}
                          <div 
                            className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-slate-900 text-white p-1 rounded-lg shadow-lg z-20" 
                            onClick={(e) => e.stopPropagation()}
                          >
                            {col.id !== 'open' && (
                              <button
                                onClick={() => {
                                  const prev: Record<string, PinStatus> = { in_progress: 'open', waiting_on_customer: 'in_progress', ready_for_review: 'waiting_on_customer', resolved: 'ready_for_review' };
                                  onUpdatePinStatus(pin.id, prev[col.id] || 'open');
                                }}
                                title="Move to previous column"
                                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}
                            <select
                              value={pin.status}
                              onChange={(e) => onUpdatePinStatus(pin.id, e.target.value as PinStatus)}
                              className="bg-slate-800 text-white text-[10px] font-bold px-1 py-0.5 rounded border border-slate-700 focus:outline-none cursor-pointer"
                            >
                              <option value="open">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="waiting_on_customer">Waiting</option>
                              <option value="ready_for_review">Review</option>
                              <option value="resolved">Resolved</option>
                            </select>
                            {col.id !== 'resolved' && (
                              <button
                                onClick={() => {
                                  const next: Record<string, PinStatus> = { open: 'in_progress', in_progress: 'waiting_on_customer', waiting_on_customer: 'ready_for_review', ready_for_review: 'resolved' };
                                  onUpdatePinStatus(pin.id, next[col.id] || 'resolved');
                                }}
                                title="Move to next column"
                                className="p-1 hover:bg-slate-700 rounded cursor-pointer"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
