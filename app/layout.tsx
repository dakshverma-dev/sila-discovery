import type { Metadata } from "next";
import { Amiri, Cormorant_Garamond, Schibsted_Grotesk } from "next/font/google";
import { SILA_MOTION_BOOT } from "@/lib/ui/sila/motion-boot";
import { Motion } from "@/components/sila/motion";
import { SmoothScroll } from "@/components/sila/smooth-scroll";
import "./globals.css";
import "@/components/sila/application/application.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-schibsted",
});
const amiri = Amiri({ subsets: ["arabic"], weight: "400", variable: "--font-amiri" });

export const metadata: Metadata = {
  title: { default: "sila", template: "%s · sila" },
  description:
    "Find an Edinburgh cultural experience through your club's tastes. Live Qloo discovery with clearly fictional sessions and private sample requests.",
};

// Hides animated elements before first paint so the motion layer can play them in; skipped with reduced motion.


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth" className={`${cormorant.variable} ${schibsted.variable} ${amiri.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SILA_MOTION_BOOT }} />
      </head>
      <body className="sila-app">
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <div aria-hidden="true" className="grain" />
        {children}
        <Motion />
        <SmoothScroll />
      </body>
    </html>
  );
}
