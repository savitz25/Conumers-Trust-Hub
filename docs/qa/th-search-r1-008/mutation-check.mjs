import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const tests='lib/network/th-search-r1-008.test.ts';
const mutations=[
 {id:'execute-despite-clarification',file:'lib/network/ask-plan.ts',from:'const permission=decideAskExecution(query);',to:"const permission={...decideAskExecution(query),executionAllowed:true,allowedHubs:['insurance','move','lender','contractor']};",pattern:'blocked legacy execution'},
 {id:'drop-city-on-choice',file:'lib/guided-research/specialists.ts',from:'type: session.geography.type, value: session.geography.value,',to:"type: 'state', value: session.geography.stateCode,",pattern:'choice retains Austin'},
 {id:'accept-wrong-hub',file:'lib/guided-research/specialists.ts',from:"if (session.hub==='senior'&&payload.hub!=='senior')",to:'if (false)',pattern:'rejects wrong hub'},
];
const results=[];
for(const m of mutations){const original=readFileSync(m.file,'utf8');if(!original.includes(m.from))throw Error(`Mutation anchor missing: ${m.id}`);try{writeFileSync(m.file,original.replace(m.from,m.to));const r=spawnSync(process.execPath,['--experimental-strip-types','--test',`--test-name-pattern=${m.pattern}`,tests],{encoding:'utf8',timeout:30000});writeFileSync(`docs/qa/th-search-r1-008/mutation-${m.id}.log`,r.stdout+r.stderr);results.push({mutation:m.id,exit:r.status,detected:r.status!==0});}finally{writeFileSync(m.file,original);}}
writeFileSync('docs/qa/th-search-r1-008/mutations.json',JSON.stringify({time:new Date().toISOString(),results,restored:true},null,2));if(results.some(r=>!r.detected))process.exitCode=1;
console.log(results);
