'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, LoaderCircle, MailX } from 'lucide-react';
import { newsletterAPI } from '@/src/lib/api';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }

    let active = true;
    newsletterAPI.unsubscribe(token)
      .then(() => { if (active) setState('success'); })
      .catch((error) => {
        console.error('Não foi possível cancelar a subscrição da newsletter.', error);
        if (active) setState('error');
      });
    return () => { active = false; };
  }, [token]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4 py-16">
      <section className="w-full rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-10">
        {state === 'loading' ? (
          <>
            <LoaderCircle size={34} className="mx-auto animate-spin text-accent" />
            <h1 className="mt-4 text-xl font-bold">A processar o pedido</h1>
          </>
        ) : state === 'success' ? (
          <>
            <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
            <h1 className="mt-4 text-xl font-bold">Subscrição cancelada</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">O endereço foi removido da newsletter. Não receberá mais emails de novidades.</p>
          </>
        ) : (
          <>
            <MailX size={40} className="mx-auto text-destructive" />
            <h1 className="mt-4 text-xl font-bold">Ligação inválida</h1>
            <p role="alert" className="mt-2 text-sm leading-6 text-muted-foreground">Não foi possível processar este pedido. Utilize a ligação de cancelamento incluída no email da newsletter.</p>
          </>
        )}
        <Link href="/blog" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90">
          Voltar ao blog
        </Link>
      </section>
    </main>
  );
}

export default function NewsletterUnsubscribePage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center"><LoaderCircle size={28} className="animate-spin text-accent" /></main>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
