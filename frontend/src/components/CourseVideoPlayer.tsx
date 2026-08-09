'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CourseVideoPlayerProps {
  lessonId: string;
  startTime?: number;
  durationSeconds?: number;
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
}

export default function CourseVideoPlayer({ lessonId, startTime = 0, durationSeconds = 0, onProgress, onEnded }: CourseVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const endedFiredRef = useRef(false);
  const startTimeRef = useRef(startTime);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;
  startTimeRef.current = startTime;

  const setupPlayer = useCallback(async () => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    setLoading(true); setError(''); endedFiredRef.current = false;

    try {
      const tok = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/stream-token/`, {
        headers: { 'Authorization': `Bearer ${tok}` },
      });
      if (!res.ok) {
        if (res.status === 401) { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname); return; }
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Erro ${res.status}`);
      }
      const data = await res.json();
      if (!data.token || !data.video_uid) throw new Error(data.detail || 'Video ainda nao disponivel.');

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const resumeAt = startTimeRef.current;
        const tp = resumeAt > 0 ? `&startTime=${resumeAt}s` : '';
        const ifr = document.createElement('iframe');
        ifr.src = `https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}&controls=true&preload=auto&autoplay=true${tp}`;
        ifr.className = 'absolute inset-0 w-full h-full border-0';
        ifr.allow = 'autoplay; fullscreen; picture-in-picture';
        ifr.title = 'Video da aula';
        ifr.onload = () => setLoading(false);

        const startTs = Date.now();
        const initialOffset = resumeAt;
        progressTimerRef.current = setInterval(() => {
          if (document.hidden) return;
          const elapsed = initialOffset + Math.floor((Date.now() - startTs) / 1000);
          onProgressRef.current?.(elapsed);
          if (durationSeconds > 0 && elapsed >= durationSeconds && !endedFiredRef.current) {
            endedFiredRef.current = true;
            onEndedRef.current?.();
            if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
          }
        }, 3000);

        containerRef.current.appendChild(ifr);
        setTimeout(() => { if (loading) setLoading(false); }, 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar o video.');
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    setupPlayer();
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [setupPlayer]);

  if (error) {
    return (
      <div className="aspect-video w-full max-w-5xl mx-auto bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"><AlertCircle size={28} className="text-red-400" /></div>
          <div><p className="text-white/80 font-medium text-sm mb-1">Nao foi possivel carregar o video</p><p className="text-white/40 text-xs">{error}</p></div>
          <button onClick={setupPlayer} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"><RefreshCw size={14} /> Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: '360px' }}>
      <div ref={containerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 size={28} className="animate-spin text-white/70" />
        </div>
      )}
    </div>
  );
}


