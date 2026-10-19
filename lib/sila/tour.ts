/** Browser-only synthetic presentation. Never used by booking commands (§21, §27). */
export type TourActor = "venue" | "club-a" | "club-b" | "clock";
export interface TourState { step: number; scenario: "booking" | "refund"; actor: Exclude<TourActor, "clock"> }
export interface TourStep { title: string; explanation: string; action: string; actor: TourActor; date: string }

export const TOUR_STEPS: TourStep[] = [
  { title: "A session ready to share", explanation: "The venue sets the date, price, minimum and terms. It approves the room, instructor and staffed deadlines before publication.", action: "Publish the demo session", actor: "venue", date: "23 October" },
  { title: "A club finds its session", explanation: "The organiser requests exact places. There is no member list, and no one is committed yet.", action: "Request 7 places", actor: "club-a", date: "23 October" },
  { title: "A small venue decision", explanation: "The venue reviews whether this club and quantity suit the session. Approval is an invitation; it does not reserve places.", action: "Approve 7 places and invite", actor: "venue", date: "24 October" },
  { title: "A conditional commitment", explanation: "The organiser sees the full price, deposit, decision date and withdrawal terms before agreeing. No payment is due yet.", action: "Commit 7 places if the session reaches 16", actor: "club-a", date: "24 October" },
  { title: "Seven places. Nine still needed.", explanation: "The first club can see what it is waiting for. Another club is introduced manually; its organiser makes its own request.", action: "Request the other 9 places", actor: "club-b", date: "4 November · 10:30 London" },
  { title: "The second club is reviewed", explanation: "The venue approves nine places on the same published terms. Each club keeps its own contact, invoice and conversation private.", action: "Approve 9 places and invite", actor: "venue", date: "4 November · 10:45 London" },
  { title: "The second organiser decides", explanation: "Nine more places will reach the minimum. Only this club's organiser can make its commitment.", action: "Commit 9 places if the session reaches 16", actor: "club-b", date: "4 November · 11:00 London" },
  { title: "Minimum reached. Still conditional.", explanation: "The contributing clubs are frozen. At the 11:00 cutoff, payment is scheduled for the next covered business day at 11:45. This is not a confirmed booking.", action: "Preview the staffed payment opening", actor: "clock", date: "5 November · 11:45 London" },
  { title: "Pay the venue directly", explanation: "The club pays its own £61.25 deposit to the venue by 10 November at noon. Sila does not collect card details or hold the money.", action: "Report the demo deposit payment", actor: "club-a", date: "9 November" },
  { title: "Reported is different from verified", explanation: "The venue checks when the money actually arrived. Staff checking later does not make a timely payment late.", action: "Verify the £61.25 demo receipt", actor: "venue", date: "11 November · 10:00 London" },
  { title: "Each club has its own obligation", explanation: "Club B reports its £78.75 deposit, which reached the venue on 10 November at 11:00. Neither club takes on the other's payment.", action: "Report the second demo deposit", actor: "club-b", date: "11 November · 10:05 London" },
  { title: "Check the second receipt", explanation: "The venue records the receipt once, keeping actual receipt time separate from verification time. The session remains conditional.", action: "Verify the £78.75 demo receipt", actor: "venue", date: "11 November · 10:15 London" },
  { title: "One final venue check", explanation: "Both deposits are verified. The venue checks its external diary and resource hold, then confirms the session.", action: "Diary checked — confirm demo booking", actor: "venue", date: "11 November · 10:30 London" },
  { title: "Now it is confirmed", explanation: "Each organiser has the booking reference, venue contact, practical details and their own balance. The clubs manage member collection themselves.", action: "Start again", actor: "venue", date: "19 November · 18:00–20:00 London" },
];
const REFUND_STEPS: TourStep[] = [
  { title: "The final decision arrives", explanation: "Club A paid, but the remaining deposit or venue checks are unresolved. The session must close; a verified payment is preserved and is due back in full.", action: "Preview the final-decision closure", actor: "clock", date: "12 November · 12:00 London" },
  { title: "£61.25 due back to Club A", explanation: "Conditional places are released. The venue owns the return, with a five-business-day target. A refund due is not labelled refunded.", action: "Record the venue's demo refund", actor: "venue", date: "19 November · 12:00 London" },
  { title: "Refund verified", explanation: "The venue records evidence that it returned £61.25. The payment and refund history stay available to the organiser.", action: "Start again", actor: "venue", date: "19 November" },
];
export function tourStep(state: TourState): TourStep {
  return state.scenario === "refund" && state.step >= 10
    ? REFUND_STEPS[Math.min(state.step - 10, 2)]! : TOUR_STEPS[Math.min(state.step, 13)]!;
}
export function initialTour(scenario: TourState["scenario"] = "booking"): TourState {
  return { step: 0, scenario, actor: "venue" };
}
export function advanceTour(state: TourState): TourState {
  const current = tourStep(state);
  if (current.actor !== "clock" && current.actor !== state.actor) return state;
  const end = state.scenario === "refund" ? 12 : 13;
  if (state.step >= end) return initialTour(state.scenario);
  const next = { ...state, step: state.step + 1 };
  const actor = tourStep(next).actor;
  return { ...next, actor: actor === "clock" ? "venue" : actor };
}
