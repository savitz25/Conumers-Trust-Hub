import { VermontNetworkGateway } from "@/components/vermont-network-gateway";
import { createPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/json-ld";
import { VT_PUBLICATION_MANIFEST as manifest, vtReleaseGatePassed } from "@/lib/network/vermont-network";

export const metadata = createPageMetadata({
  title: "Vermont specialist research | AskTrustHub",
  description: "Vermont research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.",
  path: "/vermont",
  noIndex: !vtReleaseGatePassed(),
});

export default function VermontPage() {
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "Vermont specialist research", url: manifest.ask_canonical, description: "Gateway to six specialist-owned Vermont sources. Separate source grains; no combined provider population or rating." }} /><VermontNetworkGateway /></>;
}
