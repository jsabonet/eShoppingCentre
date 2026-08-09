'use client';

import { useState, useEffect } from 'react';
import { Star, ThumbsUp, Flag, MessageSquare, X, LogIn } from 'lucide-react';
import Link from 'next/link';
import ReviewStars from './ReviewStars';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '@/src/hooks/useAuth';
import { toast } from '@/src/lib/toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface ReviewData {
  id: string;
  user_name: string;
  rating: number;
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  seller_reply: string;
  seller_replied_at: string | null;
  created_at: string;
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
  rating: number;
  reviewCount: number;
}

function headers() {
  const tok = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  };
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Ha ${days} dias`;
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProductReviews({ productId, productName, rating, reviewCount }: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reviews/product/?product=${productId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.results || data || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formComment || !formComment.trim()) {
      setFormError('O comentario nao pode estar vazio.');
      return;
    }
    if (!user) {
      setFormError('login_required');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch(`${API_URL}/reviews/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          product: productId,
          rating: formRating,
          title: formTitle,
          comment: formComment,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormTitle('');
        setFormComment('');
        setFormRating(5);
        fetchReviews();
        toast.success('Avaliacao enviada!', 'Obrigado pelo seu feedback.');
      } else {
        const err = await res.json().catch(() => ({}));
        // Detetar review duplicada (backend agora retorna 200 com a existente)
        const msg = typeof err === 'string' ? err : Object.values(err || {}).flat().join('. ');
        if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('ja existe')) {
          toast.warning('Review duplicada', 'Ja existe uma avaliacao sua para este produto.');
          setShowForm(false);
        } else {
          setFormError(msg || 'Erro ao enviar.');
          toast.error('Erro ao enviar', msg || 'Tente novamente mais tarde.');
        }
      }
    } catch {
      setFormError('Erro de rede.');
    } finally { setSubmitting(false); }
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await fetch(`${API_URL}/reviews/${reviewId}/helpful/`, { method: 'POST', headers: headers() });
      fetchReviews();
    } catch {}
  };

  const handleReport = async (reviewId: string) => {
    try {
      await fetch(`${API_URL}/reviews/${reviewId}/report/`, { method: 'POST', headers: headers() });
      fetchReviews();
    } catch {}
  };

  // Rating distribution
  const distribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => r.rating === star).length;
    return { star, count, pct: reviews.length > 0 ? (count / reviews.length) * 100 : 0 };
  });

  return (
    <section className="mt-8" id="reviews">
      <h2 className="text-xl font-bold mb-4">Avaliacoes dos Clientes</h2>

      {/* Rating Summary */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-amber-500">{rating > 0 ? rating.toFixed(1) : '-'}</span>
            <ReviewStars rating={rating} size={20} />
            <span className="text-sm text-muted-foreground mt-1">{reviewCount} avaliacao(oes)</span>
          </div>
          <div className="space-y-1.5">
            {distribution.map(d => (
              <div key={d.star} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right text-muted-foreground">{d.star}★</span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="w-8 text-xs text-muted-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="mt-4 w-full py-2 border border-accent text-accent rounded-lg text-sm font-medium hover:bg-accent/5 transition-colors">
          ✍️ Escrever uma Avaliacao
        </button>
      </div>

      {/* Review Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Avaliar: {productName}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
          </div>
          {formError && formError === 'login_required' ? (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-800 mb-2 flex items-center gap-1.5"><LogIn size={14} /> Faça login para publicar a sua avaliacao.</p>
              <Link href={`/login?redirect=/product/${encodeURIComponent(window.location.pathname.split('/').pop() || '')}`}
                className="inline-flex items-center gap-1 px-4 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium">
                Entrar
              </Link>
            </div>
          ) : formError && (
            <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg">{formError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Classificacao</label>
              <ReviewStars rating={formRating} size={28} interactive onChange={setFormRating} />
              <span className="text-sm text-muted-foreground ml-2">{formRating} / 5</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Titulo (opcional)</label>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="Resuma a sua experiencia..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Comentario *</label>
              <textarea value={formComment} onChange={e => setFormComment(e.target.value)}
                placeholder="Conte como foi a sua experiencia com este produto..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {submitting ? 'A enviar...' : 'Publicar Avaliacao'}
            </button>
          </form>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="py-8"><LoadingSpinner size={24} message="A carregar avaliacoes..." /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Star size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Seja o primeiro a avaliar este produto!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold">{review.user_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ReviewStars rating={review.rating} size={12} />
                    <span className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</span>
                    {review.is_verified_purchase && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Compra verificada</span>
                    )}
                  </div>
                </div>
              </div>
              {review.title && <p className="text-sm font-medium mb-1">{review.title}</p>}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.comment}</p>

              {/* Seller reply */}
              {review.seller_reply && (
                <div className="mt-3 ml-4 p-3 bg-muted/50 rounded-lg border-l-2 border-accent">
                  <p className="text-xs font-bold mb-0.5">Resposta do Vendedor</p>
                  <p className="text-xs text-muted-foreground">{review.seller_reply}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border">
                <button onClick={() => handleHelpful(review.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ThumbsUp size={12} /> Util ({review.helpful_count})
                </button>
                <button onClick={() => handleReport(review.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
                  <Flag size={12} /> Denunciar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
