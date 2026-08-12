'use client';

import { useState, useEffect, useCallback } from 'react';
import { TicketPercent, Plus, Trash2, Pencil, RefreshCw, X, Loader2, CheckCircle, AlertCircle, Percent, Coins, Calendar, Dices, Tag, Info } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Coupon {
  id: string; code: string; discount_type: string; discount_value: number;
  min_purchase: number; max_uses: number; used_count: number; max_per_user: number;
  starts_at: string; ends_at: string; is_active: boolean; is_valid: boolean;
  store_name: string; created_at: string;
}

const emptyForm = {
  code: '', discount_type: 'percentage', discount_value: '', min_purchase: '0',
  max_uses: '0', max_per_user: '1', starts_at: '', ends_at: '', is_active: true,
};

const toLocalInput = (d: Date) => {
  const dd = new Date(d);
  dd.setMinutes(dd.getMinutes() - dd.getTimezoneOffset());
  return dd.toISOString().slice(0, 16);
};

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export default function SellerCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
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
      const res = await fetch(`${API_URL}/products/coupons/`, { headers: headers() });
      if (!res.ok) throw new Error('Erro');
      const data = await res.json();
      setCoupons(data.results || data || []);
    } catch { setCoupons([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      code: generateCode(),
      starts_at: toLocalInput(new Date()),
      ends_at: toLocalInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    });
    setModal(true);
  };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code, discount_type: c.discount_type,
      discount_value: String(c.discount_value), min_purchase: String(c.min_purchase),
      max_uses: String(c.max_uses), max_per_user: String(c.max_per_user),
      starts_at: c.starts_at ? c.starts_at.slice(0, 16) : '',
      ends_at: c.ends_at ? c.ends_at.slice(0, 16) : '',
      is_active: c.is_active,
    });
    setModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: any = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_purchase: form.min_purchase || '0',
        max_uses: form.max_uses || '0',
        max_per_user: form.max_per_user || '1',
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        is_active: form.is_active,
      };
      const url = editing ? `${API_URL}/products/coupons/${editing.id}/` : `${API_URL}/products/coupons/`;
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d === 'object' ? Object.values(d).flat().join('. ') : 'Erro.');
      }
      showToast('success', editing ? 'Cupão actualizado.' : 'Cupão criado.');
      setModal(false);
      fetchCoupons();
    } catch (err: any) { showToast('error', err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar este cupão?')) return;
    try {
      await fetch(`${API_URL}/products/coupons/${id}/`, { method: 'DELETE', headers: headers() });
      showToast('success', 'Cupão eliminado.');
      fetchCoupons();
    } catch { showToast('error', 'Erro ao eliminar.'); }
  };

  return (
    <SellerLayout>
      <div className="flex-1 p-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Cupões de Desconto</h1>
            <p className="text-sm text-muted-foreground">{coupons.length} cupões</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchCoupons} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold hover:bg-accent/90">
              <Plus size={16} /> Novo Cupão
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">A carregar...</div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-border">
            <TicketPercent size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground">Nenhum cupão criado ainda.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b-2 border-border bg-muted/20">
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-[11px] uppercase">Código</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-[11px] uppercase">Desconto</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-[11px] uppercase hidden sm:table-cell">Mínimo</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-[11px] uppercase">Usos</th>
                <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                <th className="text-right py-3 px-4 font-semibold text-muted-foreground text-[11px] uppercase w-24">Acção</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {coupons.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-mono font-semibold text-xs">{c.code}</td>
                    <td className="py-2.5 px-4 text-xs">
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : `${Number(c.discount_value).toLocaleString('pt-MZ')} MZN`}
                    </td>
                    <td className="py-2.5 px-4 text-xs hidden sm:table-cell">{Number(c.min_purchase).toLocaleString('pt-MZ')} MZN</td>
                    <td className="py-2.5 px-4 text-xs">{c.used_count}{Number(c.max_uses) > 0 ? ` / ${c.max_uses}` : ''}</td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.is_valid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.is_valid ? 'Activo' : 'Inactivo/Expirado'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-muted rounded"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModal(false)} />
            <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-border">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center gap-3 z-10">
                <div className="p-2.5 bg-accent/10 rounded-xl">
                  <TicketPercent size={20} className="text-accent" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold leading-tight">{editing ? 'Editar Cupão' : 'Criar Cupão de Desconto'}</h2>
                  <p className="text-xs text-muted-foreground">{editing ? 'Actualize os detalhes do cupão' : 'Configure o desconto para a sua loja'}</p>
                </div>
                <button onClick={() => setModal(false)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Código */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"><Tag size={14} className="text-muted-foreground" /> Código do cupão</label>
                  <div className="flex gap-2">
                    <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="EX: PROMO20" maxLength={30}
                      className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-mono font-semibold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-accent/20" required />
                    <button type="button" onClick={() => setForm(p => ({ ...p, code: generateCode() }))}
                      className="px-3 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted flex items-center gap-1.5" title="Gerar código aleatório">
                      <Dices size={15} /> Gerar
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">O cliente digita este código no checkout.</p>
                </div>

                {/* Tipo de desconto */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"><Percent size={14} className="text-muted-foreground" /> Tipo de desconto</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setForm(p => ({ ...p, discount_type: 'percentage' }))}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.discount_type === 'percentage' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}>
                      <Percent size={15} /> Percentagem
                    </button>
                    <button type="button" onClick={() => setForm(p => ({ ...p, discount_type: 'fixed' }))}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.discount_type === 'fixed' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-muted-foreground hover:border-muted-foreground/40'}`}>
                      <Coins size={15} /> Valor Fixo
                    </button>
                  </div>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">{form.discount_type === 'percentage' ? 'Percentagem de desconto' : 'Valor do desconto (MZN)'}</label>
                  <div className="relative">
                    <input type="number" step="0.01" min="0" max={form.discount_type === 'percentage' ? '100' : undefined}
                      value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-border rounded-xl text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-accent/20" required />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      {form.discount_type === 'percentage' ? '%' : 'MZN'}
                    </span>
                  </div>
                </div>

                {/* Condições */}
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Info size={13} /> Condições</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Compra mínima (MZN)</label>
                      <input type="number" step="0.01" min="0" value={form.min_purchase} onChange={e => setForm(p => ({ ...p, min_purchase: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Limite de usos</label>
                      <input type="number" min="0" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">0 = ilimitado</p>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Usos por cliente</label>
                      <input type="number" min="1" value={form.max_per_user} onChange={e => setForm(p => ({ ...p, max_per_user: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white" />
                    </div>
                  </div>
                </div>

                {/* Validade */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Calendar size={13} /> Validade</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Início</label>
                      <input type="datetime-local" value={form.starts_at} onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Fim</label>
                      <input type="datetime-local" value={form.ends_at} onChange={e => setForm(p => ({ ...p, ends_at: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg text-sm" required />
                    </div>
                  </div>
                </div>

                {/* Pré-visualização */}
                <div className="rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-1">Pré-visualização</p>
                  {form.discount_value ? (
                    <p className="text-sm font-semibold">
                      {form.discount_type === 'percentage' ? `${form.discount_value}% de desconto` : `${Number(form.discount_value).toLocaleString('pt-MZ')} MZN de desconto`}
                      {Number(form.min_purchase || 0) > 0 && <span className="font-normal text-muted-foreground"> em compras a partir de {Number(form.min_purchase).toLocaleString('pt-MZ')} MZN</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Defina o valor do desconto para ver a pré-visualização.</p>
                  )}
                </div>

                {/* Activo */}
                <label className="flex items-center justify-between p-3 bg-muted/30 rounded-xl cursor-pointer">
                  <span className="text-sm font-medium">Cupão activo</span>
                  <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
                  </button>
                </label>

                {/* Acções */}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModal(false)}
                    className="px-5 py-2.5 border border-border rounded-xl font-medium text-sm hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    {editing ? 'Guardar Alterações' : 'Criar Cupão'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
