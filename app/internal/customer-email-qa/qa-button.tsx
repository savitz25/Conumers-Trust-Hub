'use client';
import { useState } from 'react';

export default function CustomerEmailQaButton(){const [result,setResult]=useState('');const [busy,setBusy]=useState(false);return <div><button className="btn-primary" disabled={busy} onClick={async()=>{setBusy(true);setResult('');try{const response=await fetch('/api/internal/customer-email-qa',{method:'POST',headers:{'Content-Type':'application/json'}});const body=await response.json();setResult(response.ok?`Attempted ${body.attempted}; sent ${body.sent}; suppressed ${body.suppressed}; failed ${body.failed}.`:'QA action unavailable.')}finally{setBusy(false)}}}>Send five lifecycle QA emails</button><p className="mt-3 text-sm" role="status">{result}</p></div>}
