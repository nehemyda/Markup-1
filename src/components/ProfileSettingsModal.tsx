import React, { useState, useEffect, useRef } from 'react';
import { UserAvatar } from './UserAvatar';
import { getGoogleWorkspaceAvatarUrl } from '../utils/avatar';
import { 
  X, 
  User, 
  Mail, 
  Briefcase, 
  Building2, 
  Bell, 
  Check, 
  Camera, 
  Upload,
  Globe,
  Sparkles, 
  ShieldCheck,
  Save
} from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: string;
    status?: 'online' | 'offline' | 'busy';
    department?: string;
  };
  onSaveProfile: (updated: {
    name: string;
    email: string;
    role: string;
    department: string;
    avatar: string;
    status: 'online' | 'offline' | 'busy';
  }) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile
}) => {
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [role, setRole] = useState(currentUser.role || 'Member');
  const [department, setDepartment] = useState(currentUser.department || 'Product & Design');
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [status, setStatus] = useState<'online' | 'offline' | 'busy'>(currentUser.status || 'online');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showCustomAvatarInput, setShowCustomAvatarInput] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyMention, setNotifyMention] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setRole(currentUser.role || 'Member');
      setDepartment(currentUser.department || 'Product & Design');
      setAvatar(currentUser.avatar || PRESET_AVATARS[0]);
      setStatus(currentUser.status || 'online');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please select a smaller image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    onSaveProfile({
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      department: department.trim(),
      avatar: avatar,
      status: status
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  const handleApplyCustomAvatar = () => {
    if (customAvatarUrl.trim()) {
      setAvatar(customAvatarUrl.trim());
      setShowCustomAvatarInput(false);
      setCustomAvatarUrl('');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">Profile & Account Settings</h2>
              <p className="text-[11px] text-slate-400">Manage your personal info, role, avatar, and preferences</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800">
          
          {/* Avatar & Online Status Selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Profile Photo & Status
            </div>

            <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative shrink-0 group cursor-pointer"
                title="Click to upload profile photo from computer"
              >
                <UserAvatar
                  name={name || 'User'}
                  email={email}
                  avatar={avatar}
                  status={status}
                  size="xl"
                  showOnlineStatus
                />
                <div className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                  <span className="text-[9px] font-bold mt-0.5">Upload</span>
                </div>
              </div>

              <div className="space-y-2.5 flex-1 w-full">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Online Status:</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                    >
                      <option value="online">🟢 Online</option>
                      <option value="busy">🟡 Busy / In Review</option>
                      <option value="offline">⚪ Offline</option>
                    </select>
                  </div>

                  {/* Photo Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const googleUrl = getGoogleWorkspaceAvatarUrl(email);
                        setAvatar(googleUrl);
                      }}
                      className="text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Sync photo from Google Workspace profile endpoint"
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-600" />
                      <span>Use Google Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image</span>
                    </button>
                  </div>
                </div>

                {/* Preset Avatars */}
                <div>
                  <div className="text-[10px] text-slate-500 font-medium mb-1.5">Choose Avatar Preset:</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_AVATARS.map((pUrl, idx) => {
                      const isSelected = avatar === pUrl;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setAvatar(pUrl)}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-all cursor-pointer relative ${
                            isSelected ? 'border-indigo-600 ring-2 ring-indigo-300 scale-110 shadow-xs z-10' : 'border-transparent hover:opacity-80'
                          }`}
                          title={`Select Avatar #${idx + 1}`}
                        >
                          <img src={pUrl} alt={`Avatar preset ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setShowCustomAvatarInput(!showCustomAvatarInput)}
                      className={`text-[10px] bg-white border ${showCustomAvatarInput ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-extrabold' : 'border-slate-300 hover:bg-slate-100 text-slate-700 font-bold'} px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer transition-colors`}
                    >
                      <Camera className="w-3 h-3 text-indigo-600" />
                      <span>URL</span>
                    </button>
                  </div>
                </div>

                {showCustomAvatarInput && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={customAvatarUrl}
                      onChange={(e) => setCustomAvatarUrl(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomAvatar}
                      className="bg-indigo-600 text-white font-bold px-3 py-1 rounded-lg hover:bg-indigo-700 text-xs cursor-pointer shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Personal Info Inputs */}
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
              Personal Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 shadow-2xs"
                    placeholder="e.g. Sarah Jenkins"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 shadow-2xs"
                    placeholder="e.g. sarah@yourdigitalagents.com"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Role / Job Title</label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 shadow-2xs"
                    placeholder="e.g. Lead Product Designer"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Department / Team</label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-indigo-600 shadow-2xs"
                    placeholder="e.g. Quality Assurance"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications Preferences */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
              Notification Settings
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">In-App Mentions & Tags</div>
                    <div className="text-[10px] text-slate-500">Receive alerts when someone tags you with @mention on a pin</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyMention}
                  onChange={(e) => setNotifyMention(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900">Email Daily Digest</div>
                    <div className="text-[10px] text-slate-500">Summary of resolved pins and new feedback in your projects</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Profile Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
