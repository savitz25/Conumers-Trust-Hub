import { AlaskaNetworkGateway } from "@/components/alaska-network-gateway";
import { createPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/json-ld";
import {
  AK_PUBLICATION_MANIFEST,
  akReleaseGatePassed,
} from "@/lib/network/alaska-network";

export const metadata = createPageMetadata({
  title: "Alaska specialist research | AskTrustHub",
  description:
    "Alaska research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.",
  path: "/alaska",
  noIndex: !akReleaseGatePassed(),
});

export default function AlaskaPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Alaska specialist research",
          url: AK_PUBLICATION_MANIFEST.ask_canonical,
          description:
            "Gateway to six specialist-owned Alaska sources. Separate source grains; no combined provider population or rating.",
        }}
      />
      <AlaskaNetworkGateway />
    </>
  );
}
