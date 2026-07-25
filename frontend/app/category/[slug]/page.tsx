import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import CategoryShopClient from '@/src/components/CategoryShopClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/categories/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Categoria não encontrada | eShoppingCentre' };
    const cat = await res.json();
    return { title: `${cat.name} | eShoppingCentre`, description: cat.description };
  } catch { return { title: 'Categoria | eShoppingCentre' }; }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  let category: any = null;
  let products: any[] = [];

  try {
    const [catRes, prodRes] = await Promise.all([
      fetch(`${API_URL}/categories/${slug}/`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/products/?category=${slug}&page_size=50`, { next: { revalidate: 60 } }),
    ]);
    if (!catRes.ok) notFound();
    category = await catRes.json();
    products = prodRes.ok ? (await prodRes.json()).results : [];
  } catch { notFound(); }

  const mappedProducts = products.map((p: any) => ({
    id: p.id, slug: p.slug, name: p.name, description: '',
    price: parseFloat(p.price), image: p.primary_image || '',
    category: slug, rating: parseFloat(p.rating), reviewCount: p.review_count,
    badge: p.is_on_sale ? 'sale' as const : undefined,
    inStock: p.stock > 0,
    originalPrice: p.compare_price ? parseFloat(p.compare_price) : undefined,
    discount: p.discount_percentage ?? undefined,
  }));

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">{category.name}</span>
          </nav>
        </div>
      </div>
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{category.name}</h1>
          <p className="text-muted-foreground text-lg">{category.description}</p>
          <p className="text-sm text-muted-foreground mt-1"><span className="font-semibold text-foreground">{category.product_count}</span> produtos disponíveis</p>
        </div>
      </div>
      <CategoryShopClient products={mappedProducts} categoryName={category.name} />
    </>
  );
}
