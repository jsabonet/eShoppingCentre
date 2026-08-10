'use client';

import { Star, MessageSquare, CheckCircle } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export interface ReviewItem {
  id: string;
  user_name: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  is_edited?: boolean;
  seller_reply?: string;
  seller_replied_at?: string | null;
  /** For store reviews that have multiple rating dimensions */
  dimensions?: { label: string; value: number }[];
}

export interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  distribution: { rating: number; count: number; percentage: number }[];
}

export interface ReviewListProps {
  reviews: ReviewItem[];
  stats: ReviewStats | null;
  loading: boolean;
  activeRatingFilter?: number | null;
  onFilterChange?: (rating: number | null) => void;
  canReview: boolean;
  alreadyReviewed: boolean;
  onWriteReview: () => void;
  emptyMessage?: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short' });
}

export default function ReviewList({
  reviews, stats, loading, activeRatingFilter, onFilterChange,
  canReview, alreadyReviewed, onWriteReview,
  emptyMessage = 'Este item ainda não tem avaliações.',
}: ReviewListProps) {
  return (
    <div>
      {/* Write review button */}
      {canReview && (
        <div className="mb-6">
          {alreadyReviewed ? (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={16} /> Já avaliaste
            </p>
          ) : (
            <button onClick={onWriteReview}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              <Star size={16} /> Avaliar
            </button>
          )}
        </div>
      )}

      {/* Stats + Distribution */}
      {stats && stats.total_reviews > 0 ? (
        <>
          <div className="flex flex-col sm:flex-row gap-6 mb-8 p-5 bg-card border border-border rounded-xl">
            <div className="text-center sm:text-left">
              <div className="text-5xl font-bold text-accent">{stats.average_rating.toFixed(1)}</div>
              <div className="flex items-center justify-center sm:justify-start gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={18}
                    className={s <= Math.round(stats.average_rating) ? 'text-accent fill-accent' : 'text-muted-foreground/30'} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{stats.total_reviews} avaliações</p>
            </div>
            <div className="flex-1 space-y-2">
              {stats.distribution.map((d) => (
                <button key={d.rating}
                  onClick={() => onFilterChange?.(activeRatingFilter === d.rating ? null : d.rating)}
                  className={`w-full flex items-center gap-2 text-sm transition-opacity ${activeRatingFilter && activeRatingFilter !== d.rating ? 'opacity-40' : ''}`}>
                  <span className="w-10 text-right text-xs">{d.rating} ★</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${d.percentage}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs text-muted-foreground">{d.count}</span>
                </button>
              ))}
              {activeRatingFilter && (
                <button onClick={() => onFilterChange?.(null)}
                  className="text-xs text-accent hover:underline ml-12">Limpar filtro</button>
              )}
            </div>
          </div>

          {/* Review cards */}
          {loading ? (
            <div className="flex justify-center py-10"><LoadingSpinner size={24} /></div>
          ) : reviews.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma avaliação com {activeRatingFilter} estrelas.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                      {r.user_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{r.user_name}</p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12}
                            className={s <= r.rating ? 'text-accent fill-accent' : 'text-muted-foreground/30'} />
                        ))}
                        <span className="text-xs text-muted-foreground ml-2">
                          {timeAgo(r.created_at)}
                          {r.is_edited && ' (editado)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dimensions for store reviews */}
                  {r.dimensions && r.dimensions.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-2 ml-10">
                      {r.dimensions.map((dim) => (
                        <div key={dim.label} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>{dim.label}:</span>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={10}
                              className={s <= dim.value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {r.title && <h4 className="font-semibold text-sm mb-1 ml-10">{r.title}</h4>}
                  <p className="text-sm text-muted-foreground ml-10">{r.body}</p>

                  {/* Seller reply */}
                  {r.seller_reply && (
                    <div className="mt-3 ml-10 p-3 bg-muted/50 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={14} className="text-accent" />
                        <span className="text-xs font-semibold text-accent">Resposta do Vendedor</span>
                        <span className="text-xs text-muted-foreground">
                          {r.seller_replied_at ? timeAgo(r.seller_replied_at) : ''}
                        </span>
                      </div>
                      <p className="text-sm">{r.seller_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-10 bg-card border border-border rounded-xl">
          <Star size={48} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">{emptyMessage}</p>
          {canReview && !alreadyReviewed && (
            <button onClick={onWriteReview}
              className="mt-3 text-sm text-accent hover:underline">Seja o primeiro a avaliar!</button>
          )}
        </div>
      )}
    </div>
  );
}
