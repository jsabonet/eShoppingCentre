'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, Clock, PlayCircle, Award, ChevronRight } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface EnrollmentData {
  id: string;
  course_id: string;
  course_title: string;
  course_slug: string;
  total_lessons: number;
  image: string | null;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Ha ${days} dias`;
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short' });
}

export default function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnrollments = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/me/enrollments/`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.results || data || []);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  if (loading) {
    return (
      <main className="max-w-[1500px] mx-auto px-4 py-8 min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner size={32} message="A carregar cursos..." />
      </main>
    );
  }

  return (
    <main className="max-w-[1500px] mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">Meus Cursos</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Meus Cursos</h1>
        <p className="text-muted-foreground">Continue aprendendo de onde parou</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium mb-1">Nenhum curso ainda</p>
          <p className="text-sm mb-4">Explore o nosso catalogo e inscreva-se no seu primeiro curso.</p>
          <Link href="/courses" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium inline-block">
            Ver Catalogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map((enr) => (
            <Link key={enr.id} href={`/my-courses/${enr.id}/learn`}
              className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
              <div className="h-40 overflow-hidden relative bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                {enr.image ? (
                  <img src={enr.image} alt={enr.course_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <BookOpen size={48} className="text-accent/30" />
                )}
                {enr.completed && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Award size={16} /> Concluido
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-1 group-hover:text-accent transition-colors">{enr.course_title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{enr.total_lessons} aulas</p>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{Math.round(enr.progress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${enr.completed ? 'bg-green-500' : 'bg-accent'}`}
                      style={{ width: `${enr.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(enr.created_at)}</span>
                  <span className="flex items-center gap-1 text-accent font-medium">
                    {enr.completed ? 'Rever' : 'Continuar'} <PlayCircle size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
