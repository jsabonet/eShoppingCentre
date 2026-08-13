'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Gift, Link as LinkIcon, DollarSign, TrendingUp, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface AffiliateLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/affiliate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/affiliate/products', label: 'Produtos', icon: Gift },
  { href: '/affiliate/links', label: 'Meus Links', icon: LinkIcon },
  { href: '/affiliate/earnings', label: 'Comissões', icon: DollarSign, badge: 'balance' as const },
];

export default function AffiliateLayout({ children }: AffiliateLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balance, setBalance] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    fetch(`${API_URL}/affiliates/me/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.available_commission === 'number') {
          const v = data.available_commission;
          setBalance(v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : `${Math.round(v)}`);
        }
      })
      .catch(() => {});
  }, []);

  const renderItem = (item: typeof navItems[number], collapsed: boolean, onClick?: () => void) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} onClick={onClick}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}>
        <Icon size={20} className="shrink-0" />
        {!collapsed && <span className="flex-1">{item.label}</span>}
        {item.badge === 'balance' && balance && (
          collapsed ? (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full" />
          ) : (
            <span className="px-1.5 h-[18px] text-[10px] bg-green-100 text-green-700 font-bold rounded-full flex items-center">
              {balance} MZN
            </span>
          )
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-muted/30 flex">
      {/* Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-card border-r border-border transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="font-bold text-sm">Painel do Afiliado</h2>
              <p className="text-xs text-muted-foreground">Ganhe dinheiro a promover</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1.5 hover:bg-muted rounded-md transition-colors ${collapsed ? 'mx-auto' : ''}`}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => renderItem(item, collapsed))}
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
              {navItems.map((item) => renderItem(item, false, () => setMobileOpen(false)))}
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
