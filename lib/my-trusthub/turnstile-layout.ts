export const TURNSTILE_COMPACT_MAX_WIDTH = 406;

export function turnstileSizeForViewport(width: number): 'compact' | 'flexible' {
  return width <= TURNSTILE_COMPACT_MAX_WIDTH ? 'compact' : 'flexible';
}
