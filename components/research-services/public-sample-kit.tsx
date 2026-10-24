import { ASK_BRAND } from '@/lib/design/ask-design-system';

const SAMPLE_HTML = '/research-services/sample-report.html';
const SAMPLE_PDF = '/research-services/sample-report.pdf';

/** Reusable, isolated page content for GB2 to integrate without touching its inquiry form. */
export function ResearchServicesPublicHero() {
  return (
    <header
      className="border-b"
      style={{ borderColor: ASK_BRAND.border, backgroundColor: ASK_BRAND.canvas }}
    >
      <div className="container-page py-12 sm:py-14 lg:py-16">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          Trust Hub Research Services
        </p>
        <h1 className="max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-tight" style={{ color: ASK_BRAND.navy }}>
          Your contractor vendor list. One clear, source-dated report.
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          Review contractor identities, license status and relevant public enforcement records before onboarding, renewal or board review.
        </p>
        <div className="mt-6 max-w-3xl rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: ASK_BRAND.border }}>
          <p className="font-semibold" style={{ color: ASK_BRAND.navy }}>
            For Florida property managers and associations. Includes identity and license-status checks for up to three vendors. Detailed enforcement research and broader reviews are quoted separately.
          </p>
          <a
            href="#sample-request"
            className="btn-primary mt-4 inline-flex min-h-11 w-full items-center justify-center px-5 text-center sm:w-auto"
          >
            Request a free three-vendor license screen
          </a>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
            The initial inquiry is for contact and scope only. Vendor identities are requested after contact; do not enter them in this inquiry form.
          </p>
        </div>
      </div>
    </header>
  );
}

/** Sample links are separate from the inquiry form and can be placed below the hero. */
export function ResearchServicesSampleLinks() {
  return (
    <section aria-labelledby="research-services-sample-heading" className="container-page py-10 sm:py-14">
      <div className="rounded-2xl border bg-white p-6 shadow-soft sm:p-8" style={{ borderColor: ASK_BRAND.border }}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: ASK_BRAND.indigo }}>
          Fictional sample
        </p>
        <h2 id="research-services-sample-heading" className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
          See how a source-dated report is organized
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: ASK_BRAND.ink }}>
          The sample uses a fictional business, placeholder identifiers, and illustrative findings. It contains no real contractor records and does not certify insurance or approve a vendor.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a className="btn-primary inline-flex min-h-11 w-full items-center justify-center px-5 text-center sm:w-auto" href={SAMPLE_HTML}>
            View accessible HTML sample
          </a>
          <a className="btn-secondary inline-flex min-h-11 w-full items-center justify-center px-5 text-center sm:w-auto" href={SAMPLE_PDF} download>
            Download sample PDF
          </a>
        </div>
        <p className="mt-3 text-sm" style={{ color: ASK_BRAND.ink }}>
          The HTML sample is the editable source used to generate the PDF.
        </p>
      </div>
    </section>
  );
}
