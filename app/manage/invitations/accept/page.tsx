import { notFound } from 'next/navigation';
import { InvitationAcceptance } from '@/components/customer/InvitationAcceptance';
import { createPageMetadata } from '@/lib/seo/metadata';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import { OrganizationError } from '@/lib/customer/organization';

export const dynamic = 'force-dynamic';
export const metadata = createPageMetadata({ title: 'Organization invitation', description: 'Private AskTrustHub organization invitation.', path: '/manage/invitations/accept', noIndex: true });

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const raw = String((await searchParams).token || '');
  if (!raw) notFound();
  let invitation;
  try { invitation = await withPlatform((platform) => platform.invitationPreview(raw)); }
  catch (error) { if (error instanceof OrganizationError) notFound(); throw error; }
  const sessionToken = await readSessionToken();
  const user = await withPlatform((platform) => platform.sessionUser(sessionToken));
  return <main className="mx-auto max-w-xl px-4 py-12"><section className="card-surface p-6"><p className="text-xs font-semibold uppercase tracking-wider text-indigo">Private invitation</p><h1 className="mt-2 text-2xl font-semibold text-navy">Join {invitation.organization_name}</h1><p className="mt-3 text-sm text-muted-foreground">Role: {invitation.invited_role} / Expires {new Date(invitation.expires_at).toLocaleDateString('en-US')}</p><p className="mt-3 text-sm text-muted-foreground">Joining an organization does not prove business ownership and does not transfer profiles between organizations.</p><InvitationAcceptance token={raw} authed={Boolean(user)} email={user?.email || ''} /></section></main>;
}
