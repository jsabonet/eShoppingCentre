'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User, ShoppingBag, MapPin, Download, Heart, LogOut, ChevronRight,
  Package, Settings, Store, Gift, Menu, X, LayoutDashboard, BookOpen, MessageCircle
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';

interface AccountLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/account', label: 'Visão Geral', icon: User },
  { href: '/account/profile', label: 'Meu Perfil', icon: Settings },
  { href: '/account/orders', label: 'Minhas Encomendas', icon: Package },
  { href: '/account/messages', label: 'Mensagens', icon: MessageCircle },
  { href: '/my-courses', label: 'Meus Cursos', icon: BookOpen },
  { href: '/account/addresses', label: 'Endereços', icon: MapPin },
  { href: '/account/downloads', label: 'Downloads', icon: Download },
  { href: '/account/wishlist', label: 'Lista de Desejos', icon: Heart },
];

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
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
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <nav className="sticky top-32 space-y-1 bg-card border border-border rounded-xl p-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
            <hr className="border-border my-2" />
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LayoutDashboard size={18} />
                Painel Admin
              </Link>
            )}
            <Link
              href="/seller/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Store size={18} />
              Ser Vendedor
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut size={18} />
              Sair
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
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}>
                      <Icon size={18} /> {item.label}
                    </Link>
                  );
                })}
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
