"use client";

import { useActionState, useEffect, useRef } from "react";
import type { VenueActionState } from "@/lib/sila/venue-forms";

/** A pending state, visible errors and retained input for consequential venue actions (§24, §30). */
export function CommandForm({ action, children, idempotencyKey, label, className = "stack" }: {
  action: (state: VenueActionState, data: FormData) => Promise<VenueActionState>;
  children: React.ReactNode;
  idempotencyKey: string;
  label?: string;
  className?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const feedbackId = `venue-feedback-${idempotencyKey}`;
  useEffect(() => {
    if (form.current) for (const element of form.current.elements) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
      if (element instanceof HTMLInputElement && element.type === "hidden") continue;
      if (state.fieldErrors?.[element.name]?.length) {
        element.setAttribute("aria-invalid", "true");
        element.setAttribute("aria-describedby", `${feedbackId}-${element.name}`);
      } else if (element.getAttribute("aria-invalid") === "true") {
        element.removeAttribute("aria-invalid");
        if (element.getAttribute("aria-describedby")?.startsWith(feedbackId)) element.removeAttribute("aria-describedby");
      }
    }
    if (state.error && state.values && form.current) {
      for (const element of form.current.elements) {
        if (element instanceof HTMLInputElement && element.type === "hidden") continue;
        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          element.checked = state.values[element.name] === element.value;
        } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
          if (element.name in state.values) element.value = state.values[element.name]!;
        }
      }
    }
    if (state.error || state.notice) feedback.current?.focus();
  }, [state, feedbackId]);
  return (
    <form ref={form} action={submit} className={className} aria-label={label} noValidate>
      <input type="hidden" name="idempotency_key" value={state.key ?? idempotencyKey} />
      {(state.error || state.notice) ? (
        <div ref={feedback} tabIndex={-1} className={state.error ? "flash flash-error" : "flash flash-notice"}
          role={state.error ? "alert" : "status"}>
          <p>{state.error ?? state.notice}</p>
          {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 ? <ul>
            {Object.entries(state.fieldErrors).map(([name, errors]) =>
              <li key={name} id={`${feedbackId}-${name}`}>{name.replaceAll("_", " ")}: {errors.join(" ")}</li>)}
          </ul> : null}
          {state.blockers?.length ? <ul>{state.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        </div>
      ) : null}
      <fieldset disabled={pending || state.receiptSaved} className="stack">
        {children}
      </fieldset>
      {pending ? <p role="status">Saving…</p> : null}
    </form>
  );
}
