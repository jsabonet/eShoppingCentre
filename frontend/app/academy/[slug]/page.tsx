"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import {
  ChevronRight, ChevronDown, Clock, PlayCircle, CheckCircle2, Circle,
  Award, Target, Check, Lock, GraduationCap, ArrowRight, ClipboardCheck,
} from 'lucide-react';
import { findPath, LEVEL_LABELS, pathLessonCount, pathQuizCount } from '@/src/data/academy';
import { useAcademy } from '@/src/contexts/AcademyContext';

export default function AcademyPathPage() {
  const params = useParams<{ slug: string }>();
  const path = findPath(params.slug);
  const { completedLessons, passedQuizzes } = useAcademy();
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  if (!path) {
    notFound();
    return null;
  }

  const total = pathLessonCount(path);
  const quizCount = pathQuizCount(path);
  const completed = path.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => completedLessons.includes(l.slug)).length,
    0,
  );
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const quizzesPassed = path.modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => l.quiz && passedQuizzes.includes(l.slug)).length,
    0,
  );

  const allLessonsDone = completed === total && total > 0;
  const allQuizzesDone = quizzesPassed === quizCount;
  const certificateUnlocked = allLessonsDone && allQuizzesDone;

  // Próxima aula (primeira não concluída)
  let nextLesson: { moduleTitle: string; lessonSlug: string; lessonTitle: string } | null = null;
  for (const m of path.modules) {
    for (const l of m.lessons) {
      if (!completedLessons.includes(l.slug)) {
        nextLesson = { moduleTitle: m.title, lessonSlug: l.slug, lessonTitle: l.title };
        break;
      }
    }
    if (nextLesson) break;
  }

  const toggleModule = (slug: string) =>
    setOpenModules((prev) => ({ ...prev, [slug]: !(prev[slug] ?? true) }));

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
            <span className="text-foreground font-medium line-clamp-1">{path.title}</span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden bg-primary text-primary-foreground border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${path.image}')` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-primary/80 md:bg-primary/0 md:bg-gradient-to-r md:from-primary md:via-primary/85 md:to-primary/25"
          aria-hidden="true"
        />
        <div className="relative max-w-[1500px] mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary-foreground/10 border border-primary-foreground/20 backdrop-blur-sm flex items-center justify-center text-4xl shrink-0">
              {path.emoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary-foreground/10 border border-primary-foreground/20 backdrop-blur-sm">
                  {LEVEL_LABELS[path.level]}
                </span>
                <span className="text-xs text-primary-foreground/70">{path.tagline}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mt-1 mb-2">{path.title}</h1>
              <p className="text-primary-foreground/80 max-w-2xl">{path.description}</p>
            </div>
          </div>

          {/* Stats + progress */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-6 text-sm text-primary-foreground/80">
            <span className="flex items-center gap-1.5"><PlayCircle size={16} className="text-accent" /> {total} aulas</span>
            <span className="flex items-center gap-1.5"><ClipboardCheck size={16} className="text-accent" /> {quizCount} quizzes</span>
            <span className="flex items-center gap-1.5"><Clock size={16} className="text-accent" /> {path.totalDuration}</span>
          </div>

          <div className="mt-5 max-w-xl">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">{completed} de {total} aulas concluídas</span>
              <span className="font-bold text-accent">{percent}%</span>
            </div>
            <div className="h-2 bg-primary-foreground/15 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Conteúdo */}
        <div className="lg:col-span-2 space-y-8">
          {/* CTA próxima aula */}
          {nextLesson && (
            <Link
              href={`/academy/${path.slug}/${nextLesson.lessonSlug}`}
              className="flex items-center justify-between gap-4 p-4 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 transition-colors"
            >
              <span>
                {completed === 0 ? 'Começar a trilha' : 'Continuar a aprendizagem'}
              </span>
              <span className="flex items-center gap-2 text-sm">
                {nextLesson.lessonTitle} <ArrowRight size={16} />
              </span>
            </Link>
          )}

          {/* O que vais aprender */}
          <section>
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Target size={18} className="text-accent" /> O que vais aprender</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {path.outcomes.map((o) => (
                <li key={o} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" /> {o}
                </li>
              ))}
            </ul>
          </section>

          {/* Módulos */}
          <section>
            <h2 className="text-xl font-bold mb-3">Conteúdo da trilha</h2>
            <div className="space-y-3">
              {path.modules.map((module, mi) => {
                const moduleDone = module.lessons.every((l) => completedLessons.includes(l.slug));
                const isOpen = openModules[module.slug] ?? true;
                return (
                  <div key={module.slug} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleModule(module.slug)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                        {mi + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{module.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{module.description}</p>
                      </div>
                      {moduleDone && <CheckCircle2 size={18} className="text-green-600 shrink-0" />}
                      <ChevronDown size={18} className={`text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="border-t border-border">
                        {module.lessons.map((lesson) => {
                          const done = completedLessons.includes(lesson.slug);
                          const quizDone = !lesson.quiz || passedQuizzes.includes(lesson.slug);
                          return (
                            <Link
                              key={lesson.slug}
                              href={`/academy/${path.slug}/${lesson.slug}`}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                            >
                              {done ? (
                                <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                              ) : (
                                <Circle size={18} className="text-muted-foreground shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${done ? 'text-muted-foreground' : 'font-medium'}`}>{lesson.title}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Clock size={12} /> {lesson.duration}
                                  {lesson.quiz && <span className="inline-flex items-center gap-1"><ClipboardCheck size={12} /> Quiz</span>}
                                </p>
                              </div>
                              {lesson.quiz && (
                                <span className={`px-2 py-0.5 rounded text-xs ${quizDone ? 'bg-green-600/10 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                  Quiz {quizDone ? '✓' : ''}
                                </span>
                              )}
                              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Certificado */}
          <div className="border border-border rounded-xl p-5">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${certificateUnlocked ? 'bg-green-600/10' : 'bg-muted'}`}>
              {certificateUnlocked ? <Award size={24} className="text-green-600" /> : <Lock size={24} className="text-muted-foreground" />}
            </div>
            <h3 className="font-semibold mb-1">Certificado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {certificateUnlocked
                ? 'Parabéns! Concluíste a trilha e o teu certificado está pronto.'
                : 'Conclui todas as aulas e quizzes para desbloquear o certificado.'}
            </p>
            {certificateUnlocked ? (
              <div className="rounded-lg border-2 border-dashed border-green-600/40 bg-green-600/5 p-4 text-center">
                <GraduationCap size={28} className="mx-auto text-green-600 mb-2" />
                <p className="text-sm font-semibold">{path.certificateTitle}</p>
                <p className="text-xs text-muted-foreground mt-1">e-Shopping Academy</p>
              </div>
            ) : (
              <div className="text-sm">
                <div className="flex justify-between text-xs mb-1">
                  <span>Aulas</span><span>{completed}/{total}</span>
                </div>
                <div className="flex justify-between text-xs mb-3">
                  <span>Quizzes</span><span>{quizzesPassed}/{quizCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Benefícios */}
          <div className="border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Benefícios ao concluir</h3>
            <ul className="space-y-2">
              {path.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-accent flex-shrink-0 mt-0.5" /> {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Audiência */}
          <div className="border border-border rounded-xl p-5 bg-muted/30">
            <h3 className="font-semibold mb-1 text-sm">Para quem é esta trilha</h3>
            <p className="text-sm text-muted-foreground">{path.audience}</p>
          </div>
        </div>
      </div>
    </>
  );
}
