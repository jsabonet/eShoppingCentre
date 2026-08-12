'use client';

import { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, Search, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, MessageCircle, Loader2 } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Aberto', color: 'bg-red-100 text-red-800' },
  in_progress: { label: 'Em Resolução', color: 'bg-yellow-100 text-yellow-800' },
  resolved: { label: 'Resolvido', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Fechado', color: 'bg-gray-100 text-gray-800' },
};

const CATEGORY_LABELS: Record<string, string> = {
  not_received: 'Não recebi', defective: 'Defeito', wrong_item: 'Item errado',
  payment: 'Pagamento', other: 'Outro',
};

interface Ticket {
  id: string; subject: string; order_number: string; category: string;
  description: string; status: string; buyer_name: string; resolution: string; created_at: string;
}

export default function SellerTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [resolving, setResolving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  }), []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/tickets/seller/`, { headers: headers() });
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setTickets(data.results || data || []);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleResolve = async (ticketId: string, newStatus: string) => {
    setResolving(true);
    try {
      const res = await fetch(`${API_URL}/orders/tickets/${ticketId}/resolve/`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ status: newStatus, resolution: selected?.resolution || '' }),
      });
      if (!res.ok) throw new Error('Erro');
      showToast('success', 'Ticket actualizado.');
      setSelected(null);
      fetchTickets();
    } catch { showToast('error', 'Erro ao actualizar.'); }
    finally { setResolving(false); }
  };

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const m = t.subject.toLowerCase().includes(q) || t.buyer_name.toLowerCase().includes(q) || t.order_number.toLowerCase().includes(q);
    return m && (statusFilter === 'all' || t.status === statusFilter);
  });

  return (
    <SellerLayout>
      <div className="flex-1 p-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Tickets de Suporte</h1>
            <p className="text-sm text-muted-foreground">{tickets.length} tickets · {tickets.filter(t => t.status === 'open').length} abertos</p>
          </div>
          <button onClick={fetchTickets} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por assunto, comprador, pedido..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg text-sm bg-white">
            <option value="all">Todos</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">A carregar...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-border">
            <LifeBuoy size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground">Nenhum ticket encontrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <button key={t.id} onClick={() => setSelected(t)}
                className="w-full text-left bg-white rounded-xl border border-border p-4 hover:border-accent/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    {t.status === 'open' ? <AlertCircle size={14} className="text-red-500" /> : <MessageCircle size={14} className="text-muted-foreground" />}
                    {t.subject}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CONFIG[t.status]?.color}`}>
                    {STATUS_CONFIG[t.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{t.buyer_name} · {t.order_number} · {CATEGORY_LABELS[t.category]} · {new Date(t.created_at).toLocaleDateString('pt-MZ')}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Resolve Modal */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border">
              <h2 className="text-lg font-bold mb-1">{selected.subject}</h2>
              <p className="text-sm text-muted-foreground mb-4">{selected.buyer_name} · {selected.order_number}</p>
              <p className="text-sm mb-4 p-3 bg-muted/30 rounded-xl">{selected.description}</p>
              <textarea rows={3} placeholder="Resolução..." value={selected.resolution}
                onChange={e => setSelected({ ...selected, resolution: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => handleResolve(selected.id, 'resolved')} disabled={resolving}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Resolver
                </button>
                <button onClick={() => handleResolve(selected.id, 'closed')} disabled={resolving}
                  className="px-4 py-2.5 bg-gray-600 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 disabled:opacity-50">
                  Fechar
                </button>
                <button onClick={() => setSelected(null)} className="px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
