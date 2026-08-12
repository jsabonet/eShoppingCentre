'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, X } from 'lucide-react';

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

/** Resolve um caminho relativo de media para URL absoluta. */
export function resolveMediaUrl(src?: string | null): string {
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return MEDIA_URL + (src.startsWith('/') ? src : '/' + src);
}

/** Descarrega uma imagem (blob) com fallback para abrir em nova aba. */
export function downloadImage(src: string, filename?: string) {
  fetch(src)
    .then((r) => {
      if (!r.ok) throw new Error('fetch failed');
      return r.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || src.split('/').pop()?.split('?')[0] || 'imagem.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    })
    .catch(() => window.open(src, '_blank'));
}

interface LightboxImageProps {
  src: string | null | undefined;
  alt?: string;
  width?: number;
  height?: number;
  /** Usa modo fill (object-cover) — o container deve ter dimensões/relative. */
  fill?: boolean;
  /** Classes do container (button). */
  className?: string;
  /** Classes aplicadas à imagem. */
  imageClassName?: string;
  /** Legenda exibida no lightbox. */
  caption?: string;
  sizes?: string;
  /** Conteúdo extra sobreposto (ex: legenda no thumbnail). */
  children?: React.ReactNode;
}

export default function LightboxImage({
  src, alt = '', width, height, fill, className = '', imageClassName = '', caption, sizes, children,
}: LightboxImageProps) {
  const [open, setOpen] = useState(false);
  const full = resolveMediaUrl(src);
  if (!full) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver / descarregar imagem"
        className={`${fill ? 'relative ' : ''}${className} cursor-zoom-in p-0 border-0 bg-transparent text-left`}
      >
        {fill ? (
          <>
            <Image src={full} alt={alt} fill unoptimized sizes={sizes} className={`${imageClassName} object-cover`} />
            {children}
          </>
        ) : (
          <Image src={full} alt={alt} width={width} height={height} unoptimized className={imageClassName} />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            title="Fechar"
          >
            <X size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); downloadImage(full); }}
            className="absolute bottom-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            title="Descarregar"
          >
            <Download size={20} />
          </button>
          <img
            src={full}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl"
          />
          {caption && (
            <p className="absolute bottom-6 left-6 text-white/90 text-sm bg-black/50 px-3 py-1.5 rounded-lg max-w-[60%]">
              {caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
