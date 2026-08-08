import { useCallback, useState } from 'react';
import { postResendVerification } from '../../api/auth/resend-verification';

export type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Requesting a fresh verification link, shared by the check-your-email panel
 * and the sign-in page's not-yet-verified branch.
 *
 * There is nothing to report on success beyond "sent": the endpoint answers the
 * same for an unknown address, an unverified one and an already-verified one,
 * so that it cannot be used to find out which addresses have accounts.
 */
export function useResendVerification(email: string) {
  const [status, setStatus] = useState<ResendStatus>('idle');

  const resend = useCallback(async () => {
    setStatus('sending');
    try {
      await postResendVerification({ email });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }, [email]);

  return { status, resend };
}
