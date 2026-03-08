/**
 * NextAuth route protection middleware.
 *
 * Redirects unauthenticated users to /login.
 * Excludes: /login, /api/auth/*, /api/health, static assets.
 */

export { default } from "next-auth/middleware";

export const config = {
  /*
   * Protect all routes EXCEPT:
   *  - /login          → login page itself
   *  - /api/auth/*     → NextAuth endpoints (sign-in, callback, etc.)
   *  - /api/health     → healthcheck (used by Docker / load balancer)
   *  - /_next/*        → Next.js internals (static assets, HMR)
   *  - /favicon.ico    → browser favicon
   */
  matcher: [
    "/((?!login|api/auth|api/health|_next|favicon\\.ico).*)",
  ],
};
