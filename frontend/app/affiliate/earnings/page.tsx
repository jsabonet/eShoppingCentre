'use client';

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, ArrowUp, RefreshCw, Loader2, Wallet, X, ShieldCheck, FileText, Search, Download } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';
import { affiliatesAPI, walletAPI, type AffiliateProfile, type WalletInfo } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Rejeitado',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

export default function AffiliateEarningsPage() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');
  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('all');
  const [payoutDateFrom, setPayoutDateFrom] = useState('');
  const [payoutDateTo, setPayoutDateTo] = useState('');
  const [payoutFormat, setPayoutFormat] = useState<ReportFormat>('csv');
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
      const [p, c, k, w, walletResponse] = await Promise.all([
        affiliatesAPI.myProfile(),
        (async () => {
          const results: any[] = [];
          let page = 1;
          let hasNext = true;
          while (hasNext) {
            const { data } = await affiliatesAPI.myCommissions({ page_size: 100, page });
            results.push(...(data.results || data || []));
            hasNext = Boolean(data.next);
            page += 1;
          }
          return results;
        })(),
        affiliatesAPI.myKYC(),
        affiliatesAPI.myPayouts(),
        walletAPI.myWallet(),
      ]);
      setProfile(p.data);
      setWallet(walletResponse.data);
      setCommissions(c);
      setKyc(k.data?.status && k.data.status !== 'none' ? k.data : null);
      setPayouts(Array.isArray(w.data) ? w.data : []);
    } catch { setProfile(null); setWallet(null); setCommissions([]); setKyc(null); setPayouts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const kycVerified = kyc?.status === 'approved';
  const availablePayout = Number(wallet?.available_payout ?? profile?.available_commission ?? 0);
  const requestedAmount = Number(amount) || 0;
  const withdrawalFee = Math.round(requestedAmount * 5) / 100;
  const transferAmount = Math.max(requestedAmount - withdrawalFee, 0);

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

  const filteredCommissions = commissions.filter((commission) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [commission.product_name, commission.order_number]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const createdDate = String(commission.created_at || '').slice(0, 10);
    const matchesFrom = !dateFrom || createdDate >= dateFrom;
    const matchesTo = !dateTo || createdDate <= dateTo;
    return matchesSearch && matchesFrom && matchesTo
      && (statusFilter === 'all' || commission.status === statusFilter);
  });

  const pendingTotal = filteredCommissions.filter(c => c.status === 'pending' || c.status === 'approved')
    .reduce((s, c) => s + Number(c.amount), 0);
  const paidTotal = filteredCommissions.filter(c => c.status === 'paid')
    .reduce((s, c) => s + Number(c.amount), 0);

  const exportCommissions = () => {
    const rows = filteredCommissions.map((commission) => ({
      produto: commission.product_name || '—',
      encomenda: commission.order_number || '—',
      valor: Number(commission.amount || 0),
      data: String(commission.created_at || '').slice(0, 10),
      estado: STATUS_LABEL[commission.status] || commission.status,
    }));
    const extension = reportFormat === 'excel' ? 'xlsx' : reportFormat;
    downloadReportFromObjects(reportFormat, `comissoes-${new Date().toISOString().slice(0, 10)}.${extension}`, 'Relatório de comissões',
      ['produto', 'encomenda', 'valor', 'data', 'estado'], rows, {
        subtitle: 'Comissões atribuídas às vendas realizadas pelos seus links.',
        period: dateFrom || dateTo ? `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` : 'Todo o período disponível',
        filters: [
          { label: 'Estado', value: statusFilter === 'all' ? 'Todos' : STATUS_LABEL[statusFilter] || statusFilter },
          { label: 'Pesquisa', value: search || 'Sem pesquisa' },
        ],
        summary: [
          { label: 'Comissões', value: filteredCommissions.length },
          { label: 'Pendentes/aprovadas (MZN)', value: pendingTotal.toFixed(2) },
          { label: 'Pagas (MZN)', value: paidTotal.toFixed(2) },
          { label: 'Total filtrado (MZN)', value: filteredCommissions.reduce((sum, commission) => sum + Number(commission.amount || 0), 0).toFixed(2) },
        ],
        columns: ['Produto', 'N.º encomenda', 'Comissão (MZN)', 'Data', 'Estado'],
        notes: ['Os totais refletem as comissões recebidas da API e os filtros selecionados; o saldo disponível é um indicador atual e não está limitado ao período.'],
      });
  };

  const filteredPayouts = payouts.filter((payout) => {
    const query = payoutSearch.trim().toLowerCase();
    const matchesSearch = !query || String(payout.method || '').toLowerCase().includes(query);
    const date = String(payout.created_at || '').slice(0, 10);
    return matchesSearch && (!payoutDateFrom || date >= payoutDateFrom)
      && (!payoutDateTo || date <= payoutDateTo)
      && (payoutStatusFilter === 'all' || payout.status === payoutStatusFilter);
  });

  const exportPayouts = () => {
    const rows = filteredPayouts.map((payout) => ({
      valor: Number(payout.amount || 0),
      metodo: payout.method || '',
      data: String(payout.created_at || '').slice(0, 10),
      estado: STATUS_LABEL[payout.status] || payout.status,
    }));
    const extension = payoutFormat === 'excel' ? 'xlsx' : payoutFormat;
    downloadReportFromObjects(payoutFormat, `saques-afiliado-${new Date().toISOString().slice(0, 10)}.${extension}`,
      'Relatório de saques do afiliado', ['valor', 'metodo', 'data', 'estado'], rows, {
        subtitle: 'Pedidos de levantamento de comissões e respetivo estado.',
        period: payoutDateFrom || payoutDateTo ? `${payoutDateFrom || 'Início'} a ${payoutDateTo || 'Hoje'}` : 'Todo o período disponível',
        filters: [
          { label: 'Estado', value: payoutStatusFilter === 'all' ? 'Todos' : STATUS_LABEL[payoutStatusFilter] || payoutStatusFilter },
          { label: 'Método', value: payoutSearch || 'Todos' },
        ],
        summary: [
          { label: 'Saques', value: filteredPayouts.length },
          { label: 'Valor solicitado (MZN)', value: filteredPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0).toFixed(2) },
          { label: 'Pendentes', value: filteredPayouts.filter((payout) => payout.status === 'pending').length },
        ],
        columns: ['Valor (MZN)', 'Método', 'Data', 'Estado'],
        notes: ['Este relatório não inclui dados bancários ou de contacto do destinatário.'],
      });
  };

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

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Taxa de saque para afiliados: 5%</p>
          <p className="mt-1 text-amber-900/80">
            A taxa é descontada do valor solicitado. O pedido exige KYC aprovado e aprovação administrativa; a transferência é manual e não é executada automaticamente pelo gateway.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-accent">{availablePayout.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
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
            <span className="text-xs text-muted-foreground">No período/estado filtrado</span>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Recebido</p>
            <p className="text-2xl font-bold text-green-600">{paidTotal.toLocaleString('pt-MZ')} MZN</p>
            <span className="flex items-center gap-1 text-xs text-green-600"><ArrowUp size={12} />No período/estado filtrado</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border space-y-3">
            <h2 className="font-bold">Histórico de Comissões</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <label className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto ou encomenda"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">De
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">Até
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
              </label>
              <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="all">Todos os estados</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Formato do relatório" value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
              </select>
              <button type="button" onClick={exportCommissions} disabled={!filteredCommissions.length}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                <Download size={15} /> Exportar
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{filteredCommissions.length} de {commissions.length} comissões</p>
          </div>
          {loading ? (
            <div className="text-center py-12"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
          ) : filteredCommissions.length === 0 ? (
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pedido / líquido</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCommissions.map((c) => (
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

        {/* Meus Saques */}
        {payouts.length > 0 && (
          <div className="bg-card border border-border rounded-xl mt-6">
            <div className="space-y-3 border-b border-border p-4">
              <h2 className="font-bold">Meus Saques</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex-1">
                  <span className="sr-only">Buscar método de saque</span>
                  <input value={payoutSearch} onChange={(event) => setPayoutSearch(event.target.value)} placeholder="Buscar método"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">De
                  <input type="date" value={payoutDateFrom} max={payoutDateTo || undefined} onChange={(event) => setPayoutDateFrom(event.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">Até
                  <input type="date" value={payoutDateTo} min={payoutDateFrom || undefined} onChange={(event) => setPayoutDateTo(event.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
                </label>
                <select aria-label="Filtrar saques por estado" value={payoutStatusFilter} onChange={(event) => setPayoutStatusFilter(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="all">Todos os estados</option>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select aria-label="Formato do relatório de saques" value={payoutFormat} onChange={(event) => setPayoutFormat(event.target.value as ReportFormat)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
                </select>
                <button type="button" onClick={exportPayouts} disabled={!filteredPayouts.length}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                  <Download size={15} /> Exportar
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{filteredPayouts.length} de {payouts.length} saques</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Método</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayouts.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">
                        <span>{Number(p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          Taxa {Number(p.fee || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN · recebe {Number(p.net_amount ?? (p.amount - (p.fee || 0))).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN
                        </span>
                      </td>
                      <td className="py-3 px-4 uppercase text-xs">{p.method}</td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-MZ')}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABEL[p.status] || p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
            <p className="text-sm text-muted-foreground mb-4">Disponível: {availablePayout.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</p>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">Taxa de saque: 5%</p>
              <p className="mt-1">O valor solicitado será reservado. Após aprovação, o administrador fará a transferência manual do valor líquido.</p>
            </div>
            <form onSubmit={requestPayout} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">Valor (MZN)</label>
                <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-sm" required />
              </div>
              {requestedAmount > 0 && (
                <dl className="space-y-1 rounded-lg border border-border p-3 text-sm">
                  <div className="flex justify-between"><dt>Valor solicitado</dt><dd>{requestedAmount.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Taxa (5%)</dt><dd>−{withdrawalFee.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</dd></div>
                  <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Transferência manual</dt><dd>{transferAmount.toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</dd></div>
                </dl>
              )}
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
