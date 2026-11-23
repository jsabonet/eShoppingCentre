'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Loader2, Search, Wallet } from 'lucide-react';
import AdminLayout from '@/src/components/admin/AdminLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useAuth } from '@/src/hooks/useAuth';
import { walletAPI } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

const fmt = (value: any) =>
  Number(value || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 });

async function fetchAllPages<T>(loadPage: (page: number) => Promise<{ data: any }>): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const { data } = await loadPage(page);
    const pageRows = Array.isArray(data) ? data : data.results || [];
    rows.push(...pageRows);
    hasNext = !Array.isArray(data) && Boolean(data.next);
    page += 1;
  }
  return rows;
}

export default function AdminWalletTransactionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [walletMode, setWalletMode] = useState<'buyer' | 'seller'>('buyer');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/login?redirect=/admin');
      return;
    }
    if (!isAuthenticated || !isAdmin || !id) return;

    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [allWallets, allTransactions, buyerOrdersResponse] = await Promise.all([
          fetchAllPages<any>((page) => walletAPI.adminWallets({ page_size: 100, page })),
          fetchAllPages<any>((page) => walletAPI.adminWalletTransactions(id, { page_size: 100, page })),
          walletAPI.adminBuyerOrders(id),
        ]);
        setWallet(allWallets.find((item) => String(item.user_id) === String(id)) || null);
        setTransactions(allTransactions);
        setBuyerOrders(buyerOrdersResponse.data.results || []);
      } catch {
        setError('Não foi possível carregar esta carteira e suas transações.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isAuthenticated, isAdmin, authLoading, router]);

  const walletPurchaseOrderIds = new Set(
    transactions
      .filter((transaction) =>
        transaction.reference_type === 'order'
        && (transaction.ledger_entries || []).some((entry: any) => entry.kind === 'buyer')
      )
      .map((transaction) => String(transaction.reference_id)),
  );
  const syntheticBuyerTransactions = buyerOrders
    .filter((order) => !walletPurchaseOrderIds.has(String(order.id)))
    .map((order) => ({
      id: `buyer-order-${order.id}`,
      type: 'purchase',
      amount: `-${order.order_total}`,
      balance_before: '0.00',
      balance_after: '0.00',
      reference_type: 'order',
      reference_id: order.id,
      description: `Compra ${order.order_number} via ${order.payment_method}`,
      status: 'completed',
      idempotency_key: order.payment_id ? `payment:${order.payment_id}` : null,
      created_at: order.created_at,
      ledger_entries: [{
        id: `buyer-order-ledger-${order.id}`,
        direction: 'debit',
        amount: order.order_total,
        balance_before: '0.00',
        balance_after: '0.00',
        kind: 'buyer',
        counterparty: 'external',
        created_at: order.created_at,
      }],
      origin: {
        type: 'order',
        id: order.id,
        order_number: order.order_number,
        store_name: order.store_name,
        buyer_email: wallet?.user_email,
        payment_status: order.payment_status,
        order_status: order.order_status,
        order_total: order.order_total,
        products: order.products,
        payment_method: order.payment_method,
      },
    }));
  const combinedTransactions = [...transactions, ...syntheticBuyerTransactions];

  const transactionMatchesMode = (transaction: any) => {
    const kinds = (transaction.ledger_entries || []).map((entry: any) => entry.kind);
    if (walletMode === 'buyer') {
      return kinds.includes('buyer') || (
        !kinds.length && ['purchase', 'refund', 'deposit'].includes(transaction.type)
      );
    }
    return kinds.includes('payout') || kinds.includes('platform') || (
      !kinds.length && ['sale', 'withdrawal', 'fee', 'affiliate_commission', 'commission'].includes(transaction.type)
    );
  };

  const filtered = combinedTransactions.filter((transaction) => {
    const query = search.trim().toLowerCase();
    const date = String(transaction.created_at || '').slice(0, 10);
    const origin = transaction.origin || {};
    const searchable = [
      transaction.id,
      transaction.type,
      transaction.description,
      transaction.reference_type,
      transaction.reference_id,
      transaction.idempotency_key,
      origin.order_number,
      origin.store_name,
      origin.buyer_email,
      origin.affiliate_email,
      origin.admin_reference,
    ].join(' ').toLowerCase();
    return transactionMatchesMode(transaction)
      && (!query || searchable.includes(query))
      && (!typeFilter || transaction.type === typeFilter)
      && (!dateFrom || date >= dateFrom)
      && (!dateTo || date <= dateTo);
  });

  const exportTransactions = () => {
    const rows = filtered.map((transaction) => {
      const origin = transaction.origin || {};
      return {
        modo: walletMode === 'buyer' ? 'Comprador' : 'Vendedor/Afiliado',
        data: transaction.created_at ? new Date(transaction.created_at).toLocaleString('pt-MZ') : '',
        estado: transaction.status,
        tipo: transaction.type,
        origem_tipo: origin.type || transaction.reference_type,
        origem_id: origin.id || transaction.reference_id,
        encomenda: origin.order_number || '',
        loja: origin.store_name || '',
        produtos: (origin.products || []).map((product: any) =>
          `${product.quantity}x ${product.name}`
        ).join(' | ') ,
        afiliado: origin.affiliate_email || '',
        referencia_admin: origin.admin_reference || '',
        descricao: transaction.description || '',
        valor_mzn: Number(transaction.amount || 0),
        saldo_antes_mzn: Number(transaction.balance_before || 0),
        saldo_depois_mzn: Number(transaction.balance_after || 0),
        idempotencia: transaction.idempotency_key || '',
        ledger: (transaction.ledger_entries || []).map((entry: any) =>
          `${entry.direction}:${entry.kind}:${entry.counterparty}:${entry.amount}`
        ).join(' | '),
      };
    });
    const extension = reportFormat === 'excel' ? 'xlsx' : reportFormat;
    void downloadReportFromObjects(
      reportFormat,
      `transacoes-carteira-${id}.${extension}`,
      'Transações da carteira',
      ['modo', 'data', 'estado', 'tipo', 'origem_tipo', 'origem_id', 'encomenda', 'loja', 'produtos', 'afiliado', 'referencia_admin', 'descricao', 'valor_mzn', 'saldo_antes_mzn', 'saldo_depois_mzn', 'idempotencia', 'ledger'],
      rows,
      {
        subtitle: wallet?.user_email || '',
        period: dateFrom || dateTo ? `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` : 'Todo o período',
        summary: [
          { label: 'Transações', value: rows.length },
          { label: 'Créditos (MZN)', value: rows.filter((row) => row.valor_mzn > 0).reduce((sum, row) => sum + row.valor_mzn, 0).toFixed(2) },
          { label: 'Débitos (MZN)', value: rows.filter((row) => row.valor_mzn < 0).reduce((sum, row) => sum + row.valor_mzn, 0).toFixed(2) },
        ],
        columns: ['Data', 'Estado', 'Tipo', 'Origem', 'Encomenda', 'Loja', 'Afiliado', 'Valor (MZN)', 'Antes (MZN)', 'Depois (MZN)', 'Idempotência'],
      },
    );
  };

  if (authLoading || loading) {
    return (
      <AdminLayout>
        <LoadingSpinner size={40} message="A carregar transações da carteira..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/admin?tab=wallet"
              className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
              aria-label="Voltar a Saques"
            >
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Transações da carteira</h1>
              {wallet ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {wallet.user_name} · {wallet.user_email}
                  {wallet.store_name ? ` · ${wallet.store_name}` : ''}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Utilizador #{id}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={reportFormat}
              onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
              className="min-h-10 rounded-lg border border-border px-3 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              type="button"
              onClick={exportTransactions}
              disabled={!filtered.length}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <Download size={15} /> Exportar
            </button>
          </div>
        </div>

        {wallet && (
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(walletMode === 'buyer'
              ? [
                  ['Saldo gasto', wallet.total_spent],
                  ['Saldo disponível do comprador', wallet.balance],
                  ['Transações do comprador', filtered.filter((transaction) => {
                    const kinds = (transaction.ledger_entries || []).map((entry: any) => entry.kind);
                    return kinds.includes('buyer');
                  }).length],
                ]
              : [
                  ['Disponível para saque', wallet.available_payout],
                  ['Saldo bruto de venda', wallet.payout_balance],
                  ['Reservado em saques', wallet.reserved_balance],
                  ['Total ganho', wallet.total_earned],
                  ['Total levantado', wallet.total_withdrawn],
                  ['Transações vendedor/afiliado', filtered.length],
                ]).map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-white p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold">
                  {String(label).includes('Transações')
                    ? String(value)
                    : `${fmt(value)} MZN`}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-border bg-white p-2">
          <button
            type="button"
            onClick={() => { setWalletMode('buyer'); setTypeFilter(''); }}
            className={`min-h-10 rounded-lg px-4 text-sm font-medium ${
              walletMode === 'buyer'
                ? 'bg-blue-600 text-white'
                : 'border border-border bg-white text-foreground hover:bg-muted'
            }`}
          >
            Modo comprador
          </button>
          <button
            type="button"
            onClick={() => { setWalletMode('seller'); setTypeFilter(''); }}
            className={`min-h-10 rounded-lg px-4 text-sm font-medium ${
              walletMode === 'seller'
                ? 'bg-green-600 text-white'
                : 'border border-border bg-white text-foreground hover:bg-muted'
            }`}
          >
            Modo vendedor / afiliado
          </button>
        </div>

        <section className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-4 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
            <span className="flex items-center gap-1"><Search size={13} /> Pesquisar origem</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Encomenda, saque, afiliado, referência ou idempotência"
              className="min-h-10 rounded-lg border border-border px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Tipo
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}
              className="min-h-10 rounded-lg border border-border px-3 text-sm">
              <option value="">Todos</option>
              {Array.from(new Set(
                combinedTransactions
                  .filter((item) => transactionMatchesMode(item))
                  .map((item) => item.type)
              )).sort().map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              De
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}
                className="min-h-10 rounded-lg border border-border px-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Até
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}
                className="min-h-10 rounded-lg border border-border px-2 text-sm" />
            </label>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data / estado</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Origem</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Antes</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Depois</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ledger / idempotência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((transaction) => {
                  const origin = transaction.origin || {};
                  const originText = origin.order_number
                    ? `Encomenda ${origin.order_number}${origin.store_name ? ` · ${origin.store_name}` : ''}`
                    : origin.affiliate_email
                      ? `Comissão · ${origin.affiliate_email}${origin.order_number ? ` · ${origin.order_number}` : ''}`
                      : origin.role
                        ? `Saque ${origin.role} · ${origin.status}${origin.admin_reference ? ` · ${origin.admin_reference}` : ''}`
                        : transaction.description || 'Sistema';
                  return (
                    <tr key={transaction.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p>{transaction.created_at ? new Date(transaction.created_at).toLocaleString('pt-MZ') : '—'}</p>
                        <p className="text-xs text-muted-foreground">{transaction.status}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{transaction.type}</span>
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <p className="font-medium">{originText}</p>
                        {transaction.description && <p className="mt-1 text-xs text-muted-foreground">{transaction.description}</p>}
                        {origin.order_total && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Total {fmt(origin.order_total)} · taxa {fmt(origin.platform_fee)} · comissão afil. {fmt(origin.affiliate_commission)} MZN
                          </p>
                        )}
                        {origin.products && origin.products.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Produtos: {origin.products.map((product: any) =>
                              `${product.quantity}× ${product.name}`
                            ).join(', ')}
                          </p>
                        )}
                        {origin.commission_rate && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Taxa {fmt(origin.commission_rate)}% · líquido {fmt(origin.amount)} MZN
                          </p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${Number(transaction.amount) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {Number(transaction.amount) >= 0 ? '+' : ''}{fmt(transaction.amount)} MZN
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{fmt(transaction.balance_before)} MZN</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{fmt(transaction.balance_after)} MZN</td>
                      <td className="px-4 py-3 min-w-[260px]">
                        {(transaction.ledger_entries || []).map((entry: any) => (
                          <p key={entry.id} className="text-xs">
                            {entry.direction} · {entry.kind} · {entry.counterparty} · {fmt(entry.amount)} MZN
                          </p>
                        ))}
                        {transaction.idempotency_key && (
                          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{transaction.idempotency_key}</p>
                        )}
                        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                          {transaction.reference_type}:{transaction.reference_id}
                        </p>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      Nenhuma transação corresponde aos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} de {combinedTransactions.length} transações
          </p>
        </section>
      </div>
    </AdminLayout>
  );
}
