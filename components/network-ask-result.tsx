import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { assembleNetworkAnswerWithSpecialist } from '@/lib/network/ask-plan';
import { CROSS_HUB_NAME_CHECK } from '@/lib/network/name-check';
import { SAVE_TO_RESEARCH_CONTRACT } from '@/lib/network/federated-ask';
import { seniorSearchHref } from '@/lib/network/consumer-ask';

export async function NetworkAskResult({ query }: { query: string }) {
  const answer = await assembleNetworkAnswerWithSpecialist(query);
  const { plan } = answer;
  const primary = plan.hubs.length === 1 ? plan.hubs[0] : undefined;
  const options = (answer.options ?? primary?.options ?? []).slice(0, 10);
  const hardFail = primary?.failKind === 'hard' || (primary?.mode === 'fail_closed' && primary?.failKind !== 'soft');

  if (!query.trim()) {
    return (
      <p className="text-base" style={{ color: ASK_BRAND.ink }}>
        Enter a question to research across the TrustHub Network.
      </p>
    );
  }

  const researchHref =
    primary?.hubId === 'senior' && !options.length
      ? seniorSearchHref(plan.parsed)
      : primary?.destination;

  return (
    <div className="space-y-8">
      {answer.judgmentNote ? (
        <p className="rounded-xl border px-4 py-3 text-sm leading-relaxed" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}>
          {answer.judgmentNote}
        </p>
      ) : null}

      {answer.followUp ? (
        <section className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border }}>
          <p className="text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {answer.followUp.prompt}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {answer.followUp.choices.map((choice) => (
              <li key={choice.href}>
                <Link
                  href={choice.href}
                  className="inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold"
                  style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.indigo }}
                >
                  {choice.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hardFail && !options.length ? (
        <section className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border }}>
          <h2 className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
            No supported substitute for that claim
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {primary?.whatItCanAnswer}
          </p>
        </section>
      ) : null}

      {options.length ? (
        <section>
          <h2 className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
            Matching options
          </h2>
          <p className="mt-1 text-sm" style={{ color: ASK_BRAND.ink }}>
            {options.length} research identities from {primary?.name ?? 'the specialist'}. Not a ranking.
          </p>
          <ol className="mt-4 space-y-4">
            {options.map((opt) => (
              <li
                key={`${opt.hubId}-${opt.name}-${opt.href ?? opt.fields[0]?.value ?? ''}`}
                className="rounded-2xl border p-5"
                style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white, boxShadow: ASK_SHADOW.soft }}
              >
                <h3 className="text-lg font-semibold">
                  <a
                    href={opt.destination.href}
                    className="underline-offset-2 hover:underline"
                    style={{ color: ASK_BRAND.indigo }}
                  >
                    {opt.name}
                  </a>
                </h3>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2" style={{ color: ASK_BRAND.ink }}>
                  {opt.fields.map((field) => (
                    <div key={`${field.label}-${field.value}`}>
                      <dt className="text-xs uppercase tracking-wide">{field.label}</dt>
                      <dd className="font-medium" style={{ color: ASK_BRAND.navy }}>
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {opt.destination.publicationState === 'research_identity' ? (
                  <p className="mt-2 text-xs" style={{ color: ASK_BRAND.ink }}>
                    Research identity — a public profile is not currently published.
                  </p>
                ) : null}
                <a
                  href={opt.destination.href}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline-offset-2 hover:underline"
                  style={{ color: ASK_BRAND.indigo }}
                >
                  {opt.destination.ctaLabel}
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {!hardFail && !options.length && primary?.capabilityStatus === 'execute' ? (
        <p className="text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Specialist research is available. Open the specialist result to see the current indexed identities.
        </p>
      ) : null}

      {plan.nameCheck ? (
        <p className="rounded-xl border p-4 text-sm leading-relaxed" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}>
          {CROSS_HUB_NAME_CHECK.resultLanguage.disclaimer}
        </p>
      ) : null}

      {(answer.matchWhy || answer.limitation || researchHref || answer.compareHref) && !hardFail ? (
        <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: ASK_BRAND.border }}>
          {answer.matchWhy ? (
            <p className="text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                Why these matched.{' '}
              </span>
              {answer.matchWhy}
            </p>
          ) : null}
          {answer.limitation ? (
            <p className="text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                What TrustHub can and cannot conclude.{' '}
              </span>
              {answer.limitation}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {researchHref ? (
              <a
                href={researchHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: ASK_BRAND.navy }}
              >
                Open specialist research
              </a>
            ) : null}
            {answer.compareHref ? (
              <a
                href={answer.compareHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
                style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
              >
                Compare
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {answer.hubCountLabel ? (
        <p className="text-sm" style={{ color: ASK_BRAND.ink }}>
          {answer.hubCountLabel}. Results are not merged across hubs.
        </p>
      ) : null}

      {plan.placeLensHref ? (
        <p className="text-sm">
          <Link href={plan.placeLensHref} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Open the Place Lens for this geography
          </Link>
        </p>
      ) : null}

      <details
        id="interpretation"
        className="rounded-2xl border p-5"
        style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold" style={{ color: ASK_BRAND.navy }}>
          How we interpreted this
        </summary>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {answer.interpretation.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase" style={{ color: ASK_BRAND.ink }}>
                {row.label}
              </dt>
              <dd className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <form action="/ask" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="ask-q-edit" className="sr-only">
            Change question
          </label>
          <input
            id="ask-q-edit"
            name="q"
            defaultValue={plan.query}
            className="min-h-11 flex-1 rounded-xl border px-3 text-sm"
            style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
            style={{ backgroundColor: ASK_BRAND.indigo }}
          >
            Ask again
          </button>
        </form>
      </details>

      <details
        className="rounded-2xl border p-5"
        style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold" style={{ color: ASK_BRAND.navy }}>
          Trace / provenance
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[48rem] w-full text-left text-sm">
            <caption className="sr-only">Provenance for each specialist contribution</caption>
            <thead>
              <tr style={{ color: ASK_BRAND.navy }}>
                <th scope="col" className="py-2 pr-3">Hub</th>
                <th scope="col" className="py-2 pr-3">Contract</th>
                <th scope="col" className="py-2 pr-3">Provider class</th>
                <th scope="col" className="py-2 pr-3">Identifier</th>
                <th scope="col" className="py-2 pr-3">Source family</th>
                <th scope="col" className="py-2 pr-3">Query grain</th>
                <th scope="col" className="py-2 pr-3">Geography meaning</th>
                <th scope="col" className="py-2 pr-3">Official as-of</th>
                <th scope="col" className="py-2">Destination</th>
              </tr>
            </thead>
            <tbody>
              {answer.traces.map((row) => (
                <tr key={row.hubId} className="border-t" style={{ borderColor: ASK_BRAND.border }}>
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {row.hubName}
                  </th>
                  <td className="py-2 pr-3">{row.contract ?? '—'}</td>
                  <td className="py-2 pr-3">{row.providerClass ?? '—'}</td>
                  <td className="py-2 pr-3">{row.identifier ?? '—'}</td>
                  <td className="py-2 pr-3">{row.sourceFamily}</td>
                  <td className="py-2 pr-3">{row.queryGrain}</td>
                  <td className="py-2 pr-3">{row.geographyMeaning}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.officialAsOf}</td>
                  <td className="py-2">
                    <a href={row.specialistDestination} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs" style={{ color: ASK_BRAND.ink }}>
          Specialist source wins. Ask does not invent regulatory facts. Routing used cached capability metadata
          ({plan.routingMs} ms). No six-hub fan-out.
        </p>
      </details>

      <p className="text-xs" style={{ color: ASK_BRAND.ink }} data-contract={SAVE_TO_RESEARCH_CONTRACT}>
        Save to Research is a handoff contract only. No new persistence system is created here.
      </p>
    </div>
  );
}
