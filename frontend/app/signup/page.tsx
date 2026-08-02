'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/hooks/useAuth';
import GoogleSignInButton from '@/src/components/GoogleSignInButton';
import LoadingSpinner from '@/src/components/LoadingSpinner';

export default function SignupPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ email: '', username: '', password: '', password2: '', first_name: '', last_name: '', phone: '' });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) { router.replace('/'); }
  }, [isAuthenticated, router]);

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (form.password !== form.password2) { setError('As passwords não coincidem.'); return; }
    if (!agreeTerms) { setError('Deve aceitar os Termos de Serviço e a Política de Privacidade para continuar.'); return; }
    setLoading(true);
    try {
      await register({ email: form.email, username: form.username, password: form.password, password2: form.password2, first_name: form.first_name, last_name: form.last_name, phone: form.phone });
      router.push('/');
    } catch (err: any) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join('. ') : 'Erro ao criar conta.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12 bg-muted/30">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Criar Conta</h1>
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Nome</label><input type="text" value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="block text-sm font-medium mb-1">Apelido</label><input type="text" value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Email *</label><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          <div><label className="block text-sm font-medium mb-1">Username *</label><input type="text" value={form.username} onChange={(e) => update('username', e.target.value)} required className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          <div><label className="block text-sm font-medium mb-1">Telefone</label><input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          <div><label className="block text-sm font-medium mb-1">Password *</label><input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          <div><label className="block text-sm font-medium mb-1">Confirmar Password *</label><input type="password" value={form.password2} onChange={(e) => update('password2', e.target.value)} required className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" /></div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 accent-accent" required />
            <span className="text-sm text-muted-foreground">
              Concordo com os <Link href="/terms" className="text-accent hover:underline">Termos de Serviço</Link> e a{' '}
              <Link href="/privacy" className="text-accent hover:underline">Política de Privacidade</Link> do eShoppingCentre.
            </span>
          </label>

          <button type="submit" disabled={loading} className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{loading && <LoadingSpinner size={18} inline />}{loading ? 'Criando...' : 'Criar Conta'}</button>
        </form>
        <div className="mt-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-card px-4 text-muted-foreground">ou</span>
            </div>
          </div>
          <GoogleSignInButton redirectTo="/" />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">Já tem conta? <Link href="/login" className="text-accent hover:underline">Entrar</Link></p>
      </div>
    </main>
  );
}
