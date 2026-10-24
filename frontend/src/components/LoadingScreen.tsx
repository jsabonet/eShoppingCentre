'use client';

import LoadingSpinner from './LoadingSpinner';

interface LoadingScreenProps {
  /** Custom message, defaults to "A carregar..." */
  message?: string;
  /** If true, renders as a transparent overlay (use for auth checks) */
  fullScreen?: boolean;
}

export default function LoadingScreen({
  message = 'A carregar...',
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <LoadingSpinner size={36} message={message} fullScreen={fullScreen} />
  );
}
