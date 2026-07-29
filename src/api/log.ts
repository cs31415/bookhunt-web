/**
 * Request logging for everything that leaves the app.
 *
 * On by default in dev so a failed call is never silent; VITE_LOG_API_CALLS
 * forces it either way (set it to 'true' to keep logging in a prod build, or
 * 'false' to quiet dev down).
 *
 * Every line is prefixed "[api]" so the console can be filtered to just these.
 */
const flag = import.meta.env.VITE_LOG_API_CALLS;
export const LOG_API_CALLS = flag === 'true' || (flag !== 'false' && import.meta.env.DEV);

export function logRequest(method: string, target: string, body?: unknown): void {
  if (!LOG_API_CALLS) return;
  console.log(`[api] → ${method} ${target}`, body ?? '');
}

export function logResponse(method: string, target: string, status: number, body?: unknown): void {
  if (!LOG_API_CALLS) return;
  console.log(`[api] ← ${method} ${target} ${status}`, body ?? '');
}

/**
 * Always logged, regardless of the flag — a request that never produced a
 * response is exactly what you need to see when something goes wrong. Network
 * and CORS failures land here rather than in logResponse, because fetch rejects
 * without ever yielding a status.
 */
export function logFailure(method: string, target: string, error: unknown): void {
  console.error(`[api] ✗ ${method} ${target}`, error);
}
