import { WyomingNetworkGateway } from "@/components/wyoming-network-gateway";
import { createPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/json-ld";
import { WY_PUBLICATION_MANIFEST as manifest, wyReleaseGatePassed } from "@/lib/network/wyoming-network";

export const metadata = createPageMetadata({
  title: "Wyoming specialist research | AskTrustHub",
  description: "Wyoming research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.",
  path: "/wyoming",
  noIndex: !wyReleaseGatePassed(),
});

export default function WyomingPage() {
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "Wyoming specialist research", url: manifest.ask_canonical, description: "Gateway to six specialist-owned Wyoming sources. Separate source grains; no combined provider population or rating." }} /><WyomingNetworkGateway /></>;
}
