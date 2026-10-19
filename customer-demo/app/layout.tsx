import type { Metadata } from "next";
import { Amiri, Cormorant_Garamond, Schibsted_Grotesk } from "next/font/google";
import "../../app/globals.css";
import { SILA_MOTION_BOOT } from "@/lib/ui/sila/motion-boot";
import { Motion } from "@/components/sila/motion";
import { SmoothScroll } from "@/components/sila/smooth-scroll";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-cormorant" });
const sans = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-schibsted" });
const arabic = Amiri({ subsets: ["arabic"], weight: "400", variable: "--font-amiri" });
export const metadata: Metadata = { title: "Sila · culture, with room for more", description: "Shared cultural bookings for smaller clubs. Venue-set sessions, conditional commitments and clear venue decisions." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GB" className={`${serif.variable} ${sans.variable} ${arabic.variable}`}><head><script dangerouslySetInnerHTML={{__html:SILA_MOTION_BOOT}}/></head><body><a className="skip-link" href="#main">Skip to content</a><div aria-hidden="true" className="grain" />{children}<Motion/><SmoothScroll/></body></html>;
}
