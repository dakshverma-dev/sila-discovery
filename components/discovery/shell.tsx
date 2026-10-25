import Link from "next/link";
import "./discovery.css";
export function DiscoveryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sd-shell">
      <header className="sd-header">
        <Link
          className="sd-brand"
          href="/discover"
          aria-label="Sila discovery home"
        >
          sila<span>صلة</span>
        </Link>
        <nav aria-label="Discovery navigation">
          <Link href="/discover">Find a shared experience</Link>
          <Link href="/discover/catalogue">The collection</Link>
          <Link href="/">Sila pilot</Link>
        </nav>
        <span className="sd-pill">Edinburgh · discovery edition</span>
      </header>
      <main id="main">{children}</main>
      <footer className="sd-footer">
        <div>
          <Link className="sd-brand" href="/discover">
            sila
          </Link>
          <p>Small clubs. Shared possibilities.</p>
        </div>
        <p>
          Real Qloo venue intelligence. Fictional sessions.
          <br />
          No places are reserved and no payment is taken.
          <br />
          <Link href="/discover/about">How this demo works</Link>
        </p>
      </footer>
    </div>
  );
}
