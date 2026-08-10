'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Save, X, HelpCircle, CheckCircle, AlertTriangle, Loader2, Eye, Edit3
} from 'lucide-react';
import { quizzesAPI, Quiz, QuizQuestion, AnswerOption } from '@/src/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

interface Props {
  moduleId: string;
  courseId: string;
}

export default function QuizBuilder({ moduleId, courseId }: Props) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [quizSummary, setQuizSummary] = useState<Record<string, boolean>>({});

  const fetchQuizzes = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/quizzes/`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Filter quizzes for this module
        const moduleQuizzes = (data || []).filter((q: Quiz) => q.module_id === moduleId);
        setQuizzes(moduleQuizzes);
      }
    } catch {} finally { setLoading(false); }
  }, [courseId, moduleId]);

  useEffect(() => { fetchQuizzes(); }, [fetchQuizzes]);

  // ─── Quiz CRUD ───
  const addQuiz = async () => {
    const title = prompt('Título do quiz:');
    if (!title?.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API_URL}/courses/modules/${moduleId}/quizzes/`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ title: title.trim(), description: '' }),
      });
      await fetchQuizzes();
    } catch (err: any) {
      setError('Erro ao criar quiz: ' + (err.message || 'desconhecido'));
    } finally { setSaving(false); }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Remover este quiz e todas as suas questões?')) return;
    try {
      await fetch(`${API_URL}/courses/quizzes/${quizId}/delete/`, { method: 'DELETE', headers: apiHeaders() });
      if (expandedQuiz === quizId) setExpandedQuiz(null);
      await fetchQuizzes();
    } catch (err: any) {
      setError('Erro ao remover quiz: ' + (err.message || 'desconhecido'));
    }
  };

  const updateQuiz = async (quizId: string, field: string, value: any) => {
    try {
      await fetch(`${API_URL}/courses/quizzes/${quizId}/update/`, {
        method: 'PUT', headers: apiHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, [field]: value } : q));
    } catch {}
  };

  // ─── Fetch full quiz with questions ───
  const fetchQuizDetail = async (quizId: string) => {
    try {
      const res = await fetch(`${API_URL}/courses/quizzes/${quizId}/`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, questions: data.questions } : q));
      }
    } catch {}
  };

  const toggleQuiz = (quizId: string) => {
    if (expandedQuiz === quizId) {
      setExpandedQuiz(null);
      setExpandedQuestion(null);
    } else {
      setExpandedQuiz(quizId);
      setExpandedQuestion(null);
      // Fetch full detail with questions
      const quiz = quizzes.find(q => q.id === quizId);
      if (quiz && !quiz.questions) fetchQuizDetail(quizId);
    }
  };

  // ─── Question CRUD ───
  const addQuestion = async (quizId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/courses/quizzes/${quizId}/questions/`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({
          text: 'Nova questão',
          question_type: 'multiple_choice',
          points: 1,
          options: [
            { text: 'Opção A', is_correct: false, sort_order: 0 },
            { text: 'Opção B', is_correct: true, sort_order: 1 },
          ],
        }),
      });
      if (res.ok) await fetchQuizDetail(quizId);
    } catch {} finally { setSaving(false); }
  };

  const updateQuestion = async (quizId: string, questionId: string, data: any) => {
    try {
      await fetch(`${API_URL}/courses/quizzes/questions/${questionId}/`, {
        method: 'PUT', headers: apiHeaders(),
        body: JSON.stringify(data),
      });
      await fetchQuizDetail(quizId);
    } catch {}
  };

  const deleteQuestion = async (quizId: string, questionId: string) => {
    if (!confirm('Remover esta questão?')) return;
    try {
      await fetch(`${API_URL}/courses/quizzes/questions/${questionId}/delete/`, {
        method: 'DELETE', headers: apiHeaders(),
      });
      await fetchQuizDetail(quizId);
    } catch {}
  };

  // ─── Toggle correct answer ───
  const toggleCorrectOption = async (
    quizId: string,
    question: QuizQuestion,
    optionId: string,
    questionType: string
  ) => {
    if (!question.options) return;

    // Optimistic local update — feedback imediato
    const optimisticOptions = question.options.map(o => ({
      id: o.id,
      text: o.text,
      is_correct:
        questionType === 'multiple_select'
          ? o.id === optionId ? !o.is_correct : o.is_correct
          : o.id === optionId ? !o.is_correct : false,
      sort_order: o.sort_order,
    }));

    setQuizzes(prev =>
      prev.map(q =>
        q.id === quizId
          ? {
              ...q,
              questions: q.questions?.map(qq =>
                qq.id === question.id ? { ...qq, options: optimisticOptions } : qq
              ),
            }
          : q
      )
    );

    // Persist on server
    try {
      const res = await fetch(`${API_URL}/courses/quizzes/questions/${question.id}/`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({
          text: question.text,
          question_type: question.question_type,
          points: question.points,
          options: optimisticOptions,
        }),
      });
      if (!res.ok) {
        // Revert on failure
        await fetchQuizDetail(quizId);
        setError('Erro ao guardar. Tente novamente.');
      }
      // Sucesso: estado otimista ja esta correto, nao precisa de re-fetch
    } catch {
      await fetchQuizDetail(quizId);
      setError('Erro de rede ao guardar.');
    }
  };

  // ─── Add option ───
  const addOption = async (quizId: string, question: QuizQuestion) => {
    const newOptions = [
      ...question.options.map(o => ({ id: o.id, text: o.text, is_correct: o.is_correct, sort_order: o.sort_order })),
      { text: 'Nova opção', is_correct: false, sort_order: question.options.length },
    ];
    await updateQuestion(quizId, question.id, {
      text: question.text,
      question_type: question.question_type,
      points: question.points,
      options: newOptions,
    });
  };

  // ─── Update option text ───
  const updateOptionText = async (
    quizId: string,
    question: QuizQuestion,
    optionId: string,
    newText: string
  ) => {
    const newOptions = question.options.map(o => ({
      ...o,
      text: o.id === optionId ? newText : o.text,
    }));
    await updateQuestion(quizId, question.id, {
      text: question.text,
      question_type: question.question_type,
      points: question.points,
      options: newOptions,
    });
  };

  // ─── Delete option ───
  const deleteOption = async (quizId: string, question: QuizQuestion, optionId: string) => {
    const newOptions = question.options
      .filter(o => o.id !== optionId)
      .map((o, i) => ({ ...o, sort_order: i }));
    await updateQuestion(quizId, question.id, {
      text: question.text,
      question_type: question.question_type,
      points: question.points,
      options: newOptions,
    });
  };

  const questionTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      multiple_choice: 'Múltipla Escolha',
      true_false: 'Verdadeiro/Falso',
      open_text: 'Texto Livre',
      multiple_select: 'Seleção Múltipla',
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        <Loader2 size={12} className="inline animate-spin mr-1" />
        A carregar quizzes...
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <HelpCircle size={14} />
          Quizzes / Avaliações
        </h4>
        <button
          onClick={addQuiz}
          disabled={saving}
          className="px-3 py-1 bg-accent text-accent-foreground rounded-md text-xs font-medium hover:bg-accent/90 flex items-center gap-1"
        >
          <Plus size={12} /> Novo Quiz
        </button>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>
      )}

      {quizzes.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          Nenhum quiz neste módulo. Clique em &quot;Novo Quiz&quot; para criar.
        </p>
      )}

      <div className="space-y-2">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="border border-border rounded-lg bg-muted/20 overflow-hidden">
            {/* Quiz Header */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 hover:bg-muted/30 transition-colors">
              <button onClick={() => toggleQuiz(quiz.id)} className="p-0.5 shrink-0">
                {expandedQuiz === quiz.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <HelpCircle size={14} className="text-accent shrink-0" />
              <input
                type="text"
                defaultValue={quiz.title}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== quiz.title)
                    updateQuiz(quiz.id, 'title', e.target.value.trim());
                }}
                className="flex-1 min-w-30 px-1.5 py-0.5 text-sm font-medium bg-transparent border border-transparent hover:border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Título do quiz..."
              />
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{quiz.total_questions} questões</span>
                <button
                  onClick={() => deleteQuiz(quiz.id)}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Quiz Settings & Questions */}
            {expandedQuiz === quiz.id && (
              <div className="px-2 sm:px-3 pb-3 space-y-3 border-t border-border pt-2">
                {/* Toggle: Edit / Summary */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    {quizSummary[quiz.id] ? 'Pré-visualização do Quiz' : 'Configuração do Quiz'}
                  </span>
                  <button
                    onClick={() => setQuizSummary(prev => ({ ...prev, [quiz.id]: !prev[quiz.id] }))}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-muted transition-colors"
                  >
                    {quizSummary[quiz.id] ? (
                      <><Edit3 size={11} /> Editar</>
                    ) : (
                      <><Eye size={11} /> Ver Resumo</>
                    )}
                  </button>
                </div>

                {quizSummary[quiz.id] ? (
                  /* ─── Resumo / Pré-visualização ─── */
                  <div className="space-y-3">
                    {/* Stats */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
                      <span><strong className="text-foreground">{quiz.total_questions}</strong> questões</span>
                      <span><strong className="text-foreground">{quiz.questions?.reduce((s, q) => s + (q.points || 0), 0) || 0}</strong> pontos</span>
                      <span>Aprovação: <strong className="text-foreground">{quiz.pass_percentage}%</strong></span>
                      {quiz.max_attempts ? (
                        <span>Max. <strong className="text-foreground">{quiz.max_attempts}</strong> tentativas</span>
                      ) : (
                        <span>Tentativas ilimitadas</span>
                      )}
                      {quiz.is_required && (
                        <span className="text-amber-600 font-medium">Obrigatório</span>
                      )}
                    </div>

                    {/* Questions */}
                    {quiz.questions?.length ? (
                      <div className="space-y-3">
                        {quiz.questions.map((q, qIdx) => {
                          const correct = q.options?.filter(o => o.is_correct) || [];
                          return (
                            <div key={q.id} className="border border-border rounded-lg bg-background p-3">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0">{qIdx + 1}.</span>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium">{q.text}</p>
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                                      {q.question_type === 'multiple_choice' ? 'Múltipla Escolha'
                                        : q.question_type === 'multiple_select' ? 'Seleção Múltipla'
                                        : q.question_type === 'true_false' ? 'V/F'
                                        : 'Texto Livre'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{q.points} pts</span>
                                  </div>

                                  {q.question_type !== 'open_text' ? (
                                    <div className="space-y-1">
                                      {q.options?.map(opt => (
                                        <div
                                          key={opt.id}
                                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                                            opt.is_correct
                                              ? 'bg-green-50 border border-green-200'
                                              : 'bg-muted/20 border border-transparent'
                                          }`}
                                        >
                                          <CheckCircle
                                            size={12}
                                            className={opt.is_correct ? 'text-green-500' : 'text-gray-300'}
                                          />
                                          <span className={opt.is_correct ? 'text-green-800 font-medium' : 'text-muted-foreground'}>
                                            {opt.text}
                                          </span>
                                          {opt.is_correct && (
                                            <span className="text-[10px] text-green-600 font-medium bg-green-100 px-1.5 py-0.5 rounded ml-auto">
                                              Correta
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                      Resposta livre — correção manual
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Nenhuma questão adicionada a este quiz.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                {/* Settings Row */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Aprovação:</label>
                    <input
                      type="number"
                      defaultValue={quiz.pass_percentage}
                      min={0}
                      max={100}
                      onBlur={(e) => updateQuiz(quiz.id, 'pass_percentage', parseInt(e.target.value) || 70)}
                      className="w-14 px-1.5 py-0.5 border border-border rounded text-xs bg-background"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Max. tentativas:</label>
                    <input
                      type="number"
                      defaultValue={quiz.max_attempts ?? ''}
                      min={1}
                      placeholder="∞"
                      onBlur={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        updateQuiz(quiz.id, 'max_attempts', val);
                      }}
                      className="w-14 px-1.5 py-0.5 border border-border rounded text-xs bg-background"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      defaultChecked={quiz.is_required}
                      onChange={(e) => updateQuiz(quiz.id, 'is_required', e.target.checked)}
                      className="rounded"
                    />
                    Obrigatório
                  </label>
                </div>

                {/* Questions */}
                <div className="space-y-2">
                  {quiz.questions?.map((question) => (
                    <div key={question.id} className="border border-border rounded-lg bg-background overflow-hidden">
                      {/* Question Header */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-2 hover:bg-muted/10 transition-colors">
                        <button
                          onClick={() =>
                            setExpandedQuestion(expandedQuestion === question.id ? null : question.id)
                          }
                          className="p-0.5 shrink-0"
                        >
                          {expandedQuestion === question.id ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </button>
                        <span className="text-xs font-medium text-muted-foreground shrink-0 bg-muted/50 px-1.5 py-0.5 rounded">
                          {questionTypeLabel(question.question_type)}
                        </span>
                        <input
                          type="text"
                          defaultValue={question.text}
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== question.text)
                              updateQuestion(quiz.id, question.id, {
                                text: e.target.value.trim(),
                                question_type: question.question_type,
                                points: question.points,
                                options: question.options.map(o => ({ id: o.id, text: o.text, is_correct: o.is_correct, sort_order: o.sort_order })),
                              });
                          }}
                          className="flex-1 min-w-30 px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Enunciado da questão..."
                        />
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{question.points} pts</span>
                          <button
                            onClick={() => deleteQuestion(quiz.id, question.id)}
                            className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Question Detail: Options */}
                      {expandedQuestion === question.id && (
                        <div className="px-2 sm:px-3 pb-3 space-y-2 border-t border-border pt-2">
                          {/* Type & Points */}
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              defaultValue={question.question_type}
                              onChange={(e) =>
                                updateQuestion(quiz.id, question.id, {
                                  text: question.text,
                                  question_type: e.target.value,
                                  points: question.points,
                                  options: question.options.map(o => ({ id: o.id, text: o.text, is_correct: o.is_correct, sort_order: o.sort_order })),
                                })
                              }
                              className="px-1.5 py-0.5 border border-border rounded text-xs bg-background"
                            >
                              <option value="multiple_choice">Múltipla Escolha</option>
                              <option value="multiple_select">Seleção Múltipla</option>
                              <option value="true_false">Verdadeiro/Falso</option>
                              <option value="open_text">Texto Livre</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-muted-foreground">Pontos:</label>
                              <input
                                type="number"
                                defaultValue={question.points}
                                min={1}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  updateQuestion(quiz.id, question.id, {
                                    text: question.text,
                                    question_type: question.question_type,
                                    points: val,
                                    options: question.options.map(o => ({ id: o.id, text: o.text, is_correct: o.is_correct, sort_order: o.sort_order })),
                                  });
                                }}
                                className="w-14 px-1.5 py-0.5 border border-border rounded text-xs bg-background"
                              />
                            </div>
                            {/* Help text sobre respostas certas */}
                            <span className="text-xs text-muted-foreground italic">
                              Clique no <CheckCircle size={10} className="inline text-green-500" /> para marcar a resposta certa
                            </span>
                          </div>

                          {/* Options (for non-open_text) */}
                          {question.question_type !== 'open_text' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground font-medium">Opções:</span>
                                <span className="text-xs text-muted-foreground">
                                  {question.question_type === 'multiple_select'
                                    ? 'Marca as corretas'
                                    : 'Marca a correta'}
                                </span>
                              </div>
                              {question.options.map((option, idx) => (
                                <div key={option.id} className="flex items-center gap-1.5 sm:gap-2">
                                  <button
                                    onClick={() => toggleCorrectOption(quiz.id, question, option.id, question.question_type)}
                                    className={`shrink-0 p-0.5 rounded-full transition-colors ${
                                      option.is_correct
                                        ? 'text-green-500 bg-green-50 ring-1 ring-green-300'
                                        : 'text-gray-300 hover:text-green-400 hover:bg-green-50/50'
                                    }`}
                                    title={option.is_correct ? 'Resposta correta — clique para desmarcar' : 'Marcar como resposta correta'}
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                  <input
                                    type="text"
                                    defaultValue={option.text}
                                    onBlur={(e) => {
                                      if (e.target.value.trim())
                                        updateOptionText(quiz.id, question, option.id, e.target.value.trim());
                                    }}
                                    className="flex-1 min-w-20 px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                                    placeholder={`Opção ${idx + 1}...`}
                                  />
                                  {option.is_correct && (
                                    <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded shrink-0">
                                      Correta
                                    </span>
                                  )}
                                  {question.options.length > 2 && (
                                    <button
                                      onClick={() => deleteOption(quiz.id, question, option.id)}
                                      className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => addOption(quiz.id, question)}
                                className="text-xs text-accent hover:underline flex items-center gap-1"
                              >
                                <Plus size={10} /> Adicionar opção
                              </button>
                            </div>
                          )}

                          {question.question_type === 'open_text' && (
                            <p className="text-xs text-muted-foreground italic">
                              O aluno poderá escrever uma resposta livre. A correção será manual.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => addQuestion(quiz.id)}
                    disabled={saving}
                    className="w-full px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-accent hover:border-accent transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus size={12} /> Adicionar Questão
                  </button>
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
