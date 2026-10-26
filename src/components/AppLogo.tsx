import React from 'react';
import { Branding, brandEmblem } from '../lib/workspaceSettings';

// The workspace logo emblem (initials or emoji from Settings → Branding)
export const AppLogo: React.FC<{ branding: Branding; className?: string }> = ({ branding, className = '' }) => {
  const emblem = brandEmblem(branding);
  return (
    <div
      className={`rounded-lg bg-blue-600 flex items-center justify-center text-white font-black shadow-sm shrink-0 ${emblem.length > 1 && /^[A-Z]+$/.test(emblem) ? 'tracking-tight' : ''} ${className}`}
      aria-hidden
    >
      {emblem}
    </div>
  );
};
