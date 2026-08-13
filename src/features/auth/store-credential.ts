/**
 * Asks the browser to remember a password (LOS-241).
 *
 * Password managers offer to save on one of two signals: a form submit that
 * navigates, or a form that survives the submit. This app gives neither —
 * handlers call preventDefault(), and RegisterPage swaps the whole form out for
 * CheckYourEmail in the same tick — so nothing was ever offered for saving. A
 * real reader generated a password at sign-up, was never prompted, and was
 * locked out of the account immediately.
 *
 * The Credential Management API asks outright rather than hoping a heuristic
 * fires. Chrome and Edge implement it; Safari and Firefox do not, which is why
 * everything here is feature-detected.
 *
 * Never rejects, and never blocks. This runs after the account or session it
 * describes already exists, so a browser that refuses — unsupported, insecure
 * context, reader dismissed the prompt — must not turn a successful sign-in into
 * a visible failure.
 */
export async function storeCredential(
  email: string | null | undefined,
  password: string,
): Promise<void> {
  if (!email || !password) return;

  // Both checks matter: Firefox has navigator.credentials but no
  // PasswordCredential, so testing only for the former throws on construction.
  const PasswordCredentialCtor = (
    window as unknown as { PasswordCredential?: new (data: { id: string; password: string }) => Credential }
  ).PasswordCredential;
  if (!('credentials' in navigator) || !PasswordCredentialCtor) return;

  try {
    await navigator.credentials.store(new PasswordCredentialCtor({ id: email, password }));
  } catch {
    // Deliberately silent. There is nothing the reader could do about it, and
    // the thing they were actually trying to do has already succeeded.
  }
}
