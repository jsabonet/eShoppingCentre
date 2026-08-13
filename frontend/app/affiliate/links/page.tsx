'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link as LinkIcon, Copy, Check, ExternalLink, RefreshCw, Loader2, Plus } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { affiliatesAPI, type AffiliateLink } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function AffiliateLinksPage() {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [linksRes, prodRes] = await Promise.all([
        affiliatesAPI.myLinks(),
        fetch(`${API_URL}/products/?page_size=100&affiliate_enabled=true`, { headers: headers() }).then(r => r.ok ? r.json() : null),
      ]);
      setLinks(Array.isArray(linksRes.data) ? linksRes.data : linksRes.data.results || []);
      const prodData = prodRes?.results || prodRes || [];
      setProducts(prodData);
    } catch { setLinks([]); setProducts([]); }
    finally { setLoading(false); }
  }, [headers]);

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
          <div className="space-y-4">
            {links.map((link) => (
              <div key={link.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm">{link.product_name || 'Produto'}</h3>
                    <p className="text-xs text-muted-foreground font-mono truncate">{link.short_url}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
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
      </div>
    </AffiliateLayout>
  );
}
