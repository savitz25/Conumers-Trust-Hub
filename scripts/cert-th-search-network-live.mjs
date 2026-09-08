const routes = [
  ['contractor','https://www.contractortrusthub.com/','https://www.contractortrusthub.com/ask?q=CCC1332036'],
  ['move','https://www.movetrusthub.com/','https://www.movetrusthub.com/ask?q=USDOT%203244649'],
  ['lender','https://www.lendertrusthub.com/','https://www.lendertrusthub.com/ask?q=NMLS%203030'],
  ['senior','https://www.seniortrusthub.com/','https://www.seniortrusthub.com/ask?q=CMS%20CCN%20105502'],
  ['insurance','https://www.insurancetrusthub.com/','https://www.insurancetrusthub.com/ask?q=NPN%2010391484'],
  ['investor','https://www.investortrusthub.com/','https://www.investortrusthub.com/ask?q=CRD%20105958'],
];

const fetchText = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'TrustHub-Network-Cert/1.0' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};

for (const [hub, home, ask] of routes) {
  const [homeHtml, askHtml] = await Promise.all([fetchText(home), fetchText(ask)]);
  if (!/What do you want to find out\?/i.test(homeHtml)) throw new Error(`${hub}: homepage specialist shell missing`);
  if (!/Advanced filters/i.test(homeHtml)) throw new Error(`${hub}: homepage advanced filters missing`);
  if (!/noindex,\s*follow/i.test(askHtml)) throw new Error(`${hub}: /ask noindex,follow missing`);
  if (!/interpreted your question/i.test(askHtml)) throw new Error(`${hub}: visible interpretation missing`);
  console.log(`${hub}: live HTTP contract PASS`);
}
