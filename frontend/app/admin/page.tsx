'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import AdminLayout from '@/src/components/admin/AdminLayout';
import { useAuth } from '@/src/hooks/useAuth';
import AdminDashboard from '@/src/components/AdminDashboard';

function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/login?redirect=/admin');
      return;
    }
    if (isAuthenticated && isAdmin) {
      setReady(true);
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  if (authLoading || !ready) {
    return (
      <AdminLayout>
        <LoadingSpinner size={40} message="A carregar painel..." />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminDashboard activeTab={tab as any} />
    </AdminLayout>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <AdminLayout>
        <LoadingSpinner size={40} message="A carregar..." />
      </AdminLayout>
    }>
      <AdminContent />
    </Suspense>
  );
}
