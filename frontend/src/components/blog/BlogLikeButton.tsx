'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Heart, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { blogAPI } from '@/src/lib/api';

export default function BlogLikeButton({
  slug,
  initialLikes,
  initialLiked,
}: {
  slug: string;
  initialLikes: number;
  initialLiked: boolean;
}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    blogAPI.getLikeStatus(slug)
      .then(({ data }) => {
        if (!active) return;
        setLiked(data.liked);
        setLikes(data.likes_count);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o estado do gosto.');
      });
    return () => { active = false; };
  }, [authLoading, isAuthenticated, slug]);

  const toggle = async () => {
    if (!isAuthenticated || loading || authLoading) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await blogAPI.toggleLike(slug);
      setLiked(data.liked);
      setLikes(data.likes_count);
    } catch {
      setError('Não foi possível atualizar o gosto. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const button = (
    <button
      type="button"
      onClick={toggle}
      disabled={!isAuthenticated || authLoading || loading}
      aria-pressed={liked}
      aria-label={liked ? 'Remover gosto' : 'Gostar deste artigo'}
      title={!isAuthenticated ? 'Inicie sessão para gostar' : undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        liked
          ? 'border-accent bg-accent text-accent-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-accent hover:text-accent'
      } ${loading || authLoading ? 'opacity-70' : ''} ${!isAuthenticated ? 'cursor-not-allowed' : ''}`}
    >
      {loading || authLoading ? (
        <LoaderCircle size={16} className="animate-spin" />
      ) : (
        <Heart size={16} className={liked ? 'fill-current' : ''} />
      )}
      <span>{likes}</span>
      <span className="hidden sm:inline">{liked ? 'Gostei' : 'Gostar'}</span>
    </button>
  );

  return (
    <div>
      {authLoading || isAuthenticated ? button : (
        <Link
          href={`/login?redirect=${encodeURIComponent(`/blog/${slug}`)}`}
          aria-label="Inicie sessão para gostar deste artigo"
          title="Inicie sessão para gostar"
        >
          {button}
        </Link>
      )}
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle size={13} />{error}
        </p>
      )}
    </div>
  );
}
