'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { ANALYTICS_EVENTS, type AnalyticsEventName } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type SafeDimensions = { hub?: string; profile_class?: string; attention_type?: string; action_type?: string; managed_profile_count_bucket?: string; organization_count_bucket?: string };

export function MyTrustHubAnalytics({ managedProfileCountBucket, organizationCountBucket }: { managedProfileCountBucket:string; organizationCountBucket:string }) {
  useEffect(()=>trackEvent(ANALYTICS_EVENTS.MY_TRUST_HUB_VIEWED,{managed_profile_count_bucket:managedProfileCountBucket,organization_count_bucket:organizationCountBucket}),[managedProfileCountBucket,organizationCountBucket]);
  return null;
}

export function MyTrustHubLink({href,event,dimensions,className,children}:{href:string;event:AnalyticsEventName;dimensions?:SafeDimensions;className?:string;children:ReactNode}) {
  const click=()=>trackEvent(event,dimensions);
  return href.startsWith('http')?<a href={href} className={className} onClick={click}>{children}</a>:<Link href={href} className={className} onClick={click}>{children}</Link>;
}
