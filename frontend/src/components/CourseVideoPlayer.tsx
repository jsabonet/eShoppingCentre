'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface CourseVideoPlayerProps {
  lessonId: string;
  startTime?: number;
  durationSeconds?: number;
  onProgress?: (seconds: number) => void;
  onEnded?: () => void;
}

// Carrega o SDK da Cloudflare Stream uma única vez (global)
let sdkLoaded = false;
let sdkLoading: Promise<void> | null = null;

function loadStreamSDK(): Promise<void> {
  if (sdkLoaded) return Promise.resolve();
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
    script.async = true;
    script.onload = () => { sdkLoaded = true; resolve(); };
    script.onerror = () => { resolve(); }; // não bloqueia se falhar
    document.head.appendChild(script);
  });
  return sdkLoading;
}

declare global {
  interface Window { Stream?: any; }
}

export default function CourseVideoPlayer({ lessonId, startTime = 0, durationSeconds = 0, onProgress, onEnded }: CourseVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const playerRef = useRef<any>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const endedFiredRef = useRef(false);
  const startTimeRef = useRef(startTime);
  onProgressRef.current = onProgress;
  onEndedRef.current = onEnded;
  startTimeRef.current = startTime;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const setupPlayer = useCallback(async () => {
    setLoading(true); setError(''); endedFiredRef.current = false;

    try {
      // 1. Obter token
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

      // 2. Carregar SDK
      await loadStreamSDK();
      const Stream = window.Stream;
      if (!Stream) throw new Error('SDK do Cloudflare Stream nao carregou.');

      // 3. Limpar container e criar player
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        const streamEl = document.createElement('stream');
        streamEl.setAttribute('src', data.video_uid);
        streamEl.setAttribute('controls', '');
        streamEl.setAttribute('preload', 'auto');
        streamEl.setAttribute('autoplay', '');
        streamEl.setAttribute('token', data.token);
        streamEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
        containerRef.current.appendChild(streamEl);

        // Pequeno delay para o SDK detetar o elemento
        await new Promise(r => setTimeout(r, 300));

        try {
          const player = Stream(streamEl);
          playerRef.current = player;

          player.addEventListener('play', () => {
            setLoading(false);
          });

          player.addEventListener('timeupdate', (e: any) => {
            const currentTime = Math.floor(e.detail?.currentTime || player.currentTime || 0);
            onProgressRef.current?.(currentTime);

            // Auto-complete: quando o player chega ao fim (>= 95% da duração)
            if (durationSeconds > 0 && currentTime >= durationSeconds - 2 && !endedFiredRef.current) {
              endedFiredRef.current = true;
              onEndedRef.current?.();
            }
          });

          player.addEventListener('ended', () => {
            if (!endedFiredRef.current) {
              endedFiredRef.current = true;
              onEndedRef.current?.();
            }
          });

          // Fallback: o evento 'play' pode não disparar se o video iniciar rápido
          setTimeout(() => {
            if (loading) setLoading(false);
          }, 3000);

        } catch (playerErr) {
          // Fallback para iframe se o SDK player falhar
          console.warn('Stream SDK player failed, using iframe fallback', playerErr);
          setupIframeFallback(data.video_uid, data.token);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar o video.');
      setLoading(false);
    }
  }, [lessonId, API_URL]);

  // Fallback: iframe clássico (sem pausa/pause detection, mas funcional)
  const setupIframeFallback = (videoUid: string, token: string) => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const resumeAt = startTimeRef.current;
    const tp = resumeAt > 0 ? `&startTime=${resumeAt}s` : '';
    const ifr = document.createElement('iframe');
    ifr.src = `https://iframe.cloudflarestream.com/${videoUid}?token=${token}&controls=true&preload=auto&autoplay=true${tp}`;
    ifr.className = 'absolute inset-0 w-full h-full border-0';
    ifr.allow = 'autoplay; fullscreen; picture-in-picture';
    ifr.title = 'Video da aula';
    ifr.onload = () => {
      setLoading(false);
      // Timer-based progress como fallback (com proteção contra abas inativas)
      const startTs = Date.now();
      const initialOffset = resumeAt;
      endedFiredRef.current = false;
      const timer = setInterval(() => {
        if (document.hidden) return; // não acumula tempo com aba em background
        const elapsed = initialOffset + Math.floor((Date.now() - startTs) / 1000);
        onProgressRef.current?.(elapsed);
        if (durationSeconds > 0 && elapsed >= durationSeconds && !endedFiredRef.current) {
          endedFiredRef.current = true;
          onEndedRef.current?.();
          clearInterval(timer);
        }
      }, 3000);
    };
    containerRef.current.appendChild(ifr);
  };

  useEffect(() => { setupPlayer(); }, [setupPlayer]);

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
    <div className="relative w-full h-full">
      {loading && (<div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex items-center justify-center z-10"><div className="flex flex-col items-center gap-3"><Loader2 size={36} className="animate-spin text-white/60" /><p className="text-white/50 text-sm">A preparar o video...</p></div></div>)}
      <div ref={containerRef} className={`absolute inset-0 bg-black transition-opacity duration-500 ${!loading ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  );
}
