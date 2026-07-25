import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Calendar, User, Tag, ArrowRight } from 'lucide-react';
import BlogBannerSlider from '@/src/components/BlogBannerSlider';

export const metadata: Metadata = {
  title: 'Blog | eShoppingCentre',
  description: 'Fique por dentro das novidades, dicas e tendências do mundo das compras online.',
};

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  author: string;
  date: string;
  category: string;
  readTime: string;
}

const blogPosts: BlogPost[] = [
  {
    slug: 'como-escolher-o-smartphone-ideal',
    title: 'Como Escolher o Smartphone Ideal em 2026',
    excerpt: 'Guia completo para escolher o smartphone perfeito para o seu dia a dia, desde o orçamento até as especificações técnicas mais importantes.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg',
    author: 'Maria Santos',
    date: '15 Julho, 2026',
    category: 'Tecnologia',
    readTime: '5 min',
  },
  {
    slug: 'tendencias-moda-2026',
    title: 'Tendências de Moda para o Inverno 2026',
    excerpt: 'Descubra as principais tendências da estação e como montar looks incríveis sem gastar muito.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573236fc-7e6e-11f1-b28a-0242ac110002-Mx9rZvBhnQsQIHRgeCPAG.jpg',
    author: 'Ana Mondlane',
    date: '10 Julho, 2026',
    category: 'Moda',
    readTime: '4 min',
  },
  {
    slug: 'dicas-decoracao-casa-jardim',
    title: '10 Dicas para Decorar a Sua Casa Sem Gastar Muito',
    excerpt: 'Ideias criativas e acessíveis para transformar a sua casa com pequenas mudanças que fazem toda a diferença.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/56e3e86a-7e6e-11f1-9b16-0242ac110002-lV9iFfIRaKz-QW2YWUhD6.jpg',
    author: 'Carlos Macamo',
    date: '5 Julho, 2026',
    category: 'Casa & Jardim',
    readTime: '6 min',
  },
  {
    slug: 'cuidados-pele-verao',
    title: 'Guia de Cuidados com a Pele no Verão',
    excerpt: 'Saiba como proteger e cuidar da sua pele durante os dias mais quentes do ano com produtos essenciais.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b3d4eeb-7e6e-11f1-a4fd-0242ac110002-Laj5wp2staB6CEmJSAMHj.jpg',
    author: 'Dra. Joana Silva',
    date: '28 Junho, 2026',
    category: 'Saúde & Beleza',
    readTime: '7 min',
  },
  {
    slug: 'compras-online-seguras-mocambique',
    title: 'Como Fazer Compras Online Seguras em Moçambique',
    excerpt: 'Dicas essenciais para garantir uma experiência de compra online segura e tranquila no eShoppingCentre.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5783f32a-7e6e-11f1-a05c-0242ac110002-gL5f6HGZjVLK9tX7ZtneG.jpg',
    author: 'Equipa eShoppingCentre',
    date: '20 Junho, 2026',
    category: 'Segurança',
    readTime: '4 min',
  },
  {
    slug: 'presentes-dia-dos-pais',
    title: 'O Guia Definitivo de Presentes para o Dia dos Pais',
    excerpt: 'De eletrônicos a moda, encontre o presente perfeito para celebrar o Dia dos Pais com estilo.',
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg',
    author: 'Maria Santos',
    date: '15 Junho, 2026',
    category: 'Dicas',
    readTime: '5 min',
  },
];

const CATEGORIES = ['Tecnologia', 'Moda', 'Casa & Jardim', 'Saúde & Beleza', 'Segurança', 'Dicas'];

export default function BlogPage() {
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
      <BlogBannerSlider posts={blogPosts} />

      <div className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Posts */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {blogPosts.map((post, index) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className={`group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all ${
                    index === 0 ? 'md:col-span-2 md:grid md:grid-cols-2' : ''
                  }`}
                >
                  <div className={`overflow-hidden ${index === 0 ? 'h-64 md:h-full' : 'h-48'}`}>
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span className="px-2 py-1 bg-accent/10 text-accent rounded-full font-medium">{post.category}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} />{post.date}</span>
                      <span className="flex items-center gap-1"><User size={12} />{post.author}</span>
                    </div>
                    <h2 className={`font-bold mb-2 group-hover:text-accent transition-colors ${index === 0 ? 'text-2xl' : 'text-lg'}`}>
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
                    <div className="flex items-center gap-2 text-sm text-accent font-medium">
                      Ler mais <ArrowRight size={14} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-8">
              {/* Search */}
              <div>
                <h3 className="font-bold text-lg mb-4">Pesquisar</h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar artigos..."
                    className="w-full px-4 py-2.5 pr-10 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">🔍</button>
                </div>
              </div>

              {/* Categories */}
              <div>
                <h3 className="font-bold text-lg mb-4">Categorias</h3>
                <div className="space-y-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1"
                    >
                      <Tag size={14} />
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Posts */}
              <div>
                <h3 className="font-bold text-lg mb-4">Artigos Recentes</h3>
                <div className="space-y-4">
                  {blogPosts.slice(0, 4).map((post) => (
                    <Link key={post.slug} href={`/blog/${post.slug}`} className="flex gap-3 group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium group-hover:text-accent transition-colors line-clamp-2">{post.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{post.date}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Newsletter */}
              <div className="bg-gradient-to-br from-accent/10 to-primary/5 p-6 rounded-xl border border-accent/20">
                <h3 className="font-bold text-lg mb-2">Newsletter</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Receba dicas e ofertas exclusivas no seu email.
                </p>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background mb-2 focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 transition-colors">
                  Inscrever
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
