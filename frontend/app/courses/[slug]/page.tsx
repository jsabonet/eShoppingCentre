import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CourseDetailClient, { type CourseDetail } from './CourseDetailClient';
import { absoluteUrl, plainText } from '@/src/lib/seo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

async function getCourse(slug: string): Promise<CourseDetail | null> {
  const response = await fetch(`${API_URL}/courses/${encodeURIComponent(slug)}/`, {
    next: { revalidate: 60 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Course API returned HTTP ${response.status} for ${slug}`);
  return await response.json();
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return { title: 'Curso não encontrado', robots: { index: false, follow: true } };

  const description = plainText(course.description || `Aprenda ${course.title} no e-Shopping Centre.`);
  return {
    title: course.title,
    description,
    alternates: { canonical: `/courses/${encodeURIComponent(slug)}` },
    openGraph: {
      type: 'website',
      title: course.title,
      description,
      url: absoluteUrl(`/courses/${encodeURIComponent(slug)}`),
      images: course.image ? [{ url: course.image, alt: course.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: course.title,
      description,
      images: course.image ? [course.image] : undefined,
    },
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: plainText(course.description),
    provider: {
      '@type': 'Organization',
      name: 'e-Shopping Centre',
      sameAs: absoluteUrl('/'),
    },
    url: absoluteUrl(`/courses/${encodeURIComponent(slug)}`),
    image: course.image || undefined,
    instructor: course.instructor_name ? { '@type': 'Person', name: course.instructor_name } : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <CourseDetailClient initialCourse={course} />
    </>
  );
}
