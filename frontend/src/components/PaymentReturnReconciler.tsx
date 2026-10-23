'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { paymentsAPI } from '@/src/lib/api';
import { readPendingCheckout, clearPendingCheckout } from '@/src/lib/pendingCheckout';
import { usePendingCheckout } from '@/src/hooks/usePendingCheckout';

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 24; // ~2 minutos

/**
 * Fecha o ciclo de pagamento quando o cliente regressa à home.
 *
 * No checkout hospedado, o cliente pode pagar e ser devolvido sem nunca passar
 * pela página de sucesso. Este componente — montado globalmente — deteta um
 * checkout pendente e verifica o estado real na VPay:
 *
 * - `completed`: remove do carrinho os artigos pagos e limpa o registo;
 * - `failed`/`not_found`: mantém o carrinho e limpa o registo para nova tentativa;
 * - `pending`: mantém o carrinho e volta a verificar em breve.
 */
export function PaymentReturnReconciler() {
  const pathname = usePathname();
  const { settle } = usePendingCheckout();

  useEffect(() => {
    if (pathname !== '/') return;
    const pending = readPendingCheckout();
    if (!pending) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        const res = await paymentsAPI.status(pending.reference);
        if (cancelled) return;
        const st = res.data?.status;
        if (st === 'completed') {
          settle(pending.reference);
          return;
        }
        if (st === 'failed' || st === 'not_found') {
          clearPendingCheckout();
          return;
        }
        // `pending`: o webhook/poll ainda não confirmou; mantém o carrinho.
      } catch {
        // erro transitório: tenta de novo no próximo ciclo
      }

      attempts += 1;
      if (attempts < MAX_ATTEMPTS && !cancelled) {
        timer = setTimeout(check, POLL_INTERVAL_MS);
      }
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pathname, settle]);

  return null;
}
