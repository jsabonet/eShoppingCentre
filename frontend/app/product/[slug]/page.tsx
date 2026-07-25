import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import ProductDetailShop from '@/src/components/ProductDetailShop';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface ProductPageProps { params: Promise<{ slug: string }>; }

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/products/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Produto não encontrado | eShoppingCentre' };
    const product = await res.json();
    return { title: `${product.name} | eShoppingCentre`, description: product.description };
  } catch { return { title: 'Produto | eShoppingCentre' }; }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  let product: any = null;
  let relatedProducts: any[] = [];

  try {
    const res = await fetch(`${API_URL}/products/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) { notFound(); }
    product = await res.json();

    // Related products
    if (product.category_slug) {
      const relRes = await fetch(`${API_URL}/products/?category=${product.category_slug}&page_size=8`, { next: { revalidate: 60 } });
      if (relRes.ok) {
        const relData = await relRes.json();
        relatedProducts = relData.results.filter((p: any) => p.slug !== slug)
          .map((p: any) => ({ id: p.id, slug: p.slug, name: p.name, description: '', price: parseFloat(p.price), image: p.primary_image || '', category: product.category_slug || '', rating: parseFloat(p.rating), reviewCount: p.review_count, badge: p.is_on_sale ? 'sale' as const : undefined, inStock: p.stock > 0, originalPrice: p.compare_price ? parseFloat(p.compare_price) : undefined, discount: p.discount_percentage ?? undefined }));
      }
    }
  } catch { notFound(); }

  const mappedProduct = {
    id: product.id, slug: product.slug, name: product.name,
    description: product.description, price: parseFloat(product.price),
    image: product.images?.[0]?.image || '',
    category: product.category_slug || '', rating: parseFloat(product.rating), reviewCount: product.review_count || 0,
    badge: product.is_on_sale ? 'sale' as const : undefined,
    inStock: product.stock > 0,
    originalPrice: product.compare_price ? parseFloat(product.compare_price) : undefined,
    discount: product.discount_percentage ?? undefined,
  };

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            {product.category_name && (
              <>
                <Link href={`/category/${product.category_slug}`} className="hover:text-foreground transition-colors">{product.category_name}</Link>
                <ChevronRight size={14} />
              </>
            )}
            <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
          </nav>
        </div>
      </div>
      <ProductDetailShop product={mappedProduct} categoryName={product.category_name} categorySlug={product.category_slug} relatedProducts={relatedProducts} />
    </>
  );
}
