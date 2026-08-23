import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';

export default function SearchLoading() {
  return (
    <div className="container-page py-16" role="status" aria-live="polite" aria-busy="true">
      <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
        Searching the Trust Hub index…
      </p>
      <p className="sr-only">Loading search results</p>
      <div className="mx-auto mt-8 max-w-3xl space-y-4" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border bg-white"
            style={{ borderColor: ASK_BRAND.border, boxShadow: ASK_SHADOW.soft }}
          />
        ))}
      </div>
    </div>
  );
}
