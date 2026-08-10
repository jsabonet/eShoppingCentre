'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, GripVertical, Eye, EyeOff, Trash2, ChevronDown, ChevronRight,
  Save, ArrowLeft, Play, FileText, Upload, Paperclip, Download, X, Clock, Info
} from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import VideoUploader from '@/src/components/VideoUploader';
import QuizBuilder from '@/src/components/QuizBuilder';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface LessonData {
  id: string;
  title: string;
  description: string;
  video_url: string;
  video_provider: string;
  duration: string;
  content: string;
  is_free_preview: boolean;
  sort_order: number;
  cloudflare_video_uid?: string;
  cloudflare_video_status?: string;
  attachments?: AttachmentData[];
}

interface AttachmentData {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  sort_order: number;
}

interface ModuleData {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  lessons: LessonData[];
  drip_days?: number | null;
}

export default function CourseBuilderPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleData[]>([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const apiHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  const fetchBuilder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/builder/`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(res.status === 404 ? 'Curso nao encontrado.' : 'Erro ao carregar curso.');
      const data = await res.json();
      setCourseTitle(data.course_title || '');
      setModules(data.modules || []);
      setExpandedModules(new Set((data.modules || []).map((m: ModuleData) => m.id)));

      const allLessons: LessonData[] = (data.modules || []).flatMap((m: ModuleData) => m.lessons);
      for (const lesson of allLessons) {
        fetchAttachmentsSilent(lesson.id);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar.');
      setModules([]);
    }
    finally { setLoading(false); }
  }, [courseId]);

  // Refresh silencioso — para onUploadComplete (sem loading, mantem expandidos)
  const refreshSilent = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/builder/`, { headers: apiHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setCourseTitle(data.course_title || '');
      setModules(data.modules || []);
      // Manter todos os modulos expandidos para a nova aula ficar visivel
      setExpandedModules(prev => {
        const next = new Set(prev);
        (data.modules || []).forEach((m: ModuleData) => next.add(m.id));
        return next;
      });
      const allLessons: LessonData[] = (data.modules || []).flatMap((m: ModuleData) => m.lessons);
      for (const lesson of allLessons) {
        fetchAttachmentsSilent(lesson.id);
      }
      // Recarregar a pagina apos o upload bem-sucedido
      setTimeout(() => window.location.reload(), 1500);
    } catch {}
  }, [courseId]);

  useEffect(() => { fetchBuilder(); }, [fetchBuilder]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Module CRUD ───
  const addModule = async () => {
    const title = prompt('Nome do modulo:');
    if (!title?.trim()) return;
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/modules/`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ title: title.trim(), description: '' }),
      });
      if (res.ok) fetchBuilder();
    } catch {}
  };

  const updateModuleTitle = async (moduleId: string, title: string) => {
    try {
      await fetch(`${API_URL}/courses/modules/${moduleId}/`, {
        method: 'PUT', headers: apiHeaders(),
        body: JSON.stringify({ title }),
      });
    } catch {}
  };

  const updateModuleDrip = async (moduleId: string, drip_days: number | null) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, drip_days } : m));
    try {
      await fetch(`${API_URL}/courses/modules/${moduleId}/`, {
        method: 'PUT', headers: apiHeaders(),
        body: JSON.stringify({ drip_days }),
      });
    } catch {}
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Remover este modulo e todas as suas aulas?')) return;
    try {
      await fetch(`${API_URL}/courses/modules/${moduleId}/delete/`, { method: 'DELETE', headers: apiHeaders() });
      fetchBuilder();
    } catch (err: any) {
      setError('Erro ao remover modulo: ' + (err.message || 'desconhecido'));
    }
  };

  // ─── Lesson CRUD ───
  const addLesson = async (moduleId: string) => {
    const title = prompt('Titulo da aula:');
    if (!title?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/courses/modules/${moduleId}/lessons/`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ title: title.trim() }),
      });
      if (res.ok) fetchBuilder();
    } catch {}
    finally { setSaving(false); }
  };

  const updateLesson = async (lessonId: string, field: string, value: any) => {
    try {
      await fetch(`${API_URL}/courses/lessons/${lessonId}/`, {
        method: 'PUT', headers: apiHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
    } catch {}
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm('Remover esta aula?')) return;
    try {
      await fetch(`${API_URL}/courses/lessons/${lessonId}/delete/`, { method: 'DELETE', headers: apiHeaders() });
      fetchBuilder();
    } catch (err: any) {
      setError('Erro ao remover aula: ' + (err.message || 'desconhecido'));
    }
  };

  const toggleFreePreview = async (lesson: LessonData) => {
    const newVal = !lesson.is_free_preview;
    // Optimistic update
    setModules(prev => prev.map(m => ({
      ...m,
      lessons: m.lessons.map(l => l.id === lesson.id ? { ...l, is_free_preview: newVal } : l),
    })));
    await updateLesson(lesson.id, 'is_free_preview', newVal);
  };

  // ─── Attachments ───
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, AttachmentData[]>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const fetchAttachments = async (lessonId: string) => {
    try {
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/attachments/`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAttachmentsMap(prev => ({ ...prev, [lessonId]: data }));
        setModules(prev => prev.map(m => ({
          ...m,
          lessons: m.lessons.map(l => l.id === lessonId ? { ...l, attachments: data } : l),
        })));
      }
    } catch {}
  };

  // Silent fetch — only update attachments map, not modules (avoids re-render loops)
  const fetchAttachmentsSilent = async (lessonId: string) => {
    try {
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/attachments/`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAttachmentsMap(prev => ({ ...prev, [lessonId]: data }));
      }
    } catch {}
  };

  const uploadAttachment = async (lessonId: string, file: File) => {
    setUploadingFor(lessonId);
    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
      const res = await fetch(`${API_URL}/courses/lessons/${lessonId}/attachments/upload/`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) fetchAttachments(lessonId);
    } catch (err: any) {
      setError('Erro ao enviar anexo: ' + (err.message || 'desconhecido'));
    } finally { setUploadingFor(null); }
  };

  const deleteAttachment = async (attachmentId: string, lessonId: string) => {
    try {
      const res = await fetch(`${API_URL}/courses/lessons/attachments/${attachmentId}/`, {
        method: 'DELETE', headers: apiHeaders(),
      });
      if (res.ok) fetchAttachments(lessonId);
    } catch {}
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size={32} message="A carregar curso..." />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/seller/products" className="p-1.5 hover:bg-muted rounded-md">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Construtor de Curso</h1>
            <p className="text-sm text-muted-foreground">
              {courseTitle || 'Curso'} — Organize modulos e aulas.
            </p>
          </div>
          <button onClick={addModule}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 flex items-center gap-2">
            <Plus size={16} /> Novo Modulo
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Modules */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-2 flex-wrap">
            <span title="Modulos agrupam aulas">📁 <strong>Modulo</strong> — agrupa aulas</span>
            <span className="hidden sm:inline">|</span>
            <span title="Cada aula tem um video + descricao + anexos">🎬 <strong>Aula</strong> — video + conteudo</span>
            <span className="hidden sm:inline">|</span>
            <span title="0 = imediato, 7 = 7 dias apos matricula">🕐 <strong>Drip</strong> — libertacao programada</span>
            <span className="hidden sm:inline">|</span>
            <span title="Aulas gratuitas sao visiveis para qualquer visitante">👁️ <strong>Preview</strong> — aula gratuita</span>
          </div>
          {modules.map((mod) => (
            <div key={mod.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Module Header */}
              <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-muted/20 transition-colors flex-wrap">
                <button onClick={() => toggleModule(mod.id)} className="p-0.5" title={expandedModules.has(mod.id) ? 'Recolher modulo' : 'Expandir modulo'}>
                  {expandedModules.has(mod.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <GripVertical size={16} className="text-muted-foreground" title="Arrastar para reordenar" />
                <input
                  type="text"
                  defaultValue={mod.title}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== mod.title) updateModuleTitle(mod.id, e.target.value.trim()); }}
                  className="flex-1 px-2 py-1 border border-transparent hover:border-border rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-ring font-bold"
                  placeholder="Titulo do modulo..."
                />
                <span className="text-xs text-muted-foreground hidden sm:inline">{mod.lessons.length} aulas</span>
                {/* Drip content */}
                <div
                  className={`flex items-center gap-1 text-xs rounded-lg pl-1.5 pr-1 py-1 shrink-0 group relative ${(mod.drip_days ?? 0) > 0 ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'bg-muted/40 text-muted-foreground'}`}
                  title={(mod.drip_days ?? 0) > 0 ? `Módulo bloqueado por ${mod.drip_days} dias após matrícula` : 'Drip: libertação programada (0 = imediato)'}>
                  <Clock size={12} className="shrink-0" />
                  <span className="hidden sm:inline text-[10px] font-medium opacity-70">Drip</span>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    defaultValue={mod.drip_days ?? ''}
                    placeholder="0"
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      const num = val === '' || val === '0' ? null : Math.max(0, Math.min(365, parseInt(val) || 0));
                      updateModuleDrip(mod.id, num);
                    }}
                    className="w-10 px-0.5 py-0.5 bg-transparent text-center font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-muted-foreground shrink-0">dias</span>
                </div>
                <button onClick={() => deleteModule(mod.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Remover modulo e todas as suas aulas">
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Lessons */}
              {expandedModules.has(mod.id) && (
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  {mod.lessons.map((lesson) => (
                    <div key={lesson.id} className="border border-border rounded-lg p-3 bg-background">
                      <div className="flex items-center gap-2 mb-2">
                        <GripVertical size={14} className="text-muted-foreground" title="Arrastar para reordenar" />
                        <Play size={14} className="text-muted-foreground" title="Aula com video" />
                        <input
                          key={`lesson-title-${lesson.id}-${lesson.title}`}
                          type="text"
                          defaultValue={lesson.title}
                          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== lesson.title) updateLesson(lesson.id, 'title', e.target.value.trim()); }}
                          className="flex-1 px-2 py-1 border border-transparent hover:border-border rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-ring text-sm font-medium"
                          placeholder="Titulo da aula..."
                        />
                        <button
                          onClick={() => toggleFreePreview(lesson)}
                          title={lesson.is_free_preview ? 'Aula gratuita — visivel para visitantes' : 'Aula privada — apenas para alunos matriculados'}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          {lesson.is_free_preview
                            ? <Eye size={16} className="text-green-500" />
                            : <EyeOff size={16} className="text-muted-foreground" />}
                        </button>
                        <button onClick={() => deleteLesson(lesson.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Remover aula">
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Video upload & management */}
                      <div className="ml-7">
                        {/* Description */}
                        <textarea
                          defaultValue={lesson.description || ''}
                          onBlur={(e) => { if (e.target.value !== lesson.description) updateLesson(lesson.id, 'description', e.target.value); }}
                          placeholder="Descricao da aula (opcional)..."
                          className="w-full px-2 py-1.5 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs resize-none mb-2"
                          rows={2}
                        />

                        <VideoUploader
                          lessonId={lesson.id}
                          existingVideoStatus={lesson.cloudflare_video_status}
                          onUploadComplete={refreshSilent}
                        />
                        {/* Legacy video URL */}
                        {lesson.video_url && lesson.video_provider !== 'cloudflare' && (
                          <div className="mt-2 flex items-center gap-2">
                            <Upload size={14} className="text-muted-foreground" />
                            <input
                              type="url"
                              defaultValue={lesson.video_url || ''}
                              onBlur={(e) => updateLesson(lesson.id, 'video_url', e.target.value)}
                              placeholder="URL do video (Vimeo, YouTube)..."
                              className="flex-1 px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring text-xs"
                            />
                            <span className="text-[10px] text-muted-foreground">{lesson.video_provider}</span>
                          </div>
                        )}
                        {/* Attachments */}
                        <div className="mt-3 border-t border-border pt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                              <Paperclip size={11} /> Anexos
                            </span>
                            <label className="cursor-pointer text-[10px] text-accent hover:underline flex items-center gap-1">
                              <Plus size={11} /> Adicionar
                              <input type="file" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(lesson.id, f); }}
                                disabled={uploadingFor === lesson.id} />
                            </label>
                          </div>
                          {uploadingFor === lesson.id && (
                            <p className="text-[10px] text-muted-foreground">A enviar...</p>
                          )}
                          {(attachmentsMap[lesson.id] || []).length > 0 && (
                            <div className="space-y-1 mt-1">
                              {(attachmentsMap[lesson.id] || []).map(att => (
                                <div key={att.id} className="flex items-center gap-2 text-[11px] bg-muted/30 rounded px-2 py-1.5">
                                  <FileText size={11} className="text-accent shrink-0" />
                                  <span className="flex-1 truncate">{att.file_name}</span>
                                  <span className="text-muted-foreground shrink-0">{formatFileSize(att.file_size)}</span>
                                  <button onClick={() => deleteAttachment(att.id, lesson.id)}
                                    className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => addLesson(mod.id)}
                    disabled={saving}
                    className="w-full py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                  >
                    <Plus size={14} className="inline mr-1" /> Adicionar Aula
                  </button>

                  {/* Quizzes for this module */}
                  <QuizBuilder moduleId={mod.id} courseId={courseId} />
                </div>
              )}
            </div>
          ))}
        </div>

        {modules.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">Nenhum modulo ainda</p>
            <p className="text-sm">Clique em "Novo Modulo" para comecar a construir o seu curso.</p>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
