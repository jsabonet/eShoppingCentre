'use client';

import { Users, Search, TrendingUp, DollarSign, MousePointerClick } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const affiliates = [
  { name: 'Ana Mondlane', email: 'ana@email.com', products: 12, clicks: 345, sales: 23, commission: '4.250 MZN', status: 'Activo' },
  { name: 'Pedro Chissano', email: 'pedro@email.com', products: 8, clicks: 234, sales: 15, commission: '2.890 MZN', status: 'Activo' },
  { name: 'Helena Langa', email: 'helena@email.com', products: 5, clicks: 189, sales: 10, commission: '1.750 MZN', status: 'Activo' },
  { name: 'Mário Uane', email: 'mario@email.com', products: 3, clicks: 67, sales: 4, commission: '980 MZN', status: 'Activo' },
];

export default function SellerAffiliatesPage() {
  return (
    <SellerLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Afiliados</h1>
          <p className="text-sm text-muted-foreground">Gerencie os afiliados que promovem seus produtos</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Users size={18} className="text-blue-600" /><span className="text-sm text-muted-foreground">Total Afiliados</span></div>
            <p className="text-2xl font-bold">23</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><MousePointerClick size={18} className="text-purple-600" /><span className="text-sm text-muted-foreground">Total Cliques</span></div>
            <p className="text-2xl font-bold">1.234</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><span className="text-sm text-muted-foreground">Vendas por Afiliados</span></div>
            <p className="text-2xl font-bold">52</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className="text-accent" /><span className="text-sm text-muted-foreground">Comissões Pagas</span></div>
            <p className="text-2xl font-bold">9.870 MZN</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Afiliado</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produtos</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliques</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendas</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Conversão</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Comissão</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {affiliates.map((aff) => (
                  <tr key={aff.email} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{aff.name}</p>
                        <p className="text-xs text-muted-foreground">{aff.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">{aff.products}</td>
                    <td className="py-3 px-4">{aff.clicks}</td>
                    <td className="py-3 px-4">{aff.sales}</td>
                    <td className="py-3 px-4">{((aff.sales / aff.clicks) * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 font-medium">{aff.commission}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Activo</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
