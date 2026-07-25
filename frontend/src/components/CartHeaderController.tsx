import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { ShoppingBag } from 'lucide-react';
import CartModal from './CartModal';

export default function CartHeaderController() {
  const { getCartCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartCount = getCartCount();

  return (
    <>
      <button
        onClick={() => setIsCartOpen(true)}
        className="relative p-2 hover:text-accent transition-colors"
        aria-label="Shopping bag"
      >
        <ShoppingBag size={20} />
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-primary-foreground text-xs rounded-full flex items-center justify-center font-bold">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>

      <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
