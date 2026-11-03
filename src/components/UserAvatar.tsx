import React, { useState } from 'react';

interface UserAvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
  showOnlineStatus = false,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses: Record<string, string> = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-24 h-24 text-2xl',
  };

  const initials = (name || 'OP')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative shrink-0 select-none ${sizeClasses[size]}`}>
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full rounded-full object-cover border border-red-900/60 bg-[#0d0d10]"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#28070b] via-[#140608] to-[#08080a] border border-red-800/60 flex items-center justify-center font-display font-bold text-red-400 tracking-wider">
          {initials}
        </div>
      )}

      {showOnlineStatus && (
        <span
          title={isOnline ? 'Online' : 'Offline'}
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0b0b0e] ${
            isOnline ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-zinc-600'
          }`}
        />
      )}
    </div>
  );
};
