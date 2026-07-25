import React from 'react';
import { CartProvider } from '../contexts/CartContext';
import ProductDetailAddToCart from './ProductDetailAddToCart';

interface Props {
  productId: string;
  productName: string;
  price: number;
  category: string;
  image: string;
}

export default function ProductDetailAddToCartWithProvider({
  productId,
  productName,
  price,
  category,
  image,
}: Props) {
  return (
    <CartProvider>
      <ProductDetailAddToCart
        productId={productId}
        productName={productName}
        price={price}
        category={category}
        image={image}
      />
    </CartProvider>
  );
}
