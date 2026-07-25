'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Grid3X3, List, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from './ProductCard';
import type { Product } from '../data/marketplace';

interface SearchClientProps {
  products: Product[];
  query: string;
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Mais relevantes' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'rating', label: 'Melhor avaliados' },
];

export default function SearchClient({ products, query }: SearchClientProps) {
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [onlySale, setOnlySale] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (onlySale) result = result.filter((p) => p.badge === 'sale');
    if (onlyInStock) result = result.filter((p) => p.inStock);

    switch (sortBy) {
      case 'price-asc': result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'rating': result.sort((a, b) => b.rating - a.rating); break;
      default: break;
    }
    return result;
  }, [products, onlySale, onlyInStock, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / perPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * perPage, currentPage * perPage);
  const hasFilters = onlySale || onlyInStock;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1500px] mx-auto">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-card p-4 rounded-lg border border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
            >
              <SlidersHorizontal size={16} />
              Filtros
              {hasFilters && <span className="w-2 h-2 bg-accent rounded-full" />}
            </button>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="appearance-none px-3 py-2 pr-8 border border-border rounded-md text-sm bg-background cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
          </div>

          <span className="text-sm text-muted-foreground">
            {filteredProducts.length} resultado{filteredProducts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Mobile Filters */}
        {showFilters && (
          <div className="mb-6 bg-card p-4 rounded-lg border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Filtros</h3>
              <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={onlyInStock} onChange={() => { setOnlyInStock(!onlyInStock); setCurrentPage(1); }} className="accent-accent rounded" />
                Em stock
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={onlySale} onChange={() => { setOnlySale(!onlySale); setCurrentPage(1); }} className="accent-accent rounded" />
                Promoção
              </label>
            </div>
            {hasFilters && (
              <button onClick={() => { setOnlySale(false); setOnlyInStock(false); setCurrentPage(1); }} className="text-sm text-accent hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let start = Math.max(1, currentPage - 2);
                  if (start + 4 > totalPages) start = totalPages - 4;
                  const page = start + i;
                  if (page < 1 || page > totalPages) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-accent text-accent-foreground'
                          : 'border border-border hover:bg-muted'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Seguinte
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">😕</div>
            <h3 className="text-xl font-bold mb-2">Nenhum resultado para &ldquo;{query}&rdquo;</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Verifique se escreveu correctamente ou tente termos de pesquisa diferentes.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors font-medium"
            >
              Explorar Produtos
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
