import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { NETWORK_FINDINGS } from '@/lib/network/findings';

export function NetworkFindings() {
  return (
    <section
      id="network-findings"
      aria-labelledby="network-findings-heading"
      className="section-block scroll-mt-24 border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
    >
      <div className="container-page">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          What the Network is seeing
        </p>
        <h2
          id="network-findings-heading"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: ASK_BRAND.navy }}
        >
          Three lessons only a parent network can teach
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Not rankings. Not copied hub scoreboards. Descriptive comparison of unlike evidence models.
        </p>
        <ol className="mt-8 grid gap-4 lg:grid-cols-3">
          {NETWORK_FINDINGS.map((finding, index) => (
            <li
              key={finding.id}
              id={finding.id}
              className="rounded-2xl border bg-white p-5"
              style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ASK_BRAND.indigo }}>
                Finding {index + 1}
              </p>
              <h3 className="mt-2 text-lg font-semibold leading-snug" style={{ color: ASK_BRAND.navy }}>
                {finding.headline}
              </h3>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                {finding.examples.map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                <span className="font-semibold">Why this matters. </span>
                {finding.whyItMatters}
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: ASK_BRAND.ink }}>
                Limitation: {finding.limitation}
              </p>
              <a
                href={finding.cta.href}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold"
                style={{ color: ASK_BRAND.indigo }}
              >
                {finding.cta.label} →
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
