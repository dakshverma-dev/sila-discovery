"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
type Candidate = {
  entityId: string;
  name: string;
  type: string;
  proof: string;
};
export function DiscoveryForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  async function search(value = query) {
    if (value.trim().length < 2 || searching || busy) return;
    setQuery(value);
    setSearchError("");
    setSearching(true);
    setCandidates([]);
    try {
      const response = await fetch(
        `/api/interests?q=${encodeURIComponent(value.trim())}`,
        { signal: AbortSignal.timeout(20000) },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Interest search failed.");
      setCandidates(data.candidates);
      if (!data.candidates.length)
        setSearchError(
          "No matches. Try a specific film, musician, author or place.",
        );
    } catch (error) {
      setSearchError(
        error instanceof Error
          ? error.message
          : "Search unavailable. Please retry.",
      );
    } finally {
      setSearching(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selected.length) {
      setError("Search for an interest and select at least one result.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const amount = String(form.get("budget"));
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setError("Enter a GBP budget with no more than two decimal places.");
      return;
    }
    const [pounds = "0", pennies = ""] = amount.split(".");
    setBusy(true);
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(40000),
        body: JSON.stringify({
          clubName: form.get("clubName"),
          city: "Edinburgh",
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          places: Number(form.get("places")),
          maxPricePence: Number(pounds) * 100 + Number(pennies.padEnd(2, "0")),
          interestEntityIds: selected.map((i) => i.entityId),
          interestProofs: selected.map((i) => i.proof),
          useAssistant: form.get("assistant") === "on",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Discovery failed.");
      router.push(`/discover/results?run=${encodeURIComponent(data.runId)}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Discovery unavailable. Please retry.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="sd-form" onSubmit={submit} aria-busy={busy}>
      <div className="sd-form-head">
        <span className="sd-kicker">Your next club outing</span>
        <span>01 / A little about you</span>
      </div>
      <label htmlFor="club-name">What’s your club called?</label>
      <input
        id="club-name"
        name="clubName"
        defaultValue="Edinburgh Curious Club"
        required
        minLength={2}
        maxLength={80}
        disabled={busy}
      />
      <fieldset disabled={busy}>
        <legend>What brings you together?</legend>
        <p className="sd-help">
          Pick up to three real films, artists, authors or places. Qloo connects
          your tastes across culture.
        </p>
        <div className="sd-search">
          <input
            id="interest-query"
            aria-label="Search cultural interests"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="A film you love. An artist you follow…"
            maxLength={100}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={searching || query.trim().length < 2}
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="sd-quick">
          <span>Try</span>
          {["Spirited Away", "Miles Davis", "Virginia Woolf"].map((name) => (
            <button
              key={name}
              type="button"
              disabled={searching}
              onClick={() => void search(name)}
            >
              {name} ↗
            </button>
          ))}
        </div>
        {searchError && (
          <p role="alert" className="sd-error">
            {searchError}
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="sd-candidates" aria-label="Qloo search results">
            {candidates.map((c) => (
              <li key={c.entityId}>
                <button
                  type="button"
                  disabled={
                    selected.length >= 3 ||
                    selected.some((s) => s.entityId === c.entityId)
                  }
                  onClick={() => {
                    setSelected([...selected, c]);
                    setCandidates([]);
                    setQuery("");
                  }}
                >
                  <span>
                    {c.name}
                    <small>
                      {c.type.replace("urn:entity:", "").replaceAll("_", " ")}
                    </small>
                  </span>
                  <span aria-hidden="true">＋</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="sd-selected" aria-live="polite">
          {selected.map((c) => (
            <button
              key={c.entityId}
              type="button"
              aria-label={`Remove ${c.name}`}
              onClick={() =>
                setSelected(selected.filter((s) => s.entityId !== c.entityId))
              }
            >
              {c.name} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="sd-fields">
        <label>
          Places for your club
          <input
            name="places"
            type="number"
            defaultValue="7"
            min="1"
            max="12"
            step="1"
            required
            disabled={busy}
          />
        </label>
        <label>
          Budget per person (£)
          <input
            name="budget"
            type="number"
            defaultValue="35"
            min="0"
            max="1000"
            step="0.01"
            required
            disabled={busy}
          />
        </label>
        <label>
          From
          <input
            name="startDate"
            type="date"
            defaultValue="2026-11-19"
            required
            disabled={busy}
          />
        </label>
        <label>
          Until
          <input
            name="endDate"
            type="date"
            defaultValue="2026-11-22"
            required
            disabled={busy}
          />
        </label>
      </div>
      <label className="sd-check">
        <input type="checkbox" name="assistant" disabled={busy} />
        <span>
          Let Claude inspect the discovery tools
          <small>
            Optional. If unavailable, results stay clearly labelled as direct
            Qloo discovery.
          </small>
        </span>
      </label>
      {error && (
        <p className="sd-error" role="alert">
          {error}{" "}
          <a href="/discover/catalogue">Browse the fictional collection</a>.
        </p>
      )}
      <button className="sd-primary" type="submit" disabled={busy || searching}>
        {busy
          ? "Finding your shared possibilities…"
          : "Find our next experience"}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="sd-help sd-under" role="status">
        {busy
          ? "Searching real Qloo affinities, then checking dates, budget and sample capacity. This can take up to 30 seconds."
          : "Edinburgh only · 19–22 November sample sessions · no sign-up needed"}
      </p>
    </form>
  );
}
