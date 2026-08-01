'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, Mail, Phone, Lock, Save } from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';
import { useAuth } from '@/src/hooks/useAuth';
import { usersAPI, authAPI } from '@/src/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm: '' });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

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
    e.preventDefault(); setSaving(true);
    try {
      await usersAPI.updateMe(form);
      showToast('success', 'Perfil actualizado com sucesso!');
    } catch { showToast('error', 'Erro ao actualizar perfil.'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm) { showToast('error', 'Passwords não coincidem.'); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ old_password: passwordForm.old_password, new_password: passwordForm.new_password });
      showToast('success', 'Password alterada com sucesso!');
      setPasswordForm({ old_password: '', new_password: '', confirm: '' });
    } catch { showToast('error', 'Erro ao alterar password.'); }
    finally { setSaving(false); }
  };

  if (authLoading) {
    return <AccountLayout><div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={28} className="animate-spin text-accent" /></div></AccountLayout>;
  }

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || user?.username?.[0] || '?')).toUpperCase();
  const inputBase = 'w-full h-11 px-4 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 hover:border-accent/30 focus:border-accent focus:ring-4 focus:ring-ring/20 focus:outline-none';
  const labelBase = 'block text-[13px] font-semibold text-foreground/80 mb-1.5';

  return (
    <AccountLayout>
      {toast && (
        <div className={`fixed bottom-8 right-8 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium animate-[slideUp_0.3s_ease-out] ${toast.type === 'success' ? 'bg-emerald-900 text-emerald-100' : 'bg-red-900 text-red-100'}`}>
          {toast.type === 'success' ? '✓' : '✗'} {toast.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Profile card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><User size={15} className="text-primary" /></div>
              <h2 className="font-semibold text-foreground">Informações Pessoais</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shadow-sm">{initials}</div>
              <div>
                <p className="font-semibold text-foreground">{user?.first_name} {user?.last_name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div><label className={labelBase}>Nome</label><input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Seu nome" className={inputBase} /></div>
                <div><label className={labelBase}>Apelido</label><input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Seu apelido" className={inputBase} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div><label className={labelBase}><Mail size={12} className="inline mr-1 text-muted-foreground" /> Email</label><input type="email" value={user?.email || ''} disabled className="w-full h-11 px-4 rounded-xl border border-border bg-muted text-muted-foreground cursor-not-allowed text-sm" /></div>
                <div><label className={labelBase}><Phone size={12} className="inline mr-1 text-muted-foreground" /> Telefone</label><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+258 84 123 4567" className={inputBase} /></div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving}
                  className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 inline-flex items-center gap-2 shadow-sm">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Password card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="px-6 py-4 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Lock size={15} className="text-primary" /></div>
              <h2 className="font-semibold text-foreground">Alterar Password</h2>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleChangePassword} className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div><label className={labelBase}>Password Actual</label><input type="password" value={passwordForm.old_password} onChange={e => setPasswordForm({ ...passwordForm, old_password: e.target.value })} placeholder="••••••••" className={inputBase} required /></div>
                <div><label className={labelBase}>Nova Password</label><input type="password" value={passwordForm.new_password} onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="••••••••" className={inputBase} required /></div>
                <div><label className={labelBase}>Confirmar</label><input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="••••••••" className={inputBase} required /></div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saving}
                  className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 inline-flex items-center gap-2 shadow-sm">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Alterar Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
