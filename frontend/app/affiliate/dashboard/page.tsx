'use client';

import Link from 'next/link';
import { MousePointerClick, ShoppingCart, DollarSign, TrendingUp, Gift, ArrowUp, ExternalLink } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';

const stats = [
  { label: 'Cliques Totais', value: '1.234', change: '+15%', icon: MousePointerClick, color: 'bg-blue-100 text-blue-700' },
  { label: 'Vendas', value: '52', change: '+8%', icon: ShoppingCart, color: 'bg-green-100 text-green-700' },
  { label: 'Comissões Pendentes', value: '4.250 MZN', change: '', icon: DollarSign, color: 'bg-yellow-100 text-yellow-700' },
  { label: 'Total Ganho', value: '12.870 MZN', change: '+23%', icon: TrendingUp, color: 'bg-accent/10 text-accent' },
];

const recentEarnings = [
  { product: 'Smartphone Pro Max', commission: '499,99 MZN', date: 'Hoje', status: 'pending' },
  { product: 'Fone Bluetooth Premium', commission: '89,99 MZN', date: 'Hoje', status: 'approved' },
  { product: 'Laptop Ultrabook 15"', commission: '649,90 MZN', date: 'Ontem', status: 'approved' },
  { product: 'Smartwatch Sport GPS', commission: '129,90 MZN', date: 'Ontem', status: 'paid' },
  { product: 'Caixa de Som Bluetooth', commission: '44,99 MZN', date: '18 Jul', status: 'paid' },
];

export default function AffiliateDashboardPage() {
  return (
    <AffiliateLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard de Afiliado</h1>
            <p className="text-sm text-muted-foreground">Acompanhe seu desempenho e ganhos</p>
          </div>
          <Link href="/affiliate/links"
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
            <Gift size={16} /> Gerar Links
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}><Icon size={20} /></div>
                  {stat.change && <span className="flex items-center gap-1 text-xs font-medium text-green-600"><ArrowUp size={12} />{stat.change}</span>}
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Produtos Mais Rentáveis</h2>
            </div>
            <div className="divide-y divide-border">
              {[
                { name: 'Smartphone Pro Max', sales: 12, commission: '15%' },
                { name: 'Laptop Ultrabook 15"', sales: 8, commission: '10%' },
                { name: 'Fone Bluetooth Premium', sales: 7, commission: '10%' },
                { name: 'Smartwatch Sport GPS', sales: 5, commission: '10%' },
              ].map((p) => (
                <div key={p.name} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sales} vendas</p>
                  </div>
                  <span className="text-sm font-medium text-accent">Comissão: {p.commission}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Earnings */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Comissões Recentes</h2>
            </div>
            <div className="divide-y divide-border">
              {recentEarnings.map((e) => (
                <div key={e.product} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{e.product}</p>
                    <p className="text-xs text-muted-foreground">{e.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-accent">{e.commission}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      e.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      e.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {e.status === 'pending' ? 'Pendente' : e.status === 'approved' ? 'Aprovado' : 'Pago'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
