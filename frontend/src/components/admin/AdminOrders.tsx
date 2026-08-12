'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import LightboxImage from '@/src/components/LightboxImage';
import {
  ShoppingCart, Search, Clock, CheckCircle, Truck, XCircle, RefreshCw,
  AlertCircle, ChevronDown, ChevronUp, History, Eye, User, Phone, Mail, Loader2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Processando', color: 'bg-indigo-100 text-indigo-800' },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
  refunded: { label: 'Reembolsado', color: 'bg-gray-100 text-gray-800' },
};

interface StatusEntry {
  id: string; previous_status: string; new_status: string;
  changed_by_name: string; notes: string; created_at: string;
}

interface OrderItem {
  id: string; order_number: string; status: string; total: number;
  payment_method: string; created_at: string;
  buyer_email?: string; buyer_phone?: string; buyer_name?: string;
  store_name?: string; store_phone?: string;
  items?: any[]; shipping_notes?: string; tracking_code?: string;
  shipping_evidence?: string;
  status_history?: StatusEntry[];
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<OrderItem | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const headers = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/admin/`, { headers: headers() });
      if (!res.ok) throw new Error('Sem permissão');
      const data = await res.json();
      setOrders(data.results || data || []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleAdminStatusChange = async (orderId: string, newStatus: string) => {
    if (!newStatus) return;
    setUpdating(orderId);
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/update-status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ status: newStatus, notes: `Admin alterou status para ${newStatus}` }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.status === 'string' ? err.status : typeof err.detail === 'string' ? err.detail : 'Erro.');
      }
      const data = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? data : o));
      showToast('success', `Status alterado para "${STATUS_CONFIG[newStatus]?.label || newStatus}".`);
    } catch (err: any) {
      showToast('error', err.message);
    } finally { setUpdating(null); }
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const m = (o.buyer_email || '').toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q) || (o.store_name || '').toLowerCase().includes(q);
    return m && (statusFilter === 'all' || o.status === statusFilter);
  });

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Todas as Encomendas</h2>
          <p className="text-sm text-muted-foreground">{orders.length} encomendas no sistema</p>
        </div>
        <button onClick={fetchOrders} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-4">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === k ? `${v.color} border-current` : 'bg-white border-border text-muted-foreground hover:bg-muted/50'
            }`}>
            <div className="text-lg font-bold">{orders.filter(r => r.status === k).length}</div>
            <div>{v.label}</div>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por ID, comprador, loja..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/20" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-border">
          <ShoppingCart size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground">Nenhuma encomenda encontrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b-2 border-border bg-muted/20">
                <th className="w-8 py-3 px-2"></th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase">ID</th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase">Comprador</th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase hidden md:table-cell">Loja</th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase">Total</th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase">Status</th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase hidden sm:table-cell">Data</th>
                <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase">Alterar</th>
                <th className="text-right py-3 px-2 font-semibold text-muted-foreground text-[11px] uppercase w-16">Det.</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map(order => {
                  const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const isExpanded = expanded.has(order.id);
                  const hasHistory = order.status_history?.length > 0;
                  return (
                    <React.Fragment key={order.id}>
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-2">
                          {hasHistory && (
                            <button onClick={() => toggleExpand(order.id)} className="p-1 hover:bg-muted rounded">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            {order.items?.[0]?.product_image ? (
                              <Image src={order.items[0].product_image.startsWith('http') ? order.items[0].product_image : MEDIA_URL + order.items[0].product_image}
                                alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-cover border border-border flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><ShoppingCart size={14} className="text-muted-foreground" /></div>
                            )}
                            <span className="truncate">{order.order_number}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-xs">{order.buyer_name || order.buyer_email || '—'}</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground hidden md:table-cell">{order.store_name || '—'}</td>
                        <td className="py-2.5 px-2 font-semibold text-xs">{Number(order.total).toLocaleString('pt-MZ')} MZN</td>
                        <td className="py-2.5 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.color}`}>{s.label}</span>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground hidden sm:table-cell">{new Date(order.created_at).toLocaleDateString('pt-MZ')}</td>
                        <td className="py-2.5 px-2">
                          <select value="" onChange={e => handleAdminStatusChange(order.id, e.target.value)}
                            disabled={updating === order.id}
                            className="text-[11px] px-1.5 py-1 border border-border rounded bg-white disabled:opacity-50 max-w-[110px]">
                            <option value="">Mudar...</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k} disabled={k === order.status}>{v.label}</option>
                            ))}
                          </select>
                          {updating === order.id && <Loader2 size={12} className="animate-spin inline ml-1" />}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button onClick={() => { setDetail(order); setDetailModal(true); }}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><Eye size={14} /></button>
                        </td>
                      </tr>
                      {isExpanded && hasHistory && (
                        <tr key={`${order.id}-hist`}>
                          <td colSpan={9} className="bg-muted/20 px-6 py-2">
                            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground"><History size={12} /> Histórico</div>
                            <div className="space-y-1">
                              {order.status_history!.map(h => (
                                <div key={h.id} className="flex items-start gap-2 text-xs">
                                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1 flex-shrink-0" />
                                  <div>
                                    <span className="font-medium text-foreground">{h.changed_by_name}</span>
                                    <span className="text-muted-foreground">: {STATUS_CONFIG[h.previous_status]?.label || h.previous_status} → {STATUS_CONFIG[h.new_status]?.label || h.new_status}</span>
                                    {h.notes && <span className="text-muted-foreground/60"> — {h.notes}</span>}
                                    <span className="text-muted-foreground/40 ml-2">{new Date(h.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{detail.order_number}</h2>
              <button onClick={() => setDetailModal(false)} className="p-1 hover:bg-muted rounded"><XCircle size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><User size={12} /> Comprador</div>
                <p className="font-semibold text-xs">{detail.buyer_name || '—'}</p>
                {detail.buyer_email && <p className="text-[11px] text-muted-foreground">{detail.buyer_email}</p>}
                {detail.buyer_phone && <p className="text-[11px] text-accent">{detail.buyer_phone}</p>}
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1"><ShoppingCart size={12} /> Loja</div>
                <p className="font-semibold text-xs">{detail.store_name || '—'}</p>
                {detail.store_phone && <p className="text-[11px] text-accent">{detail.store_phone}</p>}
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Status</span>
                <p><span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CONFIG[detail.status]?.color}`}>{STATUS_CONFIG[detail.status]?.label}</span></p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Total</span>
                <p className="font-bold">{Number(detail.total).toLocaleString('pt-MZ')} MZN</p>
              </div>
            </div>

            {detail.shipping_notes && (
              <div className="bg-purple-50 rounded-xl p-3 mb-4 text-xs">
                <span className="font-semibold text-purple-700">Envio:</span> {detail.shipping_notes}
              </div>
            )}

            {detail.shipping_evidence && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-muted-foreground mb-2">Evidência de Envio</div>
                <LightboxImage src={detail.shipping_evidence} alt="Evidência de envio" fill
                  className="relative w-32 h-32 rounded-lg overflow-hidden border border-border bg-muted"
                  imageClassName="object-cover" caption="Evidência de envio" />
              </div>
            )}

            {/* History Timeline */}
            {detail.status_history?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico Completo</h3>
                <div className="space-y-2">
                  {detail.status_history.map((h, i) => (
                    <div key={h.id} className="flex gap-2 text-xs">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-accent' : 'bg-muted-foreground/30'}`} />
                        {i < detail.status_history!.length - 1 && <div className="w-px flex-1 bg-border" />}
                      </div>
                      <div className="pb-2">
                        <p><span className="font-medium">{h.changed_by_name}</span>: {STATUS_CONFIG[h.previous_status]?.label || h.previous_status} → <span className="font-semibold">{STATUS_CONFIG[h.new_status]?.label || h.new_status}</span></p>
                        {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                        <p className="text-muted-foreground/50">{new Date(h.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
