'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Check, Eye, FileImage, FileText, LoaderCircle, Save, Send,
  Upload, X,
} from 'lucide-react';
import { adminAPI, getMediaUrl, type BlogPostDetail } from '@/src/lib/api';
import { useAuth } from '@/src/hooks/useAuth';

interface BlogForm {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author_name: string;
  is_published: boolean;
}

const EMPTY_FORM: BlogForm = {
  title: '',
  excerpt: '',
  content: '',
  category: '',
  author_name: '',
  is_published: false,
};
const DRAFT_STORAGE_KEY = 'admin-blog-editor-draft-v1';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function getApiError(error: unknown) {
  if (!axios.isAxiosError(error)) return 'Não foi possível guardar o artigo. Tente novamente.';
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    if ('detail' in data && typeof data.detail === 'string') return data.detail;
    const messages = Object.entries(data).map(([field, value]) =>
      `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
    );
    if (messages.length) return messages.join(' ');
  }
  return 'Não foi possível guardar o artigo. Verifique os campos e tente novamente.';
}

export default function AdminBlogEditor({ postId }: { postId: string | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<BlogForm>(() => ({
    ...EMPTY_FORM,
    author_name: user?.first_name || user?.username || '',
  }));
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const isEditing = Boolean(postId);

  useEffect(() => {
    if (postId) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BlogForm>;
        setForm({ ...EMPTY_FORM, ...parsed, is_published: false });
        setNotice('Rascunho local restaurado.');
      }
    } catch (draftError) {
      console.error('Não foi possível restaurar o rascunho local do blog.', draftError);
      setError('Não foi possível restaurar o rascunho guardado neste navegador.');
    }
  }, [postId]);

  useEffect(() => {
    if (!user || isEditing) return;
    setForm((current) => ({
      ...current,
      author_name: current.author_name || user.first_name || user.username || '',
    }));
  }, [user, isEditing]);

  useEffect(() => {
    if (!postId) return;
    let active = true;
    setLoading(true);
    adminAPI.getBlogPost(postId).then(({ data }) => {
      if (!active) return;
      setPost(data);
      setForm({
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        author_name: data.author_name,
        is_published: data.is_published,
      });
      setImagePreview(getMediaUrl(data.image));
    }).catch((loadError) => {
      if (!active) return;
      console.error('Não foi possível carregar o artigo para edição.', loadError);
      setError(axios.isAxiosError(loadError) && loadError.response?.status === 404
        ? 'Este artigo não foi encontrado.'
        : 'Não foi possível carregar o artigo. Verifique a ligação e as permissões.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [postId]);

  useEffect(() => {
    if (isEditing || loading) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...form, is_published: false }));
      } catch (storageError) {
        console.error('Não foi possível guardar o rascunho local do blog.', storageError);
        setNotice('O armazenamento local está indisponível; guarde o artigo antes de sair.');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [form, isEditing, loading]);

  useEffect(() => {
    if (!imageFile) return;
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const readingTime = useMemo(() => {
    const words = form.content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 200))} min`;
  }, [form.content]);

  const save = useCallback(async (event: FormEvent<HTMLFormElement> | undefined, publish: boolean) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const payload = new FormData();
    payload.append('title', form.title.trim());
    payload.append('excerpt', form.excerpt.trim());
    payload.append('content', form.content);
    payload.append('category', form.category.trim());
    payload.append('author_name', form.author_name.trim());
    payload.append('is_published', String(publish));
    if (imageFile) payload.append('image', imageFile);

    try {
      if (postId) {
        await adminAPI.updateBlogPost(postId, payload);
      } else {
        await adminAPI.createBlogPost(payload);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      router.push('/admin?tab=blog');
    } catch (saveError) {
      console.error('Não foi possível guardar o artigo do blog.', saveError);
      setError(getApiError(saveError));
      setSaving(false);
    }
  }, [form, imageFile, postId, router]);

  const handleImage = (file?: File) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um ficheiro de imagem válido.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('A imagem deve ter no máximo 10 MB.');
      return;
    }
    setImageFile(file);
  };

  const validateAndSave = (publish: boolean) => {
    const formElement = document.getElementById('blog-editor-form') as HTMLFormElement | null;
    if (formElement && !formElement.reportValidity()) return;
    if (!formElement && (!form.title.trim() || !form.excerpt.trim() || !form.content.trim() || !form.category.trim() || !form.author_name.trim())) {
      setError('Preencha o título, resumo, conteúdo, categoria e autor antes de guardar.');
      setPreview(false);
      return;
    }
    void save(undefined, publish);
  };

  if (loading) {
    return <div className="flex min-h-72 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle size={20} className="animate-spin text-indigo-600" /> A carregar artigo…</div>;
  }

  if (postId && !post && error) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><FileText size={22} /></div>
        <h1 className="text-xl font-bold text-slate-900">Não foi possível abrir o artigo</h1>
        <p role="alert" className="mt-2 text-sm text-slate-600">{error}</p>
        <Link href="/admin?tab=blog" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} /> Voltar aos artigos</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/admin?tab=blog" aria-label="Voltar à gestão do blog" className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-sm font-medium text-indigo-600">Gestão do blog</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{isEditing ? 'Editar artigo' : 'Novo artigo'}</h1>
            <p className="mt-1 text-sm text-slate-500">{isEditing ? 'Atualize o conteúdo e o estado de publicação.' : 'Escreva e guarde o artigo como rascunho ou publique-o.'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Eye size={16} /> {preview ? 'Editar conteúdo' : 'Pré-visualizar'}
          </button>
          <button type="button" onClick={() => validateAndSave(false)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Guardar rascunho
          </button>
          <button type="button" onClick={() => validateAndSave(true)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} {form.is_published ? 'Guardar e manter publicado' : 'Publicar'}
          </button>
        </div>
      </header>

      {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {preview ? (
        <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-10">
          {imagePreview && <img src={imagePreview} alt="" className="mb-8 max-h-[420px] w-full rounded-xl object-cover" />}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {form.category && <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">{form.category}</span>}
            <span>{form.author_name || 'Autor'}</span>
            <span>{readingTime} de leitura</span>
            <span>{form.is_published ? 'Publicado' : 'Pré-visualização de rascunho'}</span>
          </div>
          <h2 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{form.title || 'Título do artigo'}</h2>
          <p className="mt-4 text-lg leading-7 text-slate-600">{form.excerpt || 'O resumo do artigo será apresentado aqui.'}</p>
          <div className="my-8 border-t border-slate-100" />
          <iframe title="Pré-visualização do conteúdo do artigo" sandbox="" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.8 system-ui,sans-serif;color:#475569;margin:0}h1,h2,h3{color:#0f172a;line-height:1.3}img{max-width:100%;height:auto;border-radius:12px}a{color:#4f46e5}</style></head><body>${form.content || '<p>O conteúdo do artigo será apresentado aqui.</p>'}</body></html>`} className="min-h-[380px] w-full rounded-lg border-0" />
        </article>
      ) : (
        <form id="blog-editor-form" onSubmit={(event) => { void save(event, form.is_published); }} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-2"><FileText size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Conteúdo do artigo</h2></div>
              <div className="space-y-5">
                <Field label="Título" required hint={`${form.title.length}/200`}>
                  <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} required placeholder="Escreva um título claro e descritivo" className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
                <Field label="Resumo" required hint={`${form.excerpt.length}/500`}>
                  <textarea value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} maxLength={500} required rows={3} placeholder="Apresente o tema do artigo em poucas frases" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
                <Field label="Corpo do artigo" required hint={`${readingTime} de leitura`}>
                  <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required rows={18} placeholder="Escreva o artigo. Pode usar HTML básico para títulos, parágrafos, listas e ligações." className="w-full resize-y rounded-lg border border-slate-200 px-3 py-3 font-mono text-sm leading-6 outline-none placeholder:font-sans placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <p className="mt-2 text-xs text-slate-500">O conteúdo aceita HTML básico (por exemplo, &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt; e &lt;a&gt;). Pré-visualize antes de publicar.</p>
                </Field>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Eye size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Pré-visualização</h2></div>
                <button type="button" onClick={() => setPreview(true)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Abrir pré-visualização</button>
              </div>
              <p className="line-clamp-2 text-lg font-semibold text-slate-900">{form.title || 'O título do seu artigo aparecerá aqui'}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{form.excerpt || 'Adicione um resumo para mostrar aos leitores o que vão encontrar neste artigo.'}</p>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2"><Check size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Publicação</h2></div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} className="mt-0.5 h-4 w-4 accent-indigo-600" />
                <span><span className="block text-sm font-semibold text-slate-800">Artigo publicado</span><span className="mt-1 block text-xs leading-5 text-slate-500">Quando ativo, o artigo fica visível na área pública do blog.</span></span>
              </label>
              <p className="mt-3 text-xs leading-5 text-slate-500">Pode alterar o estado a qualquer momento. Guardar sem publicar mantém o artigo como rascunho.</p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2"><FileImage size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Detalhes do artigo</h2></div>
              <div className="space-y-4">
                <Field label="Categoria" required>
                  <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required maxLength={100} placeholder="Ex.: Tecnologia" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
                <Field label="Autor" required>
                  <input value={form.author_name} onChange={(event) => setForm({ ...form, author_name: event.target.value })} required maxLength={255} placeholder="Nome apresentado ao leitor" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2"><Upload size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Imagem de capa</h2></div>
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40">
                {imagePreview ? <img src={imagePreview} alt="Pré-visualização da imagem de capa" className="mb-3 max-h-40 w-full rounded-md object-cover" /> : <Upload size={22} className="mb-2 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-700">{imageFile ? 'Alterar imagem' : imagePreview ? 'Substituir imagem' : 'Selecionar imagem'}</span>
                <span className="mt-1 text-xs text-slate-500">PNG, JPG ou WebP · até 10 MB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleImage(event.target.files?.[0])} className="sr-only" />
              </label>
              {imageFile && <button type="button" onClick={() => { setImageFile(null); setImagePreview(getMediaUrl(post?.image)); }} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><X size={13} /> Remover nova imagem</button>}
            </section>
          </aside>
        </form>
      )}
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
        <span>{label}{required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</span>
        {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
