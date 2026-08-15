export type ForwardAuth = 'required' | 'optional' | 'public';

export interface ForwardRoute {
  method: 'get' | 'post' | 'put' | 'delete';
  /** Express pattern, identical to the API path below /api. */
  path: string;
  /**
   * `required` — 401 at the BFF when there is no session cookie.
   * `optional` — forward the token when there is one; the API decides.
   * `public`   — never forward a token; the API ignores it on these anyway.
   */
  auth: ForwardAuth;
}

/**
 * Every bookhunt endpoint the browser is allowed to reach, and nothing else.
 *
 * This list, not the API's own router, is what the browser can see now. It is
 * deliberately narrower: `/ai/summary/*`, `/search/facets` and `/search/metadata`
 * all exist on the API but no page calls them, so they stay unreachable from a
 * browser. Add an entry when a page genuinely needs one.
 *
 * The three routes that mint or drop a session (`/auth/login`,
 * `/auth/verify-email`, `/auth/logout`) are not here — they have to touch the
 * cookie, so they get hand-written handlers in create-app.ts.
 *
 * Order matters exactly as it does in the API's own routers: a literal segment
 * has to be registered before the parameter that would otherwise swallow it.
 */
export const FORWARD_ROUTES: ForwardRoute[] = [
  { method: 'post', path: '/auth/register', auth: 'public' },
  { method: 'post', path: '/auth/resend-verification', auth: 'public' },
  // Public: a reader who has forgotten their password has no session to send,
  // and the API ignores a token on both of these anyway. Reachable as of
  // LOS-240, which built the pages that call them.
  { method: 'post', path: '/auth/forgot-password', auth: 'public' },
  { method: 'post', path: '/auth/reset-password', auth: 'public' },

  // Public: the sign-up form asks this before anyone has a session, and the
  // API ignores a token on it anyway.
  { method: 'get', path: '/users/handle-available', auth: 'public' },
  // Literal, and above any future '/users/:handle', mirroring routes/users.ts.
  { method: 'get', path: '/users/search', auth: 'optional' },
  { method: 'get', path: '/users/favorites', auth: 'required' },
  { method: 'put', path: '/users/me', auth: 'required' },
  // Last of the /users block, mirroring routes/users.ts: ':handle' would
  // otherwise swallow the two literals above it. Optional rather than public --
  // a later revision may want to know who is looking.
  { method: 'get', path: '/users/:handle', auth: 'optional' },
  { method: 'get', path: '/users/:handle/library', auth: 'optional' },
  { method: 'get', path: '/users/:handle/favorite-authors', auth: 'optional' },
  { method: 'post', path: '/users/:handle/favorite', auth: 'required' },
  { method: 'delete', path: '/users/:handle/favorite', auth: 'required' },

  { method: 'get', path: '/books', auth: 'optional' },
  { method: 'get', path: '/books/:slug', auth: 'optional' },
  // The literal above ':slug', mirroring routes/authors.ts.
  { method: 'get', path: '/authors/favorites', auth: 'required' },
  { method: 'get', path: '/authors/:slug', auth: 'optional' },
  { method: 'post', path: '/authors/:slug/favorite', auth: 'required' },
  { method: 'delete', path: '/authors/:slug/favorite', auth: 'required' },
  { method: 'get', path: '/search', auth: 'optional' },
  { method: 'get', path: '/recommendations', auth: 'required' },

  // /search and /bulk before /:slug and /:bookId, mirroring routes/library.ts.
  { method: 'get', path: '/library', auth: 'required' },
  { method: 'get', path: '/library/search', auth: 'required' },
  { method: 'post', path: '/library/bulk', auth: 'required' },
  { method: 'post', path: '/library/:slug', auth: 'required' },
  // Before the bare /:bookId, mirroring routes/library.ts: otherwise "favorite"
  // and "hidden" are read as part of a book id.
  { method: 'put', path: '/library/:bookId/favorite', auth: 'required' },
  { method: 'delete', path: '/library/:bookId/favorite', auth: 'required' },
  { method: 'put', path: '/library/:bookId/hidden', auth: 'required' },
  { method: 'delete', path: '/library/:bookId/hidden', auth: 'required' },
  { method: 'put', path: '/library/:bookId', auth: 'required' },
  { method: 'delete', path: '/library/bulk', auth: 'required' },
  { method: 'delete', path: '/library/:bookId', auth: 'required' },
  { method: 'post', path: '/library/:bookId/related', auth: 'required' },
  { method: 'delete', path: '/library/:bookId/related/:relatedBookId', auth: 'required' },

  // The API applies no auth middleware to the theme routes, so there is no
  // token to be gained by sending one.
  { method: 'post', path: '/ai/themes/external', auth: 'public' },
  { method: 'post', path: '/ai/themes/:bookId', auth: 'public' },
  { method: 'post', path: '/ai/search', auth: 'optional' },
  { method: 'post', path: '/ai/categorize', auth: 'required' },

  // Guests see the Discover pills too, so listing must not 401; pinning must.
  { method: 'get', path: '/canned-searches', auth: 'optional' },
  { method: 'post', path: '/canned-searches', auth: 'required' },
  { method: 'post', path: '/canned-searches/:id/pin', auth: 'required' },
  { method: 'delete', path: '/canned-searches/:id/pin', auth: 'required' },

  { method: 'post', path: '/import/resolve', auth: 'required' },
];
