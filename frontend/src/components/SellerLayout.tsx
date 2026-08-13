"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart, Users, DollarSign, Settings, Store,
  ChevronLeft, ChevronRight, LogOut, Plus, ExternalLink, TrendingUp, Gift, Menu, X, AlertCircle,
  GraduationCap, Award, MessageCircle, Truck, RotateCcw, ClipboardList, LifeBuoy, TicketPercent
} from 'lucide-react';
import { storesAPI } from '@/src/lib/api';
import LoadingSpinner from '@/src/components/LoadingSpinner';

// Module-level cache — persists across page navigations within the seller area.
// Invalidated when auth token changes (user switch).
let cachedStore: { name: string; slug: string; status: string; productType: string; tokenFingerprint: string } | null = null;
let cacheChecked = false;

function getTokenFingerprint(): string {
  if (typeof window === 'undefined') return '';
  return (localStorage.getItem('access_token') || '').slice(-20);
}

function clearCacheIfTokenChanged() {
  const current = getTokenFingerprint();
  if (cachedStore && cachedStore.tokenFingerprint !== current) {
    cachedStore = null;
    cacheChecked = false;
  }
}

interface SellerLayoutProps {
  children: React.ReactNode;
}

// Base navigation varies by store type: course stores use "Cursos" instead of "Produtos"
interface SellerNavItem {
  href: string;
  label: string;
  icon: any;
  badge?: 'orders' | 'returns' | 'tickets';
}

interface SellerNavGroup {
  label: string;
  items: SellerNavItem[];
}

function getNavGroups(productType: string): SellerNavGroup[] {
  const groups: SellerNavGroup[] = [
    { label: '', items: [{ href: '/seller/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      label: 'Catálogo',
      items: [
        { href: productType === 'course' ? '/seller/courses' : '/seller/products', label: productType === 'course' ? 'Cursos' : 'Produtos', icon: productType === 'course' ? GraduationCap : Package },
        ...(productType === 'physical'
          ? [{ href: '/seller/shipping', label: 'Envios', icon: Truck }, { href: '/seller/inventory', label: 'Inventário', icon: ClipboardList }]
          : []),
      ],
    },
    {
      label: 'Vendas',
      items: [
        { href: '/seller/orders', label: 'Encomendas', icon: ShoppingCart, badge: 'orders' },
        { href: '/seller/returns', label: 'Devoluções', icon: RotateCcw, badge: 'returns' },
        { href: '/seller/tickets', label: 'Suporte', icon: LifeBuoy, badge: 'tickets' },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { href: '/seller/coupons', label: 'Cupões', icon: TicketPercent },
        { href: '/seller/affiliates', label: 'Afiliados', icon: Users },
      ],
    },
    {
      label: 'Comunicação',
      items: [
        { href: '/seller/messages', label: 'Mensagens', icon: MessageCircle },
      ],
    },
    {
      label: 'Conta',
      items: [
        { href: '/seller/earnings', label: 'Ganhos', icon: DollarSign },
        { href: '/seller/settings', label: 'Configurações', icon: Settings },
      ],
    },
  ];

  if (productType === 'course') {
    groups.splice(3, 0, {
      label: 'Alunos',
      items: [
        { href: '/seller/students', label: 'Alunos', icon: Users },
        { href: '/seller/certificates', label: 'Certificados', icon: Award },
      ],
    });
  }

  return groups;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storeName, setStoreName] = useState<string | null>(cachedStore?.name ?? null);
  const [storeSlug, setStoreSlug] = useState(cachedStore?.slug ?? '');
  const [storeStatus, setStoreStatus] = useState<string | null>(cachedStore?.status ?? null);
  const [productType, setProductType] = useState<string>(cachedStore?.productType ?? 'physical');
  const [checking, setChecking] = useState(!cacheChecked);
  const [badges, setBadges] = useState<{ orders: number; returns: number; tickets: number }>({ orders: 0, returns: 0, tickets: 0 });

  const navGroups = getNavGroups(productType);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    (async () => {
      try {
        const [orders, returns, tickets] = await Promise.allSettled([
          fetch(`${API_URL}/orders/store/`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_URL}/orders/returns/store/`, { headers }).then(r => r.ok ? r.json() : null),
          fetch(`${API_URL}/orders/tickets/seller/`, { headers }).then(r => r.ok ? r.json() : null),
        ]);
        const o = orders.status === 'fulfilled' ? orders.value : null;
        const r = returns.status === 'fulfilled' ? returns.value : null;
        const t = tickets.status === 'fulfilled' ? tickets.value : null;
        setBadges({
          orders: ((o?.results || o) || []).filter((x: any) => x.status === 'pending').length,
          returns: ((r?.results || r) || []).filter((x: any) => x.status === 'requested').length,
          tickets: ((t?.results || t) || []).filter((x: any) => x.status === 'open').length,
        });
      } catch {}
    })();
  }, [storeName]);

  useEffect(() => {
    if (pathname === '/seller/register') {
      setChecking(false);
      return;
    }

    // Invalidate cache if auth token changed (user switch)
    clearCacheIfTokenChanged();

    // Use cached data if available
    if (cachedStore) {
      setStoreName(cachedStore.name);
      setStoreSlug(cachedStore.slug);
      setStoreStatus(cachedStore.status);
      setProductType(cachedStore.productType);
      setChecking(false);
      return;
    }

    // Already fetching
    if (cacheChecked) return;

    cacheChecked = true;
    (async () => {
      try {
        const { data } = await storesAPI.myStore();
        cachedStore = {
          name: data.name, slug: data.slug, status: data.status,
          productType: data.product_type || 'physical',
          tokenFingerprint: getTokenFingerprint(),
        };
        setStoreName(data.name);
        setStoreSlug(data.slug);
        setStoreStatus(data.status);
        setProductType(data.product_type || 'physical');
      } catch {
        router.replace('/seller/register');
      } finally {
        setChecking(false);
      }
    })();
  }, [pathname, router]);

  // Loading state — only shown on first visit (no cache)
  if (checking && !cachedStore) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <LoadingSpinner size={36} message="A verificar loja..." />
      </div>
    );
  }

  // Loading state
  if (checking) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <LoadingSpinner size={36} message="A verificar loja..." />
      </div>
    );
  }

  // Pending store
  if (storeStatus === 'pending') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-yellow-100 rounded-full mb-4">
            <AlertCircle size={48} className="text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Loja em Análise ⏳</h1>
          <p className="text-muted-foreground mb-6">
            A sua loja <strong>{storeName}</strong> ainda está a ser revista pela nossa equipa.
            Receberá um email quando for aprovada.
          </p>
          <Link href="/" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 inline-block">
            Voltar à Página Inicial
          </Link>
        </div>
      </div>
    );
  }

  // Rejected store
  if (storeStatus === 'rejected' || storeStatus === 'suspended') {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="inline-flex p-4 bg-red-100 rounded-full mb-4">
            <AlertCircle size={48} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Loja {storeStatus === 'rejected' ? 'Rejeitada' : 'Suspensa'}</h1>
          <p className="text-muted-foreground mb-6">
            A sua loja <strong>{storeName}</strong> foi {storeStatus === 'rejected' ? 'rejeitada' : 'suspensa'}.
            {storeStatus === 'rejected' && ' Pode registar uma nova loja com os dados corrigidos.'}
          </p>
          {storeStatus === 'rejected' && (
            <Link href="/seller/register" className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 inline-block">
              Registar Nova Loja
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!storeName) return null;

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
              {storeName === null ? (
                <p className="text-xs text-muted-foreground animate-pulse">A carregar...</p>
              ) : storeName ? (
                <p className="text-xs text-muted-foreground">{storeName}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Sem loja</p>
              )}
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-muted rounded-md transition-colors">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {!collapsed && group.label && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const badgeCount = item.badge ? badges[item.badge] : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={20} className="flex-shrink-0" />
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
        </nav>

        {/* Store Link */}
        <div className="p-3 border-t border-border">
          <Link
            href={storeSlug ? `/store/${storeSlug}` : '#'}
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
              {navGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  {group.label && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                      const badgeCount = item.badge ? badges[item.badge] : 0;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          <item.icon size={20} />
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
