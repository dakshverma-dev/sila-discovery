"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * "Register interest" from sila v2. The application has no interest concept
 * yet, so this is a per-browser preference only: it is never sent to the
 * server and never counts toward a venue minimum (the marks say "not counted").
 */

const EVT = "sila-interest";
const keyOf = (id: string) => `sila:interest:${id}`;

function read(id: string): boolean {
  try {
    return window.localStorage.getItem(keyOf(id)) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useInterest(id: string): [boolean, () => void] {
  const on = useSyncExternalStore(subscribe, () => read(id), () => false);
  const toggle = useCallback(() => {
    try {
      if (read(id)) window.localStorage.removeItem(keyOf(id));
      else window.localStorage.setItem(keyOf(id), "1");
    } catch {
      /* storage unavailable: the toggle simply does nothing */
    }
    window.dispatchEvent(new Event(EVT));
  }, [id]);
  return [on, toggle];
}

export function InterestToggle({ id, variant }: { id: string; variant: "band" | "proposal" }) {
  const [on, toggle] = useInterest(id);
  if (variant === "band") {
    return (
      <button type="button" onClick={toggle} aria-pressed={on} className="link-under">
        {on ? "Interested ✓" : "I’m interested"}
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={on} className="btn-line lg">
      {on ? "Interested ✓" : "Register interest"}
    </button>
  );
}

const INK = "oklch(0.22 0.02 50)";
const YOU = "oklch(0.58 0.17 35)";

/** One mark per place: committed (ink), you (cinnabar), interested (outlined, not counted), open (dotted). */
export function Marks({
  id,
  capacity,
  required,
  others,
  mine,
  interested,
  small = false,
}: {
  id: string;
  capacity: number;
  required: number;
  others: number;
  mine: number;
  interested: number;
  small?: boolean;
}) {
  const [toggled] = useInterest(id);
  const myInt = toggled && mine === 0;
  const totalInt = interested + (myInt ? 1 : 0);
  let intLeft = totalInt;
  const marks = [];
  for (let i = 0; i < capacity; i++) {
    let f = "transparent";
    let b = "oklch(0.22 0.02 50 / .45)";
    let s = "dotted";
    if (i < others) {
      f = INK;
      b = INK;
      s = "solid";
    } else if (i < others + mine) {
      f = YOU;
      b = YOU;
      s = "solid";
    } else if (intLeft > 0) {
      s = "solid";
      b = myInt && intLeft === totalInt ? YOU : INK;
      intLeft--;
    }
    marks.push(<span key={i} style={{ background: f, borderColor: b, borderStyle: s, marginLeft: i === required ? 9 : 0 }} />);
  }
  const reserved = others + mine;
  return (
    <div
      role="img"
      aria-label={`${reserved} reserved, ${totalInt} interested (illustrative, not counted), minimum ${required}, capacity ${capacity}`}
      className={`marks${small ? " sm" : ""}`}
    >
      {marks}
    </div>
  );
}
