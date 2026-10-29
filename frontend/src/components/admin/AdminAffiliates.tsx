'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, DollarSign, Wallet, Settings, RefreshCw, Loader2, CheckCircle, AlertCircle, Ban, ShieldCheck, Percent, FileText, Search, Download } from 'lucide-react';
import { affiliatesAPI, type AffiliateProfile } from '@/src/lib/api';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', paid: 'Pago', rejected: 'Rejeitado',
};
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
};

async function fetchAllPages<T>(fetchPage: (params: Record<string, any>) => Promise<{ data: T[] | { results?: T[]; next?: string | null } }>) {
  const results: T[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const { data } = await fetchPage({ page_size: 100, page });
    if (Array.isArray(data)) {
      results.push(...data);
      hasNext = false;
    } else {
      results.push(...(data.results || []));
      hasNext = Boolean(data.next);
      page += 1;
    }
  }
  return results;
}

export default function AdminAffiliates() {
  const [view, setView] = useState<'affiliates' | 'commissions' | 'payouts' | 'kyc' | 'settings'>('affiliates');
  const [affiliates, setAffiliates] = useState<AffiliateProfile[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [kycList, setKycList] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, p, k, s] = await Promise.all([
        fetchAllPages<AffiliateProfile>(affiliatesAPI.adminList),
        fetchAllPages<any>(affiliatesAPI.adminCommissions),
        fetchAllPages<any>(affiliatesAPI.adminPayouts),
        fetchAllPages<any>(affiliatesAPI.adminKYC),
        affiliatesAPI.adminSettings(),
      ]);
      setAffiliates(a);
      setCommissions(c);
      setPayouts(p);
      setKycList(k);
      setSettings(s.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await affiliatesAPI.adminUpdateStatus(id, status);
      showToast('success', `Afiliado ${status === 'active' ? 'activado' : status === 'suspended' ? 'suspenso' : 'actualizado'}.`);
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const commissionAction = async (id: string, action: string) => {
    try {
      await affiliatesAPI.adminCommissionAction(id, { action });
      showToast('success', action === 'approve' ? 'Comissão aprovada.' : 'Comissão rejeitada.');
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const payoutAction = async (id: string, action: string) => {
    const reference = action === 'pay'
      ? prompt('Introduza a referência da transferência manual já realizada:')
      : undefined;
    if (action === 'pay' && !reference?.trim()) return;
    try {
      await affiliatesAPI.adminPayoutAction(id, { action, reference: reference?.trim() });
      showToast('success', action === 'approve'
        ? 'Saque aprovado; falta registar a transferência manual.'
        : action === 'pay' ? 'Transferência manual registada.' : 'Saque rejeitado.');
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const kycAction = async (id: string, action: string) => {
    try {
      await affiliatesAPI.adminKYCAction(id, { action });
      showToast('success', action === 'approve' ? 'Verificação aprovada.' : 'Verificação rejeitada.');
      load();
    } catch { showToast('error', 'Erro ao actualizar.'); }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await affiliatesAPI.adminUpdateSettings(settings);
      showToast('success', 'Configurações guardadas.');
    } catch { showToast('error', 'Erro ao guardar.'); }
    finally { setSaving(false); }
  };

  const matchesSearch = (values: unknown[], query: string) => !query || values
    .some((value) => String(value || '').toLowerCase().includes(query));
  const inDateRange = (value: string | undefined) => {
    const date = String(value || '').slice(0, 10);
    return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  };
  const query = search.trim().toLowerCase();
  const filteredAffiliates = affiliates.filter((affiliate) =>
    matchesSearch([affiliate.user_name, affiliate.user_email, affiliate.referral_code], query)
      && (statusFilter === 'all' || affiliate.status === statusFilter));
  const filteredCommissions = commissions.filter((commission) =>
    matchesSearch([commission.affiliate_email, commission.order_number, commission.product_name], query)
      && inDateRange(commission.created_at)
      && (statusFilter === 'all' || commission.status === statusFilter));
  const filteredPayouts = payouts.filter((payout) =>
    matchesSearch([payout.affiliate_email, payout.method], query)
      && inDateRange(payout.created_at)
      && (statusFilter === 'all' || payout.status === statusFilter));

  const exportCurrentReport = () => {
    let title = 'Relatório de afiliados';
    let headers: string[];
    let rows: Array<Record<string, string | number>>;
    if (view === 'affiliates') {
      headers = ['afiliado', 'email', 'codigo', 'nivel', 'cliques', 'vendas', 'comissao', 'estado'];
      rows = filteredAffiliates.map((affiliate) => ({
        afiliado: affiliate.user_name || affiliate.user_email,
        email: affiliate.user_email,
        codigo: affiliate.referral_code,
        nivel: affiliate.commission_tier,
        cliques: affiliate.total_clicks,
        vendas: affiliate.total_sales,
        comissao: Number(affiliate.total_commission),
        estado: affiliate.status,
      }));
    } else if (view === 'commissions') {
      title = 'Relatório de comissões de afiliados';
      headers = ['encomenda', 'afiliado', 'produto', 'valor', 'valor_revertido', 'taxa_percentual', 'estado', 'data'];
      rows = filteredCommissions.map((commission) => ({
        encomenda: commission.order_number || '',
        afiliado: commission.affiliate_email || '',
        produto: commission.product_name || '',
        valor: Number(commission.amount || 0),
        valor_revertido: Number(commission.reversed_amount || 0),
        taxa_percentual: Number(commission.commission_rate || 0),
        estado: STATUS_LABEL[commission.status] || commission.status,
        data: String(commission.created_at || '').slice(0, 10),
      }));
    } else {
      title = 'Relatório de saques de afiliados';
      headers = ['afiliado', 'valor', 'taxa', 'valor_liquido', 'metodo', 'estado', 'data'];
      rows = filteredPayouts.map((payout) => ({
        afiliado: payout.affiliate_email || '',
        valor: Number(payout.amount || 0),
        taxa: Number(payout.fee || 0),
        valor_liquido: Number(payout.net_amount || 0),
        metodo: payout.method || '',
        estado: STATUS_LABEL[payout.status] || payout.status,
        data: String(payout.created_at || '').slice(0, 10),
      }));
    }
    const extension = reportFormat === 'excel' ? 'xlsx' : reportFormat;
    const datePeriod = dateFrom || dateTo ? `${dateFrom || 'Início'} a ${dateTo || 'Hoje'}` : 'Todo o período disponível';
    const selectedStatus = statusFilter === 'all'
      ? 'Todos'
      : view === 'affiliates'
        ? statusFilter === 'active' ? 'Ativos' : statusFilter === 'suspended' ? 'Suspensos' : 'Pendentes'
        : STATUS_LABEL[statusFilter] || statusFilter;
    const contextFilters = [
      { label: 'Estado', value: selectedStatus },
      { label: 'Pesquisa', value: search || 'Sem pesquisa' },
    ];
    const reportPeriod = view === 'affiliates' ? undefined : datePeriod;
    const summary = view === 'affiliates'
      ? [
          { label: 'Afiliados', value: filteredAffiliates.length },
          { label: 'Cliques', value: filteredAffiliates.reduce((sum, affiliate) => sum + affiliate.total_clicks, 0) },
          { label: 'Vendas', value: filteredAffiliates.reduce((sum, affiliate) => sum + affiliate.total_sales, 0) },
          { label: 'Comissões (MZN)', value: filteredAffiliates.reduce((sum, affiliate) => sum + Number(affiliate.total_commission), 0).toFixed(2) },
        ]
      : view === 'commissions'
        ? [
            { label: 'Comissões', value: filteredCommissions.length },
            { label: 'Valor (MZN)', value: filteredCommissions.reduce((sum, commission) => sum + Number(commission.amount || 0), 0).toFixed(2) },
            { label: 'Revertido (MZN)', value: filteredCommissions.reduce((sum, commission) => sum + Number(commission.reversed_amount || 0), 0).toFixed(2) },
          ]
        : [
            { label: 'Saques', value: filteredPayouts.length },
            { label: 'Solicitado (MZN)', value: filteredPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0).toFixed(2) },
            { label: 'Taxas (MZN)', value: filteredPayouts.reduce((sum, payout) => sum + Number(payout.fee || 0), 0).toFixed(2) },
          ];
    const columns = view === 'affiliates'
      ? ['Afiliado', 'Email', 'Código de referência', 'Nível', 'Cliques', 'Vendas', 'Comissão (MZN)', 'Estado']
      : view === 'commissions'
        ? ['N.º encomenda', 'Afiliado', 'Produto', 'Valor (MZN)', 'Revertido (MZN)', 'Taxa (%)', 'Estado', 'Data']
        : ['Afiliado', 'Valor (MZN)', 'Taxa (MZN)', 'Valor líquido (MZN)', 'Método', 'Estado', 'Data'];
    downloadReportFromObjects(reportFormat, `admin-${view}-${new Date().toISOString().slice(0, 10)}.${extension}`,
      title, headers, rows, {
        subtitle: view === 'affiliates'
          ? 'Desempenho acumulado dos afiliados registados na plataforma.'
          : view === 'commissions'
            ? 'Comissões atribuídas, estados e reversões no período selecionado.'
            : 'Pedidos de saque, taxas e valores líquidos no período selecionado.',
        period: reportPeriod,
        filters: contextFilters,
        summary,
        columns,
        notes: ['Dados bancários, telefones, NUIT e documentos KYC não são incluídos neste relatório.'],
      });
  };

  const activeRows = view === 'affiliates' ? filteredAffiliates
    : view === 'commissions' ? filteredCommissions : filteredPayouts;

  return (
    <div className="w-full min-w-0">
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Gestão de Afiliados</h2>
          <p className="text-sm text-muted-foreground">{affiliates.length} afiliados · {payouts.filter(p => p.status === 'pending').length} saques pendentes</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-muted rounded-lg"><RefreshCw size={16} /></button>
      </div>

      {/* Sub-tabs */}
      <div className="mb-4 flex w-full gap-1 overflow-x-auto rounded-lg border border-border bg-white p-1 sm:w-fit">
        {([
          { id: 'affiliates', label: 'Afiliados', icon: Users },
          { id: 'commissions', label: 'Comissões', icon: DollarSign },
          { id: 'payouts', label: 'Saques', icon: Wallet },
          { id: 'kyc', label: 'Verificações', icon: FileText },
          { id: 'settings', label: 'Configurações', icon: Settings },
        ] as const).map(t => (
          <button key={t.id} onClick={() => { setView(t.id); setStatusFilter('all'); }}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${view === t.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {view !== 'kyc' && view !== 'settings' && (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-white p-3 sm:grid-cols-2 sm:p-4 lg:flex lg:items-end">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar afiliado, encomenda ou produto"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
          </label>
          {view !== 'affiliates' && <>
            <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">De
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
            </label>
            <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">Até
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
            </label>
          </>}
          <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm lg:w-auto">
            <option value="all">Todos os estados</option>
            {(view === 'affiliates' ? ['active', 'pending', 'suspended'] : ['pending', 'approved', 'paid', 'rejected'])
              .map((status) => <option key={status} value={status}>
                {status === 'active' ? 'Activo' : status === 'suspended' ? 'Suspenso' : STATUS_LABEL[status] || status}
              </option>)}
          </select>
          <select aria-label="Formato do relatório" value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
            className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm lg:w-auto">
            <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
          </select>
          <button type="button" onClick={exportCurrentReport} disabled={!activeRows.length || Boolean(dateFrom) !== Boolean(dateTo)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 lg:w-auto">
            <Download size={15} /> Exportar
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 size={28} className="animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <>
          {view === 'affiliates' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Tier</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Cliques</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Vendas</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Comissão</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredAffiliates.map(a => (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <p className="text-xs font-medium">{a.user_name || a.user_email}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{a.referral_code}</p>
                        </td>
                        <td className="py-2.5 px-3"><span className="capitalize text-xs">{a.commission_tier}</span></td>
                        <td className="py-2.5 px-3 text-xs">{a.total_clicks}</td>
                        <td className="py-2.5 px-3 text-xs">{a.total_sales}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{Number(a.total_commission).toLocaleString('pt-MZ')} MZN</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {a.status === 'active' ? 'Activo' : a.status === 'suspended' ? 'Suspenso' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {a.status === 'active' ? (
                            <button onClick={() => updateStatus(a.id, 'suspended')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200"><Ban size={12} className="inline mr-1" />Suspender</button>
                          ) : (
                            <button onClick={() => updateStatus(a.id, 'active')} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200"><ShieldCheck size={12} className="inline mr-1" />Activar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {filteredAffiliates.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Nenhum afiliado encontrado.</p>
                ) : filteredAffiliates.map((a) => (
                  <article key={a.id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">{a.user_name || a.user_email}</p>
                        <p className="break-all font-mono text-xs text-muted-foreground">{a.referral_code}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.status === 'active' ? 'bg-green-100 text-green-700' : a.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {a.status === 'active' ? 'Activo' : a.status === 'suspended' ? 'Suspenso' : 'Pendente'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/20 p-3 text-xs">
                      <div><p className="text-muted-foreground">Nível</p><p className="mt-1 font-medium capitalize">{a.commission_tier}</p></div>
                      <div><p className="text-muted-foreground">Cliques</p><p className="mt-1 font-medium">{a.total_clicks}</p></div>
                      <div><p className="text-muted-foreground">Vendas</p><p className="mt-1 font-medium">{a.total_sales}</p></div>
                      <div><p className="text-muted-foreground">Comissão</p><p className="mt-1 font-semibold">{Number(a.total_commission).toLocaleString('pt-MZ')} MZN</p></div>
                    </div>
                    <button onClick={() => updateStatus(a.id, a.status === 'active' ? 'suspended' : 'active')}
                      className={`min-h-10 w-full rounded-lg px-3 py-2 text-sm font-semibold ${a.status === 'active' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {a.status === 'active' ? <><Ban size={14} className="mr-1 inline" />Suspender</> : <><ShieldCheck size={14} className="mr-1 inline" />Activar</>}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {view === 'commissions' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Encomenda</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Bruto / taxa / líquido</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Taxa</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredCommissions.map(c => (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono text-xs">{c.order_number}</td>
                        <td className="py-2.5 px-3 text-xs">{c.affiliate_email || '—'}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{Number(c.amount).toLocaleString('pt-MZ')} MZN</td>
                        <td className="py-2.5 px-3 text-xs">{Number(c.commission_rate)}%</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[c.status] || c.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {c.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => commissionAction(c.id, 'approve')} className="px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200">Aprovar</button>
                              <button onClick={() => commissionAction(c.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {filteredCommissions.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma comissão encontrada.</p>
                ) : filteredCommissions.map((c) => (
                  <article key={c.id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold">{c.order_number || 'Encomenda sem referência'}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{c.affiliate_email || '—'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[c.status] || c.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/20 p-3 text-xs">
                      <div><p className="text-muted-foreground">Comissão</p><p className="mt-1 font-semibold">{Number(c.amount).toLocaleString('pt-MZ')} MZN</p></div>
                      <div><p className="text-muted-foreground">Taxa</p><p className="mt-1 font-medium">{Number(c.commission_rate)}%</p></div>
                    </div>
                    {c.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => commissionAction(c.id, 'approve')} className="min-h-10 rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-200">Aprovar</button>
                        <button onClick={() => commissionAction(c.id, 'reject')} className="min-h-10 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200">Rejeitar</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {view === 'payouts' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Valor</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Método</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {filteredPayouts.map(p => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-xs">{p.affiliate_email}</td>
                        <td className="py-2.5 px-3 text-xs">
                          <span className="font-semibold">{Number(p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN bruto</span>
                          <span className="block text-muted-foreground">−{Number(p.fee || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} taxa · {Number(p.net_amount || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN a transferir</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs uppercase">{p.method}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[p.status] || p.status}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {p.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => payoutAction(p.id, 'approve')} className="px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200">Aprovar</button>
                              <button onClick={() => payoutAction(p.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                          {p.status === 'approved' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => payoutAction(p.id, 'pay')} className="px-2 py-1 rounded text-[11px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200">Registar transferência</button>
                              <button onClick={() => payoutAction(p.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                          {p.admin_reference && <span className="text-[10px] text-muted-foreground">Ref: {p.admin_reference}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {filteredPayouts.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Nenhum saque encontrado.</p>
                ) : filteredPayouts.map((p) => (
                  <article key={p.id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="min-w-0 break-all text-xs font-medium">{p.affiliate_email || 'Afiliado sem email'}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABEL[p.status] || p.status}</span>
                    </div>
                    <div className="space-y-2 rounded-lg bg-muted/20 p-3 text-xs">
                      <div className="flex justify-between gap-2"><span className="text-muted-foreground">Valor bruto</span><span className="text-right font-semibold">{Number(p.amount).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span></div>
                      <div className="flex justify-between gap-2"><span className="text-muted-foreground">Taxa</span><span className="text-right">{Number(p.fee || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span></div>
                      <div className="flex justify-between gap-2"><span className="text-muted-foreground">A transferir</span><span className="text-right font-semibold">{Number(p.net_amount || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span></div>
                      <div className="flex justify-between gap-2"><span className="text-muted-foreground">Método</span><span className="text-right uppercase">{p.method}</span></div>
                    </div>
                    {(p.status === 'pending' || p.status === 'approved') && (
                      <div className="grid grid-cols-2 gap-2">
                        {p.status === 'pending' ? (
                          <button onClick={() => payoutAction(p.id, 'approve')} className="min-h-10 rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-200">Aprovar</button>
                        ) : (
                          <button onClick={() => payoutAction(p.id, 'pay')} className="min-h-10 rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-200">Registar transferência</button>
                        )}
                        <button onClick={() => payoutAction(p.id, 'reject')} className="min-h-10 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200">Rejeitar</button>
                      </div>
                    )}
                    {p.admin_reference && <p className="break-all text-xs text-muted-foreground">Referência: {p.admin_reference}</p>}
                  </article>
                ))}
              </div>
            </div>
          )}

          {view === 'kyc' && (
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b-2 border-border bg-muted/20">
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Afiliado</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Documento</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">NUIT</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Telefone</th>
                    <th className="text-left py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase">Estado</th>
                    <th className="text-right py-3 px-3 font-semibold text-muted-foreground text-[11px] uppercase w-28">Acção</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {kycList.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma verificação pendente.</td></tr>
                    ) : kycList.map(k => (
                      <tr key={k.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-xs">{k.affiliate_email}</td>
                        <td className="py-2.5 px-3 text-xs">{k.document_number}</td>
                        <td className="py-2.5 px-3 text-xs">{k.nuit || '—'}</td>
                        <td className="py-2.5 px-3 text-xs">{k.payout_phone}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${k.status === 'approved' ? 'bg-green-100 text-green-700' : k.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {k.status === 'approved' ? 'Aprovado' : k.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {k.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => kycAction(k.id, 'approve')} className="px-2 py-1 rounded text-[11px] font-semibold bg-green-100 text-green-700 hover:bg-green-200">Aprovar</button>
                              <button onClick={() => kycAction(k.id, 'reject')} className="px-2 py-1 rounded text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200">Rejeitar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border lg:hidden">
                {kycList.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma verificação pendente.</p>
                ) : kycList.map((k) => (
                  <article key={k.id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="min-w-0 break-all text-xs font-medium">{k.affiliate_email}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${k.status === 'approved' ? 'bg-green-100 text-green-700' : k.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {k.status === 'approved' ? 'Aprovado' : k.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/20 p-3 text-xs">
                      <div><dt className="text-muted-foreground">Documento</dt><dd className="mt-1 break-words font-medium">{k.document_number}</dd></div>
                      <div><dt className="text-muted-foreground">NUIT</dt><dd className="mt-1 break-words font-medium">{k.nuit || '—'}</dd></div>
                      <div className="col-span-2"><dt className="text-muted-foreground">Telefone</dt><dd className="mt-1 break-words font-medium">{k.payout_phone}</dd></div>
                    </dl>
                    {k.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => kycAction(k.id, 'approve')} className="min-h-10 rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-200">Aprovar</button>
                        <button onClick={() => kycAction(k.id, 'reject')} className="min-h-10 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-200">Rejeitar</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {view === 'settings' && settings && (
            <form onSubmit={saveSettings} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-white p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-2"><Percent size={16} className="text-accent" /><h3 className="font-bold">Configurações do Programa</h3></div>
              <div>
                <label className="block text-xs font-semibold mb-1">Janela de atribuição (dias)</label>
                <input type="number" min="1" value={settings.cookie_window_days} onChange={e => setSettings({ ...settings, cookie_window_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Taxa de comissão padrão (%)</label>
                <input type="number" step="0.01" min="0" value={settings.default_commission_rate} onChange={e => setSettings({ ...settings, default_commission_rate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={settings.affiliate_program_active !== false} onChange={e => setSettings({ ...settings, affiliate_program_active: e.target.checked })}
                  className="accent-accent rounded w-4 h-4" />
                <span className="font-medium">Programa de afiliados activo</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Comissão mínima (%)</label>
                  <input type="number" step="0.01" min="0" value={settings.min_commission_rate} onChange={e => setSettings({ ...settings, min_commission_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Comissão máxima (%)</label>
                  <input type="number" step="0.01" min="0" value={settings.max_commission_rate} onChange={e => setSettings({ ...settings, max_commission_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Valor mínimo de saque (MZN)</label>
                <input type="number" step="0.01" min="0" value={settings.min_payout_amount} onChange={e => setSettings({ ...settings, min_payout_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Aprovar comissão após (dias)</label>
                <input type="number" min="0" value={settings.approve_after_days} onChange={e => setSettings({ ...settings, approve_after_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Janela de reversão (clawback, dias)</label>
                <input type="number" min="0" value={settings.clawback_days} onChange={e => setSettings({ ...settings, clawback_days: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                A taxa de saque de afiliados é fixa em 5% e é apresentada ao afiliado antes da confirmação.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1">Termos de serviço globais</label>
                <textarea rows={4} value={settings.terms_of_service || ''} onChange={e => setSettings({ ...settings, terms_of_service: e.target.value })}
                  placeholder="Termos exibidos na Área de Afiliação..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Guardar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
