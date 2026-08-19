"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import ProductCard from './ProductCard';
import { productsAPI } from '../lib/api';
import type { Product } from '../data/marketplace';
import { mapProduct } from '../lib/productMapping';
import { ProductGridSkeleton } from './Skeletons';

const SORT_OPTIONS = [
  { value: '', label: 'Mais relevantes' },
  { value: '-price', label: 'Menor preço' },
  { value: 'price', label: 'Maior preço' },
  { value: '-rating', label: 'Melhor avaliados' },
  { value: '-sales_count', label: 'Mais vendidos' },
  { value: '-created_at', label: 'Mais recentes' },
];

const PRICE_RANGES = [
  { label: 'Qualquer preço', min: null as number | null, max: null as number | null },
  { label: 'Até 500 MZN', min: 0, max: 500 },
  { label: '500 – 1.000 MZN', min: 500, max: 1000 },
  { label: '1.000 – 5.000 MZN', min: 1000, max: 5000 },
  { label: 'Acima de 5.000 MZN', min: 5000, max: null },
];

interface CategoryProductsProps {
  categorySlug: string;
  initialProducts: Product[];
  initialHasMore: boolean;
}

export default function CategoryProducts({ categorySlug, initialProducts, initialHasMore }: CategoryProductsProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const firstRender = useRef(true);

  const [sortBy, setSortBy] = useState('');
  const [onlySale, setOnlySale] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [priceIdx, setPriceIdx] = useState(0);

  const buildParams = useCallback(
    (pageNum: number) => {
      const range = PRICE_RANGES[priceIdx];
      const params: Record<string, any> = { category: categorySlug, page: pageNum, page_size: 20 };
      if (sortBy) params.ordering = sortBy;
      if (onlySale) params.is_on_sale = 'true';
      if (onlyInStock) params.has_stock = 'true';
      if (minRating) params.min_rating = minRating;
      if (range && range.min != null) params.min_price = range.min;
      if (range && range.max != null) params.max_price = range.max;
      return params;
    },
    [categorySlug, sortBy, onlySale, onlyInStock, minRating, priceIdx],
  );

  const fetchPage = useCallback(
    async (pageNum: number, reset: boolean) => {
      setLoading(true);
      if (reset) setInitialLoading(true);
      try {
        const { data } = await productsAPI.list(buildParams(pageNum));
        const mapped = (data.results || []).map(mapProduct);
        setProducts((prev) => (reset ? mapped : [...prev, ...mapped]));
        setHasMore(!!data.next);
        setPage(pageNum);
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [buildParams],
  );

  // Refetch (página 1) quando os filtros mudam — não no primeiro render.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = () => fetchPage(page + 1, false);

  const hasFilters = onlySale || onlyInStock || !!minRating || priceIdx > 0;
  const clearFilters = () => {
    setOnlySale(false);
    setOnlyInStock(false);
    setMinRating('');
    setPriceIdx(0);
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1500px] mx-auto">
        {/* Toolbar de filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">{products.length} produto(s)</span>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} className="accent-accent rounded" />
              Em stock
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={onlySale} onChange={(e) => setOnlySale(e.target.checked)} className="accent-accent rounded" />
              Em promoção
            </label>
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="px-2 py-1.5 border border-border rounded-md text-sm bg-background cursor-pointer">
              <option value="">Todas as avaliações</option>
              <option value="4">4★ ou mais</option>
              <option value="3">3★ ou mais</option>
            </select>
            <select value={priceIdx} onChange={(e) => setPriceIdx(Number(e.target.value))} className="px-2 py-1.5 border border-border rounded-md text-sm bg-background cursor-pointer">
              {PRICE_RANGES.map((r, i) => (
                <option key={r.label} value={i}>{r.label}</option>
              ))}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-accent hover:underline">Limpar</button>
            )}
          </div>
          <div className="relative">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none px-3 py-2 pr-8 border border-border rounded-md text-sm bg-background cursor-pointer">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>

        {/* Resultados */}
        {initialLoading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Nenhum produto encontrado.</p>
            <p className="text-sm">Tenta limpar os filtros.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2.5 border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {loading ? 'A carregar...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
