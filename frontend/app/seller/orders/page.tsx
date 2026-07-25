'use client';

import { useState } from 'react';
import { ShoppingCart, Search, ChevronDown, Clock, CheckCircle, Truck, XCircle } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const mockOrders = [
  { id: 'PED-0421', customer: 'João Silva', items: 3, total: '12.300 MZN', status: 'pending', date: 'Hoje, 14:30', payment: 'M-Pesa' },
  { id: 'PED-0420', customer: 'Maria Santos', items: 1, total: '4.798 MZN', status: 'confirmed', date: 'Hoje, 11:20', payment: 'e-Mola' },
  { id: 'PED-0419', customer: 'Carlos Macamo', items: 2, total: '3.499 MZN', status: 'shipped', date: 'Ontem', payment: 'Visa' },
  { id: 'PED-0418', customer: 'Ana Mondlane', items: 1, total: '2.899 MZN', status: 'delivered', date: 'Ontem', payment: 'M-Pesa' },
  { id: 'PED-0417', customer: 'Pedro Chissano', items: 4, total: '8.990 MZN', status: 'delivered', date: '20 Jul', payment: 'Mastercard' },
  { id: 'PED-0416', customer: 'Helena Langa', items: 2, total: '5.200 MZN', status: 'cancelled', date: '19 Jul', payment: 'M-Pesa' },
  { id: 'PED-0415', customer: 'Mário Uane', items: 1, total: '459 MZN', status: 'pending', date: '19 Jul', payment: 'e-Mola' },
  { id: 'PED-0414', customer: 'Lúcia Sitoe', items: 3, total: '7.850 MZN', status: 'confirmed', date: '18 Jul', payment: 'M-Pesa' },
];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function SellerOrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = mockOrders.filter(o => {
    const matchSearch = o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Encomendas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as encomendas recebidas</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por cliente ou ID..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-md text-sm bg-background">
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="shipped">Enviado</option>
            <option value="delivered">Entregue</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((order) => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;
                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{order.id}</td>
                      <td className="py-3 px-4">{order.customer}</td>
                      <td className="py-3 px-4">{order.items}</td>
                      <td className="py-3 px-4 font-medium">{order.total}</td>
                      <td className="py-3 px-4 text-muted-foreground">{order.payment}</td>
                      <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          <StatusIcon size={12} /> {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select className="text-xs px-2 py-1 border border-border rounded bg-background">
                          <option value="">Alterar status</option>
                          <option value="confirmed">Confirmar</option>
                          <option value="shipped">Marcar Enviado</option>
                          <option value="delivered">Marcar Entregue</option>
                          <option value="cancelled">Cancelar</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Nenhuma encomenda encontrada</div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
