import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cursos Online',
  description: 'Descubra cursos online em Moçambique. Aprenda com especialistas, estude ao seu ritmo e acompanhe o seu progresso.',
};

export default function CoursesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
