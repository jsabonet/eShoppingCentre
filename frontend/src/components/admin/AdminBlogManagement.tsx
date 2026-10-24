'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDownUp, Check, ChevronLeft, ChevronRight, Copy,
  Download, Edit3, Eye, FileText, FolderOpen, LoaderCircle, Plus, Search,
  Trash2, X,
} from 'lucide-react';
import { adminAPI, getMediaUrl, type BlogPostDetail } from '@/src/lib/api';

type StatusFilter = 'all' | 'published' | 'draft';
type SortOrder = 'newest' | 'oldest' | 'title';

function formatDate(value: string | null) {
  if (!value) return 'Sem data de publicação';
  return new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'medium' }).format(new Date(value));
}

export default function AdminBlogManagement() {
  const [posts, setPosts] = useState<BlogPostDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);
  const [deletePost, setDeletePost] = useState<BlogPostDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const pageSize = 10;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const firstPage = await adminAPI.listBlogPosts({ page_size: 100, page: 1 });
      const allPosts = [...firstPage.data.results];
      const pages = Math.ceil(firstPage.data.count / 100);
      for (let currentPage = 2; currentPage <= pages; currentPage += 1) {
        const { data } = await adminAPI.listBlogPosts({ page_size: 100, page: currentPage });
        allPosts.push(...data.results);
      }
      setPosts(allPosts);
    } catch (loadError) {
      console.error('Não foi possível carregar os artigos do blog.', loadError);
      setError('Não foi possível carregar os artigos. Verifique a ligação e as permissões e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const categories = useMemo(
    () => [...new Set(posts.map((post) => post.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [posts],
  );
  const filteredPosts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return posts
      .filter((post) => {
        const matchesSearch = !query || [post.title, post.excerpt, post.author_name]
          .some((value) => value.toLocaleLowerCase().includes(query));
        const matchesStatus = status === 'all' || (status === 'published' ? post.is_published : !post.is_published);
        const matchesCategory = category === 'all' || post.category === category;
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title);
        const comparison = new Date(a.published_at || a.created_at).getTime() - new Date(b.published_at || b.created_at).getTime();
        return sort === 'newest' ? -comparison : comparison;
      });
  }, [posts, search, status, category, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const visiblePosts = filteredPosts.slice((page - 1) * pageSize, page * pageSize);
  const publishedCount = posts.filter((post) => post.is_published).length;
  const draftCount = posts.length - publishedCount;

  useEffect(() => {
    setPage(1);
  }, [search, status, category, sort]);

  const exportCsv = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['Título', 'Categoria', 'Autor', 'Estado', 'Data'].map(escapeCsv).join(';'),
      ...filteredPosts.map((post) => [
        post.title,
        post.category,
        post.author_name,
        post.is_published ? 'Publicado' : 'Rascunho',
        post.published_at || post.created_at,
      ].map(escapeCsv).join(';')),
    ];
    const url = URL.createObjectURL(new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'artigos-blog.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!deletePost) return;
    setDeleting(true);
    try {
      await adminAPI.deleteBlogPost(deletePost.id);
      setPosts((current) => current.filter((post) => post.id !== deletePost.id));
      setDeletePost(null);
    } catch (deleteError) {
      console.error('Não foi possível eliminar o artigo.', deleteError);
      setError('Não foi possível eliminar o artigo. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const duplicatePost = async (post: BlogPostDetail) => {
    setDuplicatingId(post.id);
    setError('');
    setNotice('');
    try {
      await adminAPI.createBlogPost({
        title: `${post.title} (cópia)`,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        author_name: post.author_name,
        is_published: false,
      });
      setNotice('Artigo duplicado como rascunho. O texto e a categoria foram copiados; adicione novamente a imagem de capa, se necessário.');
      await loadPosts();
    } catch (duplicateError) {
      console.error('Não foi possível duplicar o artigo.', duplicateError);
      setError('Não foi possível duplicar o artigo. Tente novamente.');
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Conteúdo</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Gestão do blog</h1>
          <p className="mt-1 text-sm text-slate-500">Crie, organize e publique artigos para os seus leitores.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={exportCsv} disabled={!filteredPosts.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> Exportar
          </button>
          <Link href="/admin/blog/editor" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
            <Plus size={17} /> Novo artigo
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total de artigos" value={posts.length} icon={<FileText size={18} />} tone="indigo" />
        <MetricCard label="Publicados" value={publishedCount} icon={<Check size={18} />} tone="green" />
        <MetricCard label="Rascunhos" value={draftCount} icon={<Edit3 size={18} />} tone="amber" />
        <MetricCard label="Categorias usadas" value={categories.length} icon={<FolderOpen size={18} />} tone="indigo" />
      </div>

      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <FolderOpen size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Artigos</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{filteredPosts.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_170px_190px_160px]">
            <label className="relative block">
              <span className="sr-only">Pesquisar artigos</span>
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar título, resumo ou autor" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por estado</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="all">Todos os estados</option>
                <option value="published">Publicados</option>
                <option value="draft">Rascunhos</option>
              </select>
              <ArrowDownUp size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
            <label className="relative">
              <span className="sr-only">Filtrar por categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="all">Todas as categorias</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <ArrowDownUp size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
            <label className="relative">
              <span className="sr-only">Ordenar artigos</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="newest">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="title">Título A–Z</option>
              </select>
              <ArrowDownUp size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
          </div>
        </div>

        {error && (
          <div role="alert" className="m-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => void loadPosts()} className="self-start font-semibold underline sm:self-auto">Tentar novamente</button>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-indigo-600" /> A carregar artigos…
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-500"><FileText size={24} /></div>
            <h3 className="font-semibold text-slate-900">{posts.length ? 'Nenhum artigo corresponde aos filtros' : 'Ainda não existem artigos'}</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">{posts.length ? 'Altere a pesquisa ou limpe os filtros para ver outros artigos.' : 'Crie o primeiro artigo e guarde-o como rascunho ou publique-o.'}</p>
            {posts.length ? (
              <button type="button" onClick={() => { setSearch(''); setStatus('all'); setCategory('all'); }} className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700">Limpar filtros</button>
            ) : (
              <Link href="/admin/blog/editor" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"><Plus size={16} /> Criar artigo</Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Artigo</th>
                    <th className="px-4 py-3 font-semibold">Categoria</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Autor</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiblePosts.map((post) => (
                    <tr key={post.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <PostThumbnail post={post} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{post.title}</p>
                            <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-slate-500">{post.excerpt}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{post.category || '—'}</td>
                      <td className="px-4 py-3.5"><StatusBadge published={post.is_published} /></td>
                      <td className="px-4 py-3.5 text-slate-600">{post.author_name || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{formatDate(post.published_at || post.created_at)}</td>
                      <td className="px-4 py-3.5">
                        <PostActions post={post} onDelete={() => setDeletePost(post)} onDuplicate={() => void duplicatePost(post)} duplicating={duplicatingId === post.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {visiblePosts.map((post) => (
                <li key={post.id} className="p-4">
                  <div className="flex gap-3">
                    <PostThumbnail post={post} large />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge published={post.is_published} />
                        {post.category && <span className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{post.category}</span>}
                      </div>
                      <h3 className="mt-2 line-clamp-2 font-semibold leading-5 text-slate-900">{post.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{post.author_name || 'Sem autor'} · {formatDate(post.published_at || post.created_at)}</p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-500">{post.excerpt}</p>
                  <PostActions post={post} onDelete={() => setDeletePost(post)} onDuplicate={() => void duplicatePost(post)} duplicating={duplicatingId === post.id} />
                </li>
              ))}
            </ul>

            <footer className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center text-xs text-slate-500 sm:text-left">
                A mostrar {Math.min((page - 1) * pageSize + 1, filteredPosts.length)}–{Math.min(page * pageSize, filteredPosts.length)} de {filteredPosts.length} artigos
              </p>
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior" className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={17} /></button>
                <span className="px-2 text-sm text-slate-600">Página {page} de {pageCount}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página seguinte" className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={17} /></button>
              </div>
            </footer>
          </>
        )}
      </div>

      {deletePost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeletePost(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-blog-title" className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-blog-title" className="text-lg font-bold text-slate-900">Eliminar artigo?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">O artigo “{deletePost.title}” será eliminado permanentemente. Esta ação não pode ser desfeita.</p>
              </div>
              <button type="button" onClick={() => setDeletePost(null)} disabled={deleting} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeletePost(null)} disabled={deleting} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Eliminar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: 'indigo' | 'green' | 'amber' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[tone]}`}>{icon}</div>
      <div><p className="text-sm text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p></div>
    </article>
  );
}

function PostThumbnail({ post, large = false }: { post: BlogPostDetail; large?: boolean }) {
  const image = getMediaUrl(post.image);
  return image
    ? <img src={image} alt="" className={`${large ? 'h-16 w-16' : 'h-11 w-11'} shrink-0 rounded-lg object-cover`} />
    : <div className={`${large ? 'h-16 w-16' : 'h-11 w-11'} flex shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400`}><FileText size={large ? 21 : 17} /></div>;
}

function StatusBadge({ published }: { published: boolean }) {
  return published
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Check size={12} /> Publicado</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><Edit3 size={12} /> Rascunho</span>;
}

function PostActions({ post, onDelete, onDuplicate, duplicating }: { post: BlogPostDetail; onDelete: () => void; onDuplicate: () => void; duplicating: boolean }) {
  return (
    <div className="mt-3 flex items-center gap-2 md:mt-0 md:justify-end">
      <Link href={`/admin/blog/editor?id=${encodeURIComponent(post.id)}`} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 md:flex-none" aria-label={`Editar ${post.title}`}>
        <Edit3 size={14} /> Editar
      </Link>
      {post.is_published && (
        <Link href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label={`Ver ${post.title}`} title="Ver artigo"><Eye size={15} /></Link>
      )}
      <button type="button" onClick={onDuplicate} disabled={duplicating} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50" aria-label={`Duplicar ${post.title} como rascunho`} title="Duplicar como rascunho">{duplicating ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}</button>
      <button type="button" onClick={onDelete} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50" aria-label={`Eliminar ${post.title}`} title="Eliminar artigo"><Trash2 size={15} /></button>
    </div>
  );
}
