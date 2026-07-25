'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Upload, Info } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const [productType, setProductType] = useState<'physical' | 'digital'>('physical');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Produto actualizado com sucesso!');
    router.push('/seller/products');
  };

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/seller/products" className="p-1.5 hover:bg-muted rounded-md"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-bold">Editar Produto</h1>
            <p className="text-sm text-muted-foreground">A actualizar o produto #{params.id}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Informações do Produto</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Nome do Produto</label>
              <input type="text" defaultValue="Smartphone Pro Max 256GB" className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea defaultValue="Smartphone de última geração..." className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-32 resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Preço (MZN)</label>
                <input type="number" step="0.01" defaultValue="4999.99" className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preço Original</label>
                <input type="number" step="0.01" defaultValue="5999.99" className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <select className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option selected>Eletrônicos</option>
                  <option>Moda</option>
                  <option>Casa & Jardim</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Stock</label>
                <input type="number" defaultValue="25" className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked className="accent-accent" /> Produto em destaque</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-accent" /> Em promoção</label>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-bold mb-4">Imagens</h2>
            <div className="border-2 border-dashed border-border rounded-lg p-10 text-center hover:border-accent cursor-pointer">
              <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Clique para substituir imagens</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-bold mb-4">Comissão de Afiliados</h2>
            <div className="flex items-center gap-3">
              <input type="number" defaultValue="10" className="w-24 px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/seller/products" className="px-6 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</Link>
            <button type="submit" className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
              <Save size={16} /> Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  );
}
