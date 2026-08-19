"use client";

import { useCallback, useState } from 'react';
import { Package } from 'lucide-react';
import ProductCard from './ProductCard';
import { productsAPI } from '../lib/api';
import type { Product } from '../data/marketplace';
import { mapProduct } from '../lib/productMapping';

interface StoreProductsProps {
  storeSlug: string;
  initialProducts: Product[];
  initialHasMore: boolean;
}

export default function StoreProducts({ storeSlug, initialProducts, initialHasMore }: StoreProductsProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const next = page + 1;
      const { data } = await productsAPI.list({ store: storeSlug, page: next, page_size: 12, ordering: '-is_featured,-created_at' });
      const mapped = (data.results || []).map(mapProduct);
      setProducts((prev) => [...prev, ...mapped]);
      setHasMore(!!data.next);
      setPage(next);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [storeSlug, page]);

  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
        <Package size={48} className="mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium">Nenhum produto ainda</p>
        <p className="text-sm mt-1">Esta loja ainda não publicou produtos.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
    </div>
  );
}
