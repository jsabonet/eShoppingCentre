'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Loader2, GraduationCap, Settings, Globe, DollarSign,
  Play, Award, Eye, Trash2, Users, BookOpen, BarChart3
} from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CourseData {
  course_id: string;
  title: string;
  slug: string;
  price: number;
  compare_price: number | null;
  level: string;
  duration: string;
  total_lessons: number;
  certificate_enabled: boolean;
  preview_video_url: string;
  status: string;
  description: string;
  short_description: string;
  students_count: number;
  revenue: number;
}

export default function CourseEditPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '', slug: '', price: '', compare_price: '',
    description: '', short_description: '',
    level: 'beginner', duration: '', certificate_enabled: true,
    preview_video_url: '', status: 'active',
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const apiHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchCourse = useCallback(async () => {
    try {
      // Fetch builder (course structure + title)
      const [builderRes, studentsRes] = await Promise.all([
        fetch(`${API_URL}/courses/${courseId}/builder/`, { headers: apiHeaders() }),
        fetch(`${API_URL}/courses/${courseId}/students/`, { headers: apiHeaders() }),
      ]);

      if (builderRes.ok) {
        const data = await builderRes.json();
        // Also fetch the product details for price/description
        const productSlug = data.course_title?.toLowerCase().replace(/\s+/g, '-') || '';
        // Use the courses list to get full product data
        const myProductsRes = await fetch(`${API_URL}/products/my/?product_type=course`, { headers: apiHeaders() });
        let productData: any = null;
        if (myProductsRes.ok) {
          const pd = await myProductsRes.json();
          const results = pd.results || pd || [];
          productData = results.find((p: any) =>
            (p.course?.course_id === courseId) || (p.id === courseId)
          );
        }

        setCourse({
          course_id: courseId,
          title: data.course_title || productData?.name || '',
          slug: productData?.slug || '',
          price: parseFloat(productData?.price || '0'),
          compare_price: productData?.compare_price ? parseFloat(productData.compare_price) : null,
          level: productData?.course?.level || 'beginner',
          duration: productData?.course?.duration || '',
          total_lessons: (data.modules || []).reduce((s: number, m: any) => s + (m.lessons?.length || 0), 0),
          certificate_enabled: productData?.course?.certificate_enabled ?? true,
          preview_video_url: productData?.course?.preview_video_url || '',
          status: productData?.status || 'active',
          description: productData?.description || '',
          short_description: productData?.short_description || '',
          students_count: productData?.sales_count || 0,
          revenue: 0,
        });

        setForm({
          name: data.course_title || productData?.name || '',
          slug: productData?.slug || '',
          price: String(productData?.price || ''),
          compare_price: String(productData?.compare_price || ''),
          description: productData?.description || '',
          short_description: productData?.short_description || '',
          level: productData?.course?.level || 'beginner',
          duration: productData?.course?.duration || '',
          certificate_enabled: productData?.course?.certificate_enabled ?? true,
          preview_video_url: productData?.course?.preview_video_url || '',
          status: productData?.status || 'active',
        });
      }

      if (studentsRes.ok) {
        const sdata = await studentsRes.json();
        setStudents(sdata.students || []);
      }
    } catch {} finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/update/`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          price: form.price,
          compare_price: form.compare_price || null,
          description: form.description,
          short_description: form.short_description,
          level: form.level,
          duration: form.duration,
          certificate_enabled: form.certificate_enabled,
          preview_video_url: form.preview_video_url,
          status: form.status,
        }),
      });
      if (res.ok) {
        showToast('success', 'Curso actualizado com sucesso.');
        fetchCourse();
      } else {
        const err = await res.json();
        showToast('error', err.detail || 'Erro ao guardar.');
      }
    } catch { showToast('error', 'Erro ao guardar alterações.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja eliminar este curso? Esta acção é irreversível.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/courses/${courseId}/delete/`, {
        method: 'DELETE', headers: apiHeaders(),
      });
      if (res.ok) {
        showToast('success', 'Curso eliminado.');
        setTimeout(() => router.push('/seller/courses'), 1000);
      } else {
        showToast('error', 'Erro ao eliminar curso.');
      }
    } catch { showToast('error', 'Erro ao eliminar.'); }
    finally { setDeleting(false); }
  };

  const inputBase = 'w-full h-11 px-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none';
  const textareaBase = 'w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none resize-none';
  const labelBase = 'block text-[13px] font-semibold text-foreground/80 mb-1.5';

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
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium animate-[slideUp_0.3s_ease-out] ${toast.type === 'success' ? 'bg-emerald-900 text-emerald-100' : 'bg-red-900 text-red-100'}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.text}
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/seller/courses" className="hover:text-accent transition-colors flex items-center gap-1">
            <ArrowLeft size={14} /> Cursos
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">Editar Curso</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-2xl">
              <GraduationCap size={28} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{course?.title || 'Curso'}</h1>
              <p className="text-sm text-muted-foreground">
                {course?.total_lessons || 0} aulas · {course?.students_count || 0} alunos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/seller/courses/${courseId}/builder`}
              className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-all duration-200 inline-flex items-center gap-2">
              <BookOpen size={15} /> Construtor
            </Link>
            {course?.slug && (
              <Link href={`/product/${course.slug}`} target="_blank"
                className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-accent transition-all">
                <Eye size={16} />
              </Link>
            )}
            <button onClick={handleSave} disabled={saving}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 inline-flex items-center gap-2 shadow-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Alunos', value: course?.students_count || 0, icon: Users, color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Aulas', value: course?.total_lessons || 0, icon: BookOpen, color: 'bg-blue-100 text-blue-700' },
            { label: 'Preço', value: `${Number(form.price || 0).toLocaleString('pt-MZ')} MZN`, icon: DollarSign, color: 'bg-green-100 text-green-700' },
            { label: 'Estado', value: form.status === 'active' ? 'Activo' : form.status === 'draft' ? 'Rascunho' : form.status, icon: Globe, color: form.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${s.color}`}><Icon size={16} /></div>
                </div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Form sections */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings size={15} className="text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Informações do Curso</h2>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelBase}>Nome do Curso <span className="text-red-400">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Python para Iniciantes" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Slug (URL)</label>
                  <input type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                    placeholder="python-para-iniciantes" className={`${inputBase} font-mono text-xs`} />
                </div>
              </div>
              <div>
                <label className={labelBase}>Descrição Curta</label>
                <textarea rows={2} value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })}
                  placeholder="Resumo do curso em 1-2 frases..." className={textareaBase} />
              </div>
              <div>
                <label className={labelBase}>Descrição Completa</label>
                <textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Descreva o curso em detalhe: tópicos, metodologia, pré-requisitos..." className={textareaBase} />
              </div>
            </div>
          </div>

          {/* Pricing & Level */}
          <div className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <DollarSign size={15} className="text-accent" />
                </div>
                <h2 className="font-semibold text-foreground">Preço e Nível</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className={labelBase}>Preço (MZN) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Preço Original (promoção)</label>
                  <input type="number" step="0.01" value={form.compare_price} onChange={e => setForm({ ...form, compare_price: e.target.value })}
                    placeholder="Opcional" className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Nível</label>
                  <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                    className={inputBase}>
                    <option value="beginner">🌱 Iniciante</option>
                    <option value="intermediate">🌿 Intermédio</option>
                    <option value="advanced">🌳 Avançado</option>
                    <option value="all-levels">📚 Todos os Níveis</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                <div>
                  <label className={labelBase}>Duração Estimada</label>
                  <input type="text" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}
                    placeholder="Ex: 20h, 6 semanas..." className={inputBase} />
                </div>
                <div>
                  <label className={labelBase}>Estado de Publicação</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className={inputBase}>
                    <option value="active">🟢 Activo (visível)</option>
                    <option value="draft">📝 Rascunho (oculto)</option>
                    <option value="inactive">🔴 Inactivo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Media & Preview */}
          <div className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Play size={15} className="text-accent" />
                </div>
                <h2 className="font-semibold text-foreground">Vídeo de Apresentação</h2>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={labelBase}>URL do Vídeo Promocional</label>
                <input type="url" value={form.preview_video_url} onChange={e => setForm({ ...form, preview_video_url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..." className={inputBase} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  YouTube ou Vimeo. Este vídeo aparece na página pública do curso como introdução.
                </p>
              </div>
              {form.preview_video_url && (
                <div className="aspect-video max-w-lg rounded-xl overflow-hidden bg-black">
                  <iframe
                    src={form.preview_video_url
                      .replace('watch?v=', 'embed/')
                      .replace('vimeo.com/', 'player.vimeo.com/video/')
                      .replace('youtu.be/', 'youtube.com/embed/')}
                    className="w-full h-full"
                    allowFullScreen
                    title="Preview"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Certificate */}
          <div className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Award size={15} className="text-amber-600" />
                </div>
                <h2 className="font-semibold text-foreground">Certificado</h2>
              </div>
            </div>
            <div className="p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.certificate_enabled}
                  onChange={e => setForm({ ...form, certificate_enabled: e.target.checked })}
                  className="w-5 h-5 rounded-md border-border accent-accent"
                />
                <div>
                  <p className="font-medium text-sm">Emitir certificado de conclusão</p>
                  <p className="text-xs text-muted-foreground">
                    Os alunos recebem um certificado automaticamente ao concluir todas as aulas.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Students list */}
          <div className="bg-card rounded-2xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Users size={15} className="text-indigo-600" />
                </div>
                <h2 className="font-semibold text-foreground">Alunos ({students.length})</h2>
              </div>
            </div>
            {students.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Aluno</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-center px-4 py-3 font-medium">Progresso</th>
                      <th className="text-center px-4 py-3 font-medium">Estado</th>
                      <th className="text-left px-4 py-3 font-medium">Inscrito em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map(s => (
                      <tr key={s.enrollment_id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-accent rounded-full" style={{ width: `${s.progress}%` }} />
                            </div>
                            <span className="text-xs font-medium">{Math.round(s.progress)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.completed ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Concluído</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Em progresso</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(s.enrolled_at).toLocaleDateString('pt-MZ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum aluno inscrito ainda.</p>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-card rounded-2xl border border-destructive/20 shadow-sm">
            <div className="px-6 py-4 border-b border-destructive/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <Trash2 size={15} className="text-red-500" />
                </div>
                <h2 className="font-semibold text-destructive">Zona de Perigo</h2>
              </div>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Eliminar este curso</p>
                <p className="text-xs text-muted-foreground">
                  Esta acção remove o curso permanentemente. Os alunos já inscritos perderão o acesso.
                </p>
              </div>
              <button onClick={handleDelete} disabled={deleting}
                className="h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 inline-flex items-center gap-2">
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Eliminar Curso
              </button>
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
