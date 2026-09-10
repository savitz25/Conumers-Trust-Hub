import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { signOutAction } from "@/app/my/actions";
import { MyTrustHubShell, PageHeading } from "@/components/my-trusthub/my-shell";
import { requireWorkspace } from "@/lib/my-trusthub/page-data";

export default async function YouPage() {
  const { user } = await requireWorkspace();
  const email = user.email ?? "Email unavailable";

  return (
    <MyTrustHubShell active="You" email={email}>
      <PageHeading eyebrow="ACCOUNT / PRIVACY" title="You">
        Your consumer research account and the privacy boundaries that protect it.
      </PageHeading>
      <section className="myth-grid">
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading"><h2><UserRound aria-hidden="true" />Account</h2></div>
          <dl className="myth-settings">
            <div><dt>Signed-in email</dt><dd>{email}</dd></div>
            <div><dt>Email confirmed</dt><dd>{user.email_confirmed_at ? "Confirmed" : "Not confirmed"}</dd></div>
            <div><dt>Workspace access</dt><dd>Founder canary</dd></div>
          </dl>
          <form action={signOutAction} className="myth-you-signout">
            <button className="myth-secondary" type="submit">Sign out of My TrustHub</button>
          </form>
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2><LockKeyhole aria-hidden="true" />Private by design</h2></div>
          <p>Your Saves, Projects, memberships, and notes are private consumer research.</p>
          <p className="myth-muted">Businesses cannot see your shortlist. Saving does not create a Watch, endorsement, ranking signal, claim, or management grant.</p>
        </article>
        <article className="myth-panel myth-span-three">
          <div className="myth-panel-heading"><h2><ShieldCheck aria-hidden="true" />Separate from Business Manager</h2></div>
          <p>My TrustHub is your consumer workspace. Business Manager is a separate business-authorized product with separate memberships and management grants.</p>
          <p className="myth-muted">Export, account deletion, Watches, Alerts, and public signup are not enabled in this stage, so no inactive controls are shown here.</p>
        </article>
      </section>
    </MyTrustHubShell>
  );
}
