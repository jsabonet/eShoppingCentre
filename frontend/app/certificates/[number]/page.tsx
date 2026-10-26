'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Award, CheckCircle2, XCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface CertificateData {
  certificate_number: string;
  recipient_name: string;
  course_title: string;
  issued_at: string;
  status: 'valid' | 'revoked';
  revoked_at: string | null;
}

export default function CertificateVerificationPage() {
  const { number } = useParams<{ number: string }>();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/courses/certificates/${encodeURIComponent(number)}/verify/`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Certificado não encontrado.');
        return response.json() as Promise<CertificateData>;
      })
      .then(setCertificate)
      .catch(() => setError(true));
  }, [number]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <section className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        {error ? (
          <>
            <XCircle size={48} className="mx-auto text-red-600 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Certificado não encontrado</h1>
            <p className="text-muted-foreground">O código indicado não corresponde a um certificado emitido pela plataforma.</p>
          </>
        ) : !certificate ? (
          <p className="text-muted-foreground">A verificar certificado...</p>
        ) : (
          <>
            {certificate.status === 'valid'
              ? <CheckCircle2 size={48} className="mx-auto text-green-600 mb-4" />
              : <XCircle size={48} className="mx-auto text-red-600 mb-4" />}
            <Award size={28} className="mx-auto text-accent mb-3" />
            <h1 className="text-2xl font-bold mb-2">
              {certificate.status === 'valid' ? 'Certificado válido' : 'Certificado revogado'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {certificate.status === 'valid'
                ? 'Este certificado foi emitido pela e-Shopping Centre.'
                : 'Este certificado foi revogado e já não é válido.'}
            </p>
            <dl className="text-left border border-border rounded-xl divide-y divide-border">
              <div className="p-4"><dt className="text-xs text-muted-foreground">Titular</dt><dd className="font-medium">{certificate.recipient_name}</dd></div>
              <div className="p-4"><dt className="text-xs text-muted-foreground">Curso</dt><dd className="font-medium">{certificate.course_title}</dd></div>
              <div className="p-4"><dt className="text-xs text-muted-foreground">Data de emissão</dt><dd className="font-medium">{new Date(certificate.issued_at).toLocaleDateString('pt-MZ')}</dd></div>
              <div className="p-4"><dt className="text-xs text-muted-foreground">Código</dt><dd className="font-mono text-sm break-all">{certificate.certificate_number}</dd></div>
            </dl>
          </>
        )}
        <Link href="/" className="inline-block mt-6 text-accent hover:underline">Voltar à e-Shopping Centre</Link>
      </section>
    </main>
  );
}
