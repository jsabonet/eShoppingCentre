"use client";

import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

export default function CartDrawer() {
  const { items, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, totalPrice } = useCart();

  if (!isCartOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background z-50 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag size={20} />
            Carrinho ({items.length} {items.length === 1 ? 'item' : 'itens'})
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            aria-label="Fechar carrinho"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag size={64} className="text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">Seu carrinho está vazio</p>
              <p className="text-sm text-muted-foreground mb-6">
                Adicione produtos para começar a comprar
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
              >
                Continuar Comprando
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 p-3 border border-border rounded-lg"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium line-clamp-2 mb-1">
                      {item.product.name}
                    </h3>
                    <p className="text-sm font-bold">
                      MZN {item.product.price.toFixed(2).replace('.', ',')}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 border border-border rounded hover:bg-muted transition-colors"
                        aria-label="Diminuir quantidade"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 border border-border rounded hover:bg-muted transition-colors"
                        aria-label="Aumentar quantidade"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="ml-auto p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                        aria-label="Remover item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal:</span>
              <span className="text-xl font-bold">
                MZN {totalPrice.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <a
              href="/cart"
              className="block w-full text-center px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
            >
              Ver Carrinho Completo
            </a>
            <button
              onClick={() => setIsCartOpen(false)}
              className="block w-full text-center px-6 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Continuar Comprando
            </button>
          </div>
        )}
      </div>
    </>
  );
}
