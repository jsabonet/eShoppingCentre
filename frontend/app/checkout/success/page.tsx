'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, XCircle, Clock } from 'lucide-react';
import { paymentsAPI } from '@/src/lib/api';
import { usePendingCheckout } from '@/src/hooks/usePendingCheckout';

function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || '';
  const { settle } = usePendingCheckout();
  const [status, setStatus] = useState<'loading' | 'completed' | 'pending' | 'failed' | 'not_found'>('loading');

  useEffect(() => {
    if (!reference) {
      setStatus('not_found');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // ~100s de polling (a cada 5s)

    const check = async () => {
      try {
        const res = await paymentsAPI.status(reference);
        const st = res.data?.status;
        if (!cancelled) {
          if (st === 'completed') {
            setStatus('completed');
            // Pagamento confirmado: agora sim os artigos podem sair do carrinho.
            settle(reference);
            return;
          }
          if (st === 'failed') {
            setStatus('failed');
            return;
          }
          setStatus('pending');
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          if (!cancelled) setStatus('not_found');
          return;
        }
        if (!cancelled) setStatus('pending');
      }

      attempts += 1;
      if (attempts < MAX_ATTEMPTS && !cancelled) {
        setTimeout(check, 5000);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [reference, settle]);

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Loader2 className="mx-auto text-accent mb-6 animate-spin" size={60} />
        <h2 className="text-2xl font-bold mb-2">A confirmar o pagamento…</h2>
        <p className="text-muted-foreground">Aguarde enquanto verificamos o estado do seu pagamento.</p>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <XCircle className="mx-auto text-red-500 mb-6" size={60} />
        <h2 className="text-2xl font-bold mb-2">Pagamento não encontrado</h2>
        <p className="text-muted-foreground mb-6">Não foi possível identificar o pagamento. Verifique as suas encomendas.</p>
        <Link href="/account/orders" className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md">
          Ver Encomendas
        </Link>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <XCircle className="mx-auto text-red-500 mb-6" size={60} />
        <h2 className="text-2xl font-bold mb-2">Pagamento falhou</h2>
        <p className="text-muted-foreground mb-6">O seu pagamento não foi concluído. Pode tentar novamente.</p>
        <Link href="/account/orders" className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md">
          Ver Encomendas
        </Link>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Clock className="mx-auto text-amber-500 mb-6" size={60} />
        <h2 className="text-2xl font-bold mb-2">Pagamento em processamento</h2>
        <p className="text-muted-foreground mb-6">
          O seu pagamento ainda está a ser processado. Atualizaremos assim que for confirmado.
        </p>
        <Link href="/account/orders" className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md">
          Ver Encomendas
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <CheckCircle className="mx-auto text-green-600 mb-6" size={60} />
      <h2 className="text-2xl font-bold mb-2">Pagamento confirmado!</h2>
      <p className="text-muted-foreground mb-6">
        Obrigado pela sua compra. A sua encomenda foi paga e está a ser processada.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/account/orders" className="inline-block px-6 py-3 border border-border hover:bg-muted font-semibold rounded-md">
          Ver Encomendas
        </Link>
        <Link href="/my-courses" className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md">
          Meus Cursos
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main>
      <Suspense fallback={<div className="py-20 text-center text-muted-foreground">A carregar…</div>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
