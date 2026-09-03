import Link from 'next/link';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import {
  COVERAGE_LEVEL_LABELS,
  type CoverageLevel,
} from '@/lib/network/coverage-atlas';
import { coverageAtlasCells, ENHANCED_COUNTIES } from '@/lib/network/coverage-atlas-data';
import { coverageNotifyIntent } from '@/lib/network/coverage-notify';
import { NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS, type SpecialistHubId } from '@/lib/network/registry';
import { US_JURISDICTIONS } from '@/lib/network/us-jurisdictions';

const LEVEL_TONE: Record<CoverageLevel, string> = {
  enhanced_county_intelligence: '#312E81',
  enhanced_state_intelligence: '#4338CA',
  state_research: '#6366F1',
  federal_core: '#A5B4FC',
  basic_discovery: '#E0E7FF',
  not_yet_researched: '#F1F5F9',
};

const LEVEL_FG: Record<CoverageLevel, string> = {
  enhanced_county_intelligence: '#fff',
  enhanced_state_intelligence: '#fff',
  state_research: '#fff',
  federal_core: '#0A2540',
  basic_discovery: '#0A2540',
  not_yet_researched: '#64748B',
};

export function CoverageAtlasView({
  hub,
  state,
  level,
}: {
  hub?: string;
  state?: string;
  level?: string;
}) {
  const hubFilter = SPECIALIST_HUB_IDS.includes(hub as SpecialistHubId) ? (hub as SpecialistHubId) : undefined;
  const levelFilter = level && level in COVERAGE_LEVEL_LABELS ? (level as CoverageLevel) : undefined;
  const stateFilter = state?.toUpperCase();

  const cells = coverageAtlasCells().filter((c) => {
    if (hubFilter && c.hubId !== hubFilter) return false;
    if (stateFilter && c.geographyCode !== stateFilter) return false;
    if (levelFilter && c.status !== levelFilter) return false;
    if (level === 'enhanced') {
      return (
        c.status === 'enhanced_state_intelligence' || c.status === 'enhanced_county_intelligence'
      );
    }
    return true;
  });

  const hubs = hubFilter ? [hubFilter] : [...SPECIALIST_HUB_IDS];
  const states = stateFilter
    ? US_JURISDICTIONS.filter((j) => j.code === stateFilter)
    : US_JURISDICTIONS;

  const selected = cells[0];
  const notify = selected
    ? coverageNotifyIntent(selected.hubId, selected.geographyCode, selected.status)
    : null;

  return (
    <div>
      <p className="max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Coverage describes published research capability, not quality, safety, or “better” states. Darker
        cells are not better. Missing is not zero.
      </p>

      <form className="mt-6 flex flex-wrap gap-2" method="get" action="/network/coverage">
        <label className="sr-only" htmlFor="cov-hub">
          Hub
        </label>
        <select id="cov-hub" name="hub" defaultValue={hub ?? ''} className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          <option value="">All hubs</option>
          {SPECIALIST_HUB_IDS.map((id) => (
            <option key={id} value={id}>
              {NETWORK_PUBLIC_NAMES[id]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="cov-state">
          State
        </label>
        <select id="cov-state" name="state" defaultValue={state ?? ''} className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          <option value="">All jurisdictions</option>
          {US_JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>
              {j.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="cov-level">
          Coverage level
        </label>
        <select id="cov-level" name="level" defaultValue={level ?? ''} className="min-h-11 rounded-xl border px-3 text-sm" style={{ borderColor: ASK_BRAND.border }}>
          <option value="">All levels</option>
          <option value="enhanced">Enhanced only</option>
          {(Object.keys(COVERAGE_LEVEL_LABELS) as CoverageLevel[]).map((k) => (
            <option key={k} value={k}>
              {COVERAGE_LEVEL_LABELS[k]}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ backgroundColor: ASK_BRAND.indigo }}>
          Filter
        </button>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2 text-xs">
        {(Object.keys(COVERAGE_LEVEL_LABELS) as CoverageLevel[]).map((k) => (
          <li key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: LEVEL_TONE[k] }} />
            {COVERAGE_LEVEL_LABELS[k]}
          </li>
        ))}
      </ul>

      <div className="mt-8 lg:hidden">
        <h2 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
          State-first view
        </h2>
        <ul className="mt-3 space-y-3">
          {states.map((j) => (
            <li key={j.code} className="rounded-xl border p-3" style={{ borderColor: ASK_BRAND.border }}>
              <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>
                {j.name}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {hubs.map((id) => {
                  const cell = cells.find((c) => c.hubId === id && c.geographyCode === j.code);
                  if (!cell) return null;
                  return (
                    <li key={id}>
                      <span className="font-medium">{NETWORK_PUBLIC_NAMES[id]}:</span>{' '}
                      {COVERAGE_LEVEL_LABELS[cell.status]}
                      {cell.destination && cell.dedicatedPage ? (
                        <>
                          {' '}
                          <a href={cell.destination} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                            Open
                          </a>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 hidden overflow-x-auto lg:block">
        <table className="min-w-[72rem] w-full border-collapse text-left text-xs">
          <caption className="sr-only">Coverage atlas: jurisdictions by specialist hub</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-white p-2">
                Jurisdiction
              </th>
              {hubs.map((id) => (
                <th key={id} scope="col" className="p-2">
                  {NETWORK_PUBLIC_NAMES[id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((j) => (
              <tr key={j.code} className="border-t" style={{ borderColor: ASK_BRAND.border }}>
                <th scope="row" className="sticky left-0 bg-white p-2 font-medium">
                  {j.name}
                </th>
                {hubs.map((id) => {
                  const cell = cells.find((c) => c.hubId === id && c.geographyCode === j.code);
                  if (!cell) {
                    return (
                      <td key={id} className="p-1">
                        —
                      </td>
                    );
                  }
                  const inner = (
                    <span
                      className="block min-h-11 rounded-md px-2 py-2"
                      style={{ backgroundColor: LEVEL_TONE[cell.status], color: LEVEL_FG[cell.status] }}
                      title={cell.why}
                    >
                      {COVERAGE_LEVEL_LABELS[cell.status]}
                    </span>
                  );
                  return (
                    <td key={id} className="p-1 align-top">
                      {cell.destination && cell.dedicatedPage ? (
                        <a href={cell.destination} className="block">
                          {inner}
                        </a>
                      ) : (
                        inner
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
          How to read a cell
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Example: Florida × Contractor is enhanced state intelligence because Florida DBPR Intelligence OS
          exists, plus Broward and Palm Beach county pages. New Jersey × Contractor is specialty Verify — state
          research, no enhanced county intelligence.
        </p>
        <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
          Cells that open the same national homepage (for example Lender non-Florida → /lender) are labeled
          federal core without implying a unique state report.
        </p>
        <ul className="mt-4 list-disc pl-5 text-sm" style={{ color: ASK_BRAND.ink }}>
          {ENHANCED_COUNTIES.map((c) => (
            <li key={c.countySlug}>
              {c.countyName} × {NETWORK_PUBLIC_NAMES[c.hubId]}:{' '}
              <a href={c.destination} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                enhanced county intelligence
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs" style={{ color: ASK_BRAND.ink }}>
          Notify-me contract ({notify?.contract}): not wired. No parallel account system.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/places/florida" className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Open Florida Place Lens
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href="/new-jersey" className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
            Open New Jersey network research
          </Link>
        </p>
      </section>
    </div>
  );
}
