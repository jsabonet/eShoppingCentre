'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, Shield, CreditCard, MapPin, CheckCircle } from 'lucide-react';
import { useCart } from '@/src/contexts/CartContext';

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

const PROVINCES = [
  'Cabo Delgado', 'Niassa', 'Nampula', 'Zambézia', 'Tete',
  'Manica', 'Sofala', 'Inhambane', 'Gaza', 'Maputo',
];

const PAYMENT_METHODS = [
  {
    value: 'mpesa',
    label: 'M-Pesa',
    desc: 'Pagamento via M-Pesa (Vodacom)',
    icon: '📱',
    instructions: {
      title: 'Instruções M-Pesa:',
      steps: [
        'Após confirmar o pedido, você receberá um SMS com instruções',
        'Abra o menu M-Pesa no seu celular',
        'Selecione "Pagar" e insira o número fornecido',
        'Confirme o valor e insira seu PIN',
        'Você receberá uma confirmação por SMS',
      ],
    },
  },
  {
    value: 'emola',
    label: 'e-Mola',
    desc: 'Pagamento via e-Mola (Movitel)',
    icon: '📱',
    instructions: {
      title: 'Instruções e-Mola:',
      steps: [
        'Após confirmar o pedido, você receberá um SMS com instruções',
        'Abra o menu e-Mola no seu celular',
        'Selecione "Transferência" e insira o número fornecido',
        'Confirme o valor e insira seu PIN',
        'Você receberá uma confirmação por SMS',
      ],
    },
  },
  {
    value: 'bank',
    label: 'Transferência Bancária',
    desc: 'Transferência para conta bancária',
    icon: '🏦',
    instructions: {
      title: 'Instruções Transferência Bancária:',
      steps: [
        'Após confirmar o pedido, você receberá um email com dados bancários',
        'Realize a transferência para a conta indicada',
        'Envie o comprovante por email ou WhatsApp',
        'Após confirmação, seu pedido será processado',
        'Prazo de confirmação: até 24 horas úteis',
      ],
    },
  },
  {
    value: 'card',
    label: 'Cartão de Crédito/Débito',
    desc: 'Visa, Mastercard',
    icon: '💳',
    instructions: {
      title: 'Instruções Cartão:',
      steps: [
        'Após confirmar o pedido, você será redirecionado para o gateway de pagamento',
        'Insira os dados do seu cartão (Visa ou Mastercard)',
        'Confirme a transação',
        'Você receberá confirmação por email',
        'Seu pedido será processado imediatamente',
      ],
    },
  },
  {
    value: 'cash',
    label: 'Pagamento na Entrega',
    desc: 'Pague em dinheiro quando receber o produto',
    icon: '💵',
    instructions: {
      title: 'Instruções Pagamento na Entrega:',
      steps: [
        'Após confirmar o pedido, aguarde o contato da nossa equipa',
        'Confirme o endereço e horário de entrega',
        'No dia da entrega, tenha o valor exato em dinheiro',
        'Pague ao entregador e receba seu produto',
        'Você receberá recibo por email',
      ],
    },
  },
];

export default function CheckoutContent() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const [confirmed, setConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');

  // Form state
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    notes: '',
  });

  // Redirect to cart if empty (only on initial load, not after confirmation)
  useEffect(() => {
    if (items.length === 0 && !confirmed) {
      router.push('/cart');
    }
  }, [items, confirmed, router]);

  const currentInstructions = useMemo(
    () => PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.instructions,
    [paymentMethod]
  );

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!form.fullName || !form.phone || !form.email || !form.address || !form.city || !form.province) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const num = '#ESC-' + Math.floor(100000 + Math.random() * 900000);
    setOrderNumber(num);
    setConfirmed(true);
    clearCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Confirmation screen
  if (confirmed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <CheckCircle className="mx-auto text-green-600 mb-6" size={80} />
        <h2 className="text-3xl font-bold mb-4">Pedido Confirmado!</h2>
        <p className="text-lg text-muted-foreground mb-6">
          Obrigado pela sua compra. Você receberá um email com os detalhes do pedido e instruções de pagamento.
        </p>
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <p className="font-semibold mb-2">Número do Pedido:</p>
          <p className="text-2xl font-bold text-accent">{orderNumber}</p>
        </div>
        <div className="bg-muted rounded-lg p-6 mb-6 text-left">
          <h3 className="font-semibold mb-3">Próximos Passos:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Verifique seu email para confirmação do pedido</li>
            <li>Siga as instruções de pagamento recebidas</li>
            <li>Após confirmação do pagamento, enviaremos seu produto</li>
            <li>Você receberá código de rastreamento por email</li>
          </ol>
        </div>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
        >
          Continuar Comprando
        </Link>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
        <span>/</span>
        <Link href="/cart" className="hover:text-foreground transition-colors">Carrinho</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Checkout</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>

      <form id="checkout-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Information */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="text-foreground" size={24} />
              Informações de Entrega
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium mb-2">Nome Completo *</label>
                  <input
                    type="text"
                    id="fullName"
                    required
                    value={form.fullName}
                    onChange={(e) => updateField('fullName', e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">Telefone *</label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="+258 84 000 0000"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">Email *</label>
                <input
                  type="email"
                  id="email"
                  required
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
              <div>
                <label htmlFor="address" className="block text-sm font-medium mb-2">Endereço Completo *</label>
                <input
                  type="text"
                  id="address"
                  required
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium mb-2">Cidade *</label>
                  <input
                    type="text"
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Sua cidade"
                  />
                </div>
                <div>
                  <label htmlFor="province" className="block text-sm font-medium mb-2">Província *</label>
                  <select
                    id="province"
                    required
                    value={form.province}
                    onChange={(e) => updateField('province', e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Selecione</option>
                    {PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-2">Observações de Entrega</label>
                <textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Instruções especiais para entrega (opcional)"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CreditCard className="text-foreground" size={24} />
              Método de Pagamento
            </h2>
            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.value}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === method.value
                      ? 'border-accent'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                    className="w-5 h-5 text-accent"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-semibold">{method.label}</div>
                    <div className="text-sm text-muted-foreground">{method.desc}</div>
                  </div>
                  <div className="text-2xl">{method.icon}</div>
                </label>
              ))}
            </div>

            {/* Payment Instructions */}
            {currentInstructions && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">{currentInstructions.title}</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {currentInstructions.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Resumo do Pedido</h2>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                    <p className="text-sm font-bold mt-1">
                      MZN {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">MZN {formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete:</span>
                <span className="text-green-600 font-medium">Grátis</span>
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-lg">Total:</span>
                  <span className="font-bold text-lg">MZN {formatPrice(totalPrice)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ou 12x de MZN {formatPrice(totalPrice / 12)} sem juros
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-6 px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
            >
              Confirmar Pedido
            </button>

            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={14} className="text-foreground" />
                <span>Compra 100% segura</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck size={14} className="text-foreground" />
                <span>Entrega em todo Moçambique</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
