'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { walletAPI } from '@/src/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Rejeitado',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

function formatAccount(acc: any): string {
  if (!acc || typeof acc !== 'object') return '—';
  const parts = [acc.phone, acc.bank_name, acc.bank_account, acc.iban].filter(Boolean);
  return parts.join(' · ') || '—';
}

const fmt = (v: any) => Number(v || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 });

export default function AdminWallet() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        walletAPI.adminPayouts({ page_size: 200 }),
        walletAPI.adminReconciliation(),
      ]);
      setPayouts((pRes.data as any).results || pRes.data || []);
      setRecon(rRes.data);
    } catch { setPayouts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    try { await walletAPI.adminPayoutApprove(id); showToast('success', 'Saque aprovado.'); load(); }
    catch { showToast('error', 'Erro ao aprovar.'); }
  };
  const pay = async (id: string) => {
    const ref = prompt('Referência do pagamento manual (opcional):');
    if (ref === null) return;
    try { await walletAPI.adminPayoutPay(id, ref); showToast('success', 'Pagamento manual registado.'); load(); }
    catch { showToast('error', 'Erro ao registar pagamento.'); }
  };
  const reject = async (id: string) => {
    const reason = prompt('Motivo da rejeição:');
    if (reason === null) return;
    try { await walletAPI.adminPayoutReject(id, reason); showToast('success', 'Saque rejeitado.'); load(); }
    catch { showToast('error', 'Erro ao rejeitar.'); }
  };

  const pending = payouts.filter(p => p.status === 'pending').length;

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Wallet size={18} /> Saques & Reconciliação</h2>
          <p className="text-sm text-muted-foreground">{pending} saques pendentes · pagamento manual pelo admin</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
      </div>

      {recon && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {[
            { label: 'Cobrado (admin)', value: recon.collected_total, color: 'text-green-700' },
            { label: 'Taxas da plataforma', value: recon.platform_fees, color: 'text-purple-700' },
            { label: 'Comissões afiliados', value: recon.affiliate_commissions, color: 'text-amber-700' },
            { label: 'Pago em saques', value: recon.payouts_paid, color: 'text-red-700' },
            { label: 'Escrow retido', value: recon.escrow_held, color: 'text-blue-700' },
            { label: 'A pagar (passivo)', value: recon.liabilities, color: 'text-accent' },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-border rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className={`text-base font-bold ${k.color}`}>{fmt(k.value)} MZN</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Utilizador</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Papel</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Método</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Conta</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.user_name}</p>
                      <p className="text-xs text-muted-foreground">{p.user_email}</p>
                    </td>
                    <td className="py-3 px-4 capitalize">{p.role}</td>
                    <td className="py-3 px-4 font-semibold">{Number(p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</td>
                    <td className="py-3 px-4">{p.method_display}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-[180px] truncate">{formatAccount(p.account_details)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status] || ''}`}>
                        {STATUS_LABEL[p.status] || p.status}
                      </span>
                      {p.admin_reference && <p className="text-[10px] text-muted-foreground mt-1">Ref: {p.admin_reference}</p>}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {p.status === 'pending' && (
                        <button onClick={() => approve(p.id)} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700">Aprovar</button>
                      )}
                      {(p.status === 'pending' || p.status === 'approved') && (
                        <>
                          <button onClick={() => pay(p.id)} className="ml-1.5 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">Marcar Pago</button>
                          <button onClick={() => reject(p.id)} className="ml-1.5 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">Rejeitar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {payouts.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Sem pedidos de saque.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
