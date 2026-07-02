import type { ServiceVertical } from '@/lib/sites';

export type ChecklistCategory = 'planning' | 'moving' | 'lending' | 'insurance' | 'settling';

export interface ChecklistItemData {
  id: string;
  title: string;
  description: string;
  category: ChecklistCategory;
  vertical?: ServiceVertical;
  href?: string;
  dueOffsetDays?: number; // days before move date
  emoji: string;
}

/** Master move checklist — delightful coach copy */
export const MASTER_CHECKLIST: ChecklistItemData[] = [
  {
    id: 'budget',
    title: 'Set your move budget',
    description: "Let's figure out what this adventure will actually cost — no surprises!",
    category: 'planning',
    vertical: 'moving',
    href: '/moving/calculator',
    dueOffsetDays: 60,
    emoji: '💰',
  },
  {
    id: 'preapproval',
    title: 'Get mortgage pre-approval',
    description: 'Sellers love a ready buyer. This takes ~15 min and feels amazing after.',
    category: 'lending',
    vertical: 'lending',
    href: '/lending/pre-approval',
    dueOffsetDays: 45,
    emoji: '✅',
  },
  {
    id: 'movers',
    title: 'Compare FMCSA-verified movers',
    description: 'Licensed carriers only — we checked so you can breathe easy.',
    category: 'moving',
    vertical: 'moving',
    href: '/moving/companies',
    dueOffsetDays: 30,
    emoji: '🚚',
  },
  {
    id: 'insurance-quote',
    title: 'Shop homeowners or renters insurance',
    description: 'New address = new rates. Let\'s find coverage that actually fits.',
    category: 'insurance',
    vertical: 'insurance',
    href: '/insurance/compare',
    dueOffsetDays: 21,
    emoji: '🛡️',
  },
  {
    id: 'health-sep',
    title: 'Check health insurance (Special Enrollment)',
    description: 'Moving often unlocks a 60-day SEP — many people miss this!',
    category: 'insurance',
    vertical: 'insurance',
    href: '/insurance/hubs',
    dueOffsetDays: 14,
    emoji: '💚',
  },
  {
    id: 'pack',
    title: 'Build your packing inventory',
    description: 'Room by room — our calculator makes this weirdly satisfying.',
    category: 'moving',
    vertical: 'moving',
    href: '/moving/calculator',
    dueOffsetDays: 14,
    emoji: '📦',
  },
  {
    id: 'utilities',
    title: 'Schedule utilities & address change',
    description: 'USPS, internet, power — knock these out in one coffee session.',
    category: 'settling',
    dueOffsetDays: 7,
    emoji: '⚡',
  },
  {
    id: 'vault',
    title: 'Upload key docs to your Vault',
    description: 'Lease, insurance binder, loan estimate — safe and searchable.',
    category: 'planning',
    href: '/vault',
    dueOffsetDays: 3,
    emoji: '🔐',
  },
];

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  planning: 'Planning',
  moving: 'Moving',
  lending: 'Lending',
  insurance: 'Insurance',
  settling: 'Settling In',
};

export const CELEBRATION_MESSAGES = [
  "You're crushing it! 🎉",
  'One step closer to new keys!',
  'Look at you — move master in training!',
  'That felt good, right?',
  'High five! ✋',
];