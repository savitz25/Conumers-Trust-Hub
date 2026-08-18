/**
 * Rankable life-journey pages on Ask Trust Hub.
 * Cross-vertical decision paths only — no directories.
 */

export type JourneyStepContent = {
  step: number;
  title: string;
  hubLabel: string;
  why: string;
  body: string;
  href: string;
  cta: string;
  relatedGuides?: { href: string; label: string }[];
};

export type JourneyPage = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  intro: string[];
  steps: JourneyStepContent[];
  limitations: string[];
  lastReviewed: string;
};

export const JOURNEY_PAGES: JourneyPage[] = [
  {
    slug: 'buying-a-home',
    title: 'Buying a home: financing, coverage, then the move',
    metaTitle: 'Buying a Home Journey — Financing, Insurance & Moving Research',
    metaDescription:
      'A calm cross-hub path for home buyers: research NMLS lenders, then homeowners coverage, then FMCSA movers. Independent research — no paid placements.',
    summary:
      'Home purchase is usually three regulated markets at once. Research them in a sensible order — financing, coverage, then the physical move — on the specialist hubs that own each domain.',
    intro: [
      'Buying a home is not a single product page. It is a sequence of high-stakes decisions: how you finance the purchase, how you insure the property, and how you move your household. Each step sits in a different regulated market with different public records and different failure modes.',
      'People often reverse the order under pressure. They tour homes, then scramble for a lender at the last minute, then bind coverage the week of closing, then hire the first mover who texts back. That sequence maximizes stress and minimizes time for license checks. A calmer path is: financing research first (so you know capacity and process), coverage research early enough that lender requirements are not a surprise, and mover research with written estimates and USDOT checks before deposits.',
      'Ask Trust Hub does not host lender, insurance, or mover directories. This journey explains why order matters and routes you to Lender, Insurance, and Move Trust Hub for deep research — under common ownership, separated research and listing order, and no paid placements.',
      'Independence is not a slogan here. Specialist hubs can surface public licensing context and educational tools; they do not sell ranking position for pay. You still re-check primary sources — NMLS Consumer Access, the relevant state Department of Insurance, and FMCSA public systems — before you sign anything. We cite. You decide.',
    ],
    steps: [
      {
        step: 1,
        title: 'Financing research first',
        hubLabel: 'Lender Trust Hub',
        why: 'Loan terms shape what you can offer, when you close, and how much stress the rest of the transaction carries.',
        body: 'Before you fall in love with a property path, understand how mortgage research works. Public NMLS-oriented identifiers help you match a loan officer or company name to a license record. Educational calculators help you think about payments, down payment trade-offs, and cash-to-close ranges without treating modeled numbers as offers. Lender Trust Hub is the specialist research surface for that work: local lender research paths, educational tools, and NMLS-oriented context under the same network independence rules as Ask.',
        href: 'https://www.lendertrusthub.com/local-lenders',
        cta: 'Research lenders on Lender Trust Hub',
        relatedGuides: [
          { href: '/guides/check-nmls-license', label: 'How to check an NMLS license' },
          {
            href: '/guides/what-nmls-verification-proves',
            label: 'What NMLS verification does and does not prove',
          },
          {
            href: '/guides/loan-officer-vs-broker-vs-banker',
            label: 'Loan officer vs broker vs banker',
          },
        ],
      },
      {
        step: 2,
        title: 'Homeowners coverage research',
        hubLabel: 'Insurance Trust Hub',
        why: 'Lenders and contracts often require coverage; waiting until the last week creates avoidable pressure.',
        body: 'Once financing research is underway, start educational research on homeowners insurance. Many purchase contracts and lenders require evidence of coverage by closing. Waiting until the final days compresses shopping into a single rushed quote, which is when people skip reading deductibles, exclusions, and producer licensing context. Insurance Trust Hub focuses on DOI / license pathways and coverage education — not selling policies or auctioning rankings. Use it to prepare questions, understand captive vs independent distribution language, and then re-check the relevant state Department of Insurance before you bind anything.',
        href: 'https://www.insurancetrusthub.com/directory',
        cta: 'Research homeowners coverage on Insurance Trust Hub',
        relatedGuides: [
          {
            href: '/guides/verify-doi-producer-license',
            label: 'How to verify a DOI / producer license',
          },
          {
            href: '/guides/what-state-doi-records-show',
            label: 'What state DOI records actually show',
          },
          {
            href: '/guides/captive-vs-independent-agents',
            label: 'Captive vs independent agents',
          },
        ],
      },
      {
        step: 3,
        title: 'Plan and verify the move',
        hubLabel: 'Move Trust Hub',
        why: 'Household goods moves are a frequent source of disputes when people skip federal licensing checks.',
        body: 'Closer to closing, research the physical move. Interstate household goods moves often involve federal motor carrier rules and public FMCSA records. Move Trust Hub owns Verify DOT style tools, mover research surfaces, and educational planning utilities. Read estimate types carefully — binding vs non-binding language changes risk. Confirm which legal entity holds the USDOT number and who will physically transport goods. Always re-check USDOT and operating authority context on official FMCSA systems before you pay a deposit. Local-only moves may be governed more by state rules; still demand written terms you understand.',
        href: 'https://www.movetrusthub.com/verify-dot',
        cta: 'Verify movers on Move Trust Hub',
        relatedGuides: [
          { href: '/guides/verify-usdot-number', label: 'How to verify a USDOT / DOT number' },
          { href: '/guides/broker-vs-carrier', label: 'Broker vs carrier (plain language)' },
          {
            href: '/guides/binding-vs-non-binding-estimates',
            label: 'Binding vs non-binding estimates',
          },
        ],
      },
    ],
    limitations: [
      'This is not legal, tax, or financial advice and not a real-estate transaction service.',
      'Ask does not list lenders, agents, or movers — directories live only on specialist hubs.',
      'Public records lag; always re-verify licenses and written offers yourself.',
      'We do not guarantee loan approval, claim outcomes, on-time moves, or pricing.',
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'moving-to-another-state',
    title: 'Moving to another state: research the move, then coverage',
    metaTitle: 'Moving to Another State — Interstate Move & Coverage Research Path',
    metaDescription:
      'Interstate move research path: FMCSA mover verification first, then renters or homeowners coverage research. Independent Trust Hub network — no paid placements.',
    summary:
      'Cross-state moves mix federal mover rules with destination insurance decisions. Start with the move, then coverage for the new place — add financing only if purchase is part of the plan.',
    intro: [
      'An interstate household goods move is not the same problem as finding a local helper with a truck. For many long-distance moves, federal motor carrier rules and public FMCSA records are the right starting point for licensing research. Brand names, stock photos, and “full-service” language do not replace identity checks.',
      'Cross-state moves also force insurance decisions people underestimate. Renters coverage at the destination is different from homeowners coverage on a purchase. Personal property in transit may not be handled the same way as property at rest. Temporary housing adds another gap. Financing research belongs on the critical path only if you are buying — otherwise it is optional context that should not delay mover verification.',
      'This journey keeps Ask on education and routing. Move Trust Hub owns mover research tools and FMCSA-oriented workflows. Insurance Trust Hub owns DOI-oriented research education. Lender Trust Hub owns NMLS-oriented financing research if purchase is involved. Common ownership · Separated research and listing order · No paid placements. We cite. You decide.',
      'Start earlier than you think you need. Written inventories, estimate type clarity, and license re-checks take calendar days — not an afternoon between packing boxes.',
    ],
    steps: [
      {
        step: 1,
        title: 'Research interstate movers with public licensing context',
        hubLabel: 'Move Trust Hub',
        why: 'Deposits and inventory lists should follow identity and authority checks — not the other way around.',
        body: 'Use Move Trust Hub to research FMCSA-oriented mover identity, compare options as research aids, and run educational volume or planning tools. Demand a USDOT number in writing. Look it up on FMCSA public systems such as SAFER and compare legal or DBA names to the company contacting you. Ask whether you are dealing with a carrier or a broker, and who will actually operate the truck. Read estimates carefully: binding vs non-binding language and inventory assumptions change your risk if weight or access changes. Confirm operating authority context when relevant. Prefer written terms you can re-read the next morning before you pay a deposit.',
        href: 'https://www.movetrusthub.com/companies',
        cta: 'Browse mover research on Move Trust Hub',
        relatedGuides: [
          { href: '/guides/verify-usdot-number', label: 'How to verify a USDOT / DOT number' },
          {
            href: '/guides/operating-authority-explained',
            label: 'What operating authority means',
          },
          {
            href: '/guides/binding-vs-non-binding-estimates',
            label: 'Binding vs non-binding estimates',
          },
          { href: '/guides/broker-vs-carrier', label: 'Broker vs carrier' },
        ],
      },
      {
        step: 2,
        title: 'Research coverage for the destination',
        hubLabel: 'Insurance Trust Hub',
        why: 'Renters and homeowners needs change with address, occupancy, and lender requirements.',
        body: 'After the move is scoped, open Insurance Trust Hub for educational research on licensed producers and agencies with DOI pathways in mind. It is not a quote marketplace and does not sell ranking position. Use it to prepare questions about renters vs homeowners forms, effective dates around move-in, and how personal property is described. Re-check the state Department of Insurance for the destination state before you rely on advice or bind coverage. If you are buying at the destination, coordinate coverage timing with your financing path so lender requirements are not a last-day scramble.',
        href: 'https://www.insurancetrusthub.com/directory',
        cta: 'Research coverage on Insurance Trust Hub',
        relatedGuides: [
          {
            href: '/guides/verify-doi-producer-license',
            label: 'How to verify a DOI / producer license',
          },
          {
            href: '/guides/captive-vs-independent-agents',
            label: 'Captive vs independent agents',
          },
          {
            href: '/guides/what-state-doi-records-show',
            label: 'What state DOI records show',
          },
        ],
      },
      {
        step: 3,
        title: 'Optional: financing if purchase is involved',
        hubLabel: 'Lender Trust Hub',
        why: 'If the interstate move is tied to buying, financing research should not be an afterthought.',
        body: 'When the move is part of a purchase, use Lender Trust Hub for NMLS-oriented lender research and educational calculators. Match loan officers and companies on NMLS Consumer Access. Understand that license checks do not prove pricing quality or approval. If you are only renting at the destination, you can skip this step without breaking the journey — do not force financing research into a pure rent-and-relocate plan.',
        href: 'https://www.lendertrusthub.com/local-lenders',
        cta: 'Optional: research lenders on Lender Trust Hub',
        relatedGuides: [
          { href: '/guides/check-nmls-license', label: 'How to check an NMLS license' },
          {
            href: '/guides/what-nmls-verification-proves',
            label: 'What NMLS verification proves',
          },
        ],
      },
    ],
    limitations: [
      'Not a moving broker, booking engine, or inventory service.',
      'State-to-state insurance rules differ; this page does not replace DOI guidance.',
      'Local-only moves may be governed by state rules more than interstate FMCSA authority.',
      'Ask does not host mover or insurance directories; those remain on specialist hubs.',
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'relocating-for-work',
    title: 'Relocating for work: timeline, move research, coverage, optional financing',
    metaTitle: 'Relocating for Work — Research Path for Move, Coverage & Financing',
    metaDescription:
      'Work relocation research order: employer timeline, FMCSA mover checks, destination coverage, optional NMLS lender research. Independent Trust Hub network.',
    summary:
      'Job-driven moves compress timelines. Protect yourself with a simple order: clarify employer constraints, research movers with public licensing context, set up destination coverage research, and only then open financing research if purchase is on the table.',
    intro: [
      'Relocation for work often means a fixed start date, temporary housing, and pressure to “just book someone.” That pressure is exactly when people skip USDOT checks, accept vague estimates, or bind coverage without understanding producer licensing records. Employer relocation packages can help with cost — they do not replace independent identity research.',
      'Treat the employer timeline as a constraint, not a reason to abandon primary sources. Map blackout dates, temporary housing windows, and who pays for what in writing. Then run the same verification habits you would use for any high-stakes consumer decision: match legal entities, re-check licenses, and prefer documents you can re-read when you are not exhausted.',
      'This journey keeps Ask on the educational path: why each step matters, which specialist hub owns the tools, and which primary sources you should re-check yourself. Common ownership · Separated research and listing order · No paid placements. We cite. You decide.',
      'If your company offers preferred vendors, still verify. Preferred lists reduce logistics friction; they are not a substitute for FMCSA or DOI checks, and they are not an endorsement from Ask Trust Hub.',
      'Build a simple folder as you go: employer policy excerpts, written estimates, USDOT snapshot captures, producer license numbers, and any temporary housing agreements. That packet is what you re-check when timelines tighten — not a set of marketing PDFs from sales calls.',
    ],
    steps: [
      {
        step: 1,
        title: 'Map constraints, then research movers',
        hubLabel: 'Move Trust Hub',
        why: 'Employer relocation packages, blackout dates, and temporary housing change what “good” looks like — but they do not replace licensing checks.',
        body: 'Start by writing down hard dates: last day in the old home, first day on site, temporary housing end date, and any employer deposit or reimbursement rules. Then open Move Trust Hub for FMCSA-oriented mover research, educational planning tools, and estimate literacy. Understand broker vs carrier roles so marketing language does not obscure who holds authority. If your employer offers preferred vendors, still verify USDOT numbers and operating authority context on official systems. Prefer written estimates that state inventory assumptions and estimate type. Do not pay large deposits to companies that cannot or will not provide checkable identifiers. If reimbursement depends on receipts, confirm what documentation your employer requires before you choose payment methods that create disputes later.',
        href: 'https://www.movetrusthub.com/moving-calculator',
        cta: 'Start a free Move Plan research path',
        relatedGuides: [
          { href: '/guides/broker-vs-carrier', label: 'Broker vs carrier' },
          { href: '/guides/verify-usdot-number', label: 'Verify a USDOT number' },
          {
            href: '/guides/operating-authority-explained',
            label: 'Operating authority explained',
          },
          {
            href: '/guides/binding-vs-non-binding-estimates',
            label: 'Binding vs non-binding estimates',
          },
        ],
      },
      {
        step: 2,
        title: 'Destination coverage research',
        hubLabel: 'Insurance Trust Hub',
        why: 'New address, temporary housing, and personal property in transit create coverage gaps people discover too late.',
        body: 'Use Insurance Trust Hub for educational research on licensed agencies and DOI context. Ask whether renters, HO-4, or homeowners forms apply during transition periods. Clarify when coverage starts at the new address and how personal property is treated while in transit or in storage. Confirm any producer on the official state Department of Insurance site for the relevant state before you rely on advice. Insurance Trust Hub is not a policy marketplace and does not sell rankings; it is research infrastructure under the same independence thesis as Ask.',
        href: 'https://www.insurancetrusthub.com/',
        cta: 'Open Insurance Trust Hub research tools',
        relatedGuides: [
          {
            href: '/guides/what-state-doi-records-show',
            label: 'What state DOI records show',
          },
          {
            href: '/guides/verify-doi-producer-license',
            label: 'How to verify a producer license',
          },
          {
            href: '/guides/captive-vs-independent-agents',
            label: 'Captive vs independent agents',
          },
        ],
      },
      {
        step: 3,
        title: 'Optional purchase financing research',
        hubLabel: 'Lender Trust Hub',
        why: 'Some relocations include buying immediately; others rent first. Do not force financing research if you are not purchasing.',
        body: 'If you will buy at the destination, open Lender Trust Hub for NMLS-oriented research and educational payment tools. Match individuals and companies on NMLS Consumer Access. Understand that verification supports identity and licensing status research — not approval, pricing superiority, or complaint-free history. If you are renting only, skip this step. Mixing optional financing research into a pure rental relocation can slow the moves that matter most: mover identity and destination coverage timing.',
        href: 'https://www.lendertrusthub.com/calculators',
        cta: 'Optional: educational calculators on Lender Trust Hub',
        relatedGuides: [
          {
            href: '/guides/loan-officer-vs-broker-vs-banker',
            label: 'Loan officer vs broker vs banker',
          },
          { href: '/guides/check-nmls-license', label: 'How to check an NMLS license' },
        ],
      },
    ],
    limitations: [
      'Not an employer benefits or HR advisory service.',
      'Corporate relocation vendors still require independent licensing checks.',
      'Ask does not book moves or sell insurance.',
      'Public records lag; re-verify before deposits and before binding coverage.',
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'protecting-what-matters',
    title: 'Protecting what matters: coverage research without a marketplace rush',
    metaTitle: 'Protecting What Matters — Insurance Research Journey',
    metaDescription:
      'Insurance-first research path: DOI/producer context, plain-language agent types, optional financing or move tools when life changes. No paid placements.',
    summary:
      'When the primary goal is protection — home, auto, life stage, or family — start with insurance research education and licensing context. Add financing or move research only when those life events actually apply.',
    intro: [
      '“Protecting what matters” is intentionally broad. It includes homeowners and renters research, auto coverage questions, and life-stage protection planning. What it should not become is a pressure funnel into quotes you do not understand, or a directory of agents ranked for pay on Ask.',
      'Insurance is a regulated market. Producer and agency licensing is primarily state-based. Public DOI records can support identity and status research; they do not grade claim service or guarantee suitability. Captive and independent distribution models use different sales language — neither model replaces a license check.',
      'Insurance Trust Hub is the specialist for DOI-oriented research and educational tools. Ask explains credentials, sets limits, and routes you — it does not sell policies or host an agent directory of its own. Financing and move research appear only as optional branches when a purchase or relocation is actually part of your situation.',
      'We cite. You decide. Re-check the state Department of Insurance and the company itself before you rely on any producer. Common ownership · Separated research and listing order · No paid placements.',
      'A calm protection path looks like this: define what you need to protect (home, renters contents, auto, life stage), verify who is licensed to sell what you are considering, compare written options without treating the first quote as destiny, and only then open financing or move research if a purchase or relocation is actually happening.',
    ],
    steps: [
      {
        step: 1,
        title: 'Start with coverage research and license context',
        hubLabel: 'Insurance Trust Hub',
        why: 'Licensing records and plain-language education reduce the chance you confuse marketing with authority.',
        body: 'Open Insurance Trust Hub to research licensed agencies and producers with public DOI pathways in mind, and to use educational tools. Learn the difference between captive and independent distribution models so sales language is easier to decode. Ask for a license number and home state in writing. Confirm Active status and lines of authority on the official state system. Read what a DOI record typically includes — and what it omits — so a green checkmark does not become false certainty. Prefer written coverage summaries over verbal promises about what is “fully covered.” When comparing quotes, align effective dates, deductibles, and named insureds before you decide on price alone.',
        href: 'https://www.insurancetrusthub.com/directory',
        cta: 'Research licensed agencies on Insurance Trust Hub',
        relatedGuides: [
          {
            href: '/guides/verify-doi-producer-license',
            label: 'How to verify a DOI / producer license',
          },
          {
            href: '/guides/captive-vs-independent-agents',
            label: 'Captive vs independent agents',
          },
          {
            href: '/guides/what-state-doi-records-show',
            label: 'What DOI records show',
          },
        ],
      },
      {
        step: 2,
        title: 'Optional: financing research if you are buying or refinancing',
        hubLabel: 'Lender Trust Hub',
        why: 'Coverage and financing often interact (escrow, requirements), but they are still different regulated markets.',
        body: 'If protection research is happening because you are buying or refinancing, use Lender Trust Hub for NMLS-oriented lender research. Lenders may require certain insurance evidence by closing; that interaction is a timing problem, not a reason to merge markets. Do not treat insurance education as a substitute for financing research — or the reverse. Match loan officers and companies on NMLS Consumer Access, and remember that license checks do not prove best pricing or approval.',
        href: 'https://www.lendertrusthub.com/local-lenders',
        cta: 'Optional: research lenders on Lender Trust Hub',
        relatedGuides: [
          { href: '/guides/check-nmls-license', label: 'How to check an NMLS license' },
          {
            href: '/guides/what-nmls-verification-proves',
            label: 'What NMLS verification proves',
          },
        ],
      },
      {
        step: 3,
        title: 'Optional: move research if protection is part of a relocation',
        hubLabel: 'Move Trust Hub',
        why: 'Property and goods in transit introduce different risks than stationary homeowners coverage.',
        body: 'If you are also relocating, open Move Trust Hub for FMCSA-oriented mover research and educational planning. Household goods valuation options, inventory lists, and carrier identity are separate from the homeowners or renters policy you may bind at the destination. Verify USDOT numbers on official systems before deposits. Pair estimate literacy with identity research so “protection” does not stop at a policy PDF while the truck remains unresearched.',
        href: 'https://www.movetrusthub.com/verify-dot',
        cta: 'Optional: verify movers on Move Trust Hub',
        relatedGuides: [
          { href: '/guides/verify-usdot-number', label: 'How to verify a USDOT number' },
          { href: '/guides/broker-vs-carrier', label: 'Broker vs carrier' },
        ],
      },
    ],
    limitations: [
      'Not insurance advice, not a quote engine, not a fiduciary.',
      'State DOI systems differ; always use the official state tool for final checks.',
      'Ask does not sell policies or rank agents for pay.',
      'Optional financing and move branches apply only when those life events are real.',
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'helping-an-aging-parent',
    title: 'Helping an aging parent: research first, not a placement funnel',
    metaTitle: 'Helping an Aging Parent — Senior Care Research Path',
    metaDescription:
      'Research senior care with government-sourced evidence first. Optional insurance, move, or contractor steps only when that next life decision is real. Not a placement agency.',
    summary:
      'Start on SeniorTrustHub. Add insurance, relocation, or contractor research only when those decisions actually appear — never as referral leads.',
    intro: [
      'Helping an aging parent is a research problem before it is a sales problem. Public CMS records and supported state regulators can help you understand what is published about a facility. They do not tell you what to choose, and they do not replace a visit, a contract review, or counsel when you need it.',
      'Ask Trust Hub routes you. SeniorTrustHub does the deep research. This is not a placement agency, a referral marketplace, or a paid ranking product. We cite. You decide.',
    ],
    steps: [
      {
        step: 1,
        title: 'Research senior care with official evidence',
        hubLabel: 'SeniorTrustHub',
        why: 'Start with government-sourced research, not a lead form.',
        body: 'Open SeniorTrustHub for CMS and supported state regulatory evidence. Missing records are not a clean bill of health. Do not treat a listing as an endorsement or a placement offer.',
        href: 'https://www.seniortrusthub.com',
        cta: 'Research senior care on SeniorTrustHub',
      },
      {
        step: 2,
        title: 'Coverage only if it is part of this decision',
        hubLabel: 'Insurance Trust Hub',
        why: 'Insurance research belongs here only when coverage actually intersects the care decision.',
        body: 'If Medicare, supplemental, or long-term coverage questions are real for this situation, use Insurance Trust Hub for DOI-oriented research education. Skip this step if coverage is not on the table.',
        href: 'https://www.insurancetrusthub.com',
        cta: 'Optional: Insurance Trust Hub',
      },
    ],
    limitations: [
      'Not a placement, referral, or care-management service.',
      'CMS and state records lag and are incomplete.',
      'Ask does not rank facilities or sell leads.',
    ],
    lastReviewed: '2026-08-18',
  },
  {
    slug: 'researching-an-investment-firm',
    title: 'Researching an investment firm: SEC/IARD evidence, not advice',
    metaTitle: 'Researching an Investment Firm — SEC/IARD Path',
    metaDescription:
      'Research an investment firm using SEC/IARD filings on InvestorTrustHub. Not stock recommendations, rankings, or portfolio advice.',
    summary:
      'InvestorTrustHub is the primary hub. This path is firm research from official filings — not personalized financial advice.',
    intro: [
      'If you are trying to understand a firm that files Form ADV, start with official SEC/IARD evidence. InvestorTrustHub organizes that research. It does not pick stocks, rank advisers, or tell you what to buy.',
      'This journey does not include FINRA BrokerCheck people coverage or complete advisor profiles unless those products exist on InvestorTrustHub. They are not claimed here. We cite. You decide.',
    ],
    steps: [
      {
        step: 1,
        title: 'Read the firm’s official filings',
        hubLabel: 'InvestorTrustHub',
        why: 'Identity and registration research comes from IARD / Form ADV — not marketing sites.',
        body: 'Use InvestorTrustHub to research the firm in SEC/IARD records. Source “Approved” is not SEC endorsement. Missing disclosures are not a clean record. Re-check adviserinfo.sec.gov before you rely on any page.',
        href: 'https://www.investortrusthub.com',
        cta: 'Research firms on InvestorTrustHub',
      },
    ],
    limitations: [
      'Not investment, legal, or tax advice.',
      'Does not include complete people/broker research unless separately published.',
      'Ask does not recommend firms or products.',
    ],
    lastReviewed: '2026-08-18',
  },
];

export function getJourneyBySlug(slug: string): JourneyPage | undefined {
  return JOURNEY_PAGES.find((j) => j.slug === slug);
}

export function getAllJourneySlugs(): string[] {
  return JOURNEY_PAGES.map((j) => j.slug);
}
