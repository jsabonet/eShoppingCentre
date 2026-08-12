'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, RefreshCw, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface AbandonedCart {
  id: string; user_email: string; user_name: string; items_count: number;
  items: { name?: string; price?: number; quantity?: number }[];
  last_activity: string; notified_at: string | null;
}

export default function AdminAbandonedCarts() {
  const [data, setData] = useState<{ abandoned_count: number; recovered_count: number; results: AbandonedCart[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  }), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/cart/abandoned/admin/`, { headers: headers() });
      if (!res.ok) throw new Error('Sem permissão');
      setData(await res.json());
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Carrinhos Abandonados</h2>
          <p className="text-sm text-muted-foreground">Recuperação de compras não concluídas</p>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 mb-4">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-2xl font-bold text-red-600">{data?.abandoned_count ?? 0}</div>
          <div className="text-xs text-muted-foreground">Abandonados (activos)</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-2xl font-bold text-green-600">{data?.recovered_count ?? 0}</div>
          <div className="text-xs text-muted-foreground">Recuperados (compraram)</div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : !data || data.results.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-border">
          <ShoppingCart size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground">Nenhum carrinho abandonado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.results.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm flex items-center gap-2">
                  {c.notified_at ? <AlertCircle size={14} className="text-amber-500" /> : <ShoppingCart size={14} className="text-muted-foreground" />}
                  {c.user_name}
                </span>
                <span className="text-xs text-muted-foreground">{c.items_count} item(s)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{c.user_email}</p>
              <p className="text-xs text-foreground/80 mb-2 line-clamp-2">
                {c.items.map(i => i.name).filter(Boolean).join(', ')}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Última atividade: {new Date(c.last_activity).toLocaleString('pt-MZ')}</span>
                <span>{c.notified_at ? 'Email enviado' : 'Não notificado'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
