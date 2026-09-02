'use client';

import { useState } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

type Hour = { weekday: number; closed: boolean; opensAt?: string; closesAt?: string };
type Freshness = { state: 'CURRENT' | 'RECONFIRM_SOON' | 'STALE'; lastConfirmedAt: string; label: string; mayBeOutdated: boolean };
type Props = {
  profileId: string;
  hubId?: string;
  initial: {
    version: number;
    fields: Record<string, string>;
    services: string[];
    serviceAreas: string[];
    languages: string[];
    hours: Hour[];
    freshness: Freshness | null;
  };
  canEdit: boolean;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const splitList = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);

export function BusinessProfileEditor({ profileId, hubId = 'contractor', initial, canEdit }: Props) {
  const [version, setVersion] = useState(initial.version);
  const [fields, setFields] = useState(initial.fields);
  const [services, setServices] = useState(initial.services.join(', '));
  const [serviceAreas, setServiceAreas] = useState(initial.serviceAreas.join(', '));
  const [languages, setLanguages] = useState(initial.languages.join(', '));
  const [hours, setHours] = useState<Hour[]>(initial.hours);
  const [status, setStatus] = useState('');
  const [freshness, setFreshness] = useState(initial.freshness);
  const [started, setStarted] = useState(false);

  function begin() {
    if (started) return;
    setStarted(true);
    trackEvent(ANALYTICS_EVENTS.BUSINESS_INFO_EDIT_STARTED, { hub: hubId, profile_id: profileId });
  }
  function field(key: string, value: string) { begin(); setFields((old) => ({ ...old, [key]: value })); }
  function hourFor(day: number): Hour { return hours.find((h) => h.weekday === day) ?? { weekday: day, closed: true }; }
  function setHour(day: number, update: Partial<Hour>) {
    begin();
    const next = { ...hourFor(day), ...update, weekday: day };
    setHours((old) => [...old.filter((h) => h.weekday !== day), next].sort((a, b) => a.weekday - b.weekday));
  }
  async function save() {
    setStatus('Saving…');
    const response = await fetch(`/api/customer/manage/${encodeURIComponent(profileId)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version, fields, services: splitList(services), serviceAreas: splitList(serviceAreas), languages: splitList(languages), hours }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(response.status === 409 ? 'This profile changed in another session. Reload before saving.' : 'Please review the information and try again.');
      trackEvent(ANALYTICS_EVENTS.BUSINESS_INFO_VALIDATION_FAILED, { hub: hubId, profile_id: profileId, reason: String(result.error || response.status) });
      return;
    }
    setVersion(result.version);
    setFreshness(result.freshness);
    setStatus('Saved. Your update is recorded as information provided by the business.');
    trackEvent(ANALYTICS_EVENTS.BUSINESS_INFO_SAVED, { hub: hubId, profile_id: profileId });
  }
  async function reconfirm() {
    setStatus('Reconfirming...');
    const response = await fetch(`/api/customer/manage/${encodeURIComponent(profileId)}/reconfirm`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(response.status === 409 ? 'This profile changed in another session. Reload before reconfirming.' : 'Reconfirmation could not be recorded.');
      return;
    }
    setVersion(result.version);
    setFreshness(result.freshness);
    setStatus('Confirmed. The information is still accurate.');
    trackEvent(ANALYTICS_EVENTS.BUSINESS_INFO_RECONFIRMED, { hub: hubId, profile_id: profileId });
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-navy disabled:bg-slate-50';
  return <section className="card-surface space-y-5 p-5" onFocus={begin}>
    <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo">Information you provide</p>
      <h2 className="mt-1 text-xl font-semibold text-navy">Business information</h2>
      <p className="mt-1 text-sm text-muted-foreground">This is separate from government records. It does not change license, status, discipline, or TrustHub analysis.</p></div>
    <label className="block text-sm font-medium">About<textarea className={inputClass} rows={5} maxLength={2000} disabled={!canEdit} value={fields.description || ''} onChange={(e) => field('description', e.target.value)} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Website<input className={inputClass} type="url" maxLength={300} placeholder="https://example.com" disabled={!canEdit} value={fields.website || ''} onChange={(e) => field('website', e.target.value)} /></label>
      <label className="text-sm font-medium">Public phone<input className={inputClass} type="tel" maxLength={40} disabled={!canEdit} value={fields.public_phone || ''} onChange={(e) => field('public_phone', e.target.value)} /></label>
      <label className="text-sm font-medium">Public email<input className={inputClass} type="email" maxLength={254} disabled={!canEdit} value={fields.public_email || ''} onChange={(e) => field('public_email', e.target.value)} /></label>
      <label className="text-sm font-medium">Founded year<input className={inputClass} inputMode="numeric" maxLength={4} disabled={!canEdit} value={fields.founded_year || ''} onChange={(e) => field('founded_year', e.target.value)} /></label>
      <label className="text-sm font-medium">Emergency service<select className={inputClass} disabled={!canEdit} value={fields.emergency_service || ''} onChange={(e) => field('emergency_service', e.target.value)}><option value="">Not specified</option><option value="true">Available</option><option value="false">Not available</option></select></label>
      <label className="text-sm font-medium">Contact context<input className={inputClass} maxLength={500} placeholder="Best way or time to reach the business" disabled={!canEdit} value={fields.contact_context || ''} onChange={(e) => field('contact_context', e.target.value)} /></label>
    </div>
    <label className="block text-sm font-medium">Services / specialties<input className={inputClass} maxLength={2500} placeholder="Roofing, remodeling (comma separated)" disabled={!canEdit} value={services} onChange={(e) => { begin(); setServices(e.target.value); }} /></label>
    <label className="block text-sm font-medium">Service areas<input className={inputClass} maxLength={2500} placeholder="Orange County, Orlando (comma separated)" disabled={!canEdit} value={serviceAreas} onChange={(e) => { begin(); setServiceAreas(e.target.value); }} /></label>
    <label className="block text-sm font-medium">Languages<input className={inputClass} maxLength={2500} placeholder="English, Spanish (comma separated)" disabled={!canEdit} value={languages} onChange={(e) => { begin(); setLanguages(e.target.value); }} /></label>
    <fieldset><legend className="text-sm font-medium">Business hours</legend><div className="mt-2 space-y-2">
      {DAYS.map((name, day) => { const h = hourFor(day); return <div key={name} className="grid grid-cols-2 items-center gap-2 text-sm sm:grid-cols-[6rem_5rem_1fr_1fr]"><span>{name}</span><label><input type="checkbox" disabled={!canEdit} checked={h.closed} onChange={(e) => setHour(day, { closed: e.target.checked, opensAt: e.target.checked ? undefined : '09:00', closesAt: e.target.checked ? undefined : '17:00' })} /> Closed</label><input className="min-w-0 rounded border border-border px-2 py-1" aria-label={`${name} opens`} type="time" disabled={!canEdit || h.closed} value={h.opensAt || ''} onChange={(e) => setHour(day, { opensAt: e.target.value })} /><input className="min-w-0 rounded border border-border px-2 py-1" aria-label={`${name} closes`} type="time" disabled={!canEdit || h.closed} value={h.closesAt || ''} onChange={(e) => setHour(day, { closesAt: e.target.value })} /></div>; })}
    </div></fieldset>
    {freshness ? <p className="text-sm text-muted-foreground"><strong>Last confirmed by business:</strong> {new Date(freshness.lastConfirmedAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}. {freshness.mayBeOutdated ? 'Confirm this information is still current.' : freshness.label}</p> : null}
    {canEdit ? <div className="flex flex-wrap gap-3"><button type="button" onClick={save} className="min-h-11 rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white">Save business information</button>{freshness ? <button type="button" onClick={reconfirm} className="min-h-11 rounded-lg border border-navy px-5 py-2 text-sm font-semibold text-navy">Confirm information is still accurate</button> : null}</div> : <p className="text-sm text-muted-foreground">Your membership role can view this information but cannot edit it.</p>}
    <p aria-live="polite" className="text-sm text-muted-foreground">{status}</p>
  </section>;
}
