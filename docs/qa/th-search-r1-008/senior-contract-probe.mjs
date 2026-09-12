import fs from 'node:fs';
const observations=[];
for(const [providerClass,city,state] of [['nursing_home','Austin','TX'],['home_health','Houston','TX'],['hospice','Austin','TX']]){
 const body={providerClass,geography:{type:'city',value:city,state},page:1},start=performance.now();
 const response=await fetch('https://www.seniortrusthub.com/api/specialist-execution/v2',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const payload=await response.json();observations.push({request:body,status:response.status,ms:Math.round(performance.now()-start),payload:{...payload,rows:payload.rows?.slice(0,2)}});
}
fs.writeFileSync('docs/qa/th-search-r1-008/senior-contract-reference.json',JSON.stringify({at:new Date().toISOString(),upstreamReference:'1d0e33deb30ac0e7ca07c7b9b4056553c0a8681d',observations},null,2));
console.log(observations.map(o=>({request:o.request,status:o.status,keys:Object.keys(o.payload),row:o.payload.rows?.[0],total:o.payload.total})));
