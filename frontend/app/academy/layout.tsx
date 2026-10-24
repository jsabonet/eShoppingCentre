import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'e-Shopping Academy',
  description: 'Aprenda a vender online em Moçambique com trilhas práticas, aulas e certificados da e-Shopping Academy.',
};

export default function AcademyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
