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
        // B12 CDN (imagens dos produtos actuais)
        protocol: 'https',
        hostname: 'cdn.b12.io',
      },
      {
        // Futuras imagens servidas pelo Django (ex: media via S3 ou local)
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_MEDIA_HOST ?? 'localhost',
      },
    ],
  },
};

export default nextConfig;
