'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { CheckCircle2, LoaderCircle, Mail } from 'lucide-react';
import { newsletterAPI } from '@/src/lib/api';

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function NewsletterForm({
  variant = 'light',
  source = 'blog',
  title = 'Receba novidades',
  description = 'Inscreva-se para receber dicas, novidades e promoções no seu email.',
}: {
  variant?: 'light' | 'dark';
  source?: string;
  title?: string;
  description?: string;
}) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const dark = variant === 'dark';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();
    if (!consent) {
      setStatus('error');
      setMessage('Aceite receber emails para concluir a subscrição.');
      return;
    }
    if (!isEmail(value)) {
      setStatus('error');
      setMessage('Indique um endereço de email válido.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      await newsletterAPI.subscribe(value, source);
      setStatus('success');
      setMessage('Subscrição confirmada. Obrigado!');
      setEmail('');
    } catch (error: unknown) {
      setStatus('error');
      const data = axios.isAxiosError(error) ? error.response?.data : undefined;
      if (data?.email && Array.isArray(data.email)) {
        setMessage(data.email[0]);
      } else if (data?.consent && Array.isArray(data.consent)) {
        setMessage(data.consent[0]);
      } else {
        setMessage('Não foi possível concluir a subscrição. Tente novamente.');
      }
    }
  };

  if (status === 'success') {
    return (
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${dark ? 'bg-primary-foreground/10 text-primary-foreground' : 'bg-emerald-50 text-emerald-700'}`}>
        <CheckCircle2 size={16} className="shrink-0" />
        {message}
      </div>
    );
  }

  return (
    <div>
      <h3 className={`font-bold ${dark ? 'text-primary-foreground' : 'text-foreground'} ${description ? 'mb-2' : 'mb-3'}`}>{title}</h3>
      {description && <p className={`mb-3 text-sm ${dark ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{description}</p>}
      <form onSubmit={submit} className="space-y-2" noValidate>
        <div className="relative">
          <Mail size={16} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${dark ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="O seu email"
            aria-label="Endereço de email"
            className={`w-full rounded-md py-2.5 pl-9 pr-3 text-sm outline-none transition ${dark ? 'bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 focus:bg-primary-foreground/15' : 'border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring'}`}
          />
        </div>
        <label className={`flex items-start gap-2 text-xs leading-5 ${dark ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
          />
          <span>
            Aceito receber emails da newsletter e li a{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-accent">Política de Privacidade</Link>.
            Posso cancelar a subscrição a qualquer momento.
          </span>
        </label>
        <button
          type="submit"
          disabled={status === 'loading' || !consent}
          className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${dark ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90' : 'bg-accent text-accent-foreground hover:bg-accent/90'}`}
        >
          {status === 'loading' && <LoaderCircle size={15} className="animate-spin" />}
          Inscrever-me
        </button>
      </form>
      {status === 'error' && <p role="alert" className={`mt-2 text-xs ${dark ? 'text-primary-foreground/90' : 'text-destructive'}`}>{message}</p>}
    </div>
  );
}
