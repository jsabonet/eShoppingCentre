import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import CategoryProducts from '@/src/components/CategoryProducts';
import { mapProduct } from '@/src/lib/productMapping';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/categories/${slug}/`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Categoria não encontrada | e-Shopping Centre' };
    const cat = await res.json();
    return { title: `${cat.name} | e-Shopping Centre`, description: cat.description };
  } catch { return { title: 'Categoria | e-Shopping Centre' }; }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  let category: any = null;
  let productsData: any = { results: [], next: null };
  let parentName: string | null = null;

  try {
    const [catRes, prodRes] = await Promise.all([
      fetch(`${API_URL}/categories/${slug}/`, { next: { revalidate: 60 } }),
      fetch(`${API_URL}/products/?category=${slug}&page=1&page_size=20`, { next: { revalidate: 60 } }),
    ]);
    if (!catRes.ok) notFound();
    category = await catRes.json();
    productsData = prodRes.ok ? await prodRes.json() : { results: [], next: null };

    if (category.parent_slug) {
      const parentRes = await fetch(`${API_URL}/categories/${category.parent_slug}/`, { next: { revalidate: 300 } });
      if (parentRes.ok) {
        const parent = await parentRes.json();
        parentName = parent.name;
      }
    }
  } catch { notFound(); }

  const mappedProducts = (productsData.results || []).map(mapProduct);
  const hasMore = !!productsData.next;

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            {parentName ? (
              <>
                <Link href={`/category/${category.parent_slug}`} className="hover:text-foreground transition-colors">{parentName}</Link>
                <ChevronRight size={14} />
              </>
            ) : null}
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

      {category.children && category.children.length > 0 && (
        <div className="max-w-[1500px] mx-auto px-4 pt-6">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Subcategorias</h2>
          <div className="flex flex-wrap gap-2">
            {category.children.map((c: any) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="px-3 py-1.5 bg-card border border-border rounded-full text-sm hover:bg-accent/10 hover:border-accent transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <CategoryProducts categorySlug={slug} initialProducts={mappedProducts} initialHasMore={hasMore} />
    </>
  );
}
