'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Truck, CreditCard, MapPin, CheckCircle, Loader2, Info, X } from 'lucide-react';
import { useCart } from '@/src/contexts/CartContext';
import { paymentsAPI } from '@/src/lib/api';
import {
  savePendingCheckout,
  readPendingCheckout,
  clearPendingCheckout,
} from '@/src/lib/pendingCheckout';

function formatPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : '';
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

const PAYMENT_METHOD = 'mpesa';
const PAYMENT_INSTRUCTIONS = [
  'No próximo passo, indique o número M-Pesa a debitar; pode ser diferente do telefone de contacto.',
  'Confirme o valor e autorize a operação no seu telefone.',
  'A encomenda só será atualizada depois da confirmação do pagamento.',
];

export default function CheckoutContent() {
  const router = useRouter();
  const { items, totalPrice } = useCart();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentNotice, setShowPaymentNotice] = useState(true);
  const [error, setError] = useState('');
  const [shippingEstimates, setShippingEstimates] = useState<any>(null);
  const [shippingSelections, setShippingSelections] = useState<Record<string, string>>({});
  const [estimatingShipping, setEstimatingShipping] = useState(false);
  const [shippingError, setShippingError] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState<any>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [reconcilingPayment, setReconcilingPayment] = useState(false);

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

  // O checkout hospedado da VPay devolve-nos para `/checkout` (URL de retorno
  // configurada no painel), sem parâmetro de referência. Se já existir um
  // checkout pendente, reconciliamos o estado real do pagamento para não
  // voltar a mostrar as seleções do pedido como se nada tivesse acontecido.
  useEffect(() => {
    const pending = readPendingCheckout();
    if (!pending) return;

    let cancelled = false;
    setReconcilingPayment(true);

    (async () => {
      try {
        const res = await paymentsAPI.status(pending.reference);
        if (cancelled) return;
        const st = res.data?.status;
        if (st === 'completed' || st === 'pending') {
          // `completed`: fecha o ciclo e confirma. `pending`: a página de
          // sucesso continua a fazer poll até à confirmação (ou falha), evitando
          // que o cliente volte a submeter e crie uma encomenda duplicada.
          router.replace(`/checkout/success?reference=${pending.reference}`);
          return;
        }
        // `failed`/`not_found`: pagamento não concretizado; limpa o registo
        // para o cliente poder tentar de novo sem estado antigo.
        clearPendingCheckout();
      } catch {
        // Sem ligação/estado: mantém a página e o registo para nova tentativa.
      } finally {
        if (!cancelled) setReconcilingPayment(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Redirect to cart if empty (only on initial load, not after confirmation)
  useEffect(() => {
    if (items.length === 0 && !reconcilingPayment) {
      router.push('/cart');
    }
  }, [items, router, reconcilingPayment]);

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

  const discountAmount = useMemo(() => {
    if (!couponInfo) return 0;
    if (couponInfo.discount_type === 'percentage') return totalPrice * (couponInfo.discount_value / 100);
    return Math.min(Number(couponInfo.discount_value), totalPrice);
  }, [couponInfo, totalPrice]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    try {
      const res = await fetch(`${API_URL}/products/coupons/validate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setCouponInfo(data);
        setError('');
      } else {
        const d = await res.json().catch(() => ({}));
        setCouponInfo(null);
        setError(d.detail || 'Cupão inválido.');
      }
    } catch {
      setCouponInfo(null);
      setError('Erro ao validar cupão.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Fetch shipping estimates when province or items change
  useEffect(() => {
    setShippingError(false);
    if (!form.province || items.length === 0) {
      setShippingEstimates(null);
      return;
    }

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
      .then(res => {
        if (!res.ok) {
          setShippingError(true);
          return null;
        }
        setShippingError(false);
        return res.json();
      })
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
      .catch(() => {
        setShippingError(true);
        setShippingEstimates(null);
      })
      .finally(() => setEstimatingShipping(false));
  }, [form.province, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fullName || !form.phone || !form.email) {
      alert('Por favor, preencha os campos obrigatórios.');
      return;
    }
    if (hasPhysicalItems && (!form.address || !form.city || !form.province)) {
      alert('Por favor, preencha a morada de entrega.');
      return;
    }

    if (hasPhysicalItems) {
      const stores = shippingEstimates?.stores || [];
      const missing = stores.filter((s: any) => s.available_methods?.length > 0 && !shippingSelections[s.store_id]);
      const unavailable = stores.filter((s: any) => !s.available_methods?.length);
      if (missing.length > 0) {
        alert('Selecione o método de envio para todas as lojas.');
        return;
      }
      if (unavailable.length > 0) {
        alert('Algumas lojas não têm opções de envio disponíveis. Remova os itens ou contacte o vendedor.');
        return;
      }
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
        shipping_address: hasPhysicalItems
          ? {
              full_name: form.fullName,
              phone: form.phone,
              email: form.email,
              address: form.address,
              city: form.city,
              province: form.province,
              province_label: PROVINCES.find(p => p.value === form.province)?.label || form.province,
              notes: form.notes,
            }
          : {
              full_name: form.fullName,
              phone: form.phone,
              email: form.email,
            },
        payment_method: PAYMENT_METHOD,
        shipping_selections: shippingSelections,
        buyer_notes: form.notes,
        ...(couponInfo?.code ? { coupon_code: couponInfo.code } : {}),
        ...(getCookie('ref') ? { affiliate_code: getCookie('ref') } : {}),
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
      const orders = Array.isArray(data) ? data : [data];

      const orderIds = orders.map((o: any) => o.id);
      let checkoutUrl = '';
      let reference = '';
      try {
        const payRes = await paymentsAPI.initiate({ order_ids: orderIds, method: PAYMENT_METHOD });
        checkoutUrl = payRes.data?.checkout_url || '';
        reference = payRes.data?.reference || '';
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Erro ao iniciar pagamento.');
        setSubmitting(false);
        return;
      }
      if (checkoutUrl) {
        // O carrinho só é limpo depois da confirmação do pagamento.
        savePendingCheckout(reference, items.map((i) => i.product.id));
        window.location.href = checkoutUrl;
        return;
      }
      setError('Não foi possível iniciar o pagamento. Tente novamente.');
      setSubmitting(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar encomenda.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      {reconcilingPayment && (
        <div className="max-w-xl mx-auto mb-6 flex items-center justify-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
          <Loader2 size={18} className="animate-spin shrink-0" />
          A confirmar o estado do seu pagamento…
        </div>
      )}
      {showPaymentNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-notice-title"
            className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
          >
            <button
              type="button"
              onClick={() => setShowPaymentNotice(false)}
              aria-label="Fechar aviso"
              className="absolute right-4 top-4 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={20} />
            </button>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Info size={22} />
            </div>
            <h2 id="payment-notice-title" className="mb-2 text-xl font-bold">
              Pagamento disponível
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Neste momento, aceitamos pagamentos apenas por M-Pesa. O e-Mola e as
              restantes carteiras serão disponibilizados mais tarde.
            </p>
            <button
              type="button"
              onClick={() => setShowPaymentNotice(false)}
              className="mt-6 w-full rounded-md bg-accent px-4 py-3 font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Entendi, continuar
            </button>
          </section>
        </div>
      )}

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
              {hasPhysicalItems ? 'Informações de Entrega' : 'Dados de Contacto'}
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
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">Telefone de Contacto *</label>
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
              {hasPhysicalItems ? (
                <>
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
                </>
              ) : (
                <div className="flex items-start gap-3 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                  <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <p>Produtos digitais e cursos não requerem envio — ficam disponíveis imediatamente após o pagamento.</p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Method */}
          {hasPhysicalItems && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                <Truck className="text-foreground" size={24} />
                Método de Envio
              </h2>
              {!form.province ? (
                <p className="text-sm text-muted-foreground mt-2">Selecione a província para calcular o frete.</p>
              ) : estimatingShipping ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                  <Loader2 size={14} className="animate-spin" /> A calcular frete...
                </p>
              ) : !shippingEstimates?.stores?.length ? (
                <p className="text-sm text-amber-600 mt-2">Não foi possível calcular o frete. Tente novamente.</p>
              ) : (
                <>
                  {shippingEstimates.stores.length > 1 && (
                    <p className="text-xs text-muted-foreground mb-4">Produtos de {shippingEstimates.stores.length} lojas diferentes — cada loja tem o seu frete</p>
                  )}
                  {shippingEstimates.stores.map((store: any) => (
                    <div key={store.store_id} className="mb-4 last:mb-0">
                      <p className="text-sm font-semibold mb-2">
                        {store.store_name}
                        <span className="text-muted-foreground font-normal ml-2">
                          ({(store.total_weight_kg || 0).toFixed(1)} kg · {store.subtotal.toLocaleString('pt-MZ')} MZN)
                        </span>
                      </p>
                      {store.error ? (
                        <p className="text-amber-600 text-sm">⚠ {store.error}</p>
                      ) : store.available_methods?.length === 0 ? (
                        <p className="text-amber-600 text-sm">⚠ Nenhum método de envio disponível para esta região.</p>
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
                                    {method.method_type === 'pickup' ? '🏪 ' : ''}
                                    {method.method_name}
                                    {method.is_free && (
                                      <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-bold">
                                        GRÁTIS
                                      </span>
                                    )}
                                  </span>
                                  <span className={`font-bold text-sm ${method.is_free ? 'text-green-600' : ''}`}>
                                    {method.is_free || method.method_type === 'pickup' ? '0 MZN' : `${method.price.toLocaleString('pt-MZ')} MZN`}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {method.method_type === 'pickup' ? (
                                    <>📍 {method.pickup_address || 'Levantamento em loja'}</>
                                  ) : (
                                    <>
                                      {method.estimated_days}
                                      {method.free_shipping_min && !method.is_free && (
                                        <> · Grátis acima de {method.free_shipping_min.toLocaleString('pt-MZ')} MZN</>
                                      )}
                                    </>
                                  )}
                                </p>
                                {method.is_fallback && (
                                  <p className="text-[11px] text-amber-600 mt-1">Estimativa da plataforma — o vendedor pode ajustar o valor depois.</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Payment Method */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CreditCard className="text-foreground" size={24} />
              Método de Pagamento
            </h2>
            <div className="flex items-center gap-3 rounded-lg border-2 border-accent bg-accent/5 p-4">
              <Image
                src="/m-pesa.png"
                alt="M-Pesa"
                width={76}
                height={62}
                className="h-14 w-[76px] object-contain"
              />
              <div>
                <p className="font-semibold">M-Pesa</p>
                <p className="text-sm text-muted-foreground">Pagamento móvel pela rede Vodacom</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-muted p-4">
              <h3 className="mb-2 font-semibold">Próximos passos:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                {PAYMENT_INSTRUCTIONS.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
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
              {/* Cupão */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cupão de desconto"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={applyingCoupon || !couponCode.trim()}
                  className="px-3 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {applyingCoupon ? '...' : 'Aplicar'}
                </button>
              </div>
              {couponInfo && (
                <button type="button" onClick={() => { setCouponInfo(null); setCouponCode(''); }}
                  className="flex items-center gap-1 text-xs text-green-600 font-medium hover:underline">
                  ✅ {couponInfo.code} — {couponInfo.discount_description}
                </button>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">MZN {formatPrice(totalPrice)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Desconto:</span>
                  <span className="text-green-600 font-medium">- MZN {formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Frete:</span>
                {!hasPhysicalItems ? (
                  <span className="text-muted-foreground">Não se aplica</span>
                ) : !form.province ? (
                  <span className="text-amber-600 font-medium">Selecione a província</span>
                ) : estimatingShipping ? (
                  <span className="text-muted-foreground">A calcular...</span>
                ) : shippingError ? (
                  <span className="text-red-500 font-medium">Indisponível</span>
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
                  <span className="font-bold text-lg">MZN {formatPrice(Math.max(0, totalPrice + shippingTotal - discountAmount))}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total com frete incluído
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

          </div>
        </div>
      </form>
    </div>
  );
}
