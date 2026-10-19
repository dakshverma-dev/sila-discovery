import type { ApiError } from "@/lib/db/api";

/** Form results stay in the authenticated response, never in URL query strings. */
export interface VenueActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
  blockers?: string[];
  values?: Record<string, string>;
  key?: string;
  receiptSaved?: boolean;
}

export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

export function formValues(data: FormData): Record<string, string> {
  return Object.fromEntries([...data.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export function actionError(error: ApiError, data: FormData): VenueActionState {
  const fields = error.details?.field_errors;
  return {
    error: error.code === "VERSION_CONFLICT"
      ? "This record changed. Reload the page and review the current details."
      : error.message,
    fieldErrors: fields && typeof fields === "object" ? fields as Record<string, string[]> : {},
    values: formValues(data),
  };
}
