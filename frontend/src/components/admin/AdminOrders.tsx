'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import LightboxImage from '@/src/components/LightboxImage';
import {
  ShoppingCart, Search, Clock, CheckCircle, Truck, XCircle, RefreshCw,
  AlertCircle, ChevronDown, ChevronUp, History, Eye, User, Phone, Mail, Loader2,
  Download, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Processando', color: 'bg-indigo-100 text-indigo-800' },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
  ready_for_pickup: { label: 'Pronto p/ Levantar', color: 'bg-teal-100 text-teal-800' },
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
  payment_status?: string; subtotal?: number; discount?: number; shipping_cost?: number;
  platform_fee?: number; affiliate_commission?: number;
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [orderCount, setOrderCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
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

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (paymentStatusFilter) params.set('payment_status', paymentStatusFilter);
      if (paymentMethodFilter) params.set('payment_method', paymentMethodFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const res = await fetch(`${API_URL}/orders/admin/?${params}`, { headers: headers() });
      if (!res.ok) throw new Error('Sem permissão');
      const data = await res.json();
      setOrders(data.results || data || []);
      setOrderCount(data.count ?? (data.results || data || []).length);
      setCurrentPage(page);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, [headers, debouncedSearch, statusFilter, paymentStatusFilter, paymentMethodFilter, dateFrom, dateTo]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

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

  const filtered = orders;

  const exportOrders = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ page_size: '100' });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (paymentStatusFilter) params.set('payment_status', paymentStatusFilter);
      if (paymentMethodFilter) params.set('payment_method', paymentMethodFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const reportOrders: OrderItem[] = [];
      let page = 1;
      let pageCount = 1;
      do {
        params.set('page', String(page));
        const res = await fetch(`${API_URL}/orders/admin/?${params}`, { headers: headers() });
        if (!res.ok) throw new Error('Não foi possível carregar as encomendas para o relatório.');
        const data = await res.json();
        reportOrders.push(...(data.results || data || []));
        pageCount = data.count ? Math.ceil(data.count / 100) : 1;
        page += 1;
      } while (page <= pageCount);

      const rows = reportOrders.map((order) => ({
        encomenda: order.order_number,
        comprador: order.buyer_name || '',
        email: order.buyer_email || '',
        loja: order.store_name || '',
        estado: STATUS_CONFIG[order.status]?.label || order.status,
        pagamento: order.payment_status || '',
        metodo: order.payment_method || '',
        subtotal_mzn: Number(order.subtotal || 0),
        desconto_mzn: Number(order.discount || 0),
        envio_mzn: Number(order.shipping_cost || 0),
        taxa_plataforma_mzn: Number(order.platform_fee || 0),
        comissao_afiliado_mzn: Number(order.affiliate_commission || 0),
        total_mzn: Number(order.total || 0),
        data: new Date(order.created_at).toLocaleString('pt-MZ'),
      }));
      await downloadReportFromObjects(
        reportFormat,
        `relatorio-encomendas-${new Date().toISOString().slice(0, 10)}.${reportFormat === 'excel' ? 'xlsx' : reportFormat}`,
        'Relatório de encomendas',
        ['encomenda', 'comprador', 'email', 'loja', 'estado', 'pagamento', 'metodo', 'subtotal_mzn', 'desconto_mzn', 'envio_mzn', 'taxa_plataforma_mzn', 'comissao_afiliado_mzn', 'total_mzn', 'data'],
        rows,
        {
          period: dateFrom || dateTo ? `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` : 'Todo o período',
          filters: [
            { label: 'Estado', value: statusFilter || 'Todos' },
            { label: 'Pagamento', value: paymentStatusFilter || 'Todos' },
            { label: 'Método', value: paymentMethodFilter || 'Todos' },
            { label: 'Pesquisa', value: search.trim() || '—' },
          ],
          summary: [
            { label: 'Encomendas', value: reportOrders.length },
            { label: 'Total das encomendas (MZN)', value: rows.reduce((sum, order) => sum + order.total_mzn, 0).toFixed(2) },
            { label: 'Descontos (MZN)', value: rows.reduce((sum, order) => sum + order.desconto_mzn, 0).toFixed(2) },
            { label: 'Taxas de plataforma (MZN)', value: rows.reduce((sum, order) => sum + order.taxa_plataforma_mzn, 0).toFixed(2) },
          ],
          columns: ['Encomenda', 'Comprador', 'Email', 'Loja', 'Estado', 'Estado do pagamento', 'Método', 'Subtotal (MZN)', 'Desconto (MZN)', 'Envio (MZN)', 'Taxa plataforma (MZN)', 'Comissão afiliado (MZN)', 'Total (MZN)', 'Data'],
        },
      );
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Não foi possível exportar o relatório.');
    } finally {
      setExporting(false);
    }
  };

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
          <p className="text-sm text-muted-foreground">{orders.length} nesta página · {orderCount} resultados</p>
        </div>
        <button onClick={() => fetchOrders(currentPage)} className="p-2 hover:bg-muted rounded-lg" title="Actualizar"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4 rounded-xl border border-border bg-white p-3">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 xl:col-span-4">
          <span className="flex items-center gap-1"><Search size={13} /> Pesquisar encomenda, comprador ou loja</span>
          <input type="search" placeholder="ID, email, nome do comprador ou loja" value={search} onChange={e => setSearch(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Data inicial
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Data final
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Estado da encomenda
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="">Todos os estados</option>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Estado do pagamento
          <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="">Todos os pagamentos</option>
            <option value="pending">Pendente</option>
            <option value="completed">Pago</option>
            <option value="failed">Falhado</option>
            <option value="refunded">Reembolsado</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Método de pagamento
          <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="">Todos os métodos</option>
            <option value="mpesa">M-Pesa</option>
            <option value="emola">e-Mola</option>
            <option value="vpay">VPay</option>
            <option value="wallet">Carteira</option>
            <option value="test">Teste</option>
            <option value="card">Cartão</option>
            <option value="bank">Transferência bancária</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Formato do relatório
          <select value={reportFormat} onChange={e => setReportFormat(e.target.value as ReportFormat)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="csv">CSV</option>
            <option value="excel">Excel (.xlsx)</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button type="button" onClick={exportOrders} disabled={exporting || orderCount === 0}
          className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 self-end rounded-lg bg-[#F2871A] px-3 py-2 text-sm font-medium text-white hover:bg-[#db7410] disabled:cursor-not-allowed disabled:opacity-50">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'A gerar...' : 'Exportar relatório'}
        </button>
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
                  const hasHistory = (order.status_history?.length ?? 0) > 0;
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
      {!loading && orderCount > 20 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {Math.ceil(orderCount / 20)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchOrders(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              type="button"
              onClick={() => fetchOrders(currentPage + 1)}
              disabled={currentPage >= Math.ceil(orderCount / 20)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima <ChevronRight size={16} />
            </button>
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

            {/* Itens da Encomenda */}
            {(detail.items?.length ?? 0) > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Itens da Encomenda</h3>
                <div className="space-y-2">
                  {(detail.items ?? []).map((item: any, idx: number) => (
                    <div key={item.id || idx} className="flex items-center gap-3 bg-muted/20 rounded-xl p-2.5">
                      {item.product_image ? (
                        <LightboxImage src={item.product_image} alt={item.product_name || 'Produto'} fill
                          className="relative w-12 h-12 rounded-lg overflow-hidden border border-border bg-muted shrink-0"
                          imageClassName="object-cover" caption={item.product_name} />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><ShoppingCart size={16} className="text-muted-foreground" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{item.product_name}</p>
                        <p className="text-[11px] text-muted-foreground">Qtd: {item.quantity} · {Number(item.unit_price).toLocaleString('pt-MZ')} MZN / un</p>
                      </div>
                      <span className="text-xs font-bold shrink-0">{Number(item.total_price).toLocaleString('pt-MZ')} MZN</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
            {(detail.status_history?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico Completo</h3>
                <div className="space-y-2">
                  {(detail.status_history ?? []).map((h, i) => (
                    <div key={h.id} className="flex gap-2 text-xs">
                      <div className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-accent' : 'bg-muted-foreground/30'}`} />
                        {i < (detail.status_history?.length ?? 0) - 1 && <div className="w-px flex-1 bg-border" />}
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
