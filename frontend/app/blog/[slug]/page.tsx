import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Calendar, User, Tag, ArrowLeft, Facebook, Twitter, Share2 } from 'lucide-react';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

const blogPosts = [
  {
    slug: 'como-escolher-o-smartphone-ideal',
    title: 'Como Escolher o Smartphone Ideal em 2026',
    excerpt: 'Guia completo para escolher o smartphone perfeito.',
    content: `
      <p>Escolher o smartphone ideal pode ser uma tarefa desafiadora com tantas opções disponíveis no mercado. Neste guia, vamos ajudar você a tomar a melhor decisão.</p>
      
      <h2>1. Defina seu Orçamento</h2>
      <p>O primeiro passo é definir quanto você está disposto a investir. Os smartphones variam desde opções de entrada até modelos premium com preços mais elevados.</p>
      
      <h2>2. Sistema Operacional</h2>
      <p>Android ou iOS? Cada um tem suas vantagens. O Android oferece mais variedade e personalização, enquanto o iOS se destaca pela integração e segurança.</p>
      
      <h2>3. Especificações Técnicas</h2>
      <p>Processador, RAM, armazenamento e bateria são cruciais. Para uso diário, 4GB de RAM e 128GB de armazenamento são suficientes. Para jogos e multitarefa, considere 8GB+.</p>
      
      <h2>4. Câmera</h2>
      <p>Se a fotografia é importante, procure por sensores de alta resolução, abertura de lente ampla e estabilização óptica.</p>
      
      <h2>5. Bateria</h2>
      <p>Uma bateria de 4000mAh a 5000mAh garante um dia inteiro de uso moderado. Carregamento rápido e sem fio são diferenciais importantes.</p>
      
      <p>No e-Shopping Centre, você encontra as melhores marcas com preços imperdíveis e garantia de qualidade.</p>
    `,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg',
    author: 'Maria Santos',
    date: '15 Julho, 2026',
    category: 'Tecnologia',
    readTime: '5 min',
  },
  {
    slug: 'tendencias-moda-2026',
    title: 'Tendências de Moda para o Inverno 2026',
    excerpt: 'Descubra as principais tendências da estação.',
    content: `
      <p>O inverno 2026 traz uma combinação de conforto e estilo. Confira as principais tendências que vão dominar a estação.</p>
      
      <h2>Cores da Estação</h2>
      <p>Tons terrosos, verde musgo, bordô e cinza dominam as passarelas. O preto clássico continua sendo a base de qualquer guarda-roupa.</p>
      
      <h2>Tecidos e Texturas</h2>
      <p>Lã, cashmere, veludo e couro são os protagonistas. Aposte em peças com texturas interessantes para dar profundidade ao look.</p>
      
      <h2>Peças-Chave</h2>
      <p>Blazers oversized, botas over the knee, cachecóis grossos e casacos estruturados são investimentos certeiros para a estação.</p>
      
      <h2>Camadas</h2>
      <p>O segredo do inverno está nas camadas. Combine peças leves com pesadas para criar looks versáteis e elegantes.</p>
      
      <p>Renove seu guarda-roupa no e-Shopping Centre com as melhores marcas e preços imperdíveis.</p>
    `,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/573236fc-7e6e-11f1-b28a-0242ac110002-Mx9rZvBhnQsQIHRgeCPAG.jpg',
    author: 'Ana Mondlane',
    date: '10 Julho, 2026',
    category: 'Moda',
    readTime: '4 min',
  },
  {
    slug: 'dicas-decoracao-casa-jardim',
    title: '10 Dicas para Decorar a Sua Casa Sem Gastar Muito',
    excerpt: 'Ideias criativas e acessíveis para transformar a sua casa.',
    content: `
      <p>Decorar a casa não precisa ser caro. Com criatividade e algumas dicas, você pode transformar qualquer ambiente.</p>
      
      <h2>1. Paredes com Personalidade</h2>
      <p>Uma parede pintada com uma cor vibrante ou papel de parede pode mudar completamente um ambiente sem grandes investimentos.</p>
      
      <h2>2. Plantas e Vasos</h2>
      <p>Plantas trazem vida e frescor. Escolha espécies fáceis de cuidar como suculentas, zamioculcas ou costela-de-adão.</p>
      
      <h2>3. Iluminação Estratégica</h2>
      <p>Luminárias e abajures criam pontos de luz aconchegantes. Aposte em luz amarela para ambientes mais acolhedores.</p>
      
      <h2>4. Almofadas e Mantas</h2>
      <p>Têxteis são fáceis de trocar e renovam o visual do sofá ou da cama instantaneamente.</p>
      
      <h2>5. Espelhos</h2>
      <p>Espelhos ampliam o espaço e refletem a luz natural. São funcionais e decorativos ao mesmo tempo.</p>
      
      <p>Encontre tudo para sua casa no e-Shopping Centre!</p>
    `,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/56e3e86a-7e6e-11f1-9b16-0242ac110002-lV9iFfIRaKz-QW2YWUhD6.jpg',
    author: 'Carlos Macamo',
    date: '5 Julho, 2026',
    category: 'Casa & Jardim',
    readTime: '6 min',
  },
  {
    slug: 'cuidados-pele-verao',
    title: 'Guia de Cuidados com a Pele no Verão',
    excerpt: 'Saiba como proteger e cuidar da sua pele.',
    content: `
      <p>O verão exige cuidados especiais com a pele. O calor, o suor e a exposição solar podem causar danos se não houver a proteção adequada.</p>
      
      <h2>Protetor Solar é Essencial</h2>
      <p>Use protetor solar diariamente, mesmo em dias nublados. FPS 30 é o mínimo recomendado, reaplicando a cada 2 horas.</p>
      
      <h2>Hidratação</h2>
      <p>No verão, a pele perde mais água. Use hidratantes leves e beba bastante água ao longo do dia.</p>
      
      <h2>Limpeza Adequada</h2>
      <p>Lave o rosto duas vezes ao dia com produtos suaves para remover o excesso de oleosidade e impurezas.</p>
      
      <h2>Alimentação</h2>
      <p>Alimentos ricos em antioxidantes como frutas vermelhas, tomate e cenoura ajudam a proteger a pele de dentro para fora.</p>
      
      <p>No e-Shopping Centre, você encontra os melhores produtos de skincare para todas as estações.</p>
    `,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b3d4eeb-7e6e-11f1-a4fd-0242ac110002-Laj5wp2staB6CEmJSAMHj.jpg',
    author: 'Dra. Joana Silva',
    date: '28 Junho, 2026',
    category: 'Saúde & Beleza',
    readTime: '7 min',
  },
  {
    slug: 'compras-online-seguras-mocambique',
    title: 'Como Fazer Compras Online Seguras em Moçambique',
    excerpt: 'Dicas essenciais para compras online seguras.',
    content: `
      <p>Comprar online é prático e seguro quando se toma os devidos cuidados. Confira nossas dicas para uma experiência tranquila.</p>
      
      <h2>Escolha Plataformas Confiáveis</h2>
      <p>Opte por marketplaces conhecidos como o e-Shopping Centre, que oferecem proteção ao comprador e suporte dedicado.</p>
      
      <h2>Verifique a Reputação do Vendedor</h2>
      <p>Leia avaliações de outros compradores e verifique a classificação do vendedor antes de finalizar a compra.</p>
      
      <h2>Métodos de Pagamento Seguros</h2>
      <p>Use M-Pesa, e-Mola ou cartão de crédito em ambientes seguros (https). Evite transferências bancárias diretas para desconhecidos.</p>
      
      <h2>Guarde Comprovantes</h2>
      <p>Sempre tire screenshots da confirmação do pedido e guarde os emails de confirmação.</p>
      
      <h2>Desconfie de Ofertas Milagrosas</h2>
      <p>Se o preço é muito abaixo do mercado, desconfie. Compare preços e leia a descrição do produto com atenção.</p>
      
      <p>No e-Shopping Centre, sua segurança é nossa prioridade. Compre com confiança!</p>
    `,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5783f32a-7e6e-11f1-a05c-0242ac110002-gL5f6HGZjVLK9tX7ZtneG.jpg',
    author: 'Equipa e-Shopping Centre',
    date: '20 Junho, 2026',
    category: 'Segurança',
    readTime: '4 min',
  },
  {
    slug: 'presentes-dia-dos-pais',
    title: 'O Guia Definitivo de Presentes para o Dia dos Pais',
    excerpt: 'Encontre o presente perfeito.',
    content: `
      <p>O Dia dos Pais está chegando e você ainda não sabe o que dar? Preparamos um guia com ideias para todos os estilos e orçamentos.</p>
      
      <h2>Para o Pai Tech</h2>
      <p>Smartphones, smartwatches, fones Bluetooth ou tablets são presentes que todo pai tech vai adorar.</p>
      
      <h2>Para o Pai Elegante</h2>
      <p>Relógios, perfumes, carteiras de couro ou uma camisa nova são opções clássicas e infalíveis.</p>
      
      <h2>Para o Pai Esportista</h2>
      <p>Tênis de corrida, roupas esportivas, acessórios fitness ou uma garrafa térmica de qualidade.</p>
      
      <h2>Para o Pai Gourmet</h2>
      <p>Utensílios de cozinha, kits de churrasco, cafeteiras ou uma cesta de vinhos especiais.</p>
      
      <h2>Presentes Personalizados</h2>
      <p>Canecas, camisetas ou quadros personalizados mostram carinho e atenção aos detalhes.</p>
      
      <p>No e-Shopping Centre, você encontra o presente ideal para o seu pai com frete grátis para todo Moçambique!</p>
    `,
    image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg',
    author: 'Maria Santos',
    date: '15 Junho, 2026',
    category: 'Dicas',
    readTime: '5 min',
  },
];

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return { title: 'Post não encontrado | e-Shopping Centre' };
  return {
    title: `${post.title} | Blog e-Shopping Centre`,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    notFound();
  }

  const recentPosts = blogPosts.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <>
      {/* Breadcrumb */}
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
          {/* Main Content */}
          <article className="lg:col-span-3">
            <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft size={16} />
              Voltar ao Blog
            </Link>

            <div className="h-80 md:h-96 rounded-xl overflow-hidden mb-8">
              <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
              <span className="px-3 py-1 bg-accent/10 text-accent rounded-full font-medium text-xs">{post.category}</span>
              <span className="flex items-center gap-1"><Calendar size={14} />{post.date}</span>
              <span className="flex items-center gap-1"><User size={14} />{post.author}</span>
              <span className="flex items-center gap-1">📖 {post.readTime} de leitura</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-6">{post.title}</h1>

            <div
              className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-accent prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Share */}
            <div className="mt-10 pt-8 border-t border-border">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold">Partilhar:</span>
                <button className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
                  <Facebook size={16} />
                </button>
                <button className="p-2 bg-sky-500 text-white rounded-full hover:bg-sky-600 transition-colors">
                  <Twitter size={16} />
                </button>
                <button className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors">
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-32 space-y-8">
              <div>
                <h3 className="font-bold text-lg mb-4">Artigos Recentes</h3>
                <div className="space-y-4">
                  {recentPosts.map((rp) => (
                    <Link key={rp.slug} href={`/blog/${rp.slug}`} className="flex gap-3 group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img src={rp.image} alt={rp.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium group-hover:text-accent transition-colors line-clamp-2">{rp.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{rp.date}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-accent/10 to-primary/5 p-6 rounded-xl border border-accent/20">
                <h3 className="font-bold text-lg mb-2">Newsletter</h3>
                <p className="text-sm text-muted-foreground mb-4">Receba dicas e ofertas exclusivas.</p>
                <input type="email" placeholder="seu@email.com" className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background mb-2 focus:outline-none focus:ring-2 focus:ring-ring" />
                <button className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 transition-colors">Inscrever</button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
