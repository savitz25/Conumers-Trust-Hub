import { Search, ShieldCheck, Sparkles } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    icon: Search,
    title: 'Choose Your Need',
    description:
      'Select moving, lending, or insurance — or search by ZIP to jump directly to verified providers in your area.',
  },
  {
    step: '02',
    icon: ShieldCheck,
    title: 'Compare Verified Options',
    description:
      'Review FMCSA, NMLS, and DOI licensing data alongside attributed reviews, complaint records, and trust scores.',
  },
  {
    step: '03',
    icon: Sparkles,
    title: 'Shop with Confidence',
    description:
      'Connect with providers through our sister sites. Zero paid placements — ever. Independent research, transparent data.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-trust">How It Works</p>
          <h2 className="section-heading mt-2">Your Path to Confident Decisions</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((item) => (
            <div key={item.step} className="relative text-center md:text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-trust/10 text-trust">
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-bold text-trust">{item.step}</p>
              <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}