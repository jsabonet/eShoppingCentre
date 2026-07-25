'use client';

import Link from 'next/link';
import { Package, ShoppingCart, DollarSign, TrendingUp, Users, Eye, ArrowUp, ArrowDown, Plus, LayoutDashboard } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const stats = [
  { label: 'Vendas Hoje', value: '12', change: '+25%', up: true, icon: TrendingUp, color: 'bg-green-100 text-green-700' },
  { label: 'Receita Total', value: '45.600 MZN', change: '+12%', up: true, icon: DollarSign, color: 'bg-blue-100 text-blue-700' },
  { label: 'Produtos', value: '156', change: '+3 esta semana', up: true, icon: Package, color: 'bg-purple-100 text-purple-700' },
  { label: 'Encomendas Pendentes', value: '8', change: '-2', up: false, icon: ShoppingCart, color: 'bg-orange-100 text-orange-700' },
  { label: 'Total de Encomendas', value: '342', change: '+18%', up: true, icon: ShoppingCart, color: 'bg-teal-100 text-teal-700' },
  { label: 'Avaliação', value: '4.8 ★', change: 'Excelente', up: true, icon: Eye, color: 'bg-pink-100 text-pink-700' },
  { label: 'Afiliados', value: '23', change: '+5 este mês', up: true, icon: Users, color: 'bg-indigo-100 text-indigo-700' },
  { label: 'Comissões Pagas', value: '3.450 MZN', change: '+8%', up: true, icon: DollarSign, color: 'bg-amber-100 text-amber-700' },
];

const recentOrders = [
  { id: 'PED-0421', customer: 'João Silva', items: 3, total: '12.300 MZN', status: 'Pendente', date: 'Hoje, 14:30' },
  { id: 'PED-0420', customer: 'Maria Santos', items: 1, total: '4.798 MZN', status: 'Confirmado', date: 'Hoje, 11:20' },
  { id: 'PED-0419', customer: 'Carlos Macamo', items: 2, total: '3.499 MZN', status: 'Enviado', date: 'Ontem' },
  { id: 'PED-0418', customer: 'Ana Mondlane', items: 1, total: '2.899 MZN', status: 'Entregue', date: 'Ontem' },
  { id: 'PED-0417', customer: 'Pedro Chissano', items: 4, total: '8.990 MZN', status: 'Entregue', date: '20 Jul' },
];

const topProducts = [
  { name: 'Smartphone Pro Max', sales: 45, revenue: '224.999 MZN' },
  { name: 'Fone Bluetooth Premium', sales: 32, revenue: '28.796 MZN' },
  { name: 'Smartwatch Sport GPS', sales: 28, revenue: '36.372 MZN' },
  { name: 'Laptop Ultrabook 15"', sales: 20, revenue: '129.980 MZN' },
  { name: 'Caixa de Som Bluetooth', sales: 18, revenue: '8.098 MZN' },
];

export default function SellerDashboardPage() {
  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Bem-vindo de volta! Aqui está o resumo da sua loja.</p>
          </div>
          <Link
            href="/seller/products/new"
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Novo Produto
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium ${stat.up ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold">Encomendas Recentes</h2>
              <Link href="/seller/orders" className="text-sm text-accent hover:underline">Ver todas</Link>
            </div>
            <div className="divide-y divide-border">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{order.customer}</p>
                    <p className="text-xs text-muted-foreground">{order.id} • {order.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{order.total}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      order.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'Confirmado' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'Enviado' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {order.status}
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
              {topProducts.map((product, i) => (
                <div key={product.name} className="p-4 flex items-center gap-4">
                  <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sales} unidades vendidas</p>
                  </div>
                  <span className="text-sm font-semibold text-accent">{product.revenue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
