/**
 * NextAuth type augmentation.
 *
 * Extends the default Session and JWT types to include `id` and `role`
 * so TypeScript knows about them in server components and API routes.
 */

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:    string;
      role:  string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?:   string;
    role?: string;
  }
}
