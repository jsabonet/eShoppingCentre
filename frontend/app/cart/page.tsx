import type { Metadata } from 'next';
import CartContent from '@/src/components/CartContent';

export const metadata: Metadata = {
  title: 'Carrinho de Compras | eShopping Centre',
  description:
    'Seu carrinho de compras no eShopping Centre. Finalize sua compra com frete grátis e parcelamento em até 12x sem juros.',
};

export default function CartPage() {
  return (
    <main>
      <CartContent />
    </main>
  );
}
