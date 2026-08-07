'use client';

import { useState, useEffect } from 'react';
import { Star, ThumbsUp, Flag, LogIn } from 'lucide-react';
import Link from 'next/link';
import ReviewStars from './ReviewStars';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '@/src/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface StoreReviewData {
  id: string;
  user_name: string;
  communication_rating: number;
  shipping_rating: number | null;
  accuracy_rating: number;
  overall_rating: number;
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  seller_reply: string;
  seller_replied_at: string | null;
  created_at: string;
}

interface StoreReviewsProps {
  storeSlug: string;
  storeName: string;
  storeType: 'physical' | 'digital' | 'course';
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

export default function StoreReviews({ storeSlug, storeName, storeType }: StoreReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<StoreReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ communication: 5, shipping: 5, accuracy: 5, overall: 5, title: '', comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/stores/${storeSlug}/reviews/`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.results || data || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, [storeSlug]);

  // Listen for "open-store-review-form" event from StoreActions button
  useEffect(() => {
    const handler = () => setShowForm(true);
    window.addEventListener('open-store-review-form', handler);
    return () => window.removeEventListener('open-store-review-form', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.comment || !form.comment.trim()) {
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
      const body: Record<string, any> = {
        store: storeSlug,
        communication_rating: form.communication,
        accuracy_rating: form.accuracy,
        overall_rating: form.overall,
        title: form.title,
        comment: form.comment,
      };
      if (storeType === 'physical') body.shipping_rating = form.shipping;

      const res = await fetch(`${API_URL}/stores/${storeSlug}/reviews/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ communication: 5, shipping: 5, accuracy: 5, overall: 5, title: '', comment: '' });
        fetchReviews();
      } else {
        const err = await res.json();
        setFormError(typeof err === 'object' ? Object.values(err).flat().join('. ') : 'Erro ao enviar.');
      }
    } catch {
      setFormError('Erro de rede.');
    } finally { setSubmitting(false); }
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await fetch(`${API_URL}/stores/${storeSlug}/reviews/`, { method: 'POST', headers: headers() }); // can't do helpful for store reviews yet
    } catch {}
  };

  // Compute averages
  const avg = (field: string) => {
    const vals = reviews.map((r: any) => r[field]).filter((v: any) => v != null);
    if (vals.length === 0) return 0;
    return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-6" id="store-reviews">
      <h3 className="font-bold text-lg mb-4">Avaliacoes da Loja</h3>

      {/* Averages */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <p className="text-2xl font-bold text-amber-500">{avg('overall_rating').toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">Geral</p>
        </div>
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <p className="text-2xl font-bold text-amber-500">{avg('communication_rating').toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">Comunicacao</p>
        </div>
        {storeType === 'physical' && (
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold text-amber-500">{avg('shipping_rating').toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">Entrega</p>
          </div>
        )}
        <div className="text-center p-3 bg-muted/30 rounded-lg">
          <p className="text-2xl font-bold text-amber-500">{avg('accuracy_rating').toFixed(1)}</p>
          <p className="text-xs text-muted-foreground mt-1">Precisao</p>
        </div>
      </div>

      {/* Button */}
      <button onClick={() => setShowForm(!showForm)}
        className="w-full py-2 border border-accent text-accent rounded-lg text-sm font-medium hover:bg-accent/5 transition-colors mb-4">
        ✍️ Avaliar {storeName}
      </button>

      {/* Review Form */}
      {showForm && (
        <div className="border border-border rounded-lg p-4 mb-4 bg-muted/20">
          <h4 className="font-bold text-sm mb-3">Avaliar {storeName}</h4>
          {formError && formError === 'login_required' ? (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-amber-800 mb-2 flex items-center gap-1.5"><LogIn size={14} /> Faça login para publicar a sua avaliacao.</p>
              <Link href={`/login?redirect=/store/${storeSlug}`}
                className="inline-flex items-center gap-1 px-4 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium">
                Entrar
              </Link>
            </div>
          ) : formError && (
            <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm rounded-lg">{formError}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Comunicacao', value: form.communication, field: 'communication' },
                ...(storeType === 'physical' ? [{ label: 'Entrega', value: form.shipping, field: 'shipping' }] : []),
                { label: 'Precisao', value: form.accuracy, field: 'accuracy' },
                { label: 'Geral', value: form.overall, field: 'overall' },
              ].map(dim => (
                <div key={dim.field}>
                  <label className="block text-xs font-medium mb-1">{dim.label}</label>
                  <ReviewStars rating={dim.value} size={18} interactive
                    onChange={v => setForm(f => ({ ...f, [dim.field]: v }))} />
                </div>
              ))}
            </div>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Titulo (opcional)"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              placeholder="Conte como foi a sua experiencia com esta loja..."
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {submitting ? 'A enviar...' : 'Publicar'}
            </button>
          </form>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <LoadingSpinner size={20} message="A carregar..." />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma avaliacao ainda.</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {reviews.map(review => (
            <div key={review.id} className="border border-border rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-sm font-bold">{review.user_name}</p>
                  <span className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</span>
                </div>
                <div className="flex gap-1">
                  {[
                    { v: review.communication_rating, l: 'C' },
                    ...(review.shipping_rating != null ? [{ v: review.shipping_rating, l: 'E' }] : []),
                    { v: review.accuracy_rating, l: 'P' },
                    { v: review.overall_rating, l: 'G' },
                  ].map(d => (
                    <span key={d.l} className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-0.5">
                      <Star size={8} className="fill-amber-500 text-amber-500" />{d.l}:{d.v}
                    </span>
                  ))}
                </div>
              </div>
              {review.title && <p className="text-sm font-medium">{review.title}</p>}
              <p className="text-xs text-muted-foreground">{review.comment}</p>
              {review.seller_reply && (
                <div className="mt-2 ml-3 p-2 bg-muted/50 rounded border-l-2 border-accent text-xs">
                  <span className="font-bold">Resposta:</span> {review.seller_reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
