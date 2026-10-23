/**
 * Checkout pendente no gateway VPay.
 *
 * Um pagamento iniciado não é um pagamento feito. Enquanto o cliente está no
 * checkout hospedado — ou se desistir/lhe falhar o pagamento — os artigos têm
 * de permanecer no carrinho. Este registo guarda a referência do checkout e os
 * artigos que ele cobre, para que o carrinho só seja limpo (e apenas desses
 * artigos) quando o pagamento for confirmado.
 */

const STORAGE_KEY = 'eshoppingcentre-pending-checkout-v1';

/**
 * Marca a sessão como "a voltar de um pagamento no gateway".
 *
 * Usa `sessionStorage` (e não `localStorage`) porque este sinal só interessa
 * durante a viagem ao checkout hospedado e regresso — não deve sobreviver ao
 * fecho do separador. Sobrevive ao back/forward cache do browser.
 */
const RETURN_FLAG_KEY = 'eshoppingcentre-payment-return-v1';

export function markPaymentReturn(): void {
  try {
    sessionStorage.setItem(RETURN_FLAG_KEY, '1');
  } catch {}
}

export function consumePaymentReturn(): boolean {
  try {
    if (sessionStorage.getItem(RETURN_FLAG_KEY)) {
      sessionStorage.removeItem(RETURN_FLAG_KEY);
      return true;
    }
  } catch {}
  return false;
}

/** Um checkout por pagar deixa de ser relevante ao fim deste prazo. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingCheckout {
  /** Referência do checkout devolvida por `POST /payments/initiate/`. */
  reference: string;
  /** Artigos (ids de produto) que este checkout cobriu. */
  productIds: string[];
  createdAt: number;
}

export function savePendingCheckout(reference: string, productIds: string[]): void {
  if (!reference || productIds.length === 0) return;
  const payload: PendingCheckout = {
    reference,
    productIds: [...new Set(productIds)],
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCheckout;
    if (!parsed?.reference || !Array.isArray(parsed.productIds)) return null;
    if (!parsed.createdAt || Date.now() - parsed.createdAt > MAX_AGE_MS) {
      clearPendingCheckout();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
