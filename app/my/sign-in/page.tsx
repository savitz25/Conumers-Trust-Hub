import Link from "next/link";
import { redirect } from "next/navigation";
import { requestMagicLinkAction } from "@/app/my/actions";
import { isMyTrustHubCanaryOnly } from "@/lib/my-trusthub/canary-access";
import { getEnabledAdapter } from "@/lib/my-trusthub/page-data";
import { getMyTrustHubFeatureFlags } from "@/lib/my-trusthub/feature-flags";
import { TurnstileField } from "@/components/my-trusthub/turnstile-field";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [adapter, query] = await Promise.all([getEnabledAdapter(), searchParams]);
  if (adapter && (await adapter.getUser())) redirect("/my");
  const flags = getMyTrustHubFeatureFlags();
  const sent = query.sent === "1";
  const restricted = query.access === "restricted";
  const missing = query.configuration === "missing" || !adapter;
  const error = typeof query.error === "string" ? query.error : null;
  const canaryOnly = isMyTrustHubCanaryOnly();

  return (
    <main className="myth-auth-page">
      <section className="myth-auth-card" aria-labelledby="sign-in-title">
        <p className="myth-eyebrow">PRIVATE CONSUMER WORKSPACE</p>
        <h1 id="sign-in-title">Sign in to My TrustHub</h1>
        <p>Use your canonical My TrustHub account to keep research private and available across devices.</p>
        {sent ? <p className="myth-notice" role="status">Check your email for a secure sign-in link.</p> : null}
        {restricted ? <p className="myth-warning" role="status">This account does not have access to the internal canary.</p> : null}
        {missing ? <p className="myth-warning" role="status">Sign-in infrastructure is not configured in this environment.</p> : null}
        {error === "invalid" ? <p className="myth-warning" role="alert">Enter a valid email address.</p> : null}
        {error === "unavailable" ? <p className="myth-warning" role="alert">Sign-in is temporarily unavailable. Please try again later.</p> : null}
        {error === "delivery" ? <p className="myth-warning" role="alert">We could not send the sign-in link. Please wait a moment and try again.</p> : null}
        {error === "captcha" ? <p className="myth-warning" role="alert">Complete the security check, then try again.</p> : null}
        {error === "callback_missing_code" ? <p className="myth-warning" role="alert">That sign-in link is incomplete. Request a fresh link and try again.</p> : null}
        {error === "callback_exchange" ? <p className="myth-warning" role="alert">That sign-in link expired or could not be verified. Request a fresh link and try again.</p> : null}
        {error === "callback_session" || error === "callback_unavailable" ? <p className="myth-warning" role="alert">We could not finish sign-in safely. Request a fresh link and try again.</p> : null}
        {flags.MY_TRUSTHUB_ENABLED && !missing ? (
          <form action={requestMagicLinkAction} className="myth-form">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
            {process.env.NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY ? <TurnstileField siteKey={process.env.NEXT_PUBLIC_MY_TRUSTHUB_TURNSTILE_SITE_KEY} /> : null}
            <button className="myth-primary" type="submit">Email me a sign-in link</button>
          </form>
        ) : (
          <p className="myth-muted">New sign-in is currently disabled by the launch gate.</p>
        )}
        {canaryOnly ? <p className="myth-muted">Access is restricted to approved internal canary accounts. Public signup is disabled.</p> : null}
        <p className="myth-disclosure">Your consumer workspace is separate from Business Manager. Research activity never changes public ranking.</p>
        <Link href="/">Return to Ask Trust Hub</Link>
      </section>
    </main>
  );
}
