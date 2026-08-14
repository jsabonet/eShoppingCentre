'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Heart, Download, MapPin, ShoppingBag, ChevronRight, BookOpen, Wallet } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';
import { ordersAPI, usersAPI, walletAPI, type Order, type User } from '@/src/lib/api';

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [addressCount, setAddressCount] = useState(0);
  const [courseCount, setCourseCount] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?redirect=/account');
      return;
    }
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, authLoading, router]);

  const loadData = async () => {
    try {
      const [ordersRes, wishlistRes, addressesRes, coursesRes, downloadsRes, walletRes] = await Promise.allSettled([
        ordersAPI.myOrders({ page_size: 5 }),
        usersAPI.myWishlist(),
        usersAPI.myAddresses(),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/courses/me/enrollments/`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        }).then(r => r.ok ? r.json() : Promise.reject(r)),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/products/downloads/`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        }).then(r => r.ok ? r.json() : Promise.reject(r)),
        walletAPI.myWallet(),
      ]);

      if (ordersRes.status === 'fulfilled') {
        const data = ordersRes.value.data as any;
        setOrders(data.results || data || []);
      }
      if (wishlistRes.status === 'fulfilled') {
        const data = wishlistRes.value.data as any;
        setWishlistCount(Array.isArray(data) ? data.length : data.count || data.results?.length || 0);
      }
      if (addressesRes.status === 'fulfilled') {
        const data = addressesRes.value.data as any;
        setAddressCount(Array.isArray(data) ? data.length : data.count || data.results?.length || 0);
      }
      if (coursesRes.status === 'fulfilled') {
        const data = coursesRes.value as any;
        setCourseCount(Array.isArray(data) ? data.length : data.results?.length || data.count || 0);
      }
      if (downloadsRes.status === 'fulfilled') {
        const data = downloadsRes.value as any;
        setDownloadCount(Array.isArray(data) ? data.length : data.results?.length || data.count || 0);
      }
      if (walletRes.status === 'fulfilled') {
        setBalance(Number(walletRes.value.data?.balance || 0));
        setTotalSpent(Number(walletRes.value.data?.total_spent || 0));
      }
    } catch {} finally {
      setOrdersLoading(false);
    }
  };

  if (authLoading) {
    return (
      <AccountLayout>
        <LoadingSpinner size={32} message="A carregar conta..." />
      </AccountLayout>
    );
  }

  if (!isAuthenticated) return null;

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { pending: 'Pendente', confirmed: 'Confirmado', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      shipped: 'bg-purple-100 text-purple-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return map[s] || 'bg-gray-100 text-gray-700';
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-accent/10 to-primary/5 rounded-xl p-6 border border-accent/20">
          <h2 className="text-xl font-bold mb-1">Bem-vindo, {user?.first_name || user?.username || 'Utilizador'}! 👋</h2>
          <p className="text-muted-foreground">{user?.email}</p>
          {balance > 0 && (
            <p className="mt-3 text-sm">
              <Wallet size={14} className="inline mr-1 text-emerald-600" />
              Saldo de reembolsos: <strong>{balance.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</strong>
            </p>
          )}
          {totalSpent > 0 && (
            <p className="mt-1 text-sm">
              <ShoppingBag size={14} className="inline mr-1 text-muted-foreground" />
              Total gasto: <strong>{totalSpent.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</strong>
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <Link href="/account/orders" className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <Package size={24} className="text-accent mb-2" />
            <p className="text-2xl font-bold">{orders.length}</p>
            <p className="text-sm text-muted-foreground">Encomendas</p>
          </Link>
          <Link href="/account/wishlist" className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <Heart size={24} className="text-red-500 mb-2" />
            <p className="text-2xl font-bold">{wishlistCount}</p>
            <p className="text-sm text-muted-foreground">Favoritos</p>
          </Link>
          <Link href="/my-courses" className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <BookOpen size={24} className="text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{courseCount}</p>
            <p className="text-sm text-muted-foreground">Meus Cursos</p>
          </Link>
          <Link href="/account/downloads" className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <Download size={24} className="text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{downloadCount}</p>
            <p className="text-sm text-muted-foreground">Downloads</p>
          </Link>
          <Link href="/account/addresses" className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <MapPin size={24} className="text-green-500 mb-2" />
            <p className="text-2xl font-bold">{addressCount}</p>
            <p className="text-sm text-muted-foreground">Endereços</p>
          </Link>
        </div>

        {/* Recent Orders */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold">Encomendas Recentes</h3>
            <Link href="/account/orders" className="text-sm text-accent hover:underline flex items-center gap-1">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>
          {ordersLoading ? (
            <LoadingSpinner size={24} message="A carregar encomendas..." />
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma encomenda ainda.</p>
              <Link href="/" className="text-accent hover:underline text-sm">Começar a comprar</Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {orders.slice(0, 5).map((order: any) => (
                <Link key={order.id} href={`/account/orders/${order.id}`}
                  className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{order.order_number || `PED-${String(order.id).slice(0, 4)}`}</p>
                    <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('pt-MZ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{Number(order.total_amount).toLocaleString('pt-MZ')} MZN</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
}
