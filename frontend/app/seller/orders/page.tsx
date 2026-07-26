'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Search, Clock, CheckCircle, Truck, XCircle, RefreshCw } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { ordersAPI } from '@/src/lib/api';
import type { Order } from '@/src/lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  processing: { label: 'Processando', color: 'bg-indigo-100 text-indigo-700', icon: Clock },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
  refunded: { label: 'Reembolsado', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ordersAPI.storeOrders();
      setOrders((data as any).results || data || []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!newStatus) return;
    setUpdating(orderId);
    try {
      await ordersAPI.updateStoreOrderStatus(orderId, { status: newStatus });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch { alert('Erro ao actualizar status.'); }
    finally { setUpdating(null); }
  };

  const filtered = orders.filter((o) => {
    const matchSearch = (o.buyer?.email || '').toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Encomendas</h1>
            <p className="text-sm text-muted-foreground">{orders.length} encomendas recebidas</p>
          </div>
          <button onClick={fetchOrders} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Actualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por cliente ou ID..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background">
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((order) => {
                  const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const Icon = s.icon;
                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium font-mono text-xs">{order.order_number}</td>
                      <td className="py-3 px-4">{order.buyer?.email || '—'}</td>
                      <td className="py-3 px-4">{order.items?.length || 0}</td>
                      <td className="py-3 px-4 font-medium">{Number(order.total).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{order.payment_method || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(order.created_at).toLocaleDateString('pt-MZ')}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                          <Icon size={12} /> {s.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          value=""
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          disabled={updating === order.id}
                          className="text-xs px-2 py-1 border border-border rounded bg-background disabled:opacity-50">
                          <option value="">Alterar status</option>
                          <option value="confirmed">Confirmar</option>
                          <option value="shipped">Marcar Enviado</option>
                          <option value="delivered">Marcar Entregue</option>
                          <option value="cancelled">Cancelar</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Nenhuma encomenda encontrada</div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
