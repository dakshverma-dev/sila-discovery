import type { MyPlanView } from "@/lib/sila/commands/plans";
import { london } from "@/lib/sila/plan-copy";
import { MessageForm, type FormFlash } from "./plan-forms";

export type MessagePrefill = "quantity" | "session" | "change" | "";

/** Starting text for a message opened from a link (no health or access-note prompts). */
export const MESSAGE_PREFILL: Record<Exclude<MessagePrefill, "">, string> = {
  quantity: "Could we ask for a different number of places? We would prefer ___ places.",
  session: "Our session will not go ahead. Could you tell us about another session we could join?",
  change: "We would like to ask for a change to our booking: ",
};

/** The conversation with the venue about this plan, and the form to add to it. */
export function PlanMessages({
  view,
  idemKey,
  prefill,
  flash,
}: {
  view: MyPlanView;
  idemKey: string;
  prefill: MessagePrefill;
  flash: FormFlash | null;
}) {
  const author = (m: MyPlanView["messages"][number]) =>
    m.from_me ? "You" : m.author_role === "venue" ? view.session.venue.name : "Sila team";
  return (
    <section className="stack" aria-labelledby="messages-heading">
      <h2 id="messages-heading">Messages</h2>
      <p className="muted">Only you and the venue can see this conversation. Other clubs cannot.</p>
      <div id="conversation">
        {view.messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <ol className="pn-messages">
            {view.messages.map((m) => (
              <li key={m.id} className={m.from_me ? "pn-msg pn-msg-mine" : "pn-msg"}>
                <p className="pn-msg-meta">
                  <strong>{author(m)}</strong> · <time dateTime={m.created_at}>{london(m.created_at)}</time>
                </p>
                <p className="pn-pre">{m.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <MessageForm
        planId={view.plan.id}
        idemKey={idemKey}
        prefill={prefill ? MESSAGE_PREFILL[prefill] : ""}
        flash={flash}
      />
    </section>
  );
}
