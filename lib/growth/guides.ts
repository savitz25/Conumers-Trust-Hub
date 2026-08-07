/**
 * Educational explainers on Ask Trust Hub (pre-directory questions).
 * No thin pages — each entry is substantial enough to publish.
 */

export type GuidePage = {
  slug: string;
  vertical: 'moving' | 'lending' | 'insurance';
  title: string;
  metaTitle: string;
  metaDescription: string;
  definitiveAnswer: string;
  sections: { heading: string; paragraphs: string[] }[];
  proves: string[];
  doesNotProve: string[];
  primarySource: { name: string; url: string };
  hubCta: { label: string; href: string };
  related: { href: string; label: string }[];
  lastReviewed: string;
};

export const GUIDE_PAGES: GuidePage[] = [
  {
    slug: 'verify-usdot-number',
    vertical: 'moving',
    title: 'How to verify a USDOT / DOT number',
    metaTitle: 'How to Verify a USDOT / DOT Number for Movers',
    metaDescription:
      'What a USDOT number is, how to look it up on FMCSA public systems, and what verification does not prove. Route to Move Trust Hub research tools.',
    definitiveAnswer:
      'A USDOT number is a federal identifier for many commercial motor carriers. You verify it by looking the company up in FMCSA public systems (such as SAFER) and checking that the identity and status context match the company you are dealing with — then you still re-check before you pay.',
    sections: [
      {
        heading: 'What a USDOT number is',
        paragraphs: [
          'The U.S. Department of Transportation issues USDOT numbers used to identify many commercial motor carriers. Interstate household goods movers you research on Move Trust Hub are often discussed in FMCSA-oriented public records tied to those identifiers.',
          'People say “DOT number” colloquially; the practical research task is the same: confirm the number maps to the legal entity contacting you, not a look-alike brand name or a marketing DBA that does not match the snapshot.',
          'A USDOT number is an identity handle in a public system. It is not a consumer rating, a satisfaction score, or a guarantee that your personal move will go well.',
        ],
      },
      {
        heading: 'How to look it up',
        paragraphs: [
          'Get the USDOT number in writing — estimate, contract, email signature, or company website. Prefer numbers provided by the same entity that will take payment.',
          'Use FMCSA public tools such as SAFER company snapshots. Enter the number carefully. Compare legal name, DBA names if shown, address context, and operating status fields against what the salesperson claims.',
          'If names do not match, pause. Ask which legal entity is contracting with you and which entity will operate the truck. Identity mismatches are a common pattern in consumer complaints about household goods moves.',
          'If the company cannot or will not give a USDOT number for an interstate household goods move, treat that as a research red flag — not as proof of guilt, but as a reason to pause deposits until you can verify.',
        ],
      },
      {
        heading: 'What to re-check right before you pay',
        paragraphs: [
          'Public records lag. A snapshot you saved last month may not match today’s status. Re-open the official tool immediately before you send a deposit or sign a final agreement.',
          'Save or print the snapshot page (or capture a dated screenshot) for your records. Pair it with the written estimate so you can show what identity you thought you hired.',
        ],
      },
      {
        heading: 'How Move Trust Hub helps',
        paragraphs: [
          'Move Trust Hub provides research workflows (including Verify DOT style tools) that orient you to FMCSA public context. It is independent research infrastructure under the Ask Trust Hub network — not a booking engine and not a paid ranking board.',
          'Use Move Trust Hub to prepare questions and organize research; still complete final verification on official FMCSA systems yourself.',
        ],
      },
    ],
    proves: [
      'That a USDOT identifier exists in public FMCSA systems for a carrier identity',
      'Public snapshot fields available at the time you look them up',
    ],
    doesNotProve: [
      'That your personal move will be on time or damage-free',
      'That every employee or subcontractor is listed on that snapshot',
      'That a broker relationship is the same as a carrier relationship',
      'That the lowest estimate is safe or accurate',
    ],
    primarySource: { name: 'FMCSA / SAFER', url: 'https://safer.fmcsa.dot.gov/' },
    hubCta: {
      label: 'Open Verify DOT research on Move Trust Hub',
      href: 'https://www.movetrusthub.com/verify-dot',
    },
    related: [
      { href: '/guides/operating-authority-explained', label: 'What operating authority means' },
      { href: '/guides/broker-vs-carrier', label: 'Broker vs carrier' },
      { href: '/journeys/moving-to-another-state', label: 'Moving to another state journey' },
      { href: '/data-sources#moving', label: 'Moving data sources' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'operating-authority-explained',
    vertical: 'moving',
    title: 'What operating authority means for movers',
    metaTitle: 'Operating Authority Explained for Household Goods Movers',
    metaDescription:
      'Plain-language explanation of motor carrier operating authority vs a USDOT number, limits of public records, and where to research on Move Trust Hub.',
    definitiveAnswer:
      'Operating authority is permission (in the federal system) for certain types of for-hire transportation. A USDOT number identifies a carrier; authority describes what kind of for-hire work they may perform. Public records can lag — always re-check FMCSA systems.',
    sections: [
      {
        heading: 'Authority is not the same as a logo',
        paragraphs: [
          'Marketing sites often display badges, stock photos, and vague “licensed and insured” claims. Operating authority is a regulatory concept: whether a carrier is authorized for specific for-hire operations, including household goods in many interstate scenarios.',
          'Consumers should ask which entity holds authority and whether that entity is the one named on the estimate and contract. A polished brand website can point to a different legal entity than the one that will show up on moving day.',
        ],
      },
      {
        heading: 'How authority relates to a USDOT number',
        paragraphs: [
          'Think of the USDOT number as an identity key and operating authority as a permission context associated with certain for-hire operations. You still need both kinds of research when they apply: who is this company, and are they authorized for the work you think you hired?',
          'Not every local or intrastate situation is governed the same way as interstate household goods transportation. When your move crosses state lines, federal public systems become especially relevant research surfaces.',
        ],
      },
      {
        heading: 'Why it matters in estimates',
        paragraphs: [
          'Disputes often involve “the company I googled” vs “the company that showed up.” Authority and identity research reduce that mismatch risk. Still, public data cannot guarantee on-time service, careful packing, or fair claims handling.',
          'Pair authority research with estimate literacy: binding vs non-binding language, inventory lists, and access assumptions. Authority without a clear written estimate still leaves pricing risk on the table.',
        ],
      },
      {
        heading: 'Where to continue research',
        paragraphs: [
          'Move Trust Hub surfaces FMCSA-oriented research tools and educational guidance under the Ask Trust Hub network independence rules. Final checks remain on official FMCSA systems. We cite. You decide.',
        ],
      },
    ],
    proves: [
      'Public FMCSA context about authority types associated with a carrier identity (when published)',
    ],
    doesNotProve: [
      'Quality of packing, crew behavior, or claims handling',
      'That a local-only move is governed the same way as an interstate move',
      'That “authorized” means “best for your household”',
    ],
    primarySource: { name: 'FMCSA', url: 'https://www.fmcsa.dot.gov/' },
    hubCta: {
      label: 'Research movers on Move Trust Hub',
      href: 'https://www.movetrusthub.com/companies',
    },
    related: [
      { href: '/guides/verify-usdot-number', label: 'How to verify a USDOT number' },
      { href: '/guides/binding-vs-non-binding-estimates', label: 'Binding vs non-binding estimates' },
      { href: '/methodology', label: 'Ask Trust Hub Standard' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'binding-vs-non-binding-estimates',
    vertical: 'moving',
    title: 'Binding vs non-binding moving estimates',
    metaTitle: 'Binding vs Non-Binding Moving Estimates — What Changes Your Risk',
    metaDescription:
      'Plain-language differences between binding and non-binding household goods estimates, consumer risks, and research next steps on Move Trust Hub.',
    definitiveAnswer:
      'A binding estimate generally locks the price for the described inventory and services under stated conditions; a non-binding estimate is more of a prediction and can change with weight or inventory. Always read the actual estimate document — labels in ads are not enough.',
    sections: [
      {
        heading: 'Why the distinction matters',
        paragraphs: [
          'Many consumer complaints involve final charges that exceed what people thought they were quoted. Whether an estimate is binding or non-binding, and what inventory list it covers, changes your leverage and your risk.',
          'Ask for the estimate type in writing, the inventory assumptions, and how extra services (stairs, long carries, packing materials, storage) are priced before you pay a large deposit.',
        ],
      },
      {
        heading: 'What “binding” still depends on',
        paragraphs: [
          'Even when an estimate is described as binding, the document usually depends on an accurate inventory and access conditions. If you add items, change dates, or need services not listed, charges can change under the document’s rules.',
          'Read exceptions and add-on schedules carefully. A binding label is not a magic shield against every dispute; it is a contract concept you must match to the written pages you sign.',
        ],
      },
      {
        heading: 'Non-binding estimates and surprise risk',
        paragraphs: [
          'Non-binding estimates are often weight- or volume-sensitive. The number that got you on the phone may not be the number on delivery day if inventory was incomplete or access was harder than assumed.',
          'That does not mean every non-binding estimate is a scam. It means you should treat the estimate as a research input, demand a careful inventory, and leave budget margin until weight and services are confirmed under the agreement.',
        ],
      },
      {
        heading: 'Research posture',
        paragraphs: [
          'Move Trust Hub can help you research carriers and prepare questions; it does not replace reading your contract. Pair estimate literacy with USDOT verification and broker-vs-carrier clarity. Prefer companies that will put estimate type and inventory assumptions in writing without pressure tactics.',
        ],
      },
    ],
    proves: [
      'Nothing by itself — estimate type is a contract concept you confirm on the document',
    ],
    doesNotProve: [
      'That “binding” means zero disputes ever',
      'That the cheapest non-binding number is the true final cost',
      'That the mover’s crew quality matches the sales pitch',
    ],
    primarySource: {
      name: 'FMCSA household goods consumer resources',
      url: 'https://www.fmcsa.dot.gov/protect-your-move',
    },
    hubCta: {
      label: 'Continue mover research on Move Trust Hub',
      href: 'https://www.movetrusthub.com/',
    },
    related: [
      { href: '/guides/verify-usdot-number', label: 'Verify a USDOT number' },
      { href: '/journeys/moving-to-another-state', label: 'Interstate move journey' },
      { href: '/guides/broker-vs-carrier', label: 'Broker vs carrier' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'broker-vs-carrier',
    vertical: 'moving',
    title: 'Broker vs carrier: who is responsible for your move?',
    metaTitle: 'Moving Broker vs Carrier — Plain-Language Differences',
    metaDescription:
      'Understand household goods brokers vs motor carriers, why identity mismatches matter, and how to research on Move Trust Hub with FMCSA sources.',
    definitiveAnswer:
      'A carrier typically operates the trucks and is responsible for the transportation; a broker arranges transportation with carriers. Problems arise when consumers think they hired a carrier but signed with a broker — or when the on-site crew is a different entity than the brand they researched.',
    sections: [
      {
        heading: 'Ask who shows up',
        paragraphs: [
          'Before you pay, ask: Who is named on the estimate? Who holds the USDOT number? Who will physically transport the goods? Get answers in writing.',
          'Public FMCSA records help you research identities; they do not replace a careful contract review. If the brand, the contracting entity, and the operating entity are three different names, slow down until you understand the relationships.',
        ],
      },
      {
        heading: 'Why the distinction shows up in disputes',
        paragraphs: [
          'Consumers often research one company, pay a deposit to that brand, and then discover a different motor carrier on the bill of lading or at the curb. That mismatch is not automatically illegal in every structure — but it is a research problem if you never agreed to it knowingly.',
          'Broker arrangements can be legitimate. The consumer task is transparency: understand who is arranging vs who is hauling, and verify the identities you can check in public systems.',
        ],
      },
      {
        heading: 'Independence note',
        paragraphs: [
          'Move Trust Hub is part of the Ask Trust Hub network under common ownership with separated research and listing order and no paid placements. Rankings are not for sale. Research tools orient you to public sources; they do not book your move or endorse a provider.',
        ],
      },
    ],
    proves: [
      'Conceptual roles in the interstate household goods market (carrier vs broker arrangements)',
    ],
    doesNotProve: [
      'That every company uses the labels carefully in marketing',
      'That one model is always better for every consumer',
      'That a public record check guarantees service quality',
    ],
    primarySource: { name: 'FMCSA Protect Your Move', url: 'https://www.fmcsa.dot.gov/protect-your-move' },
    hubCta: {
      label: 'Research movers on Move Trust Hub',
      href: 'https://www.movetrusthub.com/companies',
    },
    related: [
      { href: '/guides/operating-authority-explained', label: 'Operating authority explained' },
      { href: '/data-sources#moving', label: 'Moving data sources' },
      { href: '/journeys/relocating-for-work', label: 'Relocating for work journey' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'check-nmls-license',
    vertical: 'lending',
    title: 'How to check an NMLS license',
    metaTitle: 'How to Check an NMLS License on Consumer Access',
    metaDescription:
      'Step-by-step orientation to NMLS Consumer Access checks for mortgage-related licenses, limits of verification, and Lender Trust Hub research routes.',
    definitiveAnswer:
      'Use NMLS Consumer Access (the public consumer site) to look up a company or individual by name or NMLS ID, then compare the legal identity and license status fields to the person or company you are dealing with. Always re-check immediately before you apply.',
    sections: [
      {
        heading: 'What you will look for',
        paragraphs: [
          'NMLS Consumer Access can show identifiers, sponsorship/relationship context depending on the record, jurisdictions, and status information that is published for consumer viewing.',
          'Write down the NMLS ID from a business card, email signature, or disclosure, then search it. Mismatched names, unexpected employers, or inactive statuses deserve a pause.',
        ],
      },
      {
        heading: 'A practical lookup sequence',
        paragraphs: [
          '1) Collect the exact legal name and NMLS ID in writing. 2) Search on NMLS Consumer Access. 3) Confirm the person or company matches what you expect. 4) Note jurisdictions and status language. 5) Re-check again before you submit an application or pay fees that feel irreversible.',
          'If a loan officer will not provide an NMLS ID, treat that as a research red flag for mortgage-related roles where public IDs are commonly used.',
        ],
      },
      {
        heading: 'How Lender Trust Hub fits',
        paragraphs: [
          'Lender Trust Hub surfaces NMLS-oriented research context and educational tools so you can prepare questions. It is not a lender and does not originate loans. Final verification is still on NMLS Consumer Access and your written loan documents.',
          'Educational calculators on Lender Trust Hub are research aids, not offers. Pair them with license checks and official loan estimates from the lender you choose.',
        ],
      },
    ],
    proves: [
      'Public license identity and status fields available on NMLS Consumer Access at lookup time',
    ],
    doesNotProve: [
      'That you will be approved for a loan',
      'That a rate quote is best or final',
      'That the individual is free of all consumer complaints',
      'That compensation structures are always transparent without asking',
    ],
    primarySource: {
      name: 'NMLS Consumer Access',
      url: 'https://www.nmlsconsumeraccess.org/',
    },
    hubCta: {
      label: 'Research lenders on Lender Trust Hub',
      href: 'https://www.lendertrusthub.com/local-lenders',
    },
    related: [
      {
        href: '/guides/what-nmls-verification-proves',
        label: 'What NMLS verification does and does not prove',
      },
      {
        href: '/guides/loan-officer-vs-broker-vs-banker',
        label: 'Loan officer vs broker vs banker',
      },
      { href: '/journeys/buying-a-home', label: 'Buying a home journey' },
      { href: '/data-sources#lending', label: 'Lending data sources' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'what-nmls-verification-proves',
    vertical: 'lending',
    title: 'What NMLS verification does and does not prove',
    metaTitle: 'What NMLS Verification Proves (and Does Not Prove)',
    metaDescription:
      'Clear limits of NMLS Consumer Access checks for consumers researching mortgage licenses. Independent research orientation via Lender Trust Hub.',
    definitiveAnswer:
      'An NMLS Consumer Access check can support identity and licensing status research for many mortgage-related roles. It does not prove credit quality, honesty, best pricing, or future performance.',
    sections: [
      {
        heading: 'Useful, incomplete',
        paragraphs: [
          'Licensing systems answer “who is this entity in the public license system?” They do not answer “should you choose them?” That second question needs offers, fees, service quality, and your own priorities.',
          'The Ask Trust Hub Standard treats verification as matching to primary sources — with disclosed limits — not as an endorsement.',
        ],
      },
      {
        heading: 'Common over-interpretations to avoid',
        paragraphs: [
          'Seeing an Active status does not mean the person will get you the lowest rate. A matching NMLS ID does not mean the verbal quote will match the Loan Estimate. A company record does not guarantee every employee you meet is the person you looked up.',
          'Verification is a necessary hygiene step, not a complete decision framework. Use it to reduce identity risk, then evaluate products and service with documents.',
        ],
      },
      {
        heading: 'How this fits the network',
        paragraphs: [
          'Lender Trust Hub helps you research with NMLS-oriented context. Ask publishes educational limits so specialist tools are not mistaken for guarantees. Common ownership · Separated research and listing order · No paid placements.',
        ],
      },
    ],
    proves: [
      'Public licensing context available on Consumer Access when the record is present and matched',
    ],
    doesNotProve: [
      'Best interest alignment, pricing, underwriting outcomes, or complaint-free history',
      'That modeled calculator outputs are loan offers',
    ],
    primarySource: {
      name: 'NMLS Consumer Access',
      url: 'https://www.nmlsconsumeraccess.org/',
    },
    hubCta: {
      label: 'Continue on Lender Trust Hub',
      href: 'https://www.lendertrusthub.com/',
    },
    related: [
      { href: '/guides/check-nmls-license', label: 'How to check an NMLS license' },
      { href: '/methodology', label: 'Ask Trust Hub Standard' },
      { href: '/journeys/buying-a-home', label: 'Buying a home journey' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'loan-officer-vs-broker-vs-banker',
    vertical: 'lending',
    title: 'Loan officer vs broker vs banker (plain language)',
    metaTitle: 'Loan Officer vs Mortgage Broker vs Banker — Plain Language',
    metaDescription:
      'Plain-language differences among loan officers, brokers, and bank lenders for consumers researching home financing. Route to Lender Trust Hub.',
    definitiveAnswer:
      'Titles vary, but consumers should focus on who employs the person, who underwrites/funds the loan, what licenses apply, and how compensation works — then verify licenses on NMLS Consumer Access. Marketing labels alone are not enough.',
    sections: [
      {
        heading: 'Practical questions to ask',
        paragraphs: [
          'Who is your employer? What is your NMLS ID? Are you offering a product from a single bank or shopping multiple investors? How are you compensated? Get answers in writing when possible.',
          'Lender Trust Hub helps with independent research; it does not replace loan disclosures or legal counsel.',
        ],
      },
      {
        heading: 'Why titles confuse people',
        paragraphs: [
          '“Banker,” “broker,” and “loan officer” are used loosely in marketing. What matters for consumers is the business model and the license trail: who can take your application, who makes the credit decision, and who services the loan later.',
          'Two people with similar titles can sit in different companies with different product menus. Always pair title questions with an NMLS lookup and written Loan Estimates when comparing costs.',
        ],
      },
      {
        heading: 'Research without channel bias',
        paragraphs: [
          'No channel is automatically safest or cheapest for every borrower. Compare documented costs, timelines, and communication quality. Use NMLS Consumer Access for identity hygiene, then evaluate the offer — not the job title on the business card.',
        ],
      },
    ],
    proves: ['Educational distinctions commonly used in consumer mortgage markets'],
    doesNotProve: [
      'That one channel is always cheaper or safer',
      'License status without an NMLS lookup',
    ],
    primarySource: {
      name: 'CFPB consumer resources',
      url: 'https://www.consumerfinance.gov/',
    },
    hubCta: {
      label: 'Research financing options on Lender Trust Hub',
      href: 'https://www.lendertrusthub.com/local-lenders',
    },
    related: [
      { href: '/guides/check-nmls-license', label: 'How to check an NMLS license' },
      { href: '/journeys/buying-a-home', label: 'Buying a home journey' },
      {
        href: '/guides/what-nmls-verification-proves',
        label: 'What NMLS verification proves',
      },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'verify-doi-producer-license',
    vertical: 'insurance',
    title: 'How to verify a DOI / producer license',
    metaTitle: 'How to Verify an Insurance Producer License (State DOI)',
    metaDescription:
      'How to check insurance producer or agency licenses via state Department of Insurance tools, limits of records, and Insurance Trust Hub research routes.',
    definitiveAnswer:
      'Insurance producer and agency licensing is primarily state-based. Verify on the official Department of Insurance (or equivalent) lookup for the state that matters, using the license number or legal name — then re-check before you rely on advice or bind coverage.',
    sections: [
      {
        heading: 'Find the right state tool',
        paragraphs: [
          'There is not one national producer license. Start with the state DOI consumer lookup for the state where the transaction is regulated. NAIC resources can help you find state insurance departments.',
          'Match the legal name, license status, and lines of authority to what the person claims they can sell.',
        ],
      },
      {
        heading: 'A practical verification sequence',
        paragraphs: [
          'Ask for the producer’s full legal name, license number, and home state. Open the official state lookup. Confirm Active status language and lines of authority relevant to the product (for example, property/casualty vs life). If the state publishes appointments or agency relationships, note them.',
          'If the person is licensed in a different state than your transaction, ask how that works for your situation and re-check the state that matters for your purchase.',
        ],
      },
      {
        heading: 'Insurance Trust Hub role',
        paragraphs: [
          'Insurance Trust Hub provides educational research and DOI-oriented context. It is not a policy marketplace and does not sell rankings. Final verification remains on the official state system.',
          'Use Insurance Trust Hub to prepare questions and organize research paths; use the state DOI tool for the final status check before you rely on advice.',
        ],
      },
    ],
    proves: [
      'Public license fields published by the state system at the time of lookup',
    ],
    doesNotProve: [
      'Claim service quality, pricing fairness, or product suitability',
      'That a license in one state covers activity in another',
      'That “licensed” means “best for your household”',
    ],
    primarySource: {
      name: 'NAIC state insurance department directory',
      url: 'https://content.naic.org/state-insurance-departments',
    },
    hubCta: {
      label: 'Research agencies on Insurance Trust Hub',
      href: 'https://www.insurancetrusthub.com/directory',
    },
    related: [
      {
        href: '/guides/what-state-doi-records-show',
        label: 'What state DOI records show',
      },
      {
        href: '/guides/captive-vs-independent-agents',
        label: 'Captive vs independent agents',
      },
      { href: '/journeys/protecting-what-matters', label: 'Protecting what matters journey' },
      { href: '/data-sources#insurance', label: 'Insurance data sources' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'what-state-doi-records-show',
    vertical: 'insurance',
    title: 'What state DOI records actually show',
    metaTitle: 'What State DOI License Records Show (and Omit)',
    metaDescription:
      'What insurance DOI public records typically include, common gaps, and how to use them with Insurance Trust Hub research without over-trusting a badge.',
    definitiveAnswer:
      'State DOI systems typically publish license identity and status context for producers and agencies. Completeness varies by state. They do not grade customer service or guarantee claim outcomes.',
    sections: [
      {
        heading: 'Read status carefully',
        paragraphs: [
          'Look for active vs inactive language, expiration context if shown, and lines of authority. If fields are missing, do not invent them — ask the producer for the license number and re-query the official tool.',
          'States differ in what they publish. Some surfaces are richer than others. Absence of a field is not the same as a clean bill of health; it may simply mean the system does not display that attribute publicly.',
        ],
      },
      {
        heading: 'What consumers often expect that records do not provide',
        paragraphs: [
          'DOI records generally will not rank “best agents,” score friendliness, or guarantee that a product is suitable for your risk. They also will not replace reading policy forms, deductibles, and exclusions.',
          'Treat a successful lookup as identity and status hygiene — necessary, not sufficient.',
        ],
      },
      {
        heading: 'How Ask and Insurance Trust Hub use this',
        paragraphs: [
          'Ask explains limits so consumers do not over-trust a badge. Insurance Trust Hub provides educational research routes under the same independence thesis. Final authority is the official state system, re-checked before you bind.',
        ],
      },
    ],
    proves: ['Public regulatory license context as published by the state'],
    doesNotProve: [
      'Product value, claim experience, or that “licensed” means “best for you”',
      'Completeness of every complaint or enforcement history in all states',
    ],
    primarySource: {
      name: 'NAIC / state insurance departments',
      url: 'https://content.naic.org/state-insurance-departments',
    },
    hubCta: {
      label: 'Open Insurance Trust Hub',
      href: 'https://www.insurancetrusthub.com/',
    },
    related: [
      {
        href: '/guides/verify-doi-producer-license',
        label: 'How to verify a producer license',
      },
      { href: '/methodology', label: 'Ask Trust Hub Standard' },
      { href: '/data-sources#insurance', label: 'Insurance data sources' },
    ],
    lastReviewed: '2026-08-07',
  },
  {
    slug: 'captive-vs-independent-agents',
    vertical: 'insurance',
    title: 'Captive vs independent insurance agents (plain language)',
    metaTitle: 'Captive vs Independent Insurance Agents — Plain Language',
    metaDescription:
      'Plain-language differences between captive and independent insurance agents, what to ask, and how to verify licenses via DOI tools and Insurance Trust Hub.',
    definitiveAnswer:
      'Captive agents generally represent one insurer’s products; independent agents may place coverage with multiple insurers. Neither model replaces a state license check. Ask how they are appointed and verify their producer license on the state DOI system.',
    sections: [
      {
        heading: 'Questions that cut through sales language',
        paragraphs: [
          'Which companies can you write? How are you compensated? What is your license number and home state? Can you put coverage options and exclusions in writing?',
          'Insurance Trust Hub supports educational research; it does not sell policies or paid rankings.',
        ],
      },
      {
        heading: 'Why the model matters (and why it is not enough)',
        paragraphs: [
          'A captive model can mean deeper familiarity with one company’s products. An independent model can mean more shopping across carriers. Neither structure guarantees lower premiums, better claims handling, or honest communication.',
          'Use the model as a conversation starter, then verify licenses and read actual coverage documents. Do not treat “independent” as a quality seal or “captive” as a warning label without more research.',
        ],
      },
      {
        heading: 'Verification still comes first',
        paragraphs: [
          'Before you decide based on distribution model, complete a DOI producer or agency lookup for the relevant state. Marketing about being local, digital, or full-service does not substitute for Active status and appropriate lines of authority.',
        ],
      },
    ],
    proves: ['Educational market-structure distinctions commonly used in U.S. personal lines'],
    doesNotProve: [
      'That independent always means cheaper, or captive always means simpler service',
      'License status without a DOI lookup',
    ],
    primarySource: {
      name: 'NAIC consumer resources',
      url: 'https://content.naic.org/',
    },
    hubCta: {
      label: 'Research coverage options on Insurance Trust Hub',
      href: 'https://www.insurancetrusthub.com/directory',
    },
    related: [
      {
        href: '/guides/verify-doi-producer-license',
        label: 'Verify a DOI / producer license',
      },
      { href: '/journeys/protecting-what-matters', label: 'Protecting what matters' },
      {
        href: '/guides/what-state-doi-records-show',
        label: 'What DOI records show',
      },
    ],
    lastReviewed: '2026-08-07',
  },
];

export function getGuideBySlug(slug: string): GuidePage | undefined {
  return GUIDE_PAGES.find((g) => g.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return GUIDE_PAGES.map((g) => g.slug);
}

export function getGuidesByVertical(vertical: GuidePage['vertical']): GuidePage[] {
  return GUIDE_PAGES.filter((g) => g.vertical === vertical);
}
