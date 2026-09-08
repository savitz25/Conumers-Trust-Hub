import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createPageMetadata } from '@/lib/seo/metadata';
import { PUBLIC_CLAIM_CONTRACT } from '@/lib/customer/public-claim-contract';

export const metadata = createPageMetadata({ title: 'What Claiming a Business Profile Means', description: 'What business profile claiming does, what it does not do, and how Trust Hub keeps public evidence independent.', path: '/claim/what-claiming-means' });

export default function WhatClaimingMeansPage() {
  return <><PageHeader label="Business participation" title="What claiming a profile means" description={PUBLIC_CLAIM_CONTRACT.claimedMeaning} /><main className="container-page py-14 sm:py-16"><div className="prose-trust">
    <p><strong>Claiming is free.</strong> Business-management features are rolling out in phases, and capabilities vary by Trust Hub and source availability.</p>
    <h2>What claiming lets an authorized representative do</h2><ul><li>Manage supported business-supplied information.</li><li>Submit correction requests and eligible business responses.</li><li>Manage team access.</li><li>Use monitoring where supported.</li></ul>
    <h2>What claiming does not do</h2><ul><li>Change regulator records or remove accurate public evidence.</li><li>Improve rankings or change Trust Hub research ordering.</li><li>Certify good standing, quality, or safety.</li><li>Create a recommendation or endorsement.</li><li>Guarantee monitoring or publication of every supplied field.</li></ul>
    <h2>How authority is reviewed</h2><p>{PUBLIC_CLAIM_CONTRACT.authoritySummary}</p>
    <h2>Business information, corrections, and responses</h2><p>{PUBLIC_CLAIM_CONTRACT.businessSuppliedMeaning}</p><p>{PUBLIC_CLAIM_CONTRACT.correctionMeaning}</p><p>{PUBLIC_CLAIM_CONTRACT.businessResponseMeaning}</p>
    <h2>Free participation and paid tools</h2><p>Claiming, reporting an inaccuracy, submitting an eligible response, and maintaining supported basic business information do not require buying ranking or placement.</p><p>{PUBLIC_CLAIM_CONTRACT.paidIndependenceMeaning}</p><p><strong>We cite. You decide.</strong></p>
  </div><div className="mt-10 flex flex-wrap gap-3"><Link className="btn-primary" href="/ask">Find a business profile</Link><Link className="btn-secondary" href="/corrections">Report an inaccuracy</Link><Link className="btn-secondary" href="/claim/help">Claim help</Link></div></main></>;
}
