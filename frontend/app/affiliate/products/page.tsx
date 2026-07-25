'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gift, Search, Percent, Star } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { products } from '@/src/data/marketplace';

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

export default function AffiliateProductsPage() {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <div key={product.id} className="bg-card border border-border rounded-xl overflow-hidden group hover:shadow-md transition-all">
              <Link href={`/product/${product.slug}`}>
                <div className="aspect-square bg-muted overflow-hidden">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              </Link>
              <div className="p-3">
                <Link href={`/product/${product.slug}`}>
                  <h3 className="font-medium text-sm truncate group-hover:text-accent transition-colors">{product.name}</h3>
                </Link>
                <div className="flex items-center gap-1 mt-1">
                  <Star size={12} className="text-accent fill-accent" />
                  <span className="text-xs text-muted-foreground">{product.rating}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-accent text-sm">{formatPrice(product.price)} MZN</span>
                  <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                    <Percent size={10} /> 10%
                  </span>
                </div>
                <button className="w-full mt-2 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-1">
                  <Gift size={12} /> Promover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AffiliateLayout>
  );
}
