import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { coverageCounts } from '@/lib/network/coverage-atlas-data';
import { PLACE_LENS_INDEX } from '@/lib/network/place-lens';

export function HomePrompt2Previews() {
  const counts = coverageCounts();
  return (
    <section
      id="network-os"
      aria-labelledby="network-os-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white }}
    >
      <div className="container-page">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          How the six systems work together
        </p>
        <h2
          id="network-os-heading"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: ASK_BRAND.navy }}
        >
          Coverage, places, and evidence — without a seventh dashboard
        </h2>
        <ul className="mt-8 grid gap-4 lg:grid-cols-3">
          <li className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
            <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
              Coverage Atlas
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              {counts.enhanced_state_intelligence} enhanced-state cells · {counts.not_yet_researched} not yet
              researched. Categorical only — not a depth score.
            </p>
            <Link href="/network/coverage" className="mt-4 inline-flex min-h-11 items-center font-semibold" style={{ color: ASK_BRAND.indigo }}>
              Open Coverage Atlas
            </Link>
          </li>
          <li className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
            <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
              Place Lens
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Florida, Broward, and Palm Beach — each hub’s actual capability, not a county grade.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {PLACE_LENS_INDEX.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
            <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
              Evidence Atlas
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              Which evidence families each hub can actually show. Pricing and ownership stay honest.
            </p>
            <Link href="/network/evidence" className="mt-4 inline-flex min-h-11 items-center font-semibold" style={{ color: ASK_BRAND.indigo }}>
              Open Evidence Atlas
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
