'use client';

import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Clock, Star, Users, BookOpen, PlayCircle, CheckCircle, ShoppingCart, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

interface LessonData {
  id: string;
  title: string;
  description: string;
  duration: string;
  is_free_preview: boolean;
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: LessonData[];
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  price: string;
  instructor_name: string;
  level: string;
  duration: string;
  total_lessons: number;
  certificate_enabled: boolean;
  preview_video_url: string;
  modules: ModuleData[];
  product: string;
}

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundErr, setNotFoundErr] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/courses/${slug}/`);
        if (res.status === 404) { setNotFoundErr(true); return; }
        if (res.ok) {
          const data = await res.json();
          setCourse(data);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={32} message="A carregar curso..." />
      </div>
    );
  }

  if (notFoundErr || !course) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <BookOpen size={64} className="text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Curso não encontrado</h1>
        <p className="text-muted-foreground mb-6">O curso que procura não existe ou foi removido.</p>
        <Link href="/courses" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium">
          Ver todos os cursos
        </Link>
      </div>
    );
  }

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const fmtPrice = (p: string) => `${Number(p).toLocaleString('pt-MZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MZN`;
  const features = [
    course.level ? LEVEL_LABELS[course.level] || course.level : 'Todos os níveis',
    `${course.duration || totalLessons + ' aulas'}`,
    `${totalLessons} aulas`,
    course.certificate_enabled ? 'Certificado de conclusão' : null,
    'Acesso vitalício',
    'Suporte via WhatsApp',
  ].filter(Boolean);

  const handleBuy = () => {
    // Add course product to cart and redirect to checkout
    if (course.product) {
      window.location.href = `/checkout?product=${course.product}`;
    }
  };

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground">Início</Link>
            <ChevronRight size={14} />
            <Link href="/courses" className="hover:text-foreground">Cursos</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium line-clamp-1">{course.title}</span>
          </nav>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                  {LEVEL_LABELS[course.level] || course.level}
                </span>
                <span className="flex items-center gap-1"><Clock size={14} />{course.duration}</span>
                <span className="flex items-center gap-1"><BookOpen size={14} />{totalLessons} aulas</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{course.title}</h1>
              <p className="text-lg text-muted-foreground mb-6">{course.description}</p>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                  {course.instructor_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">Por {course.instructor_name || 'Instrutor'}</p>
                  <p className="text-xs text-muted-foreground">Instrutor na plataforma</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-32">
                <div className="h-48 bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <BookOpen size={64} className="text-accent/20" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl font-bold text-accent">{fmtPrice(course.price)}</span>
                  </div>
                  <button onClick={handleBuy}
                    className="w-full px-4 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 mb-3">
                    <ShoppingCart size={18} /> Comprar Agora
                  </button>
                  <div className="space-y-2 text-sm">
                    {features.map((f) => (
                      <div key={f} className="flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> {f}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <section className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Conteúdo do Curso</h2>
          {course.modules.length === 0 ? (
            <p className="text-muted-foreground">O currículo deste curso ainda está a ser preparado.</p>
          ) : (
            <div className="space-y-4">
              {course.modules.map((mod) => (
                <div key={mod.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4 bg-muted/30 flex items-center justify-between">
                    <h3 className="font-bold">{mod.title}</h3>
                    <span className="text-sm text-muted-foreground">{mod.lessons.length} aulas</span>
                  </div>
                  <div className="divide-y divide-border">
                    {mod.lessons.map((lesson) => (
                      <div key={lesson.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                        <PlayCircle size={16} className="text-muted-foreground flex-shrink-0" />
                        <span>{lesson.title}</span>
                        {lesson.duration && <span className="ml-auto text-xs text-muted-foreground">{lesson.duration}</span>}
                        {lesson.is_free_preview && (
                          <span className="text-xs text-green-600 font-medium">Grátis</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
