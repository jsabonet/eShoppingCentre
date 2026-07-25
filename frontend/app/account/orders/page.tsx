'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, Clock, CheckCircle, Truck, XCircle, ShoppingBag } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';
import { ordersAPI } from '@/src/lib/api';

const orders: any[] = [];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login?redirect=/account/orders'); return; }
    if (isAuthenticated) { loadOrders(); }
  }, [isAuthenticated, authLoading]);

  const loadOrders = async () => {
    try {
      const { data } = await ordersAPI.myOrders({ page_size: 50 });
      setOrders((data as any).results || []);
    } catch {} finally { setLoading(false); }
  };

  const filtered = orders.filter((o: any) =>
    (o.order_number || o.id || '').toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading) {
    return <AccountLayout><LoadingSpinner size={32} message="A carregar encomendas..." /></AccountLayout>;
  }

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Minhas Encomendas</h2>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por ID..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {loading ? (
          <LoadingSpinner size={24} message="A carregar..." />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-2">Nenhuma encomenda encontrada.</p>
            <Link href="/" className="text-accent hover:underline text-sm">Começar a comprar</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order: any) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              return (
                <Link key={order.id} href={`/account/orders/${order.id}`}
                  className="block bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold">{order.order_number || `PED-${String(order.id).slice(0, 8)}`}</span>
                      <span className="text-sm text-muted-foreground ml-3">{new Date(order.created_at).toLocaleDateString('pt-MZ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon size={12} /> {status.label}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(order.items || []).slice(0, 3).map((item: any) => item.product_name || item.name).join(', ')}
                    {(order.items || []).length > 3 && <span> +{order.items.length - 3} mais</span>}
                  </div>
                  <div className="mt-2 font-bold text-accent">{Number(order.total || order.total_amount || 0).toLocaleString('pt-MZ')} MZN</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
