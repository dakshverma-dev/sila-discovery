"use client";

import { useRef, useState } from "react";

/**
 * Copies plain text to the clipboard and says so in a polite live region.
 * The text is built on the server from this plan only, so it carries no other
 * club's information and no organiser email.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    let message = "Copied";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      message = "Could not copy. Select the text in the box below and copy it.";
    }
    setStatus(message);
    if (timer.current) clearTimeout(timer.current);
    if (message === "Copied") timer.current = setTimeout(() => setStatus(""), 4000);
  }

  return (
    <span className="pn-copy">
      <button type="button" className="button button-secondary" onClick={copy}>
        {label}
      </button>
      <span role="status" aria-live="polite" className="pn-copy-status">
        {status}
      </span>
      {status.startsWith("Could not") ? (
        <textarea readOnly rows={6} value={text} aria-label={`${label}: text to copy`} onFocus={(e) => e.currentTarget.select()} />
      ) : null}
    </span>
  );
}
