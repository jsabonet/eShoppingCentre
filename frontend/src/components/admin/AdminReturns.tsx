'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw, CheckCircle, XCircle, Truck, Package, Search, RefreshCw,
  DollarSign, AlertCircle, Eye, Shield, Ban, Undo2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  requested: { label: 'Solicitada', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprovada', color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-800' },
  disputed: { label: 'Em Disputa', color: 'bg-purple-100 text-purple-800' },
  shipped: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800' },
  received: { label: 'Recebida', color: 'bg-teal-100 text-teal-800' },
  refunded: { label: 'Reembolsada', color: 'bg-green-100 text-green-800' },
};

const REASON_LABELS: Record<string, string> = {
  defective: 'Defeito', not_as_described: 'Diferente do anunciado',
  not_satisfied: 'Não gostou', damaged: 'Danificado',
  wrong_item: 'Item errado', other: 'Outro',
};

interface ReturnItem {
  id: string; rma_number: string; order_number: string;
  reason: string; reason_type: string; status: string;
  buyer_name: string; store_name: string;
  refund_amount: number | null; vendor_notes: string;
  admin_notes: string; disputed_at: string | null;
  buyer_tracking_code: string; shipping_notes: string;
  created_at: string;
}

export default function AdminReturns() {
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<ReturnItem | null>(null);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    action: 'approve' as 'approve' | 'reject' | 'refund',
    admin_notes: '', refund_amount: '', return_instructions: '', return_address: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const headers = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/orders/returns/admin/`, { headers: headers() });
      if (!res.ok) throw new Error('Sem permissão');
      const data = await res.json();
      setReturns(data.results || data || []);
    } catch { setReturns([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !overrideForm.admin_notes.trim()) return;
    setSaving(true);
    try {
      const body: any = { action: overrideForm.action, admin_notes: overrideForm.admin_notes };
      if (overrideForm.action === 'approve') {
        body.refund_amount = overrideForm.refund_amount || null;
        body.return_instructions = overrideForm.return_instructions;
        body.return_address = overrideForm.return_address;
      }
      const res = await fetch(`${API_URL}/orders/returns/${selected.id}/admin-override/`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Erro');
      }
      setMsg({ type: 'success', text: `Devolução ${overrideForm.action === 'approve' ? 'aprovada' : overrideForm.action === 'reject' ? 'rejeitada' : 'reembolsada'} com sucesso.` });
      setOverrideModal(false);
      setSelected(null);
      fetchReturns();
    } catch (err: any) { setMsg({ type: 'error', text: err.message }); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 4000); }
  };

  const filtered = returns.filter(r => {
    const q = search.toLowerCase();
    const match = r.rma_number.toLowerCase().includes(q) || r.buyer_name.toLowerCase().includes(q) || r.store_name.toLowerCase().includes(q) || r.order_number.toLowerCase().includes(q);
    return match && (statusFilter === 'all' || r.status === statusFilter);
  });

  const counts = {
    disputed: returns.filter(r => r.status === 'disputed').length,
    requested: returns.filter(r => r.status === 'requested').length,
  };

  return (
    <div>
      {/* Toast */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
          msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Gestão de Devoluções</h2>
          <p className="text-sm text-muted-foreground">{returns.length} devoluções · {counts.disputed} em disputa</p>
        </div>
        <button onClick={fetchReturns} className="p-2 hover:bg-muted rounded-lg" title="Actualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-4">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}
            className={`p-2 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === k ? `${v.color} border-current` : 'bg-white border-border text-muted-foreground hover:bg-muted/50'
            }`}>
            <div className="text-lg font-bold">{returns.filter(r => r.status === k).length}</div>
            <div>{v.label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Buscar por RMA, comprador, loja..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/20" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-border">
          <Shield size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground">Nenhuma devolução encontrada.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border bg-muted/20">
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">RMA</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Comprador</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase hidden md:table-cell">Loja</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase hidden sm:table-cell">Motivo</th>
                  <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                  <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => {
                  const s = STATUS_CONFIG[r.status] || STATUS_CONFIG.requested;
                  return (
                    <tr key={r.id} className={`hover:bg-muted/20 transition-colors ${r.status === 'disputed' ? 'bg-purple-50/50' : ''}`}>
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold">{r.rma_number}</td>
                      <td className="py-2.5 px-3 text-xs font-medium">{r.buyer_name}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground hidden md:table-cell">{r.store_name}</td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <span className="text-xs">{REASON_LABELS[r.reason_type] || r.reason}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.color}`}>
                          {s.label}
                        </span>
                        {r.status === 'disputed' && <span className="ml-1 text-[11px] text-red-600 font-bold">⚠</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelected(r); setOverrideForm({ action: 'approve', admin_notes: '', refund_amount: '', return_instructions: '', return_address: '' }); setOverrideModal(true); }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                              r.status === 'disputed' ? 'bg-purple-600 text-white hover:bg-purple-700' :
                              'bg-accent text-accent-foreground hover:bg-accent/90'
                            }`}>
                            <Shield size={12} className="inline mr-1" />
                            {r.status === 'disputed' ? 'Resolver Disputa' : 'Intervir'}
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

      {/* Override Modal */}
      {overrideModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOverrideModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Shield size={18} className="text-purple-600" />
                Intervenção Administrativa
              </h2>
              <button onClick={() => setOverrideModal(false)} className="p-1 hover:bg-muted rounded"><XCircle size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {selected.rma_number} · {selected.buyer_name} → {selected.store_name}
            </p>

            {/* Info */}
            <div className="bg-muted/30 rounded-xl p-3 mb-4 text-xs space-y-1">
              <div><span className="text-muted-foreground">Motivo:</span> {REASON_LABELS[selected.reason_type]} — {selected.reason}</div>
              <div><span className="text-muted-foreground">Estado atual:</span> <span className={`font-semibold ${STATUS_CONFIG[selected.status]?.color}`}>{STATUS_CONFIG[selected.status]?.label}</span></div>
              {selected.refund_amount && <div><span className="text-muted-foreground">Reembolso:</span> {Number(selected.refund_amount).toLocaleString('pt-MZ')} MZN</div>}
            </div>

            <form onSubmit={handleOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2">Decisão</label>
                <div className="flex gap-2">
                  {([
                    { value: 'approve' as const, label: 'Aprovar', icon: CheckCircle, color: 'border-green-500 bg-green-50 text-green-700' },
                    { value: 'reject' as const, label: 'Rejeitar', icon: Ban, color: 'border-red-500 bg-red-50 text-red-700' },
                    { value: 'refund' as const, label: 'Reembolsar', icon: DollarSign, color: 'border-blue-500 bg-blue-50 text-blue-700' },
                  ]).map(opt => (
                    <label key={opt.value} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 border-2 rounded-xl cursor-pointer text-xs font-semibold transition-all ${
                      overrideForm.action === opt.value ? opt.color : 'border-border hover:border-muted-foreground/30'
                    }`}>
                      <input type="radio" name="action" value={opt.value} checked={overrideForm.action === opt.value}
                        onChange={e => setOverrideForm(p => ({ ...p, action: e.target.value as any }))} className="sr-only" />
                      <opt.icon size={14} /> {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {overrideForm.action === 'approve' && (
                <div className="space-y-3 bg-green-50/50 rounded-xl p-3 border border-green-100">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Reembolso (MZN)</label>
                    <input type="number" step="0.01" placeholder="0.00" value={overrideForm.refund_amount}
                      onChange={e => setOverrideForm(p => ({ ...p, refund_amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Morada p/ Devolução</label>
                    <input type="text" placeholder="Morada" value={overrideForm.return_address}
                      onChange={e => setOverrideForm(p => ({ ...p, return_address: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Instruções</label>
                    <textarea rows={2} placeholder="Instruções para o comprador..." value={overrideForm.return_instructions}
                      onChange={e => setOverrideForm(p => ({ ...p, return_instructions: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 resize-none" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Justificação <span className="text-red-500">*</span>
                </label>
                <textarea rows={3} placeholder="Explique a razão desta decisão administrativa..." value={overrideForm.admin_notes}
                  onChange={e => setOverrideForm(p => ({ ...p, admin_notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" required />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                    overrideForm.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                    overrideForm.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}>
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
                  Confirmar {overrideForm.action === 'approve' ? 'Aprovação' : overrideForm.action === 'reject' ? 'Rejeição' : 'Reembolso'}
                </button>
                <button type="button" onClick={() => setOverrideModal(false)}
                  className="px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
