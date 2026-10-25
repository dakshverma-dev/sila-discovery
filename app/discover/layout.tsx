import type { Metadata } from "next";
import { DiscoveryShell } from "@/components/discovery/shell";
export const metadata: Metadata = {
  title: "Find a shared experience",
  description:
    "Discover a cultural outing for your Edinburgh club through real Qloo taste intelligence. Fictional sessions; no real bookings.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DiscoveryShell>{children}</DiscoveryShell>;
}
