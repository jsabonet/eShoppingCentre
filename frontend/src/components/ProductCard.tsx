"use client";

import { Star, ShoppingCart } from 'lucide-react';
import type { Product } from '../data/marketplace';
import { useCart } from '../contexts/CartContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();

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

  return (
    <div className="product-card group bg-card border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Image */}
      <a href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
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
      </a>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        {/* Title */}
        <a href={`/product/${product.slug}`} className="mb-1">
          <h3 className="text-sm font-medium line-clamp-2 hover:text-accent transition-colors leading-tight">
            {product.name}
          </h3>
        </a>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">{renderStars(product.rating)}</div>
          <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
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
          <p className="text-xs text-green-600 font-medium mt-1">
            Frete grátis
          </p>
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={() => addToCart(product)}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-semibold rounded-md transition-colors"
        >
          <ShoppingCart size={16} />
          Adicionar
        </button>
      </div>
    </div>
  );
}
