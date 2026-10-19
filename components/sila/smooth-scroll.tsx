"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Eased, inertial page scrolling (Lenis). Off with prefers-reduced-motion; native scrolling then applies. */
export function SmoothScroll() {
  const lenis = useRef<Lenis | null>(null);
  const path = usePathname();

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      lenis.current?.destroy(); lenis.current = null;
      if (!preference.matches) lenis.current = new Lenis({ autoRaf: true, anchors: { offset: -68 }, lerp: 0.09, wheelMultiplier: 1 });
    };
    const navigate = () => lenis.current?.scrollTo(window.scrollY, { immediate: true });
    sync();
    preference.addEventListener("change", sync);
    window.addEventListener("sila:navigated", navigate);
    return () => {
      preference.removeEventListener("change", sync);
      window.removeEventListener("sila:navigated", navigate);
      lenis.current?.destroy();
      lenis.current = null;
    };
  }, []);

  // A new page starts at the top, without gliding there from the old position.
  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true });
  }, [path]);

  return null;
}
