import { createPageMetadata } from '@/lib/seo/metadata';

export const metadata = createPageMetadata({
  title: 'Manage a TrustHub profile',
  description: 'AskTrustHub business authorization request. Not a public directory and not an endorsement.',
  path: '/claim/continue',
  noIndex: true,
});

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">{children}</div>;
}
