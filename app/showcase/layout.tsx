import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/sila/chrome";
import { ShowcaseNav } from "@/components/sila/showcase-nav";

export const metadata: Metadata = { title: { default: "Demo experience", template: "%s · sila" } };

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader navNode={<ShowcaseNav />} persona={{ name: "Maya Okafor", org: "Hackney Letterpress Circle" }} />
      <div className="sandbox-bar">
        <div className="wrap sandbox-bar-inner">
          <p className="demo-banner" role="note">
            <strong>Demo data</strong>
            A demonstration experience from the sila design. Communities, venues and counts are illustrative; nothing you do
            here is stored, reserved or charged.
          </p>
        </div>
      </div>
      {children}
      <SiteFooter />
    </>
  );
}
