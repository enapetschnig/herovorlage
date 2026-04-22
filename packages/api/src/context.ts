import { auth } from "@heatflow/auth";
import { db } from "@heatflow/db";
import type { Session } from "next-auth";

export type Context = {
  db: typeof db;
  session: Session | null;
  tenantId: string | null;
  userId: string | null;
  role: string | null;
  /** Original Request — useful for IP/UA in audit log. */
  req: Request | null;
};

/**
 * Creates a tRPC context from a Next.js Request. Reads the Auth.js session
 * and exposes tenantId/userId so all routers can scope queries.
 */
export async function createContext(opts: { req: Request | null } = { req: null }): Promise<Context> {
  const session = await auth();
  return {
    db,
    session,
    tenantId: session?.user?.tenantId ?? null,
    userId: session?.user?.id ?? null,
    role: session?.user?.role ?? null,
    req: opts.req,
  };
}
