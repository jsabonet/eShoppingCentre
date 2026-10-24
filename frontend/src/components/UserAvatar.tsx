'use client';

import { useState } from 'react';
import { getMediaUrl } from '@/src/lib/api';

interface UserAvatarProps {
  avatar?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export default function UserAvatar({
  avatar,
  name,
  className = 'h-10 w-10',
  fallbackClassName = 'bg-primary/10 text-primary',
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = avatar ? getMediaUrl(avatar) : null;
  const initials = (name?.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2) || '?').toUpperCase();

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className} ${fallbackClassName}`}>
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt={name ? `Foto de ${name}` : 'Foto de perfil'}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span aria-hidden="true" className="text-xs font-semibold">{initials}</span>
      )}
    </span>
  );
}
