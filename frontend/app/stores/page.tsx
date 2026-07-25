import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, MapPin, Package, Star } from 'lucide-react';

export const metadata: Metadata = { title: 'Lojas | eShoppingCentre' };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function StoresPage() {
  let stores: any[] = [];
  try {
    const res = await fetch(`${API_URL}/stores/`, { next: { revalidate: 60 } });
    stores = res.ok ? (await res.json()).results : [];
  } catch {}

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} /><span className="text-foreground font-medium">Lojas</span>
          </nav>
        </div>
      </div>
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">Lojas Parceiras</h1>
          <p className="text-muted-foreground">{stores.length} lojas no marketplace</p>
        </div>
      </div>
      <section className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store: any) => (
            <Link key={store.slug} href={`/store/${store.slug}`} className="group bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all">
              <h3 className="font-bold text-lg mb-1 group-hover:text-accent transition-colors">{store.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{store.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Star size={14} className="text-accent" /> {store.rating}</span>
                <span className="flex items-center gap-1"><Package size={14} /> {store.total_products} prod.</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {store.location}</span>
              </div>
            </Link>
          ))}
          {stores.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">Nenhuma loja ativa no momento.</p>}
        </div>
      </section>
    </>
  );
}
