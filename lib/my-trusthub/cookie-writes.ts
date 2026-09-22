/** Server Components may be read-only; mutable Auth actions/callbacks must fail
 * rather than acknowledge a login/sign-out whose cookies could not be written. */
export function applySessionCookieWrite(write: () => void, required: boolean, report: () => void): void {
  try { write(); }
  catch {
    report();
    if (required) throw new Error('SESSION_COOKIE_WRITE_FAILED');
  }
}
