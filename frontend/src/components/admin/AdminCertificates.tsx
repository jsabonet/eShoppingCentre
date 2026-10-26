'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileCheck2, Loader2, Search, ShieldAlert } from 'lucide-react';
import {
  adminAPI,
  type CourseCertificateAdmin,
} from '@/src/lib/api';

type CertificateFilter = 'all' | 'valid' | 'revoked';

export default function AdminCertificates() {
  const [certificates, setCertificates] = useState<CourseCertificateAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CertificateFilter>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [selected, setSelected] = useState<CourseCertificateAdmin | null>(null);
  const [form, setForm] = useState({
    recipient_name: '',
    course_title: '',
    status: 'valid' as 'valid' | 'revoked',
    reason: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCertificates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { page_size: '25', page: String(page) };
      if (search.trim()) params.search = search.trim();
      if (filter !== 'all') params.status = filter;
      const { data } = await adminAPI.listCourseCertificates(params);
      setCertificates(data.results || []);
      setTotalCount(data.count);
      setHasNext(Boolean(data.next));
      setHasPrevious(Boolean(data.previous));
    } catch {
      setError('Não foi possível carregar os certificados.');
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void loadCertificates();
  }, [loadCertificates]);

  const openEdit = (certificate: CourseCertificateAdmin) => {
    setSelected(certificate);
    setForm({
      recipient_name: certificate.recipient_name,
      course_title: certificate.course_title,
      status: certificate.status,
      reason: '',
    });
    setError('');
  };

  const saveChanges = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await adminAPI.updateCourseCertificate(selected.id, form);
      setSelected(null);
      await loadCertificates();
    } catch (saveError: unknown) {
      const message =
        typeof saveError === 'object' && saveError !== null && 'response' in saveError
          ? (saveError as { response?: { data?: { reason?: string[]; detail?: string } } })
              .response?.data?.reason?.[0] ||
            (saveError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(message || 'Não foi possível guardar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Certificados de cursos</h2>
        <p className="text-sm text-muted-foreground">
          Pesquisa, corrige dados, revoga ou revalida certificados. Todas as alterações ficam registadas.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Código, aluno, curso ou email"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={filter}
          onChange={(event) => {
            setPage(1);
            setFilter(event.target.value as CertificateFilter);
          }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          aria-label="Filtrar certificados por estado"
        >
          <option value="all">Todos os estados</option>
          <option value="valid">Válidos</option>
          <option value="revoked">Revogados</option>
        </select>
      </div>

      {error && !selected && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : certificates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhum certificado encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Aluno / email</th>
                <th className="p-3">Curso</th>
                <th className="p-3">Código</th>
                <th className="p-3">Emissão</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td className="p-3">
                    <div className="font-medium">{certificate.recipient_name}</div>
                    <div className="text-xs text-muted-foreground">{certificate.student_email}</div>
                  </td>
                  <td className="p-3">{certificate.course_title}</td>
                  <td className="p-3 font-mono text-xs">{certificate.certificate_number}</td>
                  <td className="p-3">{new Date(certificate.issued_at).toLocaleDateString('pt-MZ')}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      certificate.status === 'valid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {certificate.status === 'valid' ? 'Válido' : 'Revogado'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openEdit(certificate)}
                      className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
                    >
                      Gerir / histórico
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalCount} certificado(s) · página {page}</span>
          <div className="flex gap-2">
            <button type="button" disabled={!hasPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50">
              Anterior
            </button>
            <button type="button" disabled={!hasNext}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50">
              Seguinte
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveChanges} className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Gerir certificado</h3>
                <p className="font-mono text-xs text-muted-foreground">{selected.certificate_number}</p>
              </div>
              <FileCheck2 className="text-accent" />
            </header>
            {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <label className="block space-y-1 text-sm">
              <span>Nome no certificado</span>
              <input required maxLength={255} value={form.recipient_name}
                onChange={(event) => setForm({ ...form, recipient_name: event.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Título do curso</span>
              <input required maxLength={500} value={form.course_title}
                onChange={(event) => setForm({ ...form, course_title: event.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Estado</span>
              <select value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as 'valid' | 'revoked' })}
                className="w-full rounded-md border border-border bg-background px-3 py-2">
                <option value="valid">Válido / revalidar</option>
                <option value="revoked">Revogar</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Motivo obrigatório para correcção, revogação ou revalidação</span>
              <textarea required value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>

            <div className="rounded-lg border border-border p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold"><ShieldAlert size={16} /> Histórico de auditoria</h4>
              {selected.events.length === 0 ? <p className="text-sm text-muted-foreground">Sem alterações registadas.</p> : (
                <ol className="space-y-3">
                  {selected.events.map((entry) => (
                    <li key={entry.id} className="border-l-2 border-accent/40 pl-3 text-sm">
                      <div className="font-medium">{entry.action_label} · {new Date(entry.created_at).toLocaleString('pt-MZ')}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.actor_email || 'Sistema'}{entry.reason ? ` — ${entry.reason}` : ''}
                      </div>
                      {Object.keys(entry.changes).length > 0 && (
                        <ul className="mt-1 text-xs text-muted-foreground">
                          {Object.entries(entry.changes).map(([field, change]) => (
                            <li key={field}>{field}: {change.from} → {change.to}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <footer className="flex flex-wrap justify-between gap-3">
              <a href={`/certificates/${selected.certificate_number}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
                Verificação pública <ExternalLink size={14} />
              </a>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelected(null)}
                  className="rounded-md border border-border px-4 py-2">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground disabled:opacity-60">
                  {saving && <Loader2 size={15} className="animate-spin" />} Guardar alteração
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
