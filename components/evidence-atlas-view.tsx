import { ASK_BRAND } from '@/lib/design/ask-design-system';
import {
  EVIDENCE_FAMILY_IDS,
  EVIDENCE_FAMILY_LABELS,
  EVIDENCE_STATUS_LABELS,
  type EvidenceStatus,
} from '@/lib/network/evidence-atlas';
import { evidenceAtlasCells } from '@/lib/network/evidence-atlas-data';
import { NETWORK_PUBLIC_NAMES, SPECIALIST_HUB_IDS } from '@/lib/network/registry';
import { listNetworkSourceRows } from '@/lib/network/source-registry';

const TONE: Record<EvidenceStatus, string> = {
  deep: '#312E81',
  available: '#4338CA',
  partial: '#A5B4FC',
  planned: '#E2E8F0',
  not_applicable: '#F8FAFC',
};
const FG: Record<EvidenceStatus, string> = {
  deep: '#fff',
  available: '#fff',
  partial: '#0A2540',
  planned: '#334155',
  not_applicable: '#94A3B8',
};

export function EvidenceAtlasView({ family, hub }: { family?: string; hub?: string }) {
  const cells = evidenceAtlasCells();
  const sources = listNetworkSourceRows();
  const focus = cells.find((c) => (!family || c.familyId === family) && (!hub || c.hubId === hub)) ?? cells[0];
  const src = focus?.sourceFamilyId
    ? sources.find((s) => s.hubId === focus.hubId && s.id === focus.sourceFamilyId)
    : undefined;

  return (
    <div>
      <p className="max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        Status is research availability, not a quality grade. Colors are categories. They are not a red/green
        score and not percentages.
      </p>
      <div className="mt-6 hidden overflow-x-auto lg:block">
        <table className="min-w-[64rem] w-full text-left text-xs">
          <caption className="sr-only">Evidence atlas by family and hub</caption>
          <thead>
            <tr>
              <th className="p-2">Family</th>
              {SPECIALIST_HUB_IDS.map((id) => (
                <th key={id} className="p-2">
                  {NETWORK_PUBLIC_NAMES[id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVIDENCE_FAMILY_IDS.map((fam) => (
              <tr key={fam} className="border-t" style={{ borderColor: ASK_BRAND.border }}>
                <th className="p-2 font-medium">{EVIDENCE_FAMILY_LABELS[fam]}</th>
                {SPECIALIST_HUB_IDS.map((id) => {
                  const cell = cells.find((c) => c.hubId === id && c.familyId === fam);
                  if (!cell) return <td key={id} />;
                  return (
                    <td key={id} className="p-1">
                      <a
                        href={`/network/evidence?hub=${id}&family=${fam}`}
                        className="block min-h-11 rounded-md px-2 py-2"
                        style={{ backgroundColor: TONE[cell.status], color: FG[cell.status] }}
                      >
                        {EVIDENCE_STATUS_LABELS[cell.status]}
                      </a>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-6 space-y-3 lg:hidden">
        {EVIDENCE_FAMILY_IDS.map((fam) => (
          <li key={fam} className="rounded-xl border p-3" style={{ borderColor: ASK_BRAND.border }}>
            <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>
              {EVIDENCE_FAMILY_LABELS[fam]}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {SPECIALIST_HUB_IDS.map((id) => {
                const cell = cells.find((c) => c.hubId === id && c.familyId === fam);
                return (
                  <li key={id}>
                    {NETWORK_PUBLIC_NAMES[id]}: {cell ? EVIDENCE_STATUS_LABELS[cell.status] : '—'}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {focus ? (
        <section className="mt-10 max-w-2xl rounded-2xl border p-5" style={{ borderColor: ASK_BRAND.border }}>
          <h2 className="text-lg font-semibold" style={{ color: ASK_BRAND.navy }}>
            {NETWORK_PUBLIC_NAMES[focus.hubId as keyof typeof NETWORK_PUBLIC_NAMES]} × {EVIDENCE_FAMILY_LABELS[focus.familyId]}
          </h2>
          <p className="mt-2 text-sm" style={{ color: ASK_BRAND.ink }}>
            Status: {EVIDENCE_STATUS_LABELS[focus.status]}
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            {focus.why}
          </p>
          {src ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="text-xs uppercase">Source organization</dt>
                <dd>{src.sourceOrganization}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase">Grain</dt>
                <dd>{src.grain}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase">Official as-of</dt>
                <dd>{src.officialAsOf ?? '—'}</dd>
              </div>
            </dl>
          ) : null}
          {focus.destination ? (
            <a href={focus.destination} className="mt-4 inline-flex min-h-11 items-center font-semibold" style={{ color: ASK_BRAND.indigo }}>
              Open specialist destination
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
