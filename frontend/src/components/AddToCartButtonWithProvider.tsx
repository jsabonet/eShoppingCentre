import React from 'react';
import { CartProvider } from '../contexts/CartContext';
import AddToCartButton from './AddToCartButton';

interface Props {
  productId: string;
  productName: string;
  price: number;
  category: string;
  image: string;
}

export default function AddToCartButtonWithProvider({
  productId,
  productName,
  price,
  category,
  image,
}: Props) {
  return (
    <CartProvider>
      <AddToCartButton
        productId={productId}
        productName={productName}
        price={price}
        category={category}
        image={image}
      />
    </CartProvider>
  );
}
