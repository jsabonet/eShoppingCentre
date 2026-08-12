import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    staleTimes: {
      dynamic: 30,   // RSC prefetch cache por 30s (evita refetch a cada hover)
      static: 300,   // páginas estáticas 5min
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.b12.io',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      {
        protocol: 'https',
        hostname: 'e-shoppingcentre.com',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_MEDIA_HOST ?? 'localhost',
      },
    ],
    // Não otimizar imagens do próprio servidor (evita redirect loop)
    unoptimized: process.env.NODE_ENV === 'production' ? true : false,
  },
};

export default nextConfig;
