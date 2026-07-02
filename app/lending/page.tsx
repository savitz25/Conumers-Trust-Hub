import { HubLanding } from '@/components/hub-landing';
import { createPageMetadata } from '@/lib/seo/metadata';
import { HUB_SITES } from '@/lib/sites';

export const metadata = createPageMetadata({
  title: 'LenderTrust Hub — NMLS Verified Lenders',
  description: 'Discover honest lenders in your county. NMLS verification, calculators, and county insights — powered by ConsumerTrust Hub.',
  path: '/lending',
});

const site = HUB_SITES.lending;

const tools = [
  { title: 'Local Lenders', description: '12,450+ verified — ranked by county.', href: '/lending/lenders', icon: 'search' as const },
  { title: 'Pre-Approval', description: 'Start here — sellers love ready buyers.', href: '/lending/pre-approval', icon: 'search' as const },
  { title: 'Calculators', description: 'Payment, affordability, refi tools.', href: '/lending/calculators', icon: 'calculator' as const },
  { title: 'Compare Lenders', description: 'NMLS, complaints, close times.', href: '/lending/compare', icon: 'search' as const },
];

export default function LendingPage() {
  return <HubLanding site={site} tools={tools} journeyProgress={8} coachMessage="Your dream home starts with the right numbers." />;
}