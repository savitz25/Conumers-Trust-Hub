import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const base=(process.env.ASK_INTEL_VERIFY_BASE_URL||process.argv[2]||'https://www.asktrusthub.com').replace(/\/$/,'');
const runConcierge=process.env.ASK_INTEL_VERIFY_CONCIERGE==='1';
const samples=Math.max(1,Math.min(50,Number(process.env.ASK_INTEL_VERIFY_SAMPLES||20)));
const checks=[];const timings={askHtml:[],guided:[],concierge:[]};
const add=(id,pass,detail,hard=true)=>checks.push({id,pass,detail,hard});
const percentile=(values,p)=>{const rows=[...values].sort((a,b)=>a-b);return rows[Math.min(rows.length-1,Math.ceil(rows.length*p)-1)]??0};
const distribution=values=>({count:values.length,median:percentile(values,.5),p75:percentile(values,.75),p90:percentile(values,.9),p95:percentile(values,.95),max:Math.max(0,...values)});
async function timedFetch(url,init){const started=performance.now();const response=await fetch(url,init);return {response,ms:+(performance.now()-started).toFixed(1)}}

const ssr=[
 ['tampa','mover in tampa bay florida',['MoveTrustHub','Tampa Bay','detail before I search']],
 ['broward','licensed roofer in Fort Lauderdale Florida',['ContractorTrustHub','Fort Lauderdale','Broward County']],
 ['investor','registered investment advisers in West Palm Beach Florida',['InvestorTrustHub','West Palm Beach']],
 ['loan-estimate','What should I look for on a Loan Estimate besides the rate?',['LenderTrustHub','Analyze your Loan Estimate']],
 ['missing-adviser','Is this financial advisor registered with the SEC?',['InvestorTrustHub','identity needed']],
 ['senior','nursing homes in Boca Raton Florida',['SeniorTrustHub','Boca Raton']],
 ['journey',"I'm buying a home in Broward County and need to research my lender, insurance and contractor.",['Your research path','LenderTrustHub','InsuranceTrustHub','ContractorTrustHub']],
];
for(const [id,query,needles] of ssr){try{const {response,ms}=await timedFetch(`${base}/ask?q=${encodeURIComponent(query)}`,{redirect:'manual'});const html=await response.text();timings.askHtml.push(ms);add(`ssr.${id}`,response.ok&&needles.every(value=>html.includes(value)),`HTTP ${response.status}; ${ms} ms; missing: ${needles.filter(value=>!html.includes(value)).join(', ')||'none'}`)}catch(error){add(`ssr.${id}`,false,String(error))}}
for(let i=0;i<samples;i++){try{const {response,ms}=await timedFetch(`${base}/ask?q=${encodeURIComponent('mover in tampa bay florida')}`);await response.arrayBuffer();timings.askHtml.push(ms);add(`latency.ask.${i+1}`,response.ok,`${ms} ms`,false)}catch(error){add(`latency.ask.${i+1}`,false,String(error),false)}}
try{const {response}=await timedFetch(`${base}/search?q=${encodeURIComponent('mover in tampa bay florida')}`,{redirect:'manual'});add('search.redirect',[301,302,307,308].includes(response.status)&&new URL(response.headers.get('location'),base).pathname==='/ask',`HTTP ${response.status}; location=${response.headers.get('location')}`)}catch(error){add('search.redirect',false,String(error))}

for(const [id,question,expectCalls] of [['guided.tampa','mover in tampa bay florida',0],['guided.usdot','USDOT 125563',1]]){try{const {response,ms}=await timedFetch(`${base}/api/guided-research`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:{type:'START',question}})});const body=await response.json();timings.guided.push(ms);add(id,response.ok&&body?.diagnostics?.specialistCalls===expectCalls&&Boolean(response.headers.get('server-timing')),`HTTP ${response.status}; calls=${body?.diagnostics?.specialistCalls}; state=${body?.diagnostics?.resultState}; ${ms} ms`)}catch(error){add(id,false,String(error))}}

if(runConcierge){const questions=['How do I check if a moving company is licensed?','What should I look for on a Loan Estimate besides the rate?','How do I verify an insurance agent is real?','What do CMS star ratings actually mean?','Does Current mean good standing?','What should I read on Form ADV?','Is my lender NMLS number valid?','Is this home health agency Medicare certified?','Is this financial advisor registered with the SEC?','Show roofing contractors in Broward County Florida','mover in Tampa Bay Florida','Agency vs insurance company?'];for(const [index,question] of questions.entries()){try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);const {response,ms}=await timedFetch(`${base}/api/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:question}]}),signal:controller.signal});clearTimeout(timer);const body=await response.json();timings.concierge.push(ms);const urls=[...(body?.route?.destinations??[]).map(row=>row.href),body?.route?.researchHref].filter(Boolean);const allowed=urls.every(url=>url.startsWith('/')||/^https:\/\/(?:www\.)?(?:ask|move|lender|insurance|contractor|senior|investor)trusthub\.com\b|^https:\/\/(?:www\.)?(?:fmcsa\.dot\.gov|nmlsconsumeraccess\.org|medicare\.gov|adviserinfo\.sec\.gov|content\.naic\.org)\b/.test(url));add(`concierge.${index+1}`,response.ok&&Boolean(body?.message?.content)&&allowed,`HTTP ${response.status}; hub=${body?.route?.hub}; ${ms} ms`)}catch(error){add(`concierge.${index+1}`,false,String(error),false)}}}

const hardFailures=checks.filter(row=>row.hard&&!row.pass);const report={schemaVersion:'ask-intel-v3-production-report-v1',baseUrl:base,createdAt:new Date().toISOString(),conciergeEnabled:runConcierge,checks,summary:{passed:checks.filter(row=>row.pass).length,failed:checks.filter(row=>!row.pass).length,hardFailures:hardFailures.length},latency:{askHtml:distribution(timings.askHtml),guided:distribution(timings.guided),concierge:distribution(timings.concierge)}};
const artifact=resolve('artifacts','ask-intel-v3-production-report.json');await mkdir(resolve('artifacts'),{recursive:true});await writeFile(artifact,JSON.stringify(report,null,2));
console.log(`Ask Intel V3 verification: ${report.summary.passed}/${checks.length} checks passed; ${hardFailures.length} hard failures`);console.log(JSON.stringify(report.latency,null,2));for(const row of checks.filter(row=>!row.pass))console.error(`${row.hard?'HARD FAIL':'OBSERVATION'} ${row.id}: ${row.detail}`);console.log(`Report: ${artifact}`);if(hardFailures.length)process.exitCode=1;
