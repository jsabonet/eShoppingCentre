'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/src/components/LoadingSpinner';
import SellerLayout from '@/src/components/SellerLayout';

/**
 * /seller/courses/new — Redirecciona para o formulário unificado de criação de produto/curso.
 * O formulário em /seller/products/new detecta automaticamente o product_type da loja
 * e mostra os campos específicos para cursos.
 */
export default function NewCoursePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/seller/products/new');
  }, [router]);

  return (
    <SellerLayout>
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size={32} message="A redireccionar..." />
      </div>
    </SellerLayout>
  );
}
