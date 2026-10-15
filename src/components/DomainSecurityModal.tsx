import React, { useState, useEffect } from 'react';
import { ShieldCheck, Globe, Plus, Trash2, Edit3, Check, X, AlertCircle, RefreshCw, Users, KeyRound } from 'lucide-react';
import { getAllowedDomains, saveAllowedDomains, DEFAULT_ALLOWED_DOMAINS } from '../utils/domains';
import { Organization, Teammate } from '../types';

interface DomainSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrganization?: Organization;
  teammates?: Teammate[];
  onDomainsUpdated?: (newDomains: string[]) => void;
}

export const DomainSecurityModal: React.FC<DomainSecurityModalProps> = ({
  isOpen,
  onClose,
  currentOrganization,
  teammates = [],
  onDomainsUpdated
}) => {
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDomains(getAllowedDomains());
      setErrorMsg(null);
      setSuccessMsg(null);
      setEditingIndex(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleaned = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!cleaned) {
      setErrorMsg('Please enter a valid domain (e.g., broadly.com or @vendasta.com)');
      return;
    }

    if (!cleaned.includes('.')) {
      setErrorMsg('Domain must contain a valid TLD extension (e.g., .com, .io, .org)');
      return;
    }

    if (domains.includes(cleaned)) {
      setErrorMsg(`Domain @${cleaned} is already authorized.`);
      return;
    }

    const updated = [...domains, cleaned];
    setDomains(updated);
    saveAllowedDomains(updated);
    setNewDomain('');
    setSuccessMsg(`Successfully added authorized domain: @${cleaned}`);
    if (onDomainsUpdated) onDomainsUpdated(updated);
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    if (domains.length <= 1) {
      setErrorMsg('You must maintain at least one authorized organization domain.');
      return;
    }
    const updated = domains.filter(d => d !== domainToRemove);
    setDomains(updated);
    saveAllowedDomains(updated);
    setSuccessMsg(`Removed domain: @${domainToRemove}`);
    if (onDomainsUpdated) onDomainsUpdated(updated);
  };

  const handleStartEdit = (index: number, val: string) => {
    setEditingIndex(index);
    setEditingValue(val);
    setErrorMsg(null);
  };

  const handleSaveEdit = (index: number) => {
    const cleaned = editingValue.trim().toLowerCase().replace(/^@/, '');
    if (!cleaned || !cleaned.includes('.')) {
      setErrorMsg('Invalid domain format.');
      return;
    }

    const updated = [...domains];
    updated[index] = cleaned;
    setDomains(updated);
    saveAllowedDomains(updated);
    setEditingIndex(null);
    setSuccessMsg(`Updated domain to: @${cleaned}`);
    if (onDomainsUpdated) onDomainsUpdated(updated);
  };

  const handleResetDefaults = () => {
    const defaultList = [...DEFAULT_ALLOWED_DOMAINS];
    setDomains(defaultList);
    saveAllowedDomains(defaultList);
    setSuccessMsg('Reset authorized domain list to standard defaults (@yourdigitalagents.com, @broadly.com, @vendasta.com).');
    if (onDomainsUpdated) onDomainsUpdated(defaultList);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Access Control: Allowed Domains</span>
                <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase rounded-full tracking-wider">
                  Super Admin
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage hardcoded email domains authorized for instant login & workspace collaboration.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          
          {/* Info Banner */}
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              <span>How Automatic Domain Authentication Works</span>
            </div>
            <p>
              Users logging in with any email matching an authorized domain below (e.g., <code className="text-white bg-indigo-950/80 px-1.5 py-0.5 rounded">@yourdigitalagents.com</code>, <code className="text-white bg-indigo-950/80 px-1.5 py-0.5 rounded">@broadly.com</code>, <code className="text-white bg-indigo-950/80 px-1.5 py-0.5 rounded">@vendasta.com</code>) are automatically authenticated without needing separate account registration.
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add New Domain Form */}
          <form onSubmit={handleAddDomain} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Add New Authorized Email Domain
            </label>
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Globe className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                <span className="absolute left-9 top-2 text-sm font-mono text-slate-400">@</span>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. acme-agency.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-13 pr-4 py-2 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Domain</span>
              </button>
            </div>
          </form>

          {/* Authorized Domains List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Active Authorized Domains ({domains.length})</span>
              </h3>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset to Standard Defaults</span>
              </button>
            </div>

            <div className="border border-slate-700/80 rounded-xl divide-y divide-slate-700/60 bg-slate-900/60 overflow-hidden">
              {domains.map((domain, idx) => {
                const isEditing = editingIndex === idx;
                const activeCount = teammates.filter(t => t.email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)).length;

                return (
                  <div key={`${domain}-${idx}`} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 shrink-0 font-mono text-xs font-bold">
                        @
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="bg-slate-950 border border-indigo-500 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none flex-1"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(idx)}
                            className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                            title="Save changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-white tracking-wide truncate">
                              @{domain}
                            </span>
                            {domain.includes('yourdigitalagen') && (
                              <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold rounded-full shrink-0">
                                Primary Owner
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Users className="w-3 h-3 text-emerald-400" />
                              <span>{activeCount > 0 ? `${activeCount} active seat(s)` : 'Ready for auto-login'}</span>
                            </span>
                            <span>•</span>
                            <span className="text-emerald-400 font-medium">SSO & SAML Enabled</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(idx, domain)}
                          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="Edit domain"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDomain(domain)}
                          className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            Save & Close Access Control
          </button>
        </div>

      </div>
    </div>
  );
};
