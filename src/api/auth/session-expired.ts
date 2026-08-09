// How apiFetch tells the app that the session is gone.
//
// Nothing announces a cookie expiring, so the first sign is a 401 on an
// ordinary call — which happens deep inside the API layer, far from the React
// tree that has to react to it. An event keeps that one-way: the client layer
// stays free of any import from features/, and AuthProvider is the only
// listener.

export const SESSION_EXPIRED_EVENT = 'bookhunt:session-expired';

export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
