'use client';

import { DollarSign, TrendingUp, ArrowUp, Download } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';

const commissions = [
  { id: 'C-001', product: 'Smartphone Pro Max', amount: '499,99 MZN', date: '20 Jul 2026', status: 'pending' },
  { id: 'C-002', product: 'Fone Bluetooth Premium', amount: '89,99 MZN', date: '20 Jul 2026', status: 'approved' },
  { id: 'C-003', product: 'Laptop Ultrabook 15"', amount: '649,90 MZN', date: '19 Jul 2026', status: 'approved' },
  { id: 'C-004', product: 'Smartwatch Sport GPS', amount: '129,90 MZN', date: '19 Jul 2026', status: 'paid' },
  { id: 'C-005', product: 'Caixa de Som Bluetooth', amount: '44,99 MZN', date: '18 Jul 2026', status: 'paid' },
  { id: 'C-006', product: 'Kit Almofadas Decorativas', amount: '19,99 MZN', date: '17 Jul 2026', status: 'paid' },
  { id: 'C-007', product: 'Perfume Luxo 100ml', amount: '45,90 MZN', date: '16 Jul 2026', status: 'paid' },
];

export default function AffiliateEarningsPage() {
  const totalPending = commissions.filter(c => c.status === 'pending' || c.status === 'approved')
    .reduce((sum, c) => sum + parseFloat(c.amount.replace(',', '.')), 0);
  const totalPaid = commissions.filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + parseFloat(c.amount.replace(',', '.')), 0);

  return (
    <AffiliateLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Comissões</h1>
            <p className="text-sm text-muted-foreground">Acompanhe suas comissões e solicite saques</p>
          </div>
          <button className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-2">
            <Download size={16} /> Exportar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-accent">4.250 MZN</p>
            <button className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90">Solicitar Saque</button>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Pendente</p>
            <p className="text-2xl font-bold text-yellow-600">{totalPending.toFixed(2).replace('.', ',')} MZN</p>
            <span className="text-xs text-muted-foreground">Aguarda aprovação/pagamento</span>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Recebido</p>
            <p className="text-2xl font-bold text-green-600">{totalPaid.toFixed(2).replace('.', ',')} MZN</p>
            <span className="flex items-center gap-1 text-xs text-green-600"><ArrowUp size={12} />Total histórico</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Comissões</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-medium">{c.id}</td>
                    <td className="py-3 px-4">{c.product}</td>
                    <td className="py-3 px-4 font-medium text-accent">{c.amount}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.date}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        c.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {c.status === 'pending' ? 'Pendente' : c.status === 'approved' ? 'Aprovado' : 'Pago'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
