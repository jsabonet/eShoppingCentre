'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Ultra-light top-bar loading indicator.
 * - Shows instantly on route change, auto-hides when page renders.
 * - Uses a short self-clearing animation (no fixed timeout).
 * - Does NOT depend on useSearchParams — only triggers on pathname changes.
 */
export default function NavigationLoader() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    // Start animation
    const bar = barRef.current;
    if (!bar) return;

    bar.style.transition = 'none';
    bar.style.transform = 'translateX(-100%)';
    // Force reflow
    bar.offsetHeight;
    bar.style.transition = 'transform 2s cubic-bezier(0.1, 0.7, 0.8, 0.1)';
    bar.style.transform = 'translateX(85%)';

    // Auto-hide after animation completes (page has loaded by then)
    const timer = setTimeout(() => {
      if (bar) {
        bar.style.transition = 'transform 0.3s ease';
        bar.style.transform = 'translateX(100%)';
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 z-[60] pointer-events-none"
      style={{
        width: '100%',
        height: '2px',
        background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
        transform: 'translateX(-100%)',
        borderRadius: '0 2px 2px 0',
      }}
    />
  );
}
