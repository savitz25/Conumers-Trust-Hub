import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BusinessProfileEditor } from '@/components/customer/BusinessProfileEditor';
import { ManageConsoleView } from '@/components/customer/ManageConsoleView';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { AuthError, ManagementError } from '@/lib/customer/store';

export const dynamic = 'force-dynamic';
export const metadata = createPageMetadata({
  title: 'Manage profile', description: 'Manage information supplied by your business.',
  path: '/manage/profile', noIndex: true,
});

export default async function ManageProfilePage({ params }: { params: Promise<{ profileId: string }> }) {
  const token = await readSessionToken();
  if (!token) return <div className="mx-auto max-w-xl px-4 py-12"><h1 className="text-xl font-semibold">Sign in required</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to manage an authorized profile.</p></div>;
  const { profileId } = await params;
  let model;
  try { model = await withPlatform((p) => p.businessProfile(token, profileId)); }
  catch (error) { if (error instanceof AuthError || error instanceof ManagementError) notFound(); throw error; }
  const fields = Object.fromEntries(model.fields.map((row) => [row.field_key, row.value_text]));
  const items = (category: string) => model.items.filter((row) => row.category === category).map((row) => row.value_text);
  const canEdit = ['owner', 'manager', 'staff'].includes(model.access.role);
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
    <ManageConsoleView profileId={profileId} />
    <header><Link href="/manage" className="text-sm text-muted-foreground underline">All managed profiles</Link>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-indigo">Manage profile</p>
      <h1 className="mt-1 text-2xl font-semibold text-navy">{model.access.display_name_snapshot || model.access.native_slug}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Management status: Active · Role: {model.access.role}</p>
    </header>
    <BusinessProfileEditor profileId={profileId} canEdit={canEdit} initial={{
      version: model.version, fields, services: items('service'), serviceAreas: items('service_area'), languages: items('language'),
      freshness: model.freshness,
      hours: model.hours.map((h) => ({ weekday: Number(h.weekday), closed: Boolean(h.is_closed), opensAt: h.opens_at?.slice(0, 5), closesAt: h.closes_at?.slice(0, 5) })),
    }} />
    <section className="card-surface p-5"><p className="text-xs font-semibold uppercase tracking-wider text-indigo">Official public record</p>
      <h2 className="mt-1 text-xl font-semibold text-navy">Florida DBPR identity</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Business name</dt><dd>{model.access.display_name_snapshot}</dd></div><div><dt className="text-muted-foreground">DBPR credential</dt><dd>{model.access.native_credential_key}</dd></div></dl>
      <p className="mt-3 text-sm text-muted-foreground">This government-sourced record cannot be changed here. Business-supplied information never replaces it.</p>
      <a className="link-inline mt-3 inline-block text-sm" href={`https://www.contractortrusthub.com/contractors/${model.access.native_slug}`}>Open the authoritative ContractorTrustHub profile</a>
    </section>
    <section className="card-surface p-5"><h2 className="text-xl font-semibold text-navy">Recent activity</h2>
      {model.activity.length ? <ul className="mt-3 space-y-2 text-sm">{model.activity.map((event, i) => <li key={`${event.created_at}-${i}`}>{event.action === 'business_info_reconfirmed' ? 'Business information reconfirmed' : 'Business information saved'} · {new Date(event.created_at).toLocaleString('en-US')}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No business-information changes yet.</p>}
    </section>
  </main>;
}
