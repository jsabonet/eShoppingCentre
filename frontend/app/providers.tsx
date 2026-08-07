"use client";

import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from "@/src/hooks/useAuth";
import { CartProvider } from "@/src/contexts/CartContext";
import { ChatProvider } from "@/src/contexts/ChatContext";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { Toaster } from "@/src/components/ui/sonner";
import Header from "@/src/components/Header";
import Footer from "@/src/components/Footer";
import PWAInstall from "@/src/components/PWAInstall";
import NavigationLoader from "@/src/components/NavigationLoader";
import ChatWidget from "@/src/components/ChatWidget";

/** Rotas que precisam de auth resolvida antes de renderizar */
const PROTECTED_PREFIXES = ['/admin', '/seller', '/account', '/checkout', '/my-courses', '/affiliate'];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const pathname = usePathname();
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));

  // Protected routes: wait for auth
  if (isProtected && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">A verificar sessão...</p>
        </div>
      </div>
    );
  }

  // Public pages: render immediately — auth resolves in background
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return (
      <AuthProvider>
        <TooltipProvider>
          <AuthGate>{children}</AuthGate>
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <CartProvider>
        <ChatProvider>
        <TooltipProvider>
          <AuthGate>
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </AuthGate>
          <NavigationLoader />
          <Toaster position="top-right" richColors closeButton />
          <PWAInstall />
          <ChatWidget />
        </TooltipProvider>
        </ChatProvider>
      </CartProvider>
    </AuthProvider>
  );
}
