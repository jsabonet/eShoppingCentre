'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, RefreshCw, Loader2, CheckCircle, AlertCircle, Search, Download } from 'lucide-react';
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

export default function AdminWallet() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allPayouts, rRes] = await Promise.all([
        (async () => {
          const result: any[] = [];
          let page = 1;
          let hasNext = true;
          while (hasNext) {
            const { data } = await walletAPI.adminPayouts({ page_size: 100, page });
            const pageResults = Array.isArray(data) ? data : data.results || [];
            result.push(...pageResults);
            hasNext = !Array.isArray(data) && Boolean(data.next);
            page += 1;
          }
          return result;
        })(),
        walletAPI.adminReconciliation(),
      ]);
      setPayouts(allPayouts);
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

  const exportPayouts = () => {
    const rows = filteredPayouts.map((p) => ({
      utilizador: p.user_name || '',
      email: p.user_email || '',
      papel: p.role || '',
      valor_mzn: Number(p.amount || 0),
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
      ['utilizador', 'email', 'papel', 'valor_mzn', 'metodo', 'conta', 'estado', 'referencia', 'criado_em', 'aprovado_em', 'pago_em', 'motivo_rejeicao'],
      rows,
      {
        period: dateFrom || dateTo ? `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` : 'Todo o período',
        filters: [
          { label: 'Estado', value: statusFilter ? STATUS_LABEL[statusFilter] || statusFilter : 'Todos' },
          { label: 'Método', value: methodFilter || 'Todos' },
          { label: 'Papel', value: roleFilter || 'Todos' },
          { label: 'Pesquisa', value: search.trim() || '—' },
        ],
        summary: [
          { label: 'Pedidos', value: rows.length },
          { label: 'Valor total (MZN)', value: rows.reduce((sum, payout) => sum + payout.valor_mzn, 0).toFixed(2) },
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
          {[
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
          ].map((k) => (
            <div key={k.label} className="bg-white border border-border rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className={`text-base font-bold ${k.color}`}>{fmt(k.value)} MZN</p>
            </div>
          ))}
        </div>
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
        <button type="button" onClick={exportPayouts} disabled={!filteredPayouts.length}
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
