"use client";

import { useState } from 'react';
import { Star, Truck, Shield, RotateCcw, ShoppingCart } from 'lucide-react';
import { CartProvider, useCart } from '../contexts/CartContext';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import type { Product } from '../data/marketplace';

interface ProductDetailShopProps {
  product: Product;
  categoryName?: string;
  categorySlug?: string;
  relatedProducts: Product[];
}

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

function StarRating({ rating }: { rating: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={16}
          className={i < Math.floor(rating) ? 'fill-accent text-accent' : 'text-muted-foreground'}
        />
      ))}
    </>
  );
}

function StarRatingLg({ rating }: { rating: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={18}
          className={i < Math.floor(rating) ? 'fill-accent text-accent' : 'text-muted-foreground'}
        />
      ))}
    </>
  );
}

function ProductDetailContent({ product, categoryName, categorySlug, relatedProducts }: ProductDetailShopProps) {
  const { addToCart } = useCart();
  const variants = product.variants || [];
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || null;
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayStock = selectedVariant ? selectedVariant.stock : (product.inStock ? 1 : 0);
  const displayImage = selectedVariant?.image || product.image;

  // Group variant attributes for rendering selectors
  const attrKeys = variants.length > 0
    ? [...new Set(variants.flatMap((v) => Object.keys(v.attributes || {})))]
    : [];

  const groupedByAttr = (key: string) => {
    const seen = new Set<string>();
    return variants.filter((v) => {
      const val = v.attributes?.[key];
      if (!val || seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  };

  return (
    <>
      {/* Product Detail */}
      <section id="product-detail" className="py-8 px-4">
        <div className="max-w-[1500px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Product Image */}
            <div className="lg:col-span-5">
              <div className="sticky top-32">
                <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden mb-4">
                  <img
                    src={displayImage}
                    alt={selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="aspect-square bg-card border-2 border-accent rounded-md overflow-hidden cursor-pointer">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="aspect-square bg-card border border-border rounded-md overflow-hidden cursor-pointer opacity-60">
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      Imagem 2
                    </div>
                  </div>
                  <div className="aspect-square bg-card border border-border rounded-md overflow-hidden cursor-pointer opacity-60">
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      Imagem 3
                    </div>
                  </div>
                  <div className="aspect-square bg-card border border-border rounded-md overflow-hidden cursor-pointer opacity-60">
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      Imagem 4
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="lg:col-span-4">
              <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>

              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  <StarRating rating={product.rating} />
                </div>
                <a href="#reviews" className="text-sm text-accent hover:underline">
                  {product.reviewCount} avaliações
                </a>
              </div>

              {/* Price */}
              <div className="border-y border-border py-4 mb-4">
                {product.originalPrice && (
                  <p className="price-original mb-1">
                    MZN {formatPrice(product.originalPrice)}
                  </p>
                )}
                <p className="text-3xl font-bold mb-1">
                  MZN {formatPrice(product.price)}
                </p>
                {product.discount && (
                  <p className="price-discount">
                    Economize {product.discount}% (MZN {formatPrice(product.originalPrice! - product.price)})
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  ou 12x de MZN {formatPrice(product.price / 12)} sem juros
                </p>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="font-bold mb-2">Sobre este produto</h3>
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              </div>

              {/* Variant Selector */}
              {variants.length > 0 && attrKeys.map((key) => (
                <div key={key} className="mb-4">
                  <p className="text-sm font-medium mb-2">{key}</p>
                  <div className="flex flex-wrap gap-2">
                    {groupedByAttr(key).map((v) => {
                      const isSelected = selectedVariantId === v.id;
                      const attrVal = v.attributes?.[key];
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                            isSelected
                              ? 'border-accent bg-accent/10 text-accent font-medium'
                              : 'border-border hover:border-accent/50'
                          } ${!v.is_active ? 'opacity-40 cursor-not-allowed' : ''}`}
                          disabled={!v.is_active}
                        >
                          {attrVal || v.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Benefits */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <Truck size={18} className="text-accent" />
                  <span>Frete grátis para todo Moçambique</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield size={18} className="text-accent" />
                  <span>Garantia de 12 meses</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <RotateCcw size={18} className="text-accent" />
                  <span>Devolução gratuita em até 30 dias</span>
                </div>
              </div>
            </div>

            {/* Buy Box */}
            <div className="lg:col-span-3">
              <div className="sticky top-32 border border-border rounded-lg p-4 bg-card">
                <p className="text-2xl font-bold mb-1">
                  MZN {formatPrice(displayPrice)}
                </p>
                {selectedVariant && selectedVariant.price !== null && selectedVariant.price !== product.price && (
                  <p className="text-xs text-muted-foreground mb-1">Preço base: MZN {formatPrice(product.price)}</p>
                )}
                <p className="text-sm text-green-600 font-medium mb-4">
                  <Truck size={14} className="inline" /> Frete grátis
                </p>

                <p className="text-sm mb-2">
                  {displayStock > 0 ? (
                    <span className="text-green-600 font-semibold">
                      {variants.length > 0 ? `${displayStock} em estoque` : 'Em estoque'}
                    </span>
                  ) : (
                    <span className="text-red-600 font-semibold">Fora de estoque</span>
                  )}
                </p>
                {selectedVariant && <p className="text-xs text-muted-foreground mb-4">{selectedVariant.name}</p>}
                {!selectedVariant && variants.length > 0 && (
                  <p className="text-xs text-amber-600 mb-4">Seleccione as opções acima</p>
                )}
                {(!variants.length || selectedVariant) && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">Entrega em 3-5 dias úteis</p>
                    <button
                      onClick={() => addToCart({ ...product, price: displayPrice, inStock: displayStock > 0, image: displayImage })}
                      disabled={displayStock === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart size={18} /> Adicionar ao Carrinho
                    </button>
                  </>
                )}

                <a
                  href="/cart"
                  className="block w-full text-center px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md transition-colors"
                >
                  Comprar Agora
                </a>

                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                  <p>Vendido e entregue por e-Shopping</p>
                  <p>Parcelamento em até 12x sem juros</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Details Section */}
      <section id="product-info" className="py-8 px-4 bg-card border-t border-border">
        <div className="max-w-[1500px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Detalhes do Produto</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-muted-foreground">Categoria</td>
                    <td className="py-2">{categoryName || 'Geral'}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-muted-foreground">Disponibilidade</td>
                    <td className="py-2 text-green-600 font-medium">Em estoque</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-muted-foreground">Garantia</td>
                    <td className="py-2">12 meses</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-muted-foreground">Frete</td>
                    <td className="py-2 text-green-600 font-medium">Grátis</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4" id="reviews">Avaliações dos Clientes</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold">{product.rating}</div>
                <div>
                  <div className="flex mb-1">
                    <StarRatingLg rating={product.rating} />
                  </div>
                  <p className="text-sm text-muted-foreground">{product.reviewCount} avaliações</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { stars: '5 ★', pct: 75 },
                  { stars: '4 ★', pct: 15 },
                  { stars: '3 ★', pct: 6 },
                  { stars: '2 ★', pct: 2 },
                  { stars: '1 ★', pct: 2 },
                ].map((row) => (
                  <div key={row.stars} className="flex items-center gap-2">
                    <span className="w-12">{row.stars}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="w-8 text-right">{row.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Similar Products */}
      {relatedProducts.length > 0 && (
        <section id="ai-recommendations" className="py-12 px-4 bg-gradient-to-r from-accent/5 to-accent/10">
          <div className="max-w-[1500px] mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🤖</span>
              <h2 className="text-2xl font-bold">Recomendações Inteligentes</h2>
              <span className="px-2 py-1 bg-accent text-accent-foreground text-xs font-bold rounded">IA</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Nossa IA analisou este produto e encontrou itens semelhantes que você pode gostar
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {relatedProducts.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section id="related" className="py-12 px-4">
          <div className="max-w-[1500px] mx-auto">
            <h2 className="text-2xl font-bold mb-6">Produtos Relacionados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CartDrawer />
    </>
  );
}

export default function ProductDetailShop(props: ProductDetailShopProps) {
  return (
    <CartProvider>
      <ProductDetailContent {...props} />
    </CartProvider>
  );
}
