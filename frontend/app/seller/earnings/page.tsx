'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, X, Loader2, Download } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { storesAPI, walletAPI } from '@/src/lib/api';
import type { WalletInfo, WalletTransaction } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function SellerEarningsPage() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportDateFrom, setReportDateFrom] = useState(() => {
    const today = new Date();
    return localDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [reportDateTo, setReportDateTo] = useState(() => localDateString(new Date()));
  const [reportFormat, setReportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [transactionDateFrom, setTransactionDateFrom] = useState('');
  const [transactionDateTo, setTransactionDateTo] = useState('');
  const [transactionType, setTransactionType] = useState('all');
  const [transactionFormat, setTransactionFormat] = useState<ReportFormat>('csv');

  const reportFormatOptions = [
    { value: 'csv', label: 'CSV' },
    { value: 'excel', label: 'Excel (.xlsx)' },
    { value: 'pdf', label: 'PDF' },
  ] as const;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, allTransactions, pRes] = await Promise.all([
        walletAPI.myWallet(),
        (async () => {
          const results: WalletTransaction[] = [];
          let page = 1;
          let hasNext = true;
          while (hasNext) {
            const { data } = await walletAPI.myTransactions({ page_size: 100, page });
            results.push(...(data.results || []));
            hasNext = Boolean(data.next);
            page += 1;
          }
          return results;
        })(),
        walletAPI.myPayouts(),
      ]);
      setWallet(wRes.data);
      setTransactions(allTransactions);
      setPayouts(Array.isArray(pRes.data) ? pRes.data : (pRes.data as any)?.results || []);
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

  const downloadReport = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const response = await storesAPI.exportEarningsReport({
        date_from: reportDateFrom,
        date_to: reportDateTo,
        format: reportFormat,
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-vendas-${reportDateFrom}-${reportDateTo}.${reportFormat}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      let message = 'Não foi possível exportar o relatório. Tente novamente.';
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const body = JSON.parse(await data.text());
          message = body?.date?.[0] || body?.date_to?.[0]
            || body?.detail || body?.format?.[0] || message;
        } catch {
          message = 'Não foi possível ler a resposta do relatório.';
        }
      } else {
        message = data?.detail || data?.format?.[0] || message;
      }
      setReportError(message);
    } finally {
      setReportLoading(false);
    }
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
  const filteredTransactions = transactions.filter((transaction) => {
    const date = String(transaction.created_at || '').slice(0, 10);
    return (!transactionDateFrom || date >= transactionDateFrom)
      && (!transactionDateTo || date <= transactionDateTo)
      && (transactionType === 'all' || transaction.type === transactionType);
  });

  const exportTransactions = () => {
    const rows = filteredTransactions.map((transaction) => ({
      tipo: transaction.type,
      descricao: transaction.description || '',
      valor: Number(transaction.amount || 0),
      estado: transaction.status,
      data: String(transaction.created_at || '').slice(0, 10),
    }));
    const extension = transactionFormat === 'excel' ? 'xlsx' : transactionFormat;
    downloadReportFromObjects(transactionFormat, `transacoes-carteira-${new Date().toISOString().slice(0, 10)}.${extension}`,
      'Relatório de transações da carteira', ['tipo', 'descricao', 'valor', 'estado', 'data'], rows);
  };

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

        <section className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="mb-4">
            <h2 className="font-bold">Relatório de vendas</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Exporta encomendas pagas pela data de criação, com linhas de produtos,
              reembolsos e totais. O período máximo é de 366 dias e 50.000 linhas.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Data inicial
              <input
                type="date"
                value={reportDateFrom}
                max={reportDateTo}
                onChange={(event) => setReportDateFrom(event.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Data final
              <input
                type="date"
                value={reportDateTo}
                min={reportDateFrom}
                max={localDateString(new Date())}
                onChange={(event) => setReportDateTo(event.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Formato
              <select
                value={reportFormat}
                onChange={(event) => setReportFormat(event.target.value as 'csv' | 'excel' | 'pdf')}
                className="rounded-md border border-border bg-background px-3 py-2"
              >
                {reportFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={downloadReport}
              disabled={reportLoading || !reportDateFrom || !reportDateTo || reportDateFrom > reportDateTo}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reportLoading
                ? <Loader2 size={16} className="animate-spin" />
                : <Download size={16} />}
              {reportLoading ? 'A gerar...' : `Exportar ${reportFormatOptions.find((option) => option.value === reportFormat)?.label ?? 'CSV'}`}
            </button>
          </div>
          {reportError && (
            <p role="alert" className="mt-3 text-sm text-red-600">{reportError}</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            O relatório não distribui descontos por produto; o desconto e os totais
            da encomenda aparecem uma única vez por encomenda.
          </p>
        </section>

        <div className="bg-card border border-border rounded-xl">
          <div className="space-y-3 border-b border-border p-4">
            <h2 className="font-bold">Histórico de Transacções</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">De
                <input type="date" value={transactionDateFrom} max={transactionDateTo || undefined} onChange={(event) => setTransactionDateFrom(event.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">Até
                <input type="date" value={transactionDateTo} min={transactionDateFrom || undefined} onChange={(event) => setTransactionDateTo(event.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
              </label>
              <select aria-label="Filtrar transações por tipo" value={transactionType} onChange={(event) => setTransactionType(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="all">Todos os tipos</option>
                {Array.from(new Set(transactions.map((transaction) => transaction.type))).map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select aria-label="Formato do relatório" value={transactionFormat} onChange={(event) => setTransactionFormat(event.target.value as ReportFormat)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
              </select>
              <button type="button" onClick={exportTransactions} disabled={!filteredTransactions.length}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                <Download size={15} /> Exportar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{filteredTransactions.length} de {transactions.length} transações</p>
          </div>
          <div className="divide-y divide-border">
            {filteredTransactions.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma transacção corresponde aos filtros.</p>
            )}
            {filteredTransactions.map((tx) => {
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

        {/* Histórico de Saques */}
        <div className="bg-card border border-border rounded-xl mt-6">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Saques</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pedidos de saque submetidos e respectivo estado.</p>
          </div>
          <div className="divide-y divide-border">
            {payouts.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido de saque ainda.</p>
            )}
            {payouts.map((p) => {
              const statusStyles: Record<string, string> = {
                pending: 'bg-yellow-100 text-yellow-700',
                approved: 'bg-blue-100 text-blue-700',
                paid: 'bg-green-100 text-green-700',
                rejected: 'bg-red-100 text-red-700',
              };
              const methodLabels: Record<string, string> = {
                mpesa: 'M-Pesa', emola: 'e-Mola', bank: 'Banco', cash: 'Dinheiro',
              };
              return (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <TrendingDown size={16} className="text-gray-700" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {Number(p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                        <span className="text-muted-foreground font-normal"> · {methodLabels[p.method] || p.method_display || p.method}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[p.status] || 'bg-gray-100 text-gray-700'}`}>
                    {p.status_display || p.status}
                  </span>
                </div>
              );
            })}
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
