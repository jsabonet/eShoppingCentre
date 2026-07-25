'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  message?: string;
  className?: string;
  /** Use a minimal inline spinner (just the icon) */
  inline?: boolean;
}

/**
 * Reusable loading spinner.
 *
 * - `inline`: just the icon, for buttons / inline use
 * - default: centered icon + optional message below
 */
export default function LoadingSpinner({
  size = 32,
  message,
  className = '',
  inline = false,
}: LoadingSpinnerProps) {
  if (inline) {
    return <Loader2 size={size} className={`animate-spin text-muted-foreground ${className}`} />;
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <Loader2 size={size} className="animate-spin text-primary" />
      {message && (
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      )}
    </div>
  );
}
