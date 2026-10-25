"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RequestButton({
  runId,
  sessionId,
  places,
  pricePence,
  version,
}: {
  runId: string;
  sessionId: string;
  places: number;
  pricePence: number;
  version: number;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function request() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/place-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          runId,
          sessionId,
          places,
          expectedPricePence: pricePence,
          expectedVersion: version,
          requestKey: key,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Request could not be saved.");
      router.push(`/requests/${data.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Request could not be saved. Please retry.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="sd-primary"
        onClick={() => void request()}
        disabled={busy}
      >
        {busy
          ? "Checking & saving…"
          : `Request ${places} conditional sample places`}
        <span aria-hidden="true">↗</span>
      </button>
      {error && (
        <p className="sd-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
