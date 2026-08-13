'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, DollarSign, Wallet, Settings, RefreshCw, Loader2, CheckCircle, AlertCircle, Ban, ShieldCheck, Percent, FileText } from 'lucide-react';
import { affiliatesAPI, type AffiliateProfile } from '@/src/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Rejeitado',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

export default function AdminAffiliates() {
  const [view, setView] = useState<'affiliates' | 'commissions' | 'payouts' | 'kyc' | 'settings'>('affiliates');
  const [affiliates, setAffiliates] = useState<AffiliateProfile[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [kycList, setKycList] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, p, k, s] = await Promise.all([
        affiliatesAPI.adminList({ page_size: 200 }),
        affiliatesAPI.adminCommissions({ page_size: 200 }),
        affiliatesAPI.adminPayouts({ page_size: 200 }),
        affiliatesAPI.adminKYC({ page_size: 200 }),
        affiliatesAPI.adminSettings(),
      ]);
      setAffiliates(a.data.results || a.data || []);
      setCommissions(c.data.results || c.data || []);
      setPayouts(p.data.results || p.data || []);
      setKycList(k.data.results || k.data || []);
      setSettings(s.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await affiliatesAPI.adminUpdateStatus(id, status);
      showToast('success', `Afiliado ${status === 'active' ? 'activado' : status === 'suspended' ? 'suspenso' : 'actualizado'}.`);
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const commissionAction = async (id: string, action: string) => {
    try {
      await affiliatesAPI.adminCommissionAction(id, { action });
      showToast('success', action === 'approve' ? 'Comissão aprovada.' : 'Comissão rejeitada.');
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const payoutAction = async (id: string, action: string) => {
    try {
      await affiliatesAPI.adminPayoutAction(id, { action });
      showToast('success', action === 'approve' ? 'Saque aprovado.' : 'Saque rejeitado.');
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const kycAction = async (id: string, action: string) => {
    try {
      await affiliatesAPI.adminKYCAction(id, { action });
      showToast('success', action === 'approve' ? 'Verificação aprovada.' : 'Verificação rejeitada.');
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await affiliatesAPI.adminUpdateSettings(settings);
      showToast('success', 'Configurações guardadas.');
    } catch { showToast('error', 'Erro ao guardar.'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Gestão de Afiliados</h2>
          <p className="text-sm text-muted-foreground">{affiliates.length} afiliados · {payouts.filter(p => p.status === 'pending').length} saques pendentes</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-lg p-1 border border-border w-fit">
        {([
          { id: 'affiliates', label: 'Afiliados', icon: Users },
          { id: 'commissions', label: 'Comissões', icon: DollarSign },
          { id: 'payouts', label: 'Saques', icon: Wallet },
          { id: 'kyc', label: 'Verificações', icon: FileText },
          { id: 'settings', label: 'Configurações', icon: Settings },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === t.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <>
          {view === 'affiliates' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Tier</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Cliques</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Vendas</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Comissão</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {affiliates.map(a => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-medium">{a.user_name || a.user_email}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{a.referral_code}</p>
                        </td>
                        <td className="py-2.5 px-3"><span className="capitalize text-xs">{a.commission_tier}</span></td>
                        <td className="py-2.5 px-3 text-xs">{a.total_clicks}</td>
                        <td className="py-2.5 px-3 text-xs">{a.total_sales}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{Number(a.total_commission).toLocaleString('pt-MZ')} MZN</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {a.status === 'active' ? 'Activo' : a.status === 'suspended' ? 'Suspenso' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {a.status === 'active' ? (
                            <button onClick={() => updateStatus(a.id, 'suspended')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200"><Ban size={12} className="inline mr-1" />Suspender</button>
                          ) : (
                            <button onClick={() => updateStatus(a.id, 'active')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200"><ShieldCheck size={12} className="inline mr-1" />Activar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'commissions' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Encomenda</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Valor</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Taxa</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {commissions.map(c => (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-xs">{c.order_number}</td>
                        <td className="py-2.5 px-3 text-xs">{c.affiliate?.user_email || c.affiliate_email || '—'}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{Number(c.amount).toLocaleString('pt-MZ')} MZN</td>
                        <td className="py-2.5 px-3 text-xs">{Number(c.commission_rate)}%</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[c.status] || c.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {c.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => commissionAction(c.id, 'approve')} className="px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200">Aprovar</button>
                              <button onClick={() => commissionAction(c.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'payouts' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Valor</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Método</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {payouts.map(p => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-xs">{p.affiliate_email}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{Number(p.amount).toLocaleString('pt-MZ')} MZN</td>
                        <td className="py-2.5 px-3 text-xs uppercase">{p.method}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[p.status] || p.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {p.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => payoutAction(p.id, 'approve')} className="px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200">Aprovar</button>
                              <button onClick={() => payoutAction(p.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'kyc' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Documento</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">NUIT</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Telefone</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {kycList.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma verificação pendente.</td></tr>
                    ) : kycList.map(k => (
                      <tr key={k.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-xs">{k.affiliate_email}</td>
                        <td className="py-2.5 px-3 text-xs">{k.document_number}</td>
                        <td className="py-2.5 px-3 text-xs">{k.nuit || '—'}</td>
                        <td className="py-2.5 px-3 text-xs">{k.payout_phone}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${k.status === 'approved' ? 'bg-green-100 text-green-700' : k.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {k.status === 'approved' ? 'Aprovado' : k.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {k.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => kycAction(k.id, 'approve')} className="px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200">Aprovar</button>
                              <button onClick={() => kycAction(k.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'settings' && settings && (
            <form onSubmit={saveSettings} className="bg-white rounded-xl border border-border p-6 max-w-md space-y-4">
              <div className="flex items-center gap-2 mb-2"><Percent size={16} className="text-accent" /><h3 className="font-bold">Configurações do Programa</h3></div>
              <div>
                <label className="block text-xs font-semibold mb-1">Janela de atribuição (dias)</label>
                <input type="number" min="1" value={settings.cookie_window_days} onChange={e => setSettings({ ...settings, cookie_window_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Taxa de comissão padrão (%)</label>
                <input type="number" step="0.01" min="0" value={settings.default_commission_rate} onChange={e => setSettings({ ...settings, default_commission_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Valor mínimo de saque (MZN)</label>
                <input type="number" step="0.01" min="0" value={settings.min_payout_amount} onChange={e => setSettings({ ...settings, min_payout_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Aprovar comissão após (dias)</label>
                <input type="number" min="0" value={settings.approve_after_days} onChange={e => setSettings({ ...settings, approve_after_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Janela de reversão (clawback, dias)</label>
                <input type="number" min="0" value={settings.clawback_days} onChange={e => setSettings({ ...settings, clawback_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Taxa de saque (%)</label>
                <input type="number" step="0.01" min="0" value={settings.payout_fee_percent} onChange={e => setSettings({ ...settings, payout_fee_percent: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Guardar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
