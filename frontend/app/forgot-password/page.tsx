'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import { authAPI } from '@/src/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await authAPI.requestPasswordReset(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao enviar. Tenta novamente.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 rounded-full mb-3">
            <KeyRound className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold">Recuperar Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Indica o teu email para receberes um código.</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
              Se o email existir, receberás um código de recuperação.
            </div>
            <Link href="/reset-password" className="inline-block px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              Introduzir código
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                {loading ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Lembraste-te da password? <Link href="/login" className="text-accent hover:underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
