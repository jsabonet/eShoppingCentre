import ProductCard from './ProductCard';
import CartDrawer from './CartDrawer';
import type { Product } from '../data/marketplace';

interface SearchShopProps {
  products: Product[];
  similarProducts?: Product[];
}

export default function SearchShop({ products, similarProducts = [] }: SearchShopProps) {
  return (
    <>
      {products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
      
      {similarProducts.length > 0 && (
        <>
          <div className="mt-8 pt-8 border-t border-border">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">🤖</span>
              <h2 className="text-xl font-bold">Produtos Semelhantes (Sugestões IA)</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Baseado na sua pesquisa, nossa IA recomenda estes produtos que podem interessar:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {similarProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </>
      )}
      
      <CartDrawer />
    </>
  );
}
