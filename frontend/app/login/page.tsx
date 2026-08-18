'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import GoogleSignInButton from '@/src/components/GoogleSignInButton';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import PasswordInput from '@/src/components/PasswordInput';

/** Só permite redirecionar para caminhos internos (evita open redirect). */
function safeRedirect(target: string): string {
  if (!target) return '/';
  // Bloqueia URLs absolutas (http://, https://) e protocol-relative (//)
  if (/^(https?:)?\/\//i.test(target)) return '/';
  // Bloqueia o truque de backslash (/\ → //)
  if (/^\/\\/.test(target)) return '/';
  return target.startsWith('/') ? target : '/';
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect') || '');
  const isAdminLogin = redirect.startsWith('/admin');
  const { login, isAuthenticated, isAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect.
  // But if the target is /admin and user is NOT admin, redirect to / instead to avoid loop.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (redirect.startsWith('/admin') && !isAdmin) {
      router.replace('/');
      return;
    }
    router.replace(redirect);
  }, [isAuthenticated, isAdmin, redirect, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await login(email, password);
      router.push(redirect);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Email ou password inválidos.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8">
        {isAdminLogin ? (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 rounded-full mb-3">
                <Lock className="w-7 h-7 text-accent" />
              </div>
              <h1 className="text-2xl font-bold">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground mt-1">Acesso restrito a administradores</p>
            </div>
          </>
        ) : (
          <h1 className="text-2xl font-bold mb-6 text-center">Entrar</h1>
        )}

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <LoadingSpinner size={18} inline />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {!isAdminLogin && (
          <>
            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-card px-4 text-muted-foreground">ou</span>
                </div>
              </div>
              <GoogleSignInButton redirectTo={redirect} />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Não tem conta? <Link href="/signup" className="text-accent hover:underline">Criar Conta</Link>
            </p>
            <p className="text-center text-sm mt-2">
              <Link href="/forgot-password" className="text-accent hover:underline">Esqueceu a password?</Link>
            </p>
          </>
        )}

        {isAdminLogin && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Apenas contas com permissões de administrador podem aceder.
            </p>
            <p className="text-center text-sm mt-3">
              <Link href="/login" className="text-accent hover:underline">Login normal</Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
