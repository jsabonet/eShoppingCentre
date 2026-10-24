'use client';

import { useId, useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Globe, ImageIcon, Search, Share2, ShieldCheck, Wand2,
} from 'lucide-react';

export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

export type TwitterCard = 'summary' | 'summary_large_image';

export interface BlogSeoValues {
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  focus_keyword: string;
  noindex: boolean;
  nofollow: boolean;
  og_title: string;
  og_description: string;
  twitter_card: TwitterCard;
  image_caption: string;
  image_credit: string;
  image_source_url: string;
}

export interface BlogSeoArticle {
  title: string;
  excerpt: string;
  content: string;
}

const KEYWORD_ITEMS = [
  { key: 'meta_title', label: 'Título SEO' },
  { key: 'meta_description', label: 'Meta descrição' },
  { key: 'title', label: 'Título do artigo' },
  { key: 'headings', label: 'Subtítulos' },
  { key: 'intro', label: 'Início do texto' },
  { key: 'content', label: 'Corpo do texto' },
] as const;

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;
  const matches = haystack.toLowerCase().match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  return matches ? matches.length : 0;
}

export function analyzeKeyword(article: BlogSeoArticle, values: BlogSeoValues) {
  const keyword = values.focus_keyword.trim().toLowerCase();
  const text = stripHtml(article.content);
  const words = text.split(/\s+/).filter(Boolean);
  const headings = (article.content.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi) || [])
    .map((item) => stripHtml(item))
    .join(' ')
    .toLowerCase();
  const occurrences = countOccurrences(text, keyword);

  return {
    keyword,
    occurrences,
    density: words.length && keyword ? (occurrences / words.length) * 100 : 0,
    present: {
      meta_title: Boolean(keyword) && (values.meta_title || article.title).toLowerCase().includes(keyword),
      meta_description: Boolean(keyword) && (values.meta_description || article.excerpt).toLowerCase().includes(keyword),
      title: Boolean(keyword) && article.title.toLowerCase().includes(keyword),
      headings: Boolean(keyword) && headings.includes(keyword),
      intro: Boolean(keyword) && text.slice(0, 200).toLowerCase().includes(keyword),
      content: occurrences > 0,
    },
  };
}

function lengthTone(length: number, max: number) {
  if (!length) return 'text-slate-500';
  if (length > max) return 'text-amber-600';
  if (length < max * 0.5) return 'text-slate-500';
  return 'text-emerald-600';
}

function FieldShell({
  label, hint, tone, htmlFor, error, children,
}: {
  label: string; hint?: string; tone?: string; htmlFor?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        {htmlFor ? <label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">{label}</label> : <span className="text-sm font-medium text-slate-800">{label}</span>}
        {hint && <span className={`text-xs ${tone || 'text-slate-500'}`}>{hint}</span>}
      </div>
      {children}
      {error && <p role="alert" className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

export default function BlogSeoPanel({
  values, onChange, article, permalink, imageUrl, fieldErrors = {},
}: {
  values: BlogSeoValues;
  onChange: (patch: Partial<BlogSeoValues>) => void;
  article: BlogSeoArticle;
  permalink: string;
  imageUrl: string | null;
  fieldErrors?: Record<string, string>;
}) {
  const uid = useId();
  const analysis = useMemo(() => analyzeKeyword(article, values), [article, values]);

  const previewTitle = values.meta_title.trim() || article.title.trim() || 'Título do artigo';
  const previewDescription = (values.meta_description.trim() || article.excerpt.trim() || 'A meta descrição do artigo aparece aqui quando não é definida manualmente.');
  const shareTitle = values.og_title.trim() || previewTitle;
  const shareDescription = values.og_description.trim() || previewDescription;
  const previewHost = useMemo(() => {
    try {
      return new URL(permalink).host;
    } catch {
      return permalink;
    }
  }, [permalink]);

  const checklist = [
    analysis.present.meta_title && 'Palavra-chave presente no título SEO',
    analysis.present.meta_description && 'Palavra-chave presente na meta descrição',
    analysis.present.headings && 'Palavra-chave em pelo menos um subtítulo',
    analysis.present.intro && 'Palavra-chave no início do texto',
    analysis.present.content && `Palavra-chave repetida no texto (${analysis.occurrences}x)`,
    values.canonical_url.trim() !== '' && 'URL canónica definida',
  ].filter(Boolean) as string[];

  const issues = [
    !values.focus_keyword.trim() && 'Defina uma palavra-chave foco para avaliar o artigo.',
    previewTitle.length > SEO_TITLE_MAX && `O título SEO tem ${previewTitle.length} caracteres; recomenda-se até ${SEO_TITLE_MAX}.`,
    previewDescription.length > SEO_DESCRIPTION_MAX && `A meta descrição tem ${previewDescription.length} caracteres; recomenda-se até ${SEO_DESCRIPTION_MAX}.`,
    values.noindex && 'Este artigo está marcado como não indexável (noindex).',
    !imageUrl && 'Sem imagem de destaque nem imagem para partilha social.',
  ].filter(Boolean) as string[];

  const fillFromArticle = () => {
    onChange({
      og_title: values.meta_title.trim() || article.title.trim(),
      og_description: values.meta_description.trim() || article.excerpt.trim(),
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Search size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-slate-900">SEO e partilha</h2>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <FieldShell
              label="Título SEO"
              htmlFor={`${uid}-meta-title`}
              hint={`${previewTitle.length}/${SEO_TITLE_MAX}`}
              tone={lengthTone(previewTitle.length, SEO_TITLE_MAX)}
            >
              <input
                id={`${uid}-meta-title`}
                value={values.meta_title}
                onChange={(event) => onChange({ meta_title: event.target.value.slice(0, 255) })}
                maxLength={255}
                placeholder={article.title || 'Título apresentado nos resultados de busca'}
                className={inputClass}
              />
            </FieldShell>

            <FieldShell
              label="Meta descrição"
              htmlFor={`${uid}-meta-description`}
              hint={`${previewDescription.length}/${SEO_DESCRIPTION_MAX}`}
              tone={lengthTone(previewDescription.length, SEO_DESCRIPTION_MAX)}
            >
              <textarea
                id={`${uid}-meta-description`}
                value={values.meta_description}
                onChange={(event) => onChange({ meta_description: event.target.value.slice(0, 500) })}
                rows={3}
                maxLength={500}
                placeholder={article.excerpt || 'Resumo apresentado nos resultados de busca'}
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </FieldShell>

            <FieldShell label="Palavra-chave foco" htmlFor={`${uid}-keyword`} hint="orientação, não garantia">
              <input
                id={`${uid}-keyword`}
                value={values.focus_keyword}
                onChange={(event) => onChange({ focus_keyword: event.target.value.slice(0, 120) })}
                maxLength={120}
                placeholder="Ex.: centros comerciais em Maputo"
                className={inputClass}
              />
            </FieldShell>

            <FieldShell label="URL canónica" htmlFor={`${uid}-canonical`} hint="opcional" error={fieldErrors.canonical_url}>
              <input
                id={`${uid}-canonical`}
                type="url"
                value={values.canonical_url}
                onChange={(event) => onChange({ canonical_url: event.target.value })}
                maxLength={500}
                aria-invalid={Boolean(fieldErrors.canonical_url)}
                placeholder={permalink}
                className={inputClass}
              />
            </FieldShell>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Globe size={14} /> Pré-visualização na busca
              </p>
              <div className="rounded-md bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">eS</span>
                  <span className="min-w-0 text-xs leading-4 text-slate-600">
                    <span className="block truncate">{previewHost}</span>
                    <span className="block truncate text-slate-500">{permalink.replace(/^https?:\/\//, '')}</span>
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-base font-medium leading-6 text-[#1a0dab]">{previewTitle}</p>
                <p className="mt-1 line-clamp-3 text-sm leading-5 text-slate-600">{previewDescription}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Share2 size={14} /> Partilha social
                </p>
                <button
                  type="button"
                  onClick={fillFromArticle}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  <Wand2 size={13} /> Preencher
                </button>
              </div>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                {imageUrl
                  ? <img src={imageUrl} alt="" className="h-32 w-full object-cover" />
                  : <div className="flex h-20 items-center justify-center gap-2 bg-slate-100 text-xs text-slate-500"><ImageIcon size={14} /> Sem imagem de partilha</div>}
                <div className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{previewHost}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">{shareTitle}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{shareDescription}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open Graph</p>
            <FieldShell label="Título de partilha" htmlFor={`${uid}-og-title`}>
              <input id={`${uid}-og-title`} value={values.og_title} onChange={(event) => onChange({ og_title: event.target.value.slice(0, 255) })} maxLength={255} placeholder={previewTitle} className={inputClass} />
            </FieldShell>
            <FieldShell label="Descrição de partilha" htmlFor={`${uid}-og-description`}>
              <textarea id={`${uid}-og-description`} value={values.og_description} onChange={(event) => onChange({ og_description: event.target.value.slice(0, 500) })} rows={2} maxLength={500} placeholder={previewDescription} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </FieldShell>
            <FieldShell label="Cartão no X (Twitter)" htmlFor={`${uid}-twitter-card`}>
              <select id={`${uid}-twitter-card`} value={values.twitter_card} onChange={(event) => onChange({ twitter_card: event.target.value as TwitterCard })} className={inputClass}>
                <option value="summary_large_image">Imagem grande</option>
                <option value="summary">Resumo</option>
              </select>
            </FieldShell>
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><ShieldCheck size={14} /> Indexação</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={values.noindex} onChange={(event) => onChange({ noindex: event.target.checked })} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              <span><span className="block text-sm font-semibold text-slate-800">Não indexar (noindex)</span><span className="mt-1 block text-xs leading-5 text-slate-500">Impede que os motores de busca apresentem este artigo nos resultados.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={values.nofollow} onChange={(event) => onChange({ nofollow: event.target.checked })} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              <span><span className="block text-sm font-semibold text-slate-800">Não seguir ligações (nofollow)</span><span className="mt-1 block text-xs leading-5 text-slate-500">Sinaliza aos motores de busca para não seguirem as ligações do artigo.</span></span>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Análise de conteúdo</p>
              {checklist.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {checklist.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs leading-5 text-slate-600"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />{item}</li>
                  ))}
                </ul>
              )}
              {issues.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {issues.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs leading-5 text-amber-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{item}</li>
                  ))}
                </ul>
              )}
              {values.focus_keyword.trim() && (
                <p className="mt-2 text-xs text-slate-500">Densidade da palavra-chave: {analysis.density.toFixed(1)}% (recomendado entre 0,5% e 2,5%).</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function BlogImageCreditFields({
  values, onChange, imageUrl, fieldErrors = {},
}: {
  values: Pick<BlogSeoValues, 'image_caption' | 'image_credit' | 'image_source_url'>;
  onChange: (patch: Partial<BlogSeoValues>) => void;
  imageUrl: string | null;
  fieldErrors?: Record<string, string>;
}) {
  const uid = useId();
  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créditos da imagem</p>
      {!imageUrl && <p className="text-xs leading-5 text-slate-500">Adicione uma imagem de capa para registar legenda e autoria.</p>}
      <FieldShell label="Legenda" htmlFor={`${uid}-caption`} hint="usada como texto alternativo">
        <input id={`${uid}-caption`} value={values.image_caption} onChange={(event) => onChange({ image_caption: event.target.value.slice(0, 255) })} maxLength={255} disabled={!imageUrl} placeholder="Descrição breve da imagem" className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`} />
      </FieldShell>
      <FieldShell label="Crédito / autoria" htmlFor={`${uid}-credit`}>
        <input id={`${uid}-credit`} value={values.image_credit} onChange={(event) => onChange({ image_credit: event.target.value.slice(0, 255) })} maxLength={255} disabled={!imageUrl} placeholder="Ex.: Fotografia de Ana Silva" className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`} />
      </FieldShell>
      <FieldShell label="Fonte / licença" htmlFor={`${uid}-source`} error={fieldErrors.image_source_url}>
        <input id={`${uid}-source`} type="url" value={values.image_source_url} onChange={(event) => onChange({ image_source_url: event.target.value })} maxLength={500} aria-invalid={Boolean(fieldErrors.image_source_url)} disabled={!imageUrl} placeholder="https://exemplo.com/licenca" className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`} />
      </FieldShell>
      <p className="text-xs leading-5 text-slate-500">O crédito documenta a autoria, mas não substitui autorização de uso. Utilize apenas imagens próprias ou licenciadas.</p>
    </div>
  );
}
