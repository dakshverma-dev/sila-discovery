import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shared Cultural Bookings",
  description:
    "Pool community interest to reserve venue-approved cultural experiences in Edinburgh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
