'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Gift, Link as LinkIcon, DollarSign, TrendingUp, Menu, X } from 'lucide-react';

interface AffiliateLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/affiliate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/affiliate/products', label: 'Produtos', icon: Gift },
  { href: '/affiliate/links', label: 'Meus Links', icon: LinkIcon },
  { href: '/affiliate/earnings', label: 'Comissões', icon: DollarSign },
];

export default function AffiliateLayout({ children }: AffiliateLayoutProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[calc(100vh-200px)] bg-muted/30 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-sm">Painel do Afiliado</h2>
          <p className="text-xs text-muted-foreground">Ganhe dinheiro a promover</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}>
                <Icon size={20} /> {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold">Painel Afiliado</h2>
              <button onClick={() => setMobileOpen(false)} className="p-1 hover:bg-muted rounded"><X size={20} /></button>
            </div>
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}>
                    <Icon size={20} /> {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="lg:hidden flex items-center justify-between p-4 bg-card border-b border-border">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 hover:bg-muted rounded-md"><Menu size={20} /></button>
          <h2 className="font-bold text-sm">Painel do Afiliado</h2>
          <div className="w-8" />
        </div>
        {children}
      </div>
    </div>
  );
}
