'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, DollarSign, MousePointerClick, RefreshCw } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { affiliatesAPI } from '@/src/lib/api';
import type { StoreAffiliatesData } from '@/src/lib/api';

export default function SellerAffiliatesPage() {
  const [data, setData] = useState<StoreAffiliatesData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await affiliatesAPI.storeAffiliates();
      setData(d);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  const affiliates = data?.affiliates || [];

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Afiliados</h1>
            <p className="text-sm text-muted-foreground">Gerencie os afiliados que promovem seus produtos</p>
          </div>
          <button onClick={fetch} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Actualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Users size={18} className="text-blue-600" /><span className="text-sm text-muted-foreground">Total Afiliados</span></div>
            <p className="text-2xl font-bold">{data?.total_affiliates || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><MousePointerClick size={18} className="text-purple-600" /><span className="text-sm text-muted-foreground">Total Cliques</span></div>
            <p className="text-2xl font-bold">{data?.total_clicks || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><span className="text-sm text-muted-foreground">Vendas por Afiliados</span></div>
            <p className="text-2xl font-bold">{data?.total_sales || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className="text-accent" /><span className="text-sm text-muted-foreground">Comissões</span></div>
            <p className="text-2xl font-bold">{Number(data?.total_commission || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Afiliado</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliques</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendas</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Conversão</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Comissão</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {affiliates.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum afiliado promoveu seus produtos ainda.</td></tr>
                )}
                {affiliates.map((aff) => (
                  <tr key={aff.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{aff.name}</p>
                        <p className="text-xs text-muted-foreground">{aff.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">{aff.total_clicks}</td>
                    <td className="py-3 px-4">{aff.total_sales}</td>
                    <td className="py-3 px-4">{aff.total_clicks > 0 ? ((aff.total_sales / aff.total_clicks) * 100).toFixed(1) + '%' : '—'}</td>
                    <td className="py-3 px-4 font-medium">{Number(aff.total_commission).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${aff.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {aff.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
