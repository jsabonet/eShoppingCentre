import React from 'react';
import { CartProvider } from '../contexts/CartContext';
import ProductSortableGrid from './ProductSortableGrid';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

interface CartProviderWrapperProps {
  products: Product[];
}

export default function CartProviderWrapper({ products }: CartProviderWrapperProps) {
  return (
    <CartProvider>
      <ProductSortableGrid products={products} />
    </CartProvider>
  );
}
