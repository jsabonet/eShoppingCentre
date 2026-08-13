'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Gift, Search, Percent, Star, Loader2, Check, Copy } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { affiliatesAPI } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

export default function AffiliateProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/products/?page_size=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      const data = await res.ok ? await res.json() : null;
      setProducts(data?.results || data || []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const promote = async (product: any) => {
    setCreatingId(product.id);
    setCreatedUrl(null);
    try {
      const { data } = await affiliatesAPI.createLink(product.id);
      setCreatedUrl(data.short_url);
    } catch {} finally { setCreatingId(null); }
  };

  const media = (img: string | null) => img ? (img.startsWith('http') ? img : MEDIA_URL + (img.startsWith('/') ? img : '/' + img)) : '';

  return (
    <AffiliateLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Produtos para Promover</h1>
          <p className="text-sm text-muted-foreground">Escolha produtos e ganhe comissão por cada venda</p>
        </div>

        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar produtos..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <div key={product.id} className="bg-card border border-border rounded-xl overflow-hidden group hover:shadow-md transition-all">
                <Link href={`/product/${product.slug}`}>
                  <div className="aspect-square bg-muted overflow-hidden">
                    {product.primary_image || product.images?.[0]?.image ? (
                      <img src={media(product.primary_image || product.images?.[0]?.image)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Gift size={32} /></div>
                    )}
                  </div>
                </Link>
                <div className="p-3">
                  <Link href={`/product/${product.slug}`}>
                    <h3 className="font-medium text-sm truncate group-hover:text-accent transition-colors">{product.name}</h3>
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-accent text-sm">{Number(product.price).toLocaleString('pt-MZ')} MZN</span>
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                      <Percent size={10} /> {Number(product.affiliate_commission || 10)}%
                    </span>
                  </div>
                  {createdUrl ? (
                    <div className="mt-2">
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{createdUrl}</p>
                      <button onClick={() => navigator.clipboard.writeText(createdUrl)}
                        className="w-full mt-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 flex items-center justify-center gap-1">
                        <Copy size={12} /> Copiar Link
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => promote(product)} disabled={creatingId === product.id}
                      className="w-full mt-2 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
                      {creatingId === product.id ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />} Promover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AffiliateLayout>
  );
}
