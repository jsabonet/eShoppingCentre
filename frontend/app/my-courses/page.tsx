'use client';

import Link from 'next/link';
import { BookOpen, Clock, PlayCircle, Award, ChevronRight } from 'lucide-react';

const myCourses = [
  { id: '1', title: 'Python para Iniciantes', instructor: 'Dr. Carlos Macamo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg', progress: 65, totalLessons: 48, completedLessons: 31, lastAccess: 'Hoje' },
  { id: '2', title: 'Marketing Digital Completo', instructor: 'Ana Mondlane', image: 'https://cdn.b12.io/client_media/iKv1biKD/573d35e0-7e6e-11f1-a56d-0242ac110002-m84D8GY8ROKweXe5v3qi3.jpg', progress: 30, totalLessons: 34, completedLessons: 10, lastAccess: 'Ontem' },
  { id: '3', title: 'Design Gráfico com Canva', instructor: 'Lúcia Sitoe', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aaa7a70-7e6e-11f1-9018-0242ac110002-4Rd8xIvDAA18urOueGtC6.jpg', progress: 100, totalLessons: 20, completedLessons: 20, lastAccess: '15 Jul' },
];

export default function MyCoursesPage() {
  return (
    <main className="max-w-[1500px] mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">Meus Cursos</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-accent/10 rounded-full"><BookOpen size={28} className="text-accent" /></div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Meus Cursos</h1>
          <p className="text-muted-foreground">Continue aprendendo de onde parou</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myCourses.map((course) => (
          <Link key={course.id} href={`/my-courses/${course.id}/learn`}
            className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
            <div className="h-40 overflow-hidden relative">
              <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              {course.progress === 100 && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Award size={16} /> Concluído
                  </span>
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold mb-1 group-hover:text-accent transition-colors">{course.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{course.instructor}</p>
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{course.completedLessons}/{course.totalLessons} aulas</span>
                  <span>{course.progress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      course.progress === 100 ? 'bg-green-500' : 'bg-accent'
                    }`}
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock size={12} />Último acesso: {course.lastAccess}</span>
                <span className="flex items-center gap-1 text-accent font-medium">
                  {course.progress === 100 ? 'Rever' : 'Continuar'} <PlayCircle size={14} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
