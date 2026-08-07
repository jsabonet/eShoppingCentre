import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Phone, Mail, Shield, Clock, Package, Download, Truck, Monitor, FileText } from 'lucide-react';
import StoreOwnerEditable from '@/src/components/StoreOwnerEditable';
import StoreReviews from '@/src/components/StoreReviews';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

function mediaUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/stores/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Loja não encontrada | eShoppingCentre' };
    const store = await res.json();
    return { title: `${store.name} | eShoppingCentre`, description: store.description };
  } catch { return { title: 'Loja | eShoppingCentre' }; }
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  let store: any = null;
  let storeProducts: any[] = [];

  try {
    const [storeRes, prodRes] = await Promise.all([
      fetch(`${API_URL}/stores/${slug}/`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/products/?store=${slug}&page_size=12`, { next: { revalidate: 60 } }),
    ]);

    if (!storeRes.ok) notFound();
    store = await storeRes.json();
    storeProducts = prodRes.ok ? (await prodRes.json()).results || [] : [];
  } catch { notFound(); }

  const mappedProducts = storeProducts.map((p: any) => ({
    id: p.id, slug: p.slug, name: p.name, description: p.description || '',
    price: parseFloat(p.price), image: p.primary_image || '',
    category: p.category || '', rating: parseFloat(p.rating), reviewCount: p.review_count || 0,
    badge: p.is_on_sale ? 'sale' as const : undefined,
    inStock: p.stock > 0,
    originalPrice: p.compare_price ? parseFloat(p.compare_price) : undefined,
    discount: p.discount_percentage ?? undefined,
    digitalFormat: p.digital_format || '',
    digitalLicense: p.digital_license || '',
  }));

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <Link href="/stores" className="hover:text-foreground transition-colors">Lojas</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">{store.name}</span>
          </nav>
        </div>
      </div>

      {/* Banner & Header — editable by store owner */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-b border-border">
        <StoreOwnerEditable store={{
          id: store.id, name: store.name, slug: store.slug,
          tagline: store.tagline || '', description: store.description || '',
          logo: store.logo, banner: store.banner,
          theme_color: store.theme_color || '#2563eb',
          location: store.location, rating: parseFloat(store.rating || '0'),
          total_products: store.total_products || 0, total_sales: store.total_sales || 0,
          followers_count: store.followers_count || 0,
          product_type: store.product_type || 'physical',
          review_count: store.review_count || 0,
        }} />
      </div>

      {/* Products — Full Width */}
      <div className="max-w-[1500px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Produtos ({mappedProducts.length})</h2>
        </div>

        {mappedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mappedProducts.map((product: any) => (
              <Link key={product.id} href={`/product/${product.slug}`}
                className="bg-card border border-border rounded-xl overflow-hidden group hover:shadow-md transition-all">
                <div className="aspect-square bg-muted overflow-hidden">
                  <img src={mediaUrl(product.image) || 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg'}
                    alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{product.name}</h3>
                  <p className="font-bold text-accent mt-1">{product.price.toLocaleString('pt-MZ')} MZN</p>
                  {product.originalPrice && (
                    <p className="text-xs text-muted-foreground line-through">{product.originalPrice.toLocaleString('pt-MZ')} MZN</p>
                  )}
                  {product.digitalFormat && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                      {product.digitalFormat}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
            <Package size={48} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">Nenhum produto ainda</p>
            <p className="text-sm mt-1">Esta loja ainda nao publicou produtos.</p>
          </div>
        )}
      </div>

      {/* About & Info Section — Cards below products */}
      <div className="max-w-[1500px] mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* About */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-bold text-sm mb-3">Sobre a Loja</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{store.about || store.description}</p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {store.phone && (
                <div className="flex items-center gap-2"><Phone size={14} /> {store.phone}</div>
              )}
              {store.email && (
                <div className="flex items-center gap-2"><Mail size={14} /> {store.email}</div>
              )}
              <div className="flex items-center gap-2">
                <Clock size={14} />
                Membro desde {new Date(store.created_at).toLocaleDateString('pt-MZ', { month: 'long', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-2"><Shield size={14} /> <span className="text-green-600 font-medium">Loja Verificada</span></div>
            </div>
          </div>

          {/* Type-specific card */}
          {store.product_type === 'physical' && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Truck size={15} /> Envio & Devolucoes</h3>
              {store.shipping_policy ? (
                <p className="text-sm text-muted-foreground">{store.shipping_policy}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Consulte a politica de envio e prazos de entrega.</p>
              )}
              {store.return_policy && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-medium mb-1">Devolucoes</p>
                  <p className="text-sm text-muted-foreground">{store.return_policy}</p>
                </div>
              )}
            </div>
          )}

          {store.product_type === 'digital' && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Download size={15} /> Entrega Digital</h3>
              <p className="text-sm text-muted-foreground">
                Apos a confirmacao do pagamento, recebera imediatamente um link para download.
                O acesso ao download estara disponivel conforme a politica de cada produto.
              </p>
              {store.return_policy && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-medium mb-1">Reembolsos</p>
                  <p className="text-sm text-muted-foreground">{store.return_policy}</p>
                </div>
              )}
            </div>
          )}

          {store.product_type === 'course' && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Monitor size={15} /> Cursos Online</h3>
              <p className="text-sm text-muted-foreground">
                Cursos com acesso online. Apos a compra, recebera acesso imediato a plataforma de aprendizagem.
              </p>
            </div>
          )}

          {/* Store type badge card */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-bold text-sm mb-3">Tipo de Loja</h3>
            {store.product_type === 'physical' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                <Truck size={16} /> Produtos Fisicos
              </span>
            ) : store.product_type === 'digital' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                <FileText size={16} /> Produtos Digitais
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                <Monitor size={16} /> Cursos Online
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="max-w-[1500px] mx-auto px-4 pb-12">
        <StoreReviews
          storeSlug={store.slug}
          storeName={store.name}
          storeType={store.product_type || 'physical'}
        />
      </div>
    </>
  );
}
