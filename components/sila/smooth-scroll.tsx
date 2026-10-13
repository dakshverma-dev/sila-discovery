"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Eased, inertial page scrolling (Lenis). Off with prefers-reduced-motion; native scrolling then applies. */
export function SmoothScroll() {
  const lenis = useRef<Lenis | null>(null);
  const path = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ autoRaf: true, anchors: { offset: -64 }, lerp: 0.09, wheelMultiplier: 1 });
    lenis.current = l;
    return () => {
      l.destroy();
      lenis.current = null;
    };
  }, []);

  // A new page starts at the top, without gliding there from the old position.
  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true });
  }, [path]);

  return null;
}
