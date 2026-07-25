import React, { useState, useMemo, Suspense, lazy } from 'react';

const AddToCartButton = lazy(() => import('./AddToCartButton'));

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface ProductSortableGridProps {
  products: Product[];
}

export default function ProductSortableGrid({ products }: ProductSortableGridProps) {
  const [sortBy, setSortBy] = useState('featured');

  const sortedProducts = useMemo(() => {
    let sorted = [...products];

    switch (sortBy) {
      case 'price-low-high':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high-low':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'name-a-z':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-z-a':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'featured':
      default:
        sorted = [...products];
        break;
    }

    return sorted;
  }, [sortBy, products]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <>
      {/* Sort Controls */}
      <div className="py-8 px-4 sm:px-6 lg:px-8 border-elegant sticky top-20 z-10 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-border rounded-sm text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="featured">Featured</option>
              <option value="price-low-high">Price: Low to High</option>
              <option value="price-high-low">Price: High to Low</option>
              <option value="name-a-z">Name: A to Z</option>
              <option value="name-z-a">Name: Z to A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {sortedProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
              {sortedProducts.map((product) => (
                <div key={product.id} className="group flex flex-col">
                  <div className="relative overflow-hidden rounded mb-4 bg-subtle aspect-square">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {product.name}
                  </h3>
                  <p className="text-accent font-medium mb-4">{formatPrice(product.price)}</p>
                  <div className="flex flex-row gap-2">
                    <Suspense fallback={<div className="flex-1 px-7 py-3.5 bg-primary text-primary-foreground font-medium rounded-md text-sm text-center">Add to Cart</div>}>
                      <AddToCartButton product={product} />
                    </Suspense>
                    <a
                      href={`/${product.category}/${product.id}`}
                      className="flex-1 px-7 py-3.5 bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-all rounded-md text-sm text-center"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-muted-foreground">No products available at this time.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
