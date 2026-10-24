'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { adminAPI } from '@/src/lib/api';

interface AuditEvent {
  id: string;
  created_at: string;
  actor_email: string;
  action: 'read' | 'create' | 'update' | 'delete' | 'action';
  method: string;
  path: string;
  status_code: number;
  outcome: 'success' | 'failure';
  ip_address: string | null;
  user_agent: string;
  duration_ms: number;
}

interface AuditResponse {
  count: number;
  results: AuditEvent[];
}

const actionLabels: Record<AuditEvent['action'], string> = {
  read: 'Consulta',
  create: 'Criação',
  update: 'Actualização',
  delete: 'Eliminação',
  action: 'Acção',
};

export default function AdminAuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    outcome: '',
    method: '',
    date_from: '',
    date_to: '',
  });
  const pageSize = 25;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(
        Object.entries({ ...filters, page, page_size: pageSize }).filter(([, value]) => value !== ''),
      ) as Record<string, string | number>;
      const { data } = await adminAPI.auditEvents(params);
      const response = data as AuditResponse;
      setEvents(response.results || []);
      setCount(response.count || 0);
    } catch {
      setError('Não foi possível carregar os registos de auditoria.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" size={25} />
            Monitoria e auditoria
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Actividade administrativa, incluindo consultas e tentativas recusadas. Os corpos dos pedidos não são guardados.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <input
          aria-label="Pesquisar administrador ou rota"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
          placeholder="Administrador ou rota"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm xl:col-span-2"
        />
        <select
          aria-label="Filtrar por tipo de acção"
          value={filters.action}
          onChange={(event) => updateFilter('action', event.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Todas as acções</option>
          {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select
          aria-label="Filtrar por resultado"
          value={filters.outcome}
          onChange={(event) => updateFilter('outcome', event.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Todos os resultados</option>
          <option value="success">Sucesso</option>
          <option value="failure">Falha</option>
        </select>
        <select
          aria-label="Filtrar por método"
          value={filters.method}
          onChange={(event) => updateFilter('method', event.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Todos os métodos</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}
        </select>
        <div className="flex gap-2 md:col-span-2 xl:col-span-6">
          <label className="flex flex-1 items-center gap-2 text-xs text-slate-500">
            De
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) => updateFilter('date_from', event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-1 items-center gap-2 text-xs text-slate-500">
            Até
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) => updateFilter('date_to', event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-700"
            />
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data/hora</th>
                <th className="px-4 py-3">Administrador</th>
                <th className="px-4 py-3">Acção</th>
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3 text-right">Duração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">A carregar registos…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Nenhum registo encontrado.</td></tr>
              ) : events.map((event) => (
                <tr key={event.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(event.created_at).toLocaleString('pt-MZ')}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{event.actor_email || 'Não autenticado'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-slate-700">{actionLabels[event.action]}</span>
                    <span className="ml-1.5 text-xs text-slate-500">{event.method}</span>
                  </td>
                  <td className="max-w-[360px] break-all px-4 py-3 font-mono text-xs text-slate-600">{event.path}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      event.outcome === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {event.status_code} · {event.outcome === 'success' ? 'Sucesso' : 'Falha'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{event.ip_address || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{event.duration_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
          <span>{count} registo(s) · Página {page} de {pageCount}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Página seguinte"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
