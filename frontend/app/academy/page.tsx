"use client";

import Link from 'next/link';
import { ChevronRight, GraduationCap, MousePointerClick, PlayCircle, ClipboardCheck, Award, BadgeCheck, TrendingUp, ArrowRight, ShieldCheck, Users } from 'lucide-react';
import { academyPaths, pathLessonCount, pathQuizCount } from '@/src/data/academy';
import { useAcademy } from '@/src/contexts/AcademyContext';
import AcademyPathCard from '@/src/components/academy/AcademyPathCard';

const STEPS = [
  { icon: MousePointerClick, title: 'Escolhe a trilha', text: 'Um diagnóstico rápido sugere o teu ponto de partida ideal.' },
  { icon: PlayCircle, title: 'Assiste às aulas', text: 'Videoaulas curtas do canal oficial, no teu ritmo e no telemóvel.' },
  { icon: ClipboardCheck, title: 'Faz o quiz', text: 'Cada módulo tem uma verificação simples para consolidar.' },
  { icon: Award, title: 'Recebe o certificado', text: 'Conclui a trilha e desbloqueia selo e benefícios na plataforma.' },
];

const BENEFITS = [
  { icon: BadgeCheck, title: 'Selo "Formado"', text: 'Aparece na tua loja e gera confiança imediata no comprador.' },
  { icon: TrendingUp, title: 'Destaque na plataforma', text: 'Lojas certificadas têm prioridade em posições de destaque.' },
  { icon: ShieldCheck, title: 'Comissão reduzida', text: 'Desconto progressivo de comissão conforme avanças de nível.' },
  { icon: Award, title: 'Certificado reconhecido', text: 'Uma credencial profissional para o teu currículo.' },
];

export default function AcademyPage() {
  const { completedLessons } = useAcademy();

  const totalLessons = academyPaths.reduce((sum, p) => sum + pathLessonCount(p), 0);
  const totalQuizzes = academyPaths.reduce((sum, p) => sum + pathQuizCount(p), 0);
  const totalCompleted = completedLessons.length;

  return (
    <>
      {/* Breadcrumb */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Academy</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/academy-hero.svg')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-primary/75 md:bg-primary/0 md:bg-gradient-to-r md:from-primary md:via-primary/85 md:to-primary/30"
          aria-hidden="true"
        />
        <div className="relative max-w-[1500px] mx-auto px-4 py-14 md:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-semibold mb-4">
              <GraduationCap size={14} /> 100% gratuito
            </span>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
              e-Shopping <span className="text-accent">Academy</span>
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-6">
              A escola do comércio digital moçambicano. Aprende do zero, no telemóvel e no teu ritmo,
              e transforma conhecimento em vendas.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#trilhas" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-semibold hover:bg-accent/90 transition-colors">
                Começar a aprender
              </a>
              <Link href="/academy/progress" className="px-6 py-3 border border-primary-foreground/30 rounded-lg font-semibold hover:bg-primary-foreground/10 transition-colors">
                Minha Academy
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { value: academyPaths.length, label: 'Trilhas de aprendizagem' },
              { value: totalLessons, label: 'Videoaulas' },
              { value: totalQuizzes, label: 'Quizzes de verificação' },
              { value: totalCompleted, label: 'Aulas concluídas' },
            ].map((s) => (
              <div key={s.label} className="bg-primary-foreground/10 border border-primary-foreground/15 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-3xl font-bold text-accent">{s.value}</p>
                <p className="text-sm text-primary-foreground/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Como funciona */}
      <section className="max-w-[1500px] mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">Como funciona</h2>
        <p className="text-muted-foreground mb-8">Do primeiro passo ao certificado, em quatro etapas simples.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="bg-card border border-border rounded-xl p-5 relative">
              <span className="absolute top-4 right-4 text-4xl font-bold text-muted/60">{i + 1}</span>
              <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <step.icon size={22} className="text-accent" />
              </div>
              <h3 className="font-semibold mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trilhas */}
      <section id="trilhas" className="max-w-[1500px] mx-auto px-4 pb-12">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap size={26} className="text-accent" />
          <h2 className="text-2xl md:text-3xl font-bold">Trilhas de aprendizagem</h2>
        </div>
        <p className="text-muted-foreground mb-8">Escolhe o teu objetivo e avança do iniciante ao avançado.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {academyPaths.map((path) => (
            <AcademyPathCard key={path.slug} path={path} />
          ))}
        </div>
      </section>

      {/* Benefícios */}
      <section className="bg-card border-y border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center">Aprender compensa</h2>
          <p className="text-muted-foreground text-center mb-8">
            O certificado não é só um diploma — é uma vantagem real dentro da plataforma.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="p-5 rounded-xl border border-border bg-background">
                <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                  <b.icon size={22} className="text-accent" />
                </div>
                <h3 className="font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-[1500px] mx-auto px-4 py-14">
        <div className="bg-gradient-to-r from-accent/15 to-primary/10 border border-border rounded-2xl p-8 md:p-12 text-center">
          <Users size={32} className="mx-auto text-accent mb-3" />
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Junto de quem quer crescer</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Junta-te a uma comunidade que aprende, ensina e vende mais em Moçambique.
          </p>
          <a href="#trilhas" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-lg font-semibold hover:bg-accent/90 transition-colors">
            Explorar as trilhas <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
