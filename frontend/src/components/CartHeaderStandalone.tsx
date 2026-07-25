"use client";

import { ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export default function CartHeaderStandalone() {
  const { getCartCount, setIsCartOpen } = useCart();
  const totalItems = getCartCount();

  return (
    <button
      onClick={() => setIsCartOpen(true)}
      className="relative p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-900"
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