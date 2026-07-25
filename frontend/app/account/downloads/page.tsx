'use client';

import { Download, FileText, File, Book, Video, ChevronRight } from 'lucide-react';
import AccountLayout from '@/src/components/AccountLayout';

const downloads = [
  { id: '1', name: 'Guia Completo de Marketing Digital', type: 'ebook', format: 'PDF', size: '12 MB', date: '18 Jul 2026', downloads: 3 },
  { id: '2', name: 'Template de Planilha Financeira', type: 'template', format: 'XLSX', size: '2.5 MB', date: '15 Jul 2026', downloads: 1 },
  { id: '3', name: 'E-book Receitas Saudáveis', type: 'ebook', format: 'PDF', size: '8 MB', date: '10 Jul 2026', downloads: 5 },
];

const typeIcons: Record<string, any> = {
  ebook: Book,
  template: FileText,
  video: Video,
};

export default function DownloadsPage() {
  return (
    <AccountLayout>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Meus Downloads</h2>

        {downloads.length > 0 ? (
          <div className="space-y-4">
            {downloads.map((item) => {
              const Icon = typeIcons[item.type] || File;
              return (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <Icon size={24} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {item.format} • {item.size} • Adquirido em {item.date}
                    </p>
                    <p className="text-xs text-muted-foreground">Descarregado {item.downloads} vez(es)</p>
                  </div>
                  <button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2">
                    <Download size={16} /> Descarregar
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Download size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">Nenhum download disponível</h3>
            <p className="text-muted-foreground">Os seus produtos digitais aparecerão aqui após a compra.</p>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}
