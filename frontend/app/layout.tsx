import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/src/lib/utils";
import { Providers } from "./providers";

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
  title: {
    default: 'eShoppingCentre — Marketplace em Moçambique',
    template: '%s | eShoppingCentre',
  },
  description:
    'A sua plataforma global de e-commerce. Compre e venda produtos físicos, digitais e cursos online em Moçambique.',
  keywords: [
    'ecommerce',
    'moçambique',
    'marketplace',
    'compras online',
    'loja online',
    'produtos digitais',
    'cursos online',
    'eShoppingCentre',
  ],
  authors: [{ name: 'eShoppingCentre' }],
  creator: 'eShoppingCentre',
  publisher: 'eShoppingCentre',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'pt_MZ',
    siteName: 'eShoppingCentre',
    title: 'eShoppingCentre — Marketplace em Moçambique',
    description: 'Compre e venda produtos físicos, digitais e cursos online.',
    images: [{ url: '/icon.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: 'eShoppingCentre',
    description: 'Marketplace em Moçambique',
    images: ['/icon.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
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
      lang="pt"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
