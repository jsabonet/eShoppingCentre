'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, Clock, Star, Users, BookOpen } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CourseData {
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

const levels = ['Todos', 'Iniciante', 'Intermediário', 'Avançado'];
const levelKeys = ['', 'beginner', 'intermediate', 'advanced'];

const SORTS = [
  { value: '-students_count', label: 'Em Alta' },
  { value: '-product__sales_count', label: 'Mais vendidos' },
  { value: '-product__rating', label: 'Melhor avaliados' },
  { value: '-created_at', label: 'Mais recentes' },
  { value: 'product__price', label: 'Menor preço' },
];

const PAGE_SIZE = 12;

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeLevel, setActiveLevel] = useState(0);
  const [sortBy, setSortBy] = useState(SORTS[0].value);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchCourses = useCallback(
    async (pageNum: number, reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({ page: String(pageNum), page_size: String(PAGE_SIZE) });
        if (levelKeys[activeLevel]) params.set('level', levelKeys[activeLevel]);
        if (sortBy) params.set('ordering', sortBy);
        const res = await fetch(`${API_URL}/courses/?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const items: CourseData[] = data.results || (Array.isArray(data) ? data : []);
          setCourses((prev) => (reset ? items : [...prev, ...items]));
          setHasMore(!!data.next);
          setPage(pageNum);
        } else {
          setHasMore(false);
        }
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeLevel, sortBy],
  );

  useEffect(() => {
    fetchCourses(1, true);
  }, [fetchCourses]);

  const loadMore = () => fetchCourses(page + 1, false);

  const fmtPrice = (p: string) => `${Number(p).toLocaleString('pt-MZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MZN`;

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium">Cursos</span>
          </nav>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-accent/10 rounded-full"><BookOpen size={28} className="text-accent" /></div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">Cursos Online</h1>
              <p className="text-lg text-muted-foreground">Aprenda novas habilidades com os melhores instrutores</p>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {levels.map((level, i) => (
              <button key={level} onClick={() => setActiveLevel(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  i === activeLevel ? 'bg-accent text-accent-foreground' : 'bg-card border border-border hover:bg-muted'
                }`}>{level}</button>
            ))}
          </div>
        </div>
      </div>

      <section className="max-w-[1500px] mx-auto px-4 py-10">
        {/* Ordenação */}
        <div className="flex items-center gap-2 overflow-x-auto mb-6">
          <span className="text-sm text-muted-foreground mr-1 whitespace-nowrap">Ordenar por:</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSortBy(s.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                sortBy === s.value ? 'bg-accent text-accent-foreground' : 'bg-card border border-border hover:bg-muted'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><LoadingSpinner size={32} message="A carregar cursos..." /></div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Nenhum curso encontrado</p>
            <p className="text-sm">Tente outro filtro ou volte mais tarde.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Link key={course.id} href={`/courses/${course.slug}`}
                  className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
                  <div className="h-48 overflow-hidden relative bg-gradient-to-br from-accent/20 to-accent/5">
                    {course.image ? (
                      <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <BookOpen size={48} className="absolute inset-0 m-auto text-accent/20" />
                    )}
                    <span className="absolute top-3 left-3 px-2 py-1 bg-white/90 rounded-md text-xs font-medium">
                      {LEVEL_LABELS[course.level] || course.level}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold mb-1 group-hover:text-accent transition-colors line-clamp-1">{course.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Por{' '}
                      <Link href={`/store/${course.store_slug}`} className="hover:text-accent hover:underline transition-colors">
                        {course.instructor_name}
                      </Link>
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Star size={14} className="text-accent fill-accent" />{Number(course.rating).toFixed(1)}</span>
                      <span className="flex items-center gap-1"><Users size={14} />{course.students_count}</span>
                      <span className="flex items-center gap-1"><Clock size={14} />{course.duration}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{course.total_lessons} aulas</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-accent">{fmtPrice(course.price)}</span>
                      {course.compare_price && Number(course.compare_price) > Number(course.price) && (
                        <span className="text-sm text-muted-foreground line-through">{fmtPrice(course.compare_price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'A carregar...' : 'Carregar mais cursos'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
