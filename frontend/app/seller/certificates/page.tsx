'use client';

import { Award, FileCheck, TrendingUp } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

export default function SellerCertificatesPage() {
  return (
    <SellerLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Certificados</h1>
          <p className="text-sm text-muted-foreground">Certificados emitidos para os seus alunos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700"><Award size={20} /></div>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Certificados Emitidos</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700"><FileCheck size={20} /></div>
            </div>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Este Mês</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="font-bold">Histórico de Certificados</h2>
          </div>
          <div className="p-12 text-center text-muted-foreground">
            <Award size={48} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium mb-1">Nenhum certificado emitido</p>
            <p className="text-sm">Os certificados são gerados automaticamente quando os alunos concluem os cursos.</p>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
