import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This Ask Trust Hub address is not a published page.',
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <PageHeader
      label="404"
      title="Page not found"
      description="This address is not a published Ask Trust Hub page."
    />
  );
}
