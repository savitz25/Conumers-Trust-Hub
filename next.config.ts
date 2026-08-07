import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prefer trailingSlash false + host redirects handled at edge (Vercel www primary).
  trailingSlash: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      // Legal / policy aliases (/trust is a real Trust Center index page — do not redirect it)
      { source: '/independence', destination: '/promise', permanent: true },
      { source: '/standard', destination: '/methodology', permanent: true },
      { source: '/the-standard', destination: '/methodology', permanent: true },
      { source: '/editorial', destination: '/editorial-standards', permanent: true },
      { source: '/privacy-policy', destination: '/privacy', permanent: true },
      { source: '/terms-of-service', destination: '/terms', permanent: true },

      // Vertical roots / mistaken parent paths → specialist domains
      { source: '/moving', destination: 'https://www.movetrusthub.com', permanent: true },
      { source: '/moving/:path*', destination: 'https://www.movetrusthub.com', permanent: true },
      // Destination hub path often typed on parent by mistake
      {
        source: '/moving-to',
        destination: 'https://www.movetrusthub.com/moving-to',
        permanent: true,
      },
      {
        source: '/moving-to/:path*',
        destination: 'https://www.movetrusthub.com/moving-to/:path*',
        permanent: true,
      },
      { source: '/companies', destination: 'https://www.movetrusthub.com/companies', permanent: true },
      {
        source: '/companies/:path*',
        destination: 'https://www.movetrusthub.com/companies/:path*',
        permanent: true,
      },
      { source: '/verify-dot', destination: 'https://www.movetrusthub.com/verify-dot', permanent: true },
      { source: '/insurance', destination: 'https://www.insurancetrusthub.com', permanent: true },
      {
        source: '/insurance/:path*',
        destination: 'https://www.insurancetrusthub.com',
        permanent: true,
      },
      { source: '/lending', destination: 'https://www.lendertrusthub.com', permanent: true },
      {
        source: '/lending/:path*',
        destination: 'https://www.lendertrusthub.com',
        permanent: true,
      },
      { source: '/lender', destination: 'https://www.lendertrusthub.com', permanent: true },
      {
        source: '/lender/:path*',
        destination: 'https://www.lendertrusthub.com',
        permanent: true,
      },
      {
        source: '/local-lenders',
        destination: 'https://www.lendertrusthub.com/local-lenders',
        permanent: true,
      },
      {
        source: '/local-lenders/:path*',
        destination: 'https://www.lendertrusthub.com/local-lenders/:path*',
        permanent: true,
      },

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
