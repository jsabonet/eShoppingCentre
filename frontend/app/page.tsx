import BannerSlider from '@/src/components/BannerSlider';
import HomepageShop from '@/src/components/HomepageShop';
import Link from 'next/link';
import { Truck, Shield, CreditCard, Headphones } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const banners = [
  { id: '1', image: 'https://cdn.b12.io/client_media/iKv1biKD/5783f32a-7e6e-11f1-a05c-0242ac110002-gL5f6HGZjVLK9tX7ZtneG.jpg', title: 'Ofertas em Eletrônicos', subtitle: 'Até 30% OFF em smartphones, laptops e acessórios', cta: 'Comprar Agora', link: '/category/eletronicos' },
  { id: '2', image: 'https://cdn.b12.io/client_media/iKv1biKD/573d35e0-7e6e-11f1-a56d-0242ac110002-m84D8GY8ROKweXe5v3qi3.jpg', title: 'Nova Coleção de Moda', subtitle: 'As últimas tendências com preços imperdíveis', cta: 'Ver Coleção', link: '/category/moda' },
  { id: '3', image: 'https://cdn.b12.io/client_media/iKv1biKD/573f0734-7e6e-11f1-8673-0242ac110002-PN8pzNbMQkB30y18CiMkY.jpg', title: 'Transforme seu Lar', subtitle: 'Tudo para casa e jardim com frete grátis', cta: 'Explorar', link: '/category/casa-jardim' },
];

interface APICategory { id: string; name: string; slug: string; description: string; image: string | null; product_count: number; }
interface APIProduct { id: string; name: string; slug: string; price: string; compare_price: string | null; discount_percentage: number | null; primary_image: string | null; product_type: string; rating: string; review_count: number; sales_count: number; is_on_sale: boolean; stock: number; store_name: string; store_slug: string; created_at: string; }

function apiProductToCard(p: APIProduct) {
  return {
    id: p.id, slug: p.slug, name: p.name, description: '', price: parseFloat(p.price),
    image: p.primary_image || 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg',
    category: '', rating: parseFloat(p.rating), reviewCount: p.review_count,
    badge: (p.is_on_sale ? 'sale' : undefined) as 'sale' | 'new' | undefined,
    inStock: p.stock > 0,
    originalPrice: p.compare_price ? parseFloat(p.compare_price) : undefined,
    discount: p.discount_percentage ?? undefined,
  };
}

export default async function Home() {
  let categories: APICategory[] = [];
  let featuredProducts: APIProduct[] = [];
  let saleProducts: APIProduct[] = [];
  let categoryProducts: Record<string, APIProduct[]> = {};

  try {
    const [catsRes, featuredRes, saleRes] = await Promise.all([
      fetch(`${API_URL}/categories/`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/products/?is_featured=true&page_size=10`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/products/?is_on_sale=true&page_size=10`, { next: { revalidate: 60 } }),
    ]);
    const catsJson = await catsRes.json();
    categories = Array.isArray(catsJson) ? catsJson : (catsJson.results || []);
    featuredProducts = featuredRes.ok ? (await featuredRes.json()).results : [];
    saleProducts = saleRes.ok ? (await saleRes.json()).results : [];
  } catch { console.error('API offline, using empty data'); }

  const shopSections = [
    {
      id: 'ofertas', title: 'Ofertas do Dia', titleIcon: '⚡',
      products: saleProducts.slice(0, 10).map(apiProductToCard),
      viewAllLink: '/#ofertas', viewAllLabel: 'Ver todas →', bgClass: 'bg-accent/5',
    },
    {
      id: 'destaques', title: 'Produtos em Destaque',
      products: (featuredProducts.length > 0 ? featuredProducts : saleProducts).slice(0, 10).map(apiProductToCard),
      viewAllLink: '/#destaques', viewAllLabel: 'Ver mais →', bgClass: '',
    },
  ];

  return (
    <main>
      <section id="hero">
        <BannerSlider banners={banners} />
      </section>

      <section className="bg-card border-y border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><Truck size={24} className="text-foreground" /></div>
              <div><p className="font-semibold text-sm">Frete Grátis</p><p className="text-xs text-muted-foreground">Em compras acima de 199 MZN</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><Shield size={24} className="text-foreground" /></div>
              <div><p className="font-semibold text-sm">Compra Segura</p><p className="text-xs text-muted-foreground">Proteção garantida</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><CreditCard size={24} className="text-foreground" /></div>
              <div><p className="font-semibold text-sm">Parcele em 12x</p><p className="text-xs text-muted-foreground">Sem juros no cartão</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><Headphones size={24} className="text-foreground" /></div>
              <div><p className="font-semibold text-sm">Atendimento 24h</p><p className="text-xs text-muted-foreground">Suporte dedicado</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="py-12 px-4 max-w-[1500px] mx-auto">
        <h2 className="text-2xl font-bold mb-6">Compre por Categoria</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {categories.length > 0 ? categories.map((cat) => (
            <Link key={cat.slug} href={'/category/' + cat.slug}
              className="category-card group bg-card border border-border rounded-lg p-4 text-center hover:shadow-md hover:border-accent transition-all">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{cat.name.charAt(0)}</span>
                )}
              </div>
              <h3 className="font-semibold text-sm">{cat.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{cat.product_count} produtos</p>
            </Link>
          )) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              Categorias indisponíveis no momento.
            </div>
          )}
        </div>
      </section>

      <HomepageShop sections={shopSections} />
    </main>
  );
}