"use client";

import Link from 'next/link';
import {
  ChevronRight, GraduationCap, CheckCircle2, ClipboardCheck,
  Award, RotateCcw, PlayCircle, Trophy, Medal, Sparkles,
} from 'lucide-react';
import { academyPaths, pathLessonCount, pathQuizCount } from '@/src/data/academy';
import { useAcademy } from '@/src/contexts/AcademyContext';

export default function AcademyProgressPage() {
  const { completedLessons, passedQuizzes, resetProgress } = useAcademy();

  const totalLessons = academyPaths.reduce((s, p) => s + pathLessonCount(p), 0);
  const totalQuizzes = academyPaths.reduce((s, p) => s + pathQuizCount(p), 0);

  const overallPercent =
    totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  const pathStats = academyPaths.map((path) => {
    const lessons = pathLessonCount(path);
    const quizzes = pathQuizCount(path);
    const done = path.modules.reduce(
      (s, m) => s + m.lessons.filter((l) => completedLessons.includes(l.slug)).length,
      0,
    );
    const passed = path.modules.reduce(
      (s, m) => s + m.lessons.filter((l) => l.quiz && passedQuizzes.includes(l.slug)).length,
      0,
    );
    const complete = done === lessons && passed === quizzes && lessons > 0;
    // Primeira aula não concluída, para o CTA
    let next: string | null = null;
    for (const m of path.modules) {
      for (const l of m.lessons) {
        if (!completedLessons.includes(l.slug)) {
          next = l.slug;
          break;
        }
      }
      if (next) break;
    }
    return { path, lessons, quizzes, done, passed, percent: Math.round((done / lessons) * 100), complete, next };
  });

  const certificates = pathStats.filter((s) => s.complete);
  const completedPaths = certificates.length;

  // Conquistas (mock, derivadas do progresso)
  const badges = [
    {
      icon: Sparkles,
      label: 'Primeiro passo',
      desc: 'Concluir a primeira aula',
      earned: completedLessons.length >= 1,
    },
    {
      icon: ClipboardCheck,
      label: 'Verificação',
      desc: 'Passar no primeiro quiz',
      earned: passedQuizzes.length >= 1,
    },
    {
      icon: Medal,
      label: 'Metade do caminho',
      desc: 'Concluir 50% das aulas',
      earned: totalLessons > 0 && completedLessons.length >= Math.ceil(totalLessons / 2),
    },
    {
      icon: Trophy,
      label: 'Primeira trilha',
      desc: 'Concluir uma trilha completa',
      earned: completedPaths >= 1,
    },
    {
      icon: Award,
      label: 'Colecionador',
      desc: 'Concluir todas as trilhas',
      earned: completedPaths === academyPaths.length && academyPaths.length > 0,
    },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <Link href="/academy" className="hover:text-foreground transition-colors">Academy</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Minha Academy</span>
          </nav>
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/academy-hero.svg')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-primary/85 md:bg-primary/0 md:bg-gradient-to-r md:from-primary md:via-primary/85 md:to-primary/45"
          aria-hidden="true"
        />
        <div className="relative max-w-[1500px] mx-auto px-4 py-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center">
              <GraduationCap size={28} className="text-accent" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Minha Academy</h1>
              <p className="text-primary-foreground/70 text-sm">O teu progresso de aprendizagem.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 max-w-lg">
            <div className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-accent">{overallPercent}%</p>
              <p className="text-xs text-primary-foreground/70 mt-1">Progresso geral</p>
            </div>
            <div className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-accent">{completedLessons.length}/{totalLessons}</p>
              <p className="text-xs text-primary-foreground/70 mt-1">Aulas</p>
            </div>
            <div className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-accent">{passedQuizzes.length}/{totalQuizzes}</p>
              <p className="text-xs text-primary-foreground/70 mt-1">Quizzes</p>
            </div>
          </div>

          <div className="max-w-lg mt-5">
            <div className="h-2 bg-primary-foreground/10 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 py-10 space-y-10">
        {/* Trilhas em progresso */}
        <section>
          <h2 className="text-xl font-bold mb-4">As tuas trilhas</h2>
          <div className="space-y-3">
            {pathStats.map(({ path, lessons, done, percent, complete, next }) => (
              <div key={path.slug} className="border border-border rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-border bg-primary">
                    <div
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: `url('${path.image}')` }}
                      aria-hidden="true"
                    />
                    <span className="absolute bottom-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-md bg-card/90 text-[10px] leading-none shadow-sm">
                      {path.emoji}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold line-clamp-1">{path.title}</h3>
                      {complete && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{done} de {lessons} aulas concluídas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-accent">{percent}%</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 flex justify-end">
                  {complete ? (
                    <Link
                      href={`/academy/${path.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-700"
                    >
                      Ver certificado <ChevronRight size={15} />
                    </Link>
                  ) : next ? (
                    <Link
                      href={`/academy/${path.slug}/${next}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent/80"
                    >
                      Continuar <PlayCircle size={15} />
                    </Link>
                  ) : (
                    <Link
                      href={`/academy/${path.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent/80"
                    >
                      Ver trilha <ChevronRight size={15} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Certificados */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Award size={20} className="text-accent" /> Certificados ({certificates.length})
          </h2>
          {certificates.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {certificates.map(({ path }) => (
                <Link
                  key={path.slug}
                  href={`/academy/${path.slug}`}
                  className="border-2 border-dashed border-green-600/40 bg-green-600/5 rounded-xl p-5 text-center hover:bg-green-600/10 transition-colors"
                >
                  <Award size={28} className="mx-auto text-green-600 mb-2" />
                  <p className="font-semibold text-sm">{path.certificateTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">{path.title} · e-Shopping Academy</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-xl p-6 text-center text-muted-foreground">
              Ainda não tens certificados. Conclui uma trilha para desbloquear o primeiro.
            </div>
          )}
        </section>

        {/* Conquistas */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-accent" /> Conquistas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.label}
                className={`rounded-xl border p-4 text-center ${
                  badge.earned ? 'border-accent/40 bg-accent/5' : 'border-border bg-muted/20 opacity-60'
                }`}
              >
                <badge.icon
                  size={24}
                  className={`mx-auto mb-2 ${badge.earned ? 'text-accent' : 'text-muted-foreground'}`}
                />
                <p className="text-sm font-semibold">{badge.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{badge.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Repor progresso */}
        <section className="border border-border rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Repor o progresso</h3>
            <p className="text-sm text-muted-foreground">Apaga as aulas concluídas e os quizzes desta demonstração.</p>
          </div>
          <button
            onClick={resetProgress}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors shrink-0"
          >
            <RotateCcw size={15} /> Repor
          </button>
        </section>
      </div>
    </>
  );
}
