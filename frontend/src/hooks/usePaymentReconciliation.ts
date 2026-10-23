'use client';

import { useEffect, useRef } from 'react';
import { paymentsAPI } from '../lib/api';

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 24; // ~2 minutos de polling

type PendingOrder = {
  id: string;
  payment_status: string;
  payment_id?: string | null;
};

/**
 * Reconcilia encomendas ainda por pagar com o estado real na VPay.
 *
 * No checkout hospedado, o cliente pode pagar e nunca ser redirecionado de
 * volta para a página de sucesso. O webhook costuma actualizar a encomenda,
 * mas pode atrasar. Este hook faz polling do estado na VPay e avisa o chamador
 * assim que alguma encomenda ficar `completed`, para a UI se actualizar em
 * tempo real sem recarregar a página.
 */
export function usePaymentReconciliation(
  orders: PendingOrder[],
  onCompleted: (completedIds: string[]) => void,
) {
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const pending = orders.filter((o) => o.payment_status === 'pending' && o.payment_id);
  const pendingKey = pending.map((o) => `${o.id}:${o.payment_id}`).join('|');

  useEffect(() => {
    if (!pendingKey) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      const currentPending = ordersRef.current.filter(
        (o) => o.payment_status === 'pending' && o.payment_id,
      );
      if (currentPending.length === 0) return;

      const completed: string[] = [];
      await Promise.all(
        currentPending.map(async (o) => {
          try {
            const res = await paymentsAPI.status(o.payment_id as string);
            if (res.data?.status === 'completed') completed.push(o.id);
          } catch {
            // erro transitório: tenta de novo no próximo ciclo
          }
        }),
      );
      if (cancelled) return;

      if (completed.length > 0) {
        onCompletedRef.current(completed);
        return;
      }

      attempts += 1;
      if (attempts < MAX_ATTEMPTS) {
        timer = setTimeout(check, POLL_INTERVAL_MS);
      }
    };

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingKey]);

  return { pendingCount: pending.length };
}
