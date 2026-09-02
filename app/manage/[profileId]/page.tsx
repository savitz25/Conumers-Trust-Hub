import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPageMetadata } from '@/lib/seo/metadata';
import { BusinessProfileEditor } from '@/components/customer/BusinessProfileEditor';
import { ManageConsoleView } from '@/components/customer/ManageConsoleView';
import { RecordIssuesPanel } from '@/components/customer/RecordIssuesPanel';
import { BusinessRepliesPanel } from '@/components/customer/BusinessRepliesPanel';
import { MonitoringPanel } from '@/components/customer/MonitoringPanel';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { AuthError, ManagementError } from '@/lib/customer/store';
import { CUSTOMER_HUB_REGISTRY, customerEntityClassLabel } from '@/lib/customer/hub-registry';

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
  let recordIssues;
  let businessReplies;
  let monitoring;
  try {
    [model,recordIssues,businessReplies,monitoring]=await Promise.all([
      withPlatform((p)=>p.businessProfile(token,profileId)),withPlatform((p)=>p.recordIssues(token,profileId)),
      withPlatform((p)=>p.businessReplies(token,profileId)),withPlatform((p)=>p.monitoring(token,profileId)),
    ]);
  }
  catch (error) { if (error instanceof AuthError || error instanceof ManagementError) notFound(); throw error; }
  const fields = Object.fromEntries(model.fields.map((row) => [row.field_key, row.value_text]));
  const items = (category: string) => model.items.filter((row) => row.category === category).map((row) => row.value_text);
  const canEdit = ['owner', 'manager', 'staff'].includes(model.access.role);
  const capability=CUSTOMER_HUB_REGISTRY[model.access.hub_id];
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-12">
    <ManageConsoleView profileId={profileId} />
    <header><Link href="/manage" className="text-sm text-muted-foreground underline">All managed profiles</Link>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-indigo">Manage profile</p>
      <h1 className="mt-1 text-2xl font-semibold text-navy">{model.access.display_name_snapshot || model.access.native_slug}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Management status: Active · Role: {model.access.role}</p>
    </header>
    <nav aria-label="Profile workspace" className="card-surface flex flex-wrap gap-2 p-3 text-sm"><a className="btn-secondary" href="#overview">Overview</a><a className="btn-secondary" href="#business-information">Business information</a><a className="btn-secondary" href="#official-evidence">Official evidence</a><a className="btn-secondary" href="#record-issues">Issues &amp; corrections</a><a className="btn-secondary" href="#business-responses">Business response</a><a className="btn-secondary" href="#monitoring">Monitoring</a><a className="btn-secondary" href="#activity">Activity</a><Link className="btn-secondary" href={`/manage/organization/${model.access.org_id}`}>Team / access</Link></nav>
    <section id="overview" className="card-surface p-5"><h2 className="text-xl font-semibold text-navy">Overview</h2><p className="mt-2 text-sm text-muted-foreground">This is a managed profile. Control verified, not endorsement. Official records remain read-only and independent from information supplied by the business.</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4"><div><dt className="text-muted-foreground">Owning Trust Hub</dt><dd>{capability.displayName}</dd></div><div><dt className="text-muted-foreground">Provider class</dt><dd>{customerEntityClassLabel(model.access.entity_class)}</dd></div><div><dt className="text-muted-foreground">{capability.identifierLabel}</dt><dd className="break-all">{model.access.native_credential_key}</dd></div><div><dt className="text-muted-foreground">Your role</dt><dd>{model.access.role}</dd></div></dl></section>
    <div id="business-information"><BusinessProfileEditor profileId={profileId} hubId={model.access.hub_id} canEdit={canEdit} initial={{
      version: model.version, fields, services: items('service'), serviceAreas: items('service_area'), languages: items('language'),
      freshness: model.freshness,
      hours: model.hours.map((h) => ({ weekday: Number(h.weekday), closed: Boolean(h.is_closed), opensAt: h.opens_at?.slice(0, 5), closesAt: h.closes_at?.slice(0, 5) })),
    }} /></div>
    <div id="monitoring">{capability.monitoring==='SUPPORTED'?<MonitoringPanel profileId={profileId} canEdit={canEdit} initial={monitoring.subscription as never} notifications={monitoring.notifications as never}/>:<section className="card-surface p-5"><h2 className="font-semibold text-navy">Monitoring is not available yet</h2><p className="mt-2 text-sm text-muted-foreground">Exact-profile source monitoring is not yet available for {capability.displayName}. You can still manage business information and review official evidence.</p><div className="mt-4 flex flex-wrap gap-3"><a className="btn-primary" href="#business-information">Keep managing this profile</a><a className="btn-secondary" href="#official-evidence">View official evidence</a><Link className="btn-secondary" href={`/claim/help?category=monitoring_unavailable&hub=${model.access.hub_id}&profile=${encodeURIComponent(profileId)}`}>Contact us about monitoring</Link></div></section>}</div>
    <div id="business-responses"><BusinessRepliesPanel profileId={profileId} credentialKey={recordIssues.credentialKey} replies={businessReplies.replies as never}/></div>
    <div id="record-issues"><RecordIssuesPanel profileId={profileId} credentialKey={recordIssues.credentialKey} issues={recordIssues.issues as never} /></div>
    <section id="official-evidence" className="card-surface p-5"><p className="text-xs font-semibold uppercase tracking-wider text-indigo">On the official record</p>
      <h2 className="mt-1 text-xl font-semibold text-navy">{capability.displayName} identity</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Business name</dt><dd>{model.access.display_name_snapshot}</dd></div><div><dt className="text-muted-foreground">{capability.identifierLabel}</dt><dd>{model.access.native_credential_key}</dd></div></dl>
      <p className="mt-3 text-sm text-muted-foreground">This government-sourced record cannot be changed here. Business-supplied information never replaces it.</p>
      {model.access.canonical_url?<a className="link-inline mt-3 inline-block text-sm" href={model.access.canonical_url}>Open the authoritative {capability.displayName} profile</a>:null}
    </section>
    <section id="activity" className="card-surface p-5"><h2 className="text-xl font-semibold text-navy">Recent activity</h2>
      {model.activity.length ? <ul className="mt-3 space-y-2 text-sm">{model.activity.map((event, i) => <li key={`${event.created_at}-${i}`}>{event.action === 'business_info_reconfirmed' ? 'Business information reconfirmed' : 'Business information saved'} · {new Date(event.created_at).toLocaleString('en-US')}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No business-information changes yet.</p>}
    </section>
    <section className="card-surface p-5"><h2 className="text-xl font-semibold text-navy">What profile management means</h2><p className="mt-2 text-sm text-muted-foreground">You can update business-supplied information, report an incorrect association, request review, and submit a public response. You cannot pay to hide evidence, remove accurate public records, edit regulator records, change search ordering, or change TrustHub research findings.</p></section>
  </main>;
}
