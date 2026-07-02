import { HubLanding } from '@/components/hub-landing';
import { createPageMetadata } from '@/lib/seo/metadata';
import { HUB_SITES } from '@/lib/sites';

export const metadata = createPageMetadata({
  title: 'InsuranceTrust Hub — DOI Verified Agents',
  description: 'Compare state-licensed insurance agents. Health hubs, calculators, and SEP guidance — powered by ConsumerTrust Hub.',
  path: '/insurance',
});

const site = HUB_SITES.insurance;

const tools = [
  { title: 'Agent Directory', description: 'Verified agents in all 50 states.', href: '/insurance/directory', icon: 'search' as const },
  { title: 'Compare Plans', description: 'Side-by-side policy comparison.', href: '/insurance/compare', icon: 'search' as const },
  { title: 'Health Hubs', description: '54 MSAs with ACA & Medicare specialists.', href: '/insurance/hubs', icon: 'book' as const },
  { title: 'Calculators', description: 'Premium & subsidy estimators.', href: '/insurance/calculators', icon: 'calculator' as const },
];

export default function InsurancePage() {
  return <HubLanding site={site} tools={tools} journeyProgress={10} coachMessage="Coverage that travels with you — let's find it!" />;
}