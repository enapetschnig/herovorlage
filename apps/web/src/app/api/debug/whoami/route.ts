import { NextResponse } from "next/server";
import { auth } from "@heatflow/auth";
import { db, schema } from "@heatflow/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    const envs = {
      DATABASE_URL_POOLED: !!process.env.DATABASE_URL_POOLED,
      DATABASE_URL: !!process.env.DATABASE_URL,
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      AUTH_URL: !!process.env.AUTH_URL,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };

    let tenantLookup = null;
    if (session?.user?.tenantId) {
      try {
        const [t] = await db
          .select({ id: schema.tenants.id, name: schema.tenants.name })
          .from(schema.tenants)
          .where(eq(schema.tenants.id, session.user.tenantId))
          .limit(1);
        tenantLookup = t ?? { error: "tenant not found in db" };
      } catch (e) {
        tenantLookup = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    return NextResponse.json({
      ok: true,
      session: session
        ? {
            user: {
              id: session.user?.id,
              email: session.user?.email,
              name: session.user?.name,
              tenantId: session.user?.tenantId,
              role: session.user?.role,
            },
            expires: session.expires,
          }
        : null,
      sessionIsNull: session === null,
      tenantLookup,
      envs,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
      },
      { status: 500 },
    );
  }
}
