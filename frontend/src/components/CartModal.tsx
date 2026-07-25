import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { X, Plus, Minus, Trash2 } from 'lucide-react';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartModal({ isOpen, onClose }: CartModalProps) {
  const { cart, removeFromCart, updateQuantity, getTotalPrice } = useCart();

  const total = getTotalPrice();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Modal - Slides in from right */}
      <div
        className={`fixed top-0 right-0 h-screen w-full max-w-md bg-background z-50 flex flex-col shadow-lg transition-transform duration-300 ease-out overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ height: '100vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-semibold">Shopping Bag</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-subtle rounded transition-colors"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Your bag is empty
            </p>
          ) : (
            <div className="space-y-6">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 pb-6 border-b border-border last:border-b-0"
                >
                  {/* Image */}
                  <div className="flex-shrink-0 w-20 h-20 bg-subtle rounded overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {item.name}
                    </h3>
                    {item.size && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Size: {item.size}
                      </p>
                    )}
                    <p className="text-sm font-medium text-accent mb-3">
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity Control */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.productId,
                            Math.max(1, item.quantity - 1)
                          )
                        }
                        className="p-1 hover:bg-subtle rounded transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="p-1 hover:bg-subtle rounded transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.productId)}
                    className="p-1 hover:text-red-500 transition-colors"
                    aria-label="Remove from cart"
                  >
                    <Trash2 size={18} className="text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-border p-6 space-y-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total:</span>
              <span className="text-accent">{formatPrice(total)}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full px-7 py-3.5 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors rounded"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
