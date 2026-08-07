/** Shared “last reviewed” dates for flagship trust pages (update when content changes). */
export const TRUST_PAGE_REVIEWED = {
  standard: '2026-08-07',
  dataSources: '2026-08-07',
  whoWeAre: '2026-08-07',
  about: '2026-08-07',
  promise: '2026-08-07',
  editorial: '2026-08-07',
  corrections: '2026-08-07',
  howWeMakeMoney: '2026-08-07',
  trust: '2026-08-07',
  network: '2026-08-07',
} as const;

export function formatReviewDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}
