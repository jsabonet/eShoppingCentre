'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Download, ArrowUp, ArrowDown } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const transactions = [
  { id: 'TXN-001', description: 'Venda - Smartphone Pro Max', amount: '+4.999,99 MZN', date: 'Hoje, 14:30', type: 'sale' },
  { id: 'TXN-002', description: 'Comissão Afiliado - Ana M.', amount: '-499,99 MZN', date: 'Hoje, 14:30', type: 'commission' },
  { id: 'TXN-003', description: 'Venda - Fone Bluetooth', amount: '+899,90 MZN', date: 'Hoje, 11:20', type: 'sale' },
  { id: 'TXN-004', description: 'Taxa Plataforma (8%)', amount: '-479,99 MZN', date: 'Hoje, 11:20', type: 'fee' },
  { id: 'TXN-005', description: 'Saque M-Pesa', amount: '-15.000,00 MZN', date: '19 Jul', type: 'withdrawal' },
  { id: 'TXN-006', description: 'Venda - Smartwatch GPS', amount: '+1.299,00 MZN', date: '18 Jul', type: 'sale' },
  { id: 'TXN-007', description: 'Venda - Laptop Ultrabook', amount: '+6.499,00 MZN', date: '17 Jul', type: 'sale' },
];

export default function SellerEarningsPage() {
  const [period, setPeriod] = useState('7d');

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Ganhos</h1>
            <p className="text-sm text-muted-foreground">Acompanhe seus rendimentos e solicite saques</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-border rounded-md text-sm bg-background">
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="12m">Último ano</option>
            </select>
            <button className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted flex items-center gap-2">
              <Download size={16} /> Exportar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Saldo Disponível</p>
            <p className="text-3xl font-bold text-accent">32.450 MZN</p>
            <button className="mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
              Solicitar Saque
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Receita Total</p>
            <p className="text-2xl font-bold">45.600 MZN</p>
            <span className="flex items-center gap-1 text-xs text-green-600 mt-1"><ArrowUp size={12} /> +12% este período</span>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-1">Comissões Pagas</p>
            <p className="text-2xl font-bold">3.450 MZN</p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">Aos afiliados</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Transações</h2>
          </div>
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    tx.type === 'sale' ? 'bg-green-100' :
                    tx.type === 'withdrawal' ? 'bg-red-100' :
                    tx.type === 'commission' ? 'bg-purple-100' :
                    'bg-gray-100'
                  }`}>
                    {tx.type === 'sale' ? <TrendingUp size={16} className="text-green-700" /> :
                     tx.type === 'withdrawal' ? <TrendingDown size={16} className="text-red-700" /> :
                     <DollarSign size={16} className={tx.type === 'commission' ? 'text-purple-700' : 'text-gray-700'} />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.date} • {tx.id}</p>
                  </div>
                </div>
                <span className={`font-medium ${
                  tx.amount.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
