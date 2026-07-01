'use client';

import Script from 'next/script';

/**
 * Google Analytics 4 with cross-domain tracking across all Trust Hub domains.
 *
 * In GA4 Admin → Data Streams → Configure tag settings → Configure your domains:
 *   - consumerstrusthub.com
 *   - movetrusthub.com
 *   - lendertrusthub.com
 *   - insurancetrusthub.com
 *
 * Set linker parameter: auto_link_domains
 */
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

const CROSS_DOMAIN_LINKS = [
  'consumerstrusthub.com',
  'www.consumerstrusthub.com',
  'movetrusthub.com',
  'www.movetrusthub.com',
  'lendertrusthub.com',
  'www.lendertrusthub.com',
  'insurancetrusthub.com',
  'www.insurancetrusthub.com',
];

export function GoogleAnalytics() {
  if (!GA4_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA4_ID}', {
            linker: {
              domains: ${JSON.stringify(CROSS_DOMAIN_LINKS)}
            },
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}