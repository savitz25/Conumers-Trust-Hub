import Link from 'next/link';
import type { CustomerAction } from '@/lib/customer/experience';

export function CustomerActions({ actions }: { actions: CustomerAction[] }) {
  return <div className="flex flex-wrap gap-3">
    {actions.map((action) => <Link key={`${action.label}-${action.href}`} href={action.href} className={action.primary ? 'btn-primary' : 'btn-secondary'}>{action.label}</Link>)}
  </div>;
}
