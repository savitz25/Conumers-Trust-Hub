import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // Legal / policy aliases
      { source: '/trust', destination: '/promise', permanent: true },
      { source: '/independence', destination: '/promise', permanent: true },
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },

      // Vertical roots → correct specialist domain (or parent if hub not live)
      // Subpaths go to hub roots only — do not invent specialist deep paths.
      { source: '/moving', destination: 'https://www.movetrusthub.com', permanent: true },
      { source: '/moving/:path*', destination: 'https://www.movetrusthub.com', permanent: true },
      { source: '/insurance', destination: 'https://www.insurancetrusthub.com', permanent: true },
      {
        source: '/insurance/:path*',
        destination: 'https://www.insurancetrusthub.com',
        permanent: true,
      },
      { source: '/lending', destination: '/', permanent: true },
      { source: '/lending/:path*', destination: '/', permanent: true },
      { source: '/lender', destination: '/', permanent: true },
      { source: '/lender/:path*', destination: '/', permanent: true },

      // Retired product surfaces → parent homepage
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/dashboard/:path*', destination: '/', permanent: true },
      { source: '/onboarding', destination: '/', permanent: true },
      { source: '/onboarding/:path*', destination: '/', permanent: true },
      { source: '/concierge', destination: '/', permanent: true },
      { source: '/concierge/:path*', destination: '/', permanent: true },
      { source: '/checklist', destination: '/', permanent: true },
      { source: '/checklist/:path*', destination: '/', permanent: true },
      { source: '/vault', destination: '/', permanent: true },
      { source: '/vault/:path*', destination: '/', permanent: true },
      { source: '/account', destination: '/', permanent: true },
      { source: '/account/:path*', destination: '/', permanent: true },
      { source: '/pricing', destination: '/how-we-make-money', permanent: true },
      { source: '/community', destination: '/about', permanent: true },
      { source: '/resources', destination: '/about', permanent: true },
      { source: '/resources/:path*', destination: '/about', permanent: true },
    ];
  },
};

export default nextConfig;
