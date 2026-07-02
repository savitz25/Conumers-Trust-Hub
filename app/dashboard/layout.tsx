import { createPageMetadata } from '@/lib/seo/metadata';

export const metadata = createPageMetadata({
  title: 'Dashboard',
  description: 'Your move command center — checklist progress, hub status, and AI concierge at a glance.',
  path: '/dashboard',
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}