"use client";

import { useActionState, useState } from "react";
import { requestPlaces } from "@/app/s/[id]/actions";
import { formatGBP, groupAmounts } from "@/lib/sila/money";
import type { RequestFormState, RequestFormValues } from "@/lib/sila/request-form";

/**
 * O1 — Request the published session. Inputs are controlled so a rejected
 * submit keeps what the organiser typed (React resets uncontrolled forms after an action).
 * The price summary is an estimate for the reader; the server recomputes every amount.
 */
export function RequestForm({
  sessionId,
  idempotencyKey,
  source,
  priceMinor,
  depositBp,
  capacity,
  defaults,
  accessHref,
}: {
  sessionId: string;
  idempotencyKey: string;
  source: string;
  priceMinor: number;
  depositBp: number;
  capacity: number;
  defaults: RequestFormValues;
  /** A mailto:, tel: or in-page link to the venue's contact details. */
  accessHref: string;
}) {
  const initial: RequestFormState = {
    status: "idle",
    message: null,
    fields: {},
    values: defaults,
    key: idempotencyKey,
    sentTo: null,
  };
  const [state, formAction, pending] = useActionState(requestPlaces, initial);
  const [clubName, setClubName] = useState(defaults.clubName);
  const [places, setPlaces] = useState(defaults.places);
  const [email, setEmail] = useState(defaults.email);

  const count = /^\d{1,4}$/.test(places.trim()) ? Number(places.trim()) : 0;
  const valid = count >= 1 && count <= capacity;
  const amounts = valid ? groupAmounts(priceMinor, count, depositBp) : null;
  const err = state.status === "error" ? state.fields : {};

  if (state.status === "saved") {
    return (
      <section className="stack" aria-labelledby="request-heading">
        <h2 id="request-heading">Request group places</h2>
        <p className="flash flash-notice" role="status">
          <strong>Check your email. Your request is saved.</strong>
          <br />
          We sent a one-time link to {state.sentTo}. It brings you back to send this request for {state.values.clubName}.
        </p>
        <p className="muted">Nothing has been requested yet, committed or paid.</p>
      </section>
    );
  }

  return (
    <section className="stack" aria-labelledby="request-heading">
      <h2 id="request-heading">Request group places</h2>
      <form action={formAction} className="stack" noValidate>
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="idempotency_key" value={state.key} />
        <input type="hidden" name="source" value={source} />

        {state.status === "error" && state.message ? (
          <p className="flash flash-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="club_name">Club name</label>
          <input
            id="club_name"
            name="club_name"
            autoComplete="organization"
            required
            maxLength={120}
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            aria-invalid={err.clubName ? true : undefined}
            aria-describedby={err.clubName ? "club_name-error" : undefined}
          />
          {err.clubName ? (
            <span id="club_name-error" className="muted" role="alert">
              {err.clubName}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="places">Places requested</label>
          <input
            id="places"
            name="places"
            inputMode="numeric"
            autoComplete="off"
            required
            value={places}
            onChange={(e) => setPlaces(e.target.value)}
            aria-invalid={err.places ? true : undefined}
            aria-describedby={err.places ? "places-error places-help" : "places-help"}
          />
          <span id="places-help" className="muted">
            Up to {capacity}. Requesting places does not reserve them.
          </span>
          {err.places ? (
            <span id="places-error" className="muted" role="alert">
              {err.places}
            </span>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="email">Organiser email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={err.email ? true : undefined}
            aria-describedby={err.email ? "email-error" : undefined}
          />
          {err.email ? (
            <span id="email-error" className="muted" role="alert">
              {err.email}
            </span>
          ) : null}
        </div>

        <div className="pn-box" aria-live="polite" data-testid="request-summary">
          {amounts ? (
            <>
              <strong>Your group total {formatGBP(amounts.totalMinor)}</strong>
              <span>Deposit {formatGBP(amounts.depositMinor)} only if the minimum is reached.</span>
            </>
          ) : (
            <span>Enter a number of places to see your group total.</span>
          )}
        </div>

        <p>This requests venue approval. You have not committed or paid.</p>

        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? "Sending…" : valid ? `Request ${count} ${count === 1 ? "place" : "places"}` : "Request places"}
        </button>

        <p className="muted">
          We verify your email with a one-time link and return you here. Your request is saved while you do.
        </p>
        <p className="muted">
          <a href={accessHref}>Access questions? Contact the venue</a>
        </p>
      </form>
    </section>
  );
}
