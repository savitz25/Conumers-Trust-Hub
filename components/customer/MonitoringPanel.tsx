'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type Subscription={enabled:boolean;email_enabled:boolean;in_app_enabled:boolean;baseline_at:string|null;version:number};
type Notice={id:string;title:string;summary:string;read_at:string|null;created_at:string;change_type:string;source_system:string;source_record_id:string;prior_state:unknown;current_state:unknown;source_effective_at:string|null;detected_at:string};

export function MonitoringPanel({profileId,canEdit,initial,notifications}:{profileId:string;canEdit:boolean;initial:Subscription;notifications:Notice[]}){
  const router=useRouter();
  const [enabled,setEnabled]=useState(initial.enabled),[email,setEmail]=useState(initial.email_enabled),[inApp,setInApp]=useState(initial.in_app_enabled),[version,setVersion]=useState(initial.version),[status,setStatus]=useState('');
  useEffect(()=>trackEvent(ANALYTICS_EVENTS.MONITORING_SETTINGS_VIEW,{hub:'contractor',profile_id:profileId}),[profileId]);
  async function save(){setStatus('Saving...');const response=await fetch(`/api/customer/manage/${profileId}/monitoring`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({enabled,emailEnabled:email,inAppEnabled:inApp,version})});const result=await response.json();if(!response.ok){setStatus(`Could not save: ${result.error||'unavailable'}`);return;}setVersion(result.version);setStatus('Monitoring preferences saved.');trackEvent(enabled?ANALYTICS_EVENTS.MONITORING_ENABLED:ANALYTICS_EVENTS.MONITORING_DISABLED,{hub:'contractor',profile_id:profileId});router.refresh();}
  async function read(id:string){const response=await fetch(`/api/customer/manage/${profileId}/notifications/${id}`,{method:'POST'});if(response.ok){trackEvent(ANALYTICS_EVENTS.REGULATORY_ALERT_OPENED,{hub:'contractor',profile_id:profileId});router.refresh();}}
  return <section className="card-surface space-y-5 p-5" id="monitoring-alerts">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo">Private account monitoring</p><h2 className="mt-1 text-xl font-semibold text-navy">Monitoring &amp; alerts</h2><p className="mt-1 text-sm text-muted-foreground">Get notified when AskTrustHub detects a material change in public regulatory information connected to this profile. Detection follows the source refresh schedule and is not real time.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Toggle label="Monitoring" checked={enabled} disabled={!canEdit} onChange={setEnabled}/><Toggle label="Email alerts" checked={email} disabled={!canEdit||!enabled} onChange={setEmail}/><Toggle label="In-app alerts" checked={inApp} disabled={!canEdit||!enabled} onChange={setInApp}/>
    </div>
    {canEdit?<button type="button" onClick={save} disabled={enabled&&!email&&!inApp} className="min-h-11 rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Save monitoring preferences</button>:<p className="text-sm text-muted-foreground">Your role can view monitoring but cannot change these settings.</p>}
    <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
    <div><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-navy">Recent alerts</h3><Link href="/manage/notifications" className="text-sm underline">All notifications</Link></div>{notifications.length===0?<p className="mt-2 text-sm text-muted-foreground">No regulatory change alerts for this profile.</p>:<ul className="mt-3 space-y-3">{notifications.slice(0,5).map(n=><li key={n.id} className={`rounded-lg border p-4 text-sm ${n.read_at?'border-border':'border-indigo/40 bg-indigo/5'}`}><p className="font-medium">{n.title}</p><p className="mt-1 text-muted-foreground">{n.summary}</p><p className="mt-2 text-xs text-muted-foreground">Source: {n.source_system==='fl_dbpr'?'Florida DBPR':n.source_system} &middot; Detected {new Date(n.detected_at).toLocaleDateString('en-US')}</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={()=>read(n.id)} className="min-h-11 rounded border border-border px-3">{n.read_at?'Mark viewed':'Mark read'}</button><Link className="inline-flex min-h-11 items-center underline" href={`/manage/${profileId}#record-issues`}>Report a record issue</Link><Link className="inline-flex min-h-11 items-center underline" href={`/manage/${profileId}#business-responses`}>Add a business response</Link></div></li>)}</ul>}</div>
  </section>;
}

function Toggle({label,checked,disabled,onChange}:{label:string;checked:boolean;disabled:boolean;onChange:(v:boolean)=>void}){return <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 text-sm font-medium"><span>{label}</span><input type="checkbox" className="h-5 w-5" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)}/></label>}
