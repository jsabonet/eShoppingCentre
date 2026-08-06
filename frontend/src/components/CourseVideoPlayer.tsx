'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw, Play, Maximize, Volume2, VolumeX } from 'lucide-react';

interface CourseVideoPlayerProps {
  lessonId: string;
  isFreePreview?: boolean;
}

export default function CourseVideoPlayer({ lessonId, isFreePreview }: CourseVideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [videoReady, setVideoReady] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError('');
    setVideoReady(false);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/stream-token/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Erro ${res.status}`);
      }

      const data = await res.json();

      if (data.token && data.video_uid) {
        // Embed do Cloudflare Stream com parâmetros optimizados
        const iframe = document.createElement('iframe');
        iframe.src = `https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}&controls=true&muted=false&preload=true&loop=false&autoplay=false`;
        iframe.className = 'absolute inset-0 w-full h-full border-0';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.title = 'Video da aula';
        iframe.onload = () => setVideoReady(true);

        if (playerRef.current) {
          playerRef.current.innerHTML = '';
          playerRef.current.appendChild(iframe);
        }
        setLoading(false);
      } else {
        throw new Error(data.detail || 'Video ainda nao disponivel.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar o video.');
      setLoading(false);
    }
  }, [lessonId, API_URL]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  if (error) {
    return (
      <div className="aspect-video bg-gradient-to-b from-gray-900 to-black rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <p className="text-white/80 font-medium text-sm mb-1">Não foi possível carregar o vídeo</p>
            <p className="text-white/40 text-xs">{error}</p>
          </div>
          <button
            onClick={fetchToken}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black rounded-lg flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={36} className="animate-spin text-white/60" />
            <p className="text-white/50 text-sm">A preparar o vídeo...</p>
          </div>
        </div>
      )}

      {/* Player container */}
      <div
        ref={playerRef}
        className={`absolute inset-0 rounded-lg overflow-hidden bg-black transition-opacity duration-500 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
