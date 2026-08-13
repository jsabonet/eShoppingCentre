'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, X, Loader2 } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { walletAPI } from '@/src/lib/api';
import type { WalletInfo, WalletTransaction } from '@/src/lib/api';

export default function SellerEarningsPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, tRes] = await Promise.all([
        walletAPI.myWallet(),
        walletAPI.myTransactions(),
      ]);
      setWallet(wRes.data);
      setTransactions((tRes.data as any).results || tRes.data || []);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('mpesa');
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutBankAccount, setPayoutBankAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) { setPayoutError('Indique um valor válido.'); return; }
    setSubmitting(true); setPayoutError(''); setPayoutSuccess('');
    try {
      const account_details: Record<string, string> = {};
      if (payoutMethod === 'bank') {
        account_details.bank_name = payoutBankName;
        account_details.bank_account = payoutBankAccount;
      } else {
        account_details.phone = payoutPhone;
      }
      await walletAPI.requestPayout({ amount, method: payoutMethod, account_details, role: 'seller' });
      setPayoutSuccess('Pedido de saque enviado. O admin irá processar o pagamento manualmente.');
      setShowPayout(false);
      fetch();
    } catch (err: any) {
      setPayoutError(err?.response?.data?.detail || 'Erro ao solicitar saque.');
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  const available = Number(wallet?.available_payout ?? wallet?.payout_balance ?? 0);
  const totalEarned = Number(wallet?.total_earned || 0);

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Ganhos</h1>
            <p className="text-sm text-muted-foreground">Acompanhe seus rendimentos e saldo</p>
          </div>
          <button onClick={fetch} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Actualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível para Saque</p>
            <p className="text-3xl font-bold text-accent">{available.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
            <button onClick={() => setShowPayout(true)}
              className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              Solicitar Saque
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Ganho</p>
            <p className="text-2xl font-bold">{totalEarned.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Transacções</p>
            <p className="text-2xl font-bold">{transactions.length}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Transacções</h2>
          </div>
          <div className="divide-y divide-border">
            {transactions.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma transacção ainda.</p>
            )}
            {transactions.map((tx) => {
              const isPositive = tx.type === 'sale' || tx.type === 'deposit' || tx.type === 'refund';
              const isSale = tx.type === 'sale';
              const isWithdrawal = tx.type === 'withdrawal';
              const isCommission = tx.type === 'commission' || tx.type === 'fee';
              return (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    isSale ? 'bg-green-100' :
                    isWithdrawal ? 'bg-red-100' :
                    isCommission ? 'bg-purple-100' :
                    'bg-gray-100'
                  }`}>
                    {isPositive ? <TrendingUp size={16} className="text-green-700" /> :
                     isWithdrawal ? <TrendingDown size={16} className="text-red-700" /> :
                     <DollarSign size={16} className={isCommission ? 'text-purple-700' : 'text-gray-700'} />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tx.description || 'Transacção #' + tx.id?.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{Number(tx.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                </span>
              </div>
            )})}
          </div>
        </div>
      </div>
      {/* Solicitar Saque Modal */}
      {showPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPayout(false)} />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Solicitar Saque</h2>
              <button onClick={() => setShowPayout(false)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Disponível: <span className="font-bold text-foreground">{available.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span>
            </p>
            <form onSubmit={requestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Valor (MZN)</label>
                <input type="number" min="1" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Método</label>
                <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background">
                  <option value="mpesa">M-Pesa</option>
                  <option value="emola">e-Mola</option>
                  <option value="bank">Transferência Bancária</option>
                </select>
              </div>
              {payoutMethod === 'bank' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Banco</label>
                    <input type="text" value={payoutBankName} onChange={e => setPayoutBankName(e.target.value)} placeholder="Ex: Millennium BIM"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Número de Conta / IBAN</label>
                    <input type="text" value={payoutBankAccount} onChange={e => setPayoutBankAccount(e.target.value)} placeholder="Ex: 000000000000000"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" required />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold mb-1">Número ({payoutMethod === 'mpesa' ? 'M-Pesa' : 'e-Mola'})</label>
                  <input type="tel" value={payoutPhone} onChange={e => setPayoutPhone(e.target.value)} placeholder="+258 84 000 0000"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background" required />
                </div>
              )}
              {payoutError && <p className="text-xs text-red-600">{payoutError}</p>}
              {payoutSuccess && <p className="text-xs text-green-600">{payoutSuccess}</p>}
              <button type="submit" disabled={submitting}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground rounded-lg font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : null} Confirmar Pedido
              </button>
            </form>
          </div>
        </div>
      )}    </SellerLayout>
  );
}
