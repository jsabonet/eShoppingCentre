'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInactivityTimerOptions {
  /** Timeout in milliseconds before auto-logout. Default: 30 minutes. */
  timeout?: number;
  /** Warn the user this many ms before logout. Default: 60 seconds. */
  warningBefore?: number;
  /** Callback executed on logout */
  onLogout: () => void;
}

interface UseInactivityTimerResult {
  /** Remaining time in ms before logout */
  remaining: number;
  /** Whether the warning is active */
  showWarning: boolean;
  /** Manually reset the timer */
  resetTimer: () => void;
}

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

export function useInactivityTimer({
  timeout = 30 * 60 * 1000,       // 30 minutes
  warningBefore = 60 * 1000,       // 1 minute warning
  onLogout,
}: UseInactivityTimerOptions): UseInactivityTimerResult {
  const [remaining, setRemaining] = useState(timeout);
  const [showWarning, setShowWarning] = useState(false);
  const logoutRef = useRef(onLogout);
  const timeoutRef = useRef(timeout);
  const warningRef = useRef(warningBefore);

  // Keep refs updated
  logoutRef.current = onLogout;
  timeoutRef.current = timeout;
  warningRef.current = warningBefore;

  const clearTimers = useCallback(() => {
    // We manage timers via the interval below, so this is a no-op
  }, []);

  const resetTimer = useCallback(() => {
    setRemaining(timeoutRef.current);
    setShowWarning(false);
  }, []);

  useEffect(() => {
    // Activity listener — reset on any user interaction
    const handleActivity = () => {
      setRemaining(timeoutRef.current);
      setShowWarning(false);
    };

    EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Countdown interval — ticks every second
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(interval);
          // Remove tokens and call logout
          localStorage.removeItem('access_token');
          logoutRef.current();
          return 0;
        }
        if (next <= warningRef.current && !showWarning) {
          setShowWarning(true);
        }
        return next;
      });
    }, 1000);

    return () => {
      EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync showWarning when remaining drops below threshold externally (e.g., on reset)
  useEffect(() => {
    if (remaining <= warningBefore) {
      setShowWarning(true);
    }
  }, [remaining, warningBefore]);

  return { remaining, showWarning, resetTimer };
}
