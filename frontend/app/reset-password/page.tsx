'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import { authAPI } from '@/src/lib/api';
import PasswordInput from '@/src/components/PasswordInput';
import PasswordStrength from '@/src/components/PasswordStrength';
import OtpInput from '@/src/components/OtpInput';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password !== password2) { setError('As passwords não coincidem.'); return; }
    if (code.length !== 6) { setError('O código tem 6 dígitos.'); return; }
    setLoading(true);
    try {
      await authAPI.confirmPasswordReset({ email, code, new_password: password });
      router.push('/login?reset=1');
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.detail || data?.new_password?.join?.('. ') || 'Erro ao redefinir a password.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 rounded-full mb-3">
            <KeyRound className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold">Redefinir Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Introduz o código recebido e a nova password.</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Código</label>
            <OtpInput value={code} onChange={setCode} length={6} disabled={loading} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nova Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            <PasswordStrength password={password} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirmar Nova Password</label>
            <PasswordInput value={password2} onChange={(e) => setPassword2(e.target.value)} required autoComplete="new-password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            {loading ? 'Redefinindo...' : 'Redefinir Password'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/login" className="text-accent hover:underline">Voltar ao login</Link>
        </p>
      </div>
    </main>
  );
}
