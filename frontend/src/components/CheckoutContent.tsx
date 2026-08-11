'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Truck, Shield, CreditCard, MapPin, CheckCircle, Loader2, FlaskConical } from 'lucide-react';
import { useCart } from '@/src/contexts/CartContext';
import { useAuth } from '@/src/hooks/useAuth';

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

const PROVINCES = [
  { value: 'maputo_cidade', label: 'Maputo Cidade' },
  { value: 'maputo_provincia', label: 'Maputo Província' },
  { value: 'gaza', label: 'Gaza' },
  { value: 'inhambane', label: 'Inhambane' },
  { value: 'sofala', label: 'Sofala' },
  { value: 'manica', label: 'Manica' },
  { value: 'tete', label: 'Tete' },
  { value: 'zambezia', label: 'Zambézia' },
  { value: 'nampula', label: 'Nampula' },
  { value: 'cabo_delgado', label: 'Cabo Delgado' },
  { value: 'niassa', label: 'Niassa' },
];

const PAYMENT_METHODS = [
  {
    value: 'test',
    label: '🧪 Modo Teste (Grátis)',
    desc: 'Checkout simulado — pagamento automático para testes',
    icon: '🧪',
    instructions: {
      title: 'Modo de Teste:',
      steps: [
        'Este método simula um pagamento concluído.',
        'Nenhum pagamento real é processado.',
        'A encomenda será criada como paga automaticamente.',
        'Ideal para testar fluxos de compra, cursos e downloads.',
        'Disponível apenas em ambiente de desenvolvimento.',
      ],
    },
  },
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
  const { isAuthenticated } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const [confirmed, setConfirmed] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('test');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [shippingEstimates, setShippingEstimates] = useState<any>(null);
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({});
  const [estimatingShipping, setEstimatingShipping] = useState(false);

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

  // Calculate displayed shipping total from selections
  const shippingTotal = useMemo(() => {
    let total = 0;
    if (shippingEstimates?.stores) {
      for (const store of shippingEstimates.stores) {
        const selectedId = shippingSelections[store.store_id];
        const method = store.available_methods?.find((m: any) => m.rate_id === selectedId);
        if (method) total += method.price;
      }
    }
    return total;
  }, [shippingEstimates, shippingSelections]);

  const hasPhysicalItems = items.some(it => it.product.productType === 'physical');

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Fetch shipping estimates when province or items change
  useEffect(() => {
    if (!form.province || items.length === 0) return;

    const hasPhysical = items.some(it => it.product.productType === 'physical');
    if (!hasPhysical) {
      setShippingEstimates(null);
      return;
    }

    setEstimatingShipping(true);
    fetch(`${API_URL}/shipping/estimate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(it => ({ product_id: it.product.id, quantity: it.quantity })),
        province: form.province,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setShippingEstimates(data);
        // Auto-select cheapest option for each store
        if (data?.stores) {
          const selections: Record<string, string> = {};
          data.stores.forEach((s: any) => {
            if (s.available_methods?.length > 0) {
              selections[s.store_id] = s.available_methods[0].rate_id;
            }
          });
          setShippingSelections(selections);
        }
      })
      .catch(() => setShippingEstimates(null))
      .finally(() => setEstimatingShipping(false));
  }, [form.province, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fullName || !form.phone || !form.email || !form.address || !form.city || !form.province) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    setError('');

    const token = localStorage.getItem('access_token');

    try {
      const body = {
        items: items.map(it => ({
          product_id: it.product.id,
          quantity: it.quantity,
        })),
        shipping_address: {
          full_name: form.fullName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          province: form.province,
          province_label: PROVINCES.find(p => p.value === form.province)?.label || form.province,
          notes: form.notes,
        },
        payment_method: paymentMethod,
        shipping_selections: shippingSelections,
        buyer_notes: form.notes,
      };

      const res = await fetch(`${API_URL}/orders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(typeof errData === 'object' ? Object.values(errData).flat().join('. ') : 'Erro ao criar encomenda.');
      }

      const data = await res.json();
      setOrderData(data);
      setConfirmed(true);
      clearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Erro ao processar encomenda.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation screen
  if (confirmed && orderData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <CheckCircle className="mx-auto text-green-600 mb-6" size={80} />
        <h2 className="text-3xl font-bold mb-4">Pedido Confirmado!</h2>
        <p className="text-lg text-muted-foreground mb-6">
          {paymentMethod === 'test'
            ? '🧪 Modo Teste — a sua encomenda foi criada com pagamento automático.'
            : 'Obrigado pela sua compra. Receberá um email com os detalhes.'}
        </p>
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <p className="font-semibold mb-2">Número do Pedido:</p>
          <p className="text-2xl font-bold text-accent">{orderData.order_number}</p>
          <p className="text-sm text-muted-foreground mt-2">Estado: {orderData.status}</p>
          {orderData.payment_status === 'completed' && (
            <span className="inline-block mt-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              ✅ Pago
            </span>
          )}
        </div>
        <div className="bg-muted rounded-lg p-6 mb-6 text-left">
          <h3 className="font-semibold mb-3">Próximos Passos:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            {paymentMethod === 'test' ? (
              <>
                <li>A encomenda foi processada automaticamente</li>
                <li>Produtos digitais e cursos já estão disponíveis</li>
                <li>Pode ver os seus cursos em <Link href="/my-courses" className="text-accent hover:underline">Meus Cursos</Link></li>
                <li>Downloads disponíveis em <Link href="/account/downloads" className="text-accent hover:underline">Minha Conta → Downloads</Link></li>
              </>
            ) : (
              <>
                <li>Verifique seu email para confirmação do pedido</li>
                <li>Siga as instruções de pagamento recebidas</li>
                <li>Após confirmação do pagamento, enviaremos seu produto</li>
                <li>Receberá código de rastreamento por email</li>
              </>
            )}
          </ol>
        </div>
        <div className="flex gap-3 justify-center">
          <Link
            href="/account/orders"
            className="inline-block px-6 py-3 border border-border hover:bg-muted font-semibold rounded-md transition-colors"
          >
            Ver Encomendas
          </Link>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors"
          >
            Continuar Comprando
          </Link>
        </div>
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
                      <option key={prov.value} value={prov.value}>{prov.label}</option>
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

          {/* Shipping Method */}
          {shippingEstimates && shippingEstimates.stores?.some((s: any) => s.available_methods?.length > 0) && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Truck className="text-foreground" size={24} />
                Método de Envio
              </h2>
              {shippingEstimates.stores.map((store: any) => (
                <div key={store.store_id} className="mb-4 last:mb-0">
                  <p className="text-sm font-semibold mb-2">
                    {store.store_name}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({(store.total_weight_kg || 0).toFixed(1)} kg · {store.subtotal.toLocaleString('pt-MZ')} MZN)
                    </span>
                  </p>
                  {store.error ? (
                    <p className="text-red-500 text-sm">{store.error}</p>
                  ) : store.available_methods?.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum método de envio disponível para esta região.</p>
                  ) : (
                    <div className="space-y-2">
                      {store.available_methods.map((method: any) => (
                        <label
                          key={method.rate_id}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                            shippingSelections[store.store_id] === method.rate_id
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`shipping_${store.store_id}`}
                            value={method.rate_id}
                            checked={shippingSelections[store.store_id] === method.rate_id}
                            onChange={() =>
                              setShippingSelections((prev) => ({ ...prev, [store.store_id]: method.rate_id }))
                            }
                            className="w-4 h-4 text-accent"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">
                                {method.method_name}
                                {method.is_free && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-bold">
                                    GRÁTIS
                                  </span>
                                )}
                              </span>
                              <span className={`font-bold text-sm ${method.is_free ? 'text-green-600' : ''}`}>
                                {method.is_free ? '0 MZN' : `${method.price.toLocaleString('pt-MZ')} MZN`}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {method.estimated_days}
                              {method.free_shipping_min && !method.is_free && (
                                <> · Grátis acima de {method.free_shipping_min.toLocaleString('pt-MZ')} MZN</>
                              )}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {estimatingShipping && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> A calcular frete...
                </p>
              )}
            </div>
          )}

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
                {!hasPhysicalItems ? (
                  <span className="text-muted-foreground">Não se aplica</span>
                ) : shippingTotal === 0 && shippingEstimates ? (
                  <span className="text-green-600 font-medium">Grátis</span>
                ) : shippingTotal > 0 ? (
                  <span className="font-medium">MZN {formatPrice(shippingTotal)}</span>
                ) : (
                  <span className="text-muted-foreground">A calcular...</span>
                )}
              </div>
              <div className="border-t border-border pt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-lg">Total:</span>
                  <span className="font-bold text-lg">MZN {formatPrice(totalPrice + shippingTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ou 12x de MZN {formatPrice(totalPrice / 12)} sem juros
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 px-6 py-3 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={18} className="animate-spin" /> A processar...</> : 'Confirmar Pedido'}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

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
