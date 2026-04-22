import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, schema } from "@heatflow/db";
import { loginSchema } from "@heatflow/schemas";
import { eq, and, isNull } from "drizzle-orm";
import { verifyPassword } from "./password";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    tenantId?: string;
    role?: string;
  }
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const rows = await db
          .select({
            id: schema.users.id,
            tenantId: schema.users.tenantId,
            email: schema.users.email,
            name: schema.users.name,
            passwordHash: schema.users.passwordHash,
            role: schema.users.role,
            active: schema.users.active,
          })
          .from(schema.users)
          .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
          .limit(1);

        const user = rows[0];
        if (!user || !user.active) return null;

        const ok = await verifyPassword(user.passwordHash, password);
        if (!ok) return null;

        // Update last_login_at (fire-and-forget; don't block login on this)
        db.update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, user.id))
          .catch(() => {});

        return {
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name,
          role: user.role,
        } as never;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = (user as { id: string }).id;
        token.tenantId = (user as { tenantId: string }).tenantId;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.tenantId = (token.tenantId as string) ?? "";
        session.user.role = (token.role as string) ?? "technician";
      }
      return session;
    },
    authorized: ({ auth, request }) => {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/pricing" ||
        pathname === "/help" ||
        pathname.startsWith("/help/") ||
        pathname === "/api/auth" ||
        pathname.startsWith("/api/auth/") ||
        pathname.startsWith("/api/trpc/") || // procedure-level auth handled by tRPC middleware
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        pathname.startsWith("/portal/"); // public customer portal
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
