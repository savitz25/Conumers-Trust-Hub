import Link from 'next/link';
import { createPageMetadata } from '@/lib/seo/metadata';
import { AuthError } from '@/lib/customer/store';
import { readSessionToken,withPlatform } from '@/lib/customer/server';

export const dynamic='force-dynamic';
export const metadata=createPageMetadata({title:'Record issue review',description:'Staff-only record issue queue.',path:'/internal/record-issues',noIndex:true});

export default async function Page({searchParams}:{searchParams:Promise<{issueType?:string;profileId?:string}>}) {
  const token=await readSessionToken(),filters=await searchParams;
  try {
    const rows=await withPlatform(platform=>platform.listRecordIssueReviews(token||'',{issueType:filters.issueType,nativeProfileId:filters.profileId}));
    return <main className="mx-auto max-w-4xl space-y-5 px-4 py-12"><header><p className="text-xs font-semibold uppercase tracking-wider text-indigo">Staff only</p><h1 className="text-2xl font-semibold text-navy">Record issue queue</h1><p className="text-sm text-muted-foreground">Queue order is independent of payment or entitlement state.</p></header><form className="grid gap-3 sm:grid-cols-3"><input name="issueType" defaultValue={filters.issueType} placeholder="Issue type" className="rounded border border-border px-3 py-2"/><input name="profileId" defaultValue={filters.profileId} placeholder="Contractor UUID" className="rounded border border-border px-3 py-2"/><button className="rounded border border-border px-3 py-2">Filter</button></form><ul className="space-y-3">{rows.map(row=><li key={String(row.id)} className="card-surface p-4"><Link className="font-semibold text-navy" href={`/internal/record-issues/${row.id}`}>{String(row.display_name_snapshot)} &middot; {String(row.issue_type)}</Link><p className="text-sm text-muted-foreground">{String(row.status)} &middot; {String(row.target_record_type)} &middot; {String(row.native_credential_key)}</p></li>)}</ul>{rows.length===0?<p>No open record issues.</p>:null}</main>;
  } catch(error) {
    return <main className="mx-auto max-w-xl px-4 py-12"><h1 className="text-xl font-semibold">Record issue review unavailable</h1><p>{error instanceof AuthError?'Staff sign-in required.':'Check the filters and try again.'}</p></main>;
  }
}
