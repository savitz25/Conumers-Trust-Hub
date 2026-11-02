# Trust Hub Research Services — public demo handoff for GB2

**Status:** draft assets for supervised demonstration only. Do not publish or deploy without GB2’s review and release process. This work did not edit `app/research-services/page.tsx`, the inquiry form, its backend, or configuration.

## Prepared assets

- `components/research-services/public-sample-kit.tsx` exports `ResearchServicesPublicHero` and `ResearchServicesSampleLinks` for isolated integration.
- `public/research-services/sample-report.html` is the accessible, responsive fictional report and editable source.
- `public/research-services/sample-report.pdf` is the printable PDF generated from that HTML.

## Exact hero copy

**Headline**

Your contractor vendor list. One clear, source-dated report.

**Description**

Review contractor identities, license status and relevant public enforcement records before onboarding, renewal or board review.

**Primary CTA**

Request a free three-vendor license screen

**Offer explanation, adjacent to CTA**

For Florida property managers and associations. Includes identity and license-status checks for up to three vendors. Detailed enforcement research and broader reviews are quoted separately.

**Inquiry boundary beside offer**

The initial inquiry is for contact and scope only. Vendor identities are requested after contact; do not enter them in this inquiry form.

## Integration instructions

1. GB2 owns the route/page and inquiry submission. Import `ResearchServicesPublicHero` and `ResearchServicesSampleLinks` into the route composition; place the hero where the current `PageHeader` is rendered and place the sample links after the overview content.
2. Keep the existing inquiry form, backend, and configuration under GB2’s control. The hero CTA targets the existing `#sample-request` anchor; confirm the anchor remains present when integrating.
3. Keep the offer explanation beside the CTA. Do not add a turnaround promise, published price, database-size claim, or wording that suggests the initial inquiry form requests vendor identities.
4. Keep both fictional sample links visible and preserve the “Illustrative example — fictional business and findings.” label on each report page.
5. Preview at desktop and mobile widths, check keyboard focus and link names, then run GB2’s normal review before publication. This handoff itself does not publish or deploy.

## Public-asset boundary

The sample business name is “Fictional Example Vendor — Not a Real Business.” Its identifiers, source fields, and findings are placeholders for layout demonstration. It has no official source links, plausible official IDs, real addresses, real contractor names, or material from the private supervised packet at `C:\TrustHub-Work\research-services-demo-001\`.
