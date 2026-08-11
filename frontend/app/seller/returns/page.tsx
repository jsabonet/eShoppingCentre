'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  RotateCcw, CheckCircle, XCircle, Truck, Package, Search, RefreshCw,
  Loader2, AlertCircle, Eye, ChevronDown, ChevronUp, ArrowRight, MapPin,
  DollarSign, FileText, Camera, User, Hash, Calendar,
} from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  requested: { label: 'Solicitada', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: RotateCcw },
  approved: { label: 'Aprovada', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: CheckCircle },
  rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  disputed: { label: 'Em Disputa', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: AlertCircle },
  shipped: { label: 'Enviada', color: 'bg-purple-100 text-purple-700 border-purple-300', icon: Truck },
  received: { label: 'Recebida', color: 'bg-indigo-100 text-indigo-700 border-indigo-300', icon: Package },
  refunded: { label: 'Reembolsada', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle },
};

const STATUS_FLOW: Record<string, { nextLabel: string; nextStatus: string; action: string; color: string; icon: any }> = {
  requested: { nextLabel: 'Analisar', nextStatus: 'approved', action: 'resolve', color: 'bg-accent text-accent-foreground', icon: Eye },
  approved: { nextLabel: 'Confirmar Receção', nextStatus: 'received', action: 'receive', color: 'bg-blue-600 text-white', icon: Package },
  shipped: { nextLabel: 'Confirmar Receção', nextStatus: 'received', action: 'receive', color: 'bg-blue-600 text-white', icon: Package },
  received: { nextLabel: 'Processar Reembolso', nextStatus: 'refunded', action: 'refund', color: 'bg-green-600 text-white', icon: DollarSign },
};

const REASON_LABELS: Record<string, string> = {
  defective: 'Produto com defeito',
  not_as_described: 'Produto diferente do anunciado',
  not_satisfied: 'Não serviu / Não gostei',
  damaged: 'Embalagem danificada',
  wrong_item: 'Item errado enviado',
  other: 'Outro',
};

const STATUS_TIMELINE: { status: string; label: string; icon: any }[] = [
  { status: 'requested', label: 'Solicitada', icon: RotateCcw },
  { status: 'approved', label: 'Aprovada', icon: CheckCircle },
  { status: 'shipped', label: 'Enviada', icon: Truck },
  { status: 'received', label: 'Recebida', icon: Package },
  { status: 'refunded', label: 'Reembolsada', icon: DollarSign },
];

interface ReturnImage {
  id: string;
  image: string;
  caption: string;
  created_at: string;
}

interface ReturnItem {
  id: string;
  rma_number: string;
  order_number: string;
  reason: string;
  reason_type: string;
  reason_type_display: string;
  status: string;
  buyer_name: string;
  store_name: string;
  refund_amount: number | null;
  vendor_notes: string;
  return_instructions: string;
  return_address: string;
  buyer_tracking_code: string;
  created_at: string;
  images: ReturnImage[];
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function SellerReturnsPage() {
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [resolveModal, setResolveModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [resolveForm, setResolveForm] = useState({ action: 'approved', vendor_notes: '', refund_amount: '', return_instructions: '', return_address: '' });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const apiHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), };
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/returns/store/`, { headers: apiHeaders() });
      if (!res.ok) throw new Error('Erro ao carregar.');
      const data = await res.json();
      setReturns(data.results || data || []);
    } catch { setReturns([]); showToast('error', 'Erro ao carregar devoluções.'); }
    finally { setLoading(false); }
  }, [apiHeaders]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // --- AÇÕES ---

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setSaving(true);
    try {
      const body: any = { action: resolveForm.action, vendor_notes: resolveForm.vendor_notes };
      if (resolveForm.action === 'approved') {
        body.refund_amount = resolveForm.refund_amount || null;
        body.return_instructions = resolveForm.return_instructions;
        body.return_address = resolveForm.return_address;
      }
      const res = await fetch(`${API_URL}/orders/returns/${selectedReturn.id}/resolve/`, {
        method: 'PATCH', headers: apiHeaders(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Erro ao processar.');
      }
      setResolveModal(false);
      setSelectedReturn(null);
      showToast('success', resolveForm.action === 'approved' ? 'Devolução aprovada com sucesso!' : 'Devolução rejeitada.');
      fetchReturns();
    } catch (err: any) { showToast('error', err.message); }
    finally { setSaving(false); }
  };

  const handleReceive = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/orders/returns/${id}/receive/`, { method: 'PATCH', headers: apiHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Erro ao confirmar receção.');
      }
      showToast('success', 'Receção confirmada. Pode agora processar o reembolso.');
      fetchReturns();
    } catch (err: any) { showToast('error', err.message); }
    finally { setActionLoading(null); }
  };

  const handleRefund = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/orders/returns/${id}/refund/`, { method: 'PATCH', headers: apiHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Erro ao reembolsar.');
      }
      showToast('success', 'Reembolso processado com sucesso!');
      fetchReturns();
    } catch (err: any) { showToast('error', err.message); }
    finally { setActionLoading(null); }
  };

  const openResolveModal = (item: ReturnItem) => {
    setSelectedReturn(item);
    setResolveForm({ action: 'approved', vendor_notes: '', refund_amount: '', return_instructions: '', return_address: '' });
    setResolveModal(true);
  };

  const openDetailModal = (item: ReturnItem) => {
    setSelectedReturn(item);
    setDetailModal(true);
  };

  const filtered = returns.filter(r => {
    const matchSearch = r.rma_number.toLowerCase().includes(search.toLowerCase()) ||
      r.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      r.order_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getTimelineIndex = (status: string) => STATUS_TIMELINE.findIndex(s => s.status === status);

  // --- COUNTERS ---
  const counts = {
    requested: returns.filter(r => r.status === 'requested').length,
    approved: returns.filter(r => r.status === 'approved').length,
    shipped: returns.filter(r => r.status === 'shipped').length,
    received: returns.filter(r => r.status === 'received').length,
    refunded: returns.filter(r => r.status === 'refunded').length,
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={32} message="A carregar devoluções..." />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-4 sm:p-6 space-y-6">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-full">
              <RotateCcw size={24} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Devoluções</h1>
              <p className="text-sm text-muted-foreground">{returns.length} devolução(ões) no total</p>
            </div>
          </div>
          <button onClick={fetchReturns} className="p-2.5 hover:bg-muted rounded-lg transition-colors border border-border" title="Actualizar">
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = (counts as any)[key] || 0;
            return (
              <button key={key} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs transition-all ${
                  statusFilter === key ? `${cfg.color} border-current` : 'bg-card border-border hover:bg-muted/50'
                }`}>
                <Icon size={18} />
                <span className="font-semibold">{count}</span>
                <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por RMA, cliente ou pedido..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-xl text-sm bg-background">
            <option value="all">Todos os estados</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <RotateCcw size={56} className="mx-auto text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-semibold mb-1">Nenhuma devolução</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {statusFilter !== 'all'
                  ? 'Nenhuma devolução com este estado. Tente outro filtro.'
                  : 'As devoluções solicitadas pelos seus clientes aparecerão aqui.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/30">
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-8"></th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">RMA</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden sm:table-cell">Pedido</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Cliente</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider hidden md:table-cell">Motivo</th>
                    <th className="text-left py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Estado</th>
                    <th className="text-right py-3 px-2 sm:px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-24 sm:w-36">Acções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const statusInfo = STATUS_CONFIG[r.status] || STATUS_CONFIG.requested;
                    const StatusIcon = statusInfo.icon;
                    const isExpanded = expandedRows.has(r.id);
                    const flow = STATUS_FLOW[r.status];
                    const isLoading = actionLoading === r.id;

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="py-2.5 px-2 sm:px-4">
                          <button onClick={() => toggleExpand(r.id)} className="p-1 hover:bg-muted rounded">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td className="py-2.5 px-2 sm:px-4 font-mono text-xs font-semibold">{r.rma_number}</td>
                        <td className="py-2.5 px-2 sm:px-4 font-mono text-xs text-muted-foreground hidden sm:table-cell">{r.order_number}</td>
                        <td className="py-2.5 px-2 sm:px-4 font-medium text-xs sm:text-sm">{r.buyer_name}</td>
                        <td className="py-2.5 px-2 sm:px-4 hidden md:table-cell">
                          <span className="text-xs">{REASON_LABELS[r.reason_type] || r.reason}</span>
                        </td>
                        <td className="py-2.5 px-2 sm:px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusInfo.color}`}>
                            <StatusIcon size={11} /> {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 sm:px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View detail button always visible */}
                            <button onClick={() => openDetailModal(r)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Ver detalhes">
                              <Eye size={15} />
                            </button>
                            {/* Action button based on status */}
                            {flow && (
                              <button onClick={() => {
                                if (flow.action === 'resolve') openResolveModal(r);
                                else if (flow.action === 'receive') handleReceive(r.id);
                                else if (flow.action === 'refund') handleRefund(r.id);
                              }} disabled={isLoading}
                              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1 ${flow.color} hover:opacity-90`}>
                                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <flow.icon size={12} />}
                                <span className="hidden sm:inline">{flow.nextLabel}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============ RESOLVE MODAL ============ */}
        {resolveModal && selectedReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setResolveModal(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">Analisar Devolução</h2>
                <button onClick={() => setResolveModal(false)} className="p-1.5 hover:bg-muted rounded-lg">
                  <XCircle size={18} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{selectedReturn.rma_number} · {selectedReturn.buyer_name}</p>

              {/* Reason */}
              <div className="bg-muted/50 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="font-semibold">{REASON_LABELS[selectedReturn.reason_type]}</span>
                </div>
                {selectedReturn.reason && (
                  <p className="text-muted-foreground text-xs border-t border-border pt-2 mt-2">{selectedReturn.reason}</p>
                )}
                {selectedReturn.images?.length > 0 && (
                  <div className="flex gap-2 pt-2 border-t border-border mt-2">
                    {selectedReturn.images.map((img: ReturnImage) => (
                      <Image key={img.id} src={img.image.startsWith('http') ? img.image : MEDIA_URL + img.image}
                        alt={img.caption || 'Evidência'} width={60} height={60}
                        className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleResolve} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Decisão</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                      resolveForm.action === 'approved' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-border hover:border-green-300'
                    }`}>
                      <input type="radio" name="action" value="approved" checked={resolveForm.action === 'approved'}
                        onChange={e => setResolveForm(p => ({ ...p, action: e.target.value }))} className="sr-only" />
                      <CheckCircle size={18} className={resolveForm.action === 'approved' ? 'text-green-600' : 'text-muted-foreground'} />
                      <span className="text-sm font-semibold">Aprovar</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                      resolveForm.action === 'rejected' ? 'border-red-500 bg-red-50 shadow-sm' : 'border-border hover:border-red-300'
                    }`}>
                      <input type="radio" name="action" value="rejected" checked={resolveForm.action === 'rejected'}
                        onChange={e => setResolveForm(p => ({ ...p, action: e.target.value }))} className="sr-only" />
                      <XCircle size={18} className={resolveForm.action === 'rejected' ? 'text-red-600' : 'text-muted-foreground'} />
                      <span className="text-sm font-semibold">Rejeitar</span>
                    </label>
                  </div>
                </div>

                {resolveForm.action === 'approved' && (
                  <div className="space-y-3 bg-green-50/50 rounded-xl p-4 border border-green-100">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Valor do Reembolso (MZN)</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={resolveForm.refund_amount}
                        onChange={e => setResolveForm(p => ({ ...p, refund_amount: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Morada para Devolução</label>
                      <input type="text" placeholder="Av. 24 de Julho, 1234, Maputo" value={resolveForm.return_address}
                        onChange={e => setResolveForm(p => ({ ...p, return_address: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Instruções para o Cliente</label>
                      <textarea rows={3} placeholder="Como o cliente deve proceder com a devolução..." value={resolveForm.return_instructions}
                        onChange={e => setResolveForm(p => ({ ...p, return_instructions: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {resolveForm.action === 'approved' ? 'Notas (visíveis para o cliente)' : 'Motivo da Rejeição (visível para o cliente)'}
                  </label>
                  <textarea rows={2} placeholder={resolveForm.action === 'approved' ? 'Notas adicionais...' : 'Explique por que a devolução foi rejeitada...'}
                    value={resolveForm.vendor_notes}
                    onChange={e => setResolveForm(p => ({ ...p, vendor_notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                      resolveForm.action === 'approved' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'
                    }`}>
                    {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                    Confirmar {resolveForm.action === 'approved' ? 'Aprovação' : 'Rejeição'}
                  </button>
                  <button type="button" onClick={() => setResolveModal(false)}
                    className="px-5 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-muted transition-colors">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============ DETAIL MODAL ============ */}
        {detailModal && selectedReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailModal(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold">{selectedReturn.rma_number}</h2>
                  <p className="text-sm text-muted-foreground">Pedido {selectedReturn.order_number}</p>
                </div>
                <button onClick={() => setDetailModal(false)} className="p-1.5 hover:bg-muted rounded-lg">
                  <XCircle size={18} />
                </button>
              </div>

              {/* Status Timeline */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Progresso</h3>
                <div className="flex items-center gap-1">
                  {STATUS_TIMELINE.map((step, i) => {
                    const currentIdx = getTimelineIndex(selectedReturn.status);
                    const isDone = i <= currentIdx || (selectedReturn.status === 'rejected' && i === 0);
                    const isRejected = selectedReturn.status === 'rejected' && i >= 1;
                    const StepIcon = step.icon;
                    return (
                      <div key={step.status} className="flex-1 flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isRejected ? 'bg-muted text-muted-foreground' :
                          isDone ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          <StepIcon size={14} />
                        </div>
                        <span className={`text-[10px] mt-1 text-center leading-tight ${isDone ? 'font-semibold' : 'text-muted-foreground'}`}>
                          {isRejected && i === 1 ? 'Rejeitada' : step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><User size={14} /> <span className="text-xs">Cliente</span></div>
                  <p className="font-semibold">{selectedReturn.buyer_name}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><FileText size={14} /> <span className="text-xs">Motivo</span></div>
                  <p className="font-semibold text-sm">{REASON_LABELS[selectedReturn.reason_type]}</p>
                  {selectedReturn.reason && <p className="text-xs text-muted-foreground">{selectedReturn.reason}</p>}
                </div>
                <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Calendar size={14} /> <span className="text-xs">Data</span></div>
                  <p className="font-semibold">{new Date(selectedReturn.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Hash size={14} /> <span className="text-xs">Estado</span></div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CONFIG[selectedReturn.status]?.color}`}>
                    {STATUS_CONFIG[selectedReturn.status]?.label}
                  </span>
                </div>
              </div>

              {/* Tracking */}
              {selectedReturn.buyer_tracking_code && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-blue-700 mb-1"><Truck size={14} /> <span className="text-xs font-semibold">Código de Rastreio do Cliente</span></div>
                  <p className="font-mono font-bold text-blue-800">{selectedReturn.buyer_tracking_code}</p>
                </div>
              )}

              {/* Return Instructions */}
              {selectedReturn.return_instructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-amber-700 mb-1"><ArrowRight size={14} /> <span className="text-xs font-semibold">Instruções Enviadas ao Cliente</span></div>
                  <p className="text-sm text-amber-800">{selectedReturn.return_instructions}</p>
                  {selectedReturn.return_address && (
                    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-amber-200">
                      <MapPin size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{selectedReturn.return_address}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Images */}
              {selectedReturn.images?.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3"><Camera size={14} className="text-muted-foreground" /> <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidências ({selectedReturn.images.length})</span></div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selectedReturn.images.map((img: ReturnImage) => (
                      <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                        <Image src={img.image.startsWith('http') ? img.image : MEDIA_URL + img.image}
                          alt={img.caption || 'Evidência'} fill className="object-cover" />
                        {img.caption && <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1"><p className="text-[10px] text-white truncate">{img.caption}</p></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendor Notes */}
              {selectedReturn.vendor_notes && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <span className="text-xs font-semibold text-muted-foreground">Notas</span>
                  <p className="text-sm mt-1">{selectedReturn.vendor_notes}</p>
                </div>
              )}

              {/* Quick actions in detail */}
              {STATUS_FLOW[selectedReturn.status] && (
                <div className="mt-6 pt-4 border-t border-border">
                  <button onClick={() => {
                    setDetailModal(false);
                    if (STATUS_FLOW[selectedReturn.status].action === 'resolve') openResolveModal(selectedReturn);
                    else if (STATUS_FLOW[selectedReturn.status].action === 'receive') handleReceive(selectedReturn.id);
                    else if (STATUS_FLOW[selectedReturn.status].action === 'refund') handleRefund(selectedReturn.id);
                  }}
                  className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${STATUS_FLOW[selectedReturn.status].color} hover:opacity-90`}>
                    {actionLoading === selectedReturn.id ? <Loader2 size={15} className="animate-spin" /> : null}
                    {STATUS_FLOW[selectedReturn.status].nextLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
