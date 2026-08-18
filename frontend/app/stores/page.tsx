import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, MapPin, Package, Star, Store as StoreIcon } from 'lucide-react';

export const metadata: Metadata = { title: 'Lojas | e-Shopping Centre' };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default async function StoresPage() {
  let stores: any[] = [];
  try {
    const res = await fetch(`${API_URL}/stores/`, { next: { revalidate: 60 } });
    const data = res.ok ? await res.json() : { results: [] };
    // Filter out stores with empty slugs (shouldn't happen after backend fix, but safety net)
    stores = (data.results || []).filter((s: any) => s.slug);
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
          {stores.map((store: any) => {
            const coverUrl = mediaUrl(store.banner);
            const logoUrl = mediaUrl(store.logo);
            const storeColor = store.theme_color || '#2563eb';
            return (
              <Link
                key={store.slug}
                href={`/store/${store.slug}`}
                className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1"
              >
                {/* Cover / Banner */}
                <div className="h-32 bg-gradient-to-r from-muted to-muted/50 relative overflow-hidden">
                  {coverUrl ? (
                    <img src={coverUrl} alt={store.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${storeColor}22, ${storeColor}44)` }}
                    >
                      <StoreIcon size={48} className="text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                {/* Logo */}
                <div className="px-5 -mt-8 relative z-10">
                  <div className="w-14 h-14 rounded-xl border-4 border-card shadow-md overflow-hidden bg-white">
                    {logoUrl ? (
                      <img src={logoUrl} alt={store.name} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-lg font-bold text-white"
                        style={{ backgroundColor: storeColor }}
                      >
                        {store.name?.charAt(0) || 'L'}
                      </div>
                    )}
                  </div>
                </div>
                {/* Info */}
                <div className="p-5 pt-3">
                  <h3 className="font-bold text-lg mb-1 group-hover:text-accent transition-colors">{store.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{store.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Star size={14} className="text-yellow-500 fill-yellow-500" /> {store.rating}</span>
                    <span className="flex items-center gap-1"><Package size={14} /> {store.total_products} prod.</span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {store.location}</span>
                  </div>
                </div>
              </Link>
            );
          })}
          {stores.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-12">Nenhuma loja ativa no momento.</p>
          )}
        </div>
      </section>
    </>
  );
}
