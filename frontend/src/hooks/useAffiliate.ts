'use client';

import { useState, useEffect } from 'react';
import { affiliatesAPI, type AffiliateProfile, type AffiliateLink } from '@/src/lib/api';

interface AffiliateStats {
  total_clicks: number;
  total_sales: number;
  total_commission: number;
  pending_commission: number;
}

export function useAffiliate() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, statsRes, linksRes] = await Promise.all([
        affiliatesAPI.myProfile(),
        affiliatesAPI.myStats(),
        affiliatesAPI.myLinks(),
      ]);
      setProfile(profileRes.data);
      setStats(statsRes.data);
      setLinks(linksRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados do afiliado:', err);
    } finally {
      setLoading(false);
    }
  };

  const createLink = async (productId: string) => {
    const { data } = await affiliatesAPI.createLink(productId);
    setLinks((prev) => [...prev, data]);
    return data;
  };

  const requestPayout = async (amount: number, method: string, accountDetails: Record<string, string>) => {
    await affiliatesAPI.requestPayout({ amount, method, account_details: accountDetails });
    await loadData();
  };

  return { profile, stats, links, loading, reload: loadData, createLink, requestPayout };
}
