"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, MapPin, Package, Store as StoreIcon, Search } from 'lucide-react';

const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || process.env.NEXT_PUBLIC_MEDIA_HOST || 'http://localhost:8000';

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function StoresClient({ stores }: { stores: any[] }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'sales' | 'name'>('rating');
  const [category, setCategory] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => { if (s.category) set.add(s.category); });
    return Array.from(set).sort();
  }, [stores]);

  const filtered = useMemo(() => {
    let result = [...stores];
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.tagline || '').toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q),
      );
    }
    if (category) result = result.filter((s) => s.category === category);
    if (sortBy === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sortBy === 'sales') result.sort((a, b) => (b.total_sales || 0) - (a.total_sales || 0));
    if (sortBy === 'name') result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return result;
  }, [stores, query, sortBy, category]);

  return (
    <section className="max-w-[1500px] mx-auto px-4 py-10">
      {/* Toolbar de filtros */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-6 bg-card p-4 rounded-lg border border-border">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar loja..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-background"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background cursor-pointer"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background cursor-pointer"
          >
            <option value="rating">Melhor avaliadas</option>
            <option value="sales">Mais vendas</option>
            <option value="name">Nome (A–Z)</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{filtered.length} loja(s)</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((store: any) => {
          const coverUrl = mediaUrl(store.banner);
          const logoUrl = mediaUrl(store.logo);
          const storeColor = store.theme_color || '#2563eb';
          return (
            <Link
              key={store.slug}
              href={`/store/${store.slug}`}
              className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="h-32 bg-muted relative overflow-hidden">
                {coverUrl ? (
                  <img src={coverUrl} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${storeColor}22, ${storeColor}44)` }}
                  >
                    <StoreIcon size={48} className="text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="px-5 -mt-8 relative z-10">
                <div className="w-14 h-14 rounded-xl border-4 border-card shadow-md overflow-hidden bg-white">
                  {logoUrl ? (
                    <img src={logoUrl} alt={store.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
                      style={{ backgroundColor: storeColor }}
                    >
                      {store.name?.charAt(0) || 'L'}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 pt-3">
                <h3 className="font-bold text-lg mb-1 group-hover:text-accent transition-colors">{store.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{store.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Star size={14} className="text-yellow-500 fill-yellow-500" /> {Number(store.rating || 0).toFixed(1)}</span>
                  <span className="flex items-center gap-1"><Package size={14} /> {store.total_products} prod.</span>
                  <span className="flex items-center gap-1"><MapPin size={14} /> {store.location}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground col-span-full text-center py-12">Nenhuma loja encontrada.</p>
      )}
    </section>
  );
}
