'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Grid3X3, List, ChevronDown, X } from 'lucide-react';
import ProductCard from './ProductCard';
import type { Product } from '../data/marketplace';

interface CategoryShopClientProps {
  products: Product[];
  categoryName: string;
}

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Mais relevantes' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'rating', label: 'Melhor avaliados' },
  { value: 'name', label: 'Nome A-Z' },
];

const PRICE_RANGES = [
  { label: 'Até 500 MZN', min: 0, max: 500 },
  { label: '500 - 1.000 MZN', min: 500, max: 1000 },
  { label: '1.000 - 5.000 MZN', min: 1000, max: 5000 },
  { label: '5.000 - 10.000 MZN', min: 5000, max: 10000 },
  { label: 'Acima de 10.000 MZN', min: 10000, max: Infinity },
];

export default function CategoryShopClient({ products, categoryName }: CategoryShopClientProps) {
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [onlySale, setOnlySale] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (priceRange) {
      result = result.filter((p) => p.price >= priceRange.min && p.price <= priceRange.max);
    }
    if (onlySale) {
      result = result.filter((p) => p.badge === 'sale');
    }
    if (onlyInStock) {
      result = result.filter((p) => p.inStock);
    }
    if (minRating) {
      result = result.filter((p) => p.rating >= minRating);
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return result;
  }, [products, priceRange, onlySale, onlyInStock, minRating, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / perPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * perPage, currentPage * perPage);
  const hasActiveFilters = priceRange || onlySale || onlyInStock || minRating;

  const clearFilters = () => {
    setPriceRange(null);
    setOnlySale(false);
    setOnlyInStock(false);
    setMinRating(null);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="py-8 px-4">
      <div className="max-w-[1500px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-32 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Filtros</h3>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-sm text-accent hover:underline">
                    Limpar
                  </button>
                )}
              </div>

              {/* Preço */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Faixa de Preço</h4>
                <div className="space-y-2">
                  {PRICE_RANGES.map((range) => (
                    <label key={range.label} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground transition-colors">
                      <input
                        type="radio"
                        name="price"
                        checked={priceRange?.min === range.min && priceRange?.max === range.max}
                        onChange={() => setPriceRange(priceRange?.min === range.min ? null : { min: range.min, max: range.max })}
                        className="accent-accent"
                      />
                      {range.label}
                    </label>
                  ))}
                </div>
              </div>

              <hr className="border-border" />

              {/* Disponibilidade */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Disponibilidade</h4>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={onlyInStock} onChange={() => setOnlyInStock(!onlyInStock)} className="accent-accent rounded" />
                  Apenas em stock
                </label>
              </div>

              <hr className="border-border" />

              {/* Ofertas */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Ofertas</h4>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={onlySale} onChange={() => setOnlySale(!onlySale)} className="accent-accent rounded" />
                  Apenas em promoção
                </label>
              </div>

              <hr className="border-border" />

              {/* Avaliação */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Avaliação Mínima</h4>
                <div className="flex gap-1">
                  {[4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      onClick={() => setMinRating(minRating === star ? null : star)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        minRating === star
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border hover:border-accent'
                      }`}
                    >
                      {star}+ ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-card p-4 rounded-lg border border-border">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
                >
                  <SlidersHorizontal size={16} />
                  Filtros
                  {hasActiveFilters && <span className="w-2 h-2 bg-accent rounded-full" />}
                </button>

                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none px-3 py-2 pr-8 border border-border rounded-md text-sm bg-background cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center border border-border rounded-md">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 ${viewMode === 'grid' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Grid3X3 size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${viewMode === 'list' ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <div className="lg:hidden mb-6 bg-card p-4 rounded-lg border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Filtros</h3>
                  <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-muted rounded">
                    <X size={18} />
                  </button>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">Faixa de Preço</h4>
                  <div className="flex flex-wrap gap-2">
                    {PRICE_RANGES.map((range) => (
                      <button
                        key={range.label}
                        onClick={() => setPriceRange(priceRange?.min === range.min ? null : { min: range.min, max: range.max })}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          priceRange?.min === range.min
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border hover:border-accent'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={onlyInStock} onChange={() => setOnlyInStock(!onlyInStock)} className="accent-accent rounded" />
                    Em stock
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={onlySale} onChange={() => setOnlySale(!onlySale)} className="accent-accent rounded" />
                    Promoção
                  </label>
                </div>

                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-sm text-accent hover:underline">
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            )}

            {/* Products Grid/List */}
            {paginatedProducts.length > 0 ? (
              <>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
                      : 'space-y-4'
                  }
                >
                  {paginatedProducts.map((product) =>
                    viewMode === 'grid' ? (
                      <ProductCard key={product.id} product={product} />
                    ) : (
                      <ProductListItem key={product.id} product={product} />
                    )
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-accent text-accent-foreground'
                              : 'border border-border hover:bg-muted'
                          }`}
                        >
                          {pageNum}
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
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground mb-6">
                  Tente ajustar os filtros ou buscar por outra categoria.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors font-medium"
                >
                  Voltar para a página inicial
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* Product List View Item */
function ProductListItem({ product }: { product: Product }) {
  const formatPrice = (price: number) => price.toFixed(2).replace('.', ',');

  return (
    <Link
      href={`/product/${product.slug}`}
      className="flex gap-4 bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow group"
    >
      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base mb-1 group-hover:text-accent transition-colors line-clamp-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={`text-xs ${i < Math.floor(product.rating) ? 'text-accent' : 'text-muted-foreground'}`}>★</span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
          {product.badge === 'sale' && (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">-{product.discount}%</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-accent">{formatPrice(product.price)} MZN</span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">{formatPrice(product.originalPrice)} MZN</span>
          )}
        </div>
      </div>
    </Link>
  );
}
