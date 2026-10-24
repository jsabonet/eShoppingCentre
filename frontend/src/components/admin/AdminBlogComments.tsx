'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, LoaderCircle, MessageSquare, Search, Trash2, X } from 'lucide-react';
import { adminAPI, type BlogCommentAdmin } from '@/src/lib/api';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type BulkAction = 'approve' | 'reject' | 'delete';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function StatusBadge({ status }: { status: BlogCommentAdmin['status'] }) {
  const styles = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
  } as const;
  const labels = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

export default function AdminBlogComments() {
  const [comments, setComments] = useState<BlogCommentAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = { search: search.trim() || undefined };
      const [pageResponse, pendingResponse, approvedResponse, rejectedResponse] = await Promise.all([
        adminAPI.listBlogComments({
          ...filters,
          page,
          page_size: pageSize,
          status: status === 'all' ? undefined : status,
        }),
        adminAPI.listBlogComments({ ...filters, page: 1, page_size: 1, status: 'pending' }),
        adminAPI.listBlogComments({ ...filters, page: 1, page_size: 1, status: 'approved' }),
        adminAPI.listBlogComments({ ...filters, page: 1, page_size: 1, status: 'rejected' }),
      ]);
      const { data } = pageResponse;
      setComments(data.results);
      setTotal(data.count);
      setCounts({
        pending: pendingResponse.data.count,
        approved: approvedResponse.data.count,
        rejected: rejectedResponse.data.count,
      });
      setSelected(new Set());
    } catch (loadError) {
      console.error('Não foi possível carregar os comentários.', loadError);
      setError('Não foi possível carregar os comentários. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateStatus = async (id: string, nextStatus: BlogCommentAdmin['status']) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminAPI.updateBlogComment(id, { status: nextStatus });
      setComments((current) => current.map((comment) => (comment.id === id ? { ...comment, status: nextStatus } : comment)));
      setNotice('Comentário atualizado.');
    } catch (updateError) {
      console.error('Não foi possível atualizar o comentário.', updateError);
      setError('Não foi possível atualizar o comentário.');
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (id: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminAPI.deleteBlogComment(id);
      setComments((current) => current.filter((comment) => comment.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      setDeletingId(null);
      setNotice('Comentário eliminado.');
    } catch (deleteError) {
      console.error('Não foi possível eliminar o comentário.', deleteError);
      setError('Não foi possível eliminar o comentário.');
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminAPI.bulkBlogComments(bulkAction, [...selected]);
      setBulkAction(null);
      await load();
      setNotice('Ação em lote concluída.');
    } catch (bulkError) {
      console.error('Não foi possível aplicar a ação em lote.', bulkError);
      setError('Não foi possível aplicar a ação em lote.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Moderação de comentários</h2>
          <p className="mt-1 text-sm text-slate-500">Aprove, rejeite ou elimine comentários dos artigos.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricBadge label="Pendentes" value={counts.pending} tone="amber" />
        <MetricBadge label="Aprovados" value={counts.approved} tone="green" />
        <MetricBadge label="Rejeitados" value={counts.rejected} tone="red" />
      </div>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-slate-500" />
            <h3 className="font-semibold text-slate-900">Comentários</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{total}</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Pesquisar comentários</span>
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar por autor, comentário ou artigo" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
            <select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); }} className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
              <option value="all">Todos os estados</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovados</option>
              <option value="rejected">Rejeitados</option>
            </select>
          </div>

          {selected.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span className="font-semibold">{selected.size} selecionado(s)</span>
              <button type="button" disabled={busy} onClick={() => { setBulkAction('approve'); }} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Aprovar</button>
              <button type="button" disabled={busy} onClick={() => { setBulkAction('reject'); }} className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">Rejeitar</button>
              <button type="button" disabled={busy} onClick={() => { setBulkAction('delete'); }} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">Eliminar</button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-semibold underline">Limpar seleção</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-indigo-600" /> A carregar comentários…
          </div>
        ) : comments.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-500"><MessageSquare size={24} /></div>
            <h3 className="font-semibold text-slate-900">Nenhum comentário encontrado</h3>
            <p className="mt-1 text-sm text-slate-500">Os comentários dos leitores aparecerão aqui para moderação.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {comments.map((comment) => (
              <li key={comment.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(comment.id)} onChange={() => toggleSelect(comment.id)} aria-label={`Selecionar comentário de ${comment.author_name}`} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{comment.author_name}</span>
                      <StatusBadge status={comment.status} />
                      <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{comment.content}</p>
                    <Link href={`/blog/${comment.post_slug}`} target="_blank" rel="noreferrer" className="mt-1 inline-block truncate text-xs text-indigo-600 hover:underline">{comment.post_title}</Link>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {comment.status !== 'approved' && (
                      <button type="button" disabled={busy} onClick={() => updateStatus(comment.id, 'approved')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" aria-label="Aprovar" title="Aprovar"><Check size={15} /></button>
                    )}
                    {comment.status !== 'rejected' && (
                      <button type="button" disabled={busy} onClick={() => updateStatus(comment.id, 'rejected')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-50" aria-label="Rejeitar" title="Rejeitar"><X size={15} /></button>
                    )}
                    <button type="button" disabled={busy} onClick={() => setDeletingId(comment.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label="Eliminar" title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
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
        <ConfirmDialog
          title="Eliminar comentário?"
          message="Este comentário será eliminado permanentemente. Esta ação não pode ser desfeita."
          busy={busy}
          onCancel={() => setDeletingId(null)}
          onConfirm={() => removeComment(deletingId)}
        />
      )}

      {bulkAction && (
        <ConfirmDialog
          title={`${bulkAction === 'approve' ? 'Aprovar' : bulkAction === 'reject' ? 'Rejeitar' : 'Eliminar'} ${selected.size} comentário(s)?`}
          message="A ação será aplicada a todos os comentários selecionados."
          busy={busy}
          onCancel={() => setBulkAction(null)}
          onConfirm={() => runBulk()}
        />
      )}
    </section>
  );
}

function MetricBadge({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'green' | 'red' }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  } as const;
  return (
    <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[tone]}`}><MessageSquare size={18} /></div>
      <div><p className="text-sm text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p></div>
    </article>
  );
}

function ConfirmDialog({ title, message, busy, onCancel, onConfirm }: { title: string; message: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <h2 id="confirm-title" className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Confirmar
          </button>
        </div>
      </section>
    </div>
  );
}
