import React, { useState, useEffect } from 'react';
import { 
  getGoogleWorkspaceAvatarUrl, 
  getGoogleWorkspaceFallbackAvatarUrl, 
  getGoogleAvatarColor, 
  getUserInitials 
} from '../utils/avatar';

interface UserAvatarProps {
  name?: string;
  email?: string;
  avatar?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showOnlineStatus?: boolean;
  status?: 'online' | 'busy' | 'offline' | 'typing';
  showGoogleBadge?: boolean;
  title?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  email,
  avatar,
  size = 'md',
  className = '',
  showOnlineStatus = false,
  status = 'online',
  showGoogleBadge = false,
  title,
}) => {
  // Image loading strategy: 
  // 1. google_primary -> Google Workspace profile picture endpoint
  // 2. google_secondary -> Unavatar Google endpoint
  // 3. custom -> provided custom avatar string if distinct from stock photo
  // 4. initials -> Google Workspace dynamic letter badge
  const [imgSourceIndex, setImgSourceIndex] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);

  // Derive size dimensions
  let pxSize = 32;
  let textSizeClass = 'text-xs';

  if (typeof size === 'number') {
    pxSize = size;
    textSizeClass = size <= 18 ? 'text-[7px] font-bold tracking-normal' : size <= 28 ? 'text-[10px]' : size <= 40 ? 'text-xs' : size <= 56 ? 'text-sm' : 'text-base';
  } else {
    switch (size) {
      case 'xs':
        pxSize = 24;
        textSizeClass = 'text-[10px] font-bold';
        break;
      case 'sm':
        pxSize = 32;
        textSizeClass = 'text-xs font-bold';
        break;
      case 'md':
        pxSize = 40;
        textSizeClass = 'text-xs font-extrabold';
        break;
      case 'lg':
        pxSize = 48;
        textSizeClass = 'text-sm font-black';
        break;
      case 'xl':
        pxSize = 64;
        textSizeClass = 'text-lg font-black';
        break;
    }
  }

  // Generate image URL candidates array
  const imageUrls: string[] = [];
  if (avatar && avatar.trim()) {
    imageUrls.push(avatar.trim());
  }
  if (email && email.trim()) {
    imageUrls.push(getGoogleWorkspaceAvatarUrl(email, pxSize * 2));
    imageUrls.push(getGoogleWorkspaceFallbackAvatarUrl(email));
  }

  useEffect(() => {
    setImgSourceIndex(0);
    setHasError(false);
  }, [email, avatar]);

  const handleImageError = () => {
    if (imgSourceIndex < imageUrls.length - 1) {
      setImgSourceIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const currentImageUrl = imageUrls[imgSourceIndex];
  const initials = getUserInitials(name, email);
  const bgColor = getGoogleAvatarColor(email);
  const displayName = name || email || 'Workspace Member';

  const statusColors = {
    online: 'bg-emerald-500 ring-white',
    busy: 'bg-amber-500 ring-white',
    offline: 'bg-slate-400 ring-white',
    typing: 'bg-blue-500 ring-white animate-pulse',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full ${className}`}
      style={{ width: `${pxSize}px`, height: `${pxSize}px` }}
      title={title || `${displayName} (${email || 'Google Workspace'})`}
    >
      {!hasError && currentImageUrl ? (
        <img
          src={currentImageUrl}
          alt={displayName}
          onError={handleImageError}
          className="w-full h-full rounded-full object-cover border border-slate-200/80 shadow-2xs"
          referrerPolicy="no-referrer"
        />
      ) : (
        /* Google Workspace Dynamic Initial Badge */
        <div
          className={`w-full h-full rounded-full flex items-center justify-center text-white shadow-2xs tracking-wider ${textSizeClass}`}
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </div>
      )}

      {/* Optional Google Workspace 'G' Badge */}
      {showGoogleBadge && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-[9px] font-black text-blue-600">
          G
        </div>
      )}

      {/* Online Status Dot Indicator */}
      {showOnlineStatus && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ${statusColors[status]}`}
          style={{
            width: Math.max(8, Math.floor(pxSize * 0.28)) + 'px',
            height: Math.max(8, Math.floor(pxSize * 0.28)) + 'px',
          }}
        />
      )}
    </div>
  );
};
