'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, MapPin, CreditCard, CheckCircle, Clock, Truck, XCircle } from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';

const orderData = {
  id: 'PED-0421',
  date: '20 Julho 2026',
  status: 'shipped' as const,
  payment: 'M-Pesa',
  shipping: 'Entrega Padrão',
  address: 'Av. Julius Nyerere, 1234, Maputo',
  total: '12.300 MZN',
  subtotal: '11.400 MZN',
  shippingCost: 'Grátis',
  items: [
    { name: 'Smartphone Pro Max 256GB', qty: 1, price: '4.999,99 MZN', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg' },
    { name: 'Fone de Ouvido Bluetooth Premium', qty: 2, price: '899,90 MZN', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa9c9ce-7e6e-11f1-8ce3-0242ac110002-0DDwAGMnksgDjeC51LGtD.jpg' },
    { name: 'Caixa de Som Bluetooth Portátil', qty: 1, price: '449,90 MZN', image: 'https://cdn.b12.io/client_media/iKv1biKD/5ab2c8b3-7e6e-11f1-abb5-0242ac110002-lhtmOS_6GhLkNyuDZwvsL.jpg' },
  ],
  timeline: [
    { status: 'Pedido Realizado', date: '20 Jul, 14:30', done: true },
    { status: 'Pagamento Confirmado', date: '20 Jul, 14:32', done: true },
    { status: 'Em Preparação', date: '20 Jul, 16:00', done: true },
    { status: 'Enviado', date: '21 Jul, 09:15', done: true },
    { status: 'Entregue', date: 'Previsão: 24 Jul', done: false },
  ],
};

export default function OrderDetailPage() {
  const params = useParams();
  const order = orderData;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pedido Realizado': return Package;
      case 'Pagamento Confirmado': return CreditCard;
      case 'Em Preparação': return Clock;
      case 'Enviado': return Truck;
      case 'Entregue': return CheckCircle;
      default: return Clock;
    }
  };

  return (
    <AccountLayout>
      <div className="space-y-6">
        <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Voltar às encomendas
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{order.id}</h2>
              <p className="text-sm text-muted-foreground">{order.date}</p>
            </div>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-1">
              <Truck size={16} /> Enviado
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-bold mb-6">Acompanhamento</h3>
          <div className="space-y-0">
            {order.timeline.map((step, i) => {
              const Icon = getStatusIcon(step.status);
              return (
                <div key={step.status} className="flex gap-4 pb-6 relative">
                  {i < order.timeline.length - 1 && (
                    <div className={`absolute left-[15px] top-8 w-0.5 h-full ${step.done ? 'bg-accent' : 'bg-border'}`} />
                  )}
                  <div className={`p-2 rounded-full ${step.done ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'} flex-shrink-0`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.status}</p>
                    <p className="text-xs text-muted-foreground">{step.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Items */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold mb-4">Itens</h3>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.name} className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qtd: {item.qty}</p>
                    <p className="text-sm font-semibold text-accent mt-1">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
            <hr className="border-border my-4" />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{order.subtotal}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frete</span><span className="text-green-600">{order.shippingCost}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span className="text-accent">{order.total}</span></div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold mb-3"><MapPin size={16} className="inline mr-2" />Endereço de Entrega</h3>
              <p className="text-sm text-muted-foreground">{order.address}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold mb-3"><CreditCard size={16} className="inline mr-2" />Pagamento</h3>
              <p className="text-sm text-muted-foreground">{order.payment}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold mb-3"><Truck size={16} className="inline mr-2" />Envio</h3>
              <p className="text-sm text-muted-foreground">{order.shipping}</p>
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
