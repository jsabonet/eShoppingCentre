'use client';

import { useCallback } from 'react';
import { useCart } from '../contexts/CartContext';
import { clearPendingCheckout, readPendingCheckout } from '../lib/pendingCheckout';

/**
 * Fecha o ciclo de um checkout pago.
 *
 * Retira do carrinho apenas os artigos que o pagamento cobriu, deixando
 * intacto tudo o que o cliente tenha acrescentado depois — e só actua quando
 * a referência indicada corresponde ao checkout registado, para que uma
 * encomenda paga não apague o carrinho de outra compra em curso.
 */
export function usePendingCheckout() {
  const { removeProducts } = useCart();

  const settle = useCallback(
    (reference?: string) => {
      const pending = readPendingCheckout();
      if (!pending) return;
      if (reference && pending.reference !== reference) return;
      removeProducts(pending.productIds);
      clearPendingCheckout();
    },
    [removeProducts],
  );

  return { settle, readPending: readPendingCheckout };
}
