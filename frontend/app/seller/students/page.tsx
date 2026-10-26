'use client';

import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Users, Search, TrendingUp, BarChart3, Download } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { downloadReportFromObjects, type ReportFormat } from '@/src/lib/export';

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
  const [courseFilter, setCourseFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('csv');

  const apiHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchStudents = useCallback(async () => {
    try {
      const courses: any[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const coursesRes = await fetch(`${API_URL}/products/my/?product_type=course&page_size=100&page=${page}`, {
          headers: apiHeaders(),
        });
        if (!coursesRes.ok) throw new Error('Erro ao carregar cursos.');
        const coursesData = await coursesRes.json();
        courses.push(...(coursesData.results || coursesData || []));
        hasNext = Boolean(coursesData.next);
        page += 1;
      }

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

  const courses = Array.from(new Set(students.map((student) => student.course_title).filter(Boolean))) as string[];
  const filtered = students.filter((student) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [student.name, student.email, student.course_title]
      .some((value) => String(value || '').toLowerCase().includes(query));
    const enrolledDate = String(student.enrolled_at || '').slice(0, 10);
    const matchesDates = (!dateFrom || enrolledDate >= dateFrom) && (!dateTo || enrolledDate <= dateTo);
    const matchesCourse = courseFilter === 'all' || student.course_title === courseFilter;
    const matchesCompletion = completionFilter === 'all'
      || (completionFilter === 'completed' ? student.completed : !student.completed);
    return matchesSearch && matchesDates && matchesCourse && matchesCompletion;
  });

  const completedCount = filtered.filter(s => s.completed).length;
  const avgProgress = filtered.length > 0
    ? Math.round(filtered.reduce((sum, s) => sum + s.progress, 0) / filtered.length)
    : 0;

  const exportStudents = () => {
    const rows = filtered.map((student) => ({
      aluno: student.name,
      email: student.email,
      curso: student.course_title || '',
      progresso: `${Math.round(student.progress)}%`,
      estado: student.completed ? 'Concluído' : student.progress > 0 ? 'Em progresso' : 'Não iniciado',
      inscricao: String(student.enrolled_at || '').slice(0, 10),
      aulas_concluidas: student.completed_lessons,
    }));
    const extension = reportFormat === 'excel' ? 'xlsx' : reportFormat;
    downloadReportFromObjects(reportFormat, `alunos-${new Date().toISOString().slice(0, 10)}.${extension}`,
      'Relatório de alunos e progresso', ['aluno', 'email', 'curso', 'progresso', 'estado', 'inscricao', 'aulas_concluidas'], rows);
  };

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
            { label: 'Total Alunos', value: filtered.length, icon: Users, color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Concluiram', value: completedCount, icon: GraduationCap, color: 'bg-green-100 text-green-700' },
            { label: 'Progresso Medio', value: `${avgProgress}%`, icon: BarChart3, color: 'bg-blue-100 text-blue-700' },
            { label: 'Activos', value: filtered.filter(s => !s.completed).length, icon: TrendingUp, color: 'bg-amber-100 text-amber-700' },
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
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
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
            <select aria-label="Filtrar por curso" value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="all">Todos os cursos</option>
              {courses.map((course) => <option key={course} value={course}>{course}</option>)}
            </select>
            <select aria-label="Filtrar por conclusão" value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="all">Todos os estados</option><option value="completed">Concluídos</option><option value="active">Em curso</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">De
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">Até
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)}
                className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground" />
            </label>
            <select aria-label="Formato do relatório" value={reportFormat} onChange={(event) => setReportFormat(event.target.value as ReportFormat)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option value="csv">CSV</option><option value="excel">Excel (.xlsx)</option><option value="pdf">PDF</option>
            </select>
            <button type="button" onClick={exportStudents} disabled={!filtered.length}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              <Download size={15} /> Exportar
            </button>
            </div>
            <p className="text-xs text-muted-foreground">{filtered.length} de {students.length} inscrições</p>
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
