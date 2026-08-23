import { ASK_BRAND } from '@/lib/design/ask-design-system';

export default function SearchLoading() {
  return (
    <div className="container-page py-16" role="status" aria-live="polite">
      <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>
        Searching the Trust Hub index…
      </p>
    </div>
  );
}
