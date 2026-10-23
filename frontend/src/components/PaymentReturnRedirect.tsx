'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { consumePaymentReturn } from '@/src/lib/pendingCheckout';

/**
 * Redireciona imediatamente para a home quando o cliente regressa do checkout
 * hospedado da VPay.
 *
 * É montado *antes* do AuthGate para não esperar pela validação de sessão
 * (que faz uma chamada de rede a `/users/me/`). Assim que a página volta a ser
 * exibida — por redirect normal ou pelo botão "voltar" (bfcache) — consumimos
 * a marca e redirecionamos sem atraso perceptível.
 */
export function PaymentReturnRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Só interessa quando estamos de volta na página de checkout.
    if (pathname !== '/checkout') return;

    const redirectHome = () => {
      if (consumePaymentReturn()) {
        router.replace('/');
      }
    };

    // Cobre o regresso por redirecionamento normal (fresh load).
    redirectHome();
    // Cobre o regresso pelo botão voltar do browser/telemóvel (bfcache restore).
    window.addEventListener('pageshow', redirectHome);
    return () => window.removeEventListener('pageshow', redirectHome);
  }, [pathname, router]);

  return null;
}
