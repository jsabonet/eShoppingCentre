'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { MailCheck, X } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { authAPI } from '@/src/lib/api';

export default function VerificationBanner() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  if (loading || !user || user.is_verified || dismissed || pathname === '/verify-email') return null;

  const resend = async () => {
    setResending(true); setMessage('');
    try {
      const { data } = await authAPI.resendVerification(user.email);
      setMessage(data.detail || 'Código reenviado.');
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Erro ao reenviar.');
    } finally { setResending(false); }
  };

  return (
    <div className="bg-accent/10 border-b border-accent/30">
      <div className="max-w-375 mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-foreground min-w-0">
          <MailCheck size={18} className="text-accent shrink-0" />
          <span className="truncate">
            Verifica o teu email para desbloquear todas as funcionalidades.{' '}
            <Link href={`/verify-email?email=${encodeURIComponent(user.email)}`} className="text-accent font-medium hover:underline">
              Introduzir código
            </Link>
          </span>
          {message && <span className="text-xs text-muted-foreground shrink-0">{message}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={resend} disabled={resending}
            className="text-xs font-medium text-accent hover:underline disabled:opacity-50">
            {resending ? 'A enviar...' : 'Reenviar código'}
          </button>
          <button onClick={() => setDismissed(true)} aria-label="Fechar"
            className="p-1 hover:bg-muted rounded-md text-muted-foreground">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
