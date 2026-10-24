import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Calendar, User, Tag, ArrowRight, Search } from 'lucide-react';
import BlogBannerSlider from '@/src/components/BlogBannerSlider';
import NewsletterForm from '@/src/components/blog/NewsletterForm';
import { blogAPI, getMediaUrl } from '@/src/lib/api';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Guias de compras, dicas, novidades e tendências de tecnologia, moda, casa e comércio online em Moçambique.',
  alternates: { canonical: '/blog' },
};

interface BlogPageProps {
  searchParams: Promise<{ search?: string; category?: string; page?: string }>;
}

function formatDate(value: string | null) {
  if (!value) return 'Data não disponível';
  return new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'long' }).format(new Date(value));
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const query = await searchParams;
  const search = query.search?.trim() || '';
  const category = query.category?.trim() || '';
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  let posts: Awaited<ReturnType<typeof blogAPI.list>>['data']['results'] = [];
  let categories: string[] = [];
  let count = 0;
  let loadError = false;

  try {
    const [postResponse, categoryResponse] = await Promise.all([
      blogAPI.list({ page, page_size: 9, search, category }),
      blogAPI.list({ page_size: 100 }),
    ]);
    posts = postResponse.data.results;
    count = postResponse.data.count;
    categories = [...new Set(categoryResponse.data.results.map((post) => post.category).filter(Boolean))].sort();
  } catch (error) {
    console.error('Não foi possível carregar os artigos do blog.', error);
    loadError = true;
  }

  const bannerPosts = posts.slice(0, 4).map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    image: getMediaUrl(post.image) || '',
    author: post.author_name,
    date: formatDate(post.published_at),
    category: post.category,
    readTime: post.read_time,
  }));
  const pageCount = Math.ceil(count / 9);

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Blog</span>
          </nav>
        </div>
      </div>

      {/* Banner Slider Rotativo */}
      {!search && !category && page === 1 && <BlogBannerSlider posts={bannerPosts} />}

      <div className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Posts */}
          <div className="lg:col-span-3">
            {loadError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                Não foi possível carregar os artigos agora. Tente novamente mais tarde.
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center">
                <h1 className="text-xl font-bold mb-2">Nenhum artigo encontrado</h1>
                <p className="text-sm text-muted-foreground">Experimente alterar a pesquisa ou escolher outra categoria.</p>
                {(search || category) && <Link href="/blog" className="inline-block mt-4 text-sm text-accent hover:underline">Limpar filtros</Link>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {posts.map((post, index) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className={`group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all ${
                        index === 0 ? 'md:col-span-2 md:grid md:grid-cols-2' : ''
                      }`}
                    >
                      <div className={`overflow-hidden ${index === 0 ? 'h-64 md:h-full' : 'h-48'}`}>
                        {post.image && <img src={getMediaUrl(post.image) || post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          {post.category && <span className="px-2 py-1 bg-accent/10 text-accent rounded-full font-medium">{post.category}</span>}
                          <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(post.published_at)}</span>
                          <span className="flex items-center gap-1"><User size={12} />{post.author_name}</span>
                        </div>
                        <h2 className={`font-bold mb-2 group-hover:text-accent transition-colors ${index === 0 ? 'text-2xl' : 'text-lg'}`}>
                          {post.title}
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
                        <p className="text-xs text-muted-foreground mb-4">{post.read_time} de leitura</p>
                        <div className="flex items-center gap-2 text-sm text-accent font-medium">
                          Ler mais <ArrowRight size={14} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {pageCount > 1 && (
                <nav aria-label="Paginação do blog" className="flex justify-between items-center mt-8">
                  {page > 1 ? (
                    <Link href={`/blog?${new URLSearchParams({ search, category, page: String(page - 1) })}`} className="px-4 py-2 border border-border rounded-md hover:bg-muted">Anterior</Link>
                  ) : <span />}
                  <span className="text-sm text-muted-foreground">Página {page} de {pageCount}</span>
                  {page < pageCount ? (
                    <Link href={`/blog?${new URLSearchParams({ search, category, page: String(page + 1) })}`} className="px-4 py-2 border border-border rounded-md hover:bg-muted">Seguinte</Link>
                  ) : <span />}
                </nav>
              )}
            </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-8">
              {/* Search */}
              <div>
                <h3 className="font-bold text-lg mb-4">Pesquisar</h3>
                <form action="/blog" className="relative">
                  <input
                    name="search"
                    type="text"
                    placeholder="Buscar artigos..."
                    defaultValue={search}
                    className="w-full px-4 py-2.5 pr-10 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {category && <input type="hidden" name="category" value={category} />}
                  <button type="submit" aria-label="Pesquisar artigos" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Search size={16} /></button>
                </form>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-bold text-lg mb-4">Categorias</h3>
                <div className="space-y-2">
                  <Link href="/blog" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1">
                    <Tag size={14} />
                    Todas
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat}
                      href={`/blog?${new URLSearchParams({ category: cat, ...(search ? { search } : {}) })}`}
                      aria-current={category === cat ? 'page' : undefined}
                      className={`flex items-center gap-2 text-sm transition-colors w-full text-left py-1 ${category === cat ? 'text-accent font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Tag size={14} />
                      {cat}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Posts */}
              <div>
                <h3 className="font-bold text-lg mb-4">Artigos Recentes</h3>
                <div className="space-y-4">
                  {posts.slice(0, 4).map((post) => (
                    <Link key={post.slug} href={`/blog/${post.slug}`} className="flex gap-3 group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {post.image && <img src={getMediaUrl(post.image) || post.image} alt={post.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium group-hover:text-accent transition-colors line-clamp-2">{post.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(post.published_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Newsletter */}
              <div className="rounded-xl border border-border bg-muted/40 p-5">
                <NewsletterForm source="blog_list" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
