'use client';

import { useState, useEffect } from 'react';
import { Star, X, Send, Loader2 } from 'lucide-react';

export interface ReviewFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; title: string; body: string }) => Promise<void>;
  subjectName: string;
  submitting?: boolean;
  error?: string;
  success?: string;
}

export default function ReviewForm({
  open, onClose, onSubmit, subjectName, submitting = false, error = '', success = '',
}: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [localError, setLocalError] = useState('');

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setRating(5);
      setTitle('');
      setBody('');
      setLocalError('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!body.trim()) {
      setLocalError('Por favor, escreve um comentário.');
      return;
    }
    setLocalError('');
    await onSubmit({ rating, title: title.trim(), body: body.trim() });
  };

  if (!open) return null;

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold text-lg">Avaliar</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{subjectName}</p>

          {/* Rating */}
          <div>
            <p className="text-sm font-medium mb-2">Classificação</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}
                  className="p-1 transition-transform hover:scale-110">
                  <Star size={28}
                    className={s <= rating ? 'text-accent fill-accent' : 'text-muted-foreground/30'} />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Título (opcional)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Resume a tua experiência..." maxLength={255}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
          </div>

          {/* Body */}
          <div>
            <label className="text-sm font-medium mb-1 block">Comentário *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Partilha a tua opinião..." rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none" />
          </div>

          {displayError && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{displayError}</p>
          )}
          {success && (
            <p className="text-sm text-green-600 bg-green-50 p-2 rounded-lg">{success}</p>
          )}

          <button onClick={handleSubmit}
            disabled={submitting || !!success}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> A enviar...</>
            ) : (
              <><Send size={16} /> Enviar Avaliação</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}