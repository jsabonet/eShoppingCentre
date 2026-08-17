'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { authAPI } from '@/src/lib/api';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  const email = searchParams.get('email') || user?.email || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('');
    if (code.length !== 6) { setError('O código tem 6 dígitos.'); return; }
    setLoading(true);
    try {
      const { data } = await authAPI.verifyEmail({ email, code });
      setSuccess(data.detail || 'Email verificado!');
      if (user) { try { await refreshUser(); } catch {} }
      setTimeout(() => router.replace('/'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Código inválido ou expirado.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true); setError(''); setSuccess('');
    try {
      const { data } = await authAPI.resendVerification(email);
      setSuccess(data.detail || 'Código reenviado.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao reenviar o código.');
    } finally { setResending(false); }
  };

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 rounded-full mb-4">
          <ShieldCheck className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Verifica o teu email</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enviámos um código de 6 dígitos para <strong>{email}</strong>.
        </p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full text-center text-2xl tracking-[0.5em] px-4 py-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" disabled={loading || !email}
            className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>

        <button onClick={handleResend} disabled={resending || !email}
          className="mt-4 text-sm text-accent hover:underline disabled:opacity-50 flex items-center justify-center gap-1 mx-auto">
          {resending && <Loader2 size={14} className="animate-spin" />}
          Reenviar código
        </button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/login" className="text-accent hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Loader2 size={28} className="animate-spin text-muted-foreground" /></div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
