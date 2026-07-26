'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Store, Filter,
  Edit, BookOpen, Users, LogOut, ChevronLeft, ChevronRight,
  Menu, X, Settings, Bell
} from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin?tab=products', label: 'Produtos', icon: Package },
  { href: '/admin?tab=orders', label: 'Pedidos', icon: ShoppingCart },
  { href: '/admin?tab=stores', label: 'Lojas', icon: Store },
  { href: '/admin?tab=categories', label: 'Categorias', icon: Filter },
  { href: '/admin?tab=blog', label: 'Blog', icon: Edit },
  { href: '/admin?tab=courses', label: 'Cursos', icon: BookOpen },
  { href: '/admin?tab=users', label: 'Utilizadores', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/admin/login';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <AdminSidebarContent
            collapsed={false}
            onClose={() => setMobileOpen(false)}
            onLogout={handleLogout}
            user={user}
          />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex fixed left-0 top-0 h-full z-30 transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}>
        <AdminSidebarContent
          collapsed={collapsed}
          onClose={() => {}}
          onLogout={handleLogout}
          user={user}
        />
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-200 ${collapsed ? 'lg:ml-16' : 'lg:ml-56'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-md">
                <Menu size={20} />
              </button>
              <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block p-1.5 hover:bg-slate-100 rounded-md">
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <Link href="/admin" className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <LayoutDashboard size={18} className="text-indigo-600" />
                <span className={collapsed ? 'hidden' : ''}>Painel Admin</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-1.5 hover:bg-slate-100 rounded-md relative">
                <Bell size={18} className="text-slate-500" />
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <Link href="/" className="text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                Ver Site
              </Link>
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {(user?.first_name?.[0] || user?.username?.[0] || 'A').toUpperCase()}
                </div>
                <span className="text-sm text-slate-700 hidden sm:block">{user?.first_name || user?.username || 'Admin'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-3 px-6 text-center text-xs text-slate-400">
          eShoppingCentre Admin &copy; 2026 — Ambiente Administrativo
        </footer>
      </div>
    </div>
  );
}

function AdminSidebarContent({ collapsed, onClose, onLogout, user }: {
  collapsed: boolean;
  onClose: () => void;
  onLogout: () => void;
  user: any;
}) {
  return (
    <div className="h-full bg-slate-900 text-white flex flex-col overflow-y-auto">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-3.5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <img
            src="https://cdn.b12.io/client_media/iKv1biKD/12049a95-7e70-11f1-8605-0242ac110002-NOVO_LOGO.png"
            alt="eShopping"
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5"
          />
          {!collapsed && <span className="font-bold text-sm">eShopping</span>}
        </div>
        <button onClick={onClose} className="lg:hidden p-1 hover:bg-slate-700 rounded">
          <X size={16} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const currentTab = searchParams?.get('tab') || '';
          const itemTab = item.href.includes('?tab=') ? item.href.split('?tab=')[1] : '';
          const isActive = (item.href === '/admin' && !currentTab) || (itemTab && currentTab === itemTab);

          const handleClick = (e: React.MouseEvent) => {
            if (item.href.includes('?tab=')) {
              e.preventDefault();
              const tab = item.href.split('?tab=')[1];
              const url = new URL(window.location.href);
              url.searchParams.set('tab', tab);
              window.history.pushState({}, '', url);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          };

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-700 px-3 py-3">
        <div className={`flex items-center gap-2.5 px-2 mb-2 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(user?.first_name?.[0] || user?.username?.[0] || 'A').toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate">{user?.first_name || user?.username}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );
}
