import { HubLanding } from '@/components/hub-landing';
import { createPageMetadata } from '@/lib/seo/metadata';
import { HUB_SITES } from '@/lib/sites';

export const metadata = createPageMetadata({
  title: 'MoveTrust Hub — FMCSA Verified Movers',
  description: 'Compare FMCSA-licensed interstate movers. Free quotes, calculator, and side-by-side comparison — powered by ConsumerTrust Hub.',
  path: '/moving',
});

const site = HUB_SITES.moving;

const tools = [
  { title: 'Get Free Quotes', description: 'Matched with licensed movers in 24 hours.', href: '/moving/quotes', icon: 'search' as const },
  { title: 'Move Calculator', description: 'Room-by-room inventory — weirdly satisfying.', href: '/moving/calculator', icon: 'calculator' as const },
  { title: 'Mover Directory', description: '25+ FMCSA-verified interstate carriers.', href: '/moving/companies', icon: 'search' as const },
  { title: 'Moving Guides', description: 'Scams, checklists, route tips.', href: '/moving/resources', icon: 'book' as const },
];

export default function MovingPage() {
  return <HubLanding site={site} tools={tools} journeyProgress={12} coachMessage="Time to find movers you'll actually trust!" />;
}