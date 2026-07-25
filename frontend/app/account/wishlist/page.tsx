'use client';

import { useState, useEffect } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';
import { usersAPI } from '@/src/lib/api';

export default function WishlistPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login?redirect=/account/wishlist'); return; }
    if (isAuthenticated) { loadWishlist(); }
  }, [isAuthenticated, authLoading]);

  const loadWishlist = async () => {
    try {
      const { data } = await usersAPI.myWishlist();
      setItems(Array.isArray(data) ? data : (data as any).results || []);
    } catch {} finally { setLoading(false); }
  };

  const handleRemove = async (id: string) => {
    try {
      await usersAPI.removeFromWishlist(id);
      setItems((prev) => prev.filter((i: any) => i.id !== id));
    } catch { alert('Erro ao remover.'); }
  };

  if (authLoading) {
    return <AccountLayout><LoadingSpinner size={32} message="A carregar wishlist..." /></AccountLayout>;
  }
  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Lista de Desejos</h2>
          <span className="text-sm text-muted-foreground">{items.length} produto(s)</span>
        </div>

        {loading ? (
          <LoadingSpinner size={24} message="A carregar..." />
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item: any) => {
              const product = item.product || item;
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden group hover:shadow-md transition-all">
                  <Link href={`/product/${product.slug || product.id}`}>
                    <div className="aspect-square bg-muted overflow-hidden relative">
                      <img src={product.primary_image || product.image || ''} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <button onClick={(e) => { e.preventDefault(); handleRemove(item.id); }}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full hover:bg-white text-red-500">
                        <Heart size={16} fill="currentColor" />
                      </button>
                    </div>
                  </Link>
                  <div className="p-3">
                    <Link href={`/product/${product.slug || product.id}`}>
                      <h3 className="font-medium text-sm truncate group-hover:text-accent transition-colors">{product.name}</h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-bold text-accent">{Number(product.price || 0).toLocaleString('pt-MZ')} MZN</span>
                      {product.compare_price && (
                        <span className="text-xs text-muted-foreground line-through">{Number(product.compare_price).toLocaleString('pt-MZ')} MZN</span>
                      )}
                    </div>
                    <Link href={`/product/${product.slug || product.id}`}
                      className="w-full mt-3 px-3 py-2 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-1">
                      <ShoppingBag size={14} /> Ver Produto
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Heart size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">Lista de Desejos vazia</h3>
            <p className="text-muted-foreground mb-6">Salve seus produtos favoritos aqui.</p>
            <Link href="/" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90">Explorar Produtos</Link>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
