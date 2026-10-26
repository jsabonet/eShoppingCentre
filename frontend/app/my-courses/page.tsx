'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { BookOpen, Clock, PlayCircle, Award, ChevronRight, AlertCircle, Star, Download, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import ReviewForm from '@/src/components/ReviewForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface EnrollmentData {
  id: string;
  course_id: string;
  course_title: string;
  course_slug: string;
  total_lessons: number;
  image: string | null;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  access_expires_at: string | null;
  access_duration_days: number | null;
  certificate_enabled: boolean;
}

interface CertificateData {
  certificate_number: string;
  recipient_name: string;
  course_title: string;
  issued_at: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `Ha ${days} dias`;
  return d.toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short' });
}

export default function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [loading, setLoading] = useState(true);
  // ─── Review modal ───
  const [reviewModal, setReviewModal] = useState<{ open: boolean; enrollment: EnrollmentData | null }>({ open: false, enrollment: null });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDone, setReviewDone] = useState<Set<string>>(new Set());
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [issuingCertificate, setIssuingCertificate] = useState<string | null>(null);
  const [certificateError, setCertificateError] = useState<{ enrollmentId: string; message: string } | null>(null);

  const downloadCertificate = async (enrollment: EnrollmentData) => {
    setIssuingCertificate(enrollment.id);
    setCertificateError(null);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${API_URL}/courses/me/enrollments/${enrollment.id}/certificate/`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Não foi possível emitir o certificado.');
      }

      const certificate = result as CertificateData;
      const validationUrl = `${window.location.origin}/certificates/${certificate.certificate_number}`;
      const qrCode = await QRCode.toDataURL(validationUrl, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 256,
      });
      const logoResponse = await fetch('/icon.png');
      if (!logoResponse.ok) {
        throw new Error('Não foi possível carregar o logótipo oficial para o certificado.');
      }
      const logoBlob = await logoResponse.blob();
      const logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Não foi possível preparar o logótipo do certificado.'));
        };
        reader.onerror = () => reject(new Error('Não foi possível ler o logótipo do certificado.'));
        reader.readAsDataURL(logoBlob);
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const navy: [number, number, number] = [25, 45, 61];
      const green: [number, number, number] = [37, 104, 78];
      const blue: [number, number, number] = [66, 104, 137];
      const muted: [number, number, number] = [103, 113, 120];
      const border: [number, number, number] = [218, 225, 228];
      const pageWidth = 297;
      const center = pageWidth / 2;

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, 210, 'F');
      pdf.setDrawColor(...navy);
      pdf.setLineWidth(0.55);
      pdf.roundedRect(12, 12, 273, 186, 2, 2);

      pdf.addImage(logoDataUrl, 'PNG', 22, 19, 27, 27);
      pdf.setTextColor(...navy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('e-SHOPPING CENTRE', 54, 29);
      pdf.setTextColor(...muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Certificação de cursos', 54, 35);

      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(245, 17, 30, 34, 1.5, 1.5);
      pdf.addImage(qrCode, 'PNG', 251, 19, 18, 18);
      pdf.setTextColor(...blue);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.text('VALIDAR', 260, 45, { align: 'center' });

      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.35);
      pdf.line(22, 56, 275, 56);

      pdf.setTextColor(...navy);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(27);
      pdf.text('Certificado de Conclusão', center, 69, { align: 'center' });
      pdf.setDrawColor(...green);
      pdf.setLineWidth(0.75);
      pdf.line(center - 16, 75, center + 16, 75);

      pdf.setFillColor(247, 249, 250);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(29, 81, 239, 69, 2, 2, 'FD');

      pdf.setTextColor(...muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text('Certificamos que', center, 91, { align: 'center' });

      pdf.setTextColor(...navy);
      pdf.setFont('times', 'bold');
      let recipientFontSize = 25;
      pdf.setFontSize(recipientFontSize);
      let recipientLines = pdf.splitTextToSize(certificate.recipient_name, 215);
      while (recipientLines.length > 2 && recipientFontSize > 16) {
        recipientFontSize -= 1;
        pdf.setFontSize(recipientFontSize);
        recipientLines = pdf.splitTextToSize(certificate.recipient_name, 215);
      }
      pdf.text(recipientLines, center, 104, {
        align: 'center',
        lineHeightFactor: 1.15,
      });

      const completionY = 104 + (recipientLines.length - 1) * recipientFontSize * 0.4 + 8;
      pdf.setTextColor(...muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.text('concluiu com aproveitamento o curso', center, completionY, { align: 'center' });

      pdf.setTextColor(...green);
      pdf.setFont('times', 'bold');
      let courseFontSize = 18;
      pdf.setFontSize(courseFontSize);
      let courseLines = pdf.splitTextToSize(certificate.course_title, 215);
      while (courseLines.length > 2 && courseFontSize > 13) {
        courseFontSize -= 1;
        pdf.setFontSize(courseFontSize);
        courseLines = pdf.splitTextToSize(certificate.course_title, 215);
      }
      pdf.text(courseLines, center, completionY + 11, {
        align: 'center',
        lineHeightFactor: 1.15,
      });

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...border);
      pdf.roundedRect(29, 158, 239, 27, 2, 2, 'FD');
      pdf.line(109, 162, 109, 181);
      pdf.line(219, 162, 219, 181);

      pdf.setTextColor(...muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.text('DATA DE EMISSÃO', 36, 168);
      pdf.setTextColor(...navy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(new Date(certificate.issued_at).toLocaleDateString('pt-MZ'), 36, 177);

      pdf.setTextColor(...muted);
      pdf.setFontSize(7);
      pdf.text('CÓDIGO DE AUTENTICIDADE', 118, 168);
      pdf.setTextColor(...navy);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      pdf.text(certificate.certificate_number, 118, 177, { maxWidth: 96 });

      pdf.setTextColor(...blue);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.textWithLink('Abrir verificação', 228, 173, { url: validationUrl });
      pdf.save(`certificado-${certificate.certificate_number}.pdf`);
    } catch (error) {
      setCertificateError({
        enrollmentId: enrollment.id,
        message: error instanceof Error ? error.message : 'Erro ao descarregar o certificado.',
      });
    } finally {
      setIssuingCertificate(null);
    }
  };


  const fetchEnrollments = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/courses/me/enrollments/`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setEnrollments(data.results || data || []);
      } else if (res.status === 401) {
        window.location.href = '/login?redirect=/my-courses';
        return;
      }
    } catch {} finally { setLoading(false); }
  }, []);

  // Fetch existing reviews to know which courses are already reviewed
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    fetch(`${API_URL}/courses/me/reviews/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const reviewed = new Set<string>();
        (data.results || data || []).forEach((r: any) => {
          if (r.enrollment_id) reviewed.add(r.enrollment_id);
        });
        setReviewDone(reviewed);
      })
      .catch(() => {});
  }, []);

  const openReviewModal = (enr: EnrollmentData) => {
    setReviewModal({ open: true, enrollment: enr });
    setReviewError('');
    setReviewSuccess('');
  };

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  if (loading) {
    return (
      <main className="max-w-[1500px] mx-auto px-4 py-8 min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner size={32} message="A carregar cursos..." />
      </main>
    );
  }

  return (
    <main className="max-w-[1500px] mx-auto px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
        <ChevronRight size={14} />
        <span className="text-foreground font-medium">Meus Cursos</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Meus Cursos</h1>
        <p className="text-muted-foreground">Continue aprendendo de onde parou</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium mb-1">Nenhum curso ainda</p>
          <p className="text-sm mb-4">Explore o nosso catalogo e inscreva-se no seu primeiro curso.</p>
          <Link href="/courses" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium inline-block">
            Ver Catalogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map((enr) => (
            <Link key={enr.id} href={`/my-courses/${enr.course_id}/learn`}
              className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
              <div className="h-40 overflow-hidden relative bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                {enr.image ? (
                  <img src={enr.image} alt={enr.course_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <BookOpen size={48} className="text-accent/30" />
                )}
                {enr.completed && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Award size={16} /> Concluido
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold mb-1 group-hover:text-accent transition-colors">{enr.course_title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{enr.total_lessons} aulas</p>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{Math.round(enr.progress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${enr.completed ? 'bg-green-500' : 'bg-accent'}`}
                      style={{ width: `${enr.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(enr.created_at)}</span>
                  <span className="flex items-center gap-1 text-accent font-medium">
                    {enr.completed ? 'Rever' : 'Continuar'} <PlayCircle size={14} />
                  </span>
                </div>
                {enr.completed && enr.certificate_enabled && (
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void downloadCertificate(enr);
                    }}
                    disabled={issuingCertificate === enr.id}
                    className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    {issuingCertificate === enr.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Download size={15} />}
                    Emitir / descarregar certificado
                  </button>
                )}
                {certificateError?.enrollmentId === enr.id && (
                  <p role="alert" className="mt-2 text-xs text-red-600">{certificateError.message}</p>
                )}
                {/* Review button for completed courses */}
                {enr.completed && !reviewDone.has(enr.id) && (
                  <button
                    onClick={(e) => { e.preventDefault(); openReviewModal(enr); }}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors"
                  >
                    <Star size={14} /> Avaliar Curso
                  </button>
                )}
                {enr.completed && reviewDone.has(enr.id) && (
                  <p className="mt-3 text-xs text-green-600 flex items-center justify-center gap-1">
                    <Star size={12} className="fill-green-600" /> Já avaliado
                  </p>
                )}
                {enr.access_expires_at && (
                  <div className="mt-2 text-xs flex items-center gap-1 text-amber-600">
                    <AlertCircle size={12} />
                    Expira em {new Date(enr.access_expires_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ReviewForm
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false, enrollment: null })}
        onSubmit={async (data) => {
          if (!reviewModal.enrollment) return;
          setReviewSubmitting(true); setReviewError('');
          try {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_URL}/courses/reviews/`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ enrollment_id: reviewModal.enrollment.id, ...data, is_public: true }),
            });
            if (res.ok) {
              setReviewSuccess('Avaliação enviada! Obrigado!');
              setReviewDone(prev => new Set(prev).add(reviewModal.enrollment!.id));
              setTimeout(() => setReviewModal({ open: false, enrollment: null }), 1500);
            } else {
              const err = await res.json();
              setReviewError(err.detail || Object.values(err).flat().join(', ') || 'Erro.');
            }
          } catch { setReviewError('Erro de rede.'); }
          finally { setReviewSubmitting(false); }
        }}
        subjectName={reviewModal.enrollment?.course_title || ''}
        submitting={reviewSubmitting}
        error={reviewError}
        success={reviewSuccess}
      />
    </main>
  );
}
