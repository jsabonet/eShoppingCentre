'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Gift, Check, DollarSign, Users, TrendingUp } from 'lucide-react';

const benefits = [
  { icon: DollarSign, title: 'Comissões Atrativas', desc: 'Ganhe até 15% por venda realizada através dos seus links.' },
  { icon: LinkIcon, title: 'Links Personalizados', desc: 'Links únicos para partilhar no WhatsApp, Facebook, Instagram e sites.' },
  { icon: TrendingUp, title: 'Acompanhe seu Desempenho', desc: 'Dashboard completo com cliques, vendas e comissões em tempo real.' },
  { icon: Users, title: 'Sem Limites', desc: 'Promova quantos produtos quiser, de quantas lojas quiser.' },
];

function LinkIcon(props: { size?: number; className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}

export default function AffiliateRegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', agree: false });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Parabéns! Você agora é um afiliado do eShoppingCentre! 🎉');
  };

  return (
    <main className="min-h-[calc(100vh-200px)] py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex p-3 bg-accent/10 rounded-full mb-4">
            <Gift size={32} className="text-accent" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Torne-se um Afiliado</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ganhe dinheiro promovendo produtos do eShoppingCentre. Partilhe links, ganhe comissões e acompanhe tudo pelo seu painel.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="bg-card border border-border rounded-xl p-5 text-center hover:shadow-md transition-shadow">
                <div className="inline-flex p-3 bg-accent/10 rounded-full mb-3"><Icon size={24} className="text-accent" /></div>
                <h3 className="font-bold text-sm mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* How it works */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Como Funciona</h2>
            <div className="space-y-6">
              {[
                { step: '1', title: 'Registe-se', desc: 'Crie sua conta de afiliado gratuitamente.' },
                { step: '2', title: 'Escolha Produtos', desc: 'Navegue pelos produtos disponíveis para afiliação.' },
                { step: '3', title: 'Gere Links', desc: 'Crie links únicos para cada produto.' },
                { step: '4', title: 'Promova', desc: 'Partilhe nas redes sociais, WhatsApp ou site.' },
                { step: '5', title: 'Ganhe', desc: 'Receba comissões por cada venda realizada.' },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">{item.step}</div>
                  <div>
                    <h3 className="font-medium text-sm">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-6">Criar Conta de Afiliado</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome Completo *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})}
                  className="w-full px-4 py-2.5 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+258 84 000 0000" />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.agree} onChange={(e) => setForm({...form, agree: e.target.checked})}
                  className="mt-1 accent-accent" required />
                <span className="text-sm text-muted-foreground">
                  Concordo com os <Link href="/terms" className="text-accent hover:underline">Termos do Programa de Afiliados</Link>
                </span>
              </label>
              <button type="submit" className="w-full px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
                <Gift size={18} /> Tornar-me Afiliado
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
