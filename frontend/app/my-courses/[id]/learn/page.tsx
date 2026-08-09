'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, PlayCircle, CheckCircle, ChevronDown, ChevronUp,
  Menu, X, BookOpen, Loader2, AlertTriangle, FileText, Download, Paperclip,
  HelpCircle, Trophy
} from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import CourseVideoPlayer from '@/src/components/CourseVideoPlayer';
import QuizTaker from '@/src/components/QuizTaker';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface LessonData {
  id: string;
  title: string;
  description: string;
  video_url: string;
  video_provider: string;
  cloudflare_video_uid: string;
  cloudflare_video_status: string;
  duration: string;
  is_free_preview: boolean;
  sort_order: number;
  completed?: boolean;
  watched_duration?: number;
}

interface QuizData {
  id: string;
  title: string;
  description: string;
  pass_percentage: number;
  max_attempts: number | null;
  is_required: boolean;
  sort_order: number;
  module_id: string;
  total_questions: number;
  total_points: number;
}

interface QuizAttemptSummary {
  passed: boolean | null;
  score: number | null;
  attempt_number: number;
}

interface ModuleData {
  id: string;
  title: string;
  lessons: LessonData[];
  quizzes: QuizData[];
}

export default function CourseLearnPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessExpired, setAccessExpired] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [quizAttempts, setQuizAttempts] = useState<Record<string, QuizAttemptSummary>>({});
  const [watchedMap, setWatchedMap] = useState<Record<string, number>>({});
  const [completing, setCompleting] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<{ id: string; title: string; file_url: string; file_name: string; file_size: number; file_type: string; }[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Fetch course structure + progress from single endpoint
  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/learn/`, { headers: apiHeaders() });

      if (res.ok) {
        const data = await res.json();
        setCourseTitle(data.course_title || '');
        const mods: ModuleData[] = data.modules || [];
        setModules(mods);

        // Progress
        setCompletedIds(new Set(data.completed_ids || []));

        // Quiz attempts
        setQuizAttempts(data.quiz_attempts || {});

        // Watched durations
        const wMap: Record<string, number> = {};
        mods.forEach(m => m.lessons.forEach(l => {
          if (l.watched_duration) wMap[l.id] = l.watched_duration;
        }));
        setWatchedMap(wMap);

        // Expand first module, first lesson auto-selected
        const expanded: Record<string, boolean> = {};
        mods.forEach((m, i) => { expanded[m.id] = i === 0; });
        setExpandedModules(expanded);

        // Select first lesson if none selected
        if (!currentLessonId && mods.length > 0 && mods[0].lessons.length > 0) {
          setCurrentLessonId(mods[0].lessons[0].id);
        }
      } else if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if ((body as any).detail?.includes('expirou')) {
          setAccessExpired(true);
          setModules([]);
        } else {
          setModules([]);
        }
      } else if (res.status === 404) {
        setModules([]);
      } else if (res.status === 401) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return;
      }
    } catch {} finally { setLoading(false); }
  }, [courseId, currentLessonId]);

  // Save progress on page leave
  useEffect(() => {
    const saveBeforeUnload = () => {
      if (currentLessonId && watchedMap[currentLessonId]) {
        navigator.sendBeacon(
          `${API_URL}/courses/me/lessons/${currentLessonId}/watch-progress/`,
          JSON.stringify({ watched_seconds: watchedMap[currentLessonId] })
        );
      }
    };
    window.addEventListener('beforeunload', saveBeforeUnload);
    return () => window.removeEventListener('beforeunload', saveBeforeUnload);
  }, [currentLessonId, watchedMap]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const currentLesson = modules.flatMap(m => m.lessons).find(l => l.id === currentLessonId);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedCount = completedIds.size;

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Converte duração "MM:SS" ou "H:MM:SS" para segundos
  const parseDurationSeconds = (dur: string): number => {
    if (!dur) return 1;
    const parts = dur.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(dur) || 1;
  };

  // Flatten all lessons for prev/next navigation
  const allLessons = modules.flatMap(m => m.lessons);
  const currentIndex = allLessons.findIndex(l => l.id === currentLessonId);

  const goToLesson = (lessonId: string) => {
    setCurrentLessonId(lessonId);
    setCurrentQuizId(null);
    setSidebarOpen(false);
    // Fetch attachments for this lesson
    fetch(`${API_URL}/courses/lessons/${lessonId}/attachments/`, { headers: apiHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then(data => setAttachments(data || []))
      .catch(() => setAttachments([]));
    // Expand module containing this lesson
    for (const mod of modules) {
      if (mod.lessons.some(l => l.id === lessonId)) {
        setExpandedModules(prev => ({ ...prev, [mod.id]: true }));
        break;
      }
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) goToLesson(allLessons[currentIndex - 1].id);
  };

  const goToNext = () => {
    if (currentIndex < allLessons.length - 1) goToLesson(allLessons[currentIndex + 1].id);
  };

  const goToQuiz = (quizId: string, moduleId: string) => {
    setCurrentLessonId(null);
    setCurrentQuizId(quizId);
    setSidebarOpen(false);
    setAttachments([]);
    // Expand the parent module
    setExpandedModules(prev => ({ ...prev, [moduleId]: true }));
  };

  const saveWatchProgress = useCallback(async (lessonId: string, seconds: number) => {
    try {
      await fetch(`${API_URL}/courses/me/lessons/${lessonId}/watch-progress/`, {
        method: 'PATCH',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched_seconds: seconds }),
      });
    } catch {}
  }, [API_URL]);

  const handleVideoProgress = useCallback((seconds: number) => {
    if (!currentLessonId) return;
    setWatchedMap(prev => ({ ...prev, [currentLessonId]: seconds }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveWatchProgress(currentLessonId, seconds);
    }, 5000);
  }, [currentLessonId, saveWatchProgress]);

  const handleVideoEnded = useCallback(async () => {
    if (!currentLessonId || completing) return;
    setCompleting(true);
    try {
      // Save final position
      await saveWatchProgress(currentLessonId, watchedMap[currentLessonId] || 0);
      // Mark complete
      const res = await fetch(`${API_URL}/courses/me/lessons/${currentLessonId}/complete/`, {
        method: 'PATCH', headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setCompletedIds(prev => new Set([...prev, currentLessonId]));
        // Auto-advance after short delay
        if (currentIndex < allLessons.length - 1) {
          setTimeout(() => goToLesson(allLessons[currentIndex + 1].id), 1500);
        }
      }
    } catch {} finally { setCompleting(false); }
  }, [currentLessonId, completing, currentIndex, allLessons, watchedMap, saveWatchProgress]);

  const markComplete = async () => {
    if (!currentLessonId || completing) return;
    setCompleting(true);
    try {
      await saveWatchProgress(currentLessonId, watchedMap[currentLessonId] || 0);
      const res = await fetch(`${API_URL}/courses/me/lessons/${currentLessonId}/complete/`, {
        method: 'PATCH', headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setCompletedIds(prev => new Set([...prev, currentLessonId]));
        // Auto-advance to next lesson
        if (currentIndex < allLessons.length - 1) {
          setTimeout(() => goToLesson(allLessons[currentIndex + 1].id), 800);
        }
      }
    } catch {} finally { setCompleting(false); }
  };

  const sidebar = (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <Link href="/my-courses" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h2 className="font-bold text-sm line-clamp-2">{courseTitle || 'Curso'}</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <span className="text-accent font-medium">{completedCount}/{totalLessons}</span> aulas concluidas
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {modules.map((mod) => (
          <div key={mod.id} className="border-b border-border">
            <button onClick={() => toggleModule(mod.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-muted/50 transition-colors text-left">
              <span className="truncate">{mod.title}</span>
              {expandedModules[mod.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedModules[mod.id] && (
              <div className="divide-y divide-border">
                {mod.lessons.map((lesson) => {
                  const isCompleted = completedIds.has(lesson.id);
                  const isCurrent = lesson.id === currentLessonId;
                  return (
                    <button key={lesson.id}
                      onClick={() => goToLesson(lesson.id)}
                      className={`w-full px-4 py-2.5 pl-8 flex items-center gap-3 text-sm transition-colors text-left ${
                        isCurrent ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-muted/50'
                      }`}>
                      {isCompleted ? (
                        <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                      ) : isCurrent ? (
                        <PlayCircle size={16} className="text-accent flex-shrink-0" />
                      ) : (
                        <PlayCircle size={16} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className={`truncate block ${isCompleted ? 'text-muted-foreground' : isCurrent ? 'font-medium' : ''}`}>
                          {lesson.title}
                        </span>
                        {/* Progress bar per lesson */}
                        {isCurrent && !isCompleted && (watchedMap[lesson.id] || 0) > 0 && lesson.duration && (
                          <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-accent/60 rounded-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, ((watchedMap[lesson.id] || 0) / parseDurationSeconds(lesson.duration)) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {lesson.duration && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.duration}</span>
                      )}
                    </button>
                  );
                })}

                {/* Quizzes within this module */}
                {(mod.quizzes || []).map((quiz) => {
                  const isCurrent = quiz.id === currentQuizId;
                  const attempt = quizAttempts[quiz.id];
                  const isPassed = attempt?.passed === true;
                  const isFailed = attempt?.passed === false;
                  return (
                    <button
                      key={quiz.id}
                      onClick={() => goToQuiz(quiz.id, mod.id)}
                      className={`w-full px-4 py-2.5 pl-8 flex items-center gap-3 text-sm transition-colors text-left ${
                        isCurrent ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-muted/50'
                      }`}
                    >
                      {isPassed ? (
                        <Trophy size={16} className="text-amber-500 flex-shrink-0" />
                      ) : isFailed ? (
                        <HelpCircle size={16} className="text-red-400 flex-shrink-0" />
                      ) : isCurrent ? (
                        <HelpCircle size={16} className="text-accent flex-shrink-0" />
                      ) : (
                        <HelpCircle size={16} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className={`truncate block ${isCurrent ? 'font-medium' : ''}`}>
                          {quiz.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {quiz.total_questions} questões · {quiz.total_points} pts
                          {attempt && ` · ${attempt.score}%`}
                        </span>
                      </div>
                      {quiz.max_attempts && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {quiz.max_attempts}x
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size={36} message="A carregar curso..." />
      </div>
    );
  }

  if (accessExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" />
          <h1 className="text-xl font-bold mb-2">Acesso Expirado</h1>
          <p className="text-muted-foreground mb-6">O periodo de acesso a este curso terminou.</p>
          <Link href="/my-courses" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium">
            Voltar aos Meus Cursos
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = currentLessonId ? completedIds.has(currentLessonId) : false;

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
          <span className="text-sm font-medium truncate">
            {currentQuizId
              ? (modules.flatMap(m => m.quizzes || []).find(q => q.id === currentQuizId)?.title || 'Quiz')
              : (currentLesson?.title || 'Seleccione uma aula')
            }
          </span>
        </div>

        {/* Quiz Content Area */}
        {currentQuizId ? (
          <div className="flex-1 bg-background overflow-y-auto">
            <div className="max-w-3xl mx-auto p-6">
              <button
                onClick={() => setCurrentQuizId(null)}
                className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Voltar às aulas
              </button>
              <QuizTaker courseId={courseId} quizId={currentQuizId} />
            </div>
          </div>
        ) : (
          <>
            {/* Video / Content Area */}
            <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
              {currentLesson ? (
                currentLesson.cloudflare_video_uid ? (
                  <CourseVideoPlayer
                    key={currentLesson.id}
                    lessonId={currentLesson.id}
                    startTime={watchedMap[currentLesson.id] || 0}
                    durationSeconds={parseDurationSeconds(currentLesson.duration)}
                    onProgress={handleVideoProgress}
                    onEnded={handleVideoEnded}
                  />
                ) : currentLesson.video_url ? (
                  <iframe
                    src={currentLesson.video_url
                      .replace('watch?v=', 'embed/')
                      .replace('vimeo.com/', 'player.vimeo.com/video/')
                      .replace('youtu.be/', 'youtube.com/embed/')}
                    className="w-full h-full"
                    allowFullScreen
                    title={currentLesson.title}
                  />
                ) : (
                  <div className="text-center text-white/60 p-8">
                    <BookOpen size={64} className="mx-auto mb-4 text-white/30" />
                    <p className="text-lg font-medium mb-2">Sem video</p>
                    <p className="text-sm text-white/40">
                      {currentLesson.description || 'Esta aula nao tem video.'}
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center text-white/60 p-8">
                  <BookOpen size={64} className="mx-auto mb-4 text-white/30" />
                  <p className="text-lg font-medium mb-2">Seleccione uma aula</p>
                  <p className="text-sm text-white/40">Navegue pela barra lateral para comecar.</p>
                </div>
              )}
            </div>

            {/* Description & Attachments */}
            {currentLesson && (currentLesson.description || attachments.length > 0) && (
              <div className="bg-card border-t border-border px-4 py-4 space-y-3">
                {currentLesson.description && (
                  <div>
                    <h3 className="text-sm font-bold mb-1">Descricao</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{currentLesson.description}</p>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold mb-1 flex items-center gap-1.5">
                      <Paperclip size={14} /> Anexos ({attachments.length})
                    </h3>
                    <div className="space-y-1">
                      {attachments.map(att => (
                        <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors border border-border">
                          <FileText size={16} className="text-accent shrink-0" />
                          <span className="flex-1 truncate">{att.file_name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(att.file_size)}</span>
                          <Download size={14} className="text-muted-foreground shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Navigation */}
            <div className="bg-card border-t border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPrev}
                  disabled={currentIndex <= 0}
                  className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Aula Anterior
                </button>

                <button
                  onClick={markComplete}
                  disabled={!currentLessonId || isCompleted || completing}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    isCompleted
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-accent text-accent-foreground hover:bg-accent/90'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {completing ? (
                    <><Loader2 size={16} className="animate-spin" /> A guardar...</>
                  ) : isCompleted ? (
                    <><CheckCircle size={16} /> Concluida</>
                  ) : (
                    <><CheckCircle size={16} /> Marcar como Concluida</>
                  )}
                </button>

                <button
                  onClick={goToNext}
                  disabled={currentIndex >= allLessons.length - 1}
                  className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Proxima Aula
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
