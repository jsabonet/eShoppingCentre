import Link from 'next/link';
import { Star, BadgeCheck } from 'lucide-react';

const MEDIA_BASE = process.env.NEXT_PUBLIC_MEDIA_URL || process.env.NEXT_PUBLIC_MEDIA_HOST || 'http://localhost:8000';

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface FeaturedStore {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo: string | null;
  banner: string | null;
  theme_color: string;
  category: string;
  location: string;
  rating: number;
  total_sales: number;
  total_products: number;
  tier: string;
  tier_display: string;
  owner_verified: boolean;
  review_count: number;
  followers_count: number;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={13}
          className={i < Math.floor(rating) ? 'fill-accent text-accent' : 'text-muted-foreground'}
        />
      ))}
    </span>
  );
}

export default function FeaturedStores({ stores }: { stores: FeaturedStore[] }) {
  if (!stores || stores.length === 0) return null;

  return (
    <section id="lojas" className="py-12 px-4 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-accent">🏪</span> Lojas em Destaque
        </h2>
        <Link href="/stores" className="text-sm text-accent hover:underline font-medium">
          Ver todas →
        </Link>
      </div>

      {/* Mobile: tira horizontal · Desktop: duas linhas (grid 4 colunas) */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-4 md:overflow-visible">
        {stores.map((s) => {
          const logo = mediaUrl(s.logo);
          return (
            <Link
              key={s.slug}
              href={`/store/${s.slug}`}
              className="shrink-0 w-40 sm:w-44 md:w-full bg-card border border-border rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 mb-2 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {logo ? (
                  <img src={logo} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">{s.name.charAt(0)}</span>
                )}
              </div>
              <h3 className="font-semibold text-sm line-clamp-1 w-full">{s.name}</h3>
              {s.tagline && (
                <p className="text-xs text-muted-foreground line-clamp-1 w-full mt-0.5">{s.tagline}</p>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                {s.rating > 0 && <Stars rating={s.rating} />}
                {s.owner_verified && <BadgeCheck size={14} className="text-emerald-500" />}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
