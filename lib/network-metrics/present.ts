import type { SpecialistHubPresentation } from './types.ts';

export function specialistCardMarkup(card: SpecialistHubPresentation): string {
  const numbers = [...card.universes, ...card.primary, ...card.secondary]
    .map((metric) =>
      [
        `${metric.value.toLocaleString('en-US')} ${metric.label}`,
        `Grain ${metric.grain}`,
        `Source label ${metric.sourceLabel}`,
        metric.sourceAsOf ?? '',
      ].join('\n'),
    )
    .join('\n');
  return [
    card.name,
    card.origin === 'FALLBACK' ? 'Showing last-known-good specialist snapshot' : 'UPSTREAM',
    numbers,
    `Newest documented specialist source date ${card.newestSourceAsOf ?? ''}`,
    card.newestSourceAsOfNote,
    card.caveats.join(' '),
    'Trace this number',
  ].join('\n');
}
