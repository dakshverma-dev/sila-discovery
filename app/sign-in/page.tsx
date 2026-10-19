import type { Metadata } from "next";
import { SiteHeader } from "@/components/sila/chrome";
import { safeNextPath } from "@/lib/sila/auth";
import { requestSignInLink } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  rate: "Too many sign-in emails were requested. Wait a few minutes and try again.",
  send: "We could not send the email. Try again in a moment.",
  link: "That sign-in link is invalid or has expired. Request a new one.",
};

type Search = { next?: string | string[]; sent?: string | string[]; error?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next) ?? null);
  const sent = first(sp.sent) === "1";
  const errorKey = first(sp.error);
  const error = errorKey ? ERRORS[errorKey] : undefined;

  return (
    <>
      <SiteHeader />
      <main id="main" className="page stack-lg auth-panel">
        <header className="stack">
          <h1 className="page-title">Sign in</h1>
          <p>We email you a one-time link. There is no password to remember.</p>
        </header>

        {error ? (
          <p className="flash flash-error" role="alert">
            {error}
          </p>
        ) : null}

        {sent ? (
          <p className="flash flash-notice" role="status">
            Check your email for a sign-in link. You can close this tab.
          </p>
        ) : (
          <form action={requestSignInLink} className="stack" noValidate>
            <input type="hidden" name="next" value={next} />
            <div className="stack">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                aria-invalid={errorKey === "email" ? true : undefined}
                aria-describedby={errorKey === "email" ? "email-error" : undefined}
              />
              {errorKey === "email" ? (
                <span id="email-error" className="visually-hidden">
                  {ERRORS.email}
                </span>
              ) : null}
            </div>
            <button type="submit" className="button button-primary">
              Email me a sign-in link
            </button>
          </form>
        )}
      </main>
    </>
  );
}
