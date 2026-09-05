'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { GuidedAction, GuidedApiResponse, GuidedExecutionResult, GuidedResearchSession } from '@/lib/guided-research/contract';
import { GUIDED_SESSION_VERSION } from '@/lib/guided-research/contract';
import { ASK_BRAND, ASK_SHADOW } from '@/lib/design/ask-design-system';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

const STORAGE_PREFIX='ath-guided-research-v1:';
function storageKey(query:string){let hash=0;for(const char of query)hash=((hash<<5)-hash+char.charCodeAt(0))|0;return `${STORAGE_PREFIX}${Math.abs(hash)}`;}

export function GuidedResearch({query,initialSession,routeDestinationHrefs=[]}:{query:string;initialSession:GuidedResearchSession;routeDestinationHrefs?:string[]}) {
  const [session,setSession]=useState<GuidedResearchSession|null>(initialSession);
  const [result,setResult]=useState<GuidedExecutionResult|null>(null);
  const [busy,setBusy]=useState(initialSession.phase==='EXECUTE');
  const [error,setError]=useState('');
  const [resumeRecovery,setResumeRecovery]=useState(false);
  const [value,setValue]=useState('');
  const headingRef=useRef<HTMLHeadingElement>(null);

  const send=useCallback(async(action:GuidedAction,current?:GuidedResearchSession|null)=>{
    const started=performance.now();if(action.type==='EXECUTE')trackEvent(ANALYTICS_EVENTS.ASK_SPECIALIST_EXECUTION_STARTED,{hub:(current??session)?.hub??'unknown'});
    setBusy(true);setError('');setResumeRecovery(false);
    try{
      const response=await fetch('/api/guided-research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session:current??session,action})});
      const body=await response.json() as GuidedApiResponse&{message?:string};
      if(!response.ok)throw new Error(body.message??'Guided Research could not continue.');
      const missingRestoredResult=action.type==='RESUME'&&Boolean(body.session.lastExecution)&&!body.result;
      setSession(body.session);setResult(body.result??null);
      if(body.result)trackEvent(ANALYTICS_EVENTS.ASK_SPECIALIST_RESULT_RECEIVED,{hub:body.session.hub??'unknown',state:body.result.resultState,duration_ms:Math.round(performance.now()-started)});
      if(missingRestoredResult){setError('The specialist explanation could not be restored. Retry the public-source research.');setResumeRecovery(true);}
      try{sessionStorage.setItem(storageKey(query),JSON.stringify(body.session));}catch{/* Current in-memory research remains usable when tab storage is unavailable. */}
      requestAnimationFrame(()=>headingRef.current?.focus());
    }catch(reason){setError(reason instanceof Error?reason.message:'Guided Research could not continue.');}
    finally{setBusy(false);}
  },[query,session]);

  useEffect(()=>{
    setSession(initialSession);setResult(null);setError('');setResumeRecovery(false);setBusy(initialSession.phase==='EXECUTE');
    let restored:GuidedResearchSession|null=null;
    try{const raw=sessionStorage.getItem(storageKey(query));if(raw){const parsed=JSON.parse(raw) as GuidedResearchSession;if(parsed.version===GUIDED_SESSION_VERSION&&parsed.originalQuestion===query)restored=parsed;}}catch{}
    if(restored)void send({type:'RESUME'},restored);else if(initialSession.phase==='EXECUTE')void send({type:'EXECUTE'},initialSession);
  // session is intentionally excluded: this initializes once per URL query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[query,initialSession]);

  function submit(event:FormEvent){event.preventDefault();if(value.trim()){void send({type:'SET_GEOGRAPHY',value:value.trim()});setValue('');}}
  const question=session?.nextAction??'Understanding your research goal…';
  const progress=session?({CLARIFY:'Choosing the research path',COLLECT:'Adding the information needed',EXECUTE:'Researching public records',REFINE:'Reviewing and narrowing public records',DEEP_LINK:'Continuing detailed research',ERROR_RECOVERY:'Recovering this research request',UNDERSTAND:'Understanding the question'} as const)[session.phase]:'';
  const currentResearch=session?formatResearchLabel(session.providerClass??session.trade??session.moveMode??session.investorFirmClass??session.insuranceEntityClass??session.lenderResearchMode):undefined;
  const specialistName=session?({senior:'SeniorTrustHub',contractor:'ContractorTrustHub',move:'MoveTrustHub',investor:'InvestorTrustHub',insurance:'InsuranceTrustHub',lender:'LenderTrustHub'} as const)[session.hub!]:undefined;
  return <section className="space-y-6 pb-24 sm:pb-6" aria-busy={busy}>
    <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{borderColor:ASK_BRAND.border,boxShadow:ASK_SHADOW.soft}}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{color:ASK_BRAND.indigo}}>Source-backed research</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-5 text-xl font-semibold outline-none sm:text-2xl" style={{color:ASK_BRAND.navy}}>{question}</h2>
      {session?<p className="mt-2 text-sm" style={{color:ASK_BRAND.ink}}>{progress} · Specialist: {specialistName}</p>:null}
      {currentResearch||session?.geography?<p className="mt-1 text-sm" style={{color:ASK_BRAND.ink}}>Current research: {currentResearch??'Credential class not selected'}{session?.geography?` · ${session.geography.value}`:''}</p>:null}
      {session?.executionScope.requestedGeography?<div className="mt-4 rounded-xl border p-3 text-sm" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.ink}}>
        <p><span className="font-semibold" style={{color:ASK_BRAND.navy}}>You asked:</span> {session.executionScope.requestedGeography.display}</p>
        {session.executionScope.executionGeography?<p className="mt-1"><span className="font-semibold" style={{color:ASK_BRAND.navy}}>Research executed:</span> {session.executionScope.executionGeography.display}</p>:<p className="mt-1"><span className="font-semibold" style={{color:ASK_BRAND.navy}}>Available research:</span> This local scope has not been executed.</p>}
        {session.executionScope.disclosure?<p className="mt-1">{session.executionScope.disclosure}</p>:null}
      </div>:null}
      {busy?<p className="mt-4 text-sm" role="status" style={{color:ASK_BRAND.ink}}>Route confirmed — researching {specialistName} public records…</p>:null}
      {error?<p className="mt-4 rounded-xl border p-3 text-sm" role="alert" style={{borderColor:'#b91c1c',color:'#991b1b'}}>{error}</p>:null}
      {resumeRecovery?<button type="button" disabled={busy} onClick={()=>void send({type:'RESUME'})} className="mt-3 min-h-11 rounded-xl border px-4 text-sm font-semibold" style={{borderColor:ASK_BRAND.indigo,color:ASK_BRAND.indigo}}>Retry specialist explanation</button>:null}
      {!busy&&session?.availableChoices.length?<ul className="mt-4 grid gap-3 sm:grid-cols-2">{session.availableChoices.map((choice)=><li key={choice.id}><button type="button" onClick={()=>void send({type:'SELECT_CHOICE',value:choice.value})} className="min-h-12 w-full rounded-xl border p-3 text-left font-semibold focus-visible:outline-none focus-visible:ring-2" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.navy}}>{choice.label}{choice.description?<span className="mt-1 block text-xs font-normal leading-relaxed" style={{color:ASK_BRAND.ink}}>{choice.description}</span>:null}</button></li>)}</ul>:null}
      {!busy&&session&&(session.phase==='COLLECT'||session.nextActions.some(action=>action.type==='ENTER_ENTITY_NAME'||action.type==='ENTER_IDENTIFIER'))?<form onSubmit={submit} className="mt-4">
        <label htmlFor="guided-value" className="block text-sm font-semibold" style={{color:ASK_BRAND.navy}}>{session.missingFields.includes('geography')?'State, county, city or ZIP':session.missingFields.includes('identifier')?identifierPrompt(session):session.missingFields.includes('tradeDescription')?'Short project description':session.researchPlan.intent==='ENTITY_LOOKUP_MISSING_IDENTITY'&&session.hub==='investor'?'Adviser / firm name or CRD':session.researchPlan.intent==='ENTITY_LOOKUP_MISSING_IDENTITY'&&session.hub==='lender'?'NMLS number or lender name':session.researchPlan.intent==='ENTITY_LOOKUP_MISSING_IDENTITY'&&session.hub==='senior'?'Agency name or CMS CCN':session.hub==='investor'?'Firm name':session.hub==='lender'?'Lender name':'Company name'}</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="guided-value" value={value} onChange={event=>setValue(event.target.value)} className="min-h-12 flex-1 rounded-xl border px-4" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.navy}}/><button className="min-h-12 rounded-xl px-5 font-semibold text-white" style={{backgroundColor:ASK_BRAND.indigo}}>Continue</button></div>
        {session.missingFields.includes('geography')&&session.hub==='senior'?<p className="mt-2 text-xs" style={{color:ASK_BRAND.ink}}>You may enter Florida to review statewide records, or narrow by a supported city, county or ZIP.</p>:null}
      </form>:null}
      {!busy&&session?.nextActions.some(action=>action.type==='CONSENT_BROADENING')?<section className="mt-5" aria-label="Next best actions"><h3 className="text-sm font-semibold" style={{color:ASK_BRAND.navy}}>Next best actions</h3><div className="mt-2 flex flex-wrap gap-2">{session.nextActions.filter(action=>action.type==='CONSENT_BROADENING').map(action=><button key={action.id} type="button" onClick={()=>action.value&&void send({type:'SELECT_CHOICE',value:action.value})} className="min-h-11 rounded-xl border px-4 text-sm font-semibold" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.indigo}}>{action.label}</button>)}</div></section>:null}
      {session?<div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!session.history.length||busy} onClick={()=>void send({type:'BACK'})} className="min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.navy}}>Back</button><button type="button" disabled={busy} onClick={()=>void send({type:'RESET'})} className="min-h-11 rounded-xl border px-4 text-sm font-semibold" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.navy}}>Restart research</button></div>:null}
    </div>
    {result&&session?<GuidedResults result={result} session={session} onAction={send} excludedHrefs={routeDestinationHrefs}/>:null}
  </section>;
}

function GuidedResults({result,session,onAction,excludedHrefs}:{result:GuidedExecutionResult;session:GuidedResearchSession;onAction:(action:GuidedAction)=>Promise<void>;excludedHrefs:string[]}){
  const activeFilters=Object.entries(session.selectedFilters);
  return <div className="space-y-6">
    <section aria-live="polite">
      <h2 className="text-2xl font-semibold" style={{color:ASK_BRAND.navy}}>{result.consumerHeading}</h2>
      <p className="mt-2 text-sm leading-relaxed" style={{color:ASK_BRAND.ink}}>{result.consumerMessage}</p>
      {result.total>0?<p className="mt-2 font-semibold tabular-nums" style={{color:ASK_BRAND.navy}}>{result.total.toLocaleString('en-US')} matching public records</p>:null}
    </section>
    {result.rows.length?<ol className="grid gap-4">{result.rows.map((row,index)=><li key={`${row.destination?.href??row.identifier?.value??row.name}-${index}`} className="rounded-2xl border bg-white p-5" style={{borderColor:ASK_BRAND.border,boxShadow:ASK_SHADOW.soft}}>
      <h3 className="text-lg font-semibold" style={{color:ASK_BRAND.navy}}>{row.name}</h3>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {row.identifier?<div><dt className="text-xs uppercase tracking-wide" style={{color:ASK_BRAND.ink}}>{row.identifier.label}</dt><dd className="break-all font-semibold" style={{color:ASK_BRAND.navy}}>{row.identifier.value}</dd></div>:null}
        {row.classLabel?<Fact label="Class / role / trade" value={row.classLabel}/>:null}
        {row.recordedLocation?<Fact label={row.hub==='contractor'?'Recorded address':row.hub==='investor'?'Principal office':row.hub==='insurance'?'Credential jurisdiction':row.hub==='lender'?'HMDA property geography':'Recorded location'} value={row.recordedLocation}/>:null}
        {row.status?<Fact label="Source status" value={row.status}/>:null}
        {row.sourceDate?<Fact label="Source checked" value={row.sourceDate}/>:null}
        {row.facts.map(fact=><Fact key={fact.label} label={fact.label} value={fact.value}/>)}
      </dl>
      <p className="mt-3 text-xs leading-relaxed" style={{color:ASK_BRAND.ink}}><span className="font-semibold">Why shown:</span> {row.whyShown}</p>
      {row.destination?<a href={row.destination.href} className="mt-4 inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline" style={{color:ASK_BRAND.indigo}}>{row.destination.label}</a>:<p className="mt-4 text-xs" style={{color:ASK_BRAND.ink}}>No public destination is available for this row. Verify with the source board where appropriate.</p>}
    </li>)}</ol>:null}
    {result.refinements.some(refinement=>refinement.values.length)?<section className="rounded-2xl border p-5" style={{borderColor:ASK_BRAND.border}}><h2 className="text-lg font-semibold" style={{color:ASK_BRAND.navy}}>What would you like to narrow or examine?</h2>
      {activeFilters.length?<div className="mt-3 rounded-xl border p-3" style={{borderColor:ASK_BRAND.indigo}}><h3 className="text-sm font-semibold" style={{color:ASK_BRAND.navy}}>Active filters</h3><ul className="mt-2 flex flex-wrap gap-2">{activeFilters.map(([field,filterValue])=>{const refinement=result.refinements.find(row=>row.id===field);const item=refinement?.values.find(row=>row.value===filterValue);return <li key={field}><button type="button" onClick={()=>void onAction({type:'CLEAR_FILTER',field})} className="min-h-11 rounded-full border px-3 text-sm font-semibold" style={{borderColor:ASK_BRAND.indigo,color:ASK_BRAND.indigo}} aria-label={`Remove ${refinement?.label??field}: ${item?.label??filterValue}`}>{refinement?.label??field}: {item?.label??filterValue} ×</button></li>})}</ul><button type="button" onClick={()=>void onAction({type:'CLEAR_ALL_FILTERS'})} className="mt-3 min-h-11 text-sm font-semibold underline" style={{color:ASK_BRAND.indigo}}>Clear all refinements</button></div>:null}
      <div className="mt-3 space-y-4">{result.refinements.filter(r=>r.values.length).slice(0,3).map(refinement=><fieldset key={refinement.id}><legend className="text-sm font-semibold" style={{color:ASK_BRAND.navy}}>{refinement.label}</legend>{refinement.meaning?<p className="text-xs" style={{color:ASK_BRAND.ink}}>{refinement.meaning}</p>:null}<div className="mt-2 flex flex-wrap gap-2">{refinement.values.slice(0,8).map(item=>{const selected=session.selectedFilters[refinement.id]===item.value;return <button key={item.value} type="button" aria-pressed={selected} onClick={()=>void onAction({type:'SET_FILTER',field:refinement.id,value:item.value})} className="min-h-11 rounded-full border px-3 text-sm font-semibold" style={{borderColor:selected?ASK_BRAND.indigo:ASK_BRAND.border,backgroundColor:selected?ASK_BRAND.indigo:'#fff',color:selected?'#fff':ASK_BRAND.navy}}>{item.label}</button>})}</div></fieldset>)}</div></section>:null}
    {result.destinations.length&&!result.rows.length?<div className="flex flex-wrap gap-3">{result.destinations.map(destination=><a key={destination.href} href={destination.href} className="inline-flex min-h-11 items-center rounded-xl border px-4 font-semibold" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.indigo}}>{destination.label}</a>)}</div>:null}
    {result.nextActions?.some(action=>action.href&&!excludedHrefs.includes(action.href))?<section className="rounded-2xl border p-5" style={{borderColor:ASK_BRAND.border}}><h2 className="text-lg font-semibold" style={{color:ASK_BRAND.navy}}>Next best actions</h2><div className="mt-3 flex flex-wrap gap-2">{result.nextActions.filter(action=>action.href&&!excludedHrefs.includes(action.href)).map(action=><a key={action.id} href={action.href} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.indigo}}>{action.label}</a>)}</div></section>:null}
    <details className="rounded-2xl border p-5" style={{borderColor:ASK_BRAND.border}}><summary className="flex min-h-11 cursor-pointer items-center font-semibold" style={{color:ASK_BRAND.navy}}>Why these results and where they came from</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{result.interpretation.map(row=><Fact key={row.label} label={row.label} value={row.value}/>)}</dl><ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{color:ASK_BRAND.ink}}>{result.limitations.map(item=><li key={item}>{item}</li>)}</ul><p className="mt-3 text-xs" style={{color:ASK_BRAND.ink}}>Contract: trusthub-specialist-execution-v2 · Specialist latency: {result.latencyMs} ms. Specialist evidence is re-executed; stored client rows are never trusted.</p></details>
  </div>;
}
function Fact({label,value}:{label:string;value:string}){return <div><dt className="text-xs uppercase tracking-wide" style={{color:ASK_BRAND.ink}}>{label}</dt><dd className="font-medium" style={{color:ASK_BRAND.navy}}>{value}</dd></div>}
function formatResearchLabel(value:string|undefined){if(!value)return undefined;const acronyms=new Set(['hvac','hvacr','cms','ccn','usdot','mc','hic','npn','naic','nmls','lei','ria','era','raum','hmda','cfpb']);return value.split('_').map(word=>acronyms.has(word.toLowerCase())?word.toUpperCase():word.charAt(0).toUpperCase()+word.slice(1)).join(' ');}
function identifierPrompt(session:GuidedResearchSession){return session.hub==='investor'?'Organization CRD':session.hub==='insurance'?'NPN or NAIC company code':session.hub==='lender'?'NMLS or LEI':'USDOT or MC number';}
