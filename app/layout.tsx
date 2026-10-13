import type { Metadata } from "next";
import { Amiri, Cormorant_Garamond, Schibsted_Grotesk } from "next/font/google";
import { Motion } from "@/components/sila/motion";
import { SmoothScroll } from "@/components/sila/smooth-scroll";
import "./globals.css";

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
    "sila: cultural experiences that happen when enough of us ask for them. Communities pool interest to reserve venue-approved sessions in Edinburgh.",
};

// Hides animated elements before first paint so the motion layer can play them in; skipped with reduced motion.
const MOTION_BOOT = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('js-motion')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${cormorant.variable} ${schibsted.variable} ${amiri.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </head>
      <body>
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
