import type { Metadata } from "next";
import "./my.css";

export const metadata: Metadata = {
  title: { absolute: "My TrustHub" },
  description: "Save research, organize Projects, and monitor supported public records.",
  robots: { index: false, follow: false, noarchive: true, noimageindex: true },
};

export default function MyTrustHubLayout({ children }: { children: React.ReactNode }) {
  return <div className="myth-root">{children}</div>;
}
