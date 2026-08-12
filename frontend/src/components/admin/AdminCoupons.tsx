'use client';

import { useState, useEffect, useCallback } from 'react';
import { TicketPercent, Plus, RefreshCw, X, Loader2, CheckCircle, AlertCircle, Power } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Coupon {
  id: string; code: string; discount_type: string; discount_value: number;
  min_purchase: number; max_uses: number; used_count: number;
  starts_at: string; ends_at: string; is_active: boolean; is_valid: boolean;
  store_name: string;
}

const emptyForm = {
  code: '', discount_type: 'percentage', discount_value: '', min_purchase: '0',
  max_uses: '0', starts_at: '', ends_at: '',
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
  }), []);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/products/coupons/admin/`, { headers: headers() });
      if (!res.ok) throw new Error('Sem permissão');
      const data = await res.json();
      setCoupons(data.results || data || []);
    } catch { setCoupons([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleToggle = async (c: Coupon) => {
    try {
      const res = await fetch(`${API_URL}/products/coupons/${c.id}/toggle/`, { method: 'PATCH', headers: headers() });
      if (!res.ok) throw new Error('Erro');
      showToast('success', c.is_active ? 'Cupão desactivado.' : 'Cupão activado.');
      fetchCoupons();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/products/coupons/admin/`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: form.discount_value,
          min_purchase: form.min_purchase || '0',
          max_uses: form.max_uses || '0',
          starts_at: form.starts_at,
          ends_at: form.ends_at,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d === 'object' ? Object.values(d).flat().join('. ') : 'Erro.');
      }
      showToast('success', 'Cupão global criado.');
      setModal(false);
      setForm(emptyForm);
      fetchCoupons();
    } catch (err: any) { showToast('error', err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Cupões de Desconto</h2>
          <p className="text-sm text-muted-foreground">{coupons.length} cupões em todas as lojas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCoupons} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
          <button onClick={() => { setModal(true); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold hover:bg-accent/90">
            <Plus size={16} /> Cupão Global
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-border">
          <TicketPercent size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground">Nenhum cupão encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b-2 border-border bg-muted/20">
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Código</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Loja</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Desconto</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Usos</th>
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-24">Acção</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {coupons.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-mono font-semibold text-xs">{c.code}</td>
                    <td className="py-2.5 px-3 text-xs">{c.store_name}</td>
                    <td className="py-2.5 px-3 text-xs">
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${Number(c.discount_value).toLocaleString('pt-MZ')} MZN`}
                    </td>
                    <td className="py-2.5 px-3 text-xs">{c.used_count}{Number(c.max_uses) > 0 ? ` / ${c.max_uses}` : ''}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.is_valid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.is_valid ? 'Activo' : 'Inactivo/Expirado'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={() => handleToggle(c)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${c.is_active ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        <Power size={12} className="inline mr-1" />{c.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Cupão Global (toda a plataforma)</h2>
              <button onClick={() => setModal(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Código</label>
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-accent/20" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Tipo</label>
                  <select value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm">
                    <option value="percentage">Percentagem (%)</option>
                    <option value="fixed">Valor Fixo (MZN)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Valor</label>
                  <input type="number" step="0.01" min="0" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Compra mínima (MZN)</label>
                  <input type="number" step="0.01" min="0" value={form.min_purchase} onChange={e => setForm(p => ({ ...p, min_purchase: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Usos máx. (0=ilimitado)</label>
                  <input type="number" min="0" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Início</label>
                  <input type="datetime-local" value={form.starts_at} onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Fim</label>
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm(p => ({ ...p, ends_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" required />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                Criar Cupão
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
