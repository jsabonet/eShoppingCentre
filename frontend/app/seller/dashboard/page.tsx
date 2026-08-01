'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, ShoppingCart, DollarSign, TrendingUp, Star, Clock,
  ArrowUp, ArrowDown, Plus, AlertCircle, RefreshCw, Download, Users
} from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { storesAPI } from '@/src/lib/api';
import type { SellerDashboard } from '@/src/lib/api';

const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

function fmtPrice(v: number): string {
  return v.toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MZN';
}

function fmtNum(v: number): string {
  return v.toLocaleString('pt-MZ');
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora mesmo';
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `Há ${days} dias`;
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short' });
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export default function SellerDashboardPage() {
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: d } = await storesAPI.dashboard();
      setData(d);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={36} message="A carregar dashboard..." />
        </div>
      </SellerLayout>
    );
  }

  if (!data) {
    return (
      <SellerLayout>
        <div className="p-6 flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-600 font-medium mb-2">{error || 'Erro ao carregar dashboard.'}</p>
            <button onClick={fetchDashboard} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm hover:bg-accent/90 flex items-center gap-2 mx-auto">
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        </div>
      </SellerLayout>
    );
  }

  const productType = data.product_type || 'physical';

  const baseStats = [
    { label: 'Vendas Hoje', value: fmtNum(data.today_sales), icon: TrendingUp, color: 'bg-green-100 text-green-700', sub: fmtPrice(data.today_revenue) },
    { label: 'Receita Total', value: fmtPrice(data.total_revenue), icon: DollarSign, color: 'bg-blue-100 text-blue-700', sub: `${fmtNum(data.total_orders)} encomendas` },
    { label: 'Produtos Activos', value: fmtNum(data.total_products), icon: Package, color: 'bg-purple-100 text-purple-700', sub: 'em catálogo' },
    { label: 'Avaliação', value: `${data.store_rating.toFixed(1)} ★`, icon: Star, color: 'bg-pink-100 text-pink-700', sub: 'média da loja' },
  ];

  const typeStats: Record<string, { label: string; value: string; icon: any; color: string; sub: string }[]> = {
    physical: [
      { label: 'Pendentes', value: fmtNum(data.pending_orders), icon: Clock, color: data.pending_orders > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500', sub: 'por processar' },
    ],
    digital: [
      { label: 'Downloads Hoje', value: fmtNum(data.downloaded_today || 0), icon: Download, color: 'bg-cyan-100 text-cyan-700', sub: 'imediatos' },
    ],
    course: [
      { label: 'Alunos Activos', value: fmtNum(data.active_students || 0), icon: Users, color: 'bg-indigo-100 text-indigo-700', sub: 'matriculados' },
    ],
  };

  const stats = [...baseStats, ...(typeStats[productType] || typeStats.physical)];

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Bem-vindo de volta! Aqui está o resumo da sua loja.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchDashboard} disabled={loading} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Actualizar">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <Link
              href="/seller/products/new"
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Novo Produto
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders / Activity */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold">
                {productType === 'course' ? 'Alunos Recentes' : productType === 'digital' ? 'Downloads Recentes' : 'Encomendas Recentes'}
              </h2>
              <Link href="/seller/orders" className="text-sm text-accent hover:underline">Ver todas</Link>
            </div>
            <div className="divide-y divide-border">
              {data?.recent_orders?.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma encomenda ainda.</p>
              )}
              {data?.recent_orders?.map((order) => (
                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{order.customer}</p>
                    <p className="text-xs text-muted-foreground">{order.order_number} • {timeAgo(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{order.total.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status_display}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Produtos Mais Vendidos</h2>
            </div>
            <div className="divide-y divide-border">
              {data?.top_products?.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhum produto vendido ainda.</p>
              )}
              {data?.top_products?.map((product, i) => {
                const imgUrl = product.image
                  ? (product.image.startsWith('http') ? product.image : `${MEDIA_BASE}${product.image.startsWith('/') ? '' : '/'}${product.image}`)
                  : null;
                return (
                  <div key={product.id} className="p-4 flex items-center gap-4">
                    <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    {imgUrl && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sales} unidades vendidas</p>
                    </div>
                    <span className="text-sm font-semibold text-accent">{product.revenue.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
