import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Phone, Mail, Shield, Clock, Package, Download, Truck, Monitor, FileText } from 'lucide-react';
import StoreOwnerEditable from '@/src/components/StoreOwnerEditable';

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
        }} />
      </div>

      {/* Info + Products */}
      <div className="max-w-[1500px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-bold mb-3">Sobre a Loja</h3>
              <p className="text-sm text-muted-foreground">{store.about || store.description}</p>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="font-bold">Informações</h3>

              {/* Store type badge */}
              <div className="flex items-center gap-2 text-sm">
                {store.product_type === 'physical' ? (
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                    <Truck size={13} /> Produtos Físicos
                  </span>
                ) : store.product_type === 'digital' ? (
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                    <Download size={13} /> Download Imediato
                  </span>
                ) : store.product_type === 'course' ? (
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">
                    <Monitor size={13} /> Cursos Online
                  </span>
                ) : null}
              </div>

              {store.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone size={14} /> <span>{store.phone}</span>
                </div>
              )}
              {store.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail size={14} /> <span className="truncate">{store.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} /> <span>Desde {new Date(store.created_at).toLocaleDateString('pt-MZ', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield size={14} /> <span className="text-green-600 font-medium">Loja Verificada</span>
              </div>
            </div>

            {store.product_type === 'physical' && store.shipping_policy && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold mb-2 flex items-center gap-2"><Truck size={15} /> Política de Envio</h3>
                <p className="text-sm text-muted-foreground">{store.shipping_policy}</p>
              </div>
            )}

            {store.product_type === 'physical' && store.return_policy && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold mb-2">Devoluções</h3>
                <p className="text-sm text-muted-foreground">{store.return_policy}</p>
              </div>
            )}

            {store.product_type === 'digital' && store.return_policy && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold mb-2 flex items-center gap-2"><Shield size={15} /> Política de Reembolso</h3>
                <p className="text-sm text-muted-foreground">{store.return_policy}</p>
              </div>
            )}

            {store.product_type === 'digital' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-bold mb-2 flex items-center gap-2"><FileText size={15} /> Entrega Digital</h3>
                <p className="text-sm text-muted-foreground">
                  Após a confirmação do pagamento, receberá imediatamente um link para download do produto.
                  O acesso ao download estará disponível conforme a política de cada produto.
                </p>
              </div>
            )}
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4">Produtos da Loja</h2>
            {mappedProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
                <Package size={40} className="mx-auto mb-3 opacity-30" />
                <p>Esta loja ainda não tem produtos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
