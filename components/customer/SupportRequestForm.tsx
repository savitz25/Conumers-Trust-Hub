'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Props = { category: string; hub?: string; profile?: string; publicIdentifier?: string; supportEmail: string };

export function SupportRequestForm({ category, hub, profile, publicIdentifier, supportEmail }: Props) {
  const [message, setMessage] = useState('');
  const [prepared, setPrepared] = useState(false);
  const safeContext = useMemo(() => [hub && `Hub: ${hub}`, profile && `Profile: ${profile}`, publicIdentifier && `Public identifier: ${publicIdentifier}`, `Category: ${category}`].filter(Boolean).join('\n'), [category, hub, profile, publicIdentifier]);
  const href = `mailto:${supportEmail}?subject=${encodeURIComponent('AskTrustHub customer support request')}&body=${encodeURIComponent(`${safeContext}\n\nCustomer message:\n${message}`)}`;
  if (prepared) return <section className="card-surface p-5" role="status"><h2 className="text-xl font-semibold text-navy">Your support request is ready</h2><p className="mt-2 text-sm text-muted-foreground">Opening your email app lets you review and send it. Manual reviews are usually completed within 1–2 business days.</p><div className="mt-4 flex flex-wrap gap-3"><a className="btn-primary" href={href}>Open email to send request</a><Link className="btn-secondary" href="/manage">View account</Link><button className="btn-secondary" type="button" onClick={()=>setPrepared(false)}>Edit request</button></div></section>;
  return <form className="card-surface space-y-4 p-5" onSubmit={(event)=>{event.preventDefault();setPrepared(true);}}><div><h2 className="text-xl font-semibold text-navy">Tell us what needs review</h2><p className="mt-2 text-sm text-muted-foreground">We can review a classification or association. Support does not bypass identity, publication, or security requirements.</p></div><label className="block text-sm font-medium">How can we help?<textarea required minLength={10} maxLength={2000} rows={6} className="mt-1 w-full rounded-lg border border-border p-3" value={message} onChange={(event)=>setMessage(event.target.value)} /></label><p className="text-xs text-muted-foreground">Do not include passwords, claim links, verification documents, session tokens, or other private evidence.</p><button className="btn-primary" type="submit">Prepare support request</button></form>;
}
