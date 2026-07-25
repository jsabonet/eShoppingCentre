import React from 'react';
import { CartProvider } from '../contexts/CartContext';
import CartHeaderController from './CartHeaderController';

export default function CartHeaderWithProvider() {
  return (
    <CartProvider>
      <CartHeaderController />
    </CartProvider>
  );
}
