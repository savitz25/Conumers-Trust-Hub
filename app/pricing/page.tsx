import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { createPageMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = createPageMetadata({
  title: 'Pricing',
  description: 'Free move tools for everyone. Premium concierge and vault features for power planners.',
  path: '/pricing',
});

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    description: 'Everything you need to plan a smart move',
    features: ['Master checklist', 'All hub directories', 'Basic calculators', '10 concierge messages/day'],
    cta: 'Get started free',
    href: '/onboarding',
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '$9/mo',
    description: 'For families who want a coach in their pocket',
    features: ['Unlimited AI concierge', 'Document vault (5GB)', 'PDF journey exports', 'Priority checklist reminders'],
    cta: 'Join waitlist',
    href: '/account',
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">Simple, honest pricing</h1>
        <p className="text-muted-foreground mt-3">Directories stay free. Zero paid placements — always.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={plan.highlighted ? 'border-trust shadow-glow ring-2 ring-trust/20' : ''}>
            <CardHeader>
              {plan.highlighted && (
                <span className="text-xs font-bold text-trust flex items-center gap-1 mb-2">
                  <Sparkles className="h-3.5 w-3.5" /> Most popular
                </span>
              )}
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <p className="text-3xl font-bold">{plan.price}</p>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-trust shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.highlighted ? 'trust' : 'outline'} className="w-full rounded-xl" asChild>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}