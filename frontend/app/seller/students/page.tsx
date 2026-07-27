'use client';

import { GraduationCap, Users, Search, TrendingUp, BarChart3 } from 'lucide-react';
import SellerLayout from '@/src/components/SellerLayout';

export default function SellerStudentsPage() {
  const stats = [
    { label: 'Total Alunos', value: '0', icon: Users, color: 'bg-indigo-100 text-indigo-700' },
    { label: 'Activos Esta Semana', value: '0', icon: TrendingUp, color: 'bg-green-100 text-green-700' },
    { label: 'Taxa Conclusão', value: '0%', icon: BarChart3, color: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <SellerLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os alunos inscritos nos seus cursos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}><Icon size={20} /></div>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Buscar alunos..." className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="divide-y divide-border">
            <div className="p-12 text-center text-muted-foreground">
              <GraduationCap size={48} className="mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium mb-1">Nenhum aluno ainda</p>
              <p className="text-sm">Os alunos aparecerão aqui quando se inscreverem nos seus cursos.</p>
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
