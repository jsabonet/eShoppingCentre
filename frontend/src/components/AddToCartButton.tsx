'use client';

import React from 'react';
import { useCart } from '../contexts/CartContext';

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
  };
}

export default function AddToCartButton({ product }: AddToCartButtonProps) {
  const { addToCart } = useCart();

  return (
    <button
      onClick={() => addToCart(product, 1)}
      className="flex-1 px-7 py-3.5 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all rounded-md text-sm"
    >
      Add to Cart
    </button>
  );
}
