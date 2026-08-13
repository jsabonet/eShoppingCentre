'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User, ShoppingBag, MapPin, Download, Heart, LogOut, ChevronLeft, ChevronRight,
  Package, Settings, Store, Gift, Menu, X, LayoutDashboard, BookOpen, MessageCircle, LifeBuoy, Wallet
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';

interface AccountLayoutProps {
  children: React.ReactNode;
}

interface AccountNavItem {
  href: string;
  label: string;
  icon: any;
  badge?: 'orders';
}

interface AccountNavGroup {
  label: string;
  items: AccountNavItem[];
}

const navGroups: AccountNavGroup[] = [
  { label: '', items: [{ href: '/account', label: 'Visão Geral', icon: User }] },
  {
    label: 'Compras',
    items: [
      { href: '/account/orders', label: 'Minhas Encomendas', icon: Package, badge: 'orders' },
      { href: '/account/tickets', label: 'Meus Tickets', icon: LifeBuoy },
      { href: '/account/downloads', label: 'Downloads', icon: Download },
      { href: '/account/wishlist', label: 'Lista de Desejos', icon: Heart },
    ],
  },
  {
    label: 'Conta',
    items: [
      { href: '/account/profile', label: 'Meu Perfil', icon: Settings },
      { href: '/account/addresses', label: 'Endereços', icon: MapPin },
      { href: '/account/wallet', label: 'Carteira', icon: Wallet },
    ],
  },
  {
    label: 'Comunicação',
    items: [
      { href: '/account/messages', label: 'Mensagens', icon: MessageCircle },
    ],
  },
  {
    label: 'Educação',
    items: [
      { href: '/account/courses', label: 'Meus Cursos', icon: BookOpen },
    ],
  },
];

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<{ orders: number }>({ orders: 0 });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    fetch(`${API_URL}/orders/my/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list = data?.results || data || [];
        const active = list.filter((o: any) => ['pending', 'confirmed', 'processing', 'shipped', 'ready_for_pickup'].includes(o.status)).length;
        setBadges({ orders: active });
      })
      .catch(() => {});
  }, []);
  const { user, isAdmin, logout, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 hover:bg-muted rounded-md">
          <Menu size={20} />
        </button>
        <h1 className="text-2xl font-bold">Minha Conta</h1>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Desktop */}
        <aside className={`hidden lg:block ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 transition-all duration-300`}>
          <nav className="sticky top-32 space-y-1 bg-card border border-border rounded-xl p-3">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-end'} pb-1`}>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
                title={collapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
            {navGroups.map((group) => (
              <div key={group.label} className="mb-1">
                {!collapsed && group.label && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    const badgeCount = item.badge ? badges[item.badge] : 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon size={18} className="shrink-0" />
                        {!collapsed && <span className="flex-1">{item.label}</span>}
                        {badgeCount > 0 && (
                          <span className={`${collapsed ? 'absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px]' : 'min-w-[18px] h-[18px] text-[10px]'} bg-red-500 text-white font-bold rounded-full flex items-center justify-center px-1`}>
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <hr className="border-border my-2" />
            {isAdmin && (
              <Link
                href="/admin"
                title={collapsed ? 'Painel Admin' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
              >
                <LayoutDashboard size={18} className="shrink-0" />
                {!collapsed && <span>Painel Admin</span>}
              </Link>
            )}
            <Link
              href="/seller/dashboard"
              title={collapsed ? 'Ser Vendedor' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
            >
              <Store size={18} className="shrink-0" />
              {!collapsed && <span>Ser Vendedor</span>}
            </Link>
            <button
              onClick={handleLogout}
              title={collapsed ? 'Sair' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer ${collapsed ? 'justify-center' : ''}`}
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </nav>
        </aside>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-xl">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold">Minha Conta</h2>
                <button onClick={() => setMobileOpen(false)} className="p-1 hover:bg-muted rounded"><X size={20} /></button>
              </div>
              <nav className="p-3 space-y-1">
                {navGroups.map((group) => (
                  <div key={group.label} className="mb-1">
                    {group.label && (
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                    )}
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        const badgeCount = item.badge ? badges[item.badge] : 0;
                        return (
                          <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}>
                            <Icon size={18} />
                            <span className="flex-1">{item.label}</span>
                            {badgeCount > 0 && (
                              <span className="min-w-[18px] h-[18px] text-[10px] bg-red-500 text-white font-bold rounded-full flex items-center justify-center px-1">
                                {badgeCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
