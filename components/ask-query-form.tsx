'use client';

import {useEffect,useState} from 'react';
import {ASK_BRAND} from '@/lib/design/ask-design-system';
import {ASK_QUESTION_MAX_LENGTH,validateAskQuestion} from '@/lib/network/ask-request';

/** Browser history can restore a form's edited value from before submission. */
export function AskQueryForm({query}:{query:string}){
  const [value,setValue]=useState(query);
  useEffect(()=>{
    setValue(query);
    let frame=0;
    const restore=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const values=new URLSearchParams(window.location.search).getAll('q');
      try{setValue(values.length===1?validateAskQuestion(values[0]):'');}catch{setValue('');}
    });};
    window.addEventListener('pageshow',restore);
    window.addEventListener('popstate',restore);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('pageshow',restore);window.removeEventListener('popstate',restore);};
  },[query]);
  return <form action="/ask" method="get" className="mb-10 max-w-2xl" role="search" aria-label="Ask the TrustHub Network">
    <label htmlFor="ask-q" className="sr-only">What do you want to know?</label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input id="ask-q" name="q" maxLength={ASK_QUESTION_MAX_LENGTH} value={value} onChange={event=>setValue(event.target.value)} placeholder="What do you want to know?" className="min-h-12 min-w-0 flex-1 rounded-xl border px-4" style={{borderColor:ASK_BRAND.border,color:ASK_BRAND.navy}}/>
      <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white" style={{backgroundColor:ASK_BRAND.indigo}}>Ask</button>
    </div>
  </form>;
}
