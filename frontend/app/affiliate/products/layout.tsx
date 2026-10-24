import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function AffiliateProductsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
