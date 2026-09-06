import { notFound } from 'next/navigation';
import { CUSTOMER_LIFECYCLE_PREVIEWS } from '@/lib/emails/previews/customer-lifecycle';

export const metadata={title:'Customer lifecycle email previews',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';

export default function CustomerEmailPreviewsPage(){
  if(process.env.VERCEL_ENV==='production')notFound();
  return <main className="mx-auto max-w-4xl space-y-8 p-4 sm:p-8"><header><h1 className="text-2xl font-semibold">Customer lifecycle email previews</h1><p className="mt-2 text-sm text-slate-600">Synthetic, non-sending transactional template gallery.</p></header>{CUSTOMER_LIFECYCLE_PREVIEWS.map(mail=><section key={mail.type} aria-labelledby={`preview-${mail.type}`}><h2 id={`preview-${mail.type}`} className="mb-2 font-semibold">{mail.type}: {mail.subject}</h2><iframe title={`${mail.type} email preview`} className="h-[760px] w-full rounded border bg-white" srcDoc={mail.html}/></section>)}</main>;
}
