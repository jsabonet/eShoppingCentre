'use client';

import { useState, useEffect } from 'react';
import { Bell, BellRing, Star, MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { useChat } from '@/src/contexts/ChatContext';
import ReviewStars from './ReviewStars';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface StoreActionsProps {
  storeId: string;
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

export default function StoreActions({ storeId, storeSlug, storeName, storeType }: StoreActionsProps) {
  const { user } = useAuth();
  const { startConversation, setOpenWidget } = useChat();
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewForm, setReviewForm] = useState({
    communication: 5, shipping: 5, accuracy: 5, overall: 5, title: '', comment: '',
  });

  // Check follow status
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/stores/${storeSlug}/follow-status/`, { headers: headers() });
        if (res.ok) {
          const d = await res.json();
          setFollowing(d.following);
          setFollowersCount(d.followers_count);
        }
      } catch {}
    })();
  }, [storeSlug, user]);

  const toggleFollow = async () => {
    if (!user) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    setLoadingFollow(true);
    try {
      const endpoint = following ? 'unfollow' : 'follow';
      const res = await fetch(`${API_URL}/stores/${storeSlug}/${endpoint}/`, {
        method: 'POST', headers: headers(),
      });
      if (res.ok) {
        const d = await res.json();
        setFollowing(d.following);
        setFollowersCount(d.followers_count);
      }
    } catch {} finally { setLoadingFollow(false); }
  };

  const handleChat = async () => {
    if (!user) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    await startConversation(storeId, `Duvida sobre a loja ${storeName}`, 'Ola! Tenho uma duvida.');
    setOpenWidget(true);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.comment || !reviewForm.comment.trim()) {
      setReviewError('O comentario nao pode estar vazio.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const body: Record<string, any> = {
        communication_rating: reviewForm.communication,
        accuracy_rating: reviewForm.accuracy,
        overall_rating: reviewForm.overall,
        title: reviewForm.title,
        comment: reviewForm.comment,
      };
      if (storeType === 'physical') body.shipping_rating = reviewForm.shipping;

      const res = await fetch(`${API_URL}/stores/${storeSlug}/reviews/`, {
        method: 'POST', headers: headers(), body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowReviewModal(false);
        setReviewForm({ communication: 5, shipping: 5, accuracy: 5, overall: 5, title: '', comment: '' });
        // Reload page to show new review
        window.location.reload();
      } else {
        const err = await res.json();
        setReviewError(typeof err === 'object' ? Object.values(err).flat().join('. ') : 'Erro.');
      }
    } catch {
      setReviewError('Erro de rede.');
    } finally { setReviewSubmitting(false); }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Follow */}
        <button onClick={toggleFollow} disabled={loadingFollow}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            following
              ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
              : 'bg-card border border-border hover:border-accent/50 hover:text-accent'
          }`}>
          {following ? <BellRing size={16} /> : <Bell size={16} />}
          {following ? 'A Seguir' : 'Seguir Loja'}
        </button>

        {/* Rate */}
        <button onClick={() => setShowReviewModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-amber-400 hover:text-amber-500 transition-all">
          <Star size={16} />
          Avaliar
        </button>

        {/* Chat */}
        <button onClick={handleChat}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border hover:border-accent/50 hover:text-accent transition-all">
          <MessageCircle size={16} />
          Conversar
        </button>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReviewModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Avaliar {storeName}</h3>
              <button onClick={() => setShowReviewModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <X size={20} />
              </button>
            </div>

            {reviewError && (
              <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded-lg">{reviewError}</div>
            )}

            <form onSubmit={submitReview} className="space-y-4">
              {[
                { label: 'Comunicacao', field: 'communication', value: reviewForm.communication },
                ...(storeType === 'physical' ? [{ label: 'Entrega', field: 'shipping', value: reviewForm.shipping }] : []),
                { label: 'Precisao', field: 'accuracy', value: reviewForm.accuracy },
                { label: 'Geral', field: 'overall', value: reviewForm.overall },
              ].map(dim => (
                <div key={dim.field} className="flex items-center justify-between">
                  <span className="text-sm">{dim.label}</span>
                  <ReviewStars rating={dim.value} size={20} interactive
                    onChange={v => setReviewForm(f => ({ ...f, [dim.field]: v }))} />
                </div>
              ))}

              <input type="text" value={reviewForm.title} onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titulo (opcional)"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />

              <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Conte como foi a sua experiencia com esta loja... (min. 10 caracteres)"
                rows={3} required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />

              <button type="submit" disabled={reviewSubmitting}
                className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors">
                {reviewSubmitting ? 'A enviar...' : 'Publicar Avaliacao'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
