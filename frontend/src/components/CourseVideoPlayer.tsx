'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface CourseVideoPlayerProps {
  lessonId: string;
  isFreePreview?: boolean;
}

export default function CourseVideoPlayer({ lessonId, isFreePreview }: CourseVideoPlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/stream-token/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();

        if (!mounted) return;

        if (data.token && data.stream_url) {
          // Embed do Cloudflare Stream com token
          const iframe = document.createElement('iframe');
          iframe.src = `https://iframe.cloudflarestream.com/${data.video_uid}?token=${data.token}`;
          iframe.className = 'w-full aspect-video rounded-lg';
          iframe.allowFullscreen = true;

          if (playerRef.current) {
            playerRef.current.innerHTML = '';
            playerRef.current.appendChild(iframe);
          }
          setLoading(false);
        } else {
          setError(data.detail || 'Video nao disponivel.');
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setError('Erro ao carregar o video.');
          setLoading(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [lessonId]);

  if (loading) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-white/60" />
          <p className="text-white/60 text-sm">A carregar video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <AlertCircle size={32} />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return <div ref={playerRef} className="rounded-lg overflow-hidden" />;
}
