'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, DollarSign, MousePointerClick, RefreshCw, Search, Download } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { affiliatesAPI } from '@/src/lib/api';
import type { StoreAffiliatesData } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

export default function SellerAffiliatesPage() {
  const [data, setData] = useState<StoreAffiliatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');

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
  const filteredAffiliates = affiliates.filter((affiliate) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [affiliate.name, affiliate.email]
      .some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || String(affiliate.is_active) === statusFilter);
  });
  const totalClicks = filteredAffiliates.reduce((total, affiliate) => total + affiliate.total_clicks, 0);
  const totalSales = filteredAffiliates.reduce((total, affiliate) => total + affiliate.total_sales, 0);
  const totalCommission = filteredAffiliates.reduce((total, affiliate) => total + Number(affiliate.total_commission), 0);

  const exportAffiliates = () => {
    const rows = filteredAffiliates.map((affiliate) => ({
      afiliado: affiliate.name,
      email: affiliate.email,
      cliques: affiliate.total_clicks,
      vendas: affiliate.total_sales,
      conversao: affiliate.total_clicks > 0 ? `${((affiliate.total_sales / affiliate.total_clicks) * 100).toFixed(1)}%` : '0%',
      comissao: Number(affiliate.total_commission),
      estado: affiliate.is_active ? 'Activo' : 'Inactivo',
    }));
    const extension = reportFormat === 'excel' ? 'xlsx' : reportFormat;
    downloadReportFromObjects(reportFormat, `afiliados-loja-${new Date().toISOString().slice(0, 10)}.${extension}`,
      'Relatório de afiliados da loja', ['afiliado', 'email', 'cliques', 'vendas', 'conversao', 'comissao', 'estado'], rows);
  };

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
            <p className="text-2xl font-bold">{filteredAffiliates.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><MousePointerClick size={18} className="text-purple-600" /><span className="text-sm text-muted-foreground">Total Cliques</span></div>
            <p className="text-2xl font-bold">{totalClicks}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><span className="text-sm text-muted-foreground">Vendas por Afiliados</span></div>
            <p className="text-2xl font-bold">{totalSales}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className="text-accent" /><span className="text-sm text-muted-foreground">Comissões</span></div>
            <p className="text-2xl font-bold">{totalCommission.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-3 border-b border-border p-4">
            <label className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar afiliado ou email"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
            </label>
            <select aria-label="Filtrar afiliados por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="all">Todos os estados</option><option value="true">Activos</option><option value="false">Inactivos</option>
            </select>
            <select aria-label="Formato do relatório" value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
            </select>
            <button type="button" onClick={exportAffiliates} disabled={!filteredAffiliates.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              <Download size={15} /> Exportar
            </button>
          </div>
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
                {filteredAffiliates.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum afiliado promoveu seus produtos ainda.</td></tr>
                )}
                {filteredAffiliates.map((aff) => (
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
