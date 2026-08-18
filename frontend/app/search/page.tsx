import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, Search } from 'lucide-react';
import SearchClient from '@/src/components/SearchClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const metadata: Metadata = { title: 'Pesquisa | e-Shopping Centre' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim() : '';

  if (!query) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">O que procura?</h1>
          <p className="text-muted-foreground mb-6">Utilize a barra de pesquisa no topo da página.</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors font-medium">Explorar Produtos</Link>
        </div>
      </main>
    );
  }

  let results: any[] = [];
  try {
    const res = await fetch(`${API_URL}/products/search/?q=${encodeURIComponent(query)}`, { next: { revalidate: 30 } });
    results = res.ok ? (await res.json()).results : [];
  } catch {}

  const mapped = results.map((p: any) => ({ id: p.id, slug: p.slug, name: p.name, description: '', price: parseFloat(p.price), image: p.primary_image || '', category: '', rating: parseFloat(p.rating), reviewCount: p.review_count, badge: p.is_on_sale ? 'sale' as const : undefined, inStock: p.stock > 0, originalPrice: p.compare_price ? parseFloat(p.compare_price) : undefined, discount: p.discount_percentage ?? undefined }));

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} /><span className="text-foreground font-medium">Pesquisa</span>
          </nav>
        </div>
      </div>
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-full"><Search size={28} className="text-accent" /></div>
            <div><h1 className="text-2xl font-bold mb-1">Resultados para &ldquo;{query}&rdquo;</h1><p className="text-muted-foreground"><span className="font-semibold text-foreground">{results.length}</span> encontrados</p></div>
          </div>
        </div>
      </div>
      <SearchClient products={mapped} query={query} />
    </>
  );
}
