import type { MetadataRoute } from 'next';
import { absoluteUrl, API_URL } from '@/src/lib/seo';
import { academyPaths } from '@/src/data/academy';

export const dynamic = 'force-dynamic';

interface SlugEntry {
  slug: string;
  product_type?: string;
}

async function getPublicSlugs(endpoint: string): Promise<SlugEntry[]> {
  const entries: SlugEntry[] = [];
  let page = 1;
  try {
    while (page <= 500) {
      const response = await fetch(`${API_URL}/${endpoint}/?page=${page}&page_size=100`, {
        next: { revalidate: 3600 },
      });
      if (!response.ok) {
        console.error(`[SEO] Sitemap source ${endpoint} returned HTTP ${response.status}`);
        break;
      }
      const data: unknown = await response.json();
      const results = Array.isArray(data)
        ? data
        : typeof data === 'object' && data !== null && 'results' in data && Array.isArray(data.results)
          ? data.results
          : [];
      entries.push(...results.filter((entry): entry is SlugEntry =>
        typeof entry === 'object' && entry !== null && 'slug' in entry && typeof entry.slug === 'string',
      ));
      if (Array.isArray(data) || typeof data !== 'object' || data === null || !('next' in data) || !data.next) break;
      page += 1;
    }
  } catch (error) {
    console.error(`[SEO] Failed to fetch sitemap source ${endpoint}`, error);
  }
  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    '/',
    '/about',
    '/contact',
    '/faq',
    '/materials-care',
    '/privacy',
    '/terms',
    '/affiliate/terms',
    '/stores',
    '/courses',
    '/blog',
    '/academy',
  ];
  const blogSlugs = [
    'como-escolher-o-smartphone-ideal',
    'tendencias-moda-2026',
    'dicas-decoracao-casa-jardim',
    'cuidados-pele-verao',
    'compras-online-seguras-mocambique',
    'presentes-dia-dos-pais',
  ];
  const [products, stores, categories, courses] = await Promise.all([
    getPublicSlugs('products'),
    getPublicSlugs('stores'),
    getPublicSlugs('categories'),
    getPublicSlugs('courses'),
  ]);
  return [
    ...staticPaths.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
      priority: path === '/' ? 1 : 0.6,
    })),
    ...blogSlugs.map((slug) => ({
      url: absoluteUrl(`/blog/${slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...academyPaths.map((path) => ({
      url: absoluteUrl(`/academy/${encodeURIComponent(path.slug)}`),
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
    ...products.filter(({ product_type }) => product_type !== 'course').map(({ slug }) => ({
      url: absoluteUrl(`/product/${encodeURIComponent(slug)}`),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...stores.map(({ slug }) => ({
      url: absoluteUrl(`/store/${encodeURIComponent(slug)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...categories
      .filter(({ slug }) => slug !== 'curso-online' && slug !== 'cursos-online')
      .map(({ slug }) => ({
        url: absoluteUrl(`/category/${encodeURIComponent(slug)}`),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ...courses.map(({ slug }) => ({
      url: absoluteUrl(`/courses/${encodeURIComponent(slug)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
