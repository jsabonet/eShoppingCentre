'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Plus, Search, Edit, Trash2, MoreHorizontal, ChevronDown } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

const mockProducts = [
  { id: '1', name: 'Smartphone Pro Max 256GB', price: 4999.99, stock: 25, sales: 45, status: 'Activo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg' },
  { id: '2', name: 'Fone de Ouvido Bluetooth Premium', price: 899.90, stock: 50, sales: 32, status: 'Activo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5aa9c9ce-7e6e-11f1-8ce3-0242ac110002-0DDwAGMnksgDjeC51LGtD.jpg' },
  { id: '3', name: 'Smartwatch Sport GPS', price: 1299.00, stock: 15, sales: 28, status: 'Activo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5ab63e1b-7e6e-11f1-9a5a-0242ac110002-oi7Qh0RDrE8nvf9Gqxvfb.jpg' },
  { id: '4', name: 'Laptop Ultrabook 15" Intel i7', price: 6499.00, stock: 8, sales: 20, status: 'Activo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5b14c4b0-7e6e-11f1-b1e8-0242ac110002-oyS3W01yYqyLQZ3o0OyFG.jpg' },
  { id: '5', name: 'Caixa de Som Bluetooth Portátil', price: 449.90, stock: 0, sales: 18, status: 'Inactivo', image: 'https://cdn.b12.io/client_media/iKv1biKD/5ab2c8b3-7e6e-11f1-abb5-0242ac110002-lhtmOS_6GhLkNyuDZwvsL.jpg' },
  { id: '6', name: 'Tablet 10" com Stylus', price: 2199.00, stock: 12, sales: 15, status: 'Rascunho', image: 'https://cdn.b12.io/client_media/iKv1biKD/5b46db3a-7e6e-11f1-98fb-0242ac110002-yUsdDCiNGkUXvIXwHDkP9.jpg' },
];

export default function SellerProductsPage() {
  const [search, setSearch] = useState('');
  const filtered = mockProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="text-sm text-muted-foreground">Gerencie os produtos da sua loja</p>
          </div>
          <Link href="/seller/products/new"
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
            <Plus size={16} /> Novo Produto
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar produtos..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select className="px-3 py-2 border border-border rounded-md text-sm bg-background">
            <option>Todos os status</option>
            <option>Activo</option>
            <option>Inactivo</option>
            <option>Rascunho</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Produto</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Preço</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Vendas</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img src={product.image} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-medium truncate max-w-[200px]">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{product.price.toFixed(2).replace('.', ',')} MZN</td>
                    <td className="py-3 px-4">
                      <span className={product.stock === 0 ? 'text-red-600 font-medium' : ''}>
                        {product.stock === 0 ? 'Sem stock' : product.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4">{product.sales}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.status === 'Activo' ? 'bg-green-100 text-green-700' :
                        product.status === 'Inactivo' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{product.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/seller/products/${product.id}/edit`}
                          className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
                          <Edit size={16} />
                        </Link>
                        <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Nenhum produto encontrado</div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
