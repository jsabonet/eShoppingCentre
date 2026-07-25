"use client";

import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from "@/src/hooks/useAuth";
import { CartProvider } from "@/src/contexts/CartContext";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { Toaster } from "@/src/components/ui/sonner";
import Header from "@/src/components/Header";
import Footer from "@/src/components/Footer";
import PWAInstall from "@/src/components/PWAInstall";
import LoadingScreen from "@/src/components/LoadingScreen";
import NavigationLoader from "@/src/components/NavigationLoader";

/**
 * Shows a full-screen loading overlay while auth state is being determined
 * (first visit — token validation against the backend).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="A verificar sessão..." />;
  }

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
        <TooltipProvider>
          <AuthGate>
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </AuthGate>
          <NavigationLoader />
          <Toaster position="top-right" richColors closeButton />
          <PWAInstall />
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  );
}
