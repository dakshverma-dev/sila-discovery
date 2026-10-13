"use client";

import { useEffect } from "react";

/*
 * sila's motion layer, ported from Design/Sila v2.dc.html: plates unfold
 * (wipe, fan, quarter fan, circle), title lines rise, art drifts with scroll
 * (data-speed) and pointer (data-depth, data-lamp), and the reservation
 * ticket prints. Elements are picked up as they appear, so server-rendered
 * pages and client navigations both animate. Nothing runs with reduced motion.
 */

const OUT = (x: number) => 1 - Math.pow(1 - x, 3.2);
const INOUT = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const SPRING = (x: number) => 1 - Math.exp(-6.5 * x) * Math.cos(10 * x);

interface Tween {
  el: object;
  tag: string;
  t0: number;
  dur: number;
  ease: (x: number) => number;
  apply: (p: number) => void;
  done?: () => void;
}

function maskFor(type: string, a: number): string | null {
  if (type === "fan") return `conic-gradient(from 270deg at 50% 100%, #000 0deg ${a * 180}deg, transparent ${a * 180}deg 360deg)`;
  if (type === "qfan") return `conic-gradient(from 270deg at 100% 100%, #000 0deg ${a * 90}deg, transparent ${a * 90}deg 360deg)`;
  if (type === "circle") return `conic-gradient(from 200deg at 50% 50%, #000 0deg ${a * 360}deg, transparent ${a * 360}deg 360deg)`;
  return null;
}

export function Motion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (reduced) {
      root.classList.remove("js-motion");
      return;
    }
    root.classList.add("js-motion");

    let tweens: Tween[] = [];
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    let speedEls: HTMLElement[] = [];
    let depthEls: HTMLElement[] = [];
    let lampEls: HTMLElement[] = [];

    const tween = (el: object, dur: number, delay: number, ease: Tween["ease"], apply: Tween["apply"], done: Tween["done"], tag: string) => {
      tweens = tweens.filter((t) => !(t.el === el && t.tag === tag));
      const t: Tween = { el, tag, t0: performance.now() + delay, dur, ease, apply, done };
      tweens.push(t);
      apply(0);
      // rAF doesn't run in hidden documents: guarantee the end state regardless.
      window.setTimeout(() => {
        if (tweens.includes(t)) {
          tweens = tweens.filter((x) => x !== t);
          t.apply(1);
          t.done?.();
        }
      }, delay + dur + 120);
    };

    const setMask = (el: HTMLElement, type: string, a: number) => {
      if (type === "wipe") {
        el.style.clipPath = a >= 1 ? "" : `inset(${((1 - a) * 100).toFixed(2)}% 0 0 0)`;
        return;
      }
      const m = a >= 1 ? "" : maskFor(type, a) ?? "";
      el.style.maskImage = m;
      el.style.setProperty("-webkit-mask-image", m);
    };

    const unfold = (el: HTMLElement, i: number) => {
      const type = el.dataset.unfold ?? "wipe";
      tween(el, type === "wipe" ? 1100 : 1250, 80 + i * 85, type === "wipe" ? INOUT : OUT, (p) => setMask(el, type, p), () => setMask(el, type, 1), "unfold");
    };
    const reveal = (el: HTMLElement, i: number) => {
      tween(el, 1050, Number(el.dataset.delay ?? 0) + i * 70, OUT, (p) => { el.style.translate = `0 ${((1 - p) * 110).toFixed(2)}%`; }, () => { el.style.translate = ""; }, "reveal");
    };

    const io = new IntersectionObserver(
      (ents) => {
        let i = 0, j = 0;
        for (const en of ents) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          io.unobserve(el);
          if (el.hasAttribute("data-unfold")) unfold(el, j++);
          else reveal(el, i++);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    const printTicket = (t: HTMLElement) => {
      tween(t, 1300, 120, INOUT, (p) => {
        t.style.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)`;
        t.style.translate = `0 ${((1 - p) * -18).toFixed(1)}px`;
      }, () => { t.style.clipPath = ""; t.style.translate = ""; }, "print");
    };
    const stamp = (s: HTMLElement) => {
      tween(s, 900, 1350, SPRING, (p) => {
        s.style.opacity = String(Math.min(1, p * 2));
        s.style.scale = String(1.9 - 0.9 * p);
      }, () => { s.style.opacity = ""; s.style.scale = ""; }, "stamp");
    };

    const scan = () => {
      const vh = window.innerHeight;
      const nowU: HTMLElement[] = [];
      document.querySelectorAll<HTMLElement>("[data-unfold]:not([data-uf])").forEach((el) => {
        el.setAttribute("data-uf", "");
        const b = el.getBoundingClientRect();
        if (b.top < vh && b.bottom > 0) nowU.push(el);
        else { setMask(el, el.dataset.unfold ?? "wipe", 0); io.observe(el); }
      });
      nowU.forEach(unfold);
      const nowR: HTMLElement[] = [];
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-rv])").forEach((el) => {
        el.setAttribute("data-rv", "");
        const b = (el.parentElement ?? el).getBoundingClientRect();
        if (b.top < vh && b.bottom > 0) nowR.push(el);
        else { el.style.translate = "0 110%"; io.observe(el); }
      });
      nowR.forEach(reveal);
      document.querySelectorAll<HTMLElement>("[data-print]:not([data-pr])").forEach((el) => { el.setAttribute("data-pr", ""); printTicket(el); });
      document.querySelectorAll<HTMLElement>("[data-stamp]:not([data-pr])").forEach((el) => { el.setAttribute("data-pr", ""); stamp(el); });
      speedEls = [...document.querySelectorAll<HTMLElement>("[data-speed]")];
      depthEls = [...document.querySelectorAll<HTMLElement>("[data-depth]")];
      lampEls = [...document.querySelectorAll<HTMLElement>("[data-lamp]")];
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      if (tweens.length) {
        const fin: Tween[] = [];
        for (const t of tweens.slice()) {
          const p = Math.min(1, Math.max(0, (now - t.t0) / t.dur));
          t.apply(t.ease(p));
          if (p >= 1) fin.push(t);
        }
        if (fin.length) {
          tweens = tweens.filter((t) => !fin.includes(t));
          fin.forEach((t) => t.done?.());
        }
      }
      mx += (tmx - mx) * 0.07;
      my += (tmy - my) * 0.07;
      const vh = window.innerHeight;
      for (const el of speedEls) {
        const sp = Number(el.dataset.speed);
        if (!sp || !el.parentElement) continue;
        const p = el.parentElement.getBoundingClientRect();
        if (p.bottom < -200 || p.top > vh + 200) continue;
        el.style.translate = `0 ${((p.top + p.height / 2 - vh / 2) * sp).toFixed(1)}px`;
      }
      for (const el of depthEls) {
        const d = Number(el.dataset.depth);
        if (d) el.style.translate = `${(mx * d).toFixed(2)}px ${(my * d).toFixed(2)}px`;
      }
      for (const el of lampEls) el.style.translate = `${(-mx * 46).toFixed(1)}px ${(-my * 26 + 10).toFixed(1)}px`;
    };

    const onMouse = (e: MouseEvent) => {
      tmx = e.clientX / window.innerWidth - 0.5;
      tmy = e.clientY / window.innerHeight - 0.5;
    };
    let pending = false;
    const mo = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; scan(); });
    });

    scan();
    loop();
    window.addEventListener("mousemove", onMouse);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
