import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrganizationTeamPanel } from '@/components/customer/OrganizationTeamPanel';
import { createPageMetadata } from '@/lib/seo/metadata';
import { readSessionToken,withPlatform } from '@/lib/customer/server';
import { AuthError } from '@/lib/customer/store';
import { OrganizationError } from '@/lib/customer/organization';

export const dynamic='force-dynamic';
export const metadata=createPageMetadata({title:'Organization team',description:'Private AskTrustHub organization and team management.',path:'/manage/organization',noIndex:true});

export default async function OrganizationPage({params}:{params:Promise<{orgId:string}>}){
  const token=await readSessionToken(),{orgId}=await params;if(!token)notFound();
  let model;try{model=await withPlatform(p=>p.organizationConsole(token,orgId));}catch(error){if(error instanceof AuthError||error instanceof OrganizationError)notFound();throw error;}
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12"><header><Link href="/manage" className="text-sm underline">Managed profiles</Link><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-indigo">Private organization</p><h1 className="mt-1 text-2xl font-semibold text-navy">{model.organization.displayName}</h1><p className="mt-2 text-sm text-muted-foreground">Status: {model.organization.status} · Your role: {model.currentRole}</p></header>
    <section className="card-surface p-5"><h2 className="text-xl font-semibold text-navy">Managed profiles</h2><p className="mt-1 text-sm text-muted-foreground">Organization membership and exact-profile management grants remain separate authorization checks.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{model.profiles.map(profile=><article key={String(profile.grant_id)} className="rounded-lg border border-border p-4"><p className="text-xs font-semibold uppercase tracking-wider text-indigo">{String(profile.hub_id)} TrustHub</p><h3 className="mt-1 font-semibold">{String(profile.display_name_snapshot||profile.native_slug)}</h3><p className="mt-1 text-sm text-muted-foreground">Credential: {String(profile.native_credential_key)}</p><p className="text-sm text-muted-foreground">Monitoring: {profile.monitoring_enabled?'On':'Off'}</p><Link href={`/manage/${profile.native_profile_id}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white">Manage profile</Link></article>)}</div></section>
    <OrganizationTeamPanel orgId={orgId} canAdmin={model.canAdmin} members={model.members} invitations={model.invitations}/>
  </main>;
}
