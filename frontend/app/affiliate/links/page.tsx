'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link as LinkIcon, Copy, Check, ExternalLink, RefreshCw, Loader2, Plus, Search, Download } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { affiliatesAPI, productsAPI, type AffiliateLink } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

export default function AffiliateLinksPage() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allLinks, allProducts] = await Promise.all([
        (async () => {
          const results: AffiliateLink[] = [];
          let page = 1;
          let hasNext = true;
          while (hasNext) {
            const { data } = await affiliatesAPI.myLinks({ page_size: 100, page });
            results.push(...(data.results || []));
            hasNext = Boolean(data.next);
            page += 1;
          }
          return results;
        })(),
        (async () => {
          const results: any[] = [];
          let page = 1;
          let hasNext = true;
          while (hasNext) {
            const { data } = await productsAPI.list({ page_size: 100, page, affiliate_enabled: true });
            results.push(...(data.results || []));
            hasNext = Boolean(data.next);
            page += 1;
          }
          return results;
        })(),
      ]);
      setLinks(allLinks);
      setProducts(allProducts);
    } catch (error) {
      console.error('Falha ao carregar links e produtos de afiliado:', error);
      setLinks([]);
      setProducts([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createLink = async () => {
    if (!productId) return;
    setCreating(true);
    try {
      await affiliatesAPI.createLink(productId);
      setProductId('');
      await load();
    } catch {} finally { setCreating(false); }
  };

  const copyToClipboard = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLinks = links.filter((link) => {
    const query = search.trim().toLowerCase();
    return !query || [link.product_name, link.code, link.short_url]
      .some((value) => String(value || '').toLowerCase().includes(query));
  });
  const totalClicks = filteredLinks.reduce((sum, link) => sum + link.clicks, 0);
  const totalConversions = filteredLinks.reduce((sum, link) => sum + link.conversions, 0);

  const exportLinks = () => {
    const rows = filteredLinks.map((link) => ({
      produto: link.product_name,
      codigo: link.code,
      url: link.short_url,
      cliques: link.clicks,
      vendas: link.conversions,
      conversao: link.clicks > 0 ? `${((link.conversions / link.clicks) * 100).toFixed(1)}%` : '0%',
    }));
    const extension = reportFormat === 'excel' ? 'xlsx' : reportFormat;
    downloadReportFromObjects(reportFormat, `links-afiliado-${new Date().toISOString().slice(0, 10)}.${extension}`,
      'Relatório de links de afiliado', ['produto', 'codigo', 'url', 'cliques', 'vendas', 'conversao'], rows, {
        subtitle: 'Alcance e conversões acumulados por link de referência.',
        filters: [{ label: 'Pesquisa', value: search || 'Sem pesquisa' }],
        summary: [
          { label: 'Links', value: filteredLinks.length },
          { label: 'Cliques', value: totalClicks },
          { label: 'Vendas atribuídas', value: totalConversions },
          { label: 'Conversão global', value: totalClicks ? `${((totalConversions / totalClicks) * 100).toFixed(1)}%` : '0%' },
        ],
        columns: ['Produto', 'Código', 'URL de referência', 'Cliques', 'Vendas', 'Conversão'],
        notes: ['Cliques e vendas são contagens acumuladas por link. A conversão global é calculada a partir dos totais apresentados.'],
      });
  };

  return (
    <AffiliateLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Meus Links de Afiliado</h1>
            <p className="text-sm text-muted-foreground">Gere e partilhe links únicos para cada produto</p>
          </div>
          <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
        </div>

        {/* Generate Link */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="font-bold mb-4">Gerar Novo Link</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={productId} onChange={e => setProductId(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Selecionar produto...</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button onClick={createLink} disabled={!productId || creating}
              className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Gerar Link
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
        ) : links.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <LinkIcon size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground">Ainda não tem links. Gere o primeiro acima.</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Links filtrados</p><p className="text-xl font-bold">{filteredLinks.length}</p></div>
            <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Cliques</p><p className="text-xl font-bold">{totalClicks}</p></div>
            <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Vendas atribuídas</p><p className="text-xl font-bold">{totalConversions}</p></div>
          </div>
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <label className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto, código ou URL"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
            </label>
            <select aria-label="Formato do relatório" value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
            </select>
            <button type="button" onClick={exportLinks} disabled={!filteredLinks.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              <Download size={15} /> Exportar
            </button>
          </div>
          {filteredLinks.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhum link corresponde à pesquisa.</p> : (
          <div className="space-y-4">
            {filteredLinks.map((link) => (
              <div key={link.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm">{link.product_name || 'Produto'}</h3>
                    <p className="text-xs text-muted-foreground font-mono truncate">{link.short_url}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyToClipboard(link.id, link.short_url)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors" title="Copiar link">
                      {copiedId === link.id ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    </button>
                    <a href={link.short_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted rounded-lg transition-colors" title="Abrir">
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{link.clicks} cliques</span>
                  <span>{link.conversions} vendas</span>
                </div>
              </div>
            ))}
          </div>
          )}
          </>
        )}
      </div>
    </AffiliateLayout>
  );
}
