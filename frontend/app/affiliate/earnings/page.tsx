'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, ArrowUp, RefreshCw, Loader2, Wallet, X, ShieldCheck, FileText } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { affiliatesAPI, type AffiliateProfile } from '@/src/lib/api';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Rejeitado',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

export default function AffiliateEarningsPage() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayout, setShowPayout] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mpesa');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [kyc, setKyc] = useState<any>(null);
  const [showKYC, setShowKYC] = useState(false);
  const [kycForm, setKycForm] = useState({
    document_type: 'bi', document_number: '', nuit: '', payout_phone: '', bank_name: '', bank_account: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, k] = await Promise.all([
        affiliatesAPI.myProfile(),
        affiliatesAPI.myCommissions({ page_size: 100 }),
        affiliatesAPI.myKYC(),
      ]);
      setProfile(p.data);
      const cData = c.data;
      setCommissions(cData.results || cData || []);
      setKyc(k.data?.status && k.data.status !== 'none' ? k.data : null);
    } catch { setProfile(null); setCommissions([]); setKyc(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kycVerified = kyc?.status === 'approved';

  const openPayout = () => {
    if (!kycVerified) { setShowKYC(true); return; }
    setShowPayout(true);
  };

  const submitKYC = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await affiliatesAPI.submitKYC(kycForm);
      setKyc(data);
      setShowKYC(false);
      setToast({ type: 'success', text: 'Verificação submetida para análise.' });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      const detail = err?.response?.data;
      const msg = typeof detail === 'object' ? Object.values(detail).flat().join('. ') : detail || 'Erro.';
      setToast({ type: 'error', text: msg });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await affiliatesAPI.requestPayout({
        amount: Number(amount),
        method,
        account_details: {},
      });
      setToast({ type: 'success', text: 'Pedido de saque enviado para aprovação.' });
      setShowPayout(false);
      setAmount('');
      load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setToast({ type: 'error', text: typeof detail === 'string' ? detail : 'Erro ao solicitar saque.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const pendingTotal = commissions.filter(c => c.status === 'pending' || c.status === 'approved')
    .reduce((s, c) => s + Number(c.amount), 0);
  const paidTotal = commissions.filter(c => c.status === 'paid')
    .reduce((s, c) => s + Number(c.amount), 0);

  return (
    <AffiliateLayout>
      <div className="p-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {toast.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Comissões</h1>
            <p className="text-sm text-muted-foreground">Acompanhe as suas comissões e solicite saques</p>
          </div>
          <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-accent">{Number(profile?.available_commission || 0).toLocaleString('pt-MZ')} MZN</p>
            {kycVerified ? (
              <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600 font-medium"><ShieldCheck size={13} /> Conta verificada</span>
            ) : (
              <span className="inline-flex items-center gap-1 mt-2 text-xs text-amber-600 font-medium"><FileText size={13} /> Verificação pendente</span>
            )}
            <button onClick={openPayout}
              className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2">
              <Wallet size={16} /> Solicitar Saque
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Pendente</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingTotal.toLocaleString('pt-MZ')} MZN</p>
            <span className="text-xs text-muted-foreground">Aguarda aprovação/pagamento</span>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Recebido</p>
            <p className="text-2xl font-bold text-green-600">{paidTotal.toLocaleString('pt-MZ')} MZN</p>
            <span className="flex items-center gap-1 text-xs text-green-600"><ArrowUp size={12} />Total histórico</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Comissões</h2>
          </div>
          {loading ? (
            <div className="text-center py-12"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign size={48} className="mx-auto text-muted-foreground mb-3 opacity-30" />
              <p className="text-muted-foreground">Ainda não tem comissões.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Encomenda</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4">{c.product_name || '—'}</td>
                      <td className="py-3 px-4 font-mono text-xs">{c.order_number}</td>
                      <td className="py-3 px-4 font-medium text-accent">{Number(c.amount).toLocaleString('pt-MZ')} MZN</td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-MZ')}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                        {c.rejection_reason && <p className="text-[10px] text-red-500 mt-0.5">{c.rejection_reason}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* KYC Modal */}
      {showKYC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowKYC(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck size={18} /> Verificação de Conta (KYC)</h2>
              <button onClick={() => setShowKYC(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Para poder sacar as suas comissões, precisamos de verificar a sua identidade.</p>
            <form onSubmit={submitKYC} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Tipo de documento</label>
                <select value={kycForm.document_type} onChange={e => setKycForm(p => ({ ...p, document_type: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm">
                  <option value="bi">Bilhete de Identidade</option>
                  <option value="passport">Passaporte</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Número do documento</label>
                <input type="text" value={kycForm.document_number} onChange={e => setKycForm(p => ({ ...p, document_number: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">NUIT (opcional)</label>
                <input type="text" value={kycForm.nuit} onChange={e => setKycForm(p => ({ ...p, nuit: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Telefone de pagamento (M-Pesa/e-Mola) *</label>
                <input type="tel" placeholder="+258 84 000 0000" value={kycForm.payout_phone} onChange={e => setKycForm(p => ({ ...p, payout_phone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Banco (opcional, para transferência)</label>
                <input type="text" placeholder="Ex: Millennium BIM" value={kycForm.bank_name} onChange={e => setKycForm(p => ({ ...p, bank_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Nº de conta / IBAN (opcional)</label>
                <input type="text" value={kycForm.bank_account} onChange={e => setKycForm(p => ({ ...p, bank_account: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Submeter Verificação
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {showPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPayout(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Wallet size={18} /> Solicitar Saque</h2>
              <button onClick={() => setShowPayout(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Disponível: {Number(profile?.available_commission || 0).toLocaleString('pt-MZ')} MZN</p>
            <form onSubmit={requestPayout} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Valor (MZN)</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">Método de recebimento</label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm">
                  <option value="mpesa">M-Pesa</option>
                  <option value="emola">e-Mola</option>
                  <option value="bank">Transferência Bancária</option>
                </select>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null} Confirmar Pedido
              </button>
            </form>
          </div>
        </div>
      )}
    </AffiliateLayout>
  );
}
