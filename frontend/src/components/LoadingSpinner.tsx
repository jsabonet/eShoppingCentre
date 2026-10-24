'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  message?: string;
  className?: string;
  /** Use a minimal inline spinner (just the icon) */
  inline?: boolean;
  /** Cover the viewport for blocking application-level loading states */
  fullScreen?: boolean;
}

/**
 * Shared loading indicator for inline, page-level, and full-screen states.
 *
 * - `inline`: just the icon, for buttons / inline use
 * - default: centered icon + optional message below
 */
export default function LoadingSpinner({
  size = 32,
  message,
  className = '',
  inline = false,
  fullScreen = false,
}: LoadingSpinnerProps) {
  if (inline) {
    return <Loader2 size={size} aria-hidden="true" className={`animate-spin text-accent ${className}`} />;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fullScreen ? 'fixed inset-0 z-50 bg-background' : 'py-12'} flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <Loader2 size={size} aria-hidden="true" className="animate-spin text-accent" />
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : (
        <span className="sr-only">A carregar...</span>
      )}
    </div>
  );
}
