import Link from "next/link";
import { ALL_CREDITS } from "@/lib/ui/sila/art";

/** sila's sticky masthead: wordmark, numbered sections, demo-data tag and the persona. */

export interface NavItem {
  num: string;
  label: string;
  href: string | null;
  current?: boolean;
}

export function SiteHeader({
  nav,
  navNode,
  persona,
  home = "/",
}: {
  nav?: NavItem[];
  navNode?: React.ReactNode;
  persona?: { name: string; org: string | null } | null;
  home?: string;
}) {
  return (
    <header className="site-header">
      <div className="wrap site-header-inner">
        <Link href={home} className="wordmark" aria-label="sila, back to discovery">
          sila
        </Link>
        {navNode ?? (
        <nav aria-label="Sections" className="site-nav">
          {(nav ?? []).map((n) =>
            n.href ? (
              <Link key={n.label} href={n.href} aria-current={n.current ? "page" : undefined}>
                <i>{n.num}</i>
                {n.label}
              </Link>
            ) : (
              <span key={n.label} aria-disabled="true">
                <i>{n.num}</i>
                {n.label}
              </span>
            ),
          )}
        </nav>
        )}
        <span className="demo-tag">Demo data</span>
        {persona && (
          <p className="persona-line">
            {persona.name}
            {persona.org ? (
              <>
                <br />
                <span>{persona.org}</span>
              </>
            ) : null}
          </p>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ flush = false }: { flush?: boolean }) {
  return (
    <footer className={`site-footer${flush ? " flush" : ""}`}>
      <div className="wrap site-footer-inner">
        <div>
          <span className="serif it" style={{ fontSize: 28, lineHeight: 1 }}>
            sila
          </span>
          <span>
            A prototype for the Qloo Agentic Hackathon. Venues, groups, programmes and the sandbox&apos;s reservations
            are illustrative; shared-interest percentages, timetables and interest counts are demonstration content.
            No payment is collected, and no real venue approval is implied.
          </span>
        </div>
        <div className="credits">
          <span className="kicker" style={{ fontSize: 10.5, fontWeight: 600 }}>
            Picture credits
          </span>
          <span>{ALL_CREDITS}</span>
        </div>
      </div>
    </footer>
  );
}

export function Glyph({ bg, size }: { bg: string; size?: number }) {
  return <span aria-hidden="true" className="glyph" style={{ background: bg, ...(size ? { width: size, height: size } : null) }} />;
}

export function ArrowRight() {
  return (
    <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function ArrowLeft() {
  return (
    <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

export function ArrowDown() {
  return (
    <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16 }}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

/** One title line inside a mask, rising into place. */
export function RevealLines({ lines, delayStep = 0 }: { lines: Array<{ t: string; italic: boolean }>; delayStep?: number }) {
  return (
    <>
      {lines.map((ln, i) => (
        <span key={i} className="line-mask">
          <span data-reveal="line" data-delay={delayStep ? i * delayStep : undefined} style={{ fontStyle: ln.italic ? "italic" : "normal" }}>
            {ln.t}
          </span>
        </span>
      ))}
    </>
  );
}
