import { commitAction, messageAction, reportPaymentAction, withdrawAction } from "@/app/plans/[id]/actions";
import { planErrorMessage } from "@/lib/sila/plan-copy";

/**
 * The organiser's plan-page forms. Every form posts a hidden idempotency key
 * made when the page rendered; a rejection redirects back here, the page
 * renders again and the next attempt gets a fresh key. Server components.
 */

export interface FormFlash {
  form: string;
  code: string;
  /** Fields the page was told to flag, from a fixed list (never free text from the URL). */
  fields: string[];
  values: { amount?: string; reference?: string };
}

const FIELD_COPY: Record<string, string> = {
  reason: "Tell the venue briefly why you are withdrawing.",
  amount: "Enter an amount in pounds, such as 61.25.",
  reference: "Enter the payment reference you used.",
  body: "Write a message of 1 to 2000 characters.",
};

function FormError({ flash, form }: { flash: FormFlash | null; form: string }) {
  if (!flash || (flash.form !== form && !(form === "commit" && flash.form === "generic"))) return null;
  return (
    <p className="flash flash-error" role="alert">
      {planErrorMessage(flash.code)}
    </p>
  );
}

function FieldError({ id, flash, form, field }: { id: string; flash: FormFlash | null; form: string; field: string }) {
  if (!flash || flash.form !== form || !flash.fields.includes(field)) return null;
  return (
    <span id={id} className="muted pn-field-error" role="alert">
      {FIELD_COPY[field]}
    </span>
  );
}

const flagged = (flash: FormFlash | null, form: string, field: string) =>
  flash?.form === form && flash.fields.includes(field) ? true : undefined;

export function CommitForm({
  planId,
  idemKey,
  places,
  termsVersion,
  minimum,
  flash,
}: {
  planId: string;
  idemKey: string;
  places: number;
  termsVersion: number;
  minimum: number;
  flash: FormFlash | null;
}) {
  return (
    <form action={commitAction} className="stack-sm">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="idempotency_key" value={idemKey} />
      <input type="hidden" name="places" value={places} />
      <input type="hidden" name="terms_version" value={termsVersion} />
      <FormError flash={flash} form="commit" />
      <button type="submit" className="button button-primary">
        Commit {places} places if the session reaches {minimum}
      </button>
    </form>
  );
}

export function WithdrawControl({
  planId,
  idemKey,
  version,
  paymentOpen,
  places,
  flash,
}: {
  planId: string;
  idemKey: string;
  /** The plan version the organiser is looking at; opening payment bumps it, so a stale page is refused. */
  version: number;
  paymentOpen: boolean;
  places: number;
  flash: FormFlash | null;
}) {
  const label = paymentOpen
    ? "Ask to withdraw (the venue's cancellation policy applies)"
    : "Withdraw before payment opens";
  return (
    <details open={flash?.form === "withdraw" ? true : undefined}>
      <summary>{label}</summary>
      <form action={withdrawAction} className="stack-sm details-body">
        <input type="hidden" name="plan_id" value={planId} />
        <input type="hidden" name="idempotency_key" value={idemKey} />
        <input type="hidden" name="expected_version" value={version} />
        <p className="muted">
          {paymentOpen
            ? "The venue reviews your request under its cancellation policy. Payment already requested stays due until the venue says otherwise."
            : `Your ${places} conditional places are released. You have paid nothing, so there is nothing to refund.`}
        </p>
        <FormError flash={flash} form="withdraw" />
        <div className="field">
          <label htmlFor="withdraw-reason">Reason (required)</label>
          <textarea
            id="withdraw-reason"
            name="reason"
            rows={3}
            maxLength={600}
            required
            aria-invalid={flagged(flash, "withdraw", "reason")}
            aria-describedby={flagged(flash, "withdraw", "reason") ? "withdraw-reason-error" : undefined}
          />
          <FieldError id="withdraw-reason-error" flash={flash} form="withdraw" field="reason" />
        </div>
        <button type="submit" className="button button-destructive">
          {paymentOpen ? "Send withdrawal request" : `Withdraw ${places} places`}
        </button>
      </form>
    </details>
  );
}

export function PaidForm({
  planId,
  allocationId,
  idemKey,
  suggestedAmount,
  flash,
  summary,
}: {
  planId: string;
  allocationId: string;
  idemKey: string;
  /** Pounds, e.g. "61.25"; the outstanding deposit. */
  suggestedAmount: string;
  flash: FormFlash | null;
  /** When set, the form sits inside a details element with this summary. */
  summary?: string;
}) {
  const form = (
    <form action={reportPaymentAction} className="stack-sm">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="allocation_id" value={allocationId} />
      <input type="hidden" name="idempotency_key" value={idemKey} />
      <FormError flash={flash} form="paid" />
      <div className="field">
        <label htmlFor="paid-amount">Amount paid (GBP)</label>
        <input
          id="paid-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={flash?.values.amount ?? suggestedAmount}
          aria-invalid={flagged(flash, "paid", "amount")}
          aria-describedby={flagged(flash, "paid", "amount") ? "paid-amount-error" : undefined}
        />
        <FieldError id="paid-amount-error" flash={flash} form="paid" field="amount" />
      </div>
      <div className="field">
        <label htmlFor="paid-reference">Payment reference</label>
        <input
          id="paid-reference"
          name="reference"
          autoComplete="off"
          required
          maxLength={100}
          defaultValue={flash?.values.reference ?? ""}
          aria-invalid={flagged(flash, "paid", "reference")}
          aria-describedby={flagged(flash, "paid", "reference") ? "paid-reference-error" : undefined}
        />
        <FieldError id="paid-reference-error" flash={flash} form="paid" field="reference" />
      </div>
      <button type="submit" className="button button-primary">
        I have paid
      </button>
    </form>
  );
  if (!summary) return form;
  return (
    <details open={flash?.form === "paid" ? true : undefined}>
      <summary>{summary}</summary>
      <div className="details-body">{form}</div>
    </details>
  );
}

export function MessageForm({
  planId,
  idemKey,
  prefill,
  flash,
}: {
  planId: string;
  idemKey: string;
  prefill: string;
  flash: FormFlash | null;
}) {
  return (
    <form id="message" action={messageAction} className="stack-sm">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="idempotency_key" value={idemKey} />
      <FormError flash={flash} form="message" />
      <div className="field">
        <label htmlFor="message-body">Message the venue</label>
        <textarea
          id="message-body"
          name="body"
          rows={4}
          maxLength={2000}
          required
          defaultValue={prefill}
          aria-invalid={flagged(flash, "message", "body")}
          aria-describedby={flagged(flash, "message", "body") ? "message-body-error" : "message-help"}
        />
        <span id="message-help" className="muted">
          Please do not include health or medical details. For access arrangements, contact the venue directly.
        </span>
        <FieldError id="message-body-error" flash={flash} form="message" field="body" />
      </div>
      <button type="submit" className="button button-primary">
        Send message
      </button>
    </form>
  );
}
