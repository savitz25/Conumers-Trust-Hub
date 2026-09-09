import Link from 'next/link';
const items=[['Control Center','/admin'],['Claim Operations','/admin/operations/claims'],['Data','/admin#data'],['Growth','/admin#growth'],['Audit','/admin/audit'],['Controls','/admin/controls'],['Settings','/admin/security']];
export function AdminNav(){return <nav aria-label="Control Plane" className="flex flex-wrap gap-2">{items.map(([label,href])=><Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-navy">{label}</Link>)}</nav>}
