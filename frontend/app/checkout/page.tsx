import type { Metadata } from 'next';
import CheckoutContent from '@/src/components/CheckoutContent';

export const metadata: Metadata = {
  title: 'Checkout | eShopping Centre',
  description:
    'Finalize sua compra no eShopping Centre. Entrega em todo Moçambique com múltiplas opções de pagamento.',
};

export default function CheckoutPage() {
  return (
    <main>
      <CheckoutContent />
    </main>
  );
}
