'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, Loader2, CheckCircle, AlertCircle, Search, Download, Eye, X } from 'lucide-react';
import { walletAPI } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

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
const USER_TYPE_LABEL: Record<string, string> = {
  buyer: 'Comprador',
  seller: 'Vendedor',
  affiliate: 'Afiliado',
  admin: 'Administrador',
};

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

export default function AdminWallet() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [pendingCredits, setPendingCredits] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [walletSearch, setWalletSearch] = useState('');
  const [walletRoleFilter, setWalletRoleFilter] = useState('');
  const [creditSearch, setCreditSearch] = useState('');
  const [creditingOrderId, setCreditingOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<any | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [walletTransactionsLoading, setWalletTransactionsLoading] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('');
  const [transactionDateFrom, setTransactionDateFrom] = useState('');
  const [transactionDateTo, setTransactionDateTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allPayouts, rRes, allWallets, allPendingCredits] = await Promise.all([
        fetchAllPages<any>((page) => walletAPI.adminPayouts({ page_size: 100, page })),
        walletAPI.adminReconciliation(),
        fetchAllPages<any>((page) => walletAPI.adminWallets({ page_size: 100, page })),
        fetchAllPages<any>((page) => walletAPI.adminPendingCredits({ page_size: 100, page })),
      ]);
      setPayouts(allPayouts);
      setRecon(rRes.data);
      setWallets(allWallets);
      setPendingCredits(allPendingCredits);
    } catch {
      showToast('error', 'Não foi possível carregar carteiras, créditos pendentes e reconciliação.');
    }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    try { await walletAPI.adminPayoutApprove(id); showToast('success', 'Saque aprovado.'); load(); }
    catch { showToast('error', 'Erro ao aprovar.'); }
  };
  const pay = async (id: string) => {
    const ref = prompt('Referência da transferência manual já realizada:');
    if (ref === null) return;
    if (!ref.trim()) {
      showToast('error', 'A referência da transferência é obrigatória.');
      return;
    }
    try { await walletAPI.adminPayoutPay(id, ref); showToast('success', 'Pagamento manual registado.'); load(); }
    catch { showToast('error', 'Erro ao registar pagamento.'); }
  };
  const reject = async (id: string) => {
    const reason = prompt('Motivo da rejeição:');
    if (reason === null) return;
    try { await walletAPI.adminPayoutReject(id, reason); showToast('success', 'Saque rejeitado.'); load(); }
    catch { showToast('error', 'Erro ao rejeitar.'); }
  };

  const forceCreditOrder = async (order: any) => {
    const action = order.is_physical ? 'confirmar a receção e creditar' : 'creditar';
    const reason = window.prompt(`Motivo para ${action} a encomenda ${order.order_number}:`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('error', 'O motivo do crédito manual é obrigatório.');
      return;
    }
    if (!window.confirm(
      `${order.is_physical ? 'Confirmar a receção e creditar' : 'Creditar'} ${fmt(order.amount_to_credit)} MZN ao vendedor de "${order.store_name}"?`,
    )) return;

    setCreditingOrderId(order.id);
    try {
      const { data } = await walletAPI.adminForceOrderCredit(order.id, reason.trim());
      showToast('success', data.detail || 'Ação administrativa concluída.');
      await load();
    } catch (error: any) {
      showToast(
        'error',
        error?.response?.data?.detail || 'Não foi possível creditar esta encomenda.',
      );
    } finally {
      setCreditingOrderId(null);
    }
  };

  const openWalletTransactions = async (wallet: any) => {
    setSelectedWallet(wallet);
    setWalletTransactionsLoading(true);
    setTransactionSearch('');
    setTransactionTypeFilter('');
    setTransactionDateFrom('');
    setTransactionDateTo('');
    try {
      const transactions = await fetchAllPages<any>((page) =>
        walletAPI.adminWalletTransactions(wallet.user_id, { page_size: 100, page }),
      );
      setWalletTransactions(transactions);
    } catch {
      setWalletTransactions([]);
      showToast('error', 'Não foi possível carregar as transações desta carteira.');
    } finally {
      setWalletTransactionsLoading(false);
    }
  };

  const filteredWallets = wallets.filter((wallet) => {
    const query = walletSearch.trim().toLowerCase();
    const searchable = [
      wallet.user_name,
      wallet.user_email,
      wallet.store_name,
      ...(wallet.user_types || []).map((type: string) => USER_TYPE_LABEL[type] || type),
    ].join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && (!walletRoleFilter || (wallet.user_types || []).includes(walletRoleFilter));
  });

  const filteredWalletTransactions = walletTransactions.filter((transaction) => {
    const query = transactionSearch.trim().toLowerCase();
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
    return (!query || searchable.includes(query))
      && (!transactionTypeFilter || transaction.type === transactionTypeFilter)
      && (!transactionDateFrom || date >= transactionDateFrom)
      && (!transactionDateTo || date <= transactionDateTo);
  });

  const filteredPendingCredits = pendingCredits.filter((order) => {
    const query = creditSearch.trim().toLowerCase();
    const searchable = [
      order.order_number,
      order.store_name,
      order.buyer_name,
      order.buyer_email,
      order.seller_name,
      order.seller_email,
      ...(order.products || []).map((product: any) => product.name),
    ].join(' ').toLowerCase();
    return !query || searchable.includes(query);
  });

  const filteredPayouts = payouts.filter((p) => {
    const query = search.trim().toLowerCase();
    const createdDate = String(p.created_at || '').slice(0, 10);
    const searchable = [
      p.user_name,
      p.user_email,
      p.admin_reference,
      p.role,
      formatAccount(p.account_details),
    ].join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && (!statusFilter || p.status === statusFilter)
      && (!methodFilter || p.method === methodFilter)
      && (!roleFilter || p.role === roleFilter)
      && (!dateFrom || createdDate >= dateFrom)
      && (!dateTo || createdDate <= dateTo);
  });
  const pending = payouts.filter(p => p.status === 'pending').length;
  const reconciliationMetrics = recon ? [
    { label: 'Pagamentos confirmados', value: recon.collected_total, color: 'text-green-700' },
    { label: 'Recebido por gateway', value: recon.gateway_collected_total, color: 'text-green-700' },
    { label: 'Pago com saldo da carteira', value: recon.wallet_funded_total, color: 'text-blue-700' },
    { label: 'Pagamentos de teste (simulados)', value: recon.simulated_test_total, color: 'text-muted-foreground' },
    { label: `Pagamentos gateway em aberto (${recon.gateway_open_count || 0})`, value: recon.gateway_open_total, color: 'text-orange-700' },
    { label: `Pagamentos recebidos a reembolsar (${recon.gateway_refunds_pending_count || 0})`, value: recon.gateway_refunds_pending_total, color: 'text-red-700' },
    { label: `Tentativas falhadas (${recon.gateway_failed_count || 0})`, value: recon.gateway_failed_total, color: 'text-muted-foreground' },
    { label: 'Reembolsos na carteira', value: recon.refunds_total, color: 'text-red-700' },
    { label: 'Cobrado após reembolsos', value: recon.net_collected, color: 'text-green-700' },
    { label: 'Taxas em encomendas pagas', value: recon.platform_fees, color: 'text-purple-700' },
    { label: 'Comissões aprovadas/pagas', value: recon.affiliate_commissions, color: 'text-amber-700' },
    { label: 'Comissões pendentes', value: recon.affiliate_commissions_pending, color: 'text-amber-700' },
    { label: 'Comissões ainda não creditadas', value: recon.affiliate_commissions_uncredited, color: 'text-orange-700' },
    { label: 'Saques pagos', value: recon.payouts_paid, color: 'text-red-700' },
    { label: 'Saques pendentes', value: recon.payouts_pending, color: 'text-orange-700' },
    { label: 'Escrow retido', value: recon.escrow_held, color: 'text-blue-700' },
    { label: 'Saldo comprador', value: recon.wallets_buyer_balance, color: 'text-blue-700' },
    { label: 'Passivo total estimado', value: recon.liabilities, color: 'text-accent' },
  ] : [];

  const exportPayouts = () => {
    if (!recon) {
      showToast('error', 'Dados de reconciliação indisponíveis. Atualize os dados antes de exportar.');
      return;
    }

    const rows = filteredPayouts.map((p) => ({
      utilizador: p.user_name || '',
      email: p.user_email || '',
      papel: p.role || '',
      valor_bruto_mzn: Number(p.amount || 0),
      taxa_mzn: Number(p.fee || 0),
      valor_transferido_mzn: Number(p.net_amount ?? p.amount ?? 0),
      metodo: p.method_display || p.method || '',
      conta: formatAccount(p.account_details),
      estado: STATUS_LABEL[p.status] || p.status,
      referencia: p.admin_reference || '',
      criado_em: p.created_at ? new Date(p.created_at).toLocaleString('pt-MZ') : '',
      aprovado_em: p.approved_at ? new Date(p.approved_at).toLocaleString('pt-MZ') : '',
      pago_em: p.paid_at ? new Date(p.paid_at).toLocaleString('pt-MZ') : '',
      motivo_rejeicao: p.rejection_reason || '',
    }));
    void downloadReportFromObjects(
      reportFormat,
      `relatorio-saques-${new Date().toISOString().slice(0, 10)}.${reportFormat === 'excel' ? 'xlsx' : reportFormat}`,
      'Relatório de saques',
      ['utilizador', 'email', 'papel', 'valor_bruto_mzn', 'taxa_mzn', 'valor_transferido_mzn', 'metodo', 'conta', 'estado', 'referencia', 'criado_em', 'aprovado_em', 'pago_em', 'motivo_rejeicao'],
      rows,
      {
        period: dateFrom || dateTo ? `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` : 'Todo o período',
        filters: [
          { label: 'Estado', value: statusFilter ? STATUS_LABEL[statusFilter] || statusFilter : 'Todos' },
          { label: 'Método', value: methodFilter || 'Todos' },
          { label: 'Papel', value: roleFilter || 'Todos' },
          { label: 'Pesquisa', value: search.trim() || '—' },
        ],
        pdfSections: [{
          title: 'Saques & Reconciliação',
          items: reconciliationMetrics.map((metric) => ({
            label: metric.label,
            value: `${fmt(metric.value)} MZN`,
          })),
        }],
        summary: [
          { label: 'Pedidos', value: rows.length },
          { label: 'Valor bruto (MZN)', value: rows.reduce((sum, payout) => sum + payout.valor_bruto_mzn, 0).toFixed(2) },
          { label: 'Taxas (MZN)', value: rows.reduce((sum, payout) => sum + payout.taxa_mzn, 0).toFixed(2) },
          { label: 'Valor transferido (MZN)', value: rows.reduce((sum, payout) => sum + payout.valor_transferido_mzn, 0).toFixed(2) },
          { label: 'Pendentes', value: filteredPayouts.filter((p) => p.status === 'pending').length },
          { label: 'Pagos', value: filteredPayouts.filter((p) => p.status === 'paid').length },
        ],
        columns: ['Utilizador', 'Email', 'Papel', 'Valor (MZN)', 'Método', 'Conta', 'Estado', 'Referência', 'Criado em', 'Aprovado em', 'Pago em', 'Motivo da rejeição'],
      },
    ).catch(() => showToast('error', 'Não foi possível gerar o relatório de saques.'));
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
          <h2 className="text-lg font-bold flex items-center gap-2"><Wallet size={18} /> Saques & Reconciliação</h2>
          <p className="text-sm text-muted-foreground">{pending} saques pendentes · pagamento manual pelo admin</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
      </div>

      {recon && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
          {reconciliationMetrics.map((k) => (
            <div key={k.label} className="bg-white border border-border rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className={`text-base font-bold ${k.color}`}>{fmt(k.value)} MZN</p>
            </div>
          ))}
        </div>
      )}

      <section className="mb-6 overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold">Compras pagas sem crédito ao vendedor</h3>
            <p className="text-xs text-muted-foreground">
              Escrows retidos e liquidações em falta, agrupados por encomenda, loja e produto.
              A ação manual confirma a receção e regista o motivo no histórico.
            </p>
          </div>
          <input
            type="search"
            value={creditSearch}
            onChange={(event) => setCreditSearch(event.target.value)}
            placeholder="Pesquisar encomenda, loja, produto ou utilizador"
            className="min-h-10 w-full rounded-lg border border-border px-3 text-sm sm:max-w-sm"
          />
        </div>
        {loading ? (
          <div className="py-10 text-center"><Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Encomenda</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Loja / vendedor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Comprador</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produtos</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Por creditar</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPendingCredits.map((order) => (
                  <tr key={order.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground capitalize">{order.status.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        Pago: {order.payment_confirmed_at
                          ? new Date(order.payment_confirmed_at).toLocaleDateString('pt-MZ')
                          : 'data não registada'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.store_name || 'Loja indisponível'}</p>
                      <p className="text-xs text-muted-foreground">{order.seller_name}</p>
                      <p className="text-xs text-muted-foreground">{order.seller_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{order.buyer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {(order.products || []).map((product: any, index: number) => (
                        <p key={`${product.name}-${index}`} className="text-xs">
                          {product.name} × {product.quantity}
                        </p>
                      ))}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {order.credit_state === 'escrow_retido' ? 'Saldo retido em escrow' : 'Liquidação em falta'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {fmt(order.amount_to_credit)} MZN
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => forceCreditOrder(order)}
                        disabled={creditingOrderId === order.id}
                        className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {creditingOrderId === order.id && <Loader2 size={14} className="animate-spin" />}
                        {order.is_physical ? 'Confirmar e creditar' : 'Creditar manualmente'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPendingCredits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      {pendingCredits.length ? 'Nenhuma compra corresponde à pesquisa.' : 'Não há compras pagas pendentes de crédito.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {filteredPendingCredits.length} de {pendingCredits.length} encomendas pendentes
        </p>
      </section>

      <section className="mb-6 overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold">Carteiras por utilizador</h3>
            <p className="text-xs text-muted-foreground">
              Saldo do comprador, saldo de saque disponível e valores reservados.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row">
            <input
              type="search"
              value={walletSearch}
              onChange={(event) => setWalletSearch(event.target.value)}
              placeholder="Pesquisar nome, email ou loja"
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-border px-3 text-sm"
            />
            <select
              value={walletRoleFilter}
              onChange={(event) => setWalletRoleFilter(event.target.value)}
              className="min-h-10 rounded-lg border border-border px-3 text-sm"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(USER_TYPE_LABEL).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="py-10 text-center"><Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Utilizador</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo(s)</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Saldo comprador</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Disponível para saque</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Reservado</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total levantado</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Auditoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredWallets.map((wallet) => (
                  <tr key={wallet.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{wallet.user_name}</p>
                      <p className="text-xs text-muted-foreground">{wallet.user_email}</p>
                      {wallet.store_name && <p className="text-xs text-muted-foreground">{wallet.store_name}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {(wallet.user_types || []).map((type: string) => USER_TYPE_LABEL[type] || type).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmt(wallet.balance)} MZN</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmt(wallet.available_payout)} MZN</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmt(wallet.reserved_balance)} MZN</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmt(wallet.total_withdrawn)} MZN</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openWalletTransactions(wallet)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <Eye size={13} /> Ver transações
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredWallets.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma carteira corresponde à pesquisa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {filteredWallets.length} de {wallets.length} carteiras
        </p>
      </section>

      {selectedWallet && (
        <section className="mb-6 overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-bold">Transações da carteira</h3>
              <p className="text-xs text-muted-foreground">
                {selectedWallet.user_name} · {selectedWallet.user_email}
                {selectedWallet.store_name ? ` · ${selectedWallet.store_name}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedWallet(null)}
              className="inline-flex min-h-9 items-center justify-center gap-1 self-start rounded-md border border-border px-3 text-sm hover:bg-muted"
            >
              <X size={14} /> Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-border p-4 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
              Pesquisar origem
              <input
                type="search"
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                placeholder="Encomenda, saque, afiliado, referência ou idempotência"
                className="min-h-10 rounded-lg border border-border px-3 text-sm text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Tipo
              <select
                value={transactionTypeFilter}
                onChange={(event) => setTransactionTypeFilter(event.target.value)}
                className="min-h-10 rounded-lg border border-border px-3 text-sm"
              >
                <option value="">Todos</option>
                {Array.from(new Set(walletTransactions.map((item) => item.type))).sort().map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                De
                <input type="date" value={transactionDateFrom} max={transactionDateTo || undefined} onChange={(event) => setTransactionDateFrom(event.target.value)}
                  className="min-h-10 rounded-lg border border-border px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Até
                <input type="date" value={transactionDateTo} min={transactionDateFrom || undefined} onChange={(event) => setTransactionDateTo(event.target.value)}
                  className="min-h-10 rounded-lg border border-border px-2 text-sm" />
              </label>
            </div>
          </div>

          {walletTransactionsLoading ? (
            <div className="py-10 text-center"><Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" /></div>
          ) : (
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
                  {filteredWalletTransactions.map((transaction) => {
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
                            <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                              {transaction.idempotency_key}
                            </p>
                          )}
                          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                            {transaction.reference_type}:{transaction.reference_id}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWalletTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground">
                        Nenhuma transação corresponde aos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {filteredWalletTransactions.length} de {walletTransactions.length} transações
          </p>
        </section>
      )}

      <section className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2 xl:col-span-4">
          <span className="flex items-center gap-1"><Search size={13} /> Pesquisar utilizador ou referência</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, email, conta ou referência"
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Data inicial
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Data final
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="">Todos os estados</option>
            {Object.entries(STATUS_LABEL).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Método
          <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="">Todos os métodos</option>
            <option value="mpesa">M-Pesa</option>
            <option value="emola">e-Mola</option>
            <option value="bank">Transferência Bancária</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Papel
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="">Todos</option>
            <option value="seller">Vendedor</option>
            <option value="affiliate">Afiliado</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Formato do relatório
          <select value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
            className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-white px-3 text-sm text-foreground">
            <option value="csv">CSV</option>
            <option value="excel">Excel (.xlsx)</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button type="button" onClick={exportPayouts} disabled={!filteredPayouts.length || !recon}
          className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 self-end rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
          <Download size={15} /> Exportar relatório
        </button>
        <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
          {filteredPayouts.length} de {payouts.length} pedidos de saque
        </p>
      </section>

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
                {filteredPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.user_name}</p>
                      <p className="text-xs text-muted-foreground">{p.user_email}</p>
                    </td>
                    <td className="py-3 px-4 capitalize">{p.role}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold">{Number(p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN bruto</p>
                      <p className="text-xs text-muted-foreground">
                        Taxa {Number(p.fee || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN · transferir {Number(p.net_amount ?? p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                      </p>
                    </td>
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
                        <>
                          <button onClick={() => approve(p.id)} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700">Aprovar</button>
                          <button onClick={() => reject(p.id)} className="ml-1.5 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">Rejeitar</button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <>
                          <button onClick={() => pay(p.id)} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700">Marcar Pago</button>
                          <button onClick={() => reject(p.id)} className="ml-1.5 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">Rejeitar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredPayouts.length === 0 && (
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
