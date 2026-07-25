import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';

interface ProductDetailAddToCartProps {
  productId: string;
  productName: string;
  price: number;
  category: string;
  image: string;
}

export default function ProductDetailAddToCart({
  productId,
  productName,
  price,
  category,
  image,
}: ProductDetailAddToCartProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    setError('');
    setSuccess('');

    if (!selectedSize || selectedSize === 'Select size') {
      setError('Please select a size before adding to cart');
      return;
    }

    const product = {
      id: productId,
      name: productName,
      price,
      category,
      image,
    };

    addToCart(product, 1, selectedSize);
    setSuccess('Added to cart!');
    setSelectedSize('');

    // Clear success message after 2 seconds
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <>
      <div className="mb-6">
        <label htmlFor="size-select" className="text-sm font-semibold block mb-3">
          Size
        </label>
        <select
          id="size-select"
          value={selectedSize}
          onChange={(e) => {
            setSelectedSize(e.target.value);
            setError('');
          }}
          className="w-full px-4 py-3 border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Select size</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
        </select>
      </div>

      <button
        onClick={handleAddToCart}
        className="w-full px-7 py-3.5 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all rounded-sm text-sm"
      >
        Add to Cart
      </button>

      {error && (
        <p className="text-sm text-red-600 mt-3">{error}</p>
      )}

      {success && (
        <p className="text-sm text-green-600 mt-3">{success}</p>
      )}
    </>
  );
}
