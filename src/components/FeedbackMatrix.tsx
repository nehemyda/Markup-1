import React, { useState } from 'react';
import { Pin, PinStatus, Teammate, Project, Asset } from '../types';
import { 
  TableProperties, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  ArrowUpDown, 
  CheckSquare, 
  Square, 
  Trash2, 
  Check, 
  Bug, 
  Palette, 
  FileText, 
  HelpCircle,
  MessageSquare
} from 'lucide-react';

interface FeedbackMatrixProps {
  pins: Pin[];
  currentProject: Project;
  onUpdatePinStatus: (pinId: string, newStatus: PinStatus) => void;
  onSelectPin: (pin: Pin) => void;
  teammates: Teammate[];
  onSwitchToStudio: (asset: Asset) => void;
}

export const FeedbackMatrix: React.FC<FeedbackMatrixProps> = ({
  pins,
  currentProject,
  onUpdatePinStatus,
  onSelectPin,
  teammates,
  onSwitchToStudio,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'number' | 'priority' | 'status' | 'category' | 'createdAt'>('number');
  const [sortAsc, setSortAsc] = useState(true);

  const projectPins = pins.filter((p) => {
    const isProjectAsset = currentProject.assets.some(a => a.id === p.assetId);
    if (!isProjectAsset) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.metadata.browser.toLowerCase().includes(q);
    }
    return true;
  });

  // Sort
  const sortedPins = [...projectPins].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (sortField === 'priority') {
      const order = { high: 3, medium: 2, low: 1 };
      valA = order[a.priority] || 0;
      valB = order[b.priority] || 0;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleToggleSelectAll = () => {
    if (selectedIds.length === sortedPins.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedPins.map(p => p.id));
    }
  };

  const handleToggleRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBatchStatus = (status: PinStatus) => {
    selectedIds.forEach(id => {
      onUpdatePinStatus(id, status);
    });
    setSelectedIds([]);
  };

  const exportToCSV = () => {
    const headers = ['Pin Number', 'Title', 'Category', 'Status', 'Priority', 'Assignee', 'Browser', 'OS', 'Created At'];
    const rows = sortedPins.map(p => [
      `#${p.number}`,
      `"${p.title.replace(/"/g, '""')}"`,
      p.category,
      p.status,
      p.priority,
      `"${p.assignedTo?.name || 'Unassigned'}"`,
      `"${p.metadata.browser}"`,
      `"${p.metadata.os}"`,
      `"${p.createdAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentProject.name.toLowerCase().replace(/\s+/g, '_')}_feedback_matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: PinStatus) => {
    switch (status) {
      case 'open': return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Open</span>;
      case 'in_progress': return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold">In Progress</span>;
      case 'ready_for_review': return <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold">In Review</span>;
      case 'resolved': return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Resolved</span>;
      case 'archived': return <span className="bg-slate-500/20 text-slate-300 border border-slate-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold">Archived</span>;
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

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50 overflow-hidden text-slate-900">
      
      {/* Top Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <TableProperties className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Project Feedback Matrix & Spreadsheet</span>
            <span className="text-[10px] bg-slate-100 border border-slate-300 text-slate-700 px-2 py-0.5 rounded-full font-bold font-mono shrink-0">
              {sortedPins.length} items
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Spreadsheet-style list view with bulk status updates, technical browser inspection, and CSV export.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search table..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 w-44 sm:w-52 shadow-xs"
            />
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 px-3 py-1 rounded-md border border-slate-300 text-xs font-semibold transition-all shadow-xs active:scale-95 shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Batch Actions Bar (when rows selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center justify-between text-xs text-indigo-900 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-mono">
              {selectedIds.length}
            </span>
            <span>Items Selected</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-indigo-950 font-semibold">Batch Update Status:</span>
            <button
              onClick={() => handleBatchStatus('in_progress')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2.5 py-1 rounded-md shadow-xs transition-colors"
            >
              Set In Progress
            </button>
            <button
              onClick={() => handleBatchStatus('resolved')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1 rounded-md shadow-xs transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Mark Resolved
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-indigo-600 hover:text-indigo-900 font-medium px-2 py-1"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs custom-scrollbar">
          <table className="w-full min-w-[960px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                <th className="p-2.5 w-10 text-center whitespace-nowrap">
                  <button onClick={handleToggleSelectAll} className="p-1 hover:text-slate-900">
                    {selectedIds.length === sortedPins.length && sortedPins.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th 
                  onClick={() => { setSortField('number'); setSortAsc(!sortAsc); }}
                  className="p-2.5 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>Pin #</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-2.5 whitespace-nowrap min-w-[240px]">Title & Discussion Excerpt</th>
                <th 
                  onClick={() => { setSortField('category'); setSortAsc(!sortAsc); }}
                  className="p-2.5 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Category
                </th>
                <th 
                  onClick={() => { setSortField('status'); setSortAsc(!sortAsc); }}
                  className="p-2.5 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Status
                </th>
                <th 
                  onClick={() => { setSortField('priority'); setSortAsc(!sortAsc); }}
                  className="p-2.5 cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Priority
                </th>
                <th className="p-2.5 whitespace-nowrap">Assignee</th>
                <th className="p-2.5 whitespace-nowrap">Technical Environment</th>
                <th className="p-2.5 whitespace-nowrap">Asset / Web Page</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {sortedPins.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 font-medium">
                    No feedback items found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedPins.map((pin) => {
                  const isSelected = selectedIds.includes(pin.id);
                  const asset = currentProject.assets.find(a => a.id === pin.assetId) || currentProject.assets[0];

                  return (
                    <tr
                      key={pin.id}
                      onClick={() => onSelectPin(pin)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/70' : ''
                      }`}
                    >
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleToggleRow(pin.id)} className="p-1">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      </td>

                      <td className="p-2.5 font-bold text-slate-900">
                        <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 inline-flex items-center justify-center border border-indigo-200 text-[10px] font-mono font-extrabold">
                          #{pin.number}
                        </span>
                      </td>

                      <td className="p-2.5 max-w-md">
                        <div className="font-extrabold text-slate-900 truncate">{pin.title}</div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {pin.comments[0]?.text || 'No comments yet'}
                        </div>
                      </td>

                      <td className="p-2.5">
                        <span className="uppercase font-bold tracking-wider text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-300">
                          {pin.category}
                        </span>
                      </td>

                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={pin.status}
                          onChange={(e) => onUpdatePinStatus(pin.id, e.target.value as PinStatus)}
                          className="bg-white border border-slate-300 text-slate-900 text-xs font-bold px-2 py-1 rounded-md focus:outline-none capitalize shadow-xs"
                        >
                          <option value="open">🔴 Open</option>
                          <option value="in_progress">🟡 In Progress</option>
                          <option value="ready_for_review">🟣 In Review</option>
                          <option value="resolved">🟢 Resolved</option>
                          <option value="archived">⚪ Archived</option>
                        </select>
                      </td>

                      <td className="p-2.5 capitalize">
                        <span className={getPriorityColor(pin.priority)}>
                          {pin.priority}
                        </span>
                      </td>

                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <img 
                            src={pin.assignedTo?.avatar || teammates[0]?.avatar} 
                            alt="Assignee" 
                            className="w-4.5 h-4.5 rounded-full object-cover border border-slate-200" 
                          />
                          <span className="truncate max-w-[100px] font-semibold text-slate-800">{pin.assignedTo?.name.split(' ')[0]}</span>
                        </div>
                      </td>

                      <td className="p-2.5 text-[11px] text-slate-600">
                        <div className="font-bold text-slate-900 truncate max-w-[150px]">{pin.metadata.browser}</div>
                        <div className="text-[10px] text-slate-500 truncate">{pin.metadata.viewport}</div>
                      </td>

                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSwitchToStudio(asset)}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 font-semibold shadow-xs"
                          title="Open in Live Canvas Studio"
                        >
                          <span className="truncate max-w-[120px]">{asset?.title || 'Web Page'}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
