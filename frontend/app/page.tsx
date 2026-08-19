import BannerSlider from '@/src/components/BannerSlider';
import HomepageShop from '@/src/components/HomepageShop';
import FeaturedStores from '@/src/components/FeaturedStores';
import Link from 'next/link';
import { Truck, Shield, CreditCard, Headphones } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

async function fetchJSON(url: string, revalidate = 60) {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) {
      console.error(`[Home] Falha HTTP ${res.status} ao buscar: ${url}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.error(`[Home] Erro de rede ao buscar ${url}: ${err?.message || err}`);
    return null;
  }
}

const banners = [
  { id: '1', image: 'https://cdn.b12.io/client_media/iKv1biKD/5783f32a-7e6e-11f1-a05c-0242ac110002-gL5f6HGZjVLK9tX7ZtneG.jpg', title: 'Ofertas em Eletrônicos', subtitle: 'Até 30% OFF em smartphones, laptops e acessórios', cta: 'Comprar Agora', link: '/category/eletronicos' },
  { id: '2', image: 'https://cdn.b12.io/client_media/iKv1biKD/573d35e0-7e6e-11f1-a56d-0242ac110002-m84D8GY8ROKweXe5v3qi3.jpg', title: 'Nova Coleção de Moda', subtitle: 'As últimas tendências com preços imperdíveis', cta: 'Ver Coleção', link: '/category/moda' },
  { id: '3', image: 'https://cdn.b12.io/client_media/iKv1biKD/573f0734-7e6e-11f1-8673-0242ac110002-PN8pzNbMQkB30y18CiMkY.jpg', title: 'Transforme seu Lar', subtitle: 'Tudo para casa e jardim com frete grátis', cta: 'Explorar', link: '/category/casa-jardim' },
];

interface APICategory { id: string; name: string; slug: string; description: string; image: string | null; }
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
    storeName: p.store_name || undefined,
    storeSlug: p.store_slug || undefined,
    salesCount: p.sales_count ?? undefined,
    productType: (p.product_type as 'physical' | 'digital' | 'course') || 'physical',
  };
}

export default async function Home() {
  let categories: APICategory[] = [];
  let featuredStores: any[] = [];
  let homeSections: any = { deals: [], bestsellers: [], new_arrivals: [], featured: [] };

  const [catsData, storesData, sectionsData] = await Promise.all([
    fetchJSON(`${API_URL}/categories/?root=true&with_image=true`),
    fetchJSON(`${API_URL}/stores/featured/`),
    fetchJSON(`${API_URL}/products/home-sections/`),
  ]);

  categories = Array.isArray(catsData) ? catsData : (catsData?.results || []);
  featuredStores = Array.isArray(storesData) ? storesData : [];
  homeSections = sectionsData || { deals: [], bestsellers: [], new_arrivals: [], featured: [] };

  const deals = (homeSections.deals || []).map(apiProductToCard);
  const bestsellers = (homeSections.bestsellers || []).map(apiProductToCard);
  const newArrivals = (homeSections.new_arrivals || []).map(apiProductToCard);
  const featured = (homeSections.featured || []).map(apiProductToCard);

  const shopSections = [
    {
      id: 'ofertas', title: 'Ofertas do Dia', titleIcon: '⚡',
      products: deals,
      viewAllLink: '/#ofertas', viewAllLabel: 'Ver todas →', bgClass: 'bg-accent/5',
    },
    {
      id: 'mais-vendidos', title: 'Mais Vendidos', titleIcon: '🔥',
      products: bestsellers,
      bgClass: '',
    },
    {
      id: 'novidades', title: 'Novidades', titleIcon: '✨',
      products: newArrivals,
      bgClass: '',
    },
    {
      id: 'destaques', title: 'Produtos em Destaque', titleIcon: '⭐',
      products: featured.length > 0 ? featured : bestsellers,
      viewAllLink: '/#destaques', viewAllLabel: 'Ver mais →', bgClass: 'bg-accent/5',
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
              <div><p className="font-semibold text-sm">Pagamento Seguro</p><p className="text-xs text-muted-foreground">Diversas formas de pagamento</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><Headphones size={24} className="text-foreground" /></div>
              <div><p className="font-semibold text-sm">Suporte Dedicado</p><p className="text-xs text-muted-foreground">Atendimento em português</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="py-12 px-4 max-w-[1500px] mx-auto">
        <h2 className="text-2xl font-bold mb-6">Compre por Categoria</h2>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-4 lg:grid-cols-8 md:overflow-visible">
          {categories.length > 0 ? categories.slice(0, 12).map((cat) => (
            <Link key={cat.slug} href={'/category/' + cat.slug}
              className="category-card shrink-0 w-[120px] md:w-auto group bg-card border border-border rounded-lg p-4 text-center hover:shadow-md transition-all">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{cat.name.charAt(0)}</span>
                )}
              </div>
              <h3 className="font-semibold text-sm">{cat.name}</h3>
            </Link>
          )) : (
            <div className="w-full col-span-full text-center py-8 text-muted-foreground">
              Categorias indisponíveis no momento.
            </div>
          )}
        </div>
      </section>

      <FeaturedStores stores={featuredStores} />

      <HomepageShop sections={shopSections} />
    </main>
  );
}