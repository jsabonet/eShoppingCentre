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
import { useAuth } from '../hooks/useAuth';
import { usersAPI } from '../lib/api';

export interface WishlistItem {
  /** id do item da wishlist (usado para remover). */
  id: string;
  /** id do produto (usado para verificar estado). */
  product_id: string;
  product?: any;
  added_at?: string;
}

interface WishlistContextType {
  wishlistItems: WishlistItem[];
  loading: boolean;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await usersAPI.myWishlist();
      const list = Array.isArray(data) ? data : (data as any).results || [];
      setItems(
        list.map((item: any) => ({
          id: item.id,
          product_id: item.product?.id ?? item.product_id,
          product: item.product,
          added_at: item.added_at,
        })),
      );
    } catch {
      // falha silenciosa — mantém o estado anterior
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isWishlisted = useCallback(
    (productId: string) => items.some((i) => i.product_id === productId),
    [items],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const existing = items.find((i) => i.product_id === productId);
      if (existing) {
        // O endpoint de remoção espera o id do item da wishlist (não o do produto).
        await usersAPI.removeFromWishlist(existing.id);
        setItems((prev) => prev.filter((i) => i.id !== existing.id));
      } else {
        await usersAPI.addToWishlist(productId);
        await refresh();
      }
    },
    [items, refresh],
  );

  return (
    <WishlistContext.Provider
      value={useMemo(
        () => ({ wishlistItems: items, loading, isWishlisted, toggleWishlist, refresh }),
        [items, loading, isWishlisted, toggleWishlist, refresh],
      )}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a <WishlistProvider>');
  return ctx;
}
