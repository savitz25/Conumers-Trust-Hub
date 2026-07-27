import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // Legacy product / directory routes → thin parent destinations
      { source: '/trust', destination: '/promise', permanent: true },
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },
      { source: '/moving', destination: 'https://www.movetrusthub.com', permanent: true },
      { source: '/moving/:path*', destination: 'https://www.movetrusthub.com/:path*', permanent: false },
      { source: '/insurance', destination: 'https://www.insurancetrusthub.com', permanent: true },
      {
        source: '/insurance/:path*',
        destination: 'https://www.insurancetrusthub.com/:path*',
        permanent: false,
      },
      { source: '/lending', destination: '/#trust-hubs', permanent: false },
      { source: '/lending/:path*', destination: '/#trust-hubs', permanent: false },
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/onboarding', destination: '/', permanent: true },
      { source: '/concierge', destination: '/', permanent: true },
      { source: '/checklist', destination: '/', permanent: true },
      { source: '/vault', destination: '/', permanent: true },
      { source: '/account', destination: '/', permanent: true },
      { source: '/pricing', destination: '/how-we-make-money', permanent: true },
      { source: '/community', destination: '/about', permanent: true },
      { source: '/resources', destination: '/about', permanent: true },
      { source: '/resources/:path*', destination: '/about', permanent: true },
    ];
  },
};

export default nextConfig;
