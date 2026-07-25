'use client';

import { useState } from 'react';
import { Link as LinkIcon, Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import AffiliateLayout from '@/src/components/AffiliateLayout';

const mockLinks = [
  { id: '1', product: 'Smartphone Pro Max 256GB', url: 'https://eshoppingcentre.co.mz/produto/smartphone-pro-max?ref=afiliado123', clicks: 145, sales: 12, commission: '10%' },
  { id: '2', product: 'Fone de Ouvido Bluetooth Premium', url: 'https://eshoppingcentre.co.mz/produto/fone-bluetooth?ref=afiliado123', clicks: 89, sales: 7, commission: '10%' },
  { id: '3', product: 'Laptop Ultrabook 15" Intel i7', url: 'https://eshoppingcentre.co.mz/produto/laptop-ultrabook?ref=afiliado123', clicks: 67, sales: 8, commission: '10%' },
  { id: '4', product: 'Smartwatch Sport GPS', url: 'https://eshoppingcentre.co.mz/produto/smartwatch-sport?ref=afiliado123', clicks: 234, sales: 5, commission: '10%' },
];

export default function AffiliateLinksPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AffiliateLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Meus Links de Afiliado</h1>
          <p className="text-sm text-muted-foreground">Gere e partilhe links únicos para cada produto</p>
        </div>

        {/* Generate Link */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="font-bold mb-4">Gerar Novo Link</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <select className="flex-1 px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              <option>Selecionar produto...</option>
              <option>Smartphone Pro Max</option>
              <option>Fone Bluetooth Premium</option>
              <option>Laptop Ultrabook 15"</option>
            </select>
            <button className="px-6 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
              <LinkIcon size={16} /> Gerar Link
            </button>
          </div>
        </div>

        {/* Links List */}
        <div className="space-y-4">
          {mockLinks.map((link) => (
            <div key={link.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-medium text-sm">{link.product}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-md">{link.url}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => copyToClipboard(link.id, link.url)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors">
                    {copiedId === link.id ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  </button>
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Share2 size={16} />
                  </button>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>👁️ {link.clicks} cliques</span>
                <span>🛒 {link.sales} vendas</span>
                <span className="text-accent font-medium">Comissão: {link.commission}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AffiliateLayout>
  );
}
