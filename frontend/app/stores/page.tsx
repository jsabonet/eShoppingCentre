import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import StoresClient from '@/src/components/StoresClient';

export const metadata: Metadata = { title: 'Lojas | e-Shopping Centre' };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function StoresPage() {
  let stores: any[] = [];
  try {
    const res = await fetch(`${API_URL}/stores/`, { next: { revalidate: 60 } });
    const data = res.ok ? await res.json() : { results: [] };
    // Filter out stores with empty slugs (shouldn't happen after backend fix, but safety net)
    stores = (data.results || []).filter((s: any) => s.slug);
  } catch {}

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Início</Link>
            <ChevronRight size={14} /><span className="text-foreground font-medium">Lojas</span>
          </nav>
        </div>
      </div>
      <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-b border-border">
        <div className="max-w-[1500px] mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-2">Lojas Parceiras</h1>
          <p className="text-muted-foreground">{stores.length} lojas no marketplace</p>
        </div>
      </div>
      <StoresClient stores={stores} />
    </>
  );
}
