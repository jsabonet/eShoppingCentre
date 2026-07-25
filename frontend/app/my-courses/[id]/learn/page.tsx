'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, CheckCircle, FileText, ChevronDown, ChevronUp, Menu, X, BookOpen } from 'lucide-react';

const courseData = {
  title: 'Python para Iniciantes',
  modules: [
    {
      title: 'Módulo 1: Introdução',
      lessons: [
        { id: 'l1', title: 'Instalação e Configuração', duration: '15:30', completed: true, type: 'video' },
        { id: 'l2', title: 'Primeiro Programa', duration: '12:00', completed: true, type: 'video' },
        { id: 'l3', title: 'Variáveis e Tipos de Dados', duration: '20:15', completed: true, type: 'video' },
        { id: 'l4', title: 'Entrada e Saída', duration: '18:00', completed: false, type: 'video' },
      ],
    },
    {
      title: 'Módulo 2: Estruturas de Controle',
      lessons: [
        { id: 'l5', title: 'Condicionais (if/else)', duration: '22:00', completed: false, type: 'video' },
        { id: 'l6', title: 'Loops (for/while)', duration: '25:00', completed: false, type: 'video' },
        { id: 'l7', title: 'Listas e Tuplas', duration: '18:30', completed: false, type: 'video' },
        { id: 'l8', title: 'Dicionários', duration: '16:45', completed: false, type: 'video' },
      ],
    },
    {
      title: 'Módulo 3: Funções',
      lessons: [
        { id: 'l9', title: 'Funções Básicas', duration: '20:00', completed: false, type: 'video' },
        { id: 'l10', title: 'Parâmetros e Retorno', duration: '15:00', completed: false, type: 'video' },
      ],
    },
  ],
};

export default function CourseLearnPage() {
  const params = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    'Módulo 1: Introdução': true,
    'Módulo 2: Estruturas de Controle': false,
    'Módulo 3: Funções': false,
  });

  const toggleModule = (title: string) => {
    setExpandedModules(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const totalLessons = courseData.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = courseData.modules.reduce((sum, m) => sum + m.lessons.filter(l => l.completed).length, 0);

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <Link href="/my-courses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h2 className="font-bold text-sm line-clamp-2">{courseData.title}</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <span className="text-accent font-medium">{completedLessons}/{totalLessons}</span> aulas concluídas
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: `${(completedLessons / totalLessons) * 100}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {courseData.modules.map((mod) => (
          <div key={mod.title} className="border-b border-border">
            <button onClick={() => toggleModule(mod.title)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-muted/50 transition-colors text-left">
              <span>{mod.title}</span>
              {expandedModules[mod.title] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedModules[mod.title] && (
              <div className="divide-y divide-border">
                {mod.lessons.map((lesson) => (
                  <button key={lesson.id}
                    className="w-full px-4 py-2.5 pl-8 flex items-center gap-3 text-sm hover:bg-muted/50 transition-colors text-left">
                    {lesson.completed ? (
                      <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <PlayCircle size={16} className="text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className={`truncate block ${lesson.completed ? 'text-muted-foreground' : ''}`}>{lesson.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.duration}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:block w-80 bg-card border-r border-border flex-shrink-0">
        {sidebar}
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-80 bg-card border-r border-border shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-muted rounded-md">
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium">Entrada e Saída</span>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
            <button className="flex items-center gap-1 px-3 py-1.5 hover:bg-muted rounded-md"><FileText size={16} /> Materiais</button>
          </div>
        </div>

        {/* Video Player Placeholder */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          <div className="text-center text-white/60">
            <PlayCircle size={80} className="mx-auto mb-4 text-white/40" />
            <p className="text-lg">Player de Vídeo</p>
            <p className="text-sm text-white/40">O vídeo será carregado quando o backend estiver integrado</p>
          </div>
        </div>

        {/* Lesson Info Bottom */}
        <div className="bg-card border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Aula Anterior</button>
              <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
                Marcar como Concluída <CheckCircle size={16} />
              </button>
            </div>
            <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              Próxima Aula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
