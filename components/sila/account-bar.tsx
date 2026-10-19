/** Signed-in email and a sign-out button. Sign-out is a POST so a link or prefetch cannot trigger it. */
export function AccountBar({ email }: { email: string }) {
  return (
    <div className="account-bar" role="group" aria-label="Account">
      <p className="account-bar-email">
        Signed in as <strong data-testid="account-email">{email}</strong>
      </p>
      <form action="/auth/sign-out" method="post">
        <button type="submit" className="account-bar-out">
          Sign out
        </button>
      </form>
    </div>
  );
}
