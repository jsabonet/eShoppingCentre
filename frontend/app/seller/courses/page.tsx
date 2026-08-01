'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Edit3, Eye, Settings, Trash2, Loader2 } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function CourseIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="8" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M16 15l8 5-8 5V15z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path d="M10 32l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 32l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface CourseProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  status: string;
  sales_count: number;
  course_id?: string;
  total_lessons?: number;
  duration?: string;
}

export default function SellerCoursesPage() {
  const [courses, setCourses] = useState<CourseProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [deleting, setDeleting] = useState<string | null>(null);

  const apiHeaders = () => {
    const token = localStorage.getItem('access_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const handleDelete = async (courseId: string, courseName: string) => {
    if (!confirm(`Eliminar o curso "${courseName}"? Esta acção é irreversível.`)) return;
    setDeleting(courseId);
    try {
      await fetch(`${API_URL}/courses/${courseId}/delete/`, { method: 'DELETE', headers: apiHeaders() });
      setCourses(prev => prev.filter(c => c.course_id !== courseId));
    } catch {} finally { setDeleting(null); }
  };

  const fetchCourses = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      // Use server-side product_type filter instead of client-side filtering
      const res = await fetch(`${API_URL}/products/my/?product_type=course`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || data || [];
        // Map products to course format — no client-side filter needed
        const courseProducts = results.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: parseFloat(p.price),
            status: p.status,
            sales_count: p.sales_count || 0,
            course_id: (p as any).course?.course_id || null,
          }));

        // Fetch detailed course info for each
        const enriched = await Promise.all(
          courseProducts.map(async (cp: CourseProduct) => {
            if (!cp.course_id) return cp;
            try {
              const cres = await fetch(`${API_URL}/courses/${cp.course_id}/builder/`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              });
              if (cres.ok) {
                const cdata = await cres.json();
                const allLessons = (cdata.modules || []).reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0);
                return { ...cp, total_lessons: allLessons };
              }
            } catch {}
            return cp;
          })
        );

        setCourses(enriched);
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const statusLabel: Record<string, string> = {
    active: 'Activo', inactive: 'Inactivo', draft: 'Rascunho',
  };
  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={32} message="A carregar cursos..." />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent/10 rounded-full">
              <CourseIcon size={28} className="text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Meus Cursos</h1>
              <p className="text-sm text-muted-foreground">
                {courses.length} curso(s) — Gira o conteudo de cada um
              </p>
            </div>
          </div>
          <Link href="/seller/courses/new"
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90">
            Novo Curso
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <CourseIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">Nenhum curso ainda</p>
            <p className="text-sm mb-4">Crie o seu primeiro curso e depois construa o conteudo aqui.</p>
            <Link href="/seller/courses/new" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium inline-block">
              Criar Curso
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CourseIcon size={24} className="text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{course.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{Number(course.price).toLocaleString('pt-MZ', { minimumFractionDigits: 2 })} MZN</span>
                    <span>·</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${statusColor[course.status] || ''}`}>
                      {statusLabel[course.status] || course.status}
                    </span>
                    {course.total_lessons != null && (
                      <>
                        <span>·</span>
                        <span>{course.total_lessons} aulas</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{course.sales_count} alunos</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {course.course_id ? (
                    <>
                      <Link href={`/seller/courses/${course.course_id}/edit`}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                        title="Definições do curso">
                        <Settings size={17} />
                      </Link>
                      <Link href={`/seller/courses/${course.course_id}/builder`}
                        className="px-3 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-1.5">
                        <Edit3 size={14} /> Editar Conteúdo
                      </Link>
                      <button
                        onClick={() => handleDelete(course.course_id!, course.name)}
                        disabled={deleting === course.course_id}
                        className="p-2 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                        title="Eliminar curso">
                        {deleting === course.course_id ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground px-3">A processar...</span>
                  )}
                  {course.slug && (
                    <Link href={`/product/${course.slug}`} target="_blank"
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                      title="Ver página pública">
                      <Eye size={17} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
