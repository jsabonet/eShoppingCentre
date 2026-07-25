import React, { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface ProductSortProps {
  products: Product[];
  onSortChange: (sortedProducts: Product[]) => void;
}

export default function ProductSort({ products, onSortChange }: ProductSortProps) {
  const [sortBy, setSortBy] = useState('featured');

  useEffect(() => {
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
        // Keep original order (featured products first)
        sorted = [...products];
        break;
    }

    onSortChange(sorted);
  }, [sortBy, products]);

  return (
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
  );
}
