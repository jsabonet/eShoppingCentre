'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface CourseVideoPlayerProps {
  lessonId: string;
  startTime?: number;
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
}

export default function CourseVideoPlayer({ lessonId, startTime = 0, onProgress, onEnded }: CourseVideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const elapsedRef = useRef(startTime);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  // Timer-based progress — fires every 3s, pauses when tab hidden
  useEffect(() => {
    if (!videoReady || loading) return;
    elapsedRef.current = startTime;

    const tick = () => {
      if (document.hidden) return; // skip when tab not visible
      elapsedRef.current += 3;
      onProgressRef.current?.(elapsedRef.current);
    };

    timerRef.current = setInterval(tick, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [videoReady, loading, startTime, lessonId]);

  const fetchToken = useCallback(async () => {
    setLoading(true); setError(''); setVideoReady(false);
    elapsedRef.current = startTime;
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
      if (data.token && data.video_uid) {
        const tp = startTime > 0 ? `&startTime=${startTime}s` : '';
        const ifr = document.createElement('iframe');
        ifr.src = `https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}&controls=true&preload=true&autoplay=true${tp}`;
        ifr.className = 'absolute inset-0 w-full h-full border-0';
        ifr.allow = 'autoplay; fullscreen; picture-in-picture';
        ifr.allowFullscreen = true;
        ifr.title = 'Video da aula';
        ifr.onload = () => setVideoReady(true);
        if (playerRef.current) { playerRef.current.innerHTML = ''; playerRef.current.appendChild(ifr); }
        setLoading(false);
      } else { throw new Error(data.detail || 'Video ainda nao disponivel.'); }
    } catch (err: any) { setError(err.message || 'Erro ao carregar o video.'); setLoading(false); }
  }, [lessonId, startTime, API_URL]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  if (error) {
    return (
      <div className="aspect-video w-full max-w-5xl mx-auto bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"><AlertCircle size={28} className="text-red-400" /></div>
          <div><p className="text-white/80 font-medium text-sm mb-1">Nao foi possivel carregar o video</p><p className="text-white/40 text-xs">{error}</p></div>
          <button onClick={fetchToken} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"><RefreshCw size={14} /> Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (<div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex items-center justify-center z-10"><div className="flex flex-col items-center gap-3"><Loader2 size={36} className="animate-spin text-white/60" /><p className="text-white/50 text-sm">A preparar o video...</p></div></div>)}
      <div ref={playerRef} className={`absolute inset-0 bg-black transition-opacity duration-500 ${videoReady ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
