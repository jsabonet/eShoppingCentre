'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Mail, Search, Trash2, X } from 'lucide-react';
import { adminAPI, type NewsletterSubscription } from '@/src/lib/api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'medium' }).format(new Date(value));
}

export default function AdminNewsletterSubscribers() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await adminAPI.listNewsletterSubscribers({ page, page_size: pageSize, search: search.trim() || undefined });
      setSubscribers(data.results);
      setTotal(data.count);
    } catch (loadError) {
      console.error('Não foi possível carregar os subscritores.', loadError);
      setError('Não foi possível carregar os subscritores. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const removeSubscriber = async (id: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminAPI.deleteNewsletterSubscriber(id);
      setSubscribers((current) => current.filter((subscriber) => subscriber.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      setDeletingId(null);
      setNotice('Subscritor eliminado.');
    } catch (deleteError) {
      console.error('Não foi possível eliminar o subscritor.', deleteError);
      setError('Não foi possível eliminar o subscritor.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Subscritores da newsletter</h2>
        <p className="mt-1 text-sm text-slate-500">Gestão dos emails inscritos na newsletter.</p>
      </header>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Mail size={18} className="text-slate-500" />
            <h3 className="font-semibold text-slate-900">Emails inscritos</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{total}</span>
          </div>
          <label className="relative block max-w-md">
            <span className="sr-only">Pesquisar subscritores</span>
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar por email" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </label>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-indigo-600" /> A carregar subscritores…
          </div>
        ) : subscribers.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-500"><Mail size={24} /></div>
            <h3 className="font-semibold text-slate-900">Nenhum subscritor encontrado</h3>
            <p className="mt-1 text-sm text-slate-500">Os emails inscritos na newsletter aparecerão aqui.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {subscribers.map((subscriber) => (
              <li key={subscriber.id} className="flex items-center gap-3 p-4 sm:p-5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Mail size={18} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{subscriber.email}</p>
                  <p className="text-xs text-slate-500">
                    {subscriber.is_active ? 'Ativo' : 'Inativo'} · {subscriber.source || 'blog'} · {formatDate(subscriber.created_at)}
                  </p>
                </div>
                <button type="button" disabled={busy} onClick={() => setDeletingId(subscriber.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label={`Eliminar ${subscriber.email}`} title="Eliminar subscritor"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 && (
          <footer className="flex items-center justify-between border-t border-slate-100 p-4">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior" className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
            <span className="px-2 text-sm text-slate-600">Página {page} de {pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página seguinte" className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button>
          </footer>
        )}
      </div>

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDeletingId(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-newsletter-title" className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-newsletter-title" className="text-lg font-bold text-slate-900">Eliminar subscritor?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">O email será removido da lista de subscritores.</p>
              </div>
              <button type="button" onClick={() => setDeletingId(null)} disabled={busy} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeletingId(null)} disabled={busy} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={() => removeSubscriber(deletingId)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Eliminar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
