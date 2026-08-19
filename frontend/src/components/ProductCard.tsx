"use client";

import { useState } from 'react';
import { Star, ShoppingCart, Heart, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Product } from '../data/marketplace';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../hooks/useAuth';
import { usersAPI } from '../lib/api';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [wished, setWished] = useState(false);
  const [wishLoading, setWishLoading] = useState(false);

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={14}
        className={i < Math.floor(rating) ? 'fill-accent text-accent' : 'text-muted-foreground'}
      />
    ));
  };

  const productType = product.productType || 'physical';
  const ctaLabel = productType === 'course' ? 'Ver Curso' : productType === 'digital' ? 'Comprar' : 'Adicionar';

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      router.push('/login?redirect=' + encodeURIComponent('/product/' + product.slug));
      return;
    }
    if (wishLoading) return;
    setWishLoading(true);
    try {
      if (wished) {
        await usersAPI.removeFromWishlist(product.id);
        setWished(false);
      } else {
        await usersAPI.addToWishlist(product.id);
        setWished(true);
      }
    } catch {
      // falha silenciosa — o estado é revertido na próxima interação
    } finally {
      setWishLoading(false);
    }
  };

  const handleCta = () => {
    if (productType === 'course') {
      router.push('/product/' + product.slug);
      return;
    }
    addToCart(product);
  };

  return (
    <div className="product-card group bg-card border border-border rounded-lg overflow-hidden flex flex-col relative">
      {/* Image */}
      <a href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.badge === 'sale' && product.discount && (
          <span className="absolute top-2 left-2 badge-sale">
            -{product.discount}%
          </span>
        )}
        {product.badge === 'new' && (
          <span className="absolute top-2 left-2 badge-new">NOVO</span>
        )}
        {productType !== 'physical' && (
          <span className="absolute bottom-2 left-2 badge-new">
            {productType === 'course' ? 'CURSO' : 'DIGITAL'}
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-black/70 text-white text-xs font-semibold px-3 py-1 rounded-full">Esgotado</span>
          </div>
        )}
      </a>

      {/* Wishlist heart */}
      <button
        onClick={toggleWishlist}
        aria-label="Adicionar aos favoritos"
        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm transition-colors z-10"
      >
        <Heart size={16} className={wished ? 'fill-red-500 text-red-500' : 'text-muted-foreground'} />
      </button>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        {/* Title */}
        <a href={`/product/${product.slug}`} className="mb-1">
          <h3 className="text-sm font-medium line-clamp-2 hover:text-accent transition-colors leading-tight">
            {product.name}
          </h3>
        </a>

        {/* Store */}
        {product.storeName && (
          <a
            href={`/store/${product.storeSlug || ''}`}
            className="text-xs text-muted-foreground hover:text-accent transition-colors line-clamp-1 mb-1"
          >
            {product.storeName}
          </a>
        )}

        {/* Rating + sales */}
        <div className="flex items-center gap-1 mb-2">
          {product.rating > 0 && (
            <div className="flex">{renderStars(product.rating)}</div>
          )}
          {typeof product.salesCount === 'number' && product.salesCount > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {product.salesCount} vendidos
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-auto">
          {product.originalPrice && (
            <p className="price-original">
              {formatPrice(product.originalPrice)} MZN
            </p>
          )}
          <p className="price-current text-lg">
            {formatPrice(product.price)} MZN
          </p>
          {product.discount && (
            <p className="price-discount">
              Economize {product.discount}%
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleCta}
          disabled={!product.inStock}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {productType === 'course' ? <BookOpen size={16} /> : <ShoppingCart size={16} />}
          {product.inStock ? ctaLabel : 'Esgotado'}
        </button>
      </div>
    </div>
  );
}
