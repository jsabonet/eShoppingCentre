import type { Product } from '../data/marketplace';

const FALLBACK_IMG =
  'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg';

/**
 * Converte um produto vindo da API (DRF) para o tipo usado pelos cards.
 * Aceita `any` porque o JSON pode trazer decimais/numéricos como string.
 */
export function mapProduct(p: any): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description || '',
    price: Number(p.price) || 0,
    image: p.primary_image || FALLBACK_IMG,
    category: p.category || '',
    rating: Number(p.rating) || 0,
    reviewCount: p.review_count || 0,
    badge: p.is_on_sale ? 'sale' : undefined,
    inStock: (p.stock ?? 0) > 0,
    originalPrice: p.compare_price ? Number(p.compare_price) : undefined,
    discount: p.discount_percentage ?? undefined,
    storeName: p.store_name || undefined,
    storeSlug: p.store_slug || undefined,
    salesCount: p.sales_count ?? undefined,
    productType: p.product_type || 'physical',
  };
}
