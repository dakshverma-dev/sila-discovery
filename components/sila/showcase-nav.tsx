"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** i Discover · ii Affinity · iii Proposal for a demo showcase experience. */
export function ShowcaseNav() {
  const path = usePathname();
  const m = /^\/showcase\/([^/]+)(\/[^/]+)?/.exec(path);
  const id = m?.[1];
  const sub = m?.[2];
  const items = [
    { num: "i", label: "Discover", href: "/#index", on: false },
    { num: "ii", label: "Affinity", href: id ? `/showcase/${id}/affinity` : null, on: sub === "/affinity" },
    { num: "iii", label: "Proposal", href: id ? `/showcase/${id}` : null, on: !!id && sub !== "/affinity" },
  ];
  return (
    <nav aria-label="Sections" className="site-nav">
      {items.map((n) =>
        n.href ? (
          <Link key={n.label} href={n.href} aria-current={n.on ? "page" : undefined}>
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
  );
}
