import { CartProvider } from '../../components/CartContext';
import ProductCard from '../../components/ProductCard';
import CartDrawer from '../../components/CartDrawer';
import type { Product } from '../data/marketplace';

interface SearchShopProps {
  products: Product[];
  similarProducts?: Product[];
}

export default function SearchShop({ products, similarProducts = [] }: SearchShopProps) {
  return (
    <CartProvider>
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
      
      {similarProducts.length > 0 && (
        <>
          <div class="mt-8 pt-8 border-t border-border">
            <div class="flex items-center gap-2 mb-6">
              <span class="text-xl">🤖</span>
              <h2 class="text-xl font-bold">Produtos Semelhantes (Sugestões IA)</h2>
            </div>
            <p class="text-sm text-muted-foreground mb-4">
              Baseado na sua pesquisa, nossa IA recomenda estes produtos que podem interessar:
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {similarProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </>
      )}
      
      <CartDrawer />
    </CartProvider>
  );
}
