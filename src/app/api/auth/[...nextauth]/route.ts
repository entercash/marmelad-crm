/**
 * NextAuth API route handler with IP-based rate limiting.
 *
 * Rate limits only credential sign-in attempts (POST to callback/credentials).
 * IP-based: max 10 attempts per 15 minutes per IP address.
 * Email-based limiting is handled inside authorize() in auth.ts.
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { loginIpLimiter } from "@/lib/rate-limit";

const authHandler = NextAuth(authOptions);

async function handler(
  req: Request,
  ctx: { params: { nextauth: string[] } },
) {
  // Rate-limit only credential sign-in attempts
  if (req.method === "POST") {
    const slug = ctx.params.nextauth?.join("/") ?? "";

    if (slug === "callback/credentials") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";

      const { allowed, retryAfterMs } = loginIpLimiter.check(ip);

      if (!allowed) {
        console.warn(`[auth] IP rate-limited: ${ip}`);
        return new Response(
          JSON.stringify({
            error: "Too many login attempts. Please try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(
                Math.ceil((retryAfterMs ?? 900_000) / 1000),
              ),
            },
          },
        );
      }
    }
  }

  return authHandler(req, ctx);
}

export { handler as GET, handler as POST };
