"use client";

import { ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export default function CartHeader() {
  const { totalItems, setIsCartOpen } = useCart();

  return (
    <button
      onClick={() => setIsCartOpen(true)}
      className="relative p-2 hover:bg-muted rounded-md transition-colors"
      aria-label="Carrinho"
    >
      <ShoppingCart size={22} />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  );
}
