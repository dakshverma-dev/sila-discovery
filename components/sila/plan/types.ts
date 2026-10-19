import type { MyPlanView } from "@/lib/sila/commands/plans";
import type { FormFlash } from "./plan-forms";

/** One idempotency key per form, generated when the page renders. */
export interface PlanKeys {
  commit: string;
  withdraw: string;
  paid: string;
  message: string;
}

export interface PanelProps {
  view: MyPlanView;
  now: Date;
  keys: PlanKeys;
  flash: FormFlash | null;
}

/** Link to another tab or form on the same plan page. */
export function planHref(planId: string, params: Record<string, string>, hash = ""): string {
  const qs = new URLSearchParams(params).toString();
  return `/plans/${planId}${qs ? `?${qs}` : ""}${hash}`;
}
