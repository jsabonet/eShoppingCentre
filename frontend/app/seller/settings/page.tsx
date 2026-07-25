'use client';

import { useState } from 'react';
import { Settings, Save, Upload } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

export default function SellerSettingsPage() {
  const [form, setForm] = useState({
    storeName: 'TechnoMoz',
    description: 'Especialistas em tecnologia e eletrônicos. Os melhores preços em smartphones, laptops e acessórios.',
    phone: '+258 84 123 4567',
    email: 'info@tecnomoz.co.mz',
    location: 'Maputo',
    defaultCommission: '10',
    shippingPolicy: 'Envio para todo Moçambique em 2-5 dias úteis. Frete grátis acima de 199 MZN.',
    returnPolicy: 'Devolução em até 7 dias após o recebimento. Produto deve estar em perfeito estado.',
  });

  const updateField = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Configurações salvas com sucesso!');
  };

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações da Loja</h1>
          <p className="text-sm text-muted-foreground">Gerencie as informações e políticas da sua loja</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Store Identity */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Identidade da Loja</h2>
            <div className="flex items-center gap-6 mb-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted">
                <img src="https://cdn.b12.io/client_media/iKv1biKD/5aa3154d-7e6e-11f1-82d2-0242ac110002-9e8FSvH-aRUq9K6kB6vgg.jpg" alt="" className="w-full h-full object-cover" />
              </div>
              <button type="button" className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted flex items-center gap-2">
                <Upload size={16} /> Alterar Logótipo
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome da Loja</label>
              <input type="text" value={form.storeName} onChange={(e) => updateField('storeName', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none" />
            </div>
          </div>

          {/* Contact */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Informações de Contacto</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input type="text" value={form.phone} onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Localização</label>
              <select value={form.location} onChange={(e) => updateField('location', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option>Maputo</option><option>Beira</option><option>Nampula</option><option>Pemba</option>
              </select>
            </div>
          </div>

          {/* Commission */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Comissão de Afiliados</h2>
            <p className="text-sm text-muted-foreground">Percentagem padrão para novos produtos (pode ser alterada por produto).</p>
            <div className="flex items-center gap-3">
              <input type="number" value={form.defaultCommission} onChange={(e) => updateField('defaultCommission', e.target.value)}
                className="w-24 px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>

          {/* Policies */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold">Políticas</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Política de Envio</label>
              <textarea value={form.shippingPolicy} onChange={(e) => updateField('shippingPolicy', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Política de Devolução</label>
              <textarea value={form.returnPolicy} onChange={(e) => updateField('returnPolicy', e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
              <Save size={16} /> Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    </SellerLayout>
  );
}
