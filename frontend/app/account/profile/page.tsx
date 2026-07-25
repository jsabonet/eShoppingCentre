'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';
import { usersAPI, authAPI } from '@/src/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm: '' });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login?redirect=/account/profile'); return; }
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        bio: (user as any).bio || '',
      });
    }
  }, [user, isAuthenticated, authLoading]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMessage('');
    try {
      await usersAPI.updateMe(form);
      setMessage('Perfil actualizado com sucesso!');
    } catch { setMessage('Erro ao actualizar perfil.'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm) { setMessage('Passwords não coincidem.'); return; }
    setSaving(true); setMessage('');
    try {
      await authAPI.changePassword({ old_password: passwordForm.old_password, new_password: passwordForm.new_password });
      setMessage('Password alterada com sucesso!');
      setPasswordForm({ old_password: '', new_password: '', confirm: '' });
    } catch { setMessage('Erro ao alterar password.'); }
    finally { setSaving(false); }
  };

  if (authLoading) {
    return <AccountLayout><LoadingSpinner size={32} message="A carregar perfil..." /></AccountLayout>;
  }

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || user?.username?.[0] || '?')).toUpperCase();

  return (
    <AccountLayout>
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6">Meu Perfil</h2>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('sucesso') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message}</div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-xl font-bold text-accent">{initials}</div>
            <div>
              <p className="font-medium">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Apelido</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={user?.email || ''} disabled
                className="w-full px-4 py-2.5 border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>

        <hr className="border-border my-8" />

        <h3 className="font-bold mb-4">Alterar Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Password Actual</label>
              <input type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nova Password</label>
              <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirmar</label>
              <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Alterando...' : 'Alterar Password'}
            </button>
          </div>
        </form>
      </div>
    </AccountLayout>
  );
}
