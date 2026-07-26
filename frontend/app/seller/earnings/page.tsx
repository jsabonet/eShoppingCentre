'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
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

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} message="A carregar..." /></div>
      </SellerLayout>
    );
  }

  const balance = Number(wallet?.balance || 0);
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
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-accent">{balance.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
            <button className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
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
    </SellerLayout>
  );
}
