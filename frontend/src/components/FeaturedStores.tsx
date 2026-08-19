import Link from 'next/link';
import { Star, BadgeCheck, MapPin, ShoppingBag, Users } from 'lucide-react';

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

const TIER_STYLES: Record<string, string> = {
  diamond: 'bg-purple-100 text-purple-700',
  gold: 'bg-amber-100 text-amber-700',
  silver: 'bg-slate-200 text-slate-700',
  bronze: 'bg-orange-100 text-orange-700',
};

function formatCompact(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
  return String(n);
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

function TierBadge({ tier, display }: { tier: string; display: string }) {
  const className = TIER_STYLES[tier] || TIER_STYLES.bronze;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${className}`}>
      {display}
    </span>
  );
}

export default function FeaturedStores({ stores }: { stores: FeaturedStore[] }) {
  if (!stores || stores.length === 0) return null;
  const [hero, ...rest] = stores;

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

      {/* ── Mobile: tira horizontal ── */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 md:hidden">
        {stores.map((s) => {
          const logo = mediaUrl(s.logo);
          return (
            <Link
              key={s.slug}
              href={`/store/${s.slug}`}
              className="shrink-0 w-40 bg-card border border-border rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition-all"
            >
              <div className="w-16 h-16 mb-2 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {logo ? (
                  <img src={logo} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-muted-foreground">{s.name.charAt(0)}</span>
                )}
              </div>
              <h3 className="font-semibold text-sm line-clamp-1 w-full">{s.name}</h3>
              {s.rating > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Stars rating={s.rating} />
                  <span className="text-xs text-muted-foreground">
                    {s.rating.toFixed(1)}
                  </span>
                </div>
              )}
              {s.owner_verified && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 mt-1">
                  <BadgeCheck size={12} /> Verificada
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Desktop: hero + grelha ── */}
      <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Hero — primeira loja */}
        <Link
          href={`/store/${hero.slug}`}
          className="col-span-2 row-span-2 group bg-card border border-border rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-all"
        >
          <div className="relative h-40 w-full bg-muted overflow-hidden">
            {mediaUrl(hero.banner) ? (
              <img
                src={mediaUrl(hero.banner)!}
                alt={hero.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: hero.theme_color }} />
            )}
            <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-xl border-4 border-card bg-muted overflow-hidden">
              {mediaUrl(hero.logo) ? (
                <img src={mediaUrl(hero.logo)!} alt={hero.name} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
                  {hero.name.charAt(0)}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 pt-10 flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg line-clamp-1">{hero.name}</h3>
              {hero.owner_verified && (
                <BadgeCheck size={18} className="text-emerald-500 shrink-0" aria-label="Verificada" />
              )}
            </div>

            {hero.tagline && (
              <p className="text-sm text-muted-foreground line-clamp-1">{hero.tagline}</p>
            )}

            <div className="flex items-center gap-2">
              {hero.rating > 0 && (
                <>
                  <Stars rating={hero.rating} />
                  <span className="text-sm font-semibold">
                    {hero.rating.toFixed(1)}
                  </span>
                </>
              )}
              <TierBadge tier={hero.tier} display={hero.tier_display} />
            </div>

            <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShoppingBag size={13} /> {hero.total_products} produtos
              </span>
              <span className="flex items-center gap-1">
                <Users size={13} /> {formatCompact(hero.followers_count)} seguidores
              </span>
              {hero.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {hero.location}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Restantes lojas */}
        {rest.map((s) => {
          const logo = mediaUrl(s.logo);
          return (
            <Link
              key={s.slug}
              href={`/store/${s.slug}`}
              className="group bg-card border border-border rounded-xl p-4 flex flex-col items-center text-center hover:shadow-md transition-all"
            >
              <div className="w-14 h-14 mb-2 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {logo ? (
                  <img src={logo} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">{s.name.charAt(0)}</span>
                )}
              </div>
              <h3 className="font-semibold text-sm line-clamp-1 w-full">{s.name}</h3>
              {s.tagline && (
                <p className="text-xs text-muted-foreground line-clamp-1 w-full mt-0.5">{s.tagline}</p>
              )}
              {s.rating > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Stars rating={s.rating} />
                  <span className="text-xs text-muted-foreground">
                    {s.rating.toFixed(1)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <TierBadge tier={s.tier} display={s.tier_display} />
                {s.owner_verified && <BadgeCheck size={14} className="text-emerald-500" />}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
