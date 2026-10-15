"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Clock, CheckCircle2, Circle,
  ArrowLeft, Check,
} from 'lucide-react';
import { findPath, findLesson } from '@/src/data/academy';
import { useAcademy } from '@/src/contexts/AcademyContext';
import AcademyVideoPlayer from '@/src/components/academy/AcademyVideoPlayer';
import AcademyQuiz from '@/src/components/academy/AcademyQuiz';

export default function AcademyLessonPage() {
  const params = useParams<{ slug: string; lessonSlug: string }>();
  const path = findPath(params.slug);
  const { completedLessons, isQuizPassed, completeLesson, passQuiz } = useAcademy();

  if (!path) {
    notFound();
    return null;
  }

  const found = findLesson(path, params.lessonSlug);
  if (!found) {
    notFound();
    return null;
  }

  const { module, lesson } = found;

  // Lista plana para navegação anterior/seguinte
  const flat = path.modules.flatMap((m) =>
    m.lessons.map((l) => ({ lesson: l, module: m })),
  );
  const currentIndex = flat.findIndex((f) => f.lesson.slug === lesson.slug);
  const prev = currentIndex > 0 ? flat[currentIndex - 1] : null;
  const next = currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null;

  const isComplete = completedLessons.includes(lesson.slug);
  const quizPassed = lesson.quiz ? isQuizPassed(lesson.slug) : true;

  const handleComplete = () => {
    completeLesson(lesson.slug, Boolean(lesson.quiz) && quizPassed);
  };

  const handleQuizPass = () => {
    passQuiz(lesson.slug);
    completeLesson(lesson.slug, true);
  };

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <Link href="/academy" className="hover:text-foreground transition-colors">Academy</Link>
            <ChevronRight size={14} />
            <Link href={`/academy/${path.slug}`} className="hover:text-foreground transition-colors">{path.title}</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium line-clamp-1">{lesson.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <Link
          href={`/academy/${path.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar à trilha
        </Link>

        {/* Vídeo */}
        <AcademyVideoPlayer title={lesson.title} youtubeId={lesson.youtubeId} poster={path.image} />

        {/* Cabeçalho da aula */}
        <div className="mt-6">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-accent/10 text-accent mb-2">
            Módulo {found.moduleIndex + 1}: {module.title}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{lesson.title}</h1>
          <p className="text-muted-foreground flex items-center gap-2 text-sm mb-4">
            <Clock size={14} /> {lesson.duration}
            {lesson.quiz && <span className="text-accent">· Inclui quiz de verificação</span>}
          </p>
          <p className="text-muted-foreground leading-relaxed">{lesson.description}</p>
        </div>

        {/* Marcar como concluída */}
        <button
          onClick={handleComplete}
          className={`mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
            isComplete
              ? 'bg-green-600/10 text-green-700 border border-green-600/30'
              : 'bg-accent text-accent-foreground hover:bg-accent/90'
          }`}
        >
          {isComplete ? (
            <>
              <CheckCircle2 size={18} /> Aula concluída
            </>
          ) : (
            <>
              <Circle size={18} /> Marcar como concluída
            </>
          )}
        </button>

        {/* Quiz */}
        {lesson.quiz && (
          <div className="mt-8">
            <AcademyQuiz quiz={lesson.quiz} passed={quizPassed} onPass={handleQuizPass} />
          </div>
        )}

        {/* Navegação */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/academy/${path.slug}/${prev.lesson.slug}`}
              className="flex items-center gap-3 p-4 border border-border rounded-xl hover:border-accent hover:bg-muted/50 transition-colors"
            >
              <ChevronLeft size={18} className="text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Anterior</p>
                <p className="text-sm font-medium line-clamp-1">{prev.lesson.title}</p>
              </div>
            </Link>
          ) : (
            <span />
          )}

          {next && (
            <Link
              href={`/academy/${path.slug}/${next.lesson.slug}`}
              className="flex items-center justify-end gap-3 p-4 border border-border rounded-xl hover:border-accent hover:bg-muted/50 transition-colors text-right"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Próxima</p>
                <p className="text-sm font-medium line-clamp-1">{next.lesson.title}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
            </Link>
          )}
        </div>

        {/* Selo de conclusão da trilha */}
        {isComplete && (
          <div className="mt-6 p-4 rounded-xl border border-green-600/30 bg-green-600/5 flex items-start gap-3">
            <Check size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Aula concluída! Continua o bom ritmo — cada módulo aproxima-te do teu certificado.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
