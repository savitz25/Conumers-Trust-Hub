/**
 * ASK-PRODUCT-EVENTS-CONTAINMENT-HOLD-001, closed out by CLOSEOUT-002.
 * The browser product-event path stays closed.
 * This is a code constant, not an environment variable, and it is not the PostHog activation latch.
 * Opening the PostHog activation latch does not open this path.
 * Absence of consent, a withdrawn consent state, GPC, and DNT cannot open it either.
 * A later Founder GO has to name a separate first-party grant before this can return true.
 */
export function clientProductEventsAllowed(): boolean {
  return false;
}
