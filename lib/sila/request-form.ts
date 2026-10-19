/** State the O1 request form carries between the browser and its server action (no server imports: the client form uses it too). */
export interface RequestFormValues {
  clubName: string;
  places: string;
  email: string;
}

export interface RequestFormState {
  status: "idle" | "error" | "saved";
  /** Summary shown above the button when status is "error". */
  message: string | null;
  /** Field messages keyed by `clubName`, `places` or `email`. */
  fields: Record<string, string>;
  values: RequestFormValues;
  /** The idempotency key for the next submit. A rejected submit gets a fresh one (rejections are stored under the key). */
  key: string;
  /** The address the sign-in email went to, when status is "saved". */
  sentTo: string | null;
}
