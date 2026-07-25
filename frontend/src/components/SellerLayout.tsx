'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Users, DollarSign, Settings, Store,
  ChevronLeft, ChevronRight, LogOut, Plus, ExternalLink, TrendingUp, Gift, Menu, X
} from 'lucide-react';

interface SellerLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seller/products', label: 'Produtos', icon: Package },
  { href: '/seller/orders', label: 'Encomendas', icon: ShoppingCart },
  { href: '/seller/affiliates', label: 'Afiliados', icon: Users },
  { href: '/seller/earnings', label: 'Ganhos', icon: DollarSign },
  { href: '/seller/settings', label: 'Configurações', icon: Settings },
];

export default function SellerLayout({ children }: SellerLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[calc(100vh-200px)] bg-muted/30 flex">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden lg:flex flex-col bg-card border-r border-border transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="font-bold text-sm">Painel do Vendedor</h2>
              <p className="text-xs text-muted-foreground">TechnoMoz</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-muted rounded-md transition-colors">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Store Link */}
        <div className="p-3 border-t border-border">
          <Link
            href="/store/tecnomoz"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink size={18} />
            {!collapsed && <span>Ver Loja</span>}
          </Link>
        </div>
      </aside>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold">Painel do Vendedor</h2>
              <button onClick={() => setMobileOpen(false)} className="p-1 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-card border-b border-border">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 hover:bg-muted rounded-md">
            <Menu size={20} />
          </button>
          <h2 className="font-bold text-sm">Painel do Vendedor</h2>
          <Link href="/store/tecnomoz" className="p-1.5 hover:bg-muted rounded-md">
            <ExternalLink size={18} />
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}
