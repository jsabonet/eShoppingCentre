'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, CreditCard, RotateCcw, Loader2, AlertCircle, XCircle,
  Package, CheckCircle2, Circle, Truck, Clock, Ban, Undo2, MessageCircle, Camera, Store,
} from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import LightboxImage from '@/src/components/LightboxImage';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000';

const REASON_CHOICES = [
  { value: 'defective', label: 'Produto com defeito' },
  { value: 'not_as_described', label: 'Produto diferente do anunciado' },
  { value: 'not_satisfied', label: 'Não serviu / Não gostei' },
  { value: 'damaged', label: 'Embalagem danificada' },
  { value: 'wrong_item', label: 'Item errado enviado' },
  { value: 'other', label: 'Outro' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', processing: 'Em Preparação',
  shipped: 'Enviada', ready_for_pickup: 'Pronto para Levantamento',
  delivered: 'Entregue', cancelled: 'Cancelada', refunded: 'Reembolsada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-purple-100 text-purple-700',
  ready_for_pickup: 'bg-teal-100 text-teal-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

function buildTimeline(order: any) {
  const steps: { label: string; date: string | null; done: boolean; active: boolean; icon: any }[] = [];
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  const isPickup = order.is_pickup;
  const statusOrder = isPickup
    ? ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'delivered']
    : ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const idx = statusOrder.indexOf(order.status);

  steps.push({ label: 'Pedido Realizado', date: fmt(order.created_at), done: idx >= 0, active: idx === 0, icon: Package });
  steps.push({ label: 'Pagamento Confirmado', date: order.status !== 'pending' ? fmt(order.confirmed_at ?? order.created_at) : null, done: idx >= 1, active: idx === 1, icon: CreditCard });
  steps.push({ label: 'Em Preparação', date: idx >= 2 ? fmt(order.updated_at) : null, done: idx >= 2, active: idx === 2, icon: Clock });
  steps.push({ label: isPickup ? 'Pronto p/ Levantar' : 'Enviado', date: order.shipped_at ? fmt(order.shipped_at) : null, done: idx >= 3, active: idx === 3, icon: isPickup ? Store : Truck });
  steps.push({ label: 'Entregue', date: order.confirmed_at ? fmt(order.confirmed_at) : null, done: idx >= 4, active: idx === 4, icon: CheckCircle2 });

  if (order.status === 'cancelled') {
    steps.splice(1); steps.push({ label: 'Cancelado', date: fmt(order.updated_at), done: true, active: true, icon: Ban });
  }
  if (order.status === 'refunded') {
    steps.push({ label: 'Reembolsado', date: fmt(order.updated_at), done: true, active: true, icon: Undo2 });
  }
  return steps;
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<any>(null);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [returnForm, setReturnForm] = useState({ reason_type: 'defective', reason: '' });
  const [returnImages, setReturnImages] = useState<File[]>([]);
  const [shipForm, setShipForm] = useState({ shipping_notes: '', buyer_tracking_code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'other', description: '' });
  const [ticketImages, setTicketImages] = useState<File[]>([]);

  const apiHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), };
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [orderRes, returnsRes] = await Promise.all([
          fetch(API_URL + '/orders/' + id + '/', { headers: apiHeaders() }),
          fetch(API_URL + '/orders/returns/my/', { headers: apiHeaders() }),
        ]);
        if (orderRes.ok) setOrder(await orderRes.json());
        if (returnsRes.ok) {
          const data = await returnsRes.json();
          setReturns((data.results || data || []).filter((r: any) => r.order === id));
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [id, apiHeaders]);

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    if (returnImages.length === 0) { setError('Envie pelo menos uma foto do produto para comprovar o problema.'); setSubmitting(false); return; }
    try {
      const res = await fetch(API_URL + '/orders/returns/', {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ order: id, reason_type: returnForm.reason_type, reason: returnForm.reason }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(typeof d === 'object' ? Object.values(d).flat().join('. ') : 'Erro.'); }
      const data = await res.json();
      // Upload photos
      for (const file of returnImages) {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('caption', 'Evidência da devolução');
        await fetch(API_URL + '/orders/returns/' + data.id + '/images/', {
          method: 'POST',
          headers: { Authorization: apiHeaders().Authorization },
          body: fd,
        });
      }
      setReturns(prev => [...prev, data]);
      setReturnImages([]);
      setShowReturnModal(false);
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const handleShipReturn = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const res = await fetch(API_URL + '/orders/returns/' + activeReturn.id + '/ship/', {
        method: 'PATCH', headers: apiHeaders(),
        body: JSON.stringify({ shipping_notes: shipForm.shipping_notes, buyer_tracking_code: shipForm.buyer_tracking_code }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : 'Erro.'); }
      const data = await res.json();
      setReturns(prev => prev.map(r => r.id === data.id ? data : r));
      setShowShipModal(false);
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const handleDispute = async () => {
    if (!rejectedReturn) return;
    setSubmitting(true);
    try {
      const res = await fetch(API_URL + '/orders/returns/' + rejectedReturn.id + '/dispute/', {
        method: 'POST', headers: apiHeaders(),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : 'Erro.'); }
      const data = await res.json();
      setReturns(prev => prev.map(r => r.id === data.id ? data : r));
    } catch (err: any) { alert(err.message); } finally { setSubmitting(false); }
  };

  const handleConfirmDelivery = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(API_URL + '/orders/' + id + '/confirm-delivery/', {
        method: 'POST', headers: apiHeaders(),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : 'Erro.'); }
      setOrder(await res.json());
    } catch (err: any) { alert(err.message); } finally { setSubmitting(false); }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const res = await fetch(API_URL + '/orders/tickets/', {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ order: id, subject: ticketForm.subject, category: ticketForm.category, description: ticketForm.description }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(typeof d === 'object' ? Object.values(d).flat().join('. ') : 'Erro.'); }
      const data = await res.json();
      // Upload das fotos anexadas
      for (const file of ticketImages) {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('caption', 'Anexo do ticket');
        await fetch(API_URL + '/orders/tickets/' + data.id + '/images/', {
          method: 'POST',
          headers: { Authorization: apiHeaders().Authorization },
          body: fd,
        });
      }
      setTicketImages([]);
      setShowTicketModal(false);
      setTicketForm({ subject: '', category: 'other', description: '' });
      alert('Ticket criado com sucesso. A nossa equipa irá responder em breve.');
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  if (loading) return <AccountLayout><div className="flex justify-center py-20"><LoadingSpinner size={32} /></div></AccountLayout>;
  if (!order) return (
    <AccountLayout>
      <div className="text-center py-20">
        <Package size={48} className="mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Encomenda não encontrada</h2>
        <p className="text-muted-foreground mb-6">Não foi possível localizar esta encomenda.</p>
        <Link href="/account/orders" className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors">
          <ArrowLeft size={16} /> Voltar às Encomendas
        </Link>
      </div>
    </AccountLayout>
  );

  const canRequestReturn = ['delivered', 'shipped', 'ready_for_pickup'].includes(order.status) && !returns.some((r: any) => ['requested', 'approved', 'shipped'].includes(r.status));
  const activeReturn = returns.find((r: any) => ['requested', 'approved', 'shipped', 'received', 'refunded'].includes(r.status));
  const rejectedReturn = returns.find((r: any) => r.status === 'rejected');
  const disputedReturn = returns.find((r: any) => r.status === 'disputed');
  const canShipReturn = activeReturn?.status === 'approved';
  const canDispute = rejectedReturn?.status === 'rejected' && !disputedReturn;
  const canConfirmDelivery = order.status === 'shipped' || order.status === 'ready_for_pickup';

  // Janela de devolução: 7 dias após confirmação de entrega
  const returnWindowOpen = (() => {
    if (order.status !== 'delivered') return true;
    const delivered = order.confirmed_at || order.delivered_at;
    if (!delivered) return true;
    const daysSince = (Date.now() - new Date(delivered).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  })();
  const isDigitalOnly = !!order.is_digital_only;
  const hasConsumedDigital = !!order.has_consumed_digital;
  const canRequestReturnFinal = canRequestReturn && returnWindowOpen && !(isDigitalOnly && hasConsumedDigital);

  const timeline = buildTimeline(order);

  return (
    <AccountLayout>
      <div className="space-y-6">

        {/* Breadcrumb + Header */}
        <div>
          <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft size={15} /> Voltar às Encomendas
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{order.order_number}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(order.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                {order.store_name && <> · Vendido por <span className="font-medium text-foreground">{order.store_name}</span></>}
              </p>
            </div>
            <span className={`self-start px-3.5 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
          <h3 className="font-bold text-base mb-5">Acompanhamento</h3>
          <div className="relative">
            {/* desktop: horizontal steps */}
            <div className="hidden sm:flex items-start justify-between">
              {timeline.map((step, i) => (
                <div key={step.label} className="flex flex-col items-center flex-1 relative">
                  {i < timeline.length - 1 && (
                    <div className={`absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 ${step.done ? 'bg-accent' : 'bg-border'}`} />
                  )}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                    step.active ? 'bg-accent text-accent-foreground shadow-md' :
                    step.done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    <step.icon size={18} />
                  </div>
                  <p className={`text-xs font-semibold text-center ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                  {step.date && <p className="text-[11px] text-muted-foreground text-center mt-0.5">{step.date}</p>}
                </div>
              ))}
            </div>
            {/* mobile: vertical steps */}
            <div className="flex sm:hidden flex-col gap-0">
              {timeline.map((step, i) => (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.active ? 'bg-accent text-accent-foreground' :
                      step.done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      <step.icon size={15} />
                    </div>
                    {i < timeline.length - 1 && <div className={`w-0.5 flex-1 min-h-[20px] ${step.done ? 'bg-green-500' : 'bg-border'}`} />}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-semibold ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                    {step.date && <p className="text-xs text-muted-foreground">{step.date}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status History */}
        {order.status_history?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
            <h3 className="font-bold text-base mb-4">Histórico de Atualizações</h3>
            <div className="space-y-3">
              {order.status_history.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{h.changed_by_name}</span>
                      {' '}alterou de{' '}
                      <span className="font-medium">{STATUS_LABELS[h.previous_status] || h.previous_status}</span>
                      {' → '}
                      <span className="font-semibold">{STATUS_LABELS[h.new_status] || h.new_status}</span>
                    </p>
                    {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                    <p className="text-xs text-muted-foreground/60">{new Date(h.created_at).toLocaleDateString('pt-MZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main content: items + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-border">
                <h3 className="font-bold">Itens da Encomenda</h3>
              </div>
              <div className="divide-y divide-border">
                {(order.items || []).map((item: any) => (
                  <div key={item.id} className="flex gap-4 p-4 sm:p-5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted flex-shrink-0 overflow-hidden border border-border">
                      {item.product_image ? (
                        <Image src={item.product_image.startsWith('http') ? item.product_image : MEDIA_URL + item.product_image} alt={item.product_name} width={80} height={80} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package size={28} /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm sm:text-base">{Number(item.total_price).toLocaleString('pt-MZ')} MZN</p>
                      {item.quantity > 1 && <p className="text-xs text-muted-foreground">{Number(item.unit_price).toLocaleString('pt-MZ')} MZN / un</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery + Payment info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><MapPin size={16} className="text-accent" /> Endereço de Entrega</h3>
                {order.shipping_address ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">{order.shipping_address.full_name || order.shipping_address.name}</p>
                    <p>{order.shipping_address.address || order.shipping_address.street}</p>
                    <p>{order.shipping_address.city}{order.shipping_address.province ? `, ${order.shipping_address.province}` : ''}</p>
                    {order.shipping_address.phone && <p>{order.shipping_address.phone}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
                {order.tracking_code && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">Código de Rastreio</p>
                    <p className="text-sm font-mono font-semibold text-accent">{order.tracking_code}</p>
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><CreditCard size={16} className="text-accent" /> Pagamento</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Método</span>
                    <span className="font-medium">{order.payment_method || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estado</span>
                    <span className={`font-medium capitalize ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>{order.payment_status || '—'}</span>
                  </div>
                  {order.shipping_method && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Envio</span>
                      <span className="font-medium">{order.shipping_method}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contacto + Envio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Contactar Vendedor - chat interno + WhatsApp */}
              {order.store_phone && (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <MessageCircle size={16} className="text-green-600" /> Contactar Vendedor
                  </h3>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{order.store_name}</p>
                    <div className="flex gap-2">
                      <a href={`https://wa.me/258${order.store_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WhatsApp
                      </a>
                      <a href={`tel:${order.store_phone}`}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                        {order.store_phone}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping Info */}
              {(order.status === 'shipped' || order.status === 'delivered') && order.shipping_notes && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-purple-700"><Truck size={16} /> Informação de Envio</h3>
                  <p className="text-sm text-purple-800">{order.shipping_notes}</p>
                  {order.tracking_code && <p className="text-xs text-purple-600 mt-1">Ref: {order.tracking_code}</p>}
                  {order.shipping_evidence && (
                    <div className="mt-2">
                      <LightboxImage src={order.shipping_evidence} alt="Evidência de envio" fill
                        className="relative w-32 h-32 rounded-lg overflow-hidden border border-purple-200"
                        imageClassName="object-cover" caption="Evidência de envio" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar: summary */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 sticky top-24">
              <h3 className="font-bold text-base mb-4">Resumo da Encomenda</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{Number(order.subtotal).toLocaleString('pt-MZ')} MZN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Frete</span>
                  <span className="font-medium">{Number(order.shipping_cost || 0) > 0 ? `${Number(order.shipping_cost).toLocaleString('pt-MZ')} MZN` : 'Grátis'}</span>
                </div>
                {Number(order.platform_fee) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de Plataforma</span>
                    <span className="font-medium">{Number(order.platform_fee).toLocaleString('pt-MZ')} MZN</span>
                  </div>
                )}
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-lg">{Number(order.total).toLocaleString('pt-MZ')} MZN</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Returns */}
        {activeReturn && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className={`font-bold mb-2 flex items-center gap-2 ${
              activeReturn.status === 'refunded' ? 'text-green-700' :
              activeReturn.status === 'received' ? 'text-indigo-700' :
              activeReturn.status === 'shipped' ? 'text-purple-700' :
              activeReturn.status === 'approved' ? 'text-blue-700' :
              'text-orange-700'
            }`}>
              {activeReturn.status === 'refunded' ? <CheckCircle2 size={18} /> :
               activeReturn.status === 'received' ? <Package size={18} /> :
               activeReturn.status === 'shipped' ? <Truck size={18} /> :
               <RotateCcw size={18} />}
              {activeReturn.status === 'refunded' ? 'Devolução Concluída' :
               activeReturn.status === 'received' ? 'Devolução Recebida' :
               activeReturn.status === 'shipped' ? 'Devolução em Trânsito' :
               activeReturn.status === 'approved' ? 'Devolução Aprovada' :
               'Devolução Solicitada'}
            </h3>
            <p className="text-sm text-muted-foreground">
              RMA: <span className="font-mono font-semibold">{activeReturn.rma_number}</span>
              {' '}·{' '}
              Estado: <span className="font-semibold capitalize">{activeReturn.status === 'requested' ? 'Solicitada' : activeReturn.status === 'approved' ? 'Aprovada' : activeReturn.status === 'shipped' ? 'Enviada' : activeReturn.status === 'received' ? 'Recebida' : activeReturn.status === 'refunded' ? 'Reembolsada' : activeReturn.status}</span>
            </p>
            {activeReturn.return_instructions && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${
                activeReturn.status === 'refunded' ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'
              }`}>
                <p className="font-semibold mb-1">Instruções do Vendedor:</p>
                <p>{activeReturn.return_instructions}</p>
                {activeReturn.return_address && <p className="mt-1"><span className="font-medium">Endereço para devolução:</span> {activeReturn.return_address}</p>}
              </div>
            )}
            {activeReturn.shipping_notes && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${
                activeReturn.status === 'refunded' ? 'bg-green-50 text-green-800' : 'bg-purple-50 text-purple-800'
              }`}>
                <p className="font-semibold mb-1">Enviado por:</p>
                <p>{activeReturn.shipping_notes}</p>
                {activeReturn.buyer_tracking_code && <p className="mt-1 text-xs text-purple-600">Ref: {activeReturn.buyer_tracking_code}</p>}
              </div>
            )}
            {activeReturn.images?.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold mb-2 text-sm">Fotos enviadas:</p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {activeReturn.images.map((img: any) => (
                    <LightboxImage key={img.id} src={img.image} alt={img.caption || 'Evidência'} fill
                      className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
                      imageClassName="object-cover" caption={img.caption} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmar Envio (estilo MZ - informal) */}
        {canShipReturn && (
          <button onClick={() => { setShipForm({ shipping_notes: '', buyer_tracking_code: '' }); setShowShipModal(true); }}
            className="w-full sm:w-auto px-6 py-3 border-2 border-purple-300 text-purple-700 bg-purple-50 rounded-xl font-semibold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2">
            <Truck size={18} /> Confirmar Envio da Devolução
          </button>
        )}

        {rejectedReturn && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold mb-2 flex items-center gap-2 text-red-700">
              <XCircle size={18} /> Devolução Rejeitada
            </h3>
            <p className="text-sm text-muted-foreground">{rejectedReturn.vendor_notes || 'O vendedor rejeitou o pedido de devolução.'}</p>
          </div>
        )}

        {/* Escalar para Admin */}
        {canDispute && (
          <button onClick={handleDispute} disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 border-2 border-red-300 text-red-700 bg-red-50 rounded-xl font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <AlertCircle size={18} />}
            Escalar para o Administrador
          </button>
        )}

        {/* Disputed */}
        {disputedReturn && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold mb-2 flex items-center gap-2 text-purple-700">
              <AlertCircle size={18} /> Em Análise pelo Administrador
            </h3>
            <p className="text-sm text-muted-foreground">
              A sua contestação da devolução {disputedReturn.rma_number} foi enviada. Um administrador irá rever o caso.
            </p>
          </div>
        )}

        {canRequestReturnFinal && (
          <button onClick={() => setShowReturnModal(true)} className="w-full sm:w-auto px-6 py-3 border-2 border-orange-300 text-orange-700 bg-orange-50 rounded-xl font-semibold hover:bg-orange-100 transition-colors flex items-center justify-center gap-2">
            <RotateCcw size={18} /> Solicitar Devolução
          </button>
        )}

        {isDigitalOnly && (
          <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
            <AlertCircle size={16} className="inline mr-2 text-amber-500" />
            {hasConsumedDigital
              ? 'Produtos digitais e cursos já descarregados ou iniciados não são reembolsáveis.'
              : 'Produtos digitais e cursos só podem ser devolvidos se ainda não tiverem sido descarregados ou iniciados (até 14 dias).'}
          </div>
        )}

        {canRequestReturn && !returnWindowOpen && (
          <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
            <AlertCircle size={16} className="inline mr-2 text-amber-500" />
            O prazo de devolução (7 dias após entrega) já expirou para esta encomenda.
          </div>
        )}

        {/* Confirmar Receção */}
        {canConfirmDelivery && (
          <button onClick={handleConfirmDelivery} disabled={submitting}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {order.is_pickup ? 'Confirmar Levantamento' : 'Confirmar Receção da Encomenda'}
          </button>
        )}

        {/* Preciso de Ajuda */}
        <button onClick={() => { setShowTicketModal(true); setError(''); }}
          className="w-full sm:w-auto px-6 py-3 border border-border text-muted-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2">
          <MessageCircle size={18} /> Preciso de Ajuda
        </button>

        {/* Ticket Modal */}
        {showTicketModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTicketModal(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
              <h2 className="text-lg font-bold mb-1">Preciso de Ajuda</h2>
              <p className="text-sm text-muted-foreground mb-4">Descreva o problema e a nossa equipa de suporte irá ajudar.</p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Assunto</label>
                  <input type="text" placeholder="Ex: Não recebi a minha encomenda" value={ticketForm.subject}
                    onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Categoria</label>
                  <select value={ticketForm.category} onChange={e => setTicketForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="not_received">Não recebi a encomenda</option>
                    <option value="defective">Produto com defeito</option>
                    <option value="wrong_item">Item errado</option>
                    <option value="payment">Problema de pagamento</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Descrição</label>
                  <textarea rows={4} placeholder="Descreva o problema..." value={ticketForm.description}
                    onChange={e => setTicketForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Fotos (opcional)</label>
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/30 transition-colors">
                    <Camera size={18} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {ticketImages.length > 0 ? `${ticketImages.length} foto(s) selecionada(s)` : 'Adicionar foto'}
                    </span>
                    <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                      onChange={e => setTicketImages(Array.from(e.target.files || []))} />
                  </label>
                  {ticketImages.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {ticketImages.map((f, i) => (
                        <img key={i} src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {submitting ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button type="button" onClick={() => setShowTicketModal(false)} className="px-5 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Return Modal */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowReturnModal(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
              <h2 className="text-lg font-bold mb-1">Solicitar Devolução</h2>
              <p className="text-sm text-muted-foreground mb-4">Preencha os detalhes abaixo para iniciar o processo de devolução.</p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
              <form onSubmit={handleRequestReturn} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Motivo da Devolução</label>
                  <select value={returnForm.reason_type} onChange={e => setReturnForm(p => ({ ...p, reason_type: e.target.value }))} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors">
                    {REASON_CHOICES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Descrição do Problema</label>
                  <textarea rows={4} placeholder="Descreva detalhadamente o problema encontrado..." value={returnForm.reason} onChange={e => setReturnForm(p => ({ ...p, reason: e.target.value }))} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Fotos do Produto <span className="text-red-500">*</span></label>
                  <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/30 transition-colors">
                    <Camera size={18} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {returnImages.length > 0 ? `${returnImages.length} foto(s) selecionada(s)` : 'Tirar/Adicionar foto (obrigatório)'}
                    </span>
                    <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                      onChange={e => setReturnImages(Array.from(e.target.files || []))} />
                  </label>
                  {returnImages.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {returnImages.map((f, i) => (
                        <img key={i} src={URL.createObjectURL(f)} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    {submitting ? 'Enviando...' : 'Enviar Pedido'}
                  </button>
                  <button type="button" onClick={() => setShowReturnModal(false)} className="px-5 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Ship Modal (estilo MZ - informal, sem tracking obrigatório) */}
        {showShipModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowShipModal(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
              <h2 className="text-lg font-bold mb-1">Confirmar Envio da Devolução</h2>
              <p className="text-sm text-muted-foreground mb-4">Informe como enviou o produto de volta ao vendedor.</p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
              <form onSubmit={handleShipReturn} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Como enviou?</label>
                  <textarea rows={3} placeholder="Ex: Enviei pela transportadora X, contacto 84xxxxxxx. Ou: Entreguei em mão ao vendedor." value={shipForm.shipping_notes}
                    onChange={e => setShipForm(p => ({ ...p, shipping_notes: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Referência / Contacto (opcional)</label>
                  <input type="text" placeholder="Ex: Nº de telefone do transportador, código de referência..." value={shipForm.buyer_tracking_code}
                    onChange={e => setShipForm(p => ({ ...p, buyer_tracking_code: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                    {submitting ? 'Enviando...' : 'Confirmar Envio'}
                  </button>
                  <button type="button" onClick={() => setShowShipModal(false)} className="px-5 py-2.5 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
