'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Clock, Send } from 'lucide-react';
import { quizzesAPI, Quiz, QuizQuestion, QuizAttempt, QuizSubmitPayload } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

interface Props {
  courseId: string;
  moduleId?: string;
  quizId?: string; // pre-selected quiz ID (for sidebar navigation)
}

type QuizState = 'loading' | 'list' | 'taking' | 'result';

export default function QuizTaker({ courseId, moduleId, quizId }: Props) {
  const [state, setState] = useState<QuizState>('loading');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Load quizzes for this course
  const fetchQuizzes = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/quizzes/`, { headers: apiHeaders() });
      if (res.ok) {
        const data: Quiz[] = await res.json();
        // Filter by module if specified
        const filtered = moduleId ? data.filter(q => q.module_id === moduleId) : data;
        setQuizzes(filtered);

        // If a quizId was pre-selected, go directly to that quiz
        if (quizId) {
          const target = filtered.find(q => q.id === quizId);
          if (target) {
            // Show the single quiz for direct selection
            setQuizzes([target]);
            setState('list');
            return;
          }
        }

        setState('list');
      } else {
        setQuizzes([]);
        setState('list');
      }
    } catch {
      setError('Erro ao carregar quizzes.');
      setState('list');
    }
  }, [courseId, moduleId, quizId]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [timerInterval]);

  // Start a quiz
  const startQuiz = async (quiz: Quiz) => {
    setError('');
    setState('loading');
    try {
      const res = await fetch(`${API_URL}/courses/quizzes/${quiz.id}/attempt/`, {
        method: 'POST', headers: apiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentQuiz(data.quiz);
        setAnswers({});
        setAttempt(null);
        setState('taking');
        // Start timer
        setTimer(0);
        const interval = setInterval(() => setTimer(prev => prev + 1), 1000);
        setTimerInterval(interval);
      } else {
        const err = await res.json().catch(() => ({}));
        setError((err as any).detail || 'Erro ao iniciar quiz.');
        setState('list');
      }
    } catch {
      setError('Erro de rede ao iniciar quiz.');
      setState('list');
    }
  };

  // Set answer for a question
  const setAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Submit quiz
  const submitQuiz = async () => {
    if (!currentQuiz) return;

    // Build payload
    const payload: QuizSubmitPayload = {
      answers: currentQuiz.questions!.map(q => {
        const answer = answers[q.id];
        const base: any = { question_id: q.id, open_text_answer: '' };

        if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
          base.selected_option_id = answer || null;
        } else if (q.question_type === 'multiple_select') {
          base.selected_option_ids = answer || [];
        } else if (q.question_type === 'open_text') {
          base.open_text_answer = answer || '';
        }

        return base;
      }),
    };

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/courses/quizzes/${currentQuiz.id}/submit/`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        // Fetch full result with answers
        const resultRes = await fetch(`${API_URL}/courses/quizzes/${currentQuiz.id}/results/`, {
          headers: apiHeaders(),
        });
        if (resultRes.ok) {
          setAttempt(await resultRes.json());
        }
        setState('result');
        if (timerInterval) clearInterval(timerInterval);
      } else {
        const err = await res.json().catch(() => ({}));
        setError((err as any).detail || 'Erro ao submeter quiz.');
      }
    } catch {
      setError('Erro de rede ao submeter.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── List View ───
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">A carregar...</span>
      </div>
    );
  }

  if (state === 'list') {
    if (quizzes.length === 0) return null;

    return (
      <div className="border-t border-border pt-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <AlertTriangle size={14} className="text-amber-500" />
          Avaliações
        </h3>
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>
        )}
        <div className="space-y-2">
          {quizzes.map(quiz => (
            <div
              key={quiz.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{quiz.title}</p>
                <p className="text-xs text-muted-foreground">
                  {quiz.total_questions} questões · {quiz.total_points} pts · Aprovação: {quiz.pass_percentage}%
                  {quiz.max_attempts && ` · Max. ${quiz.max_attempts} tentativas`}
                </p>
              </div>
              <button
                onClick={() => startQuiz(quiz)}
                className="px-4 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent/90"
              >
                Iniciar
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Taking View ───
  if (state === 'taking' && currentQuiz) {
    const questions = currentQuiz.questions || [];
    const answeredCount = Object.keys(answers).length;

    return (
      <div className="border-t border-border pt-4 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">{currentQuiz.title}</h3>
            <p className="text-xs text-muted-foreground">
              {questions.length} questões · {currentQuiz.total_points} pts · {currentQuiz.pass_percentage}% para aprovar
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>{formatTime(timer)}</span>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((question, qIdx) => (
            <div key={question.id} className="border border-border rounded-lg p-3 bg-muted/10">
              <p className="text-sm font-medium mb-2">
                <span className="text-muted-foreground mr-1">{qIdx + 1}.</span>
                {question.text}
                <span className="text-xs text-muted-foreground ml-2">({question.points} pts)</span>
              </p>

              {/* Multiple Choice / True-False */}
              {(question.question_type === 'multiple_choice' || question.question_type === 'true_false') && (
                <div className="space-y-1.5">
                  {question.options.map(option => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                        answers[question.id] === option.id
                          ? 'bg-accent/10 border border-accent'
                          : 'border border-transparent hover:bg-muted/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        checked={answers[question.id] === option.id}
                        onChange={() => setAnswer(question.id, option.id)}
                        className="accent-accent"
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
              )}

              {/* Multiple Select */}
              {question.question_type === 'multiple_select' && (
                <div className="space-y-1.5">
                  {question.options.map(option => {
                    const selected = (answers[question.id] || []).includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${
                          selected
                            ? 'bg-accent/10 border border-accent'
                            : 'border border-transparent hover:bg-muted/20'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const current = answers[question.id] || [];
                            setAnswer(
                              question.id,
                              current.includes(option.id)
                                ? current.filter((id: string) => id !== option.id)
                                : [...current, option.id]
                            );
                          }}
                          className="accent-accent rounded"
                        />
                        {option.text}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Open Text */}
              {question.question_type === 'open_text' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                  placeholder="Escreva a sua resposta..."
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (timerInterval) clearInterval(timerInterval);
              setState('list');
              setCurrentQuiz(null);
              setAnswers({});
            }}
            className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Sair
          </button>
          <button
            onClick={submitQuiz}
            disabled={submitting || answeredCount < questions.length}
            className="px-6 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> A submeter...
              </>
            ) : (
              <>
                <Send size={14} /> Submeter ({answeredCount}/{questions.length})
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Result View ───
  if (state === 'result' && attempt) {
    const passed = attempt.passed;
    const score = attempt.score ?? 0;
    return (
      <div className="border-t border-border pt-4 mt-4">
        <div className={`p-5 rounded-xl border-2 mb-6 text-center ${
          passed
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex justify-center mb-3">
            {passed ? (
              <CheckCircle size={48} className="text-green-500" />
            ) : (
              <XCircle size={48} className="text-red-500" />
            )}
          </div>
          <h3 className="text-lg font-bold mb-1">
            {passed ? 'Parabéns! Aprovado!' : 'Não foi desta vez'}
          </h3>
          <p className="text-3xl font-bold mb-2" style={{ color: passed ? '#16a34a' : '#dc2626' }}>
            {score}%
          </p>
          <p className="text-sm text-muted-foreground">
            {attempt.earned_points} de {attempt.total_points} pontos · Mínimo: {attempt.pass_percentage}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Tentativa #{attempt.attempt_number}
          </p>
        </div>

        {/* Answer Review */}
        {attempt.answers && attempt.answers.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold mb-2">Revisão das Respostas</h4>
            {attempt.answers.map((answer, idx) => (
              <div
                key={answer.id}
                className={`p-3 rounded-lg border text-sm ${
                  answer.is_correct === true
                    ? 'border-green-200 bg-green-50'
                    : answer.is_correct === false
                    ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  {answer.is_correct === true ? (
                    <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  ) : answer.is_correct === false ? (
                    <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{idx + 1}. {answer.question_text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tipo: {answer.question_type === 'multiple_choice' ? 'Múltipla Escolha'
                        : answer.question_type === 'multiple_select' ? 'Seleção Múltipla'
                        : answer.question_type === 'true_false' ? 'V/F'
                        : 'Texto Livre'}
                    </p>
                    {answer.selected_option_text && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Resposta: </span>
                        <span className={answer.is_correct === false ? 'text-red-600 font-medium' : ''}>
                          {answer.selected_option_text}
                        </span>
                      </p>
                    )}
                    {answer.selected_options_texts && answer.selected_options_texts.length > 0 && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Respostas: </span>
                        {answer.selected_options_texts.join(', ')}
                      </p>
                    )}
                    {answer.open_text_answer && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Resposta: </span>
                        {answer.open_text_answer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              setState('list');
              setCurrentQuiz(null);
              setAttempt(null);
              setAnswers({});
              fetchQuizzes();
            }}
            className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Voltar
          </button>
          {!passed && currentQuiz && (currentQuiz.max_attempts === null || attempt.attempt_number < (currentQuiz.max_attempts || 3)) && (
            <button
              onClick={() => startQuiz(currentQuiz)}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90"
            >
              Tentar Novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
