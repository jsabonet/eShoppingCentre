'use client';

import { useState, useEffect } from 'react';
import { storesAPI, ordersAPI, type StoreDetail, type Order, type WalletTransaction, type PaginatedResponse } from '@/src/lib/api';

interface SellerStats {
  total_products: number;
  total_orders: number;
  total_revenue: number;
  pending_orders: number;
}

export function useSeller() {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storeRes, statsRes, ordersRes, earningsRes] = await Promise.all([
        storesAPI.myStore(),
        storesAPI.myStats(),
        ordersAPI.myOrders({ page_size: 10 }),
        storesAPI.myEarnings({ page_size: 20 }),
      ]);
      setStore(storeRes.data);
      setStats(statsRes.data);
      setOrders(ordersRes.data.results);
      setEarnings(earningsRes.data.transactions);
    } catch (err) {
      console.error('Erro ao carregar dados do vendedor:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string, trackingCode?: string) => {
    await ordersAPI.updateStatus(orderId, { status, tracking_code: trackingCode });
    await loadData();
  };

  return { store, stats, orders, earnings, loading, reload: loadData, updateOrderStatus };
}
