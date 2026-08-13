'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';
import { walletAPI } from '@/src/lib/api';
import type { WalletInfo, WalletTransaction } from '@/src/lib/api';

export default function AccountWalletPage() {
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
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const balance = Number(wallet?.balance || 0);
  const payoutBalance = Number(wallet?.payout_balance || 0);

  return (
    <AccountLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Minha Carteira</h1>
            <p className="text-sm text-muted-foreground">Saldo de reembolsos e histórico de movimentos</p>
          </div>
          <button onClick={fetch} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Actualizar">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo na Carteira</p>
            <p className="text-3xl font-bold text-accent">{balance.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
            <p className="text-xs text-muted-foreground mt-2">Este saldo provém de reembolsos e pode ser usado em compras futuras.</p>
          </div>
          {payoutBalance > 0 && (
            <div className="bg-card border border-border rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-1">Saldo para Saque (vendedor/afiliado)</p>
              <p className="text-2xl font-bold">{payoutBalance.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
              <p className="text-xs text-muted-foreground mt-2">
                Disponível nos painéis de <a href="/seller/earnings" className="text-accent hover:underline">vendedor</a> ou <a href="/affiliate/earnings" className="text-accent hover:underline">afiliado</a>.
              </p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Movimentos</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">A carregar...</p>
            ) : transactions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum movimento ainda.</p>
            ) : transactions.map((tx) => {
              const isPositive = Number(tx.amount) >= 0;
              return (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                      {isPositive ? <TrendingUp size={16} className="text-green-700" /> : <TrendingDown size={16} className="text-red-700" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{Number(tx.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
