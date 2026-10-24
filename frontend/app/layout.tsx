import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/src/lib/utils";
import { Providers } from "./providers";
import { SITE_URL } from "@/src/lib/seo";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: {
    default: 'e-Shopping Centre — Marketplace em Moçambique',
    template: '%s | e-Shopping Centre',
  },
  description:
    'Compre online em Moçambique com pagamento seguro e entrega nacional. Descubra produtos físicos, digitais e cursos de vendedores locais no e-Shopping Centre.',
  keywords: [
    'marketplace em Moçambique',
    'compras online em Moçambique',
    'lojas online Moçambique',
    'vendedores moçambicanos',
    'pagamento M-Pesa',
    'produtos digitais',
    'cursos online',
    'e-Shopping Centre',
  ],
  authors: [{ name: 'e-Shopping Centre' }],
  creator: 'e-Shopping Centre',
  publisher: 'e-Shopping Centre',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_MZ',
    siteName: 'e-Shopping Centre',
    title: 'e-Shopping Centre — Marketplace em Moçambique',
    description: 'Compre online em Moçambique com entrega nacional e pagamentos seguros.',
    url: SITE_URL,
    images: [{ url: '/web-app-manifest-512x512.png', width: 512, height: 512, alt: 'e-Shopping Centre' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'e-Shopping Centre',
    description: 'Compre online em Moçambique com entrega nacional e pagamentos seguros.',
    images: ['/web-app-manifest-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // manifest: '/manifest.json',  // PWA desabilitada temporariamente
  category: 'shopping',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-MZ"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'e-Shopping Centre',
                url: SITE_URL,
                logo: `${SITE_URL}/icon.png`,
                areaServed: { '@type': 'Country', name: 'Mozambique' },
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'e-Shopping Centre',
                url: SITE_URL,
                inLanguage: 'pt-MZ',
              },
            ]).replace(/</g, '\\u003c'),
          }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
