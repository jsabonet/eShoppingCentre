'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LifeBuoy, AlertCircle, MessageCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Aberto', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  in_progress: { label: 'Em Resolução', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  resolved: { label: 'Resolvido', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Fechado', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  not_received: 'Não recebi', defective: 'Defeito', wrong_item: 'Item errado',
  payment: 'Pagamento', other: 'Outro',
};

interface Ticket {
  id: string; subject: string; order_number: string; order: string; category: string;
  description: string; status: string; resolution: string; created_at: string;
}

export default function AccountTicketsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/tickets/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setTickets(data.results || data || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) fetchTickets();
  }, [authLoading, isAuthenticated, fetchTickets]);

  return (
    <AccountLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Meus Tickets de Suporte</h2>
            <p className="text-sm text-muted-foreground">{tickets.length} ticket(s) · {tickets.filter(t => t.status === 'open').length} aberto(s)</p>
          </div>
          <button onClick={fetchTickets} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">A carregar...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <LifeBuoy size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground mb-2">Ainda não tem tickets.</p>
            <p className="text-sm text-muted-foreground mb-4">Se tem um problema com uma encomenda, abra a encomenda e toque em &quot;Preciso de Ajuda&quot;.</p>
            <Link href="/account/orders" className="text-sm font-semibold text-accent hover:underline">
              Ver minhas encomendas
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
              const Icon = cfg.icon;
              return (
                <div key={t.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <MessageCircle size={14} className="text-muted-foreground" />
                      {t.subject}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
                      <Icon size={11} /> {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t.order_number} · {CATEGORY_LABELS[t.category]} · {new Date(t.created_at).toLocaleDateString('pt-MZ')}
                  </p>
                  <p className="text-sm text-foreground/80">{t.description}</p>
                  {t.resolution && (
                    <div className="mt-3 p-3 bg-muted/40 rounded-xl text-sm">
                      <span className="font-semibold text-xs text-muted-foreground">Resposta da equipa:</span>
                      <p className="mt-1">{t.resolution}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
