'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/src/components/admin/AdminLayout';
import AdminBlogEditor from '@/src/components/admin/AdminBlogEditor';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import { useAuth } from '@/src/hooks/useAuth';

function BlogEditorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get('id');
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    setReady(true);
  }, [loading, isAuthenticated, isAdmin, router]);

  if (loading || !ready) {
    return <AdminLayout><LoadingSpinner size={40} message="A carregar editor do blog..." /></AdminLayout>;
  }

  return <AdminLayout><AdminBlogEditor postId={postId} /></AdminLayout>;
}

export default function AdminBlogEditorPage() {
  return (
    <Suspense fallback={<AdminLayout><LoadingSpinner size={40} message="A carregar editor..." /></AdminLayout>}>
      <BlogEditorPageContent />
    </Suspense>
  );
}
