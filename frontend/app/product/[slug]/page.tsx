import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import ProductDetailShop from '@/src/components/ProductDetailShop';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

function mediaUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

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
  let courseCurriculum: any[] | undefined = undefined;

  try {
    const res = await fetch(`${API_URL}/products/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) { notFound(); }
    product = await res.json();

    // For course products, fetch curriculum (modules + lessons)
    if (product.product_type === 'course' && product.course?.course_id) {
      try {
        const currRes = await fetch(`${API_URL}/courses/${product.course.course_id}/builder/`, { next: { revalidate: 120 } });
        if (currRes.ok) {
          const currData = await currRes.json();
          courseCurriculum = (currData.modules || []).map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description || '',
            sort_order: m.sort_order,
            lessons: (m.lessons || []).map((l: any) => ({
              id: l.id,
              title: l.title,
              duration: l.duration || '',
              is_free_preview: l.is_free_preview || false,
              sort_order: l.sort_order,
            })),
          }));
        }
      } catch {}
    }

    // Related products
    if (product.category_slug) {
      const relRes = await fetch(`${API_URL}/products/?category=${product.category_slug}&page_size=8`, { next: { revalidate: 60 } });
      if (relRes.ok) {
        const relData = await relRes.json();
        relatedProducts = relData.results.filter((p: any) => p.slug !== slug)
          .map((p: any) => ({ id: p.id, slug: p.slug, name: p.name, description: '', price: parseFloat(p.price), image: mediaUrl(p.primary_image), category: product.category_slug || '', rating: parseFloat(p.rating), reviewCount: p.review_count, badge: p.is_on_sale ? 'sale' as const : undefined, inStock: p.product_type === 'digital' || p.product_type === 'course' ? true : p.stock > 0, originalPrice: p.compare_price ? parseFloat(p.compare_price) : undefined, discount: p.discount_percentage ?? undefined }));
      }
    }
  } catch { notFound(); }

  const mappedProduct = {
    id: product.id, slug: product.slug, name: product.name,
    description: product.description,
    shortDescription: product.short_description || '',
    price: parseFloat(product.price),
    image: product.images?.[0]?.image ? mediaUrl(product.images[0].image) : (product.primary_image ? mediaUrl(product.primary_image) : ''),
    images: (product.images || []).map((img: any) => mediaUrl(img.image)),
    category: product.category_slug || '', rating: parseFloat(product.rating), reviewCount: product.review_count || 0,
    badge: product.is_on_sale ? 'sale' as const : undefined,
    inStock: product.product_type === 'digital' || product.product_type === 'course' ? true : (product.stock > 0 || (product.variants?.length > 0)),
    originalPrice: product.compare_price ? parseFloat(product.compare_price) : undefined,
    discount: product.discount_percentage ?? undefined,
    brand: product.brand || '',
    condition: product.condition || 'new',
    warrantyDays: product.warranty_days || 0,
    videoUrl: product.video_url || '',
    sku: product.sku || '',
    barcode: product.barcode || '',
    weight: product.weight != null ? String(product.weight) : '',
    height: product.height != null ? String(product.height) : '',
    width: product.width != null ? String(product.width) : '',
    length: product.length != null ? String(product.length) : '',
    tags: product.tags || [],
    specifications: product.specifications || {},
    salesCount: product.sales_count || 0,
    storeName: product.store?.name || '',
    storeSlug: product.store?.slug || '',
    productType: product.product_type || 'physical',
    digitalFormat: product.digital_format || '',
    digitalVersion: product.digital_version || '',
    digitalLicense: product.digital_license || '',
    digitalCompatibility: product.digital_compatibility || '',
    digitalFileSize: product.digital_file_size || '',
    downloadLimit: product.download_limit ?? 3,
    downloadExpiryDays: product.download_expiry_days ?? 365,
    course: product.course ? { ...product.course, curriculum: courseCurriculum } : undefined,
    variants: (product.variants || []).map((v: any) => ({
      id: v.id, name: v.name, sku: v.sku || '',
      price: v.price != null ? parseFloat(v.price) : null,
      stock: v.stock, image: v.image_url ? mediaUrl(v.image_url) : (v.image ? mediaUrl(v.image) : null),
      attributes: v.attributes || {}, is_active: v.is_active,
    })),
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
