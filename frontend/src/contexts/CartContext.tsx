"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import type { Product } from '../data/marketplace';
import { isInfoProduct } from '../lib/productType';

export type CartProduct = Product;

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: CartProduct, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  removeProducts: (productIds: string[]) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = 'eshoppingcentre-cart-v1';

// Sem productType o checkout não reconhece o item como físico e nunca pede a
// estimativa de frete — a secção de envio desaparece em silêncio.
const normalizeItem = (item: CartItem): CartItem => ({
  ...item,
  product: {
    ...item.product,
    productType: item.product.productType || 'physical',
    minOrderQuantity: Math.max(1, Number(item.product.minOrderQuantity) || 1),
  },
});

const getMinimumQuantity = (product: CartProduct) =>
  isInfoProduct(product.productType) ? 1 : Math.max(1, Number(product.minOrderQuantity) || 1);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems((JSON.parse(stored) as CartItem[]).map(normalizeItem));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  // Sincronizar entre abas/janelas (evita carrinhos divergentes)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setItems((JSON.parse(e.newValue) as CartItem[]).map(normalizeItem));
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Sincronizar carrinho com o backend (para recuperação de carrinhos abandonados)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const payload = items.map((i) => ({
      product_id: i.product.id,
      name: i.product.name,
      price: i.product.price,
      quantity: i.quantity,
      image: i.product.image || '',
    }));
    const t = setTimeout(() => {
      fetch(`${API_URL}/orders/cart/sync/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: payload }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [items]);

  const addToCart = useCallback((product: CartProduct, quantity = 1) => {
    // Infoprodutos (digital/course) são sempre vendidos em unidade única.
    const effectiveQuantity = Math.max(getMinimumQuantity(product), quantity);
    const normalized = normalizeItem({ product, quantity: effectiveQuantity });
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === normalized.product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === normalized.product.id
            ? { ...i, quantity: isInfoProduct(i.product.productType) ? 1 : i.quantity + effectiveQuantity }
            : i
        );
      }
      return [...prev, normalized];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.product.id !== productId) return i;
          // Infoprodutos têm quantidade fixa em 1 — ignoramos qualquer alteração.
          if (isInfoProduct(i.product.productType)) return i;
          return quantity <= 0
            ? null
            : { ...i, quantity: Math.max(getMinimumQuantity(i.product), quantity) };
        })
        .filter((i): i is CartItem => i !== null)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // Remove apenas os artigos indicados (usado quando um pagamento é confirmado,
  // para não apagar o que o cliente tenha acrescentado entretanto).
  const removeProducts = useCallback((productIds: string[]) => {
    const ids = new Set(productIds.map(String));
    setItems((prev) =>
      prev.some((i) => ids.has(String(i.product.id)))
        ? prev.filter((i) => !ids.has(String(i.product.id)))
        : prev
    );
  }, []);

  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const getCartCount = useCallback(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={useMemo(() => ({ items, addToCart, removeFromCart, removeProducts, updateQuantity, clearCart, totalPrice, isCartOpen, setIsCartOpen, getCartCount }), [items, addToCart, removeFromCart, removeProducts, updateQuantity, clearCart, totalPrice, isCartOpen, getCartCount])}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}