import { CLAIM_PROGRESS_STEPS } from '@/lib/customer/experience';

export function ClaimProgress({ current }: { current: number }) {
  return <nav aria-label="Claim progress" className="card-surface p-4">
    <ol className="grid gap-2 sm:grid-cols-6">
      {CLAIM_PROGRESS_STEPS.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        return <li key={label} aria-current={active ? 'step' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${active ? 'border-indigo bg-indigo/5 font-semibold text-navy' : step < current ? 'border-border text-foreground' : 'border-border text-muted-foreground'}`}>
          <span className="block text-xs">{step}</span>{label}
        </li>;
      })}
    </ol>
  </nav>;
}
