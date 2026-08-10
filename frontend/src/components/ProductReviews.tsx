'use client';

import { useState, useEffect } from 'react';
import ReviewList, { type ReviewItem, type ReviewStats } from './ReviewList';
import ReviewForm from './ReviewForm';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '@/src/hooks/useAuth';
import { toast } from '@/src/lib/toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface ProductReviewsProps {
  productId: string;
  productName: string;
  rating: number;
  reviewCount: number;
}

function headers() {
  const tok = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
}

export default function ProductReviews({ productId, productName }: ProductReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reviews/product/?product=${productId}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data || [];
        setReviews(list.map((r: any) => ({ ...r, body: r.comment })));
        const total = list.length;
        const avg = total > 0 ? list.reduce((s: number, r: any) => s + r.rating, 0) / total : 0;
        const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        list.forEach((r: any) => { dist[r.rating] = (dist[r.rating] || 0) + 1; });
        setStats({
          average_rating: avg,
          total_reviews: total,
          distribution: [5, 4, 3, 2, 1].map(r => ({
            rating: r, count: dist[r] || 0,
            percentage: total > 0 ? Math.round((dist[r] || 0) / total * 100) : 0,
          })),
        });
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, [productId]);

  const handleSubmit = async (data: { rating: number; title: string; body: string }) => {
    if (!user) { setFormError('Faça login para publicar a sua avaliação.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const res = await fetch(`${API_URL}/reviews/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ product: productId, ...data, comment: data.body }),
      });
      if (res.ok) {
        setShowForm(false);
        fetchReviews();
        toast.success('Avaliação enviada!', 'Obrigado pelo teu feedback.');
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = typeof err === 'string' ? err : Object.values(err || {}).flat().join('. ');
        if (msg.includes('duplicate') || msg.includes('ja existe')) {
          toast.warning('Review duplicada', 'Já existe uma avaliação tua.');
          setShowForm(false);
        } else {
          setFormError(msg || 'Erro ao enviar.');
        }
      }
    } catch { setFormError('Erro de rede.'); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="mt-8" id="reviews">
      <h2 className="text-xl font-bold mb-4">Avaliações dos Clientes</h2>
      <ReviewList
        reviews={reviews}
        stats={stats}
        loading={loading}
        canReview={!!user}
        alreadyReviewed={false}
        onWriteReview={() => { setShowForm(true); setFormError(''); }}
      />
      <ReviewForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        subjectName={productName}
        submitting={submitting}
        error={formError}
      />
    </section>
  );
}
