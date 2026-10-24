import CoursesClient, { type CourseData } from './CourseListClient';
import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cursos Online',
  description: 'Descubra cursos online em Moçambique. Aprenda com especialistas, estude ao seu ritmo e acompanhe o seu progresso.',
  alternates: { canonical: '/courses' },
};

export default async function CoursesPage() {
  let initialCourses: CourseData[] = [];
  let initialHasMore = false;

  try {
    const response = await fetch(`${API_URL}/courses/?page=1&page_size=12&ordering=-students_count`, {
      next: { revalidate: 120 },
    });
    if (!response.ok) {
      console.error(`[Courses] Initial listing returned HTTP ${response.status}`);
    } else {
      const data = await response.json();
      initialCourses = Array.isArray(data) ? data : data.results || [];
      initialHasMore = !Array.isArray(data) && Boolean(data.next);
    }
  } catch (error) {
    console.error('[Courses] Failed to load initial course listing', error);
  }

  return <CoursesClient initialCourses={initialCourses} initialHasMore={initialHasMore} />;
}
