'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Check, Eye, FileImage, FileText, LoaderCircle, Save, Send,
  Link2, Upload, X,
} from 'lucide-react';
import { adminAPI, getMediaUrl, type BlogCategory, type BlogPostDetail } from '@/src/lib/api';
import { absoluteUrl } from '@/src/lib/seo';
import { toast } from '@/src/lib/toast';
import { useAuth } from '@/src/hooks/useAuth';
import BlogRichTextEditor, { sanitizeEditorHtml } from './BlogRichTextEditor';
import BlogSeoPanel, { BlogImageCreditFields, type BlogSeoValues, type TwitterCard } from './BlogSeoPanel';

interface BlogForm extends BlogSeoValues {
  title: string;
  excerpt: string;
  content: string;
  image_url: string;
  category: string;
  category_id: string;
  author_name: string;
  is_published: boolean;
}

type TextFormField = Exclude<keyof BlogForm, 'is_published' | 'noindex' | 'nofollow' | 'twitter_card'>;

const EMPTY_FORM: BlogForm = {
  title: '',
  excerpt: '',
  content: '',
  image_url: '',
  category: '',
  category_id: '',
  author_name: '',
  is_published: false,
  meta_title: '',
  meta_description: '',
  canonical_url: '',
  focus_keyword: '',
  noindex: false,
  nofollow: false,
  og_title: '',
  og_description: '',
  twitter_card: 'summary_large_image',
  image_caption: '',
  image_credit: '',
  image_source_url: '',
};
const DRAFT_STORAGE_KEY = 'admin-blog-editor-draft-v1';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 100_000;

const API_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  excerpt: 'Resumo',
  content: 'Conteúdo',
  category: 'Categoria',
  category_id: 'Categoria',
  author_name: 'Autor',
  image: 'Imagem de capa',
  image_url: 'Ligação da imagem de capa',
  meta_title: 'Título SEO',
  meta_description: 'Meta descrição',
  canonical_url: 'URL canónica',
  focus_keyword: 'Palavra-chave foco',
  og_title: 'Título de partilha',
  og_description: 'Descrição de partilha',
  twitter_card: 'Cartão social',
  image_caption: 'Legenda da imagem',
  image_credit: 'Crédito da imagem',
  image_source_url: 'Fonte da imagem',
  is_published: 'Estado de publicação',
  non_field_errors: 'Formulário',
  detail: 'Formulário',
};

function parseApiErrors(error: unknown): { summary: string; fields: Record<string, string> } {
  if (!axios.isAxiosError(error)) {
    return { summary: 'Não foi possível guardar o artigo. Tente novamente.', fields: {} };
  }
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    const fields: Record<string, string> = {};
    for (const [field, value] of Object.entries(data)) {
      const messages = Array.isArray(value) ? value : [value];
      fields[field] = messages
        .map((message) => typeof message === 'string' ? message : JSON.stringify(message))
        .join(' ');
    }
    const summary = Object.entries(fields)
      .map(([field, message]) => `${API_FIELD_LABELS[field] || field}: ${message}`)
      .join(' ');
    if (summary) return { summary, fields };
  }
  return {
    summary: error.response?.status === 413
      ? 'O pedido é demasiado grande. Reduza o conteúdo ou a imagem e tente novamente.'
      : 'Não foi possível guardar o artigo. Verifique os campos e tente novamente.',
    fields: {},
  };
}

function getContentTextLength(content: string) {
  return content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim().length;
}

function validateBlogForm(form: BlogForm) {
  const errors: Record<string, string> = {};
  const requiredFields: Array<[TextFormField, string]> = [
    ['title', 'Título'],
    ['excerpt', 'Resumo'],
    ['category_id', 'Categoria'],
    ['author_name', 'Autor'],
  ];
  for (const [field, label] of requiredFields) {
    if (!form[field].trim()) errors[field] = `${label} é obrigatório.`;
  }
  if (!getContentTextLength(sanitizeEditorHtml(form.content))) errors.content = 'O conteúdo do artigo é obrigatório.';

  const textLengths: Array<[TextFormField, string, number]> = [
    ['title', 'Título', 200],
    ['excerpt', 'Resumo', 500],
    ['category', 'Categoria', 100],
    ['author_name', 'Autor', 255],
    ['content', 'Conteúdo', MAX_CONTENT_LENGTH],
    ['image_url', 'Ligação da imagem de capa', 1000],
    ['meta_title', 'Título SEO', 255],
    ['meta_description', 'Meta descrição', 500],
    ['canonical_url', 'URL canónica', 500],
    ['focus_keyword', 'Palavra-chave foco', 120],
    ['og_title', 'Título de partilha', 255],
    ['og_description', 'Descrição de partilha', 500],
    ['image_caption', 'Legenda da imagem', 255],
    ['image_credit', 'Crédito da imagem', 255],
    ['image_source_url', 'Fonte da imagem', 500],
  ];
  for (const [field, label, limit] of textLengths) {
    const length = form[field].length;
    if (length > limit) errors[field] = `${label} excede o máximo de ${limit} caracteres.`;
  }

  const urlFields: Array<[TextFormField, string]> = [
    ['image_url', 'Ligação da imagem de capa'],
    ['canonical_url', 'URL canónica'],
    ['image_source_url', 'Fonte da imagem'],
  ];
  for (const [field, label] of urlFields) {
    const value = form[field].trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
        throw new Error('URL não permitida');
      }
    } catch {
      errors[field] = `${label} deve ser uma URL http:// ou https:// válida, sem credenciais.`;
    }
  }
  if (!['summary', 'summary_large_image'].includes(form.twitter_card)) {
    errors.twitter_card = 'Selecione um formato de cartão social válido.';
  }
  return errors;
}

export default function AdminBlogEditor({ postId }: { postId: string | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<BlogForm>(() => ({
    ...EMPTY_FORM,
    author_name: user?.first_name || user?.username || '',
  }));
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [blogCategories, setBlogCategories] = useState<BlogCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const isEditing = Boolean(postId);

  useEffect(() => {
    let active = true;
    adminAPI.listBlogCategories({ page_size: 100 }).then(({ data }) => {
      if (!active) return;
      setBlogCategories(data.results);
      setCategoriesLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      console.error('Não foi possível carregar as categorias do blog para o editor.', loadError);
      setCategoriesLoading(false);
      toast.error('Não foi possível carregar as categorias', 'Verifique a ligação e tente novamente.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if ((postId && !post) || !blogCategories.length || form.category_id) return;
    const matchingCategory = blogCategories.find((category) => category.name.toLocaleLowerCase() === form.category.toLocaleLowerCase());
    if (matchingCategory) setForm((current) => ({ ...current, category_id: matchingCategory.id }));
  }, [postId, post, blogCategories, form.category, form.category_id]);

  useEffect(() => {
    if (postId) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<BlogForm>;
        setForm({ ...EMPTY_FORM, ...parsed, is_published: false });
        setImagePreview(parsed.image_url ? getMediaUrl(parsed.image_url) : null);
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
        image_url: data.image_url || '',
        category: data.category,
        category_id: data.blog_category_id || '',
        author_name: data.author_name,
        is_published: data.is_published,
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
        canonical_url: data.canonical_url || '',
        focus_keyword: data.focus_keyword || '',
        noindex: Boolean(data.noindex),
        nofollow: Boolean(data.nofollow),
        og_title: data.og_title || '',
        og_description: data.og_description || '',
        twitter_card: (data.twitter_card || 'summary_large_image') as TwitterCard,
        image_caption: data.image_caption || '',
        image_credit: data.image_credit || '',
        image_source_url: data.image_source_url || '',
      });
      setImagePreview(getMediaUrl(data.image));
    }).catch((loadError) => {
      if (!active) return;
      console.error('Não foi possível carregar o artigo para edição.', loadError);
      const message = axios.isAxiosError(loadError) && loadError.response?.status === 404
        ? 'Este artigo não foi encontrado.'
        : 'Não foi possível carregar o artigo. Verifique a ligação e as permissões.';
      setError(message);
      toast.error('Não foi possível abrir o artigo', message);
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

  const permalink = useMemo(() => {
    const slug = post?.slug
      || form.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
      || 'artigo';
    return absoluteUrl(`/blog/${slug}`);
  }, [post?.slug, form.title]);

  const patchSeo = useCallback((patch: Partial<BlogSeoValues>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFieldErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((field) => delete next[field]);
      return next;
    });
    setError('');
  }, []);

  const updateField = <K extends keyof BlogForm>(field: K, value: BlogForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError('');
  };

  const save = useCallback(async (event: FormEvent<HTMLFormElement> | undefined, publish: boolean) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    setNotice('');
    const payload = new FormData();
    payload.append('title', form.title.trim());
    payload.append('excerpt', form.excerpt.trim());
    payload.append('content', sanitizeEditorHtml(form.content));
    payload.append('category', form.category.trim());
    payload.append('category_id', form.category_id);
    payload.append('author_name', form.author_name.trim());
    payload.append('is_published', String(publish));
    payload.append('image_url', form.image_url.trim());
    payload.append('meta_title', form.meta_title.trim());
    payload.append('meta_description', form.meta_description.trim());
    payload.append('canonical_url', form.canonical_url.trim());
    payload.append('focus_keyword', form.focus_keyword.trim());
    payload.append('noindex', String(form.noindex));
    payload.append('nofollow', String(form.nofollow));
    payload.append('og_title', form.og_title.trim());
    payload.append('og_description', form.og_description.trim());
    payload.append('twitter_card', form.twitter_card);
    payload.append('image_caption', form.image_caption.trim());
    payload.append('image_credit', form.image_credit.trim());
    payload.append('image_source_url', form.image_source_url.trim());
    if (imageFile) payload.append('image', imageFile);

    try {
      if (postId) {
        await adminAPI.updateBlogPost(postId, payload);
      } else {
        await adminAPI.createBlogPost(payload);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      toast.success(
        postId ? 'Artigo atualizado' : publish ? 'Artigo publicado' : 'Rascunho guardado',
        postId ? 'As alterações foram guardadas com sucesso.' : publish ? 'O artigo já está disponível no blog.' : 'O artigo foi guardado como rascunho.',
      );
      router.push('/admin?tab=blog');
    } catch (saveError) {
      console.error('Não foi possível guardar o artigo do blog.', saveError);
      const apiErrors = parseApiErrors(saveError);
      setError(apiErrors.summary);
      setFieldErrors(apiErrors.fields);
      toast.error(isEditing ? 'Não foi possível atualizar o artigo' : 'Não foi possível guardar o artigo', apiErrors.summary);
      setSaving(false);
    }
  }, [form, imageFile, postId, router]);

  const handleImage = (file?: File) => {
    setError('');
    if (!file) return;
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedImageTypes.includes(file.type)) {
      const message = 'Selecione um ficheiro de imagem válido. Use JPG, PNG, WebP ou GIF.';
      setError(message);
      setFieldErrors({ image: message });
      toast.error('Formato de imagem inválido', message);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const message = 'A imagem deve ter no máximo 10 MB.';
      setError(message);
      setFieldErrors({ image: message });
      toast.error('Imagem demasiado grande', message);
      return;
    }
    setError('');
    setFieldErrors({});
    setForm((current) => ({ ...current, image_url: '' }));
    setImageFile(file);
  };

  const handleImageUrl = (value: string) => {
    setImageFile(null);
    updateField('image_url', value);
    const normalizedUrl = value.trim();
    setImagePreview(normalizedUrl
      ? getMediaUrl(normalizedUrl)
      : post?.image_url
        ? null
        : getMediaUrl(post?.image));
  };

  const validateAndSave = (publish: boolean) => {
    const errors = validateBlogForm(form);
    if (Object.keys(errors).length) {
      const summary = Object.values(errors).join(' ');
      setFieldErrors(errors);
      setError(summary);
      toast.warning('Verifique os dados do artigo', summary);
      setPreview(false);
      const fieldIds: Record<string, string> = {
        title: 'blog-title',
        excerpt: 'blog-excerpt',
        category_id: 'blog-category',
        author_name: 'blog-author',
        image_url: 'blog-cover-url',
      };
      const fieldId = fieldIds[Object.keys(errors)[0]];
      if (fieldId) document.getElementById(fieldId)?.focus();
      return;
    }
    setFieldErrors({});
    setError('');
    const formElement = document.getElementById('blog-editor-form') as HTMLFormElement | null;
    if (formElement && !formElement.reportValidity()) return;
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
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{isEditing ? 'Não foi possível atualizar o artigo.' : 'Revise os dados antes de continuar.'}</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {preview ? (
        <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-10">
          {imagePreview && (
            <figure className="mb-8">
              <img src={imagePreview} alt={form.image_caption || ''} className="max-h-[420px] w-full rounded-xl object-cover" />
              {(form.image_caption || form.image_credit) && (
                <figcaption className="mt-2 text-xs leading-5 text-slate-500">
                  {form.image_caption}
                  {form.image_credit && <span className="block">Crédito: {form.image_credit}</span>}
                </figcaption>
              )}
            </figure>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {form.category && <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">{form.category}</span>}
            <span>{form.author_name || 'Autor'}</span>
            <span>{readingTime} de leitura</span>
            <span>{form.is_published ? 'Publicado' : 'Pré-visualização de rascunho'}</span>
          </div>
          <h2 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{form.title || 'Título do artigo'}</h2>
          <p className="mt-4 text-lg leading-7 text-slate-600">{form.excerpt || 'O resumo do artigo será apresentado aqui.'}</p>
          <div className="my-8 border-t border-slate-100" />
          <div className="blog-article-content" dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(form.content || '<p>O conteúdo do artigo será apresentado aqui.</p>') }} />
        </article>
      ) : (
        <form id="blog-editor-form" onSubmit={(event) => { event.preventDefault(); validateAndSave(form.is_published); }} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-2"><FileText size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Conteúdo do artigo</h2></div>
              <div className="space-y-5">
                <Field label="Título" required htmlFor="blog-title" hint={`${form.title.length}/200`} error={fieldErrors.title}>
                  <input id="blog-title" value={form.title} onChange={(event) => updateField('title', event.target.value)} maxLength={200} required aria-invalid={Boolean(fieldErrors.title)} placeholder="Escreva um título claro e descritivo" className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
                <Field label="Resumo" required htmlFor="blog-excerpt" hint={`${form.excerpt.length}/500`} error={fieldErrors.excerpt}>
                  <textarea id="blog-excerpt" value={form.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} maxLength={500} required aria-invalid={Boolean(fieldErrors.excerpt)} rows={3} placeholder="Apresente o tema do artigo em poucas frases" className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
                <Field label="Corpo do artigo" required hint={`${form.content.length}/${MAX_CONTENT_LENGTH} caracteres · ${readingTime} de leitura`} error={fieldErrors.content}>
                  <BlogRichTextEditor value={form.content} onChange={(content) => updateField('content', content)} />
                  <p className="mt-2 text-xs text-slate-500">Use a barra de ferramentas para formatar texto, inserir ligações e adicionar imagens por endereço URL.</p>
                </Field>
              </div>
            </section>
            <BlogSeoPanel
              values={form}
              onChange={patchSeo}
              article={{ title: form.title, excerpt: form.excerpt, content: form.content }}
              permalink={permalink}
              imageUrl={imagePreview}
              fieldErrors={fieldErrors}
            />
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
                <Field label="Categoria" required htmlFor="blog-category" error={fieldErrors.category_id}>
                  <select
                    id="blog-category"
                    value={form.category_id}
                    required
                    disabled={categoriesLoading || !blogCategories.length}
                    aria-invalid={Boolean(fieldErrors.category_id)}
                    onChange={(event) => {
                      const selectedCategory = blogCategories.find((category) => category.id === event.target.value);
                      setForm((current) => ({
                        ...current,
                        category_id: event.target.value,
                        category: selectedCategory?.name || '',
                      }));
                      setFieldErrors((current) => {
                        const next = { ...current };
                        delete next.category_id;
                        delete next.category;
                        return next;
                      });
                    }}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                  >
                    <option value="">{categoriesLoading ? 'A carregar categorias…' : 'Selecione uma categoria'}</option>
                    {blogCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  {!categoriesLoading && !blogCategories.length && (
                    <p className="mt-1 text-xs text-amber-700">Crie primeiro uma categoria no painel de Categorias.</p>
                  )}
                </Field>
                <Field label="Autor" required htmlFor="blog-author" hint={`${form.author_name.length}/255`} error={fieldErrors.author_name}>
                  <input id="blog-author" value={form.author_name} onChange={(event) => updateField('author_name', event.target.value)} required maxLength={255} aria-invalid={Boolean(fieldErrors.author_name)} placeholder="Nome apresentado ao leitor" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2"><Upload size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900">Imagem de capa</h2></div>
              {imagePreview
                ? <img src={imagePreview} alt="Pré-visualização da imagem de capa" className="mb-3 max-h-40 w-full rounded-md object-cover" />
                : <div className="mb-3 flex min-h-20 items-center justify-center rounded-lg bg-slate-50 text-slate-400"><Upload size={22} /></div>}
              <label htmlFor="blog-cover-upload" className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50/40">
                <Upload size={16} />
                {imageFile ? 'Alterar ficheiro de imagem' : 'Carregar imagem do dispositivo'}
              </label>
              <input id="blog-cover-upload" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => handleImage(event.target.files?.[0])} className="sr-only" />
              <p className="mt-1 text-center text-xs text-slate-500">PNG, JPG, WebP ou GIF · até 10 MB</p>
              <div className="my-4 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                ou
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <label htmlFor="blog-cover-url" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-800">
                <Link2 size={15} className="text-slate-500" /> Adicionar por ligação
              </label>
              <input
                id="blog-cover-url"
                type="url"
                value={form.image_url}
                onChange={(event) => handleImageUrl(event.target.value)}
                maxLength={1000}
                aria-invalid={Boolean(fieldErrors.image_url)}
                placeholder="https://exemplo.com/imagem.jpg"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {fieldErrors.image_url && <p role="alert" className="mt-1.5 text-xs text-red-700">{fieldErrors.image_url}</p>}
              {fieldErrors.image && <p role="alert" className="mt-1.5 text-xs text-red-700">{fieldErrors.image}</p>}
              <p className="mt-1 text-xs leading-5 text-slate-500">Use um endereço público e direto para o ficheiro de imagem. A ligação ficará armazenada como fornecida.</p>
              {imageFile && <button type="button" onClick={() => { setImageFile(null); setImagePreview(getMediaUrl(post?.image)); }} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><X size={13} /> Remover novo ficheiro</button>}
              <BlogImageCreditFields values={form} onChange={patchSeo} imageUrl={imagePreview} fieldErrors={fieldErrors} />
            </section>
          </aside>
        </form>
      )}
    </section>
  );
}

function Field({ label, required, hint, htmlFor, error, children }: { label: string; required?: boolean; hint?: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  const labelText = <>{label}{required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}</>;
  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
        {htmlFor ? <label htmlFor={htmlFor}>{labelText}</label> : <span>{labelText}</span>}
        {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
      </div>
      {children}
      {error && <p role="alert" className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
