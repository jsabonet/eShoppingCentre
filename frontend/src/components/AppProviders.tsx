import React from 'react';
import { CartProvider } from '../contexts/CartContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return <CartProvider>{children}</CartProvider>;
};
