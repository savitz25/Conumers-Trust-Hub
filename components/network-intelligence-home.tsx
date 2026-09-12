import Link from 'next/link';
import { ArrowRight, BookOpen, Database, MapPinned, Search, ShieldCheck } from 'lucide-react';
import { NetworkAskInput } from '@/components/network-ask-input';
import { HomeConciergeDemoted } from '@/components/home-concierge-demoted';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { loadHubManifests, readArtifact, type CountRecord, type HubManifest } from '@/lib/network-intelligence/contract';
import { loadSpecialistNetworkContracts } from '@/lib/network-metrics/load.ts';
import { consumerMetricLabel } from '@/lib/network-metrics/consumer-labels.ts';
import { SPECIALIST_OWNED_HUBS, type SpecialistHubId } from '@/lib/network-metrics/sources.ts';
import { SpecialistNetworkCard } from '@/components/specialist-network-card';
import { MetricValue } from '@/components/metric-value';
import {
  buildAskNetworkEvidenceInventory,
  buildAskStateCoverage,
  NETWORK_EVIDENCE_FAMILY_LABELS,
  type AskNetworkEvidenceMeasure,
} from '@/lib/network-metrics/network-evidence';

const SPECIALIST_CARD_HUBS = new Set<string>(SPECIALIST_OWNED_HUBS);

type LedgerSource = { source_id: string; publisher: string; dataset: string; establishes: string; official_as_of: string | null; retrieval_date: string; limitations: string };
type LedgerArtifact = { sources: LedgerSource[] };
type NetworkPolicyArtifact = { global_policy: { paid_status_affects_search_order: boolean } };

const CARD_CONFIG: Record<string, { eyebrow: string; metricIds: string[]; href: string; action: string }> = {
  move: { eyebrow: 'Moving', metricIds: [], href: 'https://www.movetrusthub.com', action: 'Research movers' },
  lender: { eyebrow: 'Lending', metricIds: [], href: 'https://www.lendertrusthub.com', action: 'Research lenders' },
  insurance: { eyebrow: 'Insurance', metricIds: [], href: 'https://www.insurancetrusthub.com', action: 'Research insurance' },
  senior: { eyebrow: 'Senior care', metricIds: [], href: 'https://www.seniortrusthub.com', action: 'Research senior care' },
  contractor: { eyebrow: 'Contractors', metricIds: [], href: 'https://www.contractortrusthub.com', action: 'Research credentials' },
  investor: { eyebrow: 'Investment', metricIds: [], href: 'https://www.investortrusthub.com', action: 'Research advisers' },
};

const METHOD = [
  ['SOURCE', 'Official public and regulatory records.'], ['IDENTIFY', 'Resolve the exact regulated entity.'],
  ['VERIFY', 'Use source-native identifiers and deterministic relationships.'], ['ORGANIZE', 'Connect evidence without flattening unlike records.'],
  ['TRACE', 'Show where each fact came from and what it means.'], ['UPDATE', 'Refresh as public records change.'],
  ['YOU DECIDE', 'No paid ranking or network recommendation.'],
] as const;

function formatValue(value: number) { return value.toLocaleString('en-US'); }

function findMetric(hub: HubManifest, id: string): CountRecord | undefined {
  return [...hub.entity_counts, ...hub.evidence_counts].find((metric) => metric.metric_id === id);
}

function Trace({ hub, metric }: { hub: HubManifest; metric: CountRecord }) {
  return (
    <details className="mt-3 rounded-xl border px-3" style={{ borderColor: ASK_BRAND.border }}>
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold focus-visible:outline-none focus-visible:ring-2">Trace this number</summary>
      <dl className="grid gap-3 border-t py-3 text-sm sm:grid-cols-2" style={{ borderColor: ASK_BRAND.border }}>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Hub / metric</dt><dd>{hub.hub_name} · {metric.metric_id}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Public label</dt><dd>{consumerMetricLabel(metric.metric_id, metric.label)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Source label</dt><dd>{metric.label}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Value</dt><dd>{formatValue(metric.value)}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Grain</dt><dd>{metric.grain}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Scope</dt><dd>{metric.scope}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Source</dt><dd>{metric.source_family} · {metric.source_contract}</dd></div>
        <div><dt className="text-xs font-semibold uppercase text-slate-500">Clock</dt><dd>As of {metric.as_of_date ?? 'not supplied'} · retrieved {metric.retrieved_at}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Limitation</dt><dd>{metric.limitation}</dd></div>
      </dl>
    </details>
  );
}

function HubCard({ hub }: { hub: HubManifest }) {
  const config = CARD_CONFIG[hub.hub_id];
  const metrics = config.metricIds.map((id) => findMetric(hub, id)).filter((metric): metric is CountRecord => Boolean(metric));
  return (
    <article className="flex h-full flex-col rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}>
      <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>{config.eyebrow}</p>
      <h3 className="mt-1 text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>{hub.hub_name}</h3>
      {hub.hub_id === 'senior' ? (
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm font-semibold">
          {hub.entity_classes.map((entity) => <div key={entity.id} className="rounded-xl bg-slate-50 px-2 py-3">{entity.label}</div>)}
        </div>
      ) : (
        <div className="mt-4 space-y-5">{metrics.map((metric) => <div key={metric.metric_id} className="min-w-0"><MetricValue value={metric.value} size="lg" /><p className="mt-1 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>{consumerMetricLabel(metric.metric_id, metric.label)}</p><Trace hub={hub} metric={metric} /></div>)}</div>
      )}
      <p className="mt-5 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>{hub.evidence_families.slice(0, 4).map((item) => item.subtype).join(' · ')}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">{hub.limitations[0]}</p>
      <a href={config.href} className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>{config.action} <ArrowRight className="h-4 w-4" aria-hidden /></a>
    </article>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: ASK_BRAND.navy }}>{title}</h2><p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>{copy}</p></div>;
}

function InventoryMeasureTrace({ metric }: { metric: AskNetworkEvidenceMeasure }) {
  return (
    <details className="rounded-lg border bg-slate-50 px-3" style={{ borderColor: ASK_BRAND.border }}>
      <summary data-analytics-event="network_metric_trace" className="min-h-11 cursor-pointer py-3 text-xs font-semibold">{CARD_CONFIG[metric.hub].eyebrow}: {metric.label}</summary>
      <dl className="grid gap-2 border-t py-3 text-xs sm:grid-cols-2" style={{ borderColor: ASK_BRAND.border }}>
        <div><dt className="font-semibold uppercase text-slate-500">Value / state</dt><dd>{metric.value === null ? metric.valueState : formatValue(metric.value)}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Grain</dt><dd>{metric.grain}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Entity / evidence class</dt><dd>{metric.entityClass}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Coverage</dt><dd>{metric.coverage}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Agency / source</dt><dd>{metric.sourceSystems.join(' · ') || metric.specialistSchema}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Publication context</dt><dd>{metric.publicationStatus}{metric.publicationStatus === 'PUBLIC_RESEARCH_GRAPH' ? ' — aggregate research depth, not a browsable entity universe' : ''}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Source as of</dt><dd>{metric.sourceAsOf ?? 'Not supplied'}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Retrieved</dt><dd>{metric.retrievedAt ?? 'Not supplied'}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Accepted snapshot as of</dt><dd>{metric.snapshotAsOf ?? 'Not supplied'}</dd></div>
        <div><dt className="font-semibold uppercase text-slate-500">Specialist generated</dt><dd>{metric.generatedAt}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold uppercase text-slate-500">What it counts</dt><dd>{metric.counts}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold uppercase text-slate-500">What it does not count</dt><dd>{metric.doesNotCount}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold uppercase text-slate-500">Limitation</dt><dd>{metric.limitation}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold uppercase text-slate-500">Specialist contract</dt><dd>{metric.specialistSchema} · {metric.specialistFingerprint} · {metric.origin}</dd></div>
      </dl>
      <a href={metric.destination} className="inline-flex min-h-11 items-center pb-3 text-xs font-semibold" style={{ color: ASK_BRAND.indigo }}>Open specialist research <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden /></a>
    </details>
  );
}

export async function NetworkIntelligenceHome() {
  const hubs = loadHubManifests();
  const contracts = await loadSpecialistNetworkContracts();
  const specialistCards = Object.fromEntries(
    Object.entries(contracts).map(([hub, contract]) => [hub, contract.presentation]),
  );
  const inventory = buildAskNetworkEvidenceInventory(contracts);
  const stateCoverage = buildAskStateCoverage(contracts);
  const ledger = readArtifact<LedgerArtifact>('network-source-ledger-v1.json');
  const policy = readArtifact<NetworkPolicyArtifact>('ask-network-intel-v1.json');
  const publisherCount = new Set(ledger.sources.map((source) => source.publisher)).size;
  const heroFacts = [
    [String(SPECIALIST_OWNED_HUBS.length), 'specialist research systems'],
    [String(stateCoverage.length), 'network state gateways'],
    [String(Object.keys(NETWORK_EVIDENCE_FAMILY_LABELS).length), 'source-native evidence families'],
    [String(Number(policy.global_policy.paid_status_affects_search_order)), 'paid ranking signals'],
  ];

  return (
    <>
      <section id="ask-network" className="relative scroll-mt-24 overflow-hidden border-b bg-white" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="home-title">
        <div className="container-page py-12 text-center sm:py-16 lg:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: ASK_BRAND.indigo }}>The Trust Hub Network</p>
          <h1 id="home-title" className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: ASK_BRAND.navy }}>Research before you choose.</h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed sm:text-lg" style={{ color: ASK_BRAND.ink }}>Ask one question. Research the right official identity, regulatory system, public evidence, and state context across six specialist Trust Hubs.</p>
          <NetworkAskInput />
          <div className="mx-auto mt-7 grid max-w-3xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {heroFacts.map(([value, label]) => <div key={label} className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: ASK_BRAND.border }}><p className="text-xl font-semibold tabular-nums" style={{ color: ASK_BRAND.navy }}>{value}</p><p className="text-xs leading-snug text-slate-600">{label}</p></div>)}
          </div>
          <div className="mx-auto mt-6 max-w-3xl rounded-xl border bg-indigo-50/60 p-4 text-left text-sm" style={{ borderColor: ASK_BRAND.border }}><strong>Structured network research comes first.</strong> Intelligent Search routes identities, states, and evidence to the appropriate specialist. The AI Concierge remains optional guidance. <a href="#ask" className="font-semibold underline" style={{ color: ASK_BRAND.indigo }}>Ask the AI Concierge</a>.</div>
        </div>
      </section>

      <section className="section-block border-b bg-slate-50" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="state-heading"><div className="container-page"><SectionHeading eyebrow="State of the Trust Hub Network" title="Six markets. Six evidence models. No fake total." copy="Every card is now sourced from its specialist hub's published metric contract. Each market preserves its own entity, observation, publication, and geography grain. Unlike populations are never added together." /><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{hubs.map((hub) => SPECIALIST_CARD_HUBS.has(hub.hub_id) ? <SpecialistNetworkCard key={hub.hub_id} card={specialistCards[hub.hub_id as SpecialistHubId]} /> : <HubCard key={hub.hub_id} hub={hub} />)}</div></div></section>

      <section className="section-block border-b bg-white" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="findings-heading"><div className="container-page"><SectionHeading eyebrow="What the data says" title="The structure of the record matters." copy="These findings describe how public evidence works across regulated markets. They do not compare provider quality." /><div className="mt-8 grid gap-5 lg:grid-cols-3">{[
        ['Identity systems differ by market', 'USDOT, NMLS, NPN, CMS CCN, state credentials, and CRD identify different regulated entities.', 'A similar name is not proof of a shared legal identity.'],
        ['Coverage differs by jurisdiction and source', 'Six network states now connect to different combinations of specialist state intelligence, national research, and official verification paths.', 'A missing or request-only roster remains unknown—not zero.'],
        ['Recorded geography has limits', 'Headquarters, property county, facility location, credential jurisdiction, and office address mean different things.', 'None automatically proves service territory.'],
      ].map(([title, evidence, limitation]) => <article key={title} className="rounded-2xl border bg-slate-50 p-5" style={{ borderColor: ASK_BRAND.border }}><h3 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>{title}</h3><p className="mt-3 text-sm leading-relaxed">{evidence}</p><p className="mt-3 text-xs text-slate-600">Limitation: {limitation}</p><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Trace this finding</summary><p className="text-sm">Source: ask-network-intel-v1, network coverage matrix, and six accepted hub manifests.</p></details></article>)}</div></div></section>

      <section className="section-block border-b bg-slate-50" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="evidence-heading"><div className="container-page"><SectionHeading eyebrow="Network evidence inventory" title="Millions of source-native observations. No fake grand total." copy={`${inventory.length} publication-eligible specialist measures remain separately grained and traceable. The homepage highlights the most useful measures; this inventory shows the breadth underneath without adding entities, filings, relationships, credentials, or observations together.`} /><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Object.entries(NETWORK_EVIDENCE_FAMILY_LABELS).map(([family, title]) => { const measures = inventory.filter((metric) => metric.family === family); const contributors = [...new Set(measures.map((metric) => metric.hub))]; return <article key={family} className="rounded-2xl border bg-white p-5" style={{ borderColor: ASK_BRAND.border }}><Database className="h-5 w-5" style={{ color: ASK_BRAND.indigo }} aria-hidden /><h3 className="mt-3 font-semibold" style={{ color: ASK_BRAND.navy }}>{title}</h3><p className="mt-2 text-sm leading-relaxed">{measures.length} traceable specialist measures. Every value retains its hub, grain, publication status, source contract, and clocks.</p><ul className="mt-4 flex flex-wrap gap-2" aria-label={`${title} contributing hubs`}>{contributors.map((id) => <li key={id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{CARD_CONFIG[id].eyebrow}</li>)}</ul><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Explore evidence depth</summary><div className="space-y-2">{measures.map((metric) => <InventoryMeasureTrace key={`${metric.hub}-${metric.key}`} metric={metric} />)}</div></details></article>; })}</div><p className="mt-6 rounded-xl border bg-white p-4 text-sm leading-relaxed" style={{ borderColor: ASK_BRAND.border }}><strong>Meaning stays source-native:</strong> examination ≠ enforcement · complaint ≠ violation · inspection ≠ deficiency · credential ≠ endorsement · HMDA denial ≠ misconduct · appointment ≠ entity · authority ≠ safety · public profile ≠ regulatory universe · HQ ≠ service territory · RAUM ≠ performance.</p></div></section>

      <section className="section-block border-b bg-white" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="pathways-heading"><div className="container-page"><SectionHeading eyebrow="Explore the six research hubs" title="Start with the question, then open the source-owned evidence." copy="Ask organizes the network. Each specialist hub remains authoritative for its identities, publication rules, and evidence." /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{hubs.map((hub) => <a key={hub.hub_id} href={CARD_CONFIG[hub.hub_id].href} className="group rounded-2xl border p-5 focus-visible:outline-none focus-visible:ring-2" style={{ borderColor: ASK_BRAND.border }}><Search className="h-5 w-5" style={{ color: ASK_BRAND.indigo }} aria-hidden /><h3 className="mt-3 font-semibold" style={{ color: ASK_BRAND.navy }}>{CARD_CONFIG[hub.hub_id].eyebrow}</h3><p className="mt-2 text-sm leading-relaxed">{hub.consumer_research_questions[0]}</p><span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold" style={{ color: ASK_BRAND.indigo }}>Continue research <ArrowRight className="ml-2 h-4 w-4" aria-hidden /></span></a>)}</div></div></section>

      <section className="section-block border-b bg-slate-50" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="coverage-heading"><div className="container-page"><SectionHeading eyebrow="Ten-state network explorer" title="State intelligence is real—and intentionally not symmetrical." copy="Each state combines specialist pages, national research, and verification paths according to the underlying regulator and accepted specialist contract. Coverage is not a score or ranking." /><div className="mt-8 grid gap-4 lg:grid-cols-2">{stateCoverage.map((state) => <article key={state.code} className="rounded-2xl border bg-white p-5" style={{ borderColor: ASK_BRAND.border }}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>{state.code}</p><h3 className="mt-1 text-xl font-semibold" style={{ color: ASK_BRAND.navy }}>{state.name}</h3></div><Link href={state.askHref} data-analytics-event="network_state_click" className="inline-flex min-h-11 items-center font-semibold" style={{ color: ASK_BRAND.indigo }}>Open network state →</Link></div><ul className="mt-4 grid gap-2 sm:grid-cols-2">{state.hubs.map((coverage) => <li key={coverage.hub} className="rounded-xl bg-slate-50 p-3 text-sm"><a href={coverage.href} className="font-semibold" style={{ color: ASK_BRAND.navy }}>{CARD_CONFIG[coverage.hub].eyebrow}</a><p className="mt-1 text-xs text-slate-600">{coverage.label}</p></li>)}</ul></article>)}</div><p className="mt-5 text-sm text-slate-600">Arizona Move has no comparable state household-goods licensing universe. Arizona Insurance has no published specialist state page. Florida Investor remains national SEC/IARD research without a published Florida specialist page. These are coverage distinctions—not zeroes.</p></div></section>

      <section className="section-block border-b bg-white" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="method-heading"><div className="container-page"><SectionHeading eyebrow="How the network works" title="Evidence in. Traceable research out." copy="We organize evidence. We do not tell you who is best." /><ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{METHOD.map(([step, description], index) => <li key={step} className="rounded-xl border p-4" style={{ borderColor: ASK_BRAND.border }}><p className="text-xs font-bold" style={{ color: ASK_BRAND.indigo }}>{index + 1}</p><h3 className="mt-1 font-semibold" style={{ color: ASK_BRAND.navy }}>{step}</h3><p className="mt-2 text-sm leading-relaxed">{description}</p></li>)}</ol></div></section>

      <section className="section-block border-b bg-slate-50" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="sources-heading"><div className="container-page"><SectionHeading eyebrow="Source ledger & freshness" title={`${publisherCount} normalized public-source publishers, ${ledger.sources.length} dataset entries.`} copy="Public sources update on different schedules. Each displayed metric keeps its own source as-of and retrieval clocks in Trace." /><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ledger.sources.slice(0, 9).map((source) => <details key={source.source_id} className="rounded-xl border bg-white px-4" style={{ borderColor: ASK_BRAND.border }}><summary className="flex min-h-12 cursor-pointer items-center font-semibold">{source.publisher}</summary><div className="border-t py-3 text-sm" style={{ borderColor: ASK_BRAND.border }}><p>{source.dataset}</p><p className="mt-2 text-slate-600">As of {source.official_as_of ?? 'not supplied'} · retrieved {source.retrieval_date}</p><p className="mt-2 text-xs">{source.limitations}</p></div></details>)}</div><Link href="/data-sources" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold" style={{ color: ASK_BRAND.indigo }}><BookOpen className="h-4 w-4" aria-hidden /> View the full source ledger</Link></div></section>

      <section className="section-block border-b bg-white" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="limits-heading"><div className="container-page grid gap-8 lg:grid-cols-2"><div><SectionHeading eyebrow="What we don't know" title="What this research does not prove" copy="Public evidence is useful because its meaning is bounded." /><ul className="mt-6 space-y-3 text-sm leading-relaxed">{['Public records can lag real-world changes.','Missing evidence is not a clean-record guarantee.','A credential or registration is not an endorsement.','Recorded headquarters is not service territory.','Coverage varies by regulator, evidence class, and state.'].map((item) => <li key={item} className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: ASK_BRAND.indigo }} aria-hidden />{item}</li>)}</ul></div><div className="rounded-2xl border bg-slate-50 p-6" style={{ borderColor: ASK_BRAND.border }}><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>Network reconciliation</p><h2 className="mt-2 text-2xl font-semibold" style={{ color: ASK_BRAND.navy }}>Six current specialist contracts, one evidence-preserving view</h2><p className="mt-3 text-sm leading-relaxed">Ask now consumes the current accepted Move, Lender, Insurance, Contractor, Senior, and Investor contracts. Specialist hubs own the numbers; Ask owns navigation, explanation, and cross-hub discovery.</p><p className="mt-4 text-xs text-slate-600">A specialist source date, retrieval date, snapshot date, generated date, and Ask deployment date remain different clocks.</p></div></div></section>

      <section className="section-block border-b bg-slate-50" style={{ borderColor: ASK_BRAND.border }} aria-labelledby="owner-heading"><div className="container-page"><SectionHeading eyebrow="Business owners & account" title="Manage an eligible exact profile without changing the evidence." copy="The certified claim journey starts from an exact supported profile. Claiming permits corrections and responses where supported; it is not regulator verification, endorsement, ranking advantage, or paid placement." /><div className="mt-6 flex flex-wrap gap-3"><Link href="/ask?q=Find%20my%20business%20profile" data-analytics-event="network_claim_click" className="inline-flex min-h-11 items-center rounded-xl px-5 font-semibold text-white" style={{ backgroundColor: ASK_BRAND.indigo }}>Find an eligible profile to claim</Link><Link href="/manage" data-analytics-event="network_account_click" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-5 font-semibold" style={{ borderColor: ASK_BRAND.border, color: ASK_BRAND.navy }}>Open My Trust Hub account</Link></div></div></section>

      <HomeConciergeDemoted />

      <section className="section-block bg-slate-950 text-white"><div className="container-page text-center"><MapPinned className="mx-auto h-7 w-7 text-indigo-300" aria-hidden /><h2 className="mt-4 text-3xl font-semibold">Research before you choose.</h2><p className="mx-auto mt-3 max-w-2xl text-slate-300">Understand the network. Search the record. Open the specialist evidence. Trace the source. You decide.</p><Link href="#ask-network" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-white px-6 font-semibold text-slate-950">Search the network</Link><p className="mt-6 text-xs text-slate-400">Paid or managed status does not change regulatory facts, publication standards, search ordering, or State of Record numbers.</p></div></section>
    </>
  );
}
