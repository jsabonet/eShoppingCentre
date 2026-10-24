import type { Metadata } from 'next';
import { findPath } from '@/src/data/academy';

interface AcademyPathLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AcademyPathLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const path = findPath(slug);
  if (!path) return { title: 'Trilha não encontrada', robots: { index: false, follow: true } };

  return {
    title: path.title,
    description: path.description,
    alternates: { canonical: `/academy/${encodeURIComponent(path.slug)}` },
    openGraph: {
      type: 'website',
      title: path.title,
      description: path.description,
      images: path.image ? [{ url: path.image, alt: path.title }] : undefined,
    },
  };
}

export default function AcademyPathLayout({ children }: AcademyPathLayoutProps) {
  return children;
}
