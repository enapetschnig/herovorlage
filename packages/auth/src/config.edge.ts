import type { NextAuthConfig, DefaultSession } from "next-auth";

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

export const authConfigEdge: NextAuthConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
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
        pathname.startsWith("/api/trpc/") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        pathname.startsWith("/portal/");
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
};
