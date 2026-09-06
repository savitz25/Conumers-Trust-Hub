import { notFound } from 'next/navigation';
import { createPageMetadata } from '@/lib/seo/metadata';
import { readSessionToken, withPlatform } from '@/lib/customer/server';
import CustomerEmailQaButton from './qa-button';

export const dynamic='force-dynamic';
export const metadata=createPageMetadata({title:'Lifecycle email QA',description:'Staff-only synthetic transactional email QA.',path:'/internal/customer-email-qa',noIndex:true});

export default async function CustomerEmailQaPage(){
  if(process.env.VERCEL_ENV!=='production'||process.env.ATH_LIFECYCLE_QA_ENABLED!=='1')notFound();
  const token=await readSessionToken();
  if(!token)notFound();
  try{await withPlatform(p=>p.assertLifecycleQaOperator(token))}catch{notFound()}
  return <main className="mx-auto max-w-xl space-y-5 px-4 py-12"><h1 className="text-2xl font-semibold text-navy">Synthetic lifecycle email QA</h1><p className="text-sm text-muted-foreground">Staff only. Sends five fixed synthetic messages to the server-configured QA mailbox. It accepts no recipient, template, or message content.</p><CustomerEmailQaButton/></main>;
}
