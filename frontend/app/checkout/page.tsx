import type { Metadata } from 'next';
import CheckoutContent from '@/src/components/CheckoutContent';

export const metadata: Metadata = {
  title: 'Checkout | e-Shopping Centre',
  description:
    'Finalize sua compra no e-Shopping Centre. Entrega em todo Moçambique com múltiplas opções de pagamento.',
};

export default function CheckoutPage() {
  return (
    <main>
      <CheckoutContent />
    </main>
  );
}
