'use client';

import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Users, Search, TrendingUp, BarChart3 } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface StudentData {
  enrollment_id: string;
  user_id: string;
  name: string;
  email: string;
  progress: number;
  completed: boolean;
  completed_lessons: number;
  enrolled_at: string;
  course_title?: string;
}

export default function SellerStudentsPage() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const apiHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchStudents = useCallback(async () => {
    try {
      const coursesRes = await fetch(`${API_URL}/products/my/?product_type=course`, {
        headers: apiHeaders(),
      });
      if (!coursesRes.ok) { setLoading(false); return; }
      const coursesData = await coursesRes.json();
      const courses = (coursesData.results || coursesData || []);

      const allStudents: StudentData[] = [];
      for (const course of courses) {
        const courseId = course.course?.course_id;
        if (!courseId) continue;
        try {
          const studRes = await fetch(`${API_URL}/courses/${courseId}/students/`, {
            headers: apiHeaders(),
          });
          if (studRes.ok) {
            const sdata = await studRes.json();
            (sdata.students || []).forEach((s: any) => {
              allStudents.push({ ...s, course_title: course.name });
            });
          }
        } catch {}
      }
      setStudents(allStudents);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = search
    ? students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.course_title || '').toLowerCase().includes(search.toLowerCase())
      )
    : students;

  const completedCount = students.filter(s => s.completed).length;
  const avgProgress = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.progress, 0) / students.length)
    : 0;

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={32} message="A carregar alunos..." />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os alunos inscritos nos seus cursos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Alunos', value: students.length, icon: Users, color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Concluiram', value: completedCount, icon: GraduationCap, color: 'bg-green-100 text-green-700' },
            { label: 'Progresso Medio', value: `${avgProgress}%`, icon: BarChart3, color: 'bg-blue-100 text-blue-700' },
            { label: 'Activos', value: students.filter(s => !s.completed).length, icon: TrendingUp, color: 'bg-amber-100 text-amber-700' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}><Icon size={20} /></div>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, email ou curso..."
                className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <GraduationCap size={48} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium mb-1">{students.length === 0 ? 'Nenhum aluno ainda' : 'Nenhum resultado'}</p>
              <p className="text-sm">Os alunos aparecerao aqui quando se inscreverem nos seus cursos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Aluno</th>
                    <th className="text-left px-4 py-3 font-medium">Curso</th>
                    <th className="text-center px-4 py-3 font-medium">Progresso</th>
                    <th className="text-center px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium">Inscrito em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(s => (
                    <tr key={s.enrollment_id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                            {(s.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.course_title || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${s.completed ? 'bg-green-500' : 'bg-accent'}`}
                              style={{ width: `${s.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{Math.round(s.progress)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.completed ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Concluido</span>
                        ) : s.progress > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Em progresso</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">Nao iniciado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(s.enrolled_at).toLocaleDateString('pt-MZ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
