'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountCoursesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/my-courses'); }, [router]);
  return null;
}
