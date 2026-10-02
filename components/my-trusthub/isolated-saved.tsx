import { headers } from 'next/headers';
import Link from 'next/link';
import { Bookmark, LockKeyhole } from 'lucide-react';
import { unsaveIsolatedProfileAction } from '@/app/my/isolated-actions';
import { MyTrustHubEmpty, MyTrustHubShell, PageHeading } from '@/components/my-trusthub/my-shell';
import { hostedRuntime } from '@/lib/my-trusthub/profile-save/hosted-runtime';
import { sqlName } from '@/lib/my-trusthub/profile-save/isolated-config';

const HUB_LABEL: Record<string, string> = {
  move: 'Move Trust Hub', insurance: 'Insurance Trust Hub', lender: 'Lender Trust Hub',
  contractor: 'Contractor Trust Hub', senior: 'Senior Trust Hub', investor: 'Investor Trust Hub',
};
const hubLabel = (hub: string) => HUB_LABEL[hub] ?? hub;

export type IsolatedSavedQuery = { unsaved?: string; error?: string };

/** Save-only preview surface. Does not load absent Sessions/Watch/Alert schemas
 * or expose the internal canary binding form. Production keeps its own page. */
export async function IsolatedSaved({ query = {} }: { query?: IsolatedSavedQuery }) {
  const runtime = await hostedRuntime();
  const request = new Request((runtime?.target.parentOrigin ?? 'https://unavailable.invalid') + '/my/saved', { headers: await headers() });
  const hubHome = (hub: string) => (hub === 'move' && runtime ? runtime.target.moveOrigin : null);
  if (!runtime) {
    return (
      <main className="myth-auth-page">
        <section className="myth-auth-card" role="alert">
          <p className="myth-eyebrow">MY TRUSTHUB</p>
          <h1>Saved profiles are unavailable</h1>
          <p>Your device copy is retained. Please try again later.</p>
        </section>
      </main>
    );
  }
  const parent = await runtime.parent(request);
  if (!parent) {
    return (
      <main className="myth-lander">
        <div className="myth-lander-inner">
          <p className="myth-eyebrow">MY TRUSTHUB</p>
          <h1>Your saved profiles</h1>
          <p>Sign in to see the research you keep in My TrustHub.</p>
          <Link className="myth-primary" href="/my/sign-in?next=%2Fmy%2Fsaved">Sign in to continue</Link>
        </div>
      </main>
    );
  }
  const saved = await runtime.store.authorized(async (db) => (await db.query<{ saved_entity_id: string; canonical_name: string; primary_hub: string; saved_at: string }>(
    `select * from ${sqlName(runtime.target, 'saved')}($1,$2)`, [parent.subject, parent.session])).rows);
  const current = await runtime.parent(request);
  if (current?.subject !== parent.subject || current.session !== parent.session) {
    return (
      <main className="myth-auth-page">
        <section className="myth-auth-card" role="alert">
          <p className="myth-eyebrow">MY TRUSTHUB</p>
          <h1>Your account changed</h1>
          <p>Refresh to continue with your current account.</p>
        </section>
      </main>
    );
  }
  return (
    <MyTrustHubShell active="Saved" email={parent.label}>
      <PageHeading eyebrow="PRIVATE RESEARCH LIBRARY" title="Saved Research">
        Profiles you keep from any TrustHub site stay here when you return. Save never starts a Watch.
      </PageHeading>
      {query.unsaved === '1' ? <p className="myth-notice" role="status">Removed from My TrustHub. Any copy saved on your device stays on that device.</p> : null}
      {query.error === 'unsave' ? <p className="myth-warning" role="alert">That profile could not be removed. Refresh and try again.</p> : null}
      {query.error === 'unavailable' ? <p className="myth-warning" role="alert">Saved profiles are temporarily unavailable. Nothing was changed.</p> : null}
      <section className="myth-grid">
        <article className="myth-panel myth-span-two">
          <div className="myth-panel-heading">
            <h2>Saved profiles</h2>
            <span>{saved.length}</span>
          </div>
          {saved.length ? saved.map((item) => (
            <div className="myth-saved-block" key={item.saved_entity_id} data-saved-entity={item.saved_entity_id}>
              <div className="myth-row">
                <Bookmark aria-hidden="true" />
                <span>
                  <strong data-ph-mask="true">{item.canonical_name}</strong>
                  <small>
                    Saved from {hubLabel(item.primary_hub)} · {new Date(item.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </small>
                </span>
                <form action={unsaveIsolatedProfileAction} className="myth-actions">
                  <input type="hidden" name="savedEntityId" value={item.saved_entity_id} />
                  <button className="myth-secondary" type="submit" aria-label={`Unsave ${item.canonical_name}`}>Unsave</button>
                </form>
              </div>
            </div>
          )) : (
            <MyTrustHubEmpty title="Nothing Saved yet">
              <p>Open a profile on a TrustHub site and choose Keep in My TrustHub. Saving never starts a Watch.</p>
            </MyTrustHubEmpty>
          )}
          {hubHome('move') ? (
            <p className="myth-muted">
              Looking for your movers? <a href={`${hubHome('move')}/companies`}>Return to Move Trust Hub</a>
            </p>
          ) : null}
        </article>
        <article className="myth-panel">
          <div className="myth-panel-heading"><h2>Privacy</h2></div>
          <LockKeyhole aria-hidden="true" />
          <p>
            Saved Research belongs to your consumer workspace. Businesses cannot
            see your shortlist, and Save does not start a Watch.
          </p>
          <p className="myth-muted" data-ph-mask="true">Signed in as {parent.label}</p>
        </article>
      </section>
    </MyTrustHubShell>
  );
}
