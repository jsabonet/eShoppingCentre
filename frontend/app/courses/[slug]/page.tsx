'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Clock, Star, Users, BookOpen, PlayCircle, CheckCircle, ShoppingCart } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import ReviewList from '@/src/components/ReviewList';
import ReviewForm from '@/src/components/ReviewForm';
import { useCart } from '@/src/contexts/CartContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

interface LessonData {
  id: string;
  title: string;
  description: string;
  duration: string;
  is_free_preview: boolean;
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: LessonData[];
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: LessonData[];
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  price: string;
  compare_price: string | null;
  rating: string;
  students_count: number;
  image: string | null;
  instructor_name: string;
  store_slug: string;
  level: string;
  duration: string;
  total_lessons: number;
  certificate_enabled: boolean;
  preview_video_url: string;
  modules: ModuleData[];
  product: string;
  access_duration_days: number | null;
  is_enrolled?: boolean;
}

export default function CourseDetailPage() {
  const { slug: paramsSlug } = useParams<{ slug: string }>();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundErr, setNotFoundErr] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const { addToCart } = useCart();
  // ─── Reviews ───
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeRatingFilter, setActiveRatingFilter] = useState<number | null>(null);
  const [enrollmentIdForReview, setEnrollmentIdForReview] = useState<string | null>(null);
  const [alreadyReviewedCourse, setAlreadyReviewedCourse] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [reviewFormSuccess, setReviewFormSuccess] = useState('');

  useEffect(() => {
    if (!paramsSlug) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/courses/${paramsSlug}/`);
        if (res.status === 404) { setNotFoundErr(true); return; }
        if (res.ok) {
          const data = await res.json();
          setCourse(data);
          // Estado de inscrição fornecido pela API (mais fiável)
          if (typeof data.is_enrolled === 'boolean') {
            setIsEnrolled(data.is_enrolled);
          }
          // Check if user is enrolled
          const token = localStorage.getItem('access_token');
          if (token && data.id) {
            const enrRes = await fetch(`${API_URL}/courses/me/enrollments/`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (enrRes.ok) {
              const enrData = await enrRes.json();
              const enrollments = enrData.results || enrData || [];
              setIsEnrolled(enrollments.some((e: any) => e.course_id === data.id));
              // Get enrollment ID for review
              const myEnr = enrollments.find((e: any) => e.course_id === data.id);
              if (myEnr) setEnrollmentIdForReview(myEnr.id);
              // Check if already reviewed
              try {
                const revsRes = await fetch(`${API_URL}/courses/me/reviews/`, {
                  headers: { 'Authorization': `Bearer ${token}` },
                });
                if (revsRes.ok) {
                  const revsData = await revsRes.json();
                  const myReviews = revsData.results || revsData || [];
                  setAlreadyReviewedCourse(myReviews.some((r: any) => r.enrollment_id === myEnr?.id));
                }
              } catch {}
            }
          }
          // ─── Fetch reviews ───
          setReviewsLoading(true);
          try {
            const [rvRes, stRes] = await Promise.all([
              fetch(`${API_URL}/courses/${paramsSlug}/reviews/${activeRatingFilter ? `?rating=${activeRatingFilter}` : ''}`),
              fetch(`${API_URL}/courses/${paramsSlug}/reviews/stats/`),
            ]);
            if (rvRes.ok) {
              const rvData = await rvRes.json();
              setReviews(rvData.results || rvData || []);
            }
            if (stRes.ok) {
              const stData = await stRes.json();
              setReviewStats(stData);
            }
          } catch {} finally { setReviewsLoading(false); }
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [paramsSlug]);

  // Re-fetch reviews when filter changes
  useEffect(() => {
    if (!paramsSlug) return;
    (async () => {
      setReviewsLoading(true);
      try {
        const url = `${API_URL}/courses/${paramsSlug}/reviews/${activeRatingFilter ? `?rating=${activeRatingFilter}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.results || data || []);
        }
      } catch {} finally { setReviewsLoading(false); }
    })();
  }, [activeRatingFilter, paramsSlug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size={32} message="A carregar curso..." />
      </div>
    );
  }

  if (notFoundErr || !course) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <BookOpen size={64} className="text-muted-foreground/30 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Curso não encontrado</h1>
        <p className="text-muted-foreground mb-6">O curso que procura não existe ou foi removido.</p>
        <Link href="/courses" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium">
          Ver todos os cursos
        </Link>
      </div>
    );
  }

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const fmtPrice = (p: string) => `${Number(p).toLocaleString('pt-MZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MZN`;
  const accessLabel = course.access_duration_days
    ? `Acesso por ${course.access_duration_days} dias`
    : 'Acesso vitalício';
  const features = [
    course.duration || `${totalLessons} aulas`,
    `${totalLessons} aulas em ${course.modules.length} módulos`,
    course.certificate_enabled ? 'Certificado de conclusão' : null,
    accessLabel,
    'Suporte via WhatsApp',
  ].filter(Boolean);

  const handleBuy = () => {
    if (!course) return;
    addToCart({
      id: course.product,
      name: course.title,
      slug: paramsSlug,
      description: course.description || '',
      price: Number(course.price),
      image: course.image || '',
      category: '',
      rating: Number(course.rating) || 0,
      reviewCount: 0,
      inStock: true,
      productType: 'course' as const,
    } as any);
    window.location.href = '/checkout';
  };

  const handleReviewSubmit = async (data: { rating: number; title: string; body: string }) => {
    if (!enrollmentIdForReview) return;
    setReviewSubmitting(true);
    setReviewFormError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/reviews/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ enrollment_id: enrollmentIdForReview, ...data, is_public: true }),
      });
      if (res.ok) {
        setReviewFormSuccess('Avaliação enviada! 🎉');
        setAlreadyReviewedCourse(true);
        setTimeout(() => setShowReviewForm(false), 1500);
        refreshReviews();
      } else {
        const err = await res.json();
        setReviewFormError(err.detail || Object.values(err).flat().join(', ') || 'Erro.');
      }
    } catch { setReviewFormError('Erro de rede.'); }
    finally { setReviewSubmitting(false); }
  };

  const refreshReviews = async () => {
    const [rvRes, stRes] = await Promise.all([
      fetch(`${API_URL}/courses/${paramsSlug}/reviews/${activeRatingFilter ? `?rating=${activeRatingFilter}` : ''}`),
      fetch(`${API_URL}/courses/${paramsSlug}/reviews/stats/`),
    ]);
    if (rvRes.ok) { const d = await rvRes.json(); setReviews(d.results || d || []); }
    if (stRes.ok) { const d = await stRes.json(); setReviewStats(d); }
  };

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground">Início</Link>
            <ChevronRight size={14} />
            <Link href="/courses" className="hover:text-foreground">Cursos</Link>
            <ChevronRight size={14} />
            <span className="text-foreground font-medium line-clamp-1">{course.title}</span>
          </nav>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium">
                  {LEVEL_LABELS[course.level] || course.level}
                </span>
                <span className="flex items-center gap-1"><Star size={14} className="text-accent fill-accent" />{Number(course.rating).toFixed(1)}</span>
                <span className="flex items-center gap-1"><Users size={14} />{course.students_count} alunos</span>
                <span className="flex items-center gap-1"><Clock size={14} />{course.duration}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">{course.title}</h1>
              <p className="text-lg text-muted-foreground mb-6">{course.description}</p>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                  {course.instructor_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Por{' '}
                    <Link href={`/store/${course.store_slug}`} className="hover:text-accent hover:underline transition-colors">
                      {course.instructor_name || 'Instrutor'}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">Instrutor na plataforma</p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-32">
                <div className="h-48 bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center overflow-hidden">
                  {course.image ? (
                    <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={64} className="text-accent/20" />
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl font-bold text-accent">{fmtPrice(course.price)}</span>
                    {course.compare_price && Number(course.compare_price) > Number(course.price) && (
                      <span className="text-lg text-muted-foreground line-through">{fmtPrice(course.compare_price)}</span>
                    )}
                  </div>
                  <button onClick={handleBuy}
                    disabled={isEnrolled}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mb-3 ${
                      isEnrolled
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : 'bg-accent text-accent-foreground hover:bg-accent/90'
                    }`}>
                    {isEnrolled ? (
                      <><CheckCircle size={18} /> Já inscrito</>
                    ) : (
                      <><ShoppingCart size={18} /> Comprar Agora</>
                    )}
                  </button>
                  {isEnrolled && (
                    <Link href="/my-courses"
                      className="block w-full text-center px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors mb-3">
                      Ir para Meus Cursos
                    </Link>
                  )}
                  <div className="space-y-2 text-sm">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2"><CheckCircle size={16} className="text-green-600" /> {f}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum */}
      <section className="max-w-[1500px] mx-auto px-4 py-10">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Conteúdo do Curso</h2>
          {course.modules.length === 0 ? (
            <p className="text-muted-foreground">O currículo deste curso ainda está a ser preparado.</p>
          ) : (
            <div className="space-y-4">
              {course.modules.map((mod) => (
                <div key={mod.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4 bg-muted/30 flex items-center justify-between">
                    <h3 className="font-bold">{mod.title}</h3>
                    <span className="text-sm text-muted-foreground">{mod.lessons.length} aulas</span>
                  </div>
                  <div className="divide-y divide-border">
                    {mod.lessons.map((lesson) => (
                      <div key={lesson.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                        <PlayCircle size={16} className="text-muted-foreground flex-shrink-0" />
                        <span>{lesson.title}</span>
                        {lesson.duration && <span className="ml-auto text-xs text-muted-foreground">{lesson.duration}</span>}
                        {lesson.is_free_preview && (
                          <span className="text-xs text-green-600 font-medium">Grátis</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="max-w-[1500px] mx-auto px-4 py-10 border-t border-border">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-6">Avaliações dos Alunos</h2>
          <ReviewList
            reviews={reviews}
            stats={reviewStats}
            loading={reviewsLoading}
            activeRatingFilter={activeRatingFilter}
            onFilterChange={setActiveRatingFilter}
            canReview={isEnrolled}
            alreadyReviewed={alreadyReviewedCourse}
            onWriteReview={() => { setShowReviewForm(true); setReviewFormError(''); setReviewFormSuccess(''); }}
            emptyMessage="Este curso ainda não tem avaliações."
          />
        </div>
      </section>

      <ReviewForm
        open={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        onSubmit={handleReviewSubmit}
        subjectName={course?.title || ''}
        submitting={reviewSubmitting}
        error={reviewFormError}
        success={reviewFormSuccess}
      />
    </>
  );
}
