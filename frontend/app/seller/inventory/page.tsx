'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Package, Search, RefreshCw, Plus, Loader2, AlertCircle, CheckCircle, History, X } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { productsAPI } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

interface ProductItem {
  id: string; name: string; stock: number; price: number;
  primary_image?: string; sales_count: number; sku?: string;
  stock_logs?: any[];
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [restockModal, setRestockModal] = useState<ProductItem | null>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockNotes, setRestockNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyModal, setHistoryModal] = useState<ProductItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  }), []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/products/my/?product_type=physical`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      const data = await res.json();
      setProducts(data.results || data || []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModal || restockQty <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/products/${restockModal.id}/restock/`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ quantity: restockQty, notes: restockNotes }),
      });
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setProducts(prev => prev.map(p => p.id === data.id ? data : p));
      setRestockModal(null);
      showToast('success', `+${restockQty} unidades adicionadas a "${restockModal.name}".`);
    } catch { showToast('error', 'Erro ao repor stock.'); }
    finally { setSaving(false); }
  };

  const stockLevel = (stock: number): { color: string; label: string; dot: string } => {
    if (stock === 0) return { color: 'bg-red-100 text-red-700', label: 'Esgotado', dot: '🔴' };
    if (stock <= 5) return { color: 'bg-yellow-100 text-yellow-700', label: 'Baixo', dot: '🟡' };
    return { color: 'bg-green-100 text-green-700', label: 'Normal', dot: '🟢' };
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const m = p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    if (!m) return false;
    if (stockFilter === 'out') return p.stock === 0;
    if (stockFilter === 'low') return p.stock > 0 && p.stock <= 5;
    if (stockFilter === 'normal') return p.stock > 5;
    return true;
  });

  if (loading) return <SellerLayout><div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar inventário..." /></div></SellerLayout>;

  return (
    <SellerLayout>
      <div className="p-4 sm:p-6 space-y-4">
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Inventário</h1>
            <p className="text-sm text-muted-foreground">{products.length} produtos físicos · {products.filter(p => p.stock <= 5).length} com stock baixo</p>
          </div>
          <button onClick={fetchProducts} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'all', label: 'Total', count: products.length, color: 'bg-card border-border' },
            { key: 'normal', label: '🟢 Normal', count: products.filter(p => p.stock > 5).length, color: 'bg-green-50 border-green-200' },
            { key: 'low', label: '🟡 Baixo', count: products.filter(p => p.stock > 0 && p.stock <= 5).length, color: 'bg-yellow-50 border-yellow-200' },
            { key: 'out', label: '🔴 Esgotado', count: products.filter(p => p.stock === 0).length, color: 'bg-red-50 border-red-200' },
          ].map(s => (
            <button key={s.key} onClick={() => setStockFilter(stockFilter === s.key ? 'all' : s.key)}
              className={`p-3 rounded-xl border text-center transition-colors ${s.color} ${stockFilter === s.key ? 'ring-2 ring-accent' : ''}`}>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20" />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Package size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b-2 border-border bg-muted/30">
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Produto</th>
                  <th className="text-center py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Stock</th>
                  <th className="text-center py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                  <th className="text-center py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase hidden sm:table-cell">Vendas</th>
                  <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-32">Acções</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(p => {
                    const level = stockLevel(p.stock);
                    return (
                      <tr key={p.id} className={`hover:bg-muted/20 transition-colors ${p.stock === 0 ? 'bg-red-50/30' : p.stock <= 5 ? 'bg-yellow-50/20' : ''}`}>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {p.primary_image ? (
                              <Image src={p.primary_image.startsWith('http') ? p.primary_image : MEDIA_URL + p.primary_image}
                                alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-cover border border-border flex-shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Package size={14} /></div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground">SKU: {p.sku || '—'} · {Number(p.price).toLocaleString('pt-MZ')} MZN</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-sm">{p.stock}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${level.color}`}>
                            {level.dot} {level.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-muted-foreground hidden sm:table-cell">{p.sales_count || 0}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setHistoryModal(p); }}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground" title="Histórico">
                              <History size={14} />
                            </button>
                            <button onClick={() => { setRestockModal(p); setRestockQty(10); setRestockNotes(''); }}
                              className="px-2.5 py-1.5 bg-accent text-accent-foreground rounded-lg text-[11px] font-semibold hover:bg-accent/90 flex items-center gap-1">
                              <Plus size={12} /> Repor
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Restock Modal */}
        {restockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRestockModal(null)} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><Package size={18} /> Repor Stock</h2>
                <button onClick={() => setRestockModal(null)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{restockModal.name} · Stock atual: <span className="font-bold">{restockModal.stock}</span></p>
              <form onSubmit={handleRestock} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Quantidade a adicionar</label>
                  <input type="number" min="1" value={restockQty}
                    onChange={e => setRestockQty(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" required autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nota (opcional)</label>
                  <input type="text" placeholder="Ex: Nova remessa do fornecedor" value={restockNotes}
                    onChange={e => setRestockNotes(e.target.value)}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20" />
                </div>
                <button type="submit" disabled={saving}
                  className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Adicionar {restockQty} unidade(s)
                </button>
              </form>
            </div>
          </div>
        )}

        {/* History Modal */}
        {historyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryModal(null)} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><History size={18} /> Stock: {historyModal.name}</h2>
                <button onClick={() => setHistoryModal(null)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Stock atual: <span className="font-bold">{historyModal.stock}</span></p>
              {historyModal.stock_logs?.length > 0 ? (
                <div className="space-y-2">
                  {historyModal.stock_logs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs border-b border-border pb-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.quantity > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="flex-1">
                        <p><span className={`font-semibold ${log.quantity > 0 ? 'text-green-700' : 'text-red-700'}`}>{log.quantity > 0 ? '+' : ''}{log.quantity}</span>
                          {' '}· {log.change_type === 'sale' ? '🛒 Venda' : log.change_type === 'cancel' ? '🔙 Cancel' : log.change_type === 'return' ? '🔄 Devolução' : log.change_type === 'restock' ? '📦 Reposição' : '✏️ Ajuste'}
                          {' '}· <span className="text-muted-foreground">{log.stock_before} → {log.stock_after}</span>
                        </p>
                        <p className="text-muted-foreground">{log.reference} · {log.changed_by_name}</p>
                        <p className="text-muted-foreground/60">{new Date(log.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum registo de stock.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
