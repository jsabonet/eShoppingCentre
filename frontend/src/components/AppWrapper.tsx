import React from 'react';
import { CartProvider } from '../contexts/CartContext';
import CartHeaderController from './CartHeaderController';

export const AppWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <CartProvider>
      {children}
    </CartProvider>
  );
};
