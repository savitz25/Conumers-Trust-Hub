import { ASK_BRAND } from '@/lib/design/ask-design-system';
import { listNetworkSourceRows, type NetworkSourceRow } from '@/lib/network/source-registry';
import type { SpecialistHubId } from '@/lib/network/registry';

const HUBS: { id: SpecialistHubId | 'all'; label: string }[] = [
  { id: 'all', label: 'All hubs' },
  { id: 'move', label: 'Move' },
  { id: 'lender', label: 'Lender' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'contractor', label: 'Contractor' },
  { id: 'senior', label: 'Senior' },
  { id: 'investor', label: 'Investor' },
];

export function NetworkSourceLedgerTable({ hub = 'all' }: { hub?: string }) {
  const rows: NetworkSourceRow[] = listNetworkSourceRows().filter((row) =>
    hub && hub !== 'all' ? row.hubId === hub : true
  );

  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter source ledger by hub">
        {HUBS.map((item) => {
          const href = item.id === 'all' ? '/data-sources' : `/data-sources?hub=${item.id}`;
          const active = (hub || 'all') === item.id;
          return (
            <a
              key={item.id}
              href={href}
              className="inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold"
              style={{
                borderColor: ASK_BRAND.border,
                backgroundColor: active ? ASK_BRAND.periwinkle : ASK_BRAND.white,
                color: ASK_BRAND.navy,
              }}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: ASK_BRAND.border }}>
        <table className="min-w-[64rem] w-full text-left text-sm">
          <caption className="sr-only">
            Network source ledger: hub, organization, dataset, grain, dates, limitation
          </caption>
          <thead style={{ backgroundColor: ASK_BRAND.canvas, color: ASK_BRAND.navy }}>
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Hub</th>
              <th scope="col" className="px-3 py-2 font-semibold">Source organization</th>
              <th scope="col" className="px-3 py-2 font-semibold">Regulator/agency</th>
              <th scope="col" className="px-3 py-2 font-semibold">Source system</th>
              <th scope="col" className="px-3 py-2 font-semibold">Dataset</th>
              <th scope="col" className="px-3 py-2 font-semibold">Grain</th>
              <th scope="col" className="px-3 py-2 font-semibold">Geography</th>
              <th scope="col" className="px-3 py-2 font-semibold">Official as-of</th>
              <th scope="col" className="px-3 py-2 font-semibold">Retrieved</th>
              <th scope="col" className="px-3 py-2 font-semibold">Primary source</th>
              <th scope="col" className="px-3 py-2 font-semibold">Limitation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.hubId}-${row.id}`} className="border-t" style={{ borderColor: ASK_BRAND.border }}>
                <th scope="row" className="px-3 py-2 font-medium" style={{ color: ASK_BRAND.navy }}>
                  {row.hubName}
                </th>
                <td className="px-3 py-2">{row.sourceOrganization}</td>
                <td className="px-3 py-2">{row.organizationKind === 'regulator' ? row.regulatorOrAgency ?? '—' : '—'}</td>
                <td className="px-3 py-2">{row.sourceSystem ?? '—'}</td>
                <td className="px-3 py-2">{row.datasetName}</td>
                <td className="px-3 py-2">{row.grain}</td>
                <td className="px-3 py-2">{row.geography ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">{row.officialAsOf ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">{row.retrievedAt ?? '—'}</td>
                <td className="px-3 py-2">
                  {row.publicSourceUrl ? (
                    <a href={row.publicSourceUrl} className="font-semibold underline-offset-2 hover:underline" style={{ color: ASK_BRAND.indigo }}>
                      Open
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">{row.limitation ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
