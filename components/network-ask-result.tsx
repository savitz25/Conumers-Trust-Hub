import Link from 'next/link';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { assembleNetworkAnswerWithSpecialist } from '@/lib/network/ask-plan';
import { CROSS_HUB_NAME_CHECK } from '@/lib/network/name-check';
import { SAVE_TO_RESEARCH_CONTRACT } from '@/lib/network/federated-ask';

const STATUS_LABEL: Record<string, string> = {
  execute: 'Execute — structured specialist Ask',
  handoff: 'Handoff — live research destination',
  unsupported: 'Unsupported',
  unavailable: 'Temporarily unavailable',
};

export async function NetworkAskResult({ query }: { query: string }) {
  const answer = await assembleNetworkAnswerWithSpecialist(query);
  const { plan } = answer;

  if (!query.trim()) {
    return (
      <p className="text-base" style={{ color: ASK_BRAND.ink }}>
        Enter a question to route across the TrustHub Network.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <section
        id="interpretation"
        className="rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white, boxShadow: ASK_SHADOW.card }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          We interpreted your question as
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {answer.interpretation.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase" style={{ color: ASK_BRAND.ink }}>
                {row.label}
              </dt>
              <dd className="text-base font-semibold" style={{ color: ASK_BRAND.navy }}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
          Natural-language parsing and specialist execution stay separate. You can change this interpretation
          and resubmit.
        </p>
        <form action="/ask" method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="ask-q-edit" className="sr-only">
            Change interpretation
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
            Change interpretation
          </button>
        </form>
      </section>

      {answer.hubCountLabel ? (
        <p className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
          {answer.hubCountLabel}
        </p>
      ) : null}

      {plan.placeLensHref ? (
        <p className="text-sm">
          <Link href={plan.placeLensHref} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Open the Place Lens for this geography
          </Link>
        </p>
      ) : null}

      {plan.nameCheck ? (
        <p className="rounded-xl border p-4 text-sm leading-relaxed" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}>
          {CROSS_HUB_NAME_CHECK.resultLanguage.disclaimer}
        </p>
      ) : null}

      {plan.comparison ? (
        <section className="rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border }}>
          <h2 className="text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>
            Comparable now
          </h2>
          <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
            Only equivalent metrics inside the same hub/data model. Contractor discipline is never scored against
            lender complaints.
          </p>
          <ul className="mt-4 space-y-3">
            {plan.comparison.hubs.map((h) => (
              <li key={h.hubId} className="text-sm" style={{ color: ASK_BRAND.ink }}>
                <span className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {h.hubId}
                </span>{' '}
                — {h.comparisonStatus.replace('_', ' ')}. {h.limitation}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ol className="grid gap-4 lg:grid-cols-2">
        {plan.hubs.map((hub) => (
          <li
            key={hub.hubId}
            className="flex flex-col rounded-2xl border p-5"
            style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.white, boxShadow: ASK_SHADOW.soft }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
                {hub.name}
              </h3>
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: ASK_BRAND.border }}>
                {STATUS_LABEL[hub.capabilityStatus] ?? hub.capabilityStatus}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              <span className="font-semibold">What this hub can answer. </span>
              {hub.whatItCanAnswer}
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
              <span className="font-semibold">Geography / capability. </span>
              {hub.geographyCapability}
            </p>
            {hub.preview ? (
              <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}>
                <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                  {hub.preview.headline}
                </p>
                <p className="mt-1" style={{ color: ASK_BRAND.ink }}>
                  Grain: {hub.preview.grain}
                </p>
                <p className="mt-1 text-xs" style={{ color: ASK_BRAND.ink }}>
                  {hub.preview.limitation}
                </p>
              </div>
            ) : null}
            <p className="mt-2 text-xs" style={{ color: ASK_BRAND.ink }}>
              {hub.reason}
            </p>
            {hub.destination ? (
              <a
                href={hub.destination}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: ASK_BRAND.navy }}
              >
                Open specialist research
              </a>
            ) : (
              <p className="mt-4 text-sm" style={{ color: ASK_BRAND.ink }}>
                No live destination for this capability.
              </p>
            )}
          </li>
        ))}
      </ol>

      <details
        className="rounded-2xl border p-5"
        style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold" style={{ color: ASK_BRAND.navy }}>
          Trace this answer
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[48rem] w-full text-left text-sm">
            <caption className="sr-only">Provenance for each specialist contribution</caption>
            <thead>
              <tr style={{ color: ASK_BRAND.navy }}>
                <th scope="col" className="py-2 pr-3">Hub</th>
                <th scope="col" className="py-2 pr-3">Contract</th>
                <th scope="col" className="py-2 pr-3">Provider class</th>
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
