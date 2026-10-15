"use client";

import { PlayCircle } from 'lucide-react';

interface AcademyVideoPlayerProps {
  title: string;
  youtubeId: string;
  poster?: string;
}

const DEFAULT_POSTER = '/images/academy/lesson-placeholder.svg';

export default function AcademyVideoPlayer({
  title,
  youtubeId,
  poster = DEFAULT_POSTER,
}: AcademyVideoPlayerProps) {
  if (youtubeId) {
    return (
      <div className="aspect-video w-full bg-black rounded-xl overflow-hidden">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full bg-primary rounded-xl overflow-hidden relative flex items-center justify-center">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${poster}')` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/45 to-primary/25"
        aria-hidden="true"
      />
      <div className="relative text-center px-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/90 flex items-center justify-center mb-4 shadow-lg">
          <PlayCircle size={32} className="text-primary" />
        </div>
        <p className="text-white font-semibold text-lg">Videoaula em breve</p>
        <p className="text-white/80 text-sm mt-1">
          Este vídeo será carregado no canal oficial do e-Shopping Centre no YouTube.
        </p>
      </div>
    </div>
  );
}
