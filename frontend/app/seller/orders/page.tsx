'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Search, Clock, CheckCircle, Truck, XCircle, RefreshCw,
  Camera, Loader2, X, AlertCircle, ChevronDown, ChevronUp, History,
} from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { ordersAPI } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processando', color: 'bg-indigo-100 text-indigo-700', icon: Clock },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
  refunded: { label: 'Reembolsado', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

// Só transições permitidas ao vendedor
const ALLOWED_OPTIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: [],
  delivered: [],
  cancelled: [],
  refunded: [],
};

interface OrderItem {
  id: string; order_number: string; status: string; total: number;
  payment_method: string; created_at: string;
  buyer_email?: string; buyer_phone?: string; buyer_name?: string;
  store_phone?: string;
  items?: any[]; shipping_notes?: string; tracking_code?: string;
  shipping_evidence?: string;
  status_history?: { id: string; previous_status: string; new_status: string; changed_by_name: string; notes: string; created_at: string }[];
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [shipModal, setShipModal] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [shipForm, setShipForm] = useState({ shipping_notes: '', tracking_code: '' });
  const [shipFile, setShipFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/store/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      const data = await res.json();
      setOrders(data.results || data || []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!newStatus) return;
    if (newStatus === 'shipped') {
      setShipModal({ orderId, orderNumber: orders.find(o => o.id === orderId)?.order_number || '' });
      return;
    }
    setUpdating(orderId);
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/update-status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.status === 'string' ? err.status : typeof err.detail === 'string' ? err.detail : 'Erro ao actualizar.');
      }
      const data = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? data : o));
      showToast('success', `Status alterado para "${STATUS_CONFIG[newStatus]?.label || newStatus}".`);
    } catch (err: any) {
      showToast('error', err.message);
    } finally { setUpdating(null); }
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipModal) return;
    setUpdating(shipModal.orderId);
    try {
      const formData = new FormData();
      formData.append('status', 'shipped');
      formData.append('shipping_notes', shipForm.shipping_notes);
      if (shipForm.tracking_code) formData.append('tracking_code', shipForm.tracking_code);
      if (shipFile) formData.append('shipping_evidence', shipFile);

      const res = await fetch(`${API_URL}/orders/${shipModal.orderId}/update-status/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.status === 'string' ? err.status : typeof err.detail === 'string' ? err.detail : 'Erro.');
      }
      const data = await res.json();
      setOrders(prev => prev.map(o => o.id === shipModal.orderId ? data : o));
      setShipModal(null);
      setShipForm({ shipping_notes: '', tracking_code: '' });
      setShipFile(null);
      showToast('success', 'Encomenda marcada como enviada.');
    } catch (err: any) {
      showToast('error', err.message);
    } finally { setUpdating(null); }
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const m = (o.buyer_email || '').toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q);
    return m && (statusFilter === 'all' || o.status === statusFilter);
  });

  if (loading) {
    return <SellerLayout><div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div></SellerLayout>;
  }

  return (
    <SellerLayout>
      <div className="p-4 sm:p-6 space-y-4">

        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Encomendas</h1>
            <p className="text-sm text-muted-foreground">{orders.length} encomendas</p>
          </div>
          <button onClick={fetchOrders} className="p-2 hover:bg-muted rounded-lg" title="Actualizar"><RefreshCw size={16} /></button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por cliente ou ID..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-xl text-sm bg-background">
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart size={48} className="mx-auto text-muted-foreground mb-3 opacity-20" />
              <p className="text-muted-foreground">Nenhuma encomenda encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-border bg-muted/30">
                  <th className="w-8 py-3 px-2"></th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase">ID</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase">Cliente</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase hidden sm:table-cell">Itens</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase">Total</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase hidden md:table-cell">Data</th>
                  <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase">Status</th>
                  <th className="text-right py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase w-32">Acção</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(order => {
                    const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const Icon = s.icon;
                    const isExpanded = expanded.has(order.id);
                    const allowed = ALLOWED_OPTIONS[order.status] || [];
                    const hasHistory = order.status_history?.length > 0;

                    return (
                      <React.Fragment key={order.id}>
                        <tr key={order.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="py-2.5 px-2">
                            {hasHistory && (
                              <button onClick={() => toggleExpand(order.id)} className="p-1 hover:bg-muted rounded">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-2 sm:px-4 font-mono text-xs font-semibold">{order.order_number}</td>
                          <td className="py-2.5 px-2 sm:px-4">
                            <p className="text-xs font-medium">{order.buyer_name || order.buyer_email || '—'}</p>
                            {order.buyer_phone && <p className="text-[11px] text-muted-foreground">{order.buyer_phone}</p>}
                          </td>
                          <td className="py-2.5 px-2 sm:px-4 hidden sm:table-cell text-xs">{order.items?.length || 0}</td>
                          <td className="py-2.5 px-2 sm:px-4 font-semibold text-xs">{Number(order.total).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</td>
                          <td className="py-2.5 px-2 sm:px-4 text-muted-foreground text-xs hidden md:table-cell">{new Date(order.created_at).toLocaleDateString('pt-MZ')}</td>
                          <td className="py-2.5 px-2 sm:px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.color}`}>
                              <Icon size={11} /> {s.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 sm:px-4 text-right">
                            {allowed.length > 0 && (
                              <select value="" onChange={e => handleStatusChange(order.id, e.target.value)}
                                disabled={updating === order.id}
                                className="text-[11px] px-2 py-1 border border-border rounded bg-background disabled:opacity-50 max-w-[120px]">
                                <option value="">Alterar...</option>
                                {allowed.map(s => (
                                  <option key={s} value={s}>{s === 'shipped' ? '📦 Enviar' : s === 'processing' ? '⚙️ Processar' : s === 'confirmed' ? '✅ Confirmar' : s === 'cancelled' ? '❌ Cancelar' : STATUS_CONFIG[s]?.label}</option>
                                ))}
                              </select>
                            )}
                            {updating === order.id && <Loader2 size={14} className="animate-spin inline ml-2" />}
                          </td>
                        </tr>

                        {/* Expanded history row */}
                        {isExpanded && hasHistory && (
                          <tr key={`${order.id}-hist`}>
                            <td colSpan={8} className="bg-muted/20 px-6 py-3">
                              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                <History size={13} /> Histórico de Status
                              </div>
                              <div className="space-y-2">
                                {order.status_history!.map(h => (
                                  <div key={h.id} className="flex items-start gap-2 text-xs">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                                    <div>
                                      <span className="text-muted-foreground">
                                        <span className="font-medium text-foreground">{h.changed_by_name}</span>
                                        {' '}: <span className="font-medium">{STATUS_CONFIG[h.previous_status]?.label || h.previous_status}</span>
                                        {' → '}<span className="font-semibold">{STATUS_CONFIG[h.new_status]?.label || h.new_status}</span>
                                      </span>
                                      {h.notes && <span className="text-muted-foreground/70 ml-1">— {h.notes}</span>}
                                      <span className="text-muted-foreground/50 ml-2">{new Date(h.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
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
          )}
        </div>
      </div>

      {/* Ship Modal */}
      {shipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShipModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Truck size={18} /> Marcar como Enviado</h2>
              <button onClick={() => setShipModal(null)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{shipModal.orderNumber}</p>
            <form onSubmit={handleShipSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Como/quem vai entregar?</label>
                <textarea rows={2} placeholder="Ex: Motorista João, tel 84xxxxxxx" value={shipForm.shipping_notes}
                  onChange={e => setShipForm(p => ({ ...p, shipping_notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" required />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Referência (opcional)</label>
                <input type="text" placeholder="Nº telefone ou código" value={shipForm.tracking_code}
                  onChange={e => setShipForm(p => ({ ...p, tracking_code: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Foto do pacote (opcional)</label>
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/30 transition-colors">
                  <Camera size={18} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{shipFile ? shipFile.name : 'Clique para tirar foto'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => setShipFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <button type="submit" disabled={updating === shipModal.orderId}
                className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {updating === shipModal.orderId ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                Confirmar Envio
              </button>
            </form>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
