import Link from 'next/link';
import { Star, Users, BookOpen, Clock } from 'lucide-react';

interface TrendingCourse {
  id: string;
  slug: string;
  store_slug: string;
  title: string;
  instructor_name: string;
  level: string;
  duration: string;
  total_lessons: number;
  image: string | null;
  price: string;
  compare_price: string | null;
  rating: string;
  students_count: number;
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

function fmtPrice(p: string) {
  return `${Number(p || 0).toLocaleString('pt-MZ', { maximumFractionDigits: 0 })} MZN`;
}

export default function TrendingCourses({ courses }: { courses: TrendingCourse[] }) {
  if (!courses || courses.length === 0) return null;

  return (
    <section id="cursos-em-alta" className="py-12 px-4 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-accent">🎓</span> Cursos em Alta
        </h2>
        <Link href="/courses" className="text-sm text-accent hover:underline font-medium">
          Ver todos os cursos →
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 snap-x">
        {courses.map((c) => (
          <Link
            key={c.id}
            href={`/courses/${c.slug}`}
            className="shrink-0 w-[240px] sm:w-[280px] snap-start group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all"
          >
            <div className="h-36 overflow-hidden relative bg-gradient-to-br from-accent/20 to-accent/5">
              {c.image ? (
                <img
                  src={c.image}
                  alt={c.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <BookOpen size={40} className="absolute inset-0 m-auto text-accent/20" />
              )}
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 rounded-md text-xs font-medium">
                {LEVEL_LABELS[c.level] || c.level}
              </span>
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-accent transition-colors">
                {c.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Por {c.instructor_name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Star size={13} className="text-accent fill-accent" />
                  {Number(c.rating || 0).toFixed(1)}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {c.students_count || 0}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {c.duration}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-base font-bold text-accent">{fmtPrice(c.price)}</span>
                {c.compare_price && Number(c.compare_price) > Number(c.price) && (
                  <span className="text-xs text-muted-foreground line-through">
                    {fmtPrice(c.compare_price)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
