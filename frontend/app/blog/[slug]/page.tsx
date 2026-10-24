import axios from 'axios';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Calendar, User, ArrowLeft, Facebook, Twitter, MessageCircle } from 'lucide-react';
import { absoluteUrl } from '@/src/lib/seo';
import { blogAPI, getMediaUrl, type BlogPostDetail } from '@/src/lib/api';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

async function getPost(slug: string): Promise<BlogPostDetail> {
  try {
    const { data } = await blogAPI.getBySlug(slug);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) notFound();
    throw error;
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Data não disponível';
  return new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'long' }).format(new Date(value));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  const image = getMediaUrl(post.image);
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${encodeURIComponent(slug)}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: absoluteUrl(`/blog/${encodeURIComponent(slug)}`),
      authors: [post.author_name],
      ...(image ? { images: [{ url: image, alt: post.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.excerpt,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const [post, recentResponse] = await Promise.all([
    getPost(slug),
    blogAPI.list({ page_size: 4 }),
  ]);
  const recentPosts = recentResponse.data.results.filter((item) => item.slug !== slug).slice(0, 3);
  const image = getMediaUrl(post.image);
  const articleUrl = absoluteUrl(`/blog/${encodeURIComponent(slug)}`);

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium line-clamp-1">{post.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <article className="lg:col-span-3">
            <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft size={16} />
              Voltar ao Blog
            </Link>

            {image && (
              <div className="h-80 md:h-96 rounded-xl overflow-hidden mb-8 bg-muted">
                <img src={image} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
              {post.category && <span className="px-3 py-1 bg-accent/10 text-accent rounded-full font-medium text-xs">{post.category}</span>}
              <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(post.published_at)}</span>
              <span className="flex items-center gap-1"><User size={14} />{post.author_name}</span>
              <span>{post.read_time} de leitura</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-6">{post.title}</h1>
            {post.excerpt && <p className="text-lg text-muted-foreground mb-8">{post.excerpt}</p>}

            <div
              className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-accent prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            <div className="mt-10 pt-8 border-t border-border">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">Partilhar:</span>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`} target="_blank" rel="noreferrer" aria-label="Partilhar no Facebook" className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
                  <Facebook size={16} />
                </a>
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noreferrer" aria-label="Partilhar no X" className="p-2 bg-sky-500 text-white rounded-full hover:bg-sky-600 transition-colors">
                  <Twitter size={16} />
                </a>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${articleUrl}`)}`} target="_blank" rel="noreferrer" aria-label="Partilhar no WhatsApp" className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors">
                  <MessageCircle size={16} />
                </a>
              </div>
            </div>
          </article>

          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-8">
              <div>
                <h2 className="font-bold text-lg mb-4">Artigos Recentes</h2>
                <div className="space-y-4">
                  {recentPosts.map((recent) => (
                    <Link key={recent.slug} href={`/blog/${recent.slug}`} className="flex gap-3 group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {recent.image && <img src={getMediaUrl(recent.image) || recent.image} alt={recent.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium group-hover:text-accent transition-colors line-clamp-2">{recent.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(recent.published_at)}</p>
                      </div>
                    </Link>
                  ))}
                  {recentPosts.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há outros artigos publicados.</p>}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
