'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { LoaderCircle, MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { blogAPI, type BlogComment } from '@/src/lib/api';

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return date.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BlogComments({ slug }: { slug: string }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await blogAPI.listComments(slug);
      setComments(data.results ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = content.trim();
    if (!value || !isAuthenticated || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await blogAPI.createComment(slug, value);
      setContent('');
      setPendingNotice(true);
      await load();
    } catch (err: unknown) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      setError(data?.detail || data?.content?.[0] || 'Não foi possível publicar o comentário.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-10 border-t border-border pt-8" aria-label="Comentários">
      <h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
        <MessageCircle size={20} />
        Comentários
        <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
      </h2>

      {authLoading ? (
        <div className="flex justify-center py-6">
          <LoaderCircle size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : isAuthenticated ? (
        <form onSubmit={submit} className="mb-8">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Partilha a tua opinião sobre este artigo…"
            rows={3}
            aria-label="Escrever comentário"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {pendingNotice ? 'Comentário enviado e aguardando moderação.' : 'Os comentários são moderados antes de aparecerem.'}
            </p>
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
              Comentar
            </button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
        </form>
      ) : (
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <ShieldAlert size={16} className="shrink-0 text-accent" />
          <span>
            <Link href="/login" className="font-medium text-accent hover:underline">Inicie sessão</Link>{' '}
            para deixar um comentário.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p role="alert">Não foi possível carregar os comentários.</p>
          <button type="button" onClick={load} className="mt-2 font-medium text-accent hover:underline">
            Tentar novamente
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ainda não há comentários. Seja o primeiro a comentar!
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                  {comment.author_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold">{comment.author_name}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</p>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{comment.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
