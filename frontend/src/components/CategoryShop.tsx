"use client";

import { CartProvider } from '../contexts/CartContext';
import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import type { Product } from '../data/marketplace';

interface CategoryShopProps {
  products: Product[];
}

export default function CategoryShop({ products }: CategoryShopProps) {
  return (
    <CartProvider>
      <section id="products" className="py-8 px-4">
        <div className="max-w-[1500px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Todos os Produtos</h2>
            <select className="px-3 py-2 border border-border rounded-md text-sm bg-background">
              <option>Mais relevantes</option>
              <option>Menor preço</option>
              <option>Maior preço</option>
              <option>Mais vendidos</option>
              <option>Melhor avaliados</option>
            </select>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground mb-4">
                Nenhum produto encontrado nesta categoria.
              </p>
              <a href="/" className="text-accent hover:underline font-medium">
                Voltar para a página inicial
              </a>
            </div>
          )}
        </div>
      </section>
      <CartDrawer />
    </CartProvider>
  );
}
