'use client';

import Link from 'next/link';
import { ShoppingBag, Truck, Shield, CreditCard, ArrowLeft, Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '@/src/contexts/CartContext';

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

export default function CartContent() {
  const { items, removeFromCart, updateQuantity, totalPrice } = useCart();
  const subtotal = totalPrice;

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Carrinho de Compras</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <ShoppingBag size={32} />
        Seu Carrinho
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          {items.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-lg">
              <ShoppingBag size={64} className="mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Seu carrinho está vazio</h2>
              <p className="text-muted-foreground mb-6">
                Adicione produtos para começar a comprar
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
              >
                <ArrowLeft size={18} />
                Continuar Comprando
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const itemTotal = item.product.price * item.quantity;
                return (
                  <div
                    key={item.product.id}
                    className="flex gap-4 p-4 bg-card border border-border rounded-lg"
                  >
                    <Link href={`/product/${item.product.slug}`} className="flex-shrink-0">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-md"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="font-medium hover:text-accent transition-colors line-clamp-2"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-lg font-bold mt-2">MZN {formatPrice(item.product.price)}</p>
                      <p className="text-sm text-green-600 font-medium">Frete grátis</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center border border-border rounded-md">
                          <button
                            className="p-2 hover:bg-muted transition-colors"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="px-3 text-sm font-medium">{item.quantity}</span>
                          <button
                            className="p-2 hover:bg-muted transition-colors"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          className="text-sm text-destructive hover:underline flex items-center gap-1"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="font-bold text-lg">MZN {formatPrice(itemTotal)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Resumo do Pedido</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">MZN {formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete:</span>
                <span className="text-green-600 font-medium">Grátis</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-bold text-lg">Total:</span>
                  <span className="font-bold text-lg">MZN {formatPrice(subtotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ou 12x de MZN {formatPrice(subtotal / 12)} sem juros
                </p>
              </div>
            </div>

            <Link
              href="/checkout"
              className={`w-full flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors mb-3 ${
                items.length === 0 ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              Finalizar Compra
            </Link>

            <Link href="/" className="block text-center text-sm text-accent hover:underline">
              Continuar Comprando
            </Link>

            <div className="mt-6 pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck size={14} className="text-foreground" />
                <span>Frete grátis em compras acima de 199 MZN</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={14} className="text-foreground" />
                <span>Compra 100% segura</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CreditCard size={14} className="text-foreground" />
                <span>Parcele em até 12x sem juros</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
