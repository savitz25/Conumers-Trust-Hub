import { SouthDakotaNetworkGateway } from "@/components/south-dakota-network-gateway";
import { createPageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/lib/seo/json-ld";
import { SD_PUBLICATION_MANIFEST as manifest, sdReleaseGatePassed } from "@/lib/network/south-dakota-network";

export const metadata = createPageMetadata({
  title: "South Dakota specialist research | AskTrustHub",
  description: "South Dakota research through six independent specialist hubs. Source clocks and regulatory populations stay separate; combined totals and rankings are not published.",
  path: "/south-dakota",
  noIndex: !sdReleaseGatePassed(),
});

export default function SouthDakotaPage() {
  return <><JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: "South Dakota specialist research", url: manifest.ask_canonical, description: "Gateway to six specialist-owned South Dakota sources. Separate source grains; no combined provider population or rating." }} /><SouthDakotaNetworkGateway /></>;
}
