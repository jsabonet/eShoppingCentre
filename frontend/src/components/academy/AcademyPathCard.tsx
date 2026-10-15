"use client";

import Link from 'next/link';
import { ChevronRight, Clock, PlayCircle, Award } from 'lucide-react';
import type { AcademyPath } from '../../data/academy';
import { LEVEL_LABELS, pathLessonCount } from '../../data/academy';
import { useAcademy } from '../../contexts/AcademyContext';

const LEVEL_DOT: Record<string, string> = {
  beginner: 'bg-green-500',
  intermediate: 'bg-blue-500',
  advanced: 'bg-purple-500',
};

export default function AcademyPathCard({ path }: { path: AcademyPath }) {
  const { completedLessons } = useAcademy();
  const total = pathLessonCount(path);
  const completed = path.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => completedLessons.includes(l.slug)).length,
    0,
  );
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const started = completed > 0;
  const finished = completed === total && total > 0;

  return (
    <Link
      href={`/academy/${path.slug}`}
      className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all flex flex-col"
    >
      <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${path.gradient}`}>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url('${path.image}')` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/15 to-transparent" aria-hidden="true" />

        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-white/90 text-foreground shadow-sm backdrop-blur-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[path.level] ?? LEVEL_DOT.beginner}`} />
          {LEVEL_LABELS[path.level]}
        </span>

        {finished && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-600 text-white shadow-sm">
            <Award size={12} /> Concluída
          </span>
        )}

        <span className="absolute bottom-2 left-3 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-card/90 backdrop-blur-sm text-lg shadow-sm">
          {path.emoji}
        </span>

        <span className="absolute bottom-2 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-accent text-accent-foreground shadow-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
          <PlayCircle size={18} />
        </span>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-base group-hover:text-accent transition-colors">{path.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{path.tagline}</p>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{path.description}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
          <span className="flex items-center gap-1">
            <PlayCircle size={14} /> {total} aulas
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} /> {path.totalDuration}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">{started ? 'Progresso' : 'Começar do zero'}</span>
            <span className="font-medium">{percent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm font-semibold text-accent">
            {started ? 'Continuar' : 'Começar'}
          </span>
          <ChevronRight size={16} className="text-accent group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
