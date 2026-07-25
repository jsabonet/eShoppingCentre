'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redireciona para o formulário de login unificado.
 * /admin/login → /login?redirect=/admin
 */
export default function AdminLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login?redirect=/admin');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <p className="text-muted-foreground">Redirecionando...</p>
    </div>
  );
}
