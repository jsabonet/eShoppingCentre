'use client';

import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  /** Custom message, defaults to "A carregar..." */
  message?: string;
  /** If true, renders as a transparent overlay (use for auth checks) */
  fullScreen?: boolean;
}

/**
 * Full-screen loading overlay.
 *
 * Use `fullScreen` for the initial auth check — covers the entire viewport
 * with the brand logo and a spinner.  Use without `fullScreen` for
 * page-level loading states inside a layout.
 */
export default function LoadingScreen({
  message = 'A carregar...',
  fullScreen = true,
}: LoadingScreenProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white'
    : 'flex flex-col items-center justify-center py-24';

  return (
    <div className={containerClass}>
      {/* Logo */}
      <div className="mb-8">
        <img
          src="/icon.png?v=1"
          alt="E-Shopping Centre"
          className="h-10 w-auto mx-auto"
        />
      </div>

      {/* Spinner */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <Loader2
          size={48}
          className="animate-spin text-primary"
        />
      </div>

      {/* Message */}
      <p className="mt-6 text-sm text-muted-foreground animate-pulse tracking-wide">
        {message}
      </p>
    </div>
  );
}
