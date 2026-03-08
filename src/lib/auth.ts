/**
 * NextAuth configuration for Marmelad CRM.
 *
 * Strategy: JWT sessions + Credentials provider.
 * - No Prisma adapter needed (adapter is for OAuth account linking / DB sessions).
 * - Passwords are hashed with bcryptjs.
 * - Generic error message — never reveals whether email or password was wrong.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // JWT strategy — no server-side session store needed
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          return null; // Generic — don't reveal "user not found"
        }

        const passwordValid = await compare(
          credentials.password,
          user.passwordHash,
        );

        if (!passwordValid) {
          return null; // Generic — don't reveal "wrong password"
        }

        // Return the user object that NextAuth will encode into the JWT
        return {
          id:    user.id,
          email: user.email,
          name:  user.name,
          role:  user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, `user` is the object returned by `authorize`.
      // Persist role into the JWT so it's available server-side.
      if (user) {
        token.id   = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose id and role on the session object for server components.
      if (session.user) {
        session.user.id   = token.id   as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
