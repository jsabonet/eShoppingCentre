'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MousePointerClick, ShoppingCart, DollarSign, TrendingUp, Gift, RefreshCw, Loader2 } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { affiliatesAPI, type AffiliateProfile } from '@/src/lib/api';

export default function AffiliateDashboardPage() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await affiliatesAPI.myProfile();
      setProfile(data);
    } catch {
      setError('Ainda não é afiliado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <AffiliateLayout><div className="p-6 flex justify-center py-20"><Loader2 size={28} className="animate-spin text-muted-foreground" /></div></AffiliateLayout>;
  }

  if (error || !profile) {
    return (
      <AffiliateLayout>
        <div className="p-6 text-center py-20">
          <Gift size={48} className="mx-auto text-muted-foreground mb-4 opacity-40" />
          <p className="text-muted-foreground mb-4">{error || 'Perfil não encontrado.'}</p>
          <Link href="/affiliate/register" className="px-5 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium">Tornar-me Afiliado</Link>
        </div>
      </AffiliateLayout>
    );
  }

  const cards = [
    { label: 'Cliques Totais', value: String(profile.total_clicks), icon: MousePointerClick, color: 'bg-blue-100 text-blue-700' },
    { label: 'Vendas', value: String(profile.total_sales), icon: ShoppingCart, color: 'bg-green-100 text-green-700' },
    { label: 'Comissão Disponível', value: `${Number(profile.available_commission).toLocaleString('pt-MZ')} MZN`, icon: DollarSign, color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Total Ganho', value: `${Number(profile.total_commission).toLocaleString('pt-MZ')} MZN`, icon: TrendingUp, color: 'bg-accent/10 text-accent' },
  ];

  return (
    <AffiliateLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard de Afiliado</h1>
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-semibold">{profile.referral_code}</span> · Tier: <span className="capitalize">{profile.commission_tier}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
            <Link href="/affiliate/links" className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2">
              <Gift size={16} /> Gerar Links
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {cards.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className={`p-2 rounded-lg inline-block mb-2 ${stat.color}`}><Icon size={20} /></div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-bold mb-4">Comece a Promover</h2>
          <p className="text-sm text-muted-foreground mb-4">Gere links únicos e partilhe-os no WhatsApp, Facebook ou Instagram para ganhar comissões.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/affiliate/products" className="px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90">Escolher Produtos</Link>
            <Link href="/affiliate/links" className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Meus Links</Link>
            <Link href="/affiliate/earnings" className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Ver Comissões</Link>
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
